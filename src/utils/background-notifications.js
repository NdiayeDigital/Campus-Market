/**
 * Service de gestion des notifications système et en arrière-plan pour Campus Market.
 * Utilise la Web Notifications API, le Service Worker et le protocole Web Push VAPID
 * pour notifier le marchand même lorsque l'application est fermée ou le téléphone verrouillé.
 */

import { VAPID_CONFIG, urlBase64ToUint8Array } from '../config/push.js';
import { supabase } from '../services/supabase.js';

/**
 * Vérifie si les notifications du navigateur sont supportées.
 * @returns {boolean}
 */
export function isNotificationSupported() {
    return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Récupère le statut actuel de permission ('granted', 'denied', 'default', ou 'unsupported').
 * @returns {'granted'|'denied'|'default'|'unsupported'}
 */
export function getNotificationPermission() {
    if (!isNotificationSupported()) return 'unsupported';
    return Notification.permission;
}

/**
 * Sollicite formellement l'autorisation de l'utilisateur pour afficher les notifications.
 * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
 */
export async function requestNotificationPermission() {
    if (!isNotificationSupported()) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    try {
        const permission = await Notification.requestPermission();
        return permission;
    } catch (err) {
        console.warn('[BackgroundNotifications] Erreur demande permission:', err);
        return Notification.permission;
    }
}

/**
 * Enregistre le terminal du vendeur pour recevoir les notifications Push même en veille.
 * @param {string} sellerId - UUID du vendeur
 * @returns {Promise<boolean>}
 */
export async function subscribeSellerToPush(sellerId) {
    if (!sellerId) return false;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('[WebPush] PushManager non supporté par ce navigateur.');
        return false;
    }

    try {
        const permission = await requestNotificationPermission();
        if (permission !== 'granted') return false;

        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();

        if (!sub) {
            const applicationServerKey = urlBase64ToUint8Array(VAPID_CONFIG.publicKey);
            sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey,
            });
        }

        const subJson = sub.toJSON();
        const endpoint = sub.endpoint;
        const p256dh = subJson.keys?.p256dh;
        const auth = subJson.keys?.auth;

        if (!endpoint || !p256dh || !auth) {
            console.warn('[WebPush] Données de souscription incomplètes.');
            return false;
        }

        // Enregistrer la clé push dans Supabase
        const { error } = await supabase
            .from('seller_push_subscriptions')
            .upsert(
                {
                    seller_id: sellerId,
                    endpoint,
                    p256dh,
                    auth,
                    user_agent: navigator.userAgent || 'Inconnu',
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'endpoint' }
            );

        if (error) {
            console.warn('[WebPush] Erreur sauvegarde souscription Supabase:', error.message);
            return false;
        }

        console.log('[WebPush] Terminal vendeur enregistré pour les alertes push en veille !');
        return true;
    } catch (err) {
        console.warn('[WebPush] Échec enregistrement push en veille:', err);
        return false;
    }
}

/**
 * Vérifie si le terminal est déjà abonné aux notifications Web Push.
 * @returns {Promise<boolean>}
 */
export async function isSellerPushSubscribed() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        return false;
    }
    try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        return !!sub;
    } catch {
        return false;
    }
}

/**
 * Affiche une notification de commande au marchand (en premier plan ou arrière-plan local).
 * @param {Object} options
 * @param {string} options.title - Titre de la notification
 * @param {string} options.body - Corps du message (nom client, montant, lieu)
 * @param {string} [options.icon='/assets/logo-192x192.png'] - Icône de notification
 * @param {string} [options.url='/#seller'] - Cible au clic
 * @param {string} [options.tag='new-order'] - Tag pour dédupliquer
 * @returns {Promise<boolean>}
 */
export async function showOrderNotification({
    title = '🛍️ Nouvelle commande - Campus Market',
    body = 'Un étudiant vient de passer une commande sur votre boutique !',
    icon = '/assets/logo-192x192.png',
    url = '/#seller',
    tag = 'order-notification-' + Date.now(),
} = {}) {
    if (!isNotificationSupported() || Notification.permission !== 'granted') {
        return false;
    }

    const notificationOptions = {
        body,
        icon,
        badge: icon,
        tag,
        renotify: true,
        requireInteraction: true,
        vibrate: [200, 100, 200, 100, 200],
        data: {
            url,
            dateOfArrival: Date.now(),
        },
    };

    // 1. Tenter via le Service Worker (optimal pour mobile et onglets en arrière-plan)
    if ('serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.ready;
            if (reg && typeof reg.showNotification === 'function') {
                await reg.showNotification(title, notificationOptions);
                return true;
            }
        } catch (swErr) {
            console.warn('[BackgroundNotifications] Repli SW vers Notification native:', swErr);
        }
    }

    // 2. Repli direct avec le constructeur Notification natif (Desktop)
    try {
        const notif = new Notification(title, notificationOptions);
        notif.onclick = () => {
            window.focus();
            if (url && window.location.hash !== url) {
                window.location.hash = url;
            }
            notif.close();
        };
        return true;
    } catch (notifErr) {
        console.warn('[BackgroundNotifications] Échec déclenchement notification:', notifErr);
        return false;
    }
}

export default {
    isNotificationSupported,
    getNotificationPermission,
    requestNotificationPermission,
    subscribeSellerToPush,
    isSellerPushSubscribed,
    showOrderNotification,
};
