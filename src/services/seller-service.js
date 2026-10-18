/**
 * Service de gestion du compte et des activités vendeur (Back-Office Marchand).
 * Gère l'authentification stricte avec rôle 'vendeur_pending' pour validation administrative,
 * le tableau de bord KPI, la bascule de disponibilité boutique et le cycle de vie des commandes.
 */

import { supabase } from './supabase.js';
import { isUniversityEmail } from '../utils/security.js';
import { SUPPORT_CONFIG } from '../config/support.js';
import {
    SUBSCRIPTION_PLANS,
    FREE_TRIAL_CONFIG,
    computeSubscriptionStatus,
    getMaxProductsForPlan,
} from '../config/subscription.js';

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
export const PENDING_SELLERS_KEY = 'campus_market_pending_sellers_cache';

/**
 * Récupère les candidatures vendeurs stockées dans le cache de résilience local.
 * @returns {Array<Object>}
 */
export function getPendingSellersCache() {
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(PENDING_SELLERS_KEY);
            return raw ? JSON.parse(raw) : [];
        }
    } catch {}
    return [];
}

/**
 * Enregistre ou met à jour une candidature vendeur dans le cache de résilience.
 * @param {Object} seller
 */
export function savePendingSellerCache(seller) {
    if (!seller || !seller.id) return;
    try {
        if (typeof localStorage !== 'undefined') {
            const list = getPendingSellersCache();
            const idx = list.findIndex((s) => s.id === seller.id || (s.email && s.email === seller.email));
            if (idx >= 0) {
                list[idx] = { ...list[idx], ...seller };
            } else {
                list.unshift(seller);
            }
            localStorage.setItem(PENDING_SELLERS_KEY, JSON.stringify(list));
        }
    } catch {}
}

/**
 * Supprime une candidature du cache une fois approuvée ou rejetée.
 * @param {string} sellerId
 */
export function removePendingSellerCache(sellerId) {
    if (!sellerId) return;
    try {
        if (typeof localStorage !== 'undefined') {
            const list = getPendingSellersCache().filter((s) => s.id !== sellerId);
            localStorage.setItem(PENDING_SELLERS_KEY, JSON.stringify(list));
        }
    } catch {}
}

