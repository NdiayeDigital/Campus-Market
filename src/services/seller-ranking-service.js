/**
 * Service de Gamification & Classement des Vendeurs : Campus Market UIDT
 * Calcul méritocratique des points et classement des marchands du campus.
 *
 * Règle stricte : Les gains ou pénalités de points sont strictement calibrés entre 5 et 10 points (jamais plus de 10).
 */

import { supabase } from './supabase.js';

export const POINTS_RULES = {
    DELIVERED_ORDER: 10,       // +10 pts par commande livrée avec succès (le maximum autorisé)
    REVIEW_5_STAR: 8,          // +8 pts pour un avis client 5 étoiles
    REVIEW_4_STAR: 6,          // +6 pts pour un avis client 4 étoiles
    REVIEW_3_STAR: 5,          // +5 pts pour un avis client 3 étoiles
    PROFILE_COMPLETE_BONUS: 5, // +5 pts pour un profil marchand 100% complété
    ACTIVE_SHOP_BONUS: 5,      // +5 pts pour une boutique ouverte avec au moins 1 article en vente
    CANCELLED_PENALTY: 5,      // -5 pts de pénalité pour commande annulée PAR LE VENDEUR (0 pt si annulée par l'acheteur)
};

export const SELLER_TIERS = [
    {
        id: 'diamant',
        name: 'Diamant',
        icon: '💎',
        min: 300,
        badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-300',
        color: '#06b6d4',
        title: 'Marchand Élite Campus',
    },
    {
        id: 'or',
        name: 'Or',
        icon: '🥇',
        min: 150,
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
        color: '#f59e0b',
        title: 'Marchand Expert',
    },
    {
        id: 'argent',
        name: 'Argent',
        icon: '🥈',
        min: 50,
        badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
        color: '#64748b',
        title: 'Marchand Confirmé',
    },
    {
        id: 'bronze',
        name: 'Bronze',
        icon: '🥉',
        min: 0,
        badgeClass: 'bg-orange-50 text-orange-900 border-orange-300',
        color: '#c2410c',
        title: 'Marchand Novice',
    },
];

/**
 * Détermine le palier et la progression vers le niveau supérieur selon les points cumulés.
 * @param {number} points
 * @returns {Object}
 */
export function getSellerTier(points = 0) {
    const validPoints = Math.max(0, Number(points) || 0);

    for (let i = 0; i < SELLER_TIERS.length; i++) {
        const tier = SELLER_TIERS[i];
        if (validPoints >= tier.min) {
            const nextTier = i > 0 ? SELLER_TIERS[i - 1] : null;
            let progressPercent = 100;
            let pointsToNextTier = 0;

            if (nextTier) {
                const range = nextTier.min - tier.min;
                const earned = validPoints - tier.min;
                progressPercent = Math.min(100, Math.round((earned / range) * 100));
                pointsToNextTier = Math.max(0, nextTier.min - validPoints);
            }

            return {
                id: tier.id,
                name: tier.name,
                icon: tier.icon,
                badgeClass: tier.badgeClass,
                color: tier.color,
                title: tier.title,
                minPoints: tier.min,
                nextTierName: nextTier?.name || null,
                nextTierMin: nextTier?.min || null,
                pointsToNextTier,
                progressPercent,
            };
        }
    }

    return getSellerTier(0);
}

/**
 * Calcule fidèlement les points d'un marchand selon son activité réelle.
 * @param {Object} params
 * @param {Object} params.seller - Profil vendeur
 * @param {Array} [params.orders=[]] - Liste des commandes associées
 * @param {Array} [params.reviews=[]] - Liste des avis clients
 * @param {number} [params.activeProductsCount=0] - Nombre d'articles actifs en stock
 * @returns {Object}
 */
