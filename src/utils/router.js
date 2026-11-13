/**
 * Utilitaire de routage pour Campus Market.
 * Gère la résolution des fragments (#hash) et query params de façon déterministe et tolérante.
 */

/**
 * Résout la vue et les paramètres cibles à partir d'un hash et/ou d'une chaîne de recherche.
 * @param {string} [rawHash=''] - Fragment d'URL (ex: '#shop/UUID', '#seller/UUID', '#seller')
 * @param {string|URLSearchParams} [search=''] - Chaîne de requête éventuelle (ex: '?shop=UUID')
 * @returns {{ view: 'catalog' | 'shop' | 'seller' | 'admin' | 'orders' | 'product' | 'profile', params: Object }}
 */
export function resolveRoute(rawHash = '', search = '') {
    const raw = (rawHash || '').trim();
    const hash = raw.toLowerCase();

    // 1. Sous-onglets réservés de l'Espace Vendeur (#seller/orders, #seller/products, #seller/add, #seller/profile, #seller/dashboard)
    const sellerSubTabMatch = raw.match(/^#seller\/(orders|products|add|dashboard|profile)(?:[/?#]|$)/i);
    if (sellerSubTabMatch) {
        const sub = sellerSubTabMatch[1].toLowerCase();
        const subTab = sub === 'add' ? 'add-product' : sub;
        return { view: 'seller', params: { subTab } };
    }

    // 2. Vitrine marchande publique : #shop/UUID ou tolérance rétroactive #seller/UUID ou #vendeur/UUID
    const shopMatch = raw.match(/^#(?:shop|seller|vendeur)\/([^?#]+)/i);
    if (shopMatch && shopMatch[1]) {
        const sellerId = shopMatch[1].replace(/\/+$/, '').trim();
        if (sellerId) {
            return { view: 'shop', params: { sellerId } };
        }
    }

    // 3. Fiche produit en deep-link (#product/UUID)
    if (hash.startsWith('#product/')) {
        const rawId = raw.slice(9);
        const productId = rawId.split('?')[0].replace(/\/+$/, '').trim();
        if (productId) {
            return { view: 'product', params: { productId } };
        }
    }

    // 4. Espace SuperAdmin (#admin)
    if (hash === '#admin' || hash.startsWith('#admin?')) {
        return { view: 'admin', params: {} };
    }

    // 5. Espace Vendeur Privé (Backoffice - onglet dashboard par défaut)
    if (hash === '#seller' || hash.startsWith('#seller?')) {
        return { view: 'seller', params: { subTab: 'dashboard' } };
    }

    // 6. Page Profil Vendeur Privé (#profile) -> active le 5e onglet profile de l'Espace Vendeur
    if (hash === '#profile' || hash.startsWith('#profile?') || hash.startsWith('#profile/')) {
        return { view: 'seller', params: { subTab: 'profile' } };
    }

    // 5. Suivi des commandes (#orders)
    if (hash === '#orders' || hash.startsWith('#orders?')) {
        return { view: 'orders', params: {} };
    }

    // 6. Pages institutionnelles & légales (#about, #terms, #privacy)
    if (hash === '#about' || hash.startsWith('#about?') || hash === '#a-propos' || hash.startsWith('#a-propos?')) {
        return { view: 'about', params: {} };
    }
    if (
        hash === '#terms' || hash.startsWith('#terms?') ||
        hash === '#cgu' || hash.startsWith('#cgu?') ||
        hash === '#conditions' || hash.startsWith('#conditions?') ||
        hash === '#regles' || hash.startsWith('#regles?')
    ) {
        return { view: 'terms', params: {} };
    }
    if (
        hash === '#privacy' || hash.startsWith('#privacy?') ||
        hash === '#confidentialite' || hash.startsWith('#confidentialite?') ||
        hash === '#donnees-personnelles' || hash.startsWith('#donnees-personnelles?')
    ) {
        return { view: 'privacy', params: {} };
    }

    // 7. Support des paramètres d'URL (?shop=UUID ou ?seller=UUID)
    try {
        const searchStr = typeof search === 'string' 
            ? search 
            : (typeof window !== 'undefined' ? window.location.search : '');
        if (searchStr) {
            const urlParams = new URLSearchParams(searchStr);
            const querySellerId = urlParams.get('shop') || urlParams.get('seller') || urlParams.get('vendeur');
            if (querySellerId && querySellerId.trim()) {
                return { view: 'shop', params: { sellerId: querySellerId.trim() } };
            }
        }
    } catch {}

    // 7. Catalogue par défaut
    return { view: 'catalog', params: {} };
}

export default {
    resolveRoute,
};