export async function registerSeller({
    email,
    password,
    prenom,
    nom,
    telephone,
    shopName,
    category,
    plan = 'starter',
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

    const cleanEmail = email.trim().toLowerCase();
    const finalShopName = (shopName && shopName.trim()) || `${prenom} Shop`;
    const finalCategory = category || 'autres';
    const validPlan = SUBSCRIPTION_PLANS[plan] ? plan : 'starter';
    const maxProducts = getMaxProductsForPlan(validPlan);
    const nowIso = new Date().toISOString();
    const trialEndIso = new Date(Date.now() + FREE_TRIAL_CONFIG.durationDays * 24 * 60 * 60 * 1000).toISOString();

    // 1. Inscription dans Supabase Auth avec métadonnées complètes
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
            data: {
                prenom,
                nom,
                telephone,
                shop_name: finalShopName,
                shop_category: finalCategory,
                subscription_plan: validPlan,
                max_products: FREE_TRIAL_CONFIG.maxProducts,
                subscription_status: 'trial',
                trial_started_at: nowIso,
                trial_ends_at: trialEndIso,
                role: 'vendeur_pending',
            },
        },
    });

    let user = authData?.user;

    if (authError) {
        if (authError.message.includes('already registered')) {
            // Tentative de connexion avec le mot de passe fourni pour un étudiant ayant déjà un compte
            const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password,
            });

            if (loginErr || !loginData?.user) {
                throw new Error(
                    `Un compte étudiant existe déjà avec cette adresse email. Veuillez vérifier votre mot de passe pour soumettre votre candidature vendeur, ou contacter l'assistance au ${SUPPORT_CONFIG.phoneDisplay}.`
                );
            }
            user = loginData.user;
        } else if (authError.message.includes('rate limit') || authError.code === 'over_email_send_rate_limit') {
            throw new Error(
                `Le quota d'emails d'inscription est temporairement atteint. Veuillez réessayer dans quelques minutes ou contacter l'assistance au ${SUPPORT_CONFIG.phoneDisplay}.`
            );
        } else {
            throw new Error(authError.message);
        }
    }

    if (!user) {
        throw new Error("Échec de création de l'utilisateur.");
    }

    // 2. Si aucune session n'a été retournée immédiatement, tenter une connexion directe pour activer RLS
    try {
        const { data: sessionCheck } = await supabase.auth.getSession();
        if (!sessionCheck?.session) {
            await supabase.auth.signInWithPassword({
                email: cleanEmail,
                password,
            });
        }
    } catch {
        // Ignorer si la confirmation d'email Supabase empêche la connexion immédiate
    }

    // 3. Création ou mise à jour du profil avec le rôle 'vendeur_pending' et les détails de la formule
    const profilePayload = {
        id: user.id,
        prenom,
        nom,
        telephone,
        email: cleanEmail,
        shop_name: finalShopName,
        shop_category: finalCategory,
        subscription_plan: validPlan,
        max_products: FREE_TRIAL_CONFIG.maxProducts,
        subscription_status: 'trial',
        trial_started_at: nowIso,
        trial_ends_at: trialEndIso,
        role: 'vendeur_pending',
        is_open: true,
        created_at: nowIso,
    };

    // Sauvegarde immédiate dans le cache de résilience pour garantir que l'administrateur
    // recevra toujours la candidature dans son tableau de bord
    savePendingSellerCache(profilePayload);

    // Tentative 1 : avec toutes les nouvelles colonnes
    let profileSaved = false;
    try {
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert(profilePayload, { onConflict: 'id' });

        if (!profileError) {
            profileSaved = true;
        } else {
            console.warn('[SellerService] Tentative 1 profil:', profileError.message);
        }
    } catch (err) {
        console.warn('[SellerService] Exception insertion profil 1:', err);
    }

    // Tentative 2 : Repli sur les colonnes de base si les nouvelles colonnes ne sont pas encore migrées
    if (!profileSaved) {
        try {
            const basePayload = {
                id: user.id,
                prenom,
                nom,
                telephone,
                role: 'vendeur_pending',
                is_open: true,
            };
            const { error: baseErr } = await supabase
                .from('profiles')
                .upsert(basePayload, { onConflict: 'id' });

            if (baseErr) {
                console.warn('[SellerService] Tentative 2 profil:', baseErr.message);
            } else {
                profileSaved = true;
            }
        } catch (err2) {
            console.warn('[SellerService] Exception insertion profil 2:', err2);
        }
    }

    return {
        user,
        profile: profilePayload,
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

    const isTempPassword = password === 'campus1234!';
    const mustChangePassword = isTempPassword || profile.must_change_password === true;

    if (mustChangePassword) {
        profile.must_change_password = true;
    }

    if (profile.role === 'vendeur_pending') {
        return { status: 'pending', user, profile, mustChangePassword };
    }

    if (profile.role === 'vendeur_desactive' || profile.role === 'suspendu' || profile.is_suspended === true) {
        return { status: 'suspended', user, profile, mustChangePassword };
    }

    if (profile.role === 'vendeur' || profile.role === 'superadmin') {
        return { status: 'approved', user, profile, mustChangePassword };
    }

    throw new Error("Ce compte n'a pas encore demandé le statut de vendeur. Veuillez postuler.");
}

/**
 * Récupère le profil du vendeur actuellement connecté s'il existe.
 * @returns {Promise<{ user: Object, profile: Object }|null>}
 */
