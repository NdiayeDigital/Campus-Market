/**
 * Service de gestion des commandes Campus Market.
 *
 * RÈGLE D'OR DU PROJET :
 * Strictement AUCUN blocage d'authentification pour les acheteurs.
 * Tout étudiant peut finaliser son achat en indiquant simplement son pavillon et sa chambre.
 * Si l'acheteur est connecté, son identifiant est automatiquement rattaché (`buyer_id`),
 * sinon la commande est enregistrée avec `buyer_id: null` conformément aux politiques RLS Supabase.
 */

import { supabase } from './supabase.js';
import { clearCart } from './cart-store.js';

const OFFLINE_QUEUE_KEY = 'pending_sync_orders';

/**
 * Génère une référence lisible pour la commande (ex: #CM-4821).
 * @returns {string}
 */
export function generateOrderReference() {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `#CM-${randomSuffix}`;
}

/**
 * Récupère les commandes en attente de synchronisation hors-ligne.
 * @returns {Array}
 */
export function getPendingOfflineOrders() {
    try {
        const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.warn('[OrderService] Erreur lecture queue hors-ligne:', e);
        return [];
    }
}

/**
 * Enregistre des commandes dans la file d'attente hors-ligne du LocalStorage.
 * @param {Array} orders - Liste d'enregistrements à synchroniser plus tard
 */
export function savePendingOrdersLocally(orders) {
    try {
        const existing = getPendingOfflineOrders();
        const updated = [...existing, ...orders];
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error('[OrderService] Erreur sauvegarde locale des commandes:', e);
    }
}

/**
 * Vide ou met à jour la file d'attente locale.
 * @param {Array} [remaining=[]]
 */
export function clearPendingOfflineOrders(remaining = []) {
    if (remaining.length === 0) {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
    } else {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    }
}

/**
 * Synchronise les commandes locales en attente avec Supabase lorsque la connexion est rétablie.
 * @returns {Promise<{ syncedCount: number, error: any }>}
 */
export async function syncPendingOrders() {
    if (!navigator.onLine) {
        return { syncedCount: 0, error: 'Toujours hors-ligne' };
    }

    const pending = getPendingOfflineOrders();
    if (pending.length === 0) {
        return { syncedCount: 0, error: null };
    }

    try {
        const { error } = await supabase.from('orders').insert(pending);
        if (error) throw error;

        const count = pending.length;
        clearPendingOfflineOrders();
        console.log(`✅ [OrderService] ${count} commande(s) hors-ligne synchronisée(s) avec succès.`);

        // Émission d'un événement global pour informer l'UI
        window.dispatchEvent(
            new CustomEvent('campus-market:orders-synced', {
                detail: { count },
            })
        );

        return { syncedCount: count, error: null };
    } catch (err) {
        console.error('[OrderService] Échec de synchronisation des commandes hors-ligne:', err);
        return { syncedCount: 0, error: err };
    }
}

// Écoute automatique du rétablissement de la connectivité réseau
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
        console.log('[OrderService] Connexion Internet rétablie. Tentative de synchronisation...');
        syncPendingOrders();
    });
}

/**
 * Construit les enregistrements de commande strictement conformes aux colonnes réelles de la table `orders`.
 * Colonnes réelles vérifiées en base :
 * - buyer_name (concatène prénom et nom)
 * - buyer_phone
 * - delivery_address (concatène pavillon et chambre, ex: "Pavillon Jardin Social, Chambre hhdha")
 * - payment_method (wave | om | cash)
 * - seller_id (UUID du vendeur de l'article)
 * - product_id (UUID de l'article)
 * - price (prix unitaire ou total selon la logique du panier)
 * - quantity
 * - status ('pending')
 * - buyer_id (null si anonyme, ou user.id si connecté)
 *
 * @param {Object} params
 * @returns {Array<Object>}
 */
