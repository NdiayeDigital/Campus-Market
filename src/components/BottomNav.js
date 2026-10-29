/**
 * Composant BottomNav / AppNavigation
 * - Sur Mobile (< 1024px) : Barre inférieure fixe, toujours visible (ne disparaît jamais).
 * - Sur Desktop (≥ 1024px) : Sidebar verticale collée tout à gauche de l'écran (w-64 h-screen).
 */

import { subscribeCart } from '../services/cart-store.js';
import { SUPPORT_CONFIG } from '../config/support.js';
import logoUrl from '../assets/logo.webp';

/**
 * Crée la navigation multi-format (BottomNav mobile fixe + Sidebar desktop collée à gauche).
 * @param {Object} props
 * @param {string} [props.activeTab='catalog'] - Onglet initial ('catalog' | 'orders' | 'seller')
 * @param {Function} props.onNavigate - Callback de changement de vue ('catalog' | 'orders' | 'seller')
 * @param {Function} props.onOpenCart - Callback d'ouverture du panier
 * @param {Function} props.onFocusSearch - Callback pour focaliser la recherche
 * @returns {HTMLElement}
 */
export function createBottomNav({
    activeTab = 'catalog',
    onNavigate,
    onOpenCart,
    onFocusSearch,
} = {}) {
    const navContainer = document.createElement('div');
    navContainer.id = 'app-navigation-container';

    let currentTab = activeTab;
    let latestCartCount = 0;
    let cachedSeller = null;

    function render() {
        navContainer.innerHTML = `
            <!-- 1. NAVIGATION MOBILE : Barre inférieure FIXE en bas et TOUJOURS visible (lg:hidden) -->
            <nav 
                id="mobile-bottom-nav" 
                aria-label="Navigation mobile"
                class="lg:hidden fixed bottom-0 inset-x-0 z-50 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200/80 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.08)] select-none mobile-nav-fixed transition-transform duration-200"
            >
                <div class="w-full px-2 py-1.5 flex items-center justify-around max-w-md mx-auto">
                    <!-- Onglet 1 : Offres / Accueil -->
                    <button 
                        type="button" 
                        id="bnav-tab-catalog" 
                        class="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-h-[48px] min-w-[56px] active:scale-95 cursor-pointer ${
                            currentTab === 'catalog' 
                                ? 'text-primary font-bold' 
                                : 'text-slate-500 hover:text-slate-800 font-medium'
                        }"
                    >
                        ${currentTab === 'catalog' ? '<span class="absolute top-0 w-8 h-1 bg-primary rounded-full"></span>' : ''}
                        <i class="fa-solid fa-store text-lg mb-0.5"></i>
                        <span class="text-[10px] leading-tight">Offres</span>
                    </button>

                    <!-- Onglet 2 : Recherche rapide -->
                    <button 
                        type="button" 
                        id="bnav-tab-search" 
                        class="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-500 hover:text-slate-800 font-medium transition-all duration-200 min-h-[48px] min-w-[56px] active:scale-95 cursor-pointer"
                    >
                        <i class="fa-solid fa-magnifying-glass text-lg mb-0.5"></i>
                        <span class="text-[10px] leading-tight">Recherche</span>
                    </button>

                    <!-- Onglet 3 : Panier tactile central avec badge dynamique -->
                    <button 
                        type="button" 
                        id="bnav-tab-cart" 
                        class="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-700 hover:text-primary transition-all duration-200 min-h-[48px] min-w-[56px] active:scale-95 cursor-pointer"
                    >
                        <div class="relative">
                            <i class="fa-solid fa-bag-shopping text-xl mb-0.5"></i>
                            <span id="bnav-cart-badge" class="${latestCartCount > 0 ? '' : 'hidden'} absolute -top-1.5 -right-2.5 bg-accent text-slate-900 font-extrabold text-[10px] px-1.5 py-0.2 rounded-full border-2 border-white shadow-sm min-w-[18px] text-center transform scale-100 transition-transform">
                                ${latestCartCount > 99 ? '99+' : latestCartCount}
                            </span>
                        </div>
                        <span class="text-[10px] font-bold leading-tight">Panier</span>
                    </button>

                    <!-- Onglet 4 : Mes Commandes -->
                    <button 
                        type="button" 
                        id="bnav-tab-orders" 
                        class="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-h-[48px] min-w-[56px] active:scale-95 cursor-pointer ${
                            currentTab === 'orders' 
                                ? 'text-primary font-bold' 
                                : 'text-slate-500 hover:text-slate-800 font-medium'
                        }"
                    >
                        ${currentTab === 'orders' ? '<span class="absolute top-0 w-8 h-1 bg-primary rounded-full"></span>' : ''}
                        <i class="fa-solid fa-box text-lg mb-0.5"></i>
                        <span class="text-[10px] leading-tight">Commandes</span>
                    </button>

                    <!-- Onglet 5 : Espace Vendeur -->
                    <button 
                        type="button" 
                        id="bnav-tab-seller" 
                        class="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-h-[48px] min-w-[56px] active:scale-95 cursor-pointer ${
                            currentTab === 'seller' 
                                ? 'text-amber-800 font-bold' 
                                : 'text-amber-700 hover:text-amber-900 font-medium'
                        }"
                    >
                        ${currentTab === 'seller' ? '<span class="absolute top-0 w-8 h-1 bg-amber-600 rounded-full"></span>' : ''}
                        <i class="fa-solid fa-shop text-lg mb-0.5"></i>
                        <span class="text-[10px] leading-tight">Vendeur</span>
                    </button>
                </div>
            </nav>

            <!-- 2. NAVIGATION DESKTOP : Sidebar collée TOUT À GAUCHE de l'écran (hidden lg:flex) -->
            <aside 
                id="desktop-sidebar-nav" 
                aria-label="Navigation latérale desktop"
                class="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 h-screen bg-white border-r border-slate-200/80 z-40 flex-col justify-between p-5 select-none shadow-xs"
            >
                <!-- Haut : Logo officiel UIDT & Marque -->
                <div class="flex flex-col gap-6">
                    <div class="flex flex-col items-start gap-1.5 cursor-pointer group px-2 py-1" id="sidebar-logo-btn">
                        <img src="${logoUrl}" alt="Campus Market — Marketplace des Étudiants de l'UIDT Thiès" class="h-11 w-auto max-w-[195px] object-contain transition-transform group-hover:scale-105" onerror="this.src='/assets/logo.webp'">
                        <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-widest pl-1">Université Iba Der Thiam</span>
                    </div>

                    <!-- Navigation verticale avec liens aérés -->
                    <div class="flex flex-col gap-1.5">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 py-1">
                            Navigation
                        </span>

                        <!-- Lien 1 : Offres -->
                        <button 
                            type="button" 
                            id="sidebar-tab-catalog" 
                            class="flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all min-h-[46px] cursor-pointer group ${
                                currentTab === 'catalog'
                                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }"
                        >
                            <i class="fa-solid fa-store text-base ${currentTab === 'catalog' ? 'text-accent' : 'text-slate-400 group-hover:text-slate-700'}"></i>
                            <span>Offres du Campus</span>
                        </button>

                        <!-- Lien 2 : Recherche rapide -->
                        <button 
                            type="button" 
                            id="sidebar-tab-search" 
                            class="flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all min-h-[46px] cursor-pointer group"
                        >
                            <i class="fa-solid fa-magnifying-glass text-base text-slate-400 group-hover:text-slate-700"></i>
                            <span>Rechercher</span>
                        </button>

                        <!-- Lien 3 : Panier -->
                        <button 
                            type="button" 
                            id="sidebar-tab-cart" 
                            class="flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all min-h-[46px] cursor-pointer group"
                        >
                            <div class="flex items-center gap-3.5">
                                <i class="fa-solid fa-bag-shopping text-base text-slate-400 group-hover:text-slate-700"></i>
                                <span>Mon Panier</span>
                            </div>
                            <span id="sidebar-cart-badge" class="${latestCartCount > 0 ? '' : 'hidden'} px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-accent text-slate-900 shadow-xs">
                                ${latestCartCount > 99 ? '99+' : latestCartCount}
                            </span>
                        </button>

                        <!-- Lien 4 : Mes Commandes -->
                        <button 
                            type="button" 
                            id="sidebar-tab-orders" 
                            class="flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all min-h-[46px] cursor-pointer group ${
                                currentTab === 'orders'
                                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }"
                        >
                            <i class="fa-solid fa-box text-base ${currentTab === 'orders' ? 'text-accent' : 'text-slate-400 group-hover:text-slate-700'}"></i>
                            <span>Mes Commandes</span>
                        </button>
                    </div>
                </div>

                <!-- Bas de Sidebar : Espace Vendeur & Support WhatsApp -->
                <div class="flex flex-col gap-3 pt-4 border-t border-slate-100">
                    <!-- Bouton Accès Vendeur Desktop -->
                    <button 
                        type="button" 
                        id="sidebar-tab-seller" 
                        class="flex items-center justify-between px-3.5 py-3 rounded-2xl text-xs font-bold transition-all min-h-[46px] cursor-pointer active:scale-95 ${
                            currentTab === 'seller'
                                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                                : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80'
                        }"
                    >
                        <div class="flex items-center gap-2.5">
                            <i class="fa-solid fa-shop text-sm ${currentTab === 'seller' ? 'text-white' : 'text-amber-700'}"></i>
                            <span id="sidebar-seller-label">${cachedSeller?.prenom ? `Boutique ${cachedSeller.prenom}` : 'Espace Vendeur'}</span>
                        </div>
                        <span id="sidebar-seller-dot" class="${cachedSeller ? '' : 'hidden'} w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    </button>

                    <!-- Support WhatsApp Campus -->
                    <a 
                        href="${SUPPORT_CONFIG.whatsappUrl}" 
                        target="_blank" 
                        rel="noopener" 
                        title="Assistance WhatsApp ${SUPPORT_CONFIG.phoneDisplay}"
                        class="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 text-xs font-bold transition-all cursor-pointer"
                    >
                        <i class="fa-brands fa-whatsapp text-emerald-600 text-base"></i>
                        <div class="flex flex-col text-left">
                            <span>Support WhatsApp</span>
                            <span class="text-[10px] text-emerald-600 font-semibold leading-none">${SUPPORT_CONFIG.phoneDisplay}</span>
                        </div>
                    </a>

                    <!-- Indicateur Réseau & Version -->
                    <div class="px-2 pt-1 flex items-center justify-between text-[10px] text-slate-400">
                        <span class="flex items-center gap-1.5 font-medium">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Campus Connecté
                        </span>
                        <span>UIDT v2.1</span>
                    </div>
                </div>
            </aside>
        `;

        bindEvents();
        updateBadge();
    }

    function bindEvents() {
        // Clics Mobile
        navContainer.querySelector('#bnav-tab-catalog')?.addEventListener('click', () => {
            currentTab = 'catalog';
            render();
            if (typeof onNavigate === 'function') onNavigate('catalog');
        });

        navContainer.querySelector('#bnav-tab-search')?.addEventListener('click', () => {
            if (typeof onFocusSearch === 'function') onFocusSearch();
        });

        navContainer.querySelector('#bnav-tab-cart')?.addEventListener('click', () => {
            if (typeof onOpenCart === 'function') onOpenCart();
        });

        navContainer.querySelector('#bnav-tab-orders')?.addEventListener('click', () => {
            currentTab = 'orders';
            render();
            if (typeof onNavigate === 'function') onNavigate('orders');
        });

        navContainer.querySelector('#bnav-tab-seller')?.addEventListener('click', () => {
            if (typeof onNavigate === 'function') onNavigate('seller');
        });

        // Clics Desktop Sidebar
        navContainer.querySelector('#sidebar-logo-btn')?.addEventListener('click', () => {
            currentTab = 'catalog';
            render();
            if (typeof onNavigate === 'function') onNavigate('catalog');
        });

        navContainer.querySelector('#sidebar-tab-catalog')?.addEventListener('click', () => {
            currentTab = 'catalog';
            render();
            if (typeof onNavigate === 'function') onNavigate('catalog');
        });

        navContainer.querySelector('#sidebar-tab-search')?.addEventListener('click', () => {
            if (typeof onFocusSearch === 'function') onFocusSearch();
        });

        navContainer.querySelector('#sidebar-tab-cart')?.addEventListener('click', () => {
            if (typeof onOpenCart === 'function') onOpenCart();
        });

        navContainer.querySelector('#sidebar-tab-orders')?.addEventListener('click', () => {
            currentTab = 'orders';
            render();
            if (typeof onNavigate === 'function') onNavigate('orders');
        });

        navContainer.querySelector('#sidebar-tab-seller')?.addEventListener('click', () => {
            if (typeof onNavigate === 'function') onNavigate('seller');
        });
    }

    function updateBadge() {
        const mobileBadge = navContainer.querySelector('#bnav-cart-badge');
        const desktopBadge = navContainer.querySelector('#sidebar-cart-badge');

        const text = latestCartCount > 99 ? '99+' : `${latestCartCount}`;

        if (mobileBadge) {
            mobileBadge.textContent = text;
            mobileBadge.classList.toggle('hidden', latestCartCount <= 0);
        }
        if (desktopBadge) {
            desktopBadge.textContent = text;
            desktopBadge.classList.toggle('hidden', latestCartCount <= 0);
        }
    }

    subscribeCart(({ count }) => {
        latestCartCount = count;
        updateBadge();
    });

    render();

    // Gestion ergonomique du clavier virtuel sur mobile (Safari iOS & Android Chrome)
    // Masque temporairement la barre inférieure lors de la saisie pour éviter qu'elle ne flotte au milieu de l'écran
    if (typeof window !== 'undefined') {
        const setKeyboardNavState = (isKeyboardOpen) => {
            const bottomNavEl = navContainer.querySelector('#mobile-bottom-nav');
            if (!bottomNavEl) return;
            if (isKeyboardOpen) {
                bottomNavEl.classList.add('translate-y-full', 'pointer-events-none');
            } else {
                bottomNavEl.classList.remove('translate-y-full', 'pointer-events-none');
            }
        };

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                if (window.innerWidth < 1024) {
                    const isKeyboardOpen = (window.innerHeight - window.visualViewport.height) > 150;
                    setKeyboardNavState(isKeyboardOpen);
                }
            });
        }

        document.addEventListener('focusin', (e) => {
            if (window.innerWidth < 1024 && ['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) {
                setKeyboardNavState(true);
            }
        });

        document.addEventListener('focusout', (e) => {
            if (window.innerWidth < 1024 && ['INPUT', 'TEXTAREA'].includes(e.target?.tagName)) {
                setTimeout(() => {
                    const activeTag = document.activeElement?.tagName;
                    if (!['INPUT', 'TEXTAREA'].includes(activeTag)) {
                        setKeyboardNavState(false);
                    }
                }, 100);
            }
        });
    }

    navContainer.setActiveTab = (tabName) => {
        if (currentTab !== tabName) {
            currentTab = tabName;
            render();
        }
    };

    navContainer.setSeller = (seller) => {
        cachedSeller = seller;
        render();
    };

    navContainer.setHidden = (hidden) => {
        navContainer.classList.toggle('hidden', hidden);
    };

    return navContainer;
}

export default createBottomNav;