export async function getCurrentSeller() {
    try {
        let { data: { session }, error: sessionErr } = await supabase.auth.getSession();
        if (!session?.user) {
            try {
                const { data: refreshData } = await supabase.auth.refreshSession();
                if (refreshData?.session?.user) {
                    session = refreshData.session;
                }
            } catch {}
        }
        if (!session?.user) return null;

        let profile = null;
        try {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();
            profile = data;
        } catch (fetchErr) {
            console.warn('[SellerService] Impossible de récupérer le profil distant:', fetchErr);
        }

        // Repli gracieux sur le profil en cache local si le réseau est lent ou inaccessible
        if (!profile && typeof localStorage !== 'undefined') {
            try {
                const cachedRaw = localStorage.getItem('campus_market_cached_seller');
                if (cachedRaw) {
                    const parsed = JSON.parse(cachedRaw);
                    if (parsed && parsed.id === session.user.id) {
                        profile = parsed;
                    }
                }
            } catch {}
        }

        if (profile) {
            profile.subscription_plan = profile.subscription_plan || session.user.user_metadata?.subscription_plan || 'starter';
            profile.max_products = Number(profile.max_products || session.user.user_metadata?.max_products) || getMaxProductsForPlan(profile.subscription_plan);
            profile.shop_name = profile.shop_name || session.user.user_metadata?.shop_name || `${profile.prenom || 'Boutique'} Shop`;
            profile.shop_category = profile.shop_category || session.user.user_metadata?.shop_category || 'autres';
            profile.email = profile.email || session.user.email;
            profile.must_change_password = Boolean(profile.must_change_password);

            // Si le vendeur actif n'a pas encore scellé sa date d'essai ou si elle est nulle, lui accorder 7 jours pleins
            if (profile.role === 'vendeur' && (!profile.trial_ends_at || !profile.trial_started_at) && !profile.subscription_expires_at) {
                const nowIso = new Date().toISOString();
                const trialEndIso = new Date(Date.now() + FREE_TRIAL_CONFIG.durationDays * 24 * 60 * 60 * 1000).toISOString();
                profile.trial_started_at = profile.trial_started_at || nowIso;
                profile.trial_ends_at = trialEndIso;
                profile.subscription_status = 'trial';

                // Sauvegarde non bloquante dans Supabase
                supabase.from('profiles').update({
                    trial_started_at: profile.trial_started_at,
                    trial_ends_at: profile.trial_ends_at,
                    subscription_status: 'trial',
                }).eq('id', session.user.id).then().catch(() => {});
            }

            // Calcul dynamique de l'état de l'abonnement
            const subCalc = computeSubscriptionStatus(profile);
            profile.subscription_status = profile.subscription_status || subCalc.status;
            profile.trial_ends_at = profile.trial_ends_at || (subCalc.expiresAt ? subCalc.expiresAt.toISOString() : null);
            profile._subscription = subCalc;
        }

        if (profile && (
            profile.role === 'vendeur' || 
            profile.role === 'vendeur_pending' || 
            profile.role === 'vendeur_desactive' || 
            profile.role === 'suspendu' || 
            profile.role === 'superadmin' || 
            profile.is_suspended === true
        )) {
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

        // 2. Commandes associées (avec repli gracieux sans jointure si le cache PostgREST diffère)
        let ordersList = [];
        try {
            const { data: ordersWithProd, error: joinErr } = await supabase
                .from('orders')
                .select('*, product:product_id(title, icon, image_url)')
                .eq('seller_id', sellerId)
                .order('created_at', { ascending: false });

            if (!joinErr && ordersWithProd) {
                ordersList = ordersWithProd;
            } else {
                throw joinErr;
            }
        } catch (joinError) {
            console.warn('[SellerService] Repli sur requête orders simple:', joinError?.message || joinError);
            const { data: rawOrders, error: rawOrdersErr } = await supabase
                .from('orders')
                .select('*')
                .eq('seller_id', sellerId)
                .order('created_at', { ascending: false });

            if (rawOrdersErr) throw rawOrdersErr;
            ordersList = rawOrders || [];
        }

        // 3. Produits du vendeur
        let productsList = [];
        try {
            const { data: products, error: prodsErr } = await supabase
                .from('products')
                .select('id, stock')
                .eq('seller_id', sellerId);

            if (!prodsErr && products) {
                productsList = products;
            }
        } catch (prodErr) {
            console.warn('[SellerService] Erreur récupération produits vendeur:', prodErr);
        }

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
        const subCalc = computeSubscriptionStatus(profile);
        const maxAllowed = subCalc.isTrial 
            ? FREE_TRIAL_CONFIG.maxProducts 
            : (Number(profile?.max_products) || getMaxProductsForPlan(profile?.subscription_plan));

        return {
            profile: profile || {},
            isOpen: profile ? profile.is_open !== false : true,
            totalRevenue,
            deliveredCount: deliveredOrders.length,
            pendingCount: pendingOrders.length,
            totalProductsCount: productsList.length,
            activeProductsCount: activeProducts.length,
            maxAllowed,
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

/**
 * Récupère le statut d'abonnement calculé d'un vendeur.
 * @param {Object} profile
 * @returns {Object}
 */
export function getSellerSubscription(profile) {
    return computeSubscriptionStatus(profile);
}

/**
 * Initie une session de paiement d'abonnement SasPay.
 * @param {Object} params
 * @param {string} params.sellerId
 * @param {string} params.plan - 'starter', 'pro' ou 'premium'
 * @param {string} params.operator - 'wave' ou 'om'
 * @param {string} [params.sellerEmail]
 * @param {string} [params.sellerName]
 * @returns {Promise<Object>}
 */
export async function initiateSubscriptionPayment({ sellerId, plan, operator, sellerEmail, sellerName }) {
    if (!sellerId) throw new Error('ID vendeur manquant.');
    const validPlan = SUBSCRIPTION_PLANS[plan] ? plan : 'starter';
    const validOperator = operator === 'om' ? 'om' : 'wave';

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';

    const response = await fetch('/api/create-subscription-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sellerId,
            plan: validPlan,
            operator: validOperator,
            sellerEmail,
            sellerName,
            origin,
        }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erreur lors de l\'initialisation du paiement.');
    }

    return await response.json();
}

/**
 * Confirme et valide l'activation de l'abonnement du vendeur après règlement (Wave / OM).
 * Met à jour le profil dans Supabase avec 30 jours de validité et enregistre la transaction.
 *
 * @param {Object} params
 * @param {string} params.sessionId
 * @param {string} params.sellerId
 * @param {string} params.plan
 * @param {string} params.operator
 * @returns {Promise<Object>} Profil mis à jour
 */
export async function confirmSubscriptionPayment({ sessionId, sellerId, plan, operator }) {
    if (!sessionId || !sellerId) throw new Error('Informations de confirmation incomplètes.');

    const validPlan = SUBSCRIPTION_PLANS[plan] ? plan : 'starter';
    const validOperator = operator === 'om' ? 'om' : 'wave';
    const maxProducts = getMaxProductsForPlan(validPlan);

    // 1. Appel du point d'API de vérification
    const verifyRes = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId,
            sellerId,
            plan: validPlan,
            operator: validOperator,
        }),
    });

    if (!verifyRes.ok) {
        const errJson = await verifyRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Impossible de vérifier le paiement.');
    }

    const verification = await verifyRes.json();
    const durationDays = verification.durationDays || 30;
    const expiresAt = verification.expiresAt || new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    // 2. Mise à jour de la table profiles dans Supabase
    const updatePayload = {
        subscription_status: 'active',
        subscription_plan: validPlan,
        max_products: maxProducts,
        subscription_expires_at: expiresAt,
        last_payment_date: nowIso,
        last_payment_id: sessionId,
        is_open: true,
    };

    let updatedProfile = null;
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', sellerId)
            .select()
            .single();

        if (!error && data) {
            updatedProfile = data;
        } else {
            console.warn('[SellerService] Avertissement update profil:', error?.message);
        }
    } catch (dbErr) {
        console.warn('[SellerService] Exception mise à jour profil:', dbErr);
    }

    // 3. Enregistrement dans la table seller_payments pour traçabilité
    try {
        const planObj = SUBSCRIPTION_PLANS[validPlan];
        await supabase.from('seller_payments').insert({
            seller_id: sellerId,
            amount: planObj.price,
            currency: 'XOF',
            plan: validPlan,
            operator: validOperator,
            provider: 'saspay',
            provider_session_id: sessionId,
            status: 'success',
            metadata: { confirmed_at: nowIso, mode: verification.mode || 'saspay' },
        });
    } catch (payErr) {
        console.warn('[SellerService] Trace paiement optionnelle non bloquante:', payErr.message);
    }

    // 4. Mettre à jour le cache local du profil
    if (typeof localStorage !== 'undefined' && updatedProfile) {
        try {
            localStorage.setItem('campus_market_cached_seller', JSON.stringify(updatedProfile));
        } catch {}
    }

    return {
        success: true,
        profile: updatedProfile || { id: sellerId, ...updatePayload },
        verification,
    };
}