export function buildOrderPayload({
    clientNom,
    clientPrenom,
    clientTelephone,
    pavillon,
    chambre,
    paymentMethod = 'cash',
    items = [],
    buyerId = null,
}) {
    const buyerName = `${clientPrenom} ${clientNom}`.trim();
    const fullDeliveryAddress = `${pavillon}, Chambre ${chambre}`.trim();

    const validMethods = ['cash', 'wave', 'om'];
    const normalizedMethod = typeof paymentMethod === 'string' ? paymentMethod.toLowerCase().trim() : 'cash';
    const finalPaymentMethod = validMethods.includes(normalizedMethod) ? normalizedMethod : 'cash';

    return items.map((item) => {
        const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
        const unitPrice = Number(item.price) || 0;
        return {
            buyer_name: buyerName,
            buyer_phone: String(clientTelephone).trim(),
            delivery_address: fullDeliveryAddress,
            payment_method: finalPaymentMethod,
            seller_id: item.seller_id || item.seller?.id,
            product_id: item.id || item.product_id,
            price: unitPrice * quantity,
            quantity,
            status: 'pending',
            buyer_id: buyerId || null,
        };
    });
}

/**
 * Crée et enregistre une commande pour un panier d'articles.
 *
 * @param {Object} orderData
 * @param {string} orderData.clientNom - Nom de famille de l'étudiant
 * @param {string} orderData.clientPrenom - Prénom de l'étudiant
 * @param {string} orderData.clientTelephone - Numéro de contact (Wave/Orange Money/Appel)
 * @param {string} orderData.pavillon - Pavillon de livraison (ex: 'Pavillon A')
 * @param {string} orderData.chambre - Chambre ou précision de lieu
 * @param {('cash'|'wave'|'om')} [orderData.paymentMethod='cash'] - Méthode de paiement choisie
 * @param {Array} orderData.items - Articles du panier ({ id, seller_id, price, quantity, title })
 * @returns {Promise<{ success: boolean, reference: string, isOffline: boolean, error?: string }>}
 */
export async function createOrder({
    clientNom,
    clientPrenom,
    clientTelephone,
    pavillon,
    chambre,
    paymentMethod = 'cash',
    items = [],
}) {
    if (!items || items.length === 0) {
        throw new Error('Le panier est vide. Impossible de passer la commande.');
    }

    if (!clientPrenom || !clientNom || !clientTelephone) {
        throw new Error('Veuillez renseigner vos coordonnées (Prénom, Nom, Téléphone).');
    }

    if (!pavillon || !chambre) {
        throw new Error('Veuillez indiquer votre lieu de livraison (Pavillon et Chambre).');
    }

    const reference = generateOrderReference();

    // Vérification facultative de la session : si l'acheteur est authentifié, on l'associe.
    // S'il n'est pas connecté, buyer_id reste null (AUCUN blocage).
    let buyerId = null;
    try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
            buyerId = authData.user.id;
        }
    } catch {
        // Mode invité sans compte
        buyerId = null;
    }

    // Préparation rigoureuse des lignes de commandes pour Supabase (strictement conformes aux 10 colonnes)
    const ordersToInsert = buildOrderPayload({
        clientNom,
        clientPrenom,
        clientTelephone,
        pavillon,
        chambre,
        paymentMethod,
        items,
        buyerId,
    });

    // Gestion du mode hors-ligne immédiat
    if (!navigator.onLine) {
        savePendingOrdersLocally(ordersToInsert);
        clearCart();
        return {
            success: true,
            reference,
            isOffline: true,
            message: 'Commande enregistrée hors-ligne. Elle sera expédiée dès le retour de votre connexion.',
        };
    }

    try {
        const { data, error } = await supabase.from('orders').insert(ordersToInsert).select();

        if (error) {
            // En cas d'échec réseau imprévu, fallback dans la file hors-ligne
            if (error.message && (error.message.includes('fetch') || error.message.includes('network'))) {
                savePendingOrdersLocally(ordersToInsert);
                clearCart();
                return {
                    success: true,
                    reference,
                    isOffline: true,
                    message: 'Réseau instable. Commande mise en file d’attente locale pour synchronisation.',
                };
            }
            throw error;
        }

        // Succès : vidage automatique du panier
        clearCart();

        return {
            success: true,
            reference,
            isOffline: false,
            orders: data,
        };
    } catch (err) {
        console.error('[OrderService] Erreur lors de l’insertion de la commande:', err);
        throw new Error(err.message || 'Erreur lors de l’envoi de votre commande. Veuillez réessayer.');
    }
}

export default {
    createOrder,
    buildOrderPayload,
    generateOrderReference,
    syncPendingOrders,
    getPendingOfflineOrders,
};
