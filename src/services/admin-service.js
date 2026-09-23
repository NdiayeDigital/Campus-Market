/**
 * Service d'administration globale (SuperAdmin UIDT).
 * Permet la supervision globale de la plateforme, l'approbation/refus des candidatures
 * de vendeurs, la modération des produits et le calcul des métriques financières réelles.
 */

import { supabase } from './supabase.js';

/**
 * Vérifie formellement si l'utilisateur possède le rôle 'superadmin'.
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<boolean>}
 */
export async function verifyAdminRole(userId) {
    if (!userId) return false;

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();

        if (error || !data) return false;
        return data.role === 'superadmin';
    } catch {
        return false;
    }
}

/**
 * Connecte un administrateur et vérifie ses privilèges.
 * @param {Object} credentials
 * @param {string} credentials.email
 * @param {string} credentials.password
 * @returns {Promise<{ user: Object, profile: Object }>}
 */
export async function loginAdmin({ email, password }) {
    if (!email || !password) {
        throw new Error('Email et mot de passe requis.');
    }

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
    });

    if (authErr) {
        throw new Error('Identifiants administrateur incorrects.');
    }

    const user = authData.user;
    const isAdmin = await verifyAdminRole(user.id);
    if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error('Accès refusé : ce compte ne possède pas les droits Super Administrateur.');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return { user, profile };
}

/**
 * Calcule les métriques globales RÉELLES de la plateforme (aucun plancher artificiel).
 * @returns {Promise<{ activeSellersCount: number, pendingSellersCount: number, totalOrdersCount: number, totalDeliveredRevenue: number }>}
 */
export async function fetchGlobalMetrics() {
    try {
        // 1. Profils (vendeurs actifs et en attente)
        const { data: profiles, error: errProf } = await supabase
            .from('profiles')
            .select('id, role');

        if (errProf) throw errProf;

        const allProfiles = profiles || [];
        const suspendedIds = getSuspendedSellersCache();
        const activeSellersCount = allProfiles.filter((p) => (p.role === 'vendeur' || p.role === 'superadmin') && !suspendedIds.includes(p.id) && p.role !== 'vendeur_desactive' && p.role !== 'suspendu').length;
        const pendingSellersCount = allProfiles.filter((p) => p.role === 'vendeur_pending').length;
        const suspendedSellersCount = allProfiles.filter((p) => p.role === 'vendeur_desactive' || p.role === 'suspendu' || suspendedIds.includes(p.id)).length;

        // 2. Commandes globales et CA réel
        const { data: orders, error: errOrders } = await supabase
            .from('orders')
            .select('id, price, status');

        if (errOrders) throw errOrders;

        const allOrders = orders || [];
        const totalOrdersCount = allOrders.length;
        const deliveredOrders = allOrders.filter((o) => o.status === 'delivered');

        // Somme des chiffres d'affaires réels sur les commandes livrées (Volume d'affaires vendeur)
        const totalDeliveredRevenue = deliveredOrders.reduce(
            (sum, o) => sum + (Number(o.price) || 0),
            0
        );

        // 3. Revenus Récurrents Réels : Cotisations récurrentes des abonnements vendeurs (2 000 FCFA/mois par boutique active)
        const SELLER_MONTHLY_SUBSCRIPTION_FEE = 2000;
        const totalSubscriptionRevenue = activeSellersCount * SELLER_MONTHLY_SUBSCRIPTION_FEE;

        return {
            activeSellersCount,
            pendingSellersCount,
            suspendedSellersCount,
            totalOrdersCount,
            totalDeliveredRevenue,
            totalSubscriptionRevenue,
            sellerMonthlyFee: SELLER_MONTHLY_SUBSCRIPTION_FEE,
        };
    } catch (err) {
        console.error('[AdminService] Erreur fetchGlobalMetrics:', err);
        throw new Error('Impossible de charger les métriques globales.');
    }
}

/**
 * Récupère la liste des étudiants en attente de validation du statut vendeur.
 * @returns {Promise<Array>}
 */
export async function fetchPendingSellers() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('role', 'vendeur_pending')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('[AdminService] Erreur fetchPendingSellers:', err);
        throw err;
    }
}

// Clé de persistance pour état de suspension local (résilience avant migration DB)
export const SUSPENDED_SELLERS_KEY = 'campus_market_suspended_sellers';

