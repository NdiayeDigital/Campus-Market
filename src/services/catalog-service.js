/**
 * Service de gestion du catalogue et recherche Campus Market.
 * Interagit avec Supabase et exploite la recherche floue (Levenshtein).
 */

import { supabase } from './supabase.js';
import { levenshteinDistance } from '../utils/levenshtein.js';
import { getSuspendedSellersCache } from './admin-service.js';

// Clés de persistance locale pour tolérance hors-ligne
const PRODUCTS_CACHE_KEY = 'campus_market_cached_products';
const TOPSHOPS_CACHE_KEY = 'campus_market_cached_top_shops';

// Cache mémoire
let memoryProductsCache = [];
let memoryTopShopsCache = [];

/**
 * Récupère les produits persistés en LocalStorage / Mémoire.
 * @returns {Array}
 */
function getLocalCachedProducts() {
    if (memoryProductsCache.length > 0) return memoryProductsCache;
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(PRODUCTS_CACHE_KEY);
            if (raw) {
                memoryProductsCache = JSON.parse(raw);
                return memoryProductsCache;
            }
        }
    } catch (err) {
        console.warn('[CatalogService] Erreur lecture cache local:', err);
    }
    return [];
}

/**
 * Sauvegarde les produits en LocalStorage et mémoire.
 * @param {Array} products
 */
function saveLocalCachedProducts(products) {
    if (!products || !Array.isArray(products) || products.length === 0) return;
    memoryProductsCache = products;
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(PRODUCTS_CACHE_KEY, JSON.stringify(products));
        }
    } catch (err) {
        console.warn('[CatalogService] Erreur écriture cache local:', err);
    }
}

/**
 * Récupère les top shops depuis le cache local.
 * @returns {Array}
 */
function getLocalCachedTopShops() {
    if (memoryTopShopsCache.length > 0) return memoryTopShopsCache;
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(TOPSHOPS_CACHE_KEY);
            if (raw) {
                memoryTopShopsCache = JSON.parse(raw);
                return memoryTopShopsCache;
            }
        }
    } catch (err) {
        console.warn('[CatalogService] Erreur lecture cache top shops:', err);
    }
    return [];
}

/**
 * Sauvegarde les top shops en LocalStorage et mémoire.
 * @param {Array} shops
 */
function saveLocalCachedTopShops(shops) {
    if (!shops || !Array.isArray(shops) || shops.length === 0) return;
    memoryTopShopsCache = shops;
    try {
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem(TOPSHOPS_CACHE_KEY, JSON.stringify(shops));
        }
    } catch (err) {
        console.warn('[CatalogService] Erreur écriture cache top shops:', err);
    }
}

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
 * Utilise un AbortController avec timeout strict de 10 secondes (optimisé réseau mobile)
 * et repli automatique sur le cache LocalStorage / mémoire.
 *
 * @param {Object} [options]
 * @param {string} [options.category='all'] - Catégorie à filtrer
 * @param {number} [options.limit=50] - Nombre maximal de produits
 * @param {number} [options.offset=0] - Offset pour pagination
 * @returns {Promise<Array>}
 */
export async function fetchActiveProducts({ category = 'all', limit = 50, offset = 0 } = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, 10000); // 10 secondes max pour réseau mobile

    try {
        let query = supabase
            .from('products')
            .select('*, seller:seller_id(id, prenom, nom, telephone, is_open, role)')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1)
            .abortSignal(controller.signal);

        if (category && category !== 'all') {
            const catObj = CATEGORIES.find((c) => c.id === category || c.label === category);
            if (catObj) {
                query = query.or(`category.eq."${catObj.id}",category.eq."${catObj.label}"`);
            } else {
                query = query.eq('category', category);
            }
        }

        const { data, error } = await query;
        clearTimeout(timeoutId);

        if (error) throw error;

        const rawProducts = data || [];
        const suspendedIds = getSuspendedSellersCache();
        const products = rawProducts.filter((p) => {
            if (!p.seller) return true;
            if (p.seller.role === 'vendeur_desactive' || p.seller.role === 'suspendu' || p.seller.is_suspended === true) {
                return false;
            }
            if (suspendedIds.includes(p.seller.id) || suspendedIds.includes(p.seller_id)) {
                return false;
            }
            return true;
        });

        if (category === 'all' && offset === 0 && products.length > 0) {
            saveLocalCachedProducts(products);
        }

        return products;
    } catch (err) {
        clearTimeout(timeoutId);
        const isAbort = err.name === 'AbortError' || err.message?.includes('aborted');
        console.warn(
            `[CatalogService] ${isAbort ? 'Timeout (10s) réseau mobile atteint' : 'Erreur requête Supabase'}:`,
            err.message || err
        );

        // Fallback immédiat sur les données en cache (LocalStorage / Mémoire)
        const cached = getLocalCachedProducts();
        if (cached && cached.length > 0) {
            console.info('[CatalogService] Affichage des données de secours depuis le cache local.');
            if (category === 'all') return cached;
            const catObj = CATEGORIES.find((c) => c.id === category || c.label === category);
            return cached.filter(
                (p) => p.category === category || (catObj && (p.category === catObj.id || p.category === catObj.label))
            );
        }

        // Si aucune donnée n'est disponible, renvoie un tableau vide
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
    let cache = getLocalCachedProducts();
    if (!cache || cache.length === 0) {
        cache = await fetchActiveProducts({ category: 'all' });
    }

    const cleanQuery = query.toLowerCase().trim();
    const catObj = CATEGORIES.find((c) => c.id === category || c.label === category);

    return (cache || []).filter((product) => {
        // 1. Filtre catégorie
        const matchesCategory =
            category === 'all' ||
            product.category === category ||
            (catObj && (product.category === catObj.id || product.category === catObj.label));
        if (!matchesCategory) return false;

        // Si aucune recherche texte, on retient tous les produits de la catégorie
        if (!cleanQuery) return true;

        const title = (product.title || '').toLowerCase();
        const sellerName = product.seller
            ? `${product.seller.prenom || ''} ${product.seller.nom || ''}`.toLowerCase()
            : '';
        const categoryLabel = (product.category || '').toLowerCase();

        // Correspondance directe
        if (title.includes(cleanQuery) || sellerName.includes(cleanQuery) || categoryLabel.includes(cleanQuery)) {
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
 * Utilise un AbortController avec timeout de 10s et repli sur le cache local.
 * @returns {Promise<Array>}
 */
export async function fetchTopShops() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, 10000);

    try {
        const sellersQuery = supabase
            .from('profiles')
            .select('id, prenom, nom, telephone, is_open')
            .eq('role', 'vendeur')
            .abortSignal(controller.signal);

        const { data: sellers, error: errSellers } = await sellersQuery;
        if (errSellers) throw errSellers;
        if (!sellers || sellers.length === 0) return [];

        const reviewsQuery = supabase
            .from('reviews')
            .select('seller_id, rating')
            .abortSignal(controller.signal);

        const { data: reviews } = await reviewsQuery;
        clearTimeout(timeoutId);

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
        const topShops = computedSellers.slice(0, 6);
        saveLocalCachedTopShops(topShops);

        return topShops;
    } catch (error) {
        clearTimeout(timeoutId);
        console.warn('[CatalogService] Erreur TopShops, repli sur cache local:', error.message || error);
        return getLocalCachedTopShops();
    }
}

export default {
    CATEGORIES,
    fetchActiveProducts,
    searchProducts,
    fetchTopShops,
};
