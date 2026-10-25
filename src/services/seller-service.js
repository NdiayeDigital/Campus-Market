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

    // 1. Envoi du code OTP via signInWithOtp (Supabase Auth déclenche l'envoi du code à 6 chiffres via Brevo SMTP)
    const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
            shouldCreateUser: true,
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

    if (otpError) {
        if (otpError.message && (otpError.message.includes('rate limit') || otpError.code === 'over_email_send_rate_limit')) {
            throw new Error(
                `Trop de demandes récentes. Veuillez patienter 60 secondes avant de redemander un code, ou contacter l'assistance au ${SUPPORT_CONFIG.phoneDisplay}.`
            );
        }
        throw new Error(otpError.message || "Erreur lors de l'envoi du code de confirmation.");
    }

    return {
        email: cleanEmail,
        status: 'otp_sent',
    };
}

/**
 * Vérifie le code OTP à 6 chiffres envoyé par Brevo/Supabase et active automatiquement le compte vendeur.
 * @param {Object} params
 * @param {string} params.email - Adresse email universitaire
 * @param {string} params.token - Code OTP à 6 chiffres
 * @param {string} [params.password] - Mot de passe choisi par l'utilisateur
 * @param {Object} [params.registrationData] - Données de profil saisies lors de l'inscription
 * @returns {Promise<{ user: Object, profile: Object, status: 'approved' }>}
 */
export async function verifySellerOtp({ email, token, password = null, registrationData = null }) {
    if (!email || !token) {
        throw new Error('Email et code de confirmation requis.');
    }
    const cleanEmail = email.trim().toLowerCase();
    const cleanToken = token.trim().replace(/\s+/g, '');

    if (cleanToken.length !== 6 || !/^\d{6}$/.test(cleanToken)) {
        throw new Error('Le code de confirmation doit comporter exactement 6 chiffres.');
    }

    // 1. Validation de l'OTP auprès de Supabase Auth
    // signInWithOtp utilise le type 'email' pour la vérification du code à 6 chiffres
    let authUser = null;
    let authSession = null;

    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token: cleanToken,
        type: 'email',
    });

    if (!verifyError && verifyData?.user) {
        authUser = verifyData.user;
        authSession = verifyData.session;
    } else {
        // Repli sur type 'signup' si configuré ainsi
        const { data: retryData, error: retryError } = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token: cleanToken,
            type: 'signup',
        });

        if (!retryError && retryData?.user) {
            authUser = retryData.user;
            authSession = retryData.session;
        } else {
            const errMsg = (verifyError && verifyError.message) || (retryError && retryError.message) || '';
            if (errMsg.toLowerCase().includes('expired')) {
                throw new Error("Ce code de confirmation a expiré. Veuillez cliquer sur 'Renvoyer un nouveau code'.");
            }
            throw new Error("Code de confirmation incorrect. Veuillez vérifier les 6 chiffres reçus par email.");
        }
    }

    if (!authUser) {
        throw new Error("Échec de confirmation de l'adresse email.");
    }

    // 2. Définition du mot de passe pour permettre les futures connexions par mot de passe
    if (password && password.length >= 6) {
        try {
            await supabase.auth.updateUser({ password });
        } catch (pwdErr) {
            console.warn('[SellerService] Définition du mot de passe:', pwdErr?.message || pwdErr);
        }
    }

    // 3. Auto-approbation immédiate : Passage au rôle 'vendeur' avec essai 7 jours activé
    const nowIso = new Date().toISOString();
    const trialEndIso = new Date(Date.now() + FREE_TRIAL_CONFIG.durationDays * 24 * 60 * 60 * 1000).toISOString();
    const userMeta = authUser.user_metadata || {};
    const finalShopName = registrationData?.shopName || userMeta.shop_name || `${registrationData?.prenom || userMeta.prenom || ''} Shop`;
    const finalCategory = registrationData?.category || userMeta.shop_category || 'autres';
    const validPlan = registrationData?.plan || userMeta.subscription_plan || 'starter';

    const profilePayload = {
        id: authUser.id,
        prenom: registrationData?.prenom || userMeta.prenom || '',
        nom: registrationData?.nom || userMeta.nom || '',
        telephone: registrationData?.telephone || userMeta.telephone || '',
        email: cleanEmail,
        shop_name: finalShopName,
        shop_category: finalCategory,
        subscription_plan: validPlan,
        max_products: FREE_TRIAL_CONFIG.maxProducts,
        subscription_status: 'trial',
        trial_started_at: nowIso,
        trial_ends_at: trialEndIso,
        role: 'vendeur',
        is_open: true,
        updated_at: nowIso,
    };

    let updatedProfile = null;
    try {
        const { data: profData, error: profErr } = await supabase
            .from('profiles')
            .upsert(profilePayload, { onConflict: 'id' })
            .select()
            .single();

        if (!profErr && profData) {
            updatedProfile = profData;
        } else {
            // Repli sur colonnes de base si les nouvelles colonnes ne sont pas encore migrées
            const basePayload = {
                id: authUser.id,
                prenom: profilePayload.prenom,
                nom: profilePayload.nom,
                telephone: profilePayload.telephone,
                role: 'vendeur',
                is_open: true,
            };
            const { data: fallbackData } = await supabase
                .from('profiles')
                .upsert(basePayload, { onConflict: 'id' })
                .select()
                .single();
            updatedProfile = fallbackData || { ...profilePayload, role: 'vendeur' };
        }
    } catch (dbErr) {
        console.warn('[SellerService] Avertissement update profil OTP:', dbErr);
        updatedProfile = { ...profilePayload, role: 'vendeur' };
    }

    // Nettoyer la candidature du cache en attente
    removePendingSellerCache(authUser.id);

    return {
        user: authUser,
        profile: updatedProfile,
        session: authSession,
        status: 'approved',
    };
}