/**
 * Récupère la liste des IDs vendeurs suspendus en cache local.
 * @returns {string[]}
 */
export function getSuspendedSellersCache() {
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(SUSPENDED_SELLERS_KEY);
            return raw ? JSON.parse(raw) : [];
        }
    } catch {}
    return [];
}

/**
 * Enregistre ou retire un vendeur de la liste des suspendus en cache local.
 * @param {string} sellerId
 * @param {boolean} isSuspended
 */
export function setSuspendedSellerInCache(sellerId, isSuspended) {
    if (!sellerId) return;
    try {
        if (typeof localStorage !== 'undefined') {
            let list = getSuspendedSellersCache();
            if (isSuspended) {
                if (!list.includes(sellerId)) list.push(sellerId);
            } else {
                list = list.filter((id) => id !== sellerId);
            }
            localStorage.setItem(SUSPENDED_SELLERS_KEY, JSON.stringify(list));
        }
    } catch {}
}

/**
 * Détermine avec certitude si un vendeur est actuellement suspendu.
 * Vérifie le champ booléen is_suspended, le rôle 'vendeur_desactive'/'suspendu',
 * ou le cache persistant local.
 * @param {Object} seller
 * @returns {boolean}
 */
export function isSellerSuspended(seller) {
    if (!seller) return false;
    if (seller.is_suspended === true) return true;
    if (seller.role === 'vendeur_desactive' || seller.role === 'suspendu') return true;
    const suspendedIds = getSuspendedSellersCache();
    if (suspendedIds.includes(seller.id)) return true;
    return false;
}

/**
 * Récupère la liste des vendeurs actifs certifiés et suspendus.
 * Synchronise l'état avec le cache local pour une persistance immédiate.
 * @returns {Promise<Array>}
 */
export async function fetchActiveSellers() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .in('role', ['vendeur', 'vendeur_desactive', 'suspendu'])
            .order('created_at', { ascending: false });

        if (error) throw error;
        const sellers = data || [];
        const suspendedIds = getSuspendedSellersCache();

        return sellers.map((s) => {
            const suspended = s.is_suspended === true || 
                s.role === 'vendeur_desactive' || 
                s.role === 'suspendu' || 
                suspendedIds.includes(s.id);

            if (suspended) {
                setSuspendedSellerInCache(s.id, true);
                return {
                    ...s,
                    is_suspended: true,
                    role: s.role === 'vendeur' ? 'vendeur_desactive' : s.role,
                    is_open: false,
                };
            }
            return s;
        });
    } catch (err) {
        console.error('[AdminService] Erreur fetchActiveSellers:', err);
        throw err;
    }
}

/**
 * Approuve la candidature d'un étudiant vendeur.
 * Passe son rôle de 'vendeur_pending' à 'vendeur'.
 * @param {string} sellerId - UUID du vendeur
 * @returns {Promise<Object>}
 */
export async function approveSeller(sellerId) {
    if (!sellerId) throw new Error('ID vendeur manquant.');

    const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'vendeur', is_open: true })
        .eq('id', sellerId)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec d'approbation du vendeur: ${error.message}`);
    }

    return data;
}

/**
 * Rejette ou annule la demande vendeur d'un étudiant (repassage en 'acheteur').
 * @param {string} sellerId
 * @returns {Promise<Object>}
 */
