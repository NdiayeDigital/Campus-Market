/**
 * Composant BottomNav (Barre de navigation inférieure mobile)
 * Ergonomie pensée pour la zone du pouce sur smartphone (one-handed operation).
 * Offre un accès direct aux vues clés, au panier réactif et à l'Espace Vendeur.
 */

import { subscribeCart } from '../services/cart-store.js';

/**
 * Crée la barre de navigation mobile fixe.
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
    const navEl = document.createElement('nav');
    navEl.id = 'mobile-bottom-nav';
    navEl.className = 'sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.06)] transition-transform duration-300';
    navEl.setAttribute('aria-label', 'Navigation mobile');

    let currentTab = activeTab;

    function render() {
        navEl.innerHTML = `
            <div class="max-w-md mx-auto px-3 py-1.5 flex items-center justify-around">
                <!-- Onglet 1 : Offres / Accueil -->
                <button 
                    type="button" 
                    id="bnav-tab-catalog" 
                    class="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-h-[48px] min-w-[56px] ${
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
                    class="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-500 hover:text-slate-800 font-medium transition-all duration-200 min-h-[48px] min-w-[56px]"
                >
                    <i class="fa-solid fa-magnifying-glass text-lg mb-0.5"></i>
                    <span class="text-[10px] leading-tight">Recherche</span>
                </button>

                <!-- Onglet 3 : Panier tactile central avec badge dynamique -->
                <button 
                    type="button" 
                    id="bnav-tab-cart" 
                    class="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-slate-700 hover:text-primary transition-all duration-200 min-h-[48px] min-w-[56px]"
                >
                    <div class="relative">
                        <i class="fa-solid fa-bag-shopping text-xl mb-0.5"></i>
                        <span id="bnav-cart-badge" class="hidden absolute -top-1.5 -right-2.5 bg-accent text-slate-900 font-extrabold text-[10px] px-1.5 py-0.2 rounded-full border-2 border-white shadow-sm min-w-[18px] text-center transform scale-100 transition-transform">
                            0
                        </span>
                    </div>
                    <span class="text-[10px] font-bold leading-tight">Panier</span>
                </button>

                <!-- Onglet 4 : Mes Commandes -->
                <button 
                    type="button" 
                    id="bnav-tab-orders" 
                    class="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-h-[48px] min-w-[56px] ${
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
                    class="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-h-[48px] min-w-[56px] ${
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
        `;

        bindEvents();
        updateBadge();
    }

    function bindEvents() {
        navEl.querySelector('#bnav-tab-catalog')?.addEventListener('click', () => {
            currentTab = 'catalog';
            render();
            if (typeof onNavigate === 'function') onNavigate('catalog');
        });

        navEl.querySelector('#bnav-tab-search')?.addEventListener('click', () => {
            if (typeof onFocusSearch === 'function') {
                onFocusSearch();
            }
        });

        navEl.querySelector('#bnav-tab-cart')?.addEventListener('click', () => {
            if (typeof onOpenCart === 'function') onOpenCart();
        });

        navEl.querySelector('#bnav-tab-orders')?.addEventListener('click', () => {
            currentTab = 'orders';
            render();
            if (typeof onNavigate === 'function') onNavigate('orders');
        });

        navEl.querySelector('#bnav-tab-seller')?.addEventListener('click', () => {
            if (typeof onNavigate === 'function') onNavigate('seller');
        });
    }

    let latestCartCount = 0;
    function updateBadge() {
        const badge = navEl.querySelector('#bnav-cart-badge');
        if (!badge) return;
        if (latestCartCount > 0) {
            badge.textContent = latestCartCount > 99 ? '99+' : latestCartCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }

    subscribeCart(({ count }) => {
        latestCartCount = count;
        const badge = navEl.querySelector('#bnav-cart-badge');
        if (badge) {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.classList.remove('hidden');
                badge.classList.add('scale-125');
                setTimeout(() => badge.classList.remove('scale-125'), 180);
            } else {
                badge.classList.add('hidden');
            }
        }
    });

    render();

    navEl.setActiveTab = (tabName) => {
        if (currentTab !== tabName) {
            currentTab = tabName;
            render();
        }
    };

    navEl.setHidden = (hidden) => {
        if (hidden) {
            navEl.classList.add('translate-y-full');
        } else {
            navEl.classList.remove('translate-y-full');
        }
    };

    return navEl;
}

export default createBottomNav;