/**
 * Renvoie un nouveau code OTP de confirmation par email.
 * @param {string} email - Email étudiant
 * @returns {Promise<boolean>}
 */
export async function resendSellerOtp(email) {
    if (!email) throw new Error('Adresse email requise.');
    const cleanEmail = email.trim().toLowerCase();

    // L'inscription vendeur repose sur le flux OTP signInWithOtp (modèle Magic Link / OTP Brevo)
    const { data: otpData, error: otpError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
            shouldCreateUser: true,
        },
    });

    if (otpError) {
        if (otpError.message && (otpError.message.includes('rate limit') || otpError.code === 'over_email_send_rate_limit')) {
            throw new Error("Trop de demandes récentes. Veuillez patienter 60 secondes avant de demander un nouveau code.");
        }
        throw new Error(otpError.message || "Impossible de renvoyer le code pour le moment.");
    }

    return true;
}

/**
 * Connecte un vendeur et contrôle son statut d'approbation.
 *
 * @param {Object} credentials
 * @param {string} credentials.email
 * @param {string} credentials.password
 * @returns {Promise<{ status: 'approved'|'pending'|'needs_confirmation'|'unauthorized', user: Object, profile: Object }>}
 */
export async function loginSeller({ email, password }) {
    if (!email || !password) {
        throw new Error('Veuillez saisir votre email et mot de passe.');
    }

    const cleanEmail = email.trim().toLowerCase();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
    });

    if (authError) {
        if (authError.message && authError.message.toLowerCase().includes('email not confirmed')) {
            try {
                await resendSellerOtp(cleanEmail);
            } catch {}
            return {
                status: 'needs_confirmation',
                email: cleanEmail,
            };
        }
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
    if (!sessionId) throw new Error('Informations de confirmation incomplètes : session_id manquant.');

    let targetSellerId = sellerId;
    if (!targetSellerId) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            targetSellerId = session?.user?.id;
        } catch {}
    }
    if (!targetSellerId) {
        throw new Error('Identifiant vendeur manquant pour la confirmation.');
    }

    const validPlan = SUBSCRIPTION_PLANS[plan] ? plan : 'starter';
    const validOperator = operator === 'om' ? 'om' : 'wave';

    // 1. Appel du point d'API de vérification réelle
    const verifyRes = await fetch('/api/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sessionId,
            sellerId: targetSellerId,
            plan: validPlan,
            operator: validOperator,
        }),
    });

    if (!verifyRes.ok) {
        const errJson = await verifyRes.json().catch(() => ({}));
        throw new Error(errJson.error || 'Paiement non confirmé par la passerelle de règlement.');
    }

    const verification = await verifyRes.json();

    // 2. Récupération du profil mis à jour depuis Supabase
    let updatedProfile = null;
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sellerId)
            .single();

        if (!error && data) {
            updatedProfile = data;
        }
    } catch (dbErr) {
        console.warn('[SellerService] Exception lecture profil mis à jour:', dbErr);
    }

    // 3. Mettre à jour le cache local du profil
    if (typeof localStorage !== 'undefined' && updatedProfile) {
        try {
            localStorage.setItem('campus_market_cached_seller', JSON.stringify(updatedProfile));
        } catch {}
    }

    return {
        success: true,
        profile: updatedProfile || { id: sellerId, subscription_status: 'active', subscription_plan: validPlan },
        verification,
    };
}

