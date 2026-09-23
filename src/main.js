/**
 * Point d'entrée principal de Campus Market (Vite + Tailwind CSS).
 * Orchestre l'expérience acheteur, le catalogue réactif, le panier, le suivi de commandes
 * ainsi que l'Espace Vendeur en temps réel (Supabase Realtime).
 */

import './index.css';
import { createHeader } from './components/Header.js';
import { createCategoryChips } from './components/CategoryChips.js';
import { createProductCard } from './components/ProductCard.js';
import { createCartModal } from './components/CartModal.js';
import { createCheckoutModal } from './components/CheckoutModal.js';
import { createOrderStatusView, trackRecentOrder } from './components/OrderStatus.js';
import { createProductDetailModal } from './components/ProductDetailModal.js';
import { createSellerAuthModal } from './components/seller/SellerAuthModal.js';
import { createSellerDashboard } from './components/seller/SellerDashboard.js';
import { createSuperAdminDashboard } from './components/admin/SuperAdminDashboard.js';
import { getCurrentSeller } from './services/seller-service.js';
import { cartStore } from './services/cart-store.js';
import {
    fetchActiveProducts,
    searchProducts,
    fetchTopShops,
} from './services/catalog-service.js';
import { escapeHTML } from './utils/security.js';
import { showToast } from './utils/notifications.js';
import logoUrl from './assets/logo.webp';

export { showToast };

const LOCAL_SELLER_KEY = 'campus_market_cached_seller';

// Récupération synchrone immédiate du profil vendeur en cache pour éviter toute déconnexion au rafraîchissement
let initialCachedSeller = null;
try {
    const rawSeller = localStorage.getItem(LOCAL_SELLER_KEY);
    if (rawSeller) initialCachedSeller = JSON.parse(rawSeller);
} catch {
    initialCachedSeller = null;
}

// État local de l'application
const appState = {
    currentCategory: 'all',
    searchQuery: '',
    currentView: 'catalog', // 'catalog' | 'orders' | 'seller' | 'admin'
    currentSeller: initialCachedSeller,
    products: [],
    topShops: [],
    isLoading: true,
};

/**
 * Initialise l'application Campus Market dans le DOM.
 */
