/**
 * Composant SellerShowcase (Vitrine Marchande Publique)
 * Permet aux étudiants de consulter le profil d'un vendeur, l'ensemble de ses articles,
 * et de lire / déposer des avis clients.
 */

import { fetchSellerProfile, fetchSellerProducts } from '../../services/catalog-service.js';
import { fetchSellerReviews, getSellerRatingStats } from '../../services/review-service.js';
import { createProductCard } from '../ProductCard.js';
import { createReviewModal } from '../ReviewModal.js';
import { escapeHTML, formatSenegalPhone } from '../../utils/security.js';
import { shareSellerShop } from '../../utils/share.js';
import { setShopSEO } from '../../utils/seo.js';

/**
 * Crée la vue Vitrine Marchande pour un vendeur spécifique.
 * @param {Object} props
 * @param {string} props.sellerId - UUID du vendeur
 * @param {Function} props.onBackToCatalog - Callback retour au catalogue principal
 * @param {Function} props.onAddToCart - Callback ajout au panier
 * @param {Function} [props.onClickProduct] - Callback clic sur une carte produit
 * @param {Function} [props.onShowToast] - Callback notification toast
 * @returns {HTMLElement}
 */
export function createSellerShowcase({
    sellerId,
    onBackToCatalog,
    onAddToCart,
    onClickProduct,
    onShowToast,
} = {}) {
    const containerEl = document.createElement('div');
    containerEl.id = 'seller-showcase-view';
    containerEl.className = 'w-full flex flex-col gap-6 select-none';

    let seller = null;
    let products = [];
    let reviews = [];
    let stats = { avgRating: 5.0, totalReviews: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }, recommendationRate: 100 };
    let isLoading = true;
    let activeTab = 'products'; // 'products' | 'reviews'
    let searchQuery = '';
    let selectedCategory = 'all';

    const reviewModal = createReviewModal({
        onReviewSubmitted: () => {
            loadData(true);
        },
        onShowToast,
    });

    async function loadData(silent = false) {
        if (!silent) {
            isLoading = true;
            renderLoading();
        }

        try {
            const [sellerData, productsData, reviewsData] = await Promise.all([
                fetchSellerProfile(sellerId),
                fetchSellerProducts(sellerId),
                fetchSellerReviews(sellerId),
            ]);

            seller = sellerData || (productsData && productsData[0]?.seller ? productsData[0].seller : null);
            products = productsData || [];
            reviews = reviewsData || [];
            stats = getSellerRatingStats(reviews);
            if (seller) {
                setShopSEO(seller);
            }
        } catch (err) {
            console.error('[SellerShowcase] Erreur chargement:', err);
            if (typeof onShowToast === 'function') {
                onShowToast('Impossible de charger la vitrine marchand.', 'error');
            }
        } finally {
            isLoading = false;
            render();
        }
    }

    function renderLoading() {
        containerEl.innerHTML = `
            <div class="w-full flex flex-col gap-6 animate-pulse">
                <div class="h-10 w-44 bg-slate-200 rounded-xl"></div>
                <div class="h-48 bg-white border border-slate-200/80 rounded-3xl p-6 flex flex-col gap-4">
                    <div class="flex items-center gap-4">
                        <div class="w-16 h-16 rounded-2xl bg-slate-200"></div>
                        <div class="flex flex-col gap-2 flex-1">
                            <div class="h-6 w-48 bg-slate-200 rounded-lg"></div>
                            <div class="h-4 w-32 bg-slate-200 rounded-lg"></div>
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    ${[1, 2, 3, 4, 5, 6].map(() => `
                        <div class="aspect-3/4 bg-white border border-slate-200/80 rounded-3xl"></div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function render() {
        if (!seller) {
            containerEl.innerHTML = `
                <div class="w-full py-16 flex flex-col items-center justify-center text-center gap-4">
                    <div class="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center text-2xl">
                        <i class="fa-solid fa-store-slash"></i>
                    </div>
                    <div>
                        <h3 class="font-heading font-extrabold text-lg text-slate-900">Boutique introuvable</h3>
                        <p class="text-xs text-slate-500 mt-1">Ce marchand n'est plus actif ou le lien est invalide.</p>
                    </div>
                    <button 
                        type="button" 
                        id="btn-back-not-found"
                        class="px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-all cursor-pointer active:scale-95"
                    >
                        ← Revenir au catalogue
                    </button>
                </div>
            `;
            containerEl.querySelector('#btn-back-not-found')?.addEventListener('click', () => {
                if (typeof onBackToCatalog === 'function') onBackToCatalog();
            });
            return;
        }

        const isSuspended = seller.role === 'suspendu' || seller.role === 'vendeur_desactive';
        const isOpen = !isSuspended && (seller.is_open !== false);
        const sellerName = `${seller.prenom || ''} ${seller.nom || ''}`.trim() || 'Vendeur UIDT';
        const shopTitle = seller.shop_name || (seller.prenom ? `Boutique ${seller.prenom}` : 'Boutique UIDT');
        const initials = ((seller.shop_name?.[0] || seller.prenom?.[0] || 'V') + (seller.nom?.[0] || '')).toUpperCase();
        const cleanPhone = formatSenegalPhone(seller.telephone || '');

        // Catégories présentes dans les produits du vendeur
        const availableCategories = ['all', ...new Set(products.map((p) => p.category).filter(Boolean))];

        // Filtrage des articles de la boutique
        const filteredProducts = products.filter((p) => {
            if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const title = (p.title || '').toLowerCase();
                const desc = (p.description || '').toLowerCase();
                if (!title.includes(q) && !desc.includes(q)) return false;
            }
            return true;
        });

        containerEl.innerHTML = `
            <!-- 1. BARRE DE RETOUR SUPÉRIEURE -->
            <div class="flex items-center justify-between gap-4">
                <button 
                    type="button" 
                    id="btn-showcase-back" 
                    class="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white hover:bg-slate-100 border border-slate-200/80 text-xs font-bold text-slate-700 shadow-xs transition-all active:scale-95 cursor-pointer min-h-[42px]"
                >
                    <i class="fa-solid fa-arrow-left text-xs text-primary"></i>
                    <span>Toutes les offres du campus</span>
                </button>

                <div class="flex items-center gap-2">
                    <span class="text-xs text-slate-400 font-medium hidden sm:inline">Vitrine certifiée UIDT</span>
                    <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
            </div>

            <!-- 2. HERO CARD MARCHAND IMMERSIF -->
            <div class="bg-gradient-to-br from-white via-slate-50/70 to-blue-50/40 rounded-3xl border border-slate-200/80 shadow-card p-5 sm:p-7 relative overflow-hidden flex flex-col gap-6">
                <!-- Motif décoratif campus en arrière plan -->
                <div class="absolute -right-10 -bottom-10 w-44 h-44 rounded-full bg-primary/5 pointer-events-none blur-xl"></div>

                <div class="flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <!-- Identité Vendeur -->
                    <div class="flex items-start sm:items-center gap-4">
                        <div class="relative">
                            <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-primary to-blue-600 text-white font-heading font-extrabold text-xl sm:text-2xl flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
                                ${initials}
                            </div>
                            <span class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-white flex items-center justify-center shadow-xs">
                                <i class="fa-solid fa-shield-halved text-xs text-emerald-600"></i>
                            </span>
                        </div>

                        <div class="flex flex-col min-w-0">
                            <div class="flex items-center gap-2 flex-wrap">
                                <h1 class="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 leading-tight">
                                    ${escapeHTML(shopTitle)}
                                </h1>
                                ${!isSuspended ? `
                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                                        isOpen 
                                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                            : 'bg-amber-50 text-amber-800 border-amber-300'
                                    }">
                                        <span class="w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
                                        <span>${isOpen ? 'Boutique Ouverte' : 'En Pause'}</span>
                                    </span>
                                ` : `
                                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                        <i class="fa-solid fa-ban text-[10px]"></i> Suspendue
                                    </span>
                                `}
                            </div>

                            <p class="text-xs text-slate-500 font-medium mt-1">
                                Marchand étudiant • ${escapeHTML(sellerName)}
                            </p>

                            <!-- Note et résumé avis -->
                            <div class="flex items-center gap-3 mt-2 flex-wrap">
                                <div class="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-xl">
                                    <i class="fa-solid fa-star text-amber-500 text-xs"></i>
                                    <span>${stats.avgRating.toFixed(1)}</span>
                                    <span class="text-slate-400 font-normal">/ 5</span>
                                </div>
                                <span class="text-xs text-slate-500 font-medium">
                                    ${stats.totalReviews} avis client${stats.totalReviews > 1 ? 's' : ''}
                                </span>
                                <span class="text-slate-300">•</span>
                                <span class="text-xs text-emerald-700 font-bold flex items-center gap-1">
                                    <i class="fa-solid fa-thumbs-up text-[10px]"></i>
                                    ${stats.recommendationRate}% de satisfaction
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Actions Directes (Appel, WhatsApp, Laisser un avis) -->
                    <div class="flex items-center gap-2 flex-wrap self-stretch sm:self-auto justify-end">
                        ${cleanPhone ? `
                            <a 
                                href="tel:${cleanPhone}" 
                                title="Appeler le marchand" 
                                class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all active:scale-95 cursor-pointer min-h-[42px]"
                            >
                                <i class="fa-solid fa-phone text-xs text-emerald-600"></i>
                                <span>Appeler</span>
                            </a>
                            <a 
                                href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Bonjour ${seller.prenom} ! Je vous contacte depuis votre boutique Campus Market.`)}" 
                                target="_blank" 
                                rel="noopener" 
                                title="Discuter sur WhatsApp" 
                                class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all active:scale-95 cursor-pointer min-h-[42px]"
                            >
                                <i class="fa-brands fa-whatsapp text-sm"></i>
                                <span>WhatsApp</span>
                            </a>
                        ` : ''}

                        <button 
                            type="button" 
                            id="btn-showcase-share"
                            title="Partager cette boutique (Lien & WhatsApp)"
                            class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200/90 text-slate-800 font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer min-h-[42px]"
                        >
                            <i class="fa-solid fa-share-nodes text-xs text-primary"></i>
                            <span>Partager</span>
                        </button>

                        <button 
                            type="button" 
                            id="btn-showcase-leave-review"
                            class="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm shadow-amber-500/20 transition-all active:scale-95 cursor-pointer min-h-[42px]"
                        >
                            <i class="fa-solid fa-star text-xs"></i>
                            <span>Donner un avis</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- 3. SOUS-ONGLETS DE NAVIGATION (Articles vs Avis) -->
            <div class="flex items-center justify-between border-b border-slate-200/80 pb-3 gap-4 flex-wrap">
                <div class="flex items-center gap-2">
                    <button 
                        type="button" 
                        id="tab-btn-showcase-products"
                        class="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 ${
                            activeTab === 'products'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                        }"
                    >
                        <i class="fa-solid fa-boxes-stacked text-xs"></i>
                        <span>Articles en vente</span>
                        <span class="px-2 py-0.2 rounded-full text-[10px] font-extrabold ${
                            activeTab === 'products' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                        }">
                            ${products.length}
                        </span>
                    </button>

                    <button 
                        type="button" 
                        id="tab-btn-showcase-reviews"
                        class="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer active:scale-95 ${
                            activeTab === 'reviews'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                        }"
                    >
                        <i class="fa-solid fa-star text-xs text-amber-500"></i>
                        <span>Avis clients</span>
                        <span class="px-2 py-0.2 rounded-full text-[10px] font-extrabold ${
                            activeTab === 'reviews' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                        }">
                            ${reviews.length}
                        </span>
                    </button>
                </div>

                ${activeTab === 'products' && products.length > 0 ? `
                    <!-- Barre de recherche interne à la boutique -->
                    <div class="relative min-w-[220px] flex-1 sm:flex-initial">
                        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input 
                            type="text" 
                            id="showcase-search-input" 
                            placeholder="Chercher chez ${escapeHTML(seller.prenom)}..." 
                            value="${escapeHTML(searchQuery)}"
                            class="w-full pl-9 pr-3 py-2 bg-white border border-slate-200/80 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-xs"
                        >
                    </div>
                ` : ''}
            </div>

            <!-- 4. CONTENU DE L'ONGLET SÉLECTIONNÉ -->
            <div id="showcase-tab-content" class="w-full">
                ${activeTab === 'products' ? renderProductsTab(filteredProducts, availableCategories) : renderReviewsTab()}
            </div>
        `;

        bindEvents();
    }

    function renderProductsTab(items, categories) {
        if (items.length === 0) {
            return `
                <div class="bg-white rounded-3xl border border-slate-200/80 p-12 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
                    <div class="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
                        <i class="fa-solid fa-box-open"></i>
                    </div>
                    <div>
                        <h4 class="font-heading font-extrabold text-base text-slate-900">
                            ${searchQuery ? 'Aucun article correspondant' : 'Aucun article en vente'}
                        </h4>
                        <p class="text-xs text-slate-500 mt-0.5">
                            ${searchQuery ? `Aucun résultat pour "${escapeHTML(searchQuery)}"` : 'Ce marchand n\'a pas encore publié d\'articles disponibles.'}
                        </p>
                    </div>
                    ${searchQuery ? `
                        <button type="button" id="btn-reset-showcase-search" class="mt-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer">
                            Réinitialiser la recherche
                        </button>
                    ` : ''}
                </div>
            `;
        }

        return `
            <div class="flex flex-col gap-4">
                ${categories.length > 2 ? `
                    <!-- Filtres par catégorie interne -->
                    <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                        ${categories.map((cat) => `
                            <button 
                                type="button" 
                                data-showcase-cat="${escapeHTML(cat)}" 
                                class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer active:scale-95 ${
                                    selectedCategory === cat 
                                        ? 'bg-primary text-white shadow-xs' 
                                        : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                                }"
                            >
                                ${cat === 'all' ? 'Tous les articles' : escapeHTML(cat)}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- Grille responsive des articles du vendeur (alignée avec le catalogue) -->
                <div id="showcase-product-grid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 w-full"></div>
            </div>
        `;
    }

    function renderReviewsTab() {
        return `
            <div class="flex flex-col gap-6">
                <!-- Bento Card Récapitulatif Notes -->
                <div class="bg-white rounded-3xl border border-slate-200/80 shadow-card p-5 sm:p-7 flex flex-col md:flex-row items-center justify-between gap-6">
                    <!-- Colonne 1 : Grande Note -->
                    <div class="flex flex-col items-center text-center p-3">
                        <span class="font-heading font-black text-4xl sm:text-5xl text-slate-900 tracking-tight">
                            ${stats.avgRating.toFixed(1)}
                        </span>
                        <div class="flex items-center gap-1 text-amber-400 text-sm mt-1">
                            ${[1, 2, 3, 4, 5].map((s) => `
                                <i class="fa-solid fa-star ${s <= Math.round(stats.avgRating) ? 'text-amber-400' : 'text-slate-200'}"></i>
                            `).join('')}
                        </div>
                        <span class="text-xs text-slate-500 font-semibold mt-1.5">
                            Basé sur ${stats.totalReviews} avis
                        </span>
                    </div>

                    <!-- Colonne 2 : Barres de Répartition 5★ à 1★ -->
                    <div class="flex-1 w-full max-w-sm flex flex-col gap-2">
                        ${[5, 4, 3, 2, 1].map((level) => {
                            const count = stats.distribution[level] || 0;
                            const pct = stats.totalReviews > 0 ? Math.round((count / stats.totalReviews) * 100) : 0;
                            return `
                                <div class="flex items-center gap-2.5 text-xs text-slate-600">
                                    <span class="w-7 font-bold text-right">${level} ★</span>
                                    <div class="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                                        <div class="h-full bg-amber-400 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                                    </div>
                                    <span class="w-8 text-[11px] text-slate-400 text-right">${count}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- Colonne 3 : Bouton d'action Déposer avis -->
                    <div class="flex flex-col items-center justify-center p-3 text-center border-t md:border-t-0 md:border-l border-slate-100 w-full md:w-auto">
                        <button 
                            type="button" 
                            id="btn-reviews-cta"
                            class="w-full sm:w-auto px-5 py-3 rounded-2xl bg-primary hover:bg-primary-hover text-white text-xs font-extrabold shadow-md shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <i class="fa-solid fa-star text-amber-300"></i>
                            <span>Donner mon avis</span>
                        </button>
                        <span class="text-[11px] text-slate-400 mt-2">Partagez votre retour d'expérience</span>
                    </div>
                </div>

                <!-- Liste des avis étudiants -->
                <div class="flex flex-col gap-3">
                    <h3 class="font-heading font-extrabold text-base text-slate-900 flex items-center gap-2">
                        <span>Commentaires des étudiants</span>
                        <span class="text-xs text-slate-400 font-semibold">(${reviews.length})</span>
                    </h3>

                    ${reviews.length === 0 ? `
                        <div class="bg-white rounded-3xl border border-slate-200/80 p-8 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
                            <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-lg">
                                <i class="fa-solid fa-star"></i>
                            </div>
                            <div>
                                <h4 class="font-heading font-bold text-sm text-slate-900">Aucun avis pour le moment</h4>
                                <p class="text-xs text-slate-500 mt-0.5">Soyez le premier étudiant à évaluer cette boutique !</p>
                            </div>
                        </div>
                    ` : `
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                            ${reviews.map((rev) => {
                                const buyer = rev.buyer;
                                const buyerName = buyer ? `${buyer.prenom || ''} ${buyer.nom || ''}`.trim() : 'Étudiant Campus';
                                const buyerInitials = ((buyer?.prenom?.[0] || 'E') + (buyer?.nom?.[0] || '')).toUpperCase();
                                const note = Math.max(1, Math.min(5, Number(rev.rating) || 5));
                                const dateStr = rev.created_at 
                                    ? new Date(rev.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                                    : 'Récemment';

                                return `
                                    <div class="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col justify-between gap-3 shadow-xs hover:border-slate-300 transition-colors">
                                        <div class="flex items-start justify-between gap-3">
                                            <div class="flex items-center gap-2.5">
                                                <div class="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 font-heading font-extrabold text-xs flex items-center justify-center">
                                                    ${buyerInitials}
                                                </div>
                                                <div>
                                                    <div class="flex items-center gap-1.5">
                                                        <span class="font-heading font-bold text-xs text-slate-900">${escapeHTML(buyerName)}</span>
                                                        ${rev.order_id ? `
                                                            <span class="px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200 flex items-center gap-1">
                                                                <i class="fa-solid fa-check text-[8px]"></i> Achat vérifié
                                                            </span>
                                                        ` : ''}
                                                    </div>
                                                    <span class="text-[10px] text-slate-400 font-medium">${dateStr}</span>
                                                </div>
                                            </div>

                                            <!-- Étoiles -->
                                            <div class="flex items-center gap-0.5 text-amber-400 text-xs">
                                                ${[1, 2, 3, 4, 5].map((s) => `
                                                    <i class="fa-solid fa-star ${s <= note ? 'text-amber-400' : 'text-slate-200'}"></i>
                                                `).join('')}
                                            </div>
                                        </div>

                                        <p class="text-xs text-slate-700 leading-relaxed font-normal ${!rev.comment ? 'italic text-slate-400' : ''}">
                                            ${rev.comment ? escapeHTML(rev.comment) : 'A laissé une évaluation sans commentaire écrit.'}
                                        </p>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    function bindEvents() {
        // Bouton retour
        containerEl.querySelector('#btn-showcase-back')?.addEventListener('click', () => {
            if (typeof onBackToCatalog === 'function') onBackToCatalog();
        });

        // Bouton Partager la boutique
        containerEl.querySelector('#btn-showcase-share')?.addEventListener('click', () => {
            shareSellerShop(seller, onShowToast);
        });

        // Boutons laisser avis
        const openReviewAction = () => {
            reviewModal.open({ seller });
        };
        containerEl.querySelector('#btn-showcase-leave-review')?.addEventListener('click', openReviewAction);
        containerEl.querySelector('#btn-reviews-cta')?.addEventListener('click', openReviewAction);

        // Changement d'onglet
        containerEl.querySelector('#tab-btn-showcase-products')?.addEventListener('click', () => {
            activeTab = 'products';
            render();
        });
        containerEl.querySelector('#tab-btn-showcase-reviews')?.addEventListener('click', () => {
            activeTab = 'reviews';
            render();
        });

        // Recherche interne
        const searchInput = containerEl.querySelector('#showcase-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchQuery = e.target.value;
                const gridContent = containerEl.querySelector('#showcase-tab-content');
                if (gridContent && activeTab === 'products') {
                    const availableCategories = ['all', ...new Set(products.map((p) => p.category).filter(Boolean))];
                    const filtered = products.filter((p) => {
                        if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
                        if (searchQuery) {
                            const q = searchQuery.toLowerCase();
                            const title = (p.title || '').toLowerCase();
                            const desc = (p.description || '').toLowerCase();
                            if (!title.includes(q) && !desc.includes(q)) return false;
                        }
                        return true;
                    });
                    gridContent.innerHTML = renderProductsTab(filtered, availableCategories);
                    mountProductCards(filtered);
                }
            });
        }

        // Réinitialiser la recherche
        containerEl.querySelector('#btn-reset-showcase-search')?.addEventListener('click', () => {
            searchQuery = '';
            render();
        });

        // Filtre catégories
        containerEl.querySelectorAll('button[data-showcase-cat]').forEach((btn) => {
            btn.addEventListener('click', () => {
                selectedCategory = btn.dataset.showcaseCat;
                render();
            });
        });

        // Montage des cartes de produits si l'onglet est 'products'
        if (activeTab === 'products') {
            const filtered = products.filter((p) => {
                if (selectedCategory !== 'all' && p.category !== selectedCategory) return false;
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    const title = (p.title || '').toLowerCase();
                    const desc = (p.description || '').toLowerCase();
                    if (!title.includes(q) && !desc.includes(q)) return false;
                }
                return true;
            });
            mountProductCards(filtered);
        }
    }

    function mountProductCards(items) {
        const grid = containerEl.querySelector('#showcase-product-grid');
        if (!grid) return;
        grid.innerHTML = '';

        items.forEach((product) => {
            const productWithSeller = {
                ...product,
                seller: product.seller || seller,
            };
            const card = createProductCard({
                product: productWithSeller,
                onAddToCart: (item, quantity) => {
                    if (typeof onAddToCart === 'function') onAddToCart(item, quantity);
                },
                onClickCard: (p) => {
                    if (typeof onClickProduct === 'function') onClickProduct(p);
                },
                // Dans la vitrine du vendeur, le clic sur le nom reste sur la même vitrine
                onOpenSeller: () => {},
            });
            grid.appendChild(card);
        });
    }

    // Chargement initial
    loadData();

    return containerEl;
}

export default createSellerShowcase;