export function computeSellerPoints({ seller = {}, orders = [], reviews = [], activeProductsCount = 0 } = {}) {
    const sId = seller?.id;
    const sellerOrders = (orders || []).filter((o) => (o.seller_id === sId || o.seller?.id === sId));
    const sellerReviews = (reviews || []).filter((r) => (r.seller_id === sId));

    // 1. Points Commandes Livrées (+10 pts par commande livrée)
    const deliveredCount = sellerOrders.filter((o) => o.status === 'delivered').length;
    const deliveredPoints = deliveredCount * POINTS_RULES.DELIVERED_ORDER;

    // 2. Pénalité Commandes Annulées (-5 pts par annulation VENDEUR uniquement)
    // Règle d'équité : Seules les commandes annulées/refusées PAR LE VENDEUR (cancelled_by === 'seller')
    // sont pénalisées. Les annulations faites par le client/acheteur (cancelled_by === 'buyer') n'entraînent aucune pénalité (0 pt).
    const cancelledOrders = sellerOrders.filter((o) => o.status === 'cancelled');
    const cancelledBySellerCount = cancelledOrders.filter((o) => o.cancelled_by === 'seller').length;
    const cancelledByBuyerCount = cancelledOrders.filter((o) => o.cancelled_by === 'buyer').length;
    const cancelledPenalty = cancelledBySellerCount * POINTS_RULES.CANCELLED_PENALTY;

    // 3. Points Avis Clients (8 pts pour 5★, 6 pts pour 4★, 5 pts pour 3★)
    let reviewsPoints = 0;
    sellerReviews.forEach((r) => {
        const rating = Number(r.rating) || 0;
        if (rating >= 5) reviewsPoints += POINTS_RULES.REVIEW_5_STAR;
        else if (rating >= 4) reviewsPoints += POINTS_RULES.REVIEW_4_STAR;
        else if (rating >= 3) reviewsPoints += POINTS_RULES.REVIEW_3_STAR;
    });

    // 4. Bonus Profil Vendeur Complet (+5 pts)
    const hasShopName = Boolean(seller?.shop_name);
    const hasPhone = Boolean(seller?.telephone || seller?.phone);
    const hasPavillon = Boolean(seller?.pavillon);
    const hasChambre = Boolean(seller?.chambre);
    const isProfileComplete = hasShopName && hasPhone && hasPavillon && hasChambre;
    const profileBonus = isProfileComplete ? POINTS_RULES.PROFILE_COMPLETE_BONUS : 0;

    // 5. Bonus Boutique Active (+5 pts si ouverte avec au moins 1 article disponible)
    const isOpen = seller?.is_open !== false;
    const isActiveShop = isOpen && (activeProductsCount > 0);
    const activeShopBonus = isActiveShop ? POINTS_RULES.ACTIVE_SHOP_BONUS : 0;

    // Total final clampé à 0 minimum
    const rawTotal = deliveredPoints + reviewsPoints + profileBonus + activeShopBonus - cancelledPenalty;
    const totalPoints = Math.max(0, rawTotal);

    const tier = getSellerTier(totalPoints);

    return {
        totalPoints,
        deliveredCount,
        cancelledCount: cancelledOrders.length,
        cancelledBySellerCount,
        cancelledByBuyerCount,
        reviewsCount: sellerReviews.length,
        breakdown: {
            deliveredPoints,
            reviewsPoints,
            profileBonus,
            activeShopBonus,
            cancelledPenalty,
            cancelledBySellerCount,
            cancelledByBuyerCount,
        },
        tier,
    };
}

/**
 * Construit le classement global officiel de tous les vendeurs du campus (Leaderboard).
 * @param {Array} sellers - Liste de tous les vendeurs
 * @param {Array} [allOrders=[]] - Liste de toutes les commandes
 * @param {Array} [allReviews=[]] - Liste de tous les avis
 * @param {Map|Record} [productCountsMap={}] - Nombre de produits actifs par vendeur
 * @returns {Array} Liste triée des vendeurs avec rang (rank: 1, 2, ...)
 */
export function buildSellersLeaderboard(sellers = [], allOrders = [], allReviews = [], productCountsMap = {}) {
    if (!Array.isArray(sellers) || sellers.length === 0) return [];

    const getProdCount = (sId) => {
        if (!sId) return 0;
        if (productCountsMap instanceof Map) return productCountsMap.get(sId) || 0;
        return Number(productCountsMap[sId]) || 0;
    };

    const computedList = sellers.map((s) => {
        const prodCount = getProdCount(s.id);
        const pointsData = computeSellerPoints({
            seller: s,
            orders: allOrders,
            reviews: allReviews,
            activeProductsCount: prodCount,
        });

        const sOrders = allOrders.filter((o) => (o.seller_id === s.id || o.seller?.id === s.id));
        const deliveredOrders = sOrders.filter((o) => o.status === 'delivered');
        const deliveredAmount = deliveredOrders.reduce((sum, o) => sum + (Number(o.price) || 0), 0);
        const cancelledAmount = sOrders.filter((o) => o.status === 'cancelled').reduce((sum, o) => sum + (Number(o.price) || 0), 0);
        const realRevenue = deliveredAmount + cancelledAmount;

        const sReviews = allReviews.filter((r) => r.seller_id === s.id);
        const avgRating = sReviews.length > 0
            ? Number((sReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / sReviews.length).toFixed(1))
            : 0;

        return {
            ...s,
            points: pointsData.totalPoints,
            tier: pointsData.tier,
            breakdown: pointsData.breakdown,
            deliveredCount: pointsData.deliveredCount,
            cancelledCount: pointsData.cancelledCount,
            cancelledBySellerCount: pointsData.cancelledBySellerCount,
            cancelledByBuyerCount: pointsData.cancelledByBuyerCount,
            reviewCount: sReviews.length,
            avgRating,
            realRevenue,
            activeProducts: prodCount,
            shopName: s.shop_name || (s.prenom ? `Boutique ${s.prenom}` : 'Boutique Marchand'),
        };
    });

    // Tri multi-critères :
    // 1. Total Points décroissant
    // 2. Commandes livrées décroissantes
    // 3. CA Réel décroissant
    // 4. Note moyenne décroissante
    computedList.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.deliveredCount !== a.deliveredCount) return b.deliveredCount - a.deliveredCount;
        if (b.realRevenue !== a.realRevenue) return b.realRevenue - a.realRevenue;
        return b.avgRating - a.avgRating;
    });

    // Attribution du rang (1, 2, 3...)
    return computedList.map((seller, index) => ({
        ...seller,
        rank: index + 1,
    }));
}