async function initApp() {
    const appEl = document.getElementById('app') || document.body;
    appEl.innerHTML = ''; // Nettoyage initial

    const rootWrapper = document.createElement('div');
    rootWrapper.className = 'min-h-screen bg-background flex flex-col antialiased text-slate-900 selection:bg-primary selection:text-white';

    // Validation asynchrone continue de la session auprès de Supabase
    getCurrentSeller()
        .then((existingSeller) => {
            if (existingSeller && existingSeller.profile && (existingSeller.profile.role === 'vendeur' || existingSeller.profile.role === 'superadmin')) {
                appState.currentSeller = existingSeller.profile;
                try {
                    localStorage.setItem(LOCAL_SELLER_KEY, JSON.stringify(existingSeller.profile));
                } catch {}
            } else if (appState.currentSeller) {
                // La session distante n'est plus valide (expirée ou révoquée)
                appState.currentSeller = null;
                try {
                    localStorage.removeItem(LOCAL_SELLER_KEY);
                } catch {}
                if (appState.currentView === 'seller') {
                    navigateToView('catalog');
                    showToast('Votre session vendeur a expiré. Veuillez vous reconnecter.', 'warning');
                }
            }
        })
        .catch((err) => {
            console.warn('[Main] Session vendeur non bloquante:', err);
        });

    // 1. Modales globales
    const cartModalController = createCartModal({
        onProceedToCheckout: () => {
            checkoutModalController.open();
        },
    });

    const checkoutModalController = createCheckoutModal({
        onOrderSuccess: (orderInfo) => {
            trackRecentOrder(orderInfo);
            showToast(`🎉 Commande ${orderInfo.reference} enregistrée !`, 'success');
            navigateToView('orders');
        },
    });

    const sellerAuthModalController = createSellerAuthModal({
        onAuthenticated: ({ profile }) => {
            appState.currentSeller = profile;
            try {
                localStorage.setItem(LOCAL_SELLER_KEY, JSON.stringify(profile));
            } catch {}
            showToast(`Bienvenue dans votre Espace Vendeur, ${profile.prenom} !`, 'success');
            navigateToView('seller');
        },
    });

    const productDetailModalController = createProductDetailModal({
        onAddToCart: (product, qty = 1) => {
            cartStore.addToCart(product, qty);
            showToast(`Ajouté au panier : ${product.title} (x${qty})`, 'success');
        },
    });

    document.body.appendChild(cartModalController.element);
    document.body.appendChild(checkoutModalController.element);
    document.body.appendChild(sellerAuthModalController.element);
    document.body.appendChild(productDetailModalController.element);

    // 2. Header
    const headerComponent = createHeader({
        onLogoClick: async () => {
            appState.searchQuery = '';
            appState.currentCategory = 'all';
            if (categoryChipsComponent?.setActiveCategory) {
                categoryChipsComponent.setActiveCategory('all');
            }
            const searchInput = document.getElementById('header-search-input');
            if (searchInput) searchInput.value = '';
            if (appState.currentView !== 'catalog') {
                navigateToView('catalog');
            }
            await reloadProducts();
        },
        onSearch: async (query) => {
            appState.searchQuery = query;
            if (appState.currentView !== 'catalog') {
                navigateToView('catalog');
            }
            await reloadProducts();
        },
        onOpenCart: () => {
            cartModalController.open();
        },
        onOpenOrders: () => {
            navigateToView('orders');
        },
        onOpenSeller: async () => {
            // Si déjà connecté vendeur -> ouvre le dashboard
            if (appState.currentSeller) {
                navigateToView('seller');
                return;
            }
            // Vérifie si une session existe
            const sellerSession = await getCurrentSeller();
            if (sellerSession && sellerSession.profile && (sellerSession.profile.role === 'vendeur' || sellerSession.profile.role === 'superadmin')) {
                appState.currentSeller = sellerSession.profile;
                try {
                    localStorage.setItem(LOCAL_SELLER_KEY, JSON.stringify(sellerSession.profile));
                } catch {}
                navigateToView('seller');
            } else {
                sellerAuthModalController.open('login');
            }
        },
    });

    rootWrapper.appendChild(headerComponent);

    // 3. Barre de sélection de catégorie (Chips)
    const categoryChipsComponent = createCategoryChips({
        activeCategory: appState.currentCategory,
        onSelectCategory: async (catId) => {
            appState.currentCategory = catId;
            if (appState.currentView !== 'catalog') {
                navigateToView('catalog');
            }
            await reloadProducts();
        },
    });

    rootWrapper.appendChild(categoryChipsComponent);

    // 4. Conteneur principal (Vues dynamiques)
    const mainContentEl = document.createElement('main');
    mainContentEl.id = 'main-content';
    mainContentEl.className = 'flex-1 max-w-7xl w-full mx-auto px-4 py-5 flex flex-col gap-6';
    rootWrapper.appendChild(mainContentEl);

    // 5. Footer
    const footerEl = document.createElement('footer');
    footerEl.className = 'bg-white border-t border-slate-200/80 py-8 px-4 text-center mt-auto';
    footerEl.innerHTML = `
        <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div class="flex items-center gap-2.5">
                <img src="${logoUrl}" alt="Campus Market" class="h-10 sm:h-12 w-auto object-contain" onerror="this.src='/assets/logo.webp'">
                <span class="font-heading font-bold text-slate-800">Campus Market</span>
                <span>• Université Iba Der Thiam (UIDT)</span>
            </div>
            <div class="flex items-center gap-4 text-slate-600 font-medium flex-wrap justify-center">
                <button id="footer-link-catalog" class="hover:text-primary transition-colors">Offres</button>
                <button id="footer-link-orders" class="hover:text-primary transition-colors">Mes commandes</button>
                <button id="footer-link-seller" class="hover:text-amber-700 text-amber-900 font-semibold transition-colors">Espace Vendeur</button>
                <a href="https://wa.me/221784799882" target="_blank" rel="noopener" class="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1">
                    <i class="fa-brands fa-whatsapp"></i> Aide & Support
                </a>
            </div>
            <p>© 2026 Campus Market. Livraison Pavillon-à-Pavillon.</p>
        </div>
    `;

    footerEl.querySelector('#footer-link-catalog')?.addEventListener('click', () => navigateToView('catalog'));
    footerEl.querySelector('#footer-link-orders')?.addEventListener('click', () => navigateToView('orders'));
    footerEl.querySelector('#footer-link-seller')?.addEventListener('click', async () => {
        if (appState.currentSeller) {
            navigateToView('seller');
        } else {
            const sellerSession = await getCurrentSeller();
            if (sellerSession && sellerSession.profile && (sellerSession.profile.role === 'vendeur' || sellerSession.profile.role === 'superadmin')) {
                appState.currentSeller = sellerSession.profile;
                try {
                    localStorage.setItem(LOCAL_SELLER_KEY, JSON.stringify(sellerSession.profile));
                } catch {}
                navigateToView('seller');
            } else {
                sellerAuthModalController.open('login');
            }
        }
    });

    rootWrapper.appendChild(footerEl);
    appEl.appendChild(rootWrapper);

    let activeDashboardEl = null;

    // Navigation de vue
    function navigateToView(viewName) {
        // Nettoyage du canal Realtime si on quitte l'espace vendeur
        if (appState.currentView === 'seller' && viewName !== 'seller' && activeDashboardEl?.cleanup) {
            activeDashboardEl.cleanup();
            activeDashboardEl = null;
        }

        appState.currentView = viewName;
        window.scrollTo({ top: 0, behavior: 'smooth' });

        const targetHash = viewName === 'catalog' ? '' : `#${viewName}`;
        if (window.location.hash !== targetHash) {
            history.replaceState(null, '', targetHash || window.location.pathname);
        }

        if (viewName === 'orders') {
            if (headerComponent.setMode) headerComponent.setMode('orders');
            categoryChipsComponent.classList.add('hidden');
            footerEl.classList.remove('hidden');
            renderOrdersView();
        } else if (viewName === 'seller') {
            if (headerComponent.setMode) headerComponent.setMode('hidden');
            categoryChipsComponent.classList.add('hidden');
            footerEl.classList.remove('hidden');
            renderSellerView();
        } else if (viewName === 'admin') {
            if (headerComponent.setMode) headerComponent.setMode('hidden');
            categoryChipsComponent.classList.add('hidden');
            footerEl.classList.add('hidden');
            renderAdminView();
        } else {
            if (headerComponent.setMode) headerComponent.setMode('catalog');
            categoryChipsComponent.classList.remove('hidden');
            footerEl.classList.remove('hidden');
            renderCatalogView();
        }
    }

    // Rendu de la vue Commandes acheteur
    function renderOrdersView() {
        mainContentEl.innerHTML = '';
        const orderView = createOrderStatusView({
            onBackToCatalog: () => navigateToView('catalog'),
            onShowToast: showToast,
        });
        mainContentEl.appendChild(orderView);
    }

    // Rendu de l'Espace Vendeur
    async function renderSellerView() {
        // 1. Si le profil n'est pas encore en mémoire, afficher un écran d'attente et vérifier Supabase
        if (!appState.currentSeller) {
            mainContentEl.innerHTML = `
                <div class="flex flex-col items-center justify-center py-24 gap-3 text-slate-500 animate-pulse">
                    <i class="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i>
                    <p class="text-xs font-semibold">Accès à votre Espace Vendeur...</p>
                </div>
            `;

            try {
                const sellerSession = await getCurrentSeller();
                if (sellerSession && sellerSession.profile && (sellerSession.profile.role === 'vendeur' || sellerSession.profile.role === 'superadmin')) {
                    appState.currentSeller = sellerSession.profile;
                    try {
                        localStorage.setItem(LOCAL_SELLER_KEY, JSON.stringify(sellerSession.profile));
                    } catch {}
                }
            } catch (err) {
                console.warn('[Main] Erreur getCurrentSeller lors du rendu vendeur:', err);
            }
        }

        // 2. Si aucune session n'est active, inviter à la connexion et retourner au catalogue
        if (!appState.currentSeller) {
            mainContentEl.innerHTML = '';
            sellerAuthModalController.open('login');
            navigateToView('catalog');
            return;
        }

        // 3. Montage du tableau de bord vendeur
        mainContentEl.innerHTML = '';
        activeDashboardEl = createSellerDashboard({
            seller: appState.currentSeller,
            onBackToCatalog: () => navigateToView('catalog'),
            onLogout: () => {
                appState.currentSeller = null;
                try {
                    localStorage.removeItem(LOCAL_SELLER_KEY);
                } catch {}
                showToast('Déconnecté de votre espace marchand.', 'info');
                navigateToView('catalog');
            },
            onShowToast: showToast,
        });

        mainContentEl.appendChild(activeDashboardEl);
    }

    // Rendu de l'Administration UIDT (accessible exclusivement via /#admin)
    function renderAdminView() {
        mainContentEl.innerHTML = '';
        const adminDashboard = createSuperAdminDashboard({
            onExit: () => {
                if (window.location.hash.toLowerCase() === '#admin') {
                    history.replaceState(null, '', window.location.pathname);
                }
                navigateToView('catalog');
            },
            onShowToast: showToast,
        });
        mainContentEl.appendChild(adminDashboard);
    }

    // Rendu du catalogue et Top Shops
    function renderCatalogView() {
        mainContentEl.innerHTML = '';

        // Section Top Shops (Vendeurs populaires certifiés)
        if (appState.topShops.length > 0 && !appState.searchQuery) {
            const topShopsSection = document.createElement('section');
            topShopsSection.className = 'flex flex-col gap-3';
            topShopsSection.innerHTML = `
                <div class="flex items-center justify-between">
                    <h2 class="font-heading font-extrabold text-base text-slate-900 flex items-center gap-1.5">
                        <i class="fa-solid fa-trophy text-accent text-sm"></i>
                        Top Shops du Campus
                    </h2>
                    <span class="text-xs text-slate-400 font-medium">Vendeurs certifiés</span>
                </div>
                <div class="flex items-center gap-3 overflow-x-auto scrollbar-none py-1" style="scrollbar-width: none;">
                    ${appState.topShops.map((shop) => `
                        <div class="flex-shrink-0 bg-white border border-slate-200/80 rounded-2xl p-3 flex items-center gap-3 shadow-sm hover:shadow transition-all min-w-[200px]">
                            <div class="w-11 h-11 rounded-full bg-primary/10 text-primary font-heading font-extrabold flex items-center justify-center text-sm">
                                ${((shop.prenom?.[0] || 'V') + (shop.nom?.[0] || '')).toUpperCase()}
                            </div>
                            <div class="flex flex-col min-w-0">
                                <span class="font-heading font-bold text-slate-900 text-xs truncate leading-tight">${escapeHTML(shop.prenom)} ${escapeHTML(shop.nom)}</span>
                                <div class="flex items-center gap-1 mt-1 text-[11px] text-amber-500 font-bold">
                                    <i class="fa-solid fa-star text-[10px]"></i>
                                    <span>${shop.avgRating || '5.0'}</span>
                                    <span class="text-slate-400 font-normal">(${shop.reviewCount || 1})</span>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            mainContentEl.appendChild(topShopsSection);
        }

        // Section Titre des offres
        const productsHeaderSection = document.createElement('div');
        productsHeaderSection.className = 'flex items-center justify-between pt-2';
        productsHeaderSection.innerHTML = `
            <div>
                <h1 class="font-heading font-extrabold text-xl sm:text-2xl text-slate-900">
                    ${appState.searchQuery ? `Résultats pour "${escapeHTML(appState.searchQuery)}"` : 'Offres disponibles'}
                </h1>
                <p class="text-xs text-slate-500 mt-0.5">
                    ${appState.isLoading ? 'Chargement des produits...' : `${appState.products.length} article${appState.products.length > 1 ? 's' : ''} trouvé${appState.products.length > 1 ? 's' : ''}`}
                </p>
            </div>
        `;
        mainContentEl.appendChild(productsHeaderSection);

        // État de chargement (Squelettes)
        if (appState.isLoading) {
            const skeletonGrid = document.createElement('div');
            skeletonGrid.id = 'catalog-loading-skeleton';
            skeletonGrid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4';
            skeletonGrid.innerHTML = Array(6).fill(0).map(() => `
                <div class="bg-white rounded-2xl border border-slate-200 p-3 flex flex-col gap-3 animate-pulse">
                    <div class="w-full aspect-square bg-slate-200 rounded-xl"></div>
                    <div class="h-3.5 bg-slate-200 rounded w-3/4"></div>
                    <div class="h-4 bg-slate-200 rounded w-1/2 mt-auto"></div>
                </div>
            `).join('');
            mainContentEl.appendChild(skeletonGrid);
            return;
        }

        // Empty state si aucun produit
        if (!appState.products || appState.products.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'flex flex-col items-center justify-center text-center py-16 px-4 bg-white rounded-2xl border border-dashed border-slate-300 my-4';
            emptyEl.innerHTML = `
                <div class="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center text-2xl mb-3">
                    <i class="fa-solid ${appState.searchQuery ? 'fa-magnifying-glass' : 'fa-wifi'}"></i>
                </div>
                <h3 class="font-heading font-bold text-slate-800 text-lg mb-1">
                    ${appState.searchQuery ? 'Aucun produit trouvé' : 'Aucun produit disponible pour le moment (mode hors-ligne)'}
                </h3>
                <p class="text-sm text-slate-500 max-w-sm mb-5">
                    ${appState.searchQuery 
                        ? `Aucun article ne correspond à votre recherche "${escapeHTML(appState.searchQuery)}". Essayez un autre mot-clé ou changez de catégorie.`
                        : `Aucune offre n'a pu être chargée depuis le réseau et le cache local est vide. Vérifiez votre connexion internet.`}
                </p>
                <button id="btn-reset-filters" class="px-5 py-2.5 bg-primary text-white hover:bg-primary-dark font-semibold text-xs rounded-full transition-all min-h-[44px]">
                    ${appState.searchQuery || appState.currentCategory !== 'all' ? 'Afficher toutes les offres' : 'Rafraîchir les offres'}
                </button>
            `;
            emptyEl.querySelector('#btn-reset-filters')?.addEventListener('click', async () => {
                appState.searchQuery = '';
                appState.currentCategory = 'all';
                if (categoryChipsComponent?.setActiveCategory) {
                    categoryChipsComponent.setActiveCategory('all');
                }
                const searchInput = document.getElementById('header-search-input');
                if (searchInput) searchInput.value = '';
                await reloadProducts();
            });
            mainContentEl.appendChild(emptyEl);
            return;
        }

        // Grille des cartes produits
        const gridEl = document.createElement('div');
        gridEl.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4';

        appState.products.forEach((product) => {
            const card = createProductCard({
                product,
                onAddToCart: (prod) => {
                    cartStore.addToCart(prod, 1);
                    showToast(`Ajouté au panier : ${prod.title}`, 'success');
                },
                onClickCard: (prod) => {
                    productDetailModalController.open(prod);
                },
            });
            gridEl.appendChild(card);
        });

        mainContentEl.appendChild(gridEl);
    }

    /**
     * Masque impérativement tout loader/squelette restant dans le DOM.
     */
    function hideLoading() {
        appState.isLoading = false;
        const skeleton = document.getElementById('catalog-loading-skeleton');
        if (skeleton) skeleton.remove();
    }

    // Chargement dynamique des données
    async function reloadProducts() {
        appState.isLoading = true;
        renderCatalogView();

        try {
            if (appState.searchQuery) {
                appState.products = await searchProducts(
                    appState.searchQuery,
                    appState.currentCategory
                );
            } else {
                appState.products = await fetchActiveProducts({
                    category: appState.currentCategory,
                });
            }
        } catch (err) {
            console.error('[Main] Erreur chargement produits:', err);
            appState.products = [];
        } finally {
            hideLoading();
            renderCatalogView();
        }
    }

    // Écoute des changements de fragment d'URL pour navigation directe
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.toLowerCase();
        if (hash === '#admin') navigateToView('admin');
        else if (hash === '#seller') navigateToView('seller');
        else if (hash === '#orders') navigateToView('orders');
        else if (hash === '' || hash === '#') navigateToView('catalog');
    });

    // Rendu immédiat selon le hash URL (ou affichage immédiat des squelettes de chargement)
    const initialHash = window.location.hash.toLowerCase();
    if (initialHash === '#admin') {
        navigateToView('admin');
    } else if (initialHash === '#seller') {
        navigateToView('seller');
    } else if (initialHash === '#orders') {
        navigateToView('orders');
    } else {
        navigateToView('catalog');
    }

    // Chargement asynchrone des offres & boutiques
    try {
        const [products, topShops] = await Promise.all([
            fetchActiveProducts({ category: 'all' }),
            fetchTopShops(),
        ]);
        appState.products = products || [];
        appState.topShops = topShops || [];
    } catch (err) {
        console.error('[Main] Erreur chargement initial:', err);
        appState.products = [];
        appState.topShops = [];
    } finally {
        hideLoading();
        if (appState.currentView === 'catalog') {
            renderCatalogView(); // Remplace les squelettes par les données réelles ou l'empty state
        }
    }
}

// Lancement au chargement du DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Enregistrement PWA Service Worker avec garde de sécurité stricte
if (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    (window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1')
) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js')
            .catch((err) => console.warn('[SW] Ignoré:', err.message));
    });
}
