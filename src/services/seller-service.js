/**
 * Service de gestion du compte et des activités vendeur (Back-Office Marchand).
 * Gère l'authentification stricte avec rôle 'vendeur_pending' pour validation administrative,
 * le tableau de bord KPI, la bascule de disponibilité boutique et le cycle de vie des commandes.
 */

import { supabase } from './supabase.js';
import { isUniversityEmail } from '../utils/security.js';

/**
 * Enregistre un nouvel étudiant candidat au statut de vendeur.
 * RÈGLE STRICTE : Le rôle attribué est obligatoirement 'vendeur_pending'
 * dans l'attente d'une validation par le Super Admin.
 *
 * @param {Object} data
 * @param {string} data.email - Email institutionnel (@univ-thies.sn)
 * @param {string} data.password - Mot de passe sécurisé (min 6 caractères)
 * @param {string} data.prenom - Prénom de l'étudiant
 * @param {string} data.nom - Nom de l'étudiant
 * @param {string} data.telephone - Numéro de téléphone portable
 * @param {string} [data.shopName] - Nom commercial de la boutique
 * @param {string} [data.category] - Catégorie principale d'articles
 * @returns {Promise<{ user: Object, status: 'pending'|'approved' }>}
 */
export async function registerSeller({
    email,
    password,
    prenom,
    nom,
    telephone,
    shopName,
    category,
}) {
    if (!email || !password || !prenom || !nom || !telephone) {
        throw new Error('Veuillez renseigner tous les champs obligatoires.');
    }

    if (!isUniversityEmail(email)) {
        throw new Error("L'adresse email doit obligatoirement se terminer par @univ-thies.sn");
    }

    if (password.length < 6) {
        throw new Error('Le mot de passe doit contenir au moins 6 caractères.');
    }

    // 1. Inscription dans Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
            data: {
                prenom,
                nom,
                telephone,
                shop_name: shopName || `${prenom} Shop`,
                shop_category: category || 'autres',
                role: 'vendeur_pending',
            },
        },
    });

    if (authError) {
        if (authError.message.includes('already registered')) {
            throw new Error('Un compte existe déjà avec cette adresse email.');
        }
        throw new Error(authError.message);
    }

    const user = authData.user;
    if (!user) {
        throw new Error("Échec de création de l'utilisateur.");
    }

    // 2. Création ou mise à jour du profil avec le rôle 'vendeur_pending'
    const profilePayload = {
        id: user.id,
        prenom,
        nom,
        telephone,
        role: 'vendeur_pending',
        is_open: true,
    };

    const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profilePayload, { onConflict: 'id' });

    if (profileError) {
        console.warn('[SellerService] Avertissement création profil:', profileError);
    }

    return {
        user,
        status: 'pending',
    };
}

/**
 * Connecte un vendeur et contrôle son statut d'approbation.
 *
 * @param {Object} credentials
 * @param {string} credentials.email
 * @param {string} credentials.password
 * @returns {Promise<{ status: 'approved'|'pending'|'unauthorized', user: Object, profile: Object }>}
 */
export async function loginSeller({ email, password }) {
    if (!email || !password) {
        throw new Error('Veuillez saisir votre email et mot de passe.');
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
    });

    if (authError) {
        throw new Error('Identifiants incorrects ou compte inexistant.');
    }

    const user = authData.user;
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError || !profile) {
        throw new Error('Profil vendeur introuvable.');
    }

    if (profile.role === 'vendeur_pending') {
        return { status: 'pending', user, profile };
    }

    if (profile.role === 'vendeur' || profile.role === 'superadmin') {
        return { status: 'approved', user, profile };
    }

    throw new Error("Ce compte n'a pas encore demandé le statut de vendeur. Veuillez postuler.");
}

/**
 * Récupère le profil du vendeur actuellement connecté s'il existe.
 * @returns {Promise<{ user: Object, profile: Object }|null>}
 */
