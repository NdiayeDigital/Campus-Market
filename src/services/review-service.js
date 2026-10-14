/**
 * Service de Gestion des Avis et Évaluations Clients
 * Gère la récupération, le calcul des moyennes/statistiques et le dépôt d'avis.
 */

import { supabase } from './supabase.js';

/**
 * Récupère l'ensemble des avis publics d'un vendeur.
 * @param {string} sellerId - UUID du vendeur
 * @returns {Promise<Array>}
 */
export async function fetchSellerReviews(sellerId) {
    if (!sellerId) return [];

    try {
        const { data, error } = await supabase
            .from('reviews')
            .select('id, rating, comment, created_at, order_id, buyer_id, buyer:buyer_id(prenom, nom)')
            .eq('seller_id', sellerId)
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('[ReviewService] Erreur récupération avis:', error);
            return [];
        }

        const rawList = data || [];
        return rawList.map((rev) => {
            let extractedName = null;
            let displayComment = rev.comment || '';
            const match = displayComment.match(/^\[(?:Avis de )?([^\]]+)\]\s*:?\s*(.*)$/s);
            if (match) {
                extractedName = match[1].trim();
                displayComment = match[2].trim();
            }
            return {
                ...rev,
                comment: displayComment,
                buyer_name: extractedName || (rev.buyer ? `${rev.buyer.prenom || ''} ${rev.buyer.nom || ''}`.trim() : null),
            };
        });
    } catch (err) {
        console.error('[ReviewService] Exception récupération avis:', err);
        return [];
    }
}

/**
 * Vérifie si une chaîne est un UUID v4 valide.
 * @param {*} val
 * @returns {boolean}
 */
function isValidUUID(val) {
    if (!val || typeof val !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
}

/**
 * Calcule les statistiques d'évaluation d'un vendeur.
 * @param {Array} reviews - Liste des avis
 * @returns {Object} { avgRating, totalReviews, distribution, recommendationRate }
 */
export function getSellerRatingStats(reviews = []) {
    const list = Array.isArray(reviews) ? reviews : [];
    const totalReviews = list.length;

    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    if (totalReviews === 0) {
        return {
            avgRating: 5.0,
            totalReviews: 0,
            distribution,
            recommendationRate: 100,
        };
    }

    let sum = 0;
    let positiveCount = 0;

    list.forEach((rev) => {
        const rating = Math.max(1, Math.min(5, Math.round(Number(rev.rating) || 5)));
        distribution[rating] = (distribution[rating] || 0) + 1;
        sum += rating;
        if (rating >= 4) positiveCount += 1;
    });

    const avg = sum / totalReviews;
    const recommendationRate = Math.round((positiveCount / totalReviews) * 100);

    return {
        avgRating: Number(avg.toFixed(1)),
        totalReviews,
        distribution,
        recommendationRate,
    };
}

/**
 * Enregistre une nouvelle évaluation / avis pour un vendeur.
 * @param {Object} params
 * @param {string} params.sellerId - UUID du vendeur
 * @param {string} [params.orderId] - UUID de commande (optionnel pour lier un achat vérifié)
 * @param {number} params.rating - Note de 1 à 5
 * @param {string} [params.comment] - Commentaire libre
 * @param {string} [params.buyerName] - Prénom/Nom de l'étudiant
 * @returns {Promise<Object>}
 */
export async function submitReview({ sellerId, orderId = null, rating, comment = '', buyerName = '' }) {
    if (!sellerId) {
        throw new Error('Identifiant marchand requis pour déposer un avis.');
    }

    const note = Math.max(1, Math.min(5, parseInt(rating, 10) || 5));
    const cleanComment = (comment || '').trim();
    const cleanBuyerName = (buyerName || '').trim();

    // Construction du commentaire final avec attribution du nom de l'étudiant si invité
    let finalComment = cleanComment;
    if (cleanBuyerName && !finalComment.includes(`[Avis de ${cleanBuyerName}]`)) {
        finalComment = finalComment ? `[Avis de ${cleanBuyerName}] : ${finalComment}` : `[Avis de ${cleanBuyerName}]`;
    }

    // Sécurisation stricte de l'orderId (PostgreSQL exige un format UUID valide)
    // Si orderId est une référence de commande (ex: 'CMD-20261011-1234'), on l'annule pour éviter l'erreur 22P02
    const cleanOrderId = isValidUUID(orderId) ? orderId.trim() : null;

    let buyerId = null;
    try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
            buyerId = authData.user.id;
        }
    } catch {
        buyerId = null;
    }

    const payload = {
        seller_id: sellerId,
        order_id: cleanOrderId,
        buyer_id: buyerId,
        rating: note,
        comment: finalComment,
    };

    try {
        const { data, error } = await supabase
            .from('reviews')
            .insert([payload])
            .select('id, rating, comment, created_at, order_id, buyer_id');

        if (error) {
            // Repli sans .select() si RLS bloque la lecture du retour
            console.warn('[ReviewService] Avertissement insertion avis avec select:', error.message);
            const { error: insertErr } = await supabase.from('reviews').insert([payload]);
            if (insertErr) {
                throw new Error(`Impossible d'enregistrer votre avis: ${insertErr.message}`);
            }
            return {
                id: 'rev_' + Date.now(),
                ...payload,
                created_at: new Date().toISOString(),
                buyer_name: cleanBuyerName || null,
            };
        }

        const inserted = (data && data[0]) || { ...payload, id: 'rev_' + Date.now() };
        return {
            ...inserted,
            buyer_name: cleanBuyerName || null,
        };
    } catch (err) {
        console.error('[ReviewService] Erreur insertion avis:', err);
        throw err;
    }
}

export default {
    fetchSellerReviews,
    getSellerRatingStats,
    submitReview,
};