/**
 * Récupère le rang et les statistiques de classement d'un vendeur donné dans le leaderboard.
 * @param {string} sellerId
 * @param {Array} leaderboard
 * @returns {Object}
 */
export function getSellerRankInfo(sellerId, leaderboard = []) {
    if (!sellerId || !Array.isArray(leaderboard) || leaderboard.length === 0) {
        return {
            rank: null,
            totalSellers: 0,
            seller: null,
            tier: getSellerTier(0),
            points: 0,
        };
    }

    const found = leaderboard.find((s) => s.id === sellerId);
    if (!found) {
        return {
            rank: null,
            totalSellers: leaderboard.length,
            seller: null,
            tier: getSellerTier(0),
            points: 0,
        };
    }

    return {
        rank: found.rank,
        totalSellers: leaderboard.length,
        seller: found,
        tier: found.tier,
        points: found.points,
    };
}

/**
 * Récupère le classement officiel inter-vendeurs de manière fiable et sécurisée.
 * Résout le cloisonnement RLS sur les commandes en interrogeant la RPC Postgres SECURITY DEFINER.
 * @param {Object} [params]
 * @param {string} [params.currentSellerId]
 * @returns {Promise<Array>} Liste ordonnée de tous les marchands classés avec rank, points, tier, stats
 */
export async function fetchCampusLeaderboard({ currentSellerId = null } = {}) {
    try {
        // 1. Profils de tous les marchands actifs et superadmins marchands
        const { data: profiles, error: errProf } = await supabase
            .from('profiles')
            .select('id, role, shop_name, prenom, nom, pavillon, chambre, telephone, phone, is_open, avatar_url, logo_url')
            .in('role', ['vendeur', 'superadmin']);

        if (errProf) throw errProf;
        const allProfiles = profiles || [];

        // 2. Statistiques agrégées de commandes et d'articles (contourne l'isolation RLS des commandes)
        let statsRpc = [];
        try {
            const { data: rpcData, error: rpcErr } = await supabase.rpc('get_seller_ranking_stats');
            if (!rpcErr && Array.isArray(rpcData)) {
                statsRpc = rpcData;
            } else {
                // Repli vers get_seller_stats si la fonction ranking n'est pas encore déployée
                const { data: fallbackData } = await supabase.rpc('get_seller_stats');
                if (Array.isArray(fallbackData)) statsRpc = fallbackData;
            }
        } catch (e) {
            console.warn('[Leaderboard] Erreur RPC stats, tentative de repli:', e);
        }

        const statsMap = new Map();
        statsRpc.forEach((st) => {
            if (st && st.seller_id) {
                statsMap.set(st.seller_id, {
                    deliveredCount: Number(st.delivered_orders_count) || 0,
                    cancelledBySellerCount: Number(st.cancelled_by_seller_count) || 0,
                    activeProducts: Number(st.active_products_count) || 0,
                });
            }
        });

        // 3. Avis clients publics
        let reviewsList = [];
        try {
            const { data: revData } = await supabase.from('reviews').select('seller_id, rating');
            reviewsList = revData || [];
        } catch (_) {}

        // 4. Si la RPC n'a rien renvoyé (environnement de test / local), repli vers les commandes directes
        let directOrders = [];
        if (statsMap.size === 0) {
            try {
                const { data: ordData } = await supabase.from('orders').select('id, seller_id, status, cancelled_by, price');
                directOrders = ordData || [];
            } catch (_) {}
        }

        // 5. Synthèse des commandes et nombre de produits actifs par vendeur
        const syntheticOrders = [];
        const productCountsMap = new Map();

        allProfiles.forEach((p) => {
            const st = statsMap.get(p.id);
            if (st) {
                productCountsMap.set(p.id, st.activeProducts);
                for (let i = 0; i < st.deliveredCount; i++) {
                    syntheticOrders.push({ seller_id: p.id, status: 'delivered', price: 0 });
                }
                for (let i = 0; i < st.cancelledBySellerCount; i++) {
                    syntheticOrders.push({ seller_id: p.id, status: 'cancelled', cancelled_by: 'seller', price: 0 });
                }
            }
        });

        const ordersToUse = statsMap.size > 0 ? syntheticOrders : directOrders;

        // 6. Construction du classement avec buildSellersLeaderboard
        const leaderboard = buildSellersLeaderboard(allProfiles, ordersToUse, reviewsList, productCountsMap);
        return leaderboard;
    } catch (err) {
        console.error('[Leaderboard] Échec récupération leaderboard:', err);
        return [];
    }
}

export default {
    POINTS_RULES,
    SELLER_TIERS,
    getSellerTier,
    computeSellerPoints,
    buildSellersLeaderboard,
    getSellerRankInfo,
    fetchCampusLeaderboard,
};