export async function rejectSeller(sellerId) {
    if (!sellerId) throw new Error('ID vendeur manquant.');

    const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'acheteur' })
        .eq('id', sellerId)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec de rejet de la demande: ${error.message}`);
    }

    return data;
}

/**
 * Suspend ou réactive un marchand (bascule entre 'vendeur' et 'vendeur_desactive').
 * @param {string} sellerId
 * @param {boolean} [suspend=true] - True pour suspendre, false pour réactiver
 * @returns {Promise<Object>}
 */
export async function suspendSeller(sellerId, suspend = true) {
    if (!sellerId) throw new Error('ID vendeur manquant.');

    const targetRole = suspend ? 'vendeur_desactive' : 'vendeur';
    const isOpen = !suspend;

    // Synchronisation immédiate du cache local (résilience hors-ligne / avant migration)
    setSuspendedSellerInCache(sellerId, suspend);

    // 1. Tentative avec is_suspended et rôle (schéma complet)
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({ 
                is_suspended: suspend, 
                role: targetRole, 
                is_open: isOpen 
            })
            .eq('id', sellerId)
            .select();

        if (!error && data?.length) {
            return data[0];
        }
    } catch {}

    // 2. Tentative avec rôle et is_open (si is_suspended n'est pas encore migré)
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({ 
                role: targetRole, 
                is_open: isOpen 
            })
            .eq('id', sellerId)
            .select();

        if (!error && data?.length) {
            return data[0];
        }
    } catch {}

    // 3. Repli avec is_open seul si la contrainte check bloque le rôle
    const { data, error } = await supabase
        .from('profiles')
        .update({ is_open: isOpen })
        .eq('id', sellerId)
        .select();

    if (error) {
        throw new Error(`Échec de mise à jour du statut: ${error.message}`);
    }

    return (data && data[0]) || { id: sellerId, role: targetRole, is_open: isOpen, is_suspended: suspend };
}

/**
 * Rétrograde un vendeur en simple acheteur (révocation définitive des droits marchand).
 * @param {string} sellerId
 * @returns {Promise<Object>}
 */
export async function revokeSeller(sellerId) {
    if (!sellerId) throw new Error('ID vendeur manquant.');

    setSuspendedSellerInCache(sellerId, false);

    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({ role: 'acheteur', is_open: false, is_suspended: false })
            .eq('id', sellerId)
            .select()
            .single();

        if (!error && data) return data;
    } catch {}

    const { data: fbData, error: fbErr } = await supabase
        .from('profiles')
        .update({ role: 'acheteur', is_open: false })
        .eq('id', sellerId)
        .select()
        .single();

    if (fbErr) {
        throw new Error(`Échec de rétrogradation: ${fbErr.message}`);
    }

    return fbData;
}

/**
 * Supprime définitivement un profil utilisateur/vendeur.
 * @param {string} sellerId
 * @returns {Promise<boolean>}
 */
export async function deleteSellerAccount(sellerId) {
    if (!sellerId) throw new Error('ID vendeur manquant.');

    setSuspendedSellerInCache(sellerId, false);

    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', sellerId);

    if (error) {
        throw new Error(`Échec de suppression du compte: ${error.message}`);
    }

    return true;
}

/**
 * Supprime un produit en tant que modérateur.
 * @param {string} productId
 * @returns {Promise<boolean>}
 */
export async function deleteProductAdmin(productId) {
    if (!productId) throw new Error('ID produit manquant.');

    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

    if (error) {
        throw new Error(`Échec de suppression du produit: ${error.message}`);
    }

    return true;
}

/**
 * Récupère l'intégralité des produits du catalogue pour modération SuperAdmin.
 * @returns {Promise<Array>}
 */
export async function fetchAllProductsAdmin() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*, seller:seller_id(id, prenom, nom, telephone)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('[AdminService] Erreur fetchAllProductsAdmin:', err);
        throw err;
    }
}

/**
 * Récupère l'historique complet des commandes pour supervision SuperAdmin.
 * @returns {Promise<Array>}
 */
export async function fetchAllOrdersAdmin() {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*, product:product_id(title, image_url), seller:seller_id(prenom, nom, telephone)')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('[AdminService] Erreur fetchAllOrdersAdmin:', err);
        throw err;
    }
}

export const DEFAULT_DELIVERY_LOCATIONS = [
    { id: 'def-1', name: 'Pavillon A1', category: 'pavillon', is_active: true },
    { id: 'def-2', name: 'Pavillon A2', category: 'pavillon', is_active: true },
    { id: 'def-3', name: 'Pavillon A3', category: 'pavillon', is_active: true },
    { id: 'def-4', name: 'Pavillon A4', category: 'pavillon', is_active: true },
    { id: 'def-5', name: 'Pavillon B1', category: 'pavillon', is_active: true },
    { id: 'def-6', name: 'Pavillon B2', category: 'pavillon', is_active: true },
    { id: 'def-7', name: 'Pavillon C', category: 'pavillon', is_active: true },
    { id: 'def-8', name: 'Jardin Social', category: 'site', is_active: true },
    { id: 'def-9', name: 'Bibliothèque Universitaire (BU)', category: 'bu', is_active: true },
    { id: 'def-10', name: 'Salles de cours / Espaces communs', category: 'site', is_active: true },
];

/**
 * Récupère les lieux et pavillons de livraison (avec fallback local si hors-ligne).
 * @param {boolean} [includeInactive=false] - Inclure les lieux inactifs (pour le SuperAdmin)
 * @returns {Promise<Array>}
 */
export async function fetchDeliveryLocations(includeInactive = false) {
    try {
        let query = supabase.from('delivery_locations').select('*').order('name', { ascending: true });
        if (!includeInactive) {
            query = query.eq('is_active', true);
        }
        const { data, error } = await query;
        if (error || !data || data.length === 0) {
            return includeInactive ? DEFAULT_DELIVERY_LOCATIONS : DEFAULT_DELIVERY_LOCATIONS.filter((l) => l.is_active);
        }
        return data;
    } catch {
        return includeInactive ? DEFAULT_DELIVERY_LOCATIONS : DEFAULT_DELIVERY_LOCATIONS.filter((l) => l.is_active);
    }
}

/**
 * Ajoute un nouveau lieu de livraison (SuperAdmin).
 * @param {Object} params
 * @param {string} params.name
 * @param {string} [params.category='pavillon']
 * @returns {Promise<Object>}
 */
export async function addDeliveryLocation({ name, category = 'pavillon' }) {
    if (!name || !name.trim()) throw new Error('Le nom du lieu est requis.');

    const { data, error } = await supabase
        .from('delivery_locations')
        .insert([{ name: name.trim(), category, is_active: true }])
        .select()
        .single();

    if (error) {
        throw new Error(`Échec d'ajout du lieu : ${error.message}`);
    }
    return data;
}

