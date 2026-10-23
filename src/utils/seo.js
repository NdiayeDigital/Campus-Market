/**
 * Module de gestion dynamique du SEO pour Campus Market (SPA)
 * Met à jour les métadonnées <head> (Title, Description, Open Graph, Twitter Cards, Canonical)
 * à chaque transition de vue, ouverture de produit ou recherche.
 */

export const BASE_URL = 'https://campusmarket-uidt.com';

export const DEFAULT_SEO = {
    title: 'Campus Market — Marketplace Étudiante UIDT Thiès | Livraison en Chambre',
    description: "Campus Market : La 1ère marketplace des étudiants de l'UIDT Thiès. Commandez repas, vêtements, fournitures et accessoires livrés directement dans votre chambre ou pavillon !",
    keywords: "Campus Market, Campus Market UIDT, Marketplace UIDT, Université Iba Der Thiam, Thiès, livraison pavillon Thiès, restaurant campus Thiès, friperie UIDT, boutique étudiant Sénégal",
    image: `${BASE_URL}/assets/logo-512x512.png`,
    url: `${BASE_URL}/`,
    type: 'website'
};

/**
 * Met à jour ou crée une balise meta par son sélecteur d'attributs.
 * @param {string} selector - Exemple: 'meta[name="description"]' ou 'meta[property="og:title"]'
 * @param {string} attrName - Nom de l'attribut à cibler ('name' ou 'property')
 * @param {string} attrValue - Valeur de l'attribut (ex: 'description')
 * @param {string} content - Contenu de la balise
 */
function setMetaTag(selector, attrName, attrValue, content) {
    if (!content) return;
    let el = document.querySelector(selector);
    if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attrName, attrValue);
        document.head.appendChild(el);
    }
    el.setAttribute('content', content);
}

/**
 * Met à jour ou crée le lien canonique dans <head>.
 * @param {string} url
 */
function setCanonical(url) {
    if (!url) return;
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
    }
    link.setAttribute('href', url);
}

/**
 * Met à jour l'ensemble des balises SEO de la page.
 * @param {Object} options
 * @param {string} [options.title]
 * @param {string} [options.description]
 * @param {string} [options.keywords]
 * @param {string} [options.image]
 * @param {string} [options.url]
 * @param {string} [options.type]
 */
export function updateSEO({
    title = DEFAULT_SEO.title,
    description = DEFAULT_SEO.description,
    keywords = DEFAULT_SEO.keywords,
    image = DEFAULT_SEO.image,
    url = DEFAULT_SEO.url,
    type = DEFAULT_SEO.type
} = {}) {
    // 1. Balise Title standard
    document.title = title;

    // 2. Balises meta standard
    setMetaTag('meta[name="description"]', 'name', 'description', description);
    setMetaTag('meta[name="keywords"]', 'name', 'keywords', keywords);

    // 3. Canonical URL
    setCanonical(url);

    // 4. Open Graph (Facebook, WhatsApp, LinkedIn)
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', title);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', description);
    setMetaTag('meta[property="og:image"]', 'property', 'og:image', image);
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', url);
    setMetaTag('meta[property="og:type"]', 'property', 'og:type', type);

    // 5. Twitter Cards
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', image);
}

/**
 * Configure le SEO pour la vue Catalogue général ou avec filtre.
 * @param {string} [categoryLabel] - Nom lisible de la catégorie sélectionnée
 * @param {string} [searchQuery] - Terme de recherche
 */
export function setCatalogSEO(categoryLabel = null, searchQuery = '') {
    if (searchQuery && searchQuery.trim().length > 0) {
        const queryClean = searchQuery.trim();
        updateSEO({
            title: `Recherche "${queryClean}" — Campus Market UIDT`,
            description: `Découvrez les produits correspondant à "${queryClean}" disponibles auprès des étudiants vendeurs de l'UIDT Thiès. Livraison rapide au pavillon.`,
            url: `${BASE_URL}/#catalog?q=${encodeURIComponent(queryClean)}`
        });
        return;
    }

    if (categoryLabel && categoryLabel.toLowerCase() !== 'tous' && categoryLabel.toLowerCase() !== 'all') {
        updateSEO({
            title: `${categoryLabel} — Offres Campus Market UIDT`,
            description: `Retrouvez les meilleures offres de ${categoryLabel.toLowerCase()} à l'Université Iba Der Thiam de Thiès. Commandez en ligne avec livraison en chambre.`,
            url: `${BASE_URL}/#catalog?cat=${encodeURIComponent(categoryLabel.toLowerCase())}`
        });
        return;
    }

    resetDefaultSEO();
}

/**
 * Configure le SEO pour la fiche détaillée d'un produit.
 * @param {Object} product
 */
export function setProductSEO(product) {
    if (!product) {
        resetDefaultSEO();
        return;
    }

    const priceText = product.price ? ` à ${Number(product.price).toLocaleString('fr-FR')} FCFA` : '';
    const sellerInfo = product.seller 
        ? ` par ${product.seller.prenom || ''} ${product.seller.nom || ''}`.trim() 
        : '';
    const descText = product.description 
        ? product.description.replace(/\s+/g, ' ').slice(0, 150)
        : `Commandez ${product.title}${priceText} sur Campus Market UIDT Thiès. Livraison rapide en pavillon.`;

    const productImageUrl = product.image_url || DEFAULT_SEO.image;

    updateSEO({
        title: `${product.title}${priceText} — Campus Market UIDT`,
        description: descText,
        image: productImageUrl,
        url: `${BASE_URL}/#product/${product.id}`,
        type: 'product'
    });
}

/**
 * Configure le SEO pour la vitrine d'une boutique étudiante.
 * @param {Object} seller
 */
export function setShopSEO(seller) {
    if (!seller) {
        resetDefaultSEO();
        return;
    }

    const shopName = seller.nom_boutique || `${seller.prenom || ''} ${seller.nom || ''}`.trim() || 'Boutique Étudiante';
    const desc = seller.bio 
        ? seller.bio.slice(0, 150)
        : `Découvrez la vitrine officielle de ${shopName} sur Campus Market UIDT Thiès. Tous les produits et contact direct.`;

    updateSEO({
        title: `${shopName} — Boutique Étudiante UIDT | Campus Market`,
        description: desc,
        image: seller.avatar_url || DEFAULT_SEO.image,
        url: `${BASE_URL}/#shop/${seller.id}`
    });
}

/**
 * Configure le SEO pour le suivi des commandes.
 */
export function setOrdersSEO() {
    updateSEO({
        title: 'Suivi de Mes Commandes — Campus Market UIDT',
        description: 'Suivez le statut de livraison de vos repas et commandes en temps réel sur le campus de l’Université Iba Der Thiam de Thiès.',
        url: `${BASE_URL}/#orders`
    });
}

/**
 * Configure le SEO pour l'espace vendeur.
 */
export function setSellerSEO() {
    updateSEO({
        title: 'Espace Vendeur — Développez votre commerce à l’UIDT | Campus Market',
        description: 'Rejoignez la communauté des étudiants entrepreneurs de l’UIDT. Créez votre boutique, publiez vos offres et gérez vos commandes en toute simplicité.',
        url: `${BASE_URL}/#seller`
    });
}

/**
 * Réinitialise le SEO aux valeurs par défaut de la page d'accueil.
 */
export function resetDefaultSEO() {
    updateSEO(DEFAULT_SEO);
}