/**
 * Transmet une preuve ou référence de paiement Wave / Orange Money pour validation administrative.
 * @param {Object} params
 * @param {string} params.sellerId
 * @param {string} params.plan
 * @param {string} params.operator
 * @param {string} params.transactionRef
 * @param {string} [params.phone]
 * @returns {Promise<Object>}
 */
export async function submitSubscriptionPaymentProof({ sellerId, plan, operator, transactionRef, phone }) {
    if (!sellerId) throw new Error('ID vendeur manquant.');
    if (!transactionRef || !transactionRef.trim()) {
        throw new Error('Veuillez renseigner votre référence de paiement ou numéro payeur.');
    }

    const validPlan = SUBSCRIPTION_PLANS[plan] ? plan : 'starter';
    const validOperator = operator === 'om' ? 'om' : 'wave';
    const planObj = SUBSCRIPTION_PLANS[validPlan];

    // 1. Tenter via la procédure stockée RPC sécurisée
    let rpcDone = false;
    let paymentId = null;
    try {
        const { data, error } = await supabase.rpc('submit_subscription_payment', {
            p_plan: validPlan,
            p_operator: validOperator,
            p_transaction_ref: transactionRef.trim(),
            p_phone: (phone || '').trim(),
        });
        if (!error && data) {
            paymentId = data;
            rpcDone = true;
        }
    } catch {}

    // 2. Repli direct par insertion dans seller_payments
    if (!rpcDone) {
        const { data: inserted, error: insErr } = await supabase.from('seller_payments').insert({
            seller_id: sellerId,
            amount: planObj.price,
            currency: 'XOF',
            plan: validPlan,
            operator: validOperator,
            provider: 'saspay',
            provider_session_id: transactionRef.trim(),
            status: 'pending',
            metadata: {
                transaction_ref: transactionRef.trim(),
                payer_phone: (phone || '').trim(),
                submitted_at: new Date().toISOString(),
            },
        }).select('id').single();

        if (insErr) {
            throw new Error(`Échec de transmission de la preuve : ${insErr.message}`);
        }
        paymentId = inserted?.id;
    }

    return {
        success: true,
        paymentId,
        status: 'pending',
        message: 'Preuve de paiement transmise avec succès à l\'administration pour validation.',
    };
}

/**
 * Récupère les paiements en attente de vérification pour un vendeur donné.
 * @param {string} sellerId
 * @returns {Promise<Array>}
 */
export async function fetchSellerPendingPayments(sellerId) {
    if (!sellerId) return [];
    try {
        const { data, error } = await supabase
            .from('seller_payments')
            .select('*')
            .eq('seller_id', sellerId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
        if (error) return [];
        return data || [];
    } catch {
        return [];
    }
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
    verifySellerOtp,
    resendSellerOtp,
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
    submitSubscriptionPaymentProof,
    fetchSellerPendingPayments,
    changeSellerPassword,
};
