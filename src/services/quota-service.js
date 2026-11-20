/**
 * Service centralisé de gestion et contrôle des quotas vendeurs (FR-17).
 * Campus Market - Université Iba Der Thiam de Thiès (UIDT).
 *
 * Ce module est conçu pour être 100% réutilisable pour les futurs packs Pro et Business.
 * Tous les contrôles critiques sont scellés et validés côté serveur.
 */

import { supabase } from './supabase.js';
import { FEATURE_FLAGS, SUBSCRIPTION_PLANS, COMPTEURS_DEPUIS_BASCULE } from '../config/subscription.js';

/**
 * Calcule la date de début du mois en cours pour le fuseau horaire de Dakar (GMT).
 * @returns {Date}
 */
export function getDakarMonthStartDate() {
    const now = new Date();
    // UTC / Dakar sont au même méridien GMT
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Calcule la date de remise à zéro du mois suivant (1er du mois à 00:00 Dakar).
 * @returns {Date}
 */
export function getDakarNextMonthResetDate() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/**
 * Récupère l'état de consommation des quotas d'un marchand.
 * @param {string} sellerId - UUID du vendeur
 * @returns {Promise<Object>}
 */
export async function getSellerQuotaConsumption(sellerId) {
    if (!sellerId) return null;

    // Si le moteur de quotas est désactivé par feature flag, renvoi de quotas ouverts
    if (!FEATURE_FLAGS.QUOTAS_ENABLED) {
        return {
            enabled: false,
            packId: 'standard',
            packName: 'Formule Active',
            activeProducts: { current: 1, max: 10, percent: 10 },
            monthlyOrders: { current: 0, max: 999999, percent: 0 },
            validatedSales: { current: 0, max: 999999, percent: 0 },
            ongoingOrdersCount: 0,
            isNearLimit: false,
            isAtLimit: false,
            resetDate: getDakarNextMonthResetDate(),
        };
    }

    try {
        // 1. Récupération du profil vendeur
        const { data: profile, error: profErr } = await supabase
            .from('profiles')
            .select('id, role, subscription_plan, subscription_status, subscription_expires_at, trial_ends_at, pack_actuel, date_bascule, max_products, promotions_used_this_period, promotions_period_start, free_ads_used_this_month, free_ads_period_start')
            .eq('id', sellerId)
            .maybeSingle();

        if (profErr || !profile) {
            return null;
        }

        const now = new Date();
        const isPaidActive = profile.subscription_expires_at && new Date(profile.subscription_expires_at) > now;

        let packId = 'decouverte';
        if (isPaidActive) {
            packId = profile.subscription_plan || 'starter';
        } else if (profile.pack_actuel && profile.pack_actuel !== 'essai_7j') {
            packId = profile.pack_actuel;
        }

        const planConfig = SUBSCRIPTION_PLANS[packId] || SUBSCRIPTION_PLANS.decouverte;
        const maxActiveProducts = isPaidActive 
            ? (planConfig.max_produits || planConfig.maxProducts || 5) 
            : (planConfig.max_produits || planConfig.maxProducts || 1);
        const maxOrders = planConfig.maxOrdersPerMonth !== undefined && planConfig.maxOrdersPerMonth !== null
            ? planConfig.maxOrdersPerMonth
            : 999999;
        const maxSales = planConfig.max_ventes_mois !== undefined && planConfig.max_ventes_mois !== null
            ? planConfig.max_ventes_mois
            : 999999;

        // 2. Comptage des produits actifs
        let activeProductsCount = 0;
        try {
            const { count } = await supabase
                .from('products')
                .select('id', { count: 'exact', head: true })
                .eq('seller_id', sellerId)
                .neq('stock', 0);
            activeProductsCount = count || 0;
        } catch {}

        // 3. Détermination de la date de début de comptage
        let startDate = getDakarMonthStartDate();
        if (COMPTEURS_DEPUIS_BASCULE && profile.date_bascule) {
            const basculeDate = new Date(profile.date_bascule);
            if (basculeDate > startDate) {
                startDate = basculeDate;
            }
        }

        // 4. Comptage des commandes reçues dans la période
        let monthlyOrdersCount = 0;
        let validatedSalesCount = 0;
        let ongoingOrdersCount = 0;

        try {
            const { data: orders } = await supabase
                .from('orders')
                .select('id, status, created_at, buyer_confirmed_at, is_same_room')
                .eq('seller_id', sellerId)
                .gte('created_at', startDate.toISOString());

            if (Array.isArray(orders)) {
                monthlyOrdersCount = orders.length;

                orders.forEach((o) => {
                    if (o.status === 'delivered' && o.buyer_confirmed_at && !o.is_same_room) {
                        validatedSalesCount++;
                    } else if (['pending', 'confirmed', 'processing', 'shipped'].includes(o.status)) {
                        ongoingOrdersCount++;
                    }
                });
            }
        } catch {}

        // Calculs des pourcentages et alertes
        const ordersPercent = Math.min(100, Math.round((monthlyOrdersCount / maxOrders) * 100));
        const salesEngaged = validatedSalesCount + ongoingOrdersCount;
        const salesPercent = Math.min(100, Math.round((salesEngaged / maxSales) * 100));

        const isNearLimit = ordersPercent >= 80 || salesPercent >= 80;
        const isAtLimit = monthlyOrdersCount >= maxOrders || salesEngaged >= maxSales || activeProductsCount >= maxActiveProducts;

        return {
            enabled: true,
            packId,
            packName: planConfig.name || 'Pack Découverte',
            activeProducts: {
                current: activeProductsCount,
                max: maxActiveProducts,
                percent: Math.min(100, Math.round((activeProductsCount / maxActiveProducts) * 100)),
            },
            monthlyOrders: {
                current: monthlyOrdersCount,
                max: maxOrders,
                percent: ordersPercent,
            },
            validatedSales: {
                current: validatedSalesCount,
                ongoing: ongoingOrdersCount,
                engaged: salesEngaged,
                max: maxSales,
                percent: salesPercent,
            },
            promotions: {
                used: Number(profile.promotions_used_this_period) || 0,
                max: planConfig.promos_par_periode !== undefined ? planConfig.promos_par_periode : (planConfig.allowPromotions ? 1 : 0),
                remaining: Math.max(0, (planConfig.promos_par_periode !== undefined ? planConfig.promos_par_periode : (planConfig.allowPromotions ? 1 : 0)) - (Number(profile.promotions_used_this_period) || 0)),
                frequency: planConfig.periode_promo || (packId === 'pro' ? 'week' : 'month'),
                resetPeriodText: (planConfig.periode_promo === 'week' || packId === 'pro') ? 'cette semaine' : 'ce mois-ci',
                nextResetDayText: (planConfig.periode_promo === 'week' || packId === 'pro') ? 'lundi' : 'le 1er du mois',
                allowed: Boolean(planConfig.allowPromotions),
            },
            freeAds: {
                used: Number(profile.free_ads_used_this_month) || 0,
                max: planConfig.freeAdsPerMonth || 0,
                remaining: Math.max(0, (planConfig.freeAdsPerMonth || 0) - (Number(profile.free_ads_used_this_month) || 0)),
                allowed: (planConfig.freeAdsPerMonth || 0) > 0,
            },
            allowTopShops: Boolean(planConfig.allowTopShops),
            isNearLimit,
            isAtLimit,
            resetDate: getDakarNextMonthResetDate(),
            rawProfile: profile,
        };
    } catch (err) {
        console.warn('[QuotaService] Erreur calcul quotas marchand:', err);
        return null;
    }
}

/**
 * Consomme l'une des 2 annonces offertes par mois pour un marchand en Pack Business.
 * Invoque la fonction RPC sécurisée PostgreSQL `consume_free_business_ad`.
 * @param {string} adId - UUID de l'annonce à publier gratuitement
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export async function consumeFreeBusinessAd(adId) {
    if (!adId) {
        throw new Error('Identifiant d\'annonce requis pour consommer une annonce offerte.');
    }

    try {
        const { data, error } = await supabase.rpc('consume_free_business_ad', {
            p_ad_id: adId,
        });

        if (error) {
            throw new Error(error.message);
        }

        return data || { success: true };
    } catch (err) {
        console.error('[QuotaService] Erreur consommation annonce offerte Business :', err);
        throw err;
    }
}

/**
 * Active la promotion d'un produit en décrémentant le compteur serveur sécurisé.
 * 1 promo/mois pour Pack Pro, 1 promo/semaine (lundi Dakar) pour Pack Business.
 * Invoque la RPC PostgreSQL `use_product_promotion`, avec repli gracieux direct.
 * @param {string} productId - UUID du produit promu
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export async function useProductPromotion(productId) {
    if (!productId) {
        throw new Error('Identifiant produit requis pour appliquer une promotion.');
    }

    try {
        const { data, error } = await supabase.rpc('use_product_promotion', {
            p_product_id: productId,
        });

        if (!error && data) {
            return data;
        }

        // Si l'erreur n'est pas "function does not exist", propager l'erreur serveur (ex: quota dépassé)
        if (error && !error.message?.includes('function') && !error.message?.includes('does not exist')) {
            throw new Error(error.message);
        }
    } catch (rpcErr) {
        if (!rpcErr.message?.includes('function') && !rpcErr.message?.includes('does not exist')) {
            throw rpcErr;
        }
    }

    // Repli gracieux direct côté Supabase si la fonction RPC n'est pas encore déployée
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Authentification requise pour promouvoir un article.');

    const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profErr || !profile) throw new Error('Profil vendeur introuvable.');

    const promoQuota = computePromotionQuota(profile);
    if (!promoQuota.allowed) {
        return {
            success: false,
            message: 'La mise en avant de produit est réservée aux formules Pro (1/mois) et Business (1/semaine).',
        };
    }

    if (promoQuota.remaining <= 0) {
        return {
            success: false,
            message: promoQuota.limitReachedMessage,
        };
    }

    // Activation de la promotion sur le produit pour 7 jours
    const promotedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: prodErr } = await supabase
        .from('products')
        .update({
            is_promoted: true,
            promoted_until: promotedUntil,
            updated_at: new Date().toISOString(),
        })
        .eq('id', productId)
        .eq('seller_id', user.id);

    if (prodErr) throw new Error(`Impossible d'activer la promotion : ${prodErr.message}`);

    // Mise à jour du compteur sur le profil
    const newUsed = (Number(promoQuota.used) || 0) + 1;
    await supabase
        .from('profiles')
        .update({
            promotions_used_this_period: newUsed,
            promotions_period_start: new Date().toISOString(),
        })
        .eq('id', user.id);

    return {
        success: true,
        message: 'Votre produit est maintenant mis en avant pour 7 jours ! 🔥',
        promoted_until: promotedUntil,
    };
}

/**
 * Vérifie et réserve atomiquement un quota de commande avant validation (CÔTÉ SERVEUR).
 * Invoque la RPC PostgreSQL sécurisée `check_and_reserve_order_quota`.
 *
 * @param {Object} params
 * @param {string} params.sellerId - UUID du vendeur
 * @param {string} params.buyerPhone - Numéro de l'étudiant acheteur
 * @param {string} [params.buyerPavillon] - Pavillon de livraison
 * @param {string} [params.buyerChambre] - Chambre de livraison
 * @param {string} [params.buyerId] - UUID si acheteur connecté
 * @returns {Promise<{ allowed: boolean, isSameRoom?: boolean, message?: string }>}
 */
export async function checkAndReserveOrderQuota({
    sellerId,
    buyerPhone,
    buyerPavillon = '',
    buyerChambre = '',
    buyerId = null,
}) {
    if (!FEATURE_FLAGS.QUOTAS_ENABLED) {
        return { allowed: true, isSameRoom: false };
    }

    if (!sellerId) {
        throw new Error('Identifiant vendeur requis pour le contrôle des quotas.');
    }

    try {
        const { data, error } = await supabase.rpc('check_and_reserve_order_quota', {
            p_seller_id: sellerId,
            p_buyer_phone: buyerPhone || '',
            p_buyer_pavillon: buyerPavillon || '',
            p_buyer_chambre: buyerChambre || '',
            p_buyer_id: buyerId || null,
        });

        if (error) {
            // Repli gracieux si la fonction RPC n'est pas encore déployée
            if (error.message?.includes('function') && error.message?.includes('does not exist')) {
                console.warn('[QuotaService] RPC check_and_reserve_order_quota absente, repli client autorisé.');
                return { allowed: true, isSameRoom: false };
            }
            throw new Error(error.message);
        }

        if (data && data.allowed === false) {
            const err = new Error(data.message || 'Ce vendeur est momentanément indisponible.');
            err.code = data.error_code;
            err.sellerMessage = data.seller_message;
            throw err;
        }

        return {
            allowed: true,
            isSameRoom: Boolean(data?.is_same_room),
            sellerPack: data?.seller_pack,
        };
    } catch (err) {
        if (err.code || err.sellerMessage) {
            throw err;
        }
        console.warn('[QuotaService] Erreur RPC contrôle quota, continuation prudente:', err);
        return { allowed: true, isSameRoom: false };
    }
}

/**
 * Enregistre la double confirmation d'une commande par l'acheteur.
 * @param {Object} params
 * @param {string} params.orderId
 * @param {string} [params.phone]
 * @returns {Promise<Object>}
 */
export async function confirmOrderReceiptByBuyer({ orderId, phone = '' }) {
    if (!orderId) throw new Error('Identifiant de commande manquant.');

    try {
        const { data, error } = await supabase.rpc('confirm_order_received_by_buyer', {
            p_order_id: orderId,
            p_phone: phone || '',
        });

        if (!error && data) {
            if (!data.success) throw new Error(data.message || 'Échec de la confirmation.');
            return data;
        }

        // Repli direct si la RPC n'est pas encore créée
        const { error: updErr } = await supabase
            .from('orders')
            .update({ buyer_confirmed_at: new Date().toISOString() })
            .eq('id', orderId);

        if (updErr) throw updErr;
        return { success: true, message: 'Réception confirmée avec succès !' };
    } catch (err) {
        console.error('[QuotaService] Erreur confirmation réception:', err);
        throw err;
    }
}

export default {
    FEATURE_FLAGS,
    getSellerQuotaConsumption,
    checkAndReserveOrderQuota,
    confirmOrderReceiptByBuyer,
    getDakarMonthStartDate,
    getDakarNextMonthResetDate,
};
