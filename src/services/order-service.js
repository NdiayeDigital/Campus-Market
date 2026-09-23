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

    // 1. Vérification et rattachement dynamique de seller_id pour chaque article du panier
    for (const item of items) {
        if (!item.seller_id && !item.seller?.id && !item.sellerId) {
            const prodId = item.id || item.product_id;
            if (prodId) {
                try {
                    const { data: prodData } = await supabase
                        .from('products')
                        .select('seller_id, seller:seller_id(id, prenom, nom, telephone)')
                        .eq('id', prodId)
                        .maybeSingle();

                    if (prodData?.seller_id) {
                        item.seller_id = prodData.seller_id;
                        if (prodData.seller) {
                            item.seller = prodData.seller;
                            item.seller_name = `${prodData.seller.prenom || ''} ${prodData.seller.nom || ''}`.trim();
                            item.seller_phone = prodData.seller.telephone || '';
                        }
                    }
                } catch (fetchErr) {
                    console.warn('[OrderService] Erreur récupération seller_id pour produit:', prodId, fetchErr);
                }
            }
        }
    }

    const missingSeller = items.find((i) => !i.seller_id && !i.seller?.id && !i.sellerId);
    if (missingSeller) {
        throw new Error(`Impossible d'identifier le vendeur pour l'article "${missingSeller.title || 'sélectionné'}". Veuillez retirer cet article et réessayer.`);
    }

    // 2. Préparation rigoureuse des lignes de commandes pour Supabase (strictement conformes aux 10 colonnes)
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
        // Tentative d'insertion avec colonne reference (si la table a été enrichie)
        const payloadWithRef = ordersToInsert.map((ord) => ({
            ...ord,
            reference,
        }));

        let insertError = null;
        // On effectue un insert SANS .select() pour utiliser "Prefer: return=minimal".
        // RÈGLE RLS CRUCIALE : Les acheteurs non-connectés (invités) ne disposent pas
        // de permission SELECT sur la table orders (pour protéger la vie privée des étudiants).
        // Par conséquent, un .select() ou RETURNING * déclenche une erreur RLS 42501 et annule l'insertion.
        // L'insertion sans .select() utilise Prefer: return=minimal et réussit toujours.
        const { error: errWithRef } = await supabase.from('orders').insert(payloadWithRef);

        if (errWithRef) {
            // Si la colonne 'reference' n'existe pas en base, repli sur le payload strict 10 colonnes
            if (errWithRef.message && (errWithRef.message.includes('reference') || errWithRef.message.includes('column'))) {
                const { error: errCore } = await supabase.from('orders').insert(ordersToInsert);
                if (errCore) insertError = errCore;
            } else {
                insertError = errWithRef;
            }
        }

        if (insertError) {
            // En cas d'échec réseau imprévu, fallback dans la file hors-ligne
            if (insertError.message && (insertError.message.includes('fetch') || insertError.message.includes('network') || insertError.message.includes('Failed to fetch'))) {
                savePendingOrdersLocally(ordersToInsert);
                clearCart();
                return {
                    success: true,
                    reference,
                    isOffline: true,
                    message: 'Réseau instable. Commande mise en file d’attente locale pour synchronisation.',
                };
            }
            throw insertError;
        }

        // Succès : vidage automatique du panier
        clearCart();

        const firstItem = items[0] || {};
        const sellerName = firstItem.seller_name || (firstItem.seller ? `${firstItem.seller.prenom} ${firstItem.seller.nom}`.trim() : 'Vendeur UIDT');
        const sellerPhone = firstItem.seller_phone || firstItem.seller?.telephone || '';

        return {
            success: true,
            reference,
            isOffline: false,
            orders: ordersToInsert,
            orderId: reference,
            sellerName,
            sellerPhone,
        };
    } catch (err) {
        console.error('[OrderService] Erreur lors de l’insertion de la commande:', err);
        throw new Error(err.message || 'Erreur lors de l’envoi de votre commande. Veuillez réessayer.');
    }
}

/**
 * Récupère le statut en direct d'une commande via la fonction RPC sécurisée ou requête directe.
 * @param {Object} params
 * @param {string} [params.orderId]
 * @param {string} [params.reference]
 * @param {string} [params.phone]
 * @returns {Promise<Object|null>}
 */
export async function fetchLiveOrderStatus({ orderId, reference, phone } = {}) {
    if (!orderId && !reference) return null;

    try {
        const targetRef = reference || (orderId ? `#CMD-${orderId.slice(0, 6).toUpperCase()}` : '');
        
        // 1. Appel RPC sécurisé (track_order_secure)
        const { data: rpcData, error: rpcErr } = await supabase.rpc('track_order_secure', {
            p_reference: targetRef,
            p_phone: phone || '',
        });

        if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
            return rpcData[0];
        }

        // 2. Repli direct si utilisateur authentifié ou si RLS le permet
        if (orderId) {
            const { data, error } = await supabase
                .from('orders')
                .select('id, status, price, quantity, delivery_address, created_at, seller_id, seller:seller_id(id, prenom, nom, telephone)')
                .eq('id', orderId)
                .maybeSingle();

            if (!error && data) {
                return {
                    ...data,
                    seller_name: data.seller ? `${data.seller.prenom} ${data.seller.nom}`.trim() : 'Vendeur UIDT',
                    seller_phone: data.seller?.telephone || '',
                };
            }
        }

        return null;
    } catch (err) {
        console.warn('[OrderService] Erreur fetchLiveOrderStatus:', err);
        return null;
    }
}

/**
 * Permet à un étudiant d'annuler sa commande si elle est toujours en attente (pending).
 * @param {string} orderId
 * @returns {Promise<Object>}
 */
export async function cancelOrderByBuyer(orderId) {
    if (!orderId) throw new Error('Identifiant commande requis.');

    const { data, error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec d'annulation de la commande: ${error.message}`);
    }
    return data;
}

/**
 * Enregistre l'avis et la note d'un étudiant pour un vendeur après livraison.
 * @param {Object} reviewData
 * @param {string} reviewData.sellerId - UUID du marchand
 * @param {string} [reviewData.orderId] - UUID de la commande
 * @param {number} reviewData.rating - Note de 1 à 5
 * @param {string} [reviewData.comment] - Commentaire libre
 * @returns {Promise<Object>}
 */
export async function submitOrderReview({ sellerId, orderId = null, rating, comment = '' }) {
    if (!sellerId) throw new Error('Identifiant marchand manquant.');
    const note = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));

    let buyerId = null;
    try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) buyerId = authData.user.id;
    } catch {
        buyerId = null;
    }

    const { data, error } = await supabase
        .from('reviews')
        .insert([{
            seller_id: sellerId,
            order_id: orderId || null,
            buyer_id: buyerId,
            rating: note,
            comment: comment.trim(),
        }])
        .select()
        .single();

    if (error) {
        throw new Error(`Impossible d'enregistrer votre avis: ${error.message}`);
    }
    return data;
}

export default {
    createOrder,
    buildOrderPayload,
    generateOrderReference,
    syncPendingOrders,
    getPendingOfflineOrders,
    fetchLiveOrderStatus,
    cancelOrderByBuyer,
    submitOrderReview,
};
