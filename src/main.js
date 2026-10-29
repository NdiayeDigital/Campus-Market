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
import { createBottomNav } from './components/BottomNav.js';
import { createHeroBanner } from './components/HeroBanner.js';
import { createSellerAuthModal } from './components/seller/SellerAuthModal.js';
import { createForcePasswordChangeModal } from './components/seller/ForcePasswordChangeModal.js';
import { createSellerShowcase } from './components/seller/SellerShowcase.js';
import { getCurrentSeller, confirmSubscriptionPayment } from './services/seller-service.js';
import { supabase } from './services/supabase.js';
import { cartStore } from './services/cart-store.js';
import {
    fetchActiveProducts,
    fetchProductById,
    searchProducts,
    fetchTopShops,
} from './services/catalog-service.js';
import { escapeHTML } from './utils/security.js';
import { showToast } from './utils/notifications.js';
import { SUPPORT_CONFIG } from './config/support.js';
import { updateSEO, setCatalogSEO, setOrdersSEO, setSellerSEO, resetDefaultSEO } from './utils/seo.js';
import { resolveRoute } from './utils/router.js';
import { initPwaInstallPrompt } from './utils/pwa-install.js';
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

    let headerComponent = null;
    let categoryChipsComponent = null;
    let bottomNavComponent = null;

    // Validation asynchrone continue de la session auprès de Supabase sans déconnexion intempestive
    getCurrentSeller()
        .then((existingSeller) => {
            if (existingSeller && existingSeller.profile && (existingSeller.profile.role === 'vendeur' || existingSeller.profile.role === 'superadmin')) {
                appState.currentSeller = existingSeller.profile;
                headerComponent?.updateSellerState?.(existingSeller.profile);
                bottomNavComponent?.setSeller?.(existingSeller.profile);
                try {
                    localStorage.setItem(LOCAL_SELLER_KEY, JSON.stringify(existingSeller.profile));
                } catch {}
            }
        })
        .catch((err) => {
            console.warn('[Main] Session vendeur non bloquante:', err);
        });

    // Écouteur réactif des événements d'authentification Supabase (évite toute déconnexion intempestive)
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            appState.currentSeller = null;
            headerComponent?.updateSellerState?.(null);
            bottomNavComponent?.setSeller?.(null);
            try {
                localStorage.removeItem(LOCAL_SELLER_KEY);
            } catch {}
            if (appState.currentView === 'seller') {
                navigateToView('catalog');
                showToast('Déconnecté de votre espace marchand.', 'info');
            }
        } else if (session?.user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED')) {
            getCurrentSeller().then((res) => {
                if (res?.profile) {
                    appState.currentSeller = res.profile;
                    headerComponent?.updateSellerState?.(res.profile);
                    bottomNavComponent?.setSeller?.(res.profile);
                    try {
                        localStorage.setItem(LOCAL_SELLER_KEY, JSON.stringify(res.profile));
                    } catch {}
                }
            }).catch(() => {});
        }
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

    const forcePasswordChangeModalController = createForcePasswordChangeModal({
        onSuccess: ({ profile }) => {
            if (profile) {
                profile.must_change_password = false;
                appState.currentSeller = profile;
                headerComponent?.updateSellerState?.(profile);
                bottomNavComponent?.setSeller?.(profile);
                try {
                    localStorage.setItem(LOCAL_SELLER_KEY, JSON.stringify(profile));
                } catch {}
            }
            showToast('Votre mot de passe a été mis à jour avec succès ! 🔒', 'success');
            navigateToView('seller');
        },
        onLogout: () => {
            appState.currentSeller = null;
            headerComponent?.updateSellerState?.(null);
            bottomNavComponent?.setSeller?.(null);
            try {
                localStorage.removeItem(LOCAL_SELLER_KEY);
            } catch {}
            if (appState.currentView === 'seller') {
                navigateToView('catalog');
            }
        },
    });

    const sellerAuthModalController = createSellerAuthModal({
        onAuthenticated: ({ profile, mustChangePassword }) => {
            appState.currentSeller = profile;
            headerComponent?.updateSellerState?.(profile);
            bottomNavComponent?.setSeller?.(profile);
            try {
                localStorage.setItem(LOCAL_SELLER_KEY, JSON.stringify(profile));
            } catch {}

            if (mustChangePassword || profile?.must_change_password === true) {
                forcePasswordChangeModalController.open(profile);
                return;
            }

            showToast(`Bienvenue dans votre Espace Vendeur, ${profile.prenom} !`, 'success');
            navigateToView('seller');
        },
    });

    const productDetailModalController = createProductDetailModal({
        onAddToCart: (product, qty = 1) => {
            cartStore.addToCart(product, qty);
            showToast(`Ajouté au panier : ${product.title} (x${qty})`, 'success');
        },
        onOpenSeller: (seller) => {
            if (seller?.id) {
                navigateToView('shop', { sellerId: seller.id });
            }
        },
        onClose: () => {
            if (window.location.hash.toLowerCase().startsWith('#product/')) {
                history.replaceState(null, '', window.location.pathname + window.location.search);
            }
        },
    });

    document.body.appendChild(cartModalController.element);
    document.body.appendChild(checkoutModalController.element);
    document.body.appendChild(sellerAuthModalController.element);
    document.body.appendChild(forcePasswordChangeModalController.element);
    document.body.appendChild(productDetailModalController.element);

    // 2. Header
    headerComponent = createHeader({
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
        onOpenCatalog: async () => {
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
        onOpenSeller: () => {
            openSellerFlow();
        },
    });

    rootWrapper.appendChild(headerComponent);
    headerComponent.updateSellerState?.(appState.currentSeller);

    // 3. Barre de sélection de catégorie (Chips)
    categoryChipsComponent = createCategoryChips({
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

    // 4. Hero Banner (Accueil & Découverte UIDT)
    const heroBannerComponent = createHeroBanner({
        onSelectTag: async (tagQuery) => {
            appState.searchQuery = tagQuery;
            const searchInput = document.getElementById('header-search-input');
            if (searchInput) searchInput.value = tagQuery;
            if (appState.currentView !== 'catalog') {
                navigateToView('catalog');
            }
            await reloadProducts();
        },
    });

    // 5. Conteneur principal (Vues dynamiques - Plein écran fluide)
    const mainContentEl = document.createElement('main');
    mainContentEl.id = 'main-content';
    mainContentEl.className = 'flex-1 w-full lg:ml-64 lg:w-[calc(100%-16rem)] px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-5 pb-safe-content sm:pb-8 flex flex-col gap-6 view-transition-enter';
    rootWrapper.appendChild(mainContentEl);

    // 6. Barre de navigation mobile inférieure (BottomNav) & Sidebar Desktop
    bottomNavComponent = createBottomNav({
        activeTab: appState.currentView,
        onNavigate: (viewName) => {
            if (viewName === 'catalog') {
                appState.searchQuery = '';
                appState.currentCategory = 'all';
                categoryChipsComponent?.setActiveCategory('all');
                const searchInput = document.getElementById('header-search-input');
                if (searchInput) searchInput.value = '';
                if (appState.currentView !== 'catalog') {
                    navigateToView('catalog');
                }
                reloadProducts();
            } else if (viewName === 'seller') {
                openSellerFlow();
            } else {
                navigateToView(viewName);
            }
        },
        onOpenCart: () => {
            cartModalController.open();
        },
        onFocusSearch: () => {
            if (appState.currentView !== 'catalog') {
                navigateToView('catalog');
            }
            headerComponent.focusSearch?.();
        },
    });
    rootWrapper.appendChild(bottomNavComponent);

    // 7. Footer (Plein écran fluide aligné avec la sidebar)
    const footerEl = document.createElement('footer');
    footerEl.className = 'bg-white border-t border-slate-200/80 py-8 px-4 sm:px-6 lg:px-8 xl:px-10 text-center mt-auto pb-safe-content sm:pb-8 lg:ml-64 lg:w-[calc(100%-16rem)] w-full';
    footerEl.innerHTML = `
        <div class="w-full flex flex-col sm:flex-row items-center justify-between gap-5 text-xs text-slate-500">
            <!-- Marque & Identité UIDT -->
            <div class="flex flex-col sm:flex-row items-center gap-3">
                <img src="${logoUrl}" alt="Campus Market — Marketplace des Étudiants de l'UIDT Thiès" class="h-10 sm:h-12 w-auto max-w-[200px] object-contain" onerror="this.src='/assets/logo.webp'">
                <div class="text-left hidden sm:block">
                    <span class="text-[11px] text-slate-400 block font-medium">Université Iba Der Thiam de Thiès</span>
                </div>
            </div>

            <!-- Liens de navigation Desktop & Tablette (masqués sur mobile car déjà dans BottomNav) -->
            <div class="hidden sm:flex items-center gap-5 text-slate-600 font-medium flex-wrap justify-center">
                <button id="footer-link-catalog" class="hover:text-primary transition-colors">Offres</button>
                <button id="footer-link-orders" class="hover:text-primary transition-colors">Mes commandes</button>
                <button id="footer-link-seller" class="hover:text-amber-700 text-amber-900 font-semibold transition-colors">Espace Vendeur</button>
                <a href="${SUPPORT_CONFIG.whatsappUrl}" target="_blank" rel="noopener" class="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1">
                    <i class="fa-brands fa-whatsapp text-sm"></i> Aide & Support (${SUPPORT_CONFIG.phoneDisplay})
                </a>
            </div>

            <!-- Bouton Support WhatsApp Mobile (visible uniquement sur smartphone au lieu des liens doublons) -->
            <div class="flex sm:hidden items-center justify-center w-full">
                <a href="${SUPPORT_CONFIG.whatsappUrl}" target="_blank" rel="noopener" class="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 rounded-full font-bold text-xs transition-all shadow-sm active:scale-95 min-h-[44px]">
                    <i class="fa-brands fa-whatsapp text-base"></i>
                    <span>Besoin d'aide ? Support WhatsApp (${SUPPORT_CONFIG.phoneDisplay})</span>
                </a>
            </div>

            <p class="text-[11px] text-slate-400">© 2026 Campus Market. Livraison Pavillon-à-Pavillon.</p>
        </div>
    `;

    footerEl.querySelector('#footer-link-catalog')?.addEventListener('click', () => navigateToView('catalog'));
    footerEl.querySelector('#footer-link-orders')?.addEventListener('click', () => navigateToView('orders'));
    footerEl.querySelector('#footer-link-seller')?.addEventListener('click', openSellerFlow);

    rootWrapper.appendChild(footerEl);
    appEl.appendChild(rootWrapper);

    let activeDashboardEl = null;

    async function openSellerFlow() {
        if (appState.currentSeller) {
            if (appState.currentSeller.must_change_password) {
                forcePasswordChangeModalController.open(appState.currentSeller);
                return;
            }
            navigateToView('seller');
            return;
        }
        const sellerSession = await getCurrentSeller();
        if (sellerSession && sellerSession.profile && (sellerSession.profile.role === 'vendeur' || sellerSession.profile.role === 'superadmin')) {
            appState.currentSeller = sellerSession.profile;
            try {
                localStorage.setItem(LOCAL_SELLER_KEY, JSON.stringify(sellerSession.profile));
            } catch {}
            if (sellerSession.profile.must_change_password) {
                forcePasswordChangeModalController.open(sellerSession.profile);
                return;
            }
            navigateToView('seller');
        } else {
            sellerAuthModalController.open('login');
        }
    }

    // Navigation de vue
    function navigateToView(viewName, params = {}) {
        // Nettoyage du canal Realtime si on quitte l'espace vendeur
        if (appState.currentView === 'seller' && viewName !== 'seller' && activeDashboardEl?.cleanup) {
            activeDashboardEl.cleanup();
            activeDashboardEl = null;
        }

        appState.currentView = viewName;
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Animation fluide de changement de vue (sauf seller et admin qui gèrent leurs propres barres et sidebars fixes)
        if (viewName !== 'seller' && viewName !== 'admin') {
            mainContentEl.classList.remove('view-transition-enter');
            void mainContentEl.offsetWidth;
            mainContentEl.classList.add('view-transition-enter');
        } else {
            mainContentEl.classList.remove('view-transition-enter');
        }

        if (bottomNavComponent) {
            bottomNavComponent.setActiveTab(viewName === 'shop' ? 'catalog' : viewName);
            bottomNavComponent.setHidden(viewName === 'admin' || viewName === 'seller');
        }

        let targetHash = viewName === 'catalog' ? '' : `#${viewName}`;
        if (viewName === 'shop' && params.sellerId) {
            targetHash = `#shop/${params.sellerId}`;
        }
        if (window.location.hash !== targetHash) {
            history.replaceState(null, '', targetHash || window.location.pathname);
        }

        if (viewName === 'orders') {
            mainContentEl.className = 'flex-1 w-full lg:ml-64 lg:w-[calc(100%-16rem)] px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-5 pb-safe-content sm:pb-8 flex flex-col gap-6 view-transition-enter';
            if (headerComponent.setMode) headerComponent.setMode('orders');
            categoryChipsComponent.classList.add('hidden');
            footerEl.classList.remove('hidden');
            if (bottomNavComponent) bottomNavComponent.setHidden(false);
            setOrdersSEO();
            renderOrdersView();
        } else if (viewName === 'seller') {
            mainContentEl.className = 'flex-1 w-full p-0 m-0 pb-0 flex flex-col';
            if (headerComponent.setMode) headerComponent.setMode('hidden');
            categoryChipsComponent.classList.add('hidden');
            footerEl.classList.add('hidden');
            if (bottomNavComponent) bottomNavComponent.setHidden(true);
            setSellerSEO();
            renderSellerView();
        } else if (viewName === 'admin') {
            mainContentEl.className = 'flex-1 w-full p-0 m-0 pb-0 flex flex-col';
            if (headerComponent.setMode) headerComponent.setMode('hidden');
            categoryChipsComponent.classList.add('hidden');
            footerEl.classList.add('hidden');
            if (bottomNavComponent) bottomNavComponent.setHidden(true);
            updateSEO({ title: 'Administration — Campus Market UIDT' });
            renderAdminView();
        } else if (viewName === 'shop') {
            mainContentEl.className = 'flex-1 w-full lg:ml-64 lg:w-[calc(100%-16rem)] px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-5 pb-safe-content sm:pb-8 flex flex-col gap-6 view-transition-enter';
            if (headerComponent.setMode) headerComponent.setMode('catalog');
            categoryChipsComponent.classList.add('hidden');
            footerEl.classList.remove('hidden');
            if (bottomNavComponent) bottomNavComponent.setHidden(false);
            renderShopView(params.sellerId);
        } else {
            mainContentEl.className = 'flex-1 w-full lg:ml-64 lg:w-[calc(100%-16rem)] px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-5 pb-safe-content sm:pb-8 flex flex-col gap-6 view-transition-enter';
            if (headerComponent.setMode) headerComponent.setMode('catalog');
            categoryChipsComponent.classList.remove('hidden');
            footerEl.classList.remove('hidden');
            if (bottomNavComponent) bottomNavComponent.setHidden(false);
            setCatalogSEO(appState.currentCategory, appState.searchQuery);
            renderCatalogView();
        }
    }

    // Rendu de la vitrine marchand publique
    function renderShopView(sellerId) {
        mainContentEl.innerHTML = '';
        const showcaseEl = createSellerShowcase({
            sellerId,
            onBackToCatalog: () => navigateToView('catalog'),
            onAddToCart: (product, qty = 1) => {
                cartStore.addToCart(product, qty);
                showToast(`Ajouté au panier : ${product.title} (x${qty})`, 'success');
            },
            onClickProduct: (product) => {
                productDetailModalController.open(product);
            },
            onShowToast: showToast,
        });
        mainContentEl.appendChild(showcaseEl);
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
        // 1. Si le profil n'est pas encore en mémoire, afficher un écran d'attente
        if (!appState.currentSeller) {
            mainContentEl.innerHTML = `
                <div class="flex flex-col items-center justify-center py-24 gap-3 text-slate-500 animate-pulse">
                    <i class="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i>
                    <p class="text-xs font-semibold">Accès à votre Espace Vendeur...</p>
                </div>
            `;
        }

        try {
            const sellerSession = await getCurrentSeller();
            if (sellerSession && sellerSession.profile && (sellerSession.profile.role === 'vendeur' || sellerSession.profile.role === 'superadmin')) {
                appState.currentSeller = sellerSession.profile;
                headerComponent?.updateSellerState?.(sellerSession.profile);
                try {
                    localStorage.setItem(LOCAL_SELLER_KEY, JSON.stringify(sellerSession.profile));
                } catch {}
            } else if (!sellerSession) {
                // Session Supabase absente ou révoquée
                appState.currentSeller = null;
                headerComponent?.updateSellerState?.(null);
                try {
                    localStorage.removeItem(LOCAL_SELLER_KEY);
                } catch {}
            }
        } catch (err) {
            console.warn('[Main] Erreur getCurrentSeller lors du rendu vendeur:', err);
        }

        // 2. Si aucune session n'est active, inviter à la connexion et retourner au catalogue
        if (!appState.currentSeller) {
            mainContentEl.innerHTML = '';
            sellerAuthModalController.open('login');
            navigateToView('catalog');
            return;
        }

        // Si le mot de passe doit obligatoirement être changé, bloquer l'accès au tableau de bord
        if (appState.currentSeller.must_change_password) {
            mainContentEl.innerHTML = '';
            forcePasswordChangeModalController.open(appState.currentSeller);
            navigateToView('catalog');
            return;
        }

        // 3. Montage du tableau de bord vendeur
        mainContentEl.innerHTML = `
            <div class="flex flex-col items-center justify-center py-24 gap-3 text-slate-500 animate-pulse">
                <i class="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i>
                <p class="text-xs font-semibold">Chargement de votre Espace Vendeur...</p>
            </div>
        `;
        const { createSellerDashboard } = await import('./components/seller/SellerDashboard.js');
        mainContentEl.innerHTML = '';
        activeDashboardEl = createSellerDashboard({
            seller: appState.currentSeller,
            onBackToCatalog: () => navigateToView('catalog'),
            onOpenAdminDashboard: () => {
                navigateToView('admin');
            },
            onLogout: () => {
                appState.currentSeller = null;
                headerComponent?.updateSellerState?.(null);
                bottomNavComponent?.setSeller?.(null);
                try {
                    localStorage.removeItem(LOCAL_SELLER_KEY);
                } catch {}
                if (appState.currentView === 'seller') {
                    navigateToView('catalog');
                }
            },
            onShowToast: showToast,
        });

        mainContentEl.appendChild(activeDashboardEl);
    }

    // Rendu de l'Administration UIDT (accessible exclusivement via /#admin)
    async function renderAdminView() {
        mainContentEl.innerHTML = `
            <div class="flex flex-col items-center justify-center py-24 gap-3 text-slate-500 animate-pulse">
                <i class="fa-solid fa-shield-halved fa-spin text-3xl text-primary"></i>
                <p class="text-xs font-semibold">Accès sécurisé au Portail SuperAdmin...</p>
            </div>
        `;
        const { createSuperAdminDashboard } = await import('./components/admin/SuperAdminDashboard.js');
        mainContentEl.innerHTML = '';
        const adminDashboard = createSuperAdminDashboard({
            admin: appState.currentSeller?.role === 'superadmin' ? appState.currentSeller : null,
            onExit: () => {
                if (window.location.hash.toLowerCase() === '#admin') {
                    history.replaceState(null, '', window.location.pathname);
                }
                navigateToView('catalog');
            },
            onBackToCatalog: () => {
                navigateToView('catalog');
            },
            onOpenSellerDashboard: async (adminSellerProfile) => {
                if (adminSellerProfile) {
                    appState.currentSeller = adminSellerProfile;
                    headerComponent?.updateSellerState?.(adminSellerProfile);
                    bottomNavComponent?.setSeller?.(adminSellerProfile);
                    try {
                        localStorage.setItem(LOCAL_SELLER_KEY, JSON.stringify(adminSellerProfile));
                    } catch {}
                }
                navigateToView('seller');
            },
            onShowToast: showToast,
        });
        mainContentEl.appendChild(adminDashboard);
    }

    // Rendu du catalogue et Top Shops
    function renderCatalogView() {
        mainContentEl.innerHTML = '';

        // 1. Bannière d'accueil & Découverte UIDT (affichée en mode accueil sans recherche active)
        if (!appState.searchQuery && appState.currentCategory === 'all') {
            mainContentEl.appendChild(heroBannerComponent);
        }

        // 2. Section Top Shops (Vendeurs populaires certifiés)
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
                <div class="flex items-center gap-3 overflow-x-auto no-scrollbar py-1" style="scrollbar-width: none;">
                    ${appState.topShops.map((shop) => {
                        const displayName = shop.shop_name || `${shop.prenom || ''} ${shop.nom || ''}`.trim() || 'Boutique UIDT';
                        const sellerFullName = `${shop.prenom || ''} ${shop.nom || ''}`.trim();
                        const initial = ((shop.shop_name?.[0] || shop.prenom?.[0] || 'V') + (shop.nom?.[0] || '')).toUpperCase();
                        const ratingDisplay = shop.avgRating > 0 ? shop.avgRating.toFixed(1) : '5.0';
                        const reviewsDisplay = shop.reviewCount > 0 ? `${shop.reviewCount} avis` : 'Nouveau';

                        return `
                        <div 
                            data-shop-id="${shop.id}" 
                            title="Visiter ${escapeHTML(displayName)}"
                            class="flex-shrink-0 bg-white border border-slate-200/80 hover:border-primary/50 rounded-2xl p-3 flex items-center gap-3 shadow-card hover:shadow-card-hover transition-all min-w-[210px] cursor-pointer active:scale-95 group"
                        >
                            <div class="w-11 h-11 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white font-heading font-extrabold flex items-center justify-center text-sm shadow-sm transition-colors shrink-0">
                                ${initial}
                            </div>
                            <div class="flex flex-col min-w-0 flex-1">
                                <span class="font-heading font-bold text-slate-900 group-hover:text-primary transition-colors text-xs truncate leading-tight">
                                    ${escapeHTML(displayName)}
                                </span>
                                <span class="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                                    ${escapeHTML(sellerFullName || 'Vendeur certifié')}
                                </span>
                                <div class="flex items-center gap-1.5 mt-1 text-[11px] text-amber-500 font-bold">
                                    <div class="flex items-center gap-1">
                                        <i class="fa-solid fa-star text-[10px]"></i>
                                        <span>${ratingDisplay}</span>
                                    </div>
                                    <span class="text-slate-400 font-normal text-[10px]">(${reviewsDisplay})</span>
                                    ${shop.deliveredOrders > 0 ? `
                                        <span class="text-slate-300">•</span>
                                        <span class="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5" title="${shop.deliveredOrders} commande(s) livrée(s)">
                                            <i class="fa-solid fa-truck-fast text-[9px]"></i>
                                            ${shop.deliveredOrders}
                                        </span>
                                    ` : (shop.activeProducts > 0 ? `
                                        <span class="text-slate-300">•</span>
                                        <span class="text-[10px] text-slate-500 font-medium" title="${shop.activeProducts} article(s) disponible(s)">
                                            ${shop.activeProducts} art.
                                        </span>
                                    ` : '')}
                                </div>
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            `;

            topShopsSection.querySelectorAll('[data-shop-id]').forEach((shopCard) => {
                shopCard.addEventListener('click', () => {
                    const id = shopCard.dataset.shopId;
                    if (id) navigateToView('shop', { sellerId: id });
                });
            });

            mainContentEl.appendChild(topShopsSection);
        }

        // 3. Section Titre des offres
        const productsHeaderSection = document.createElement('div');
        productsHeaderSection.className = 'flex items-center justify-between pt-1';
        productsHeaderSection.innerHTML = `
            <div>
                <h2 class="font-heading font-extrabold text-xl sm:text-2xl text-slate-900">
                    ${appState.searchQuery ? `Résultats pour "${escapeHTML(appState.searchQuery)}"` : 'Offres disponibles'}
                </h2>
                <p class="text-xs text-slate-500 mt-0.5">
                    ${appState.isLoading ? 'Recherche des offres...' : `${appState.products.length} article${appState.products.length > 1 ? 's' : ''} disponible${appState.products.length > 1 ? 's' : ''}`}
                </p>
            </div>
        `;
        mainContentEl.appendChild(productsHeaderSection);

        // État de chargement (Squelettes Shimmer modernes)
        if (appState.isLoading) {
            const skeletonGrid = document.createElement('div');
            skeletonGrid.id = 'catalog-loading-skeleton';
            skeletonGrid.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 w-full';
            skeletonGrid.innerHTML = Array(12).fill(0).map(() => `
                <div class="bg-white rounded-3xl border border-slate-200/70 p-3.5 flex flex-col gap-3 shadow-card overflow-hidden">
                    <div class="w-full aspect-square shimmer-placeholder rounded-2xl"></div>
                    <div class="h-3.5 shimmer-placeholder rounded-md w-3/4"></div>
                    <div class="h-4 shimmer-placeholder rounded-md w-1/2 mt-auto"></div>
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

        // Grille des cartes produits (Plein écran fluide)
        const gridEl = document.createElement('div');
        gridEl.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 sm:gap-4 w-full';

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
                onOpenSeller: (seller) => {
                    if (seller?.id) {
                        navigateToView('shop', { sellerId: seller.id });
                    }
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

    function updateCategoryCounters(items) {
        if (!items || !categoryChipsComponent?.setCategoryCounts) return;
        const counts = { all: items.length };
        items.forEach((p) => {
            if (p.category) counts[p.category] = (counts[p.category] || 0) + 1;
        });
        categoryChipsComponent.setCategoryCounts(counts);
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
                const fetched = await fetchActiveProducts({
                    category: appState.currentCategory,
                });
                if (fetched && fetched.length > 0) {
                    appState.products = fetched;
                } else if (!appState.products || appState.products.length === 0) {
                    appState.products = [];
                }
            }
        } catch (err) {
            console.error('[Main] Erreur chargement produits:', err);
        } finally {
            hideLoading();
            renderCatalogView();
            updateCategoryCounters(appState.products);
            if (appState.currentView === 'catalog') {
                setCatalogSEO(appState.currentCategory, appState.searchQuery);
            }
        }
    }

    // Gestion du deep-linking vers un produit spécifique
    async function handleProductDeepLink(productId) {
        if (!productId) return;
        let prod = appState.products.find((p) => String(p.id) === String(productId));
        if (!prod) {
            prod = await fetchProductById(productId);
        }
        if (prod) {
            productDetailModalController.open(prod);
        } else {
            showToast('Article introuvable ou plus disponible.', 'warning');
        }
    }

    // Détection du retour de paiement SasPay (?payment=success&session_id=... ou #seller?payment=success&session_id=...)
    async function checkPaymentReturnFlow() {
        const urlParams = new URLSearchParams(window.location.search);
        let payment = urlParams.get('payment');
        let sessionId = urlParams.get('session_id');

        const rawHash = window.location.hash || '';
        const qIndex = rawHash.indexOf('?');
        if (qIndex !== -1) {
            const hashParams = new URLSearchParams(rawHash.slice(qIndex + 1));
            if (!payment) payment = hashParams.get('payment');
            if (!sessionId) sessionId = hashParams.get('session_id');
        }

        if (payment === 'success' && sessionId) {
            showToast('⏳ Vérification du paiement de votre abonnement auprès de SasPay...', 'info');
            try {
                const res = await confirmSubscriptionPayment({ sessionId });
                if (res?.success) {
                    showToast('🎉 Félicitations ! Votre abonnement 30 jours est validé et actif !', 'success');
                    if (res.profile) {
                        appState.currentSeller = res.profile;
                        headerComponent?.updateSellerState?.(res.profile);
                        bottomNavComponent?.setSeller?.(res.profile);
                        try {
                            localStorage.setItem(LOCAL_SELLER_KEY, JSON.stringify(res.profile));
                        } catch {}
                    }
                }
            } catch (err) {
                console.warn('[PaymentReturn] Vérification automatique:', err);
                showToast(`Paiement en attente de validation: ${err.message}`, 'warning');
            } finally {
                const cleanHash = rawHash.startsWith('#seller') ? '#seller' : (rawHash.split('?')[0] || '');
                history.replaceState(null, '', cleanHash || window.location.pathname);
            }
        } else if (payment === 'cancelled') {
            showToast('Paiement annulé. Vous pouvez réessayer quand vous le souhaitez.', 'info');
            const cleanHash = rawHash.startsWith('#seller') ? '#seller' : (rawHash.split('?')[0] || '');
            history.replaceState(null, '', cleanHash || window.location.pathname);
        }
    }

    // Gestion unifiée de la navigation selon l'URL (hash & paramètres de requête)
    function handleCurrentRoute() {
        const route = resolveRoute(window.location.hash, window.location.search);
        if (route.view === 'seller') {
            checkPaymentReturnFlow();
            navigateToView('seller');
        } else if (route.view === 'product') {
            if (appState.currentView !== 'catalog') {
                navigateToView('catalog');
            }
            handleProductDeepLink(route.params.productId);
        } else {
            navigateToView(route.view, route.params);
        }
    }

    // Écoute des changements de fragment d'URL pour navigation directe
    window.addEventListener('hashchange', () => {
        handleCurrentRoute();
    });

    // Rendu immédiat selon l'URL courante
    checkPaymentReturnFlow();
    handleCurrentRoute();

    // Chargement asynchrone progressif des offres & boutiques (découplé pour résilience mobile)
    try {
        const products = await fetchActiveProducts({ category: 'all' });
        if (products && products.length > 0) {
            appState.products = products;
            updateCategoryCounters(appState.products);
            hideLoading();
            if (appState.currentView === 'catalog') {
                renderCatalogView();
            }
        }
    } catch (err) {
        console.warn('[Main] Erreur chargement initial produits:', err);
    }

    try {
        const topShops = await fetchTopShops(appState.products);
        if (topShops && topShops.length > 0) {
            appState.topShops = topShops;
            if (appState.currentView === 'catalog') {
                renderCatalogView();
            }
        }
    } catch (err) {
        console.warn('[Main] Erreur chargement Top Shops:', err);
    } finally {
        hideLoading();
        if (appState.currentView === 'catalog') {
            renderCatalogView();
        }
    }
}

// Lancement au chargement du DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Enregistrement PWA Service Worker et invite d'installation
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
        
        initPwaInstallPrompt();
    });
}