/**
 * Active ou désactive un lieu de livraison (SuperAdmin).
 * @param {string} id
 * @param {boolean} isActive
 * @returns {Promise<Object>}
 */
export async function toggleDeliveryLocation(id, isActive) {
    if (!id) throw new Error('ID lieu manquant.');
    const { data, error } = await supabase
        .from('delivery_locations')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec de modification du statut : ${error.message}`);
    }
    return data;
}

/**
 * Supprime un lieu de livraison (SuperAdmin).
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteDeliveryLocation(id) {
    if (!id) throw new Error('ID lieu manquant.');
    const { error } = await supabase
        .from('delivery_locations')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`Échec de suppression du lieu : ${error.message}`);
    }
    return true;
}

/**
 * Modifie le statut d'une commande par le SuperAdmin (arbitrage et litiges).
 * @param {string} orderId
 * @param {string} newStatus - 'pending'|'confirmed'|'processing'|'shipped'|'delivered'|'cancelled'
 * @returns {Promise<Object>}
 */
export async function updateOrderStatusAdmin(orderId, newStatus) {
    if (!orderId) throw new Error('ID commande requis.');
    const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!VALID_STATUSES.includes(newStatus)) {
        throw new Error(`Statut invalide : ${newStatus}`);
    }

    const { data, error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec de mise à jour du statut : ${error.message}`);
    }
    return data;
}

/**
 * Récupère l'intégralité des profils d'utilisateurs de la plateforme (SuperAdmin).
 * @returns {Promise<Array>}
 */
export async function fetchAllProfilesAdmin() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('[AdminService] Erreur fetchAllProfilesAdmin:', err);
        return [];
    }
}

/**
 * Met à jour le rôle d'un compte utilisateur (SuperAdmin).
 * @param {string} userId
 * @param {string} newRole - 'acheteur'|'vendeur_pending'|'vendeur'|'vendeur_desactive'|'suspendu'|'superadmin'
 * @returns {Promise<Object>}
 */
export async function updateUserRoleAdmin(userId, newRole) {
    if (!userId || !newRole) throw new Error('ID et rôle requis.');
    const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec de modification du rôle : ${error.message}`);
    }
    return data;
}

export default {
    verifyAdminRole,
    loginAdmin,
    fetchGlobalMetrics,
    fetchPendingSellers,
    fetchActiveSellers,
    fetchAllProductsAdmin,
    fetchAllOrdersAdmin,
    fetchAllProfilesAdmin,
    approveSeller,
    rejectSeller,
    suspendSeller,
    revokeSeller,
    deleteSellerAccount,
    deleteProductAdmin,
    fetchDeliveryLocations,
    addDeliveryLocation,
    toggleDeliveryLocation,
    deleteDeliveryLocation,
    updateOrderStatusAdmin,
    updateUserRoleAdmin,
    DEFAULT_DELIVERY_LOCATIONS,
};