export async function getCurrentSeller() {
    try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 2000)
        );
        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);
        if (!session?.user) return null;

        const profilePromise = supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();
        const profileTimeout = new Promise((resolve) =>
            setTimeout(() => resolve({ data: null, error: null }), 2000)
        );
        const { data: profile } = await Promise.race([profilePromise, profileTimeout]);

        if (profile && (profile.role === 'vendeur' || profile.role === 'vendeur_pending')) {
            return { user: session.user, profile };
        }
        return null;
    } catch (err) {
        console.warn('[SellerService] Erreur getCurrentSeller:', err);
        return null;
    }
}

/**
 * Déconnecte le vendeur.
 */
export async function logoutSeller() {
    await supabase.auth.signOut();
}

/**
 * Récupère les métriques KPI et données pour le tableau de bord du vendeur.
 * @param {string} sellerId
 * @returns {Promise<Object>}
 */
export async function getSellerDashboardData(sellerId) {
    if (!sellerId) throw new Error('ID vendeur requis.');

    try {
        // 1. Profil vendeur (statut boutique)
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sellerId)
            .single();

        // 2. Commandes associées
        const { data: orders, error: ordersErr } = await supabase
            .from('orders')
            .select('*, product:product_id(title, icon, color, image_url)')
            .eq('seller_id', sellerId)
            .order('created_at', { ascending: false });

        if (ordersErr) throw ordersErr;

        // 3. Produits du vendeur
        const { data: products, error: prodsErr } = await supabase
            .from('products')
            .select('id, stock')
            .eq('seller_id', sellerId);

        if (prodsErr) throw prodsErr;

        const ordersList = orders || [];
        const productsList = products || [];

        // Calculs des KPIs réels (AUCUNE valeur factice)
        const deliveredOrders = ordersList.filter((o) => o.status === 'delivered');
        const totalRevenue = deliveredOrders.reduce(
            (acc, curr) => acc + (Number(curr.price) || 0),
            0
        );

        const pendingOrders = ordersList.filter(
            (o) => o.status === 'pending' || o.status === 'processing' || o.status === 'confirmed'
        );

        const activeProducts = productsList.filter((p) => p.stock !== 0);

        return {
            profile: profile || {},
            isOpen: profile ? profile.is_open !== false : true,
            totalRevenue,
            deliveredCount: deliveredOrders.length,
            pendingCount: pendingOrders.length,
            totalProductsCount: productsList.length,
            activeProductsCount: activeProducts.length,
            recentOrders: ordersList.slice(0, 20),
        };
    } catch (err) {
        console.error('[SellerService] Erreur chargement dashboard:', err);
        throw err;
    }
}

/**
 * Bascule la boutique en statut ouvert ou fermé.
 * @param {string} sellerId
 * @param {boolean} isOpen
 * @returns {Promise<boolean>}
 */
export async function toggleShopStatus(sellerId, isOpen) {
    const { error } = await supabase
        .from('profiles')
        .update({ is_open: Boolean(isOpen) })
        .eq('id', sellerId);

    if (error) {
        throw new Error(`Impossible de modifier le statut de la boutique: ${error.message}`);
    }
    return Boolean(isOpen);
}

/**
 * Met à jour le statut d'une commande (ex: de 'pending' à 'confirmed' ou 'shipped').
 * @param {string} orderId
 * @param {('pending'|'confirmed'|'processing'|'shipped'|'delivered'|'cancelled')} nextStatus
 * @returns {Promise<Object>}
 */
export async function updateOrderStatus(orderId, nextStatus) {
    const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(nextStatus)) {
        throw new Error(`Statut de commande invalide: ${nextStatus}`);
    }

    const { data, error } = await supabase
        .from('orders')
        .update({ status: nextStatus })
        .eq('id', orderId)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec de mise à jour du statut: ${error.message}`);
    }

    return data;
}

export default {
    registerSeller,
    loginSeller,
    getCurrentSeller,
    logoutSeller,
    getSellerDashboardData,
    toggleShopStatus,
    updateOrderStatus,
};
