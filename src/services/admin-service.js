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
        const activeSellersCount = allProfiles.filter((p) => p.role === 'vendeur').length;
        const pendingSellersCount = allProfiles.filter((p) => p.role === 'vendeur_pending').length;

        // 2. Commandes globales et CA réel
        const { data: orders, error: errOrders } = await supabase
            .from('orders')
            .select('id, price, status');

        if (errOrders) throw errOrders;

        const allOrders = orders || [];
        const totalOrdersCount = allOrders.length;
        const deliveredOrders = allOrders.filter((o) => o.status === 'delivered');

        // Somme des chiffres d'affaires réels sur les commandes livrées
        const totalDeliveredRevenue = deliveredOrders.reduce(
            (sum, o) => sum + (Number(o.price) || 0),
            0
        );

        return {
            activeSellersCount,
            pendingSellersCount,
            totalOrdersCount,
            totalDeliveredRevenue,
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

/**
 * Récupère la liste des vendeurs actifs certifiés.
 * @returns {Promise<Array>}
 */
export async function fetchActiveSellers() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .in('role', ['vendeur', 'vendeur_desactive'])
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
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

    const { data, error } = await supabase
        .from('profiles')
        .update({ role: targetRole, is_open: isOpen })
        .eq('id', sellerId)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec de mise à jour du statut: ${error.message}`);
    }

    return data;
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

export default {
    verifyAdminRole,
    loginAdmin,
    fetchGlobalMetrics,
    fetchPendingSellers,
    fetchActiveSellers,
    approveSeller,
    rejectSeller,
    suspendSeller,
    deleteProductAdmin,
};
