/**
 * Service de gestion du catalogue et recherche Campus Market.
 * Interagit avec Supabase et exploite la recherche floue (Levenshtein).
 */

import { supabase } from './supabase.js';
import { levenshteinDistance } from '../utils/levenshtein.js';

// Cache mémoire des produits pour recherche locale instantanée et tolérance offline
let memoryProductsCache = [];

/**
 * Catégories officielles de Campus Market
 */
export const CATEGORIES = [
    { id: 'all', label: 'Toutes les offres', icon: 'fa-table-cells-large' },
    { id: 'plats-boissons', label: 'Plats & Boissons', icon: 'fa-utensils' },
    { id: 'vetements', label: 'Vêtements', icon: 'fa-shirt' },
    { id: 'bijoux-accessoires', label: 'Bijoux & Accessoires', icon: 'fa-gem' },
    { id: 'fournitures', label: 'Fournitures & Tech', icon: 'fa-book' },
    { id: 'services', label: 'Services Campus', icon: 'fa-handshake' },
    { id: 'autres', label: 'Autres', icon: 'fa-box' },
];

/**
 * Récupère les produits actifs depuis Supabase avec pagination et jointure vendeur.
 * @param {Object} [options]
 * @param {string} [options.category='all'] - Catégorie à filtrer
 * @param {number} [options.limit=50] - Nombre maximal de produits
 * @param {number} [options.offset=0] - Offset pour pagination
 * @returns {Promise<Array>}
 */
export async function fetchActiveProducts({ category = 'all', limit = 50, offset = 0 } = {}) {
    try {
        let query = supabase
            .from('products')
            .select('*, seller:seller_id(id, prenom, nom, telephone, is_open)')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (category && category !== 'all') {
            query = query.eq('category', category);
        }

        const { data, error } = await query;
        if (error) throw error;

        const products = data || [];
        // Mise à jour du cache mémoire si requête générale
        if (category === 'all' && offset === 0) {
            memoryProductsCache = products;
        }

        return products;
    } catch (err) {
        console.warn('[CatalogService] Échec requête Supabase, fallback cache mémoire:', err);
        if (memoryProductsCache.length > 0) {
            return category === 'all'
                ? memoryProductsCache
                : memoryProductsCache.filter((p) => p.category === category);
        }
        return [];
    }
}

/**
 * Recherche floue et filtrage des produits avec tolérance aux fautes (Levenshtein).
 * @param {string} query - Terme recherché par l'étudiant
 * @param {string} [category='all'] - Catégorie active
 * @returns {Promise<Array>}
 */
export async function searchProducts(query = '', category = 'all') {
    // Si le cache est vide, on le rafraîchit
    if (memoryProductsCache.length === 0) {
        await fetchActiveProducts({ category: 'all' });
    }

    const cleanQuery = query.toLowerCase().trim();

    return memoryProductsCache.filter((product) => {
        // 1. Filtre catégorie
        const matchesCategory = category === 'all' || product.category === category;
        if (!matchesCategory) return false;

        // Si aucune recherche texte, on retient tous les produits de la catégorie
        if (!cleanQuery) return true;

        const title = (product.title || '').toLowerCase();
        const sellerName = product.seller
            ? `${product.seller.prenom} ${product.seller.nom}`.toLowerCase()
            : '';

        // Correspondance directe
        if (title.includes(cleanQuery) || sellerName.includes(cleanQuery)) {
            return true;
        }

        // Correspondance floue mot par mot (tolérance Levenshtein <= 2)
        const titleWords = title.split(/\s+/);
        const queryWords = cleanQuery.split(/\s+/);

        const hasFuzzyWordMatch = queryWords.every((qWord) => {
            if (qWord.length < 3) {
                return title.includes(qWord);
            }
            return titleWords.some((tWord) => levenshteinDistance(tWord, qWord) <= 2);
        });

        return hasFuzzyWordMatch;
    });
}

/**
 * Récupère les meilleurs vendeurs ("Top Shops") certifiés avec leur note moyenne.
 * @returns {Promise<Array>}
 */
export async function fetchTopShops() {
    try {
        const { data: sellers, error: errSellers } = await supabase
            .from('profiles')
            .select('id, prenom, nom, telephone, is_open')
            .eq('role', 'vendeur');

        if (errSellers) throw errSellers;
        if (!sellers || sellers.length === 0) return [];

        const { data: reviews, error: errReviews } = await supabase
            .from('reviews')
            .select('seller_id, rating');

        if (errReviews) {
            console.warn('[CatalogService] Erreur récupération reviews:', errReviews);
        }

        const reviewsList = reviews || [];

        // Calcul des moyennes
        const computedSellers = sellers.map((seller) => {
            const sellerReviews = reviewsList.filter((r) => r.seller_id === seller.id);
            const reviewCount = sellerReviews.length;
            const avgRating =
                reviewCount > 0
                    ? sellerReviews.reduce((acc, curr) => acc + (curr.rating || 0), 0) / reviewCount
                    : 0;

            return {
                ...seller,
                reviewCount,
                avgRating: Number(avgRating.toFixed(1)),
            };
        });

        // Tri par note décroissante puis nombre d'avis
        computedSellers.sort((a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount);

        return computedSellers.slice(0, 6);
    } catch (error) {
        console.error('[CatalogService] Erreur TopShops:', error);
        return [];
    }
}

export default {
    CATEGORIES,
    fetchActiveProducts,
    searchProducts,
    fetchTopShops,
};
