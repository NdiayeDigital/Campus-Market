/**
 * Service de gestion des notifications système et en arrière-plan pour Campus Market.
 * Utilise la Web Notifications API et le Service Worker pour notifier le marchand
 * même lorsque l'onglet est masqué, minimisé ou en veille.
 */

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
 * Affiche une notification de commande au marchand (en premier plan ou arrière-plan).
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
    showOrderNotification,
};