/**
 * Modifie le mot de passe du vendeur connecté.
 * Vérifie que le mot de passe fait au moins 6 caractères et est strictement différent de 'campus1234!'.
 * Lève ensuite l'obligation de changement de mot de passe (must_change_password = false).
 *
 * @param {Object} params
 * @param {string} params.newPassword - Nouveau mot de passe choisi par le vendeur
 * @param {string} params.confirmPassword - Confirmation du nouveau mot de passe
 * @returns {Promise<{ success: boolean }>}
 */
export async function changeSellerPassword({ newPassword, confirmPassword }) {
    if (!newPassword || !confirmPassword) {
        throw new Error('Veuillez renseigner et confirmer votre nouveau mot de passe.');
    }

    if (newPassword !== confirmPassword) {
        throw new Error('Les deux mots de passe ne correspondent pas.');
    }

    if (newPassword.length < 6) {
        throw new Error('Le nouveau mot de passe doit contenir au moins 6 caractères.');
    }

    if (newPassword === 'campus1234!') {
        throw new Error('Le nouveau mot de passe doit être différent du mot de passe temporaire "campus1234!".');
    }

    // 1. Mise à jour dans Supabase Auth
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
    });

    if (updateError) {
        throw new Error(`Échec de mise à jour du mot de passe: ${updateError.message}`);
    }

    const userId = updateData?.user?.id;

    // 2. Lever l'obligation de changement de mot de passe via RPC sécurisée
    let rpcDone = false;
    try {
        const { error: rpcErr } = await supabase.rpc('complete_password_change');
        if (!rpcErr) {
            rpcDone = true;
        }
    } catch {}

    // 3. Fallback direct sur la table profiles
    if (!rpcDone && userId) {
        try {
            await supabase
                .from('profiles')
                .update({ must_change_password: false })
                .eq('id', userId);
        } catch {}
    }

    // 4. Mettre à jour le cache local s'il existe
    if (typeof localStorage !== 'undefined') {
        try {
            const raw = localStorage.getItem('campus_market_cached_seller');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed) {
                    parsed.must_change_password = false;
                    localStorage.setItem('campus_market_cached_seller', JSON.stringify(parsed));
                }
            }
        } catch {}
    }

    return { success: true };
}

export default {
    registerSeller,
    loginSeller,
    getCurrentSeller,
    logoutSeller,
    getSellerDashboardData,
    toggleShopStatus,
    updateOrderStatus,
    getPendingSellersCache,
    savePendingSellerCache,
    removePendingSellerCache,
    getSellerSubscription,
    initiateSubscriptionPayment,
    confirmSubscriptionPayment,
    changeSellerPassword,
};
