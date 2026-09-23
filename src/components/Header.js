/**
 * Composant Header (Barre supérieure fixe)
 * Intègre le logo officiel, la recherche prédictive et le badge dynamique du panier.
 */

import { subscribeCart } from '../services/cart-store.js';
import logoUrl from '../assets/logo.webp';

/**
 * Crée le composant Header.
 * @param {Object} props
 * @param {Function} props.onSearch - Callback appelé lors de la saisie de recherche (query)
 * @param {Function} props.onOpenCart - Callback lors du clic sur l'icône Panier
 * @param {Function} props.onOpenOrders - Callback lors du clic sur Mes Commandes
 * @param {Function} props.onOpenSeller - Callback lors du clic sur Espace Vendeur
 * @param {Function} [props.onOpenCatalog] - Callback lors du clic sur Offres
 * @returns {HTMLElement}
 */
export function createHeader({ onSearch, onOpenCart, onOpenOrders, onOpenSeller, onLogoClick, onOpenCatalog } = {}) {
    const headerEl = document.createElement('header');
    headerEl.className = 'sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/70 shadow-sm transition-all duration-200';

    headerEl.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 py-2.5 sm:py-3 flex flex-col gap-2.5">
            <!-- Ligne supérieure : Logo & Actions rapides -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2.5 sm:gap-3 cursor-pointer group" id="header-logo-btn">
                    <img src="${logoUrl}" alt="Campus Market" class="h-9 sm:h-11 w-auto object-contain transition-transform group-hover:scale-105" onerror="this.src='/assets/logo.webp'">
                    <div class="flex flex-col">
                        <span class="font-heading font-extrabold text-primary text-sm sm:text-base tracking-tight leading-none">CAMPUS MARKET</span>
                        <span class="text-[9px] sm:text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">UIDT Thiès</span>
                    </div>
                </div>

                <!-- Groupe de navigation (dupliqué de la barre de navigation du bas, masqué sur mobile quand la bottom nav est visible) -->
                <div id="header-nav-group" class="hidden sm:flex items-center gap-2">
                    <!-- Bouton 1 : Offres (Accueil) -->
                    <button id="header-catalog-btn" type="button" title="Voir toutes les offres" class="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded-full transition-colors min-h-[44px]">
                        <i class="fa-solid fa-store text-primary text-sm"></i>
                        <span>Offres</span>
                    </button>

                    <!-- Bouton 2 : Mes Commandes -->
                    <button id="header-orders-btn" type="button" title="Suivi de mes commandes" class="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors min-h-[44px]">
                        <i class="fa-solid fa-box text-slate-500 text-sm"></i>
                        <span>Commandes</span>
                    </button>

                    <!-- Bouton 3 : Espace Vendeur Desktop & Tablette -->
                    <button id="header-seller-btn" type="button" title="Accéder à l'espace vendeur" class="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-950 bg-amber-100/80 hover:bg-amber-200/90 rounded-full transition-colors min-h-[44px]">
                        <i class="fa-solid fa-shop text-amber-700 text-sm"></i>
                        <span id="header-seller-btn-text">Espace Vendeur</span>
                        <span id="header-seller-dot-desktop" class="hidden w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-0.5"></span>
                    </button>

                    <!-- Bouton 4 : Panier avec Badge dynamique -->
                    <button id="header-cart-btn" type="button" aria-label="Voir le panier" class="relative flex items-center justify-center w-11 h-11 bg-primary-light hover:bg-primary text-primary hover:text-white rounded-full transition-all duration-200 shadow-sm active:scale-95 min-h-[44px] min-w-[44px]">
                        <i class="fa-solid fa-bag-shopping text-base"></i>
                        <span id="cart-badge-count" class="hidden absolute -top-1 -right-1 bg-accent text-slate-900 font-extrabold text-[11px] px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm min-w-[20px] text-center transform scale-100 transition-transform">
                            0
                        </span>
                    </button>
                </div>
            </div>

            <!-- Ligne inférieure : Champ de recherche avec icône loupe -->
            <div id="header-search-row" class="relative w-full">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i class="fa-solid fa-magnifying-glass text-sm"></i>
                </div>
                <input 
                    type="text" 
                    id="header-search-input" 
                    placeholder="Rechercher un plat, un vêtement, des cours, du matériel..." 
                    class="w-full pl-10 pr-10 py-2 sm:py-2.5 bg-slate-100/80 border border-slate-200/80 rounded-full text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent focus:bg-white transition-all shadow-inner"
                >
                <button id="header-search-clear" aria-label="Effacer la recherche" class="hidden absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 min-h-[44px] min-w-[44px] justify-center">
                    <i class="fa-solid fa-circle-xmark text-sm"></i>
                </button>
            </div>
        </div>
    `;

    // Écouteur panier réactif
    const badgeEl = headerEl.querySelector('#cart-badge-count');
    subscribeCart(({ count }) => {
        if (badgeEl) {
            if (count > 0) {
                badgeEl.textContent = count > 99 ? '99+' : count;
                badgeEl.classList.remove('hidden');
                // Effet de rebond à chaque mise à jour
                badgeEl.classList.add('scale-125');
                setTimeout(() => badgeEl.classList.remove('scale-125'), 200);
            } else {
                badgeEl.classList.add('hidden');
            }
        }
    });

    // Événements boutons
    headerEl.querySelector('#header-logo-btn')?.addEventListener('click', () => {
        if (searchInput) {
            searchInput.value = '';
            if (clearBtn) clearBtn.classList.add('hidden');
        }
        if (typeof onLogoClick === 'function') {
            onLogoClick();
        } else if (typeof onSearch === 'function') {
            onSearch('');
        }
    });

    headerEl.querySelector('#header-catalog-btn')?.addEventListener('click', () => {
        if (searchInput) {
            searchInput.value = '';
            if (clearBtn) clearBtn.classList.add('hidden');
        }
        if (typeof onOpenCatalog === 'function') {
            onOpenCatalog();
        } else if (typeof onLogoClick === 'function') {
            onLogoClick();
        } else if (typeof onSearch === 'function') {
            onSearch('');
        }
    });

    headerEl.querySelector('#header-cart-btn')?.addEventListener('click', () => {
        if (typeof onOpenCart === 'function') onOpenCart();
    });

    headerEl.querySelector('#header-orders-btn')?.addEventListener('click', () => {
        if (typeof onOpenOrders === 'function') onOpenOrders();
    });

    const handleSellerClick = () => {
        if (typeof onOpenSeller === 'function') onOpenSeller();
    };
    headerEl.querySelector('#header-seller-btn')?.addEventListener('click', handleSellerClick);

    // Événements recherche (Debounce 250ms)
    const searchInput = headerEl.querySelector('#header-search-input');
    const clearBtn = headerEl.querySelector('#header-search-clear');
    let debounceTimer = null;

    searchInput?.addEventListener('input', (e) => {
        const val = e.target.value;
        if (clearBtn) {
            clearBtn.classList.toggle('hidden', !val);
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (typeof onSearch === 'function') onSearch(val);
        }, 250);
    });

    clearBtn?.addEventListener('click', () => {
        if (searchInput) {
            searchInput.value = '';
            clearBtn.classList.add('hidden');
            searchInput.focus();
            if (typeof onSearch === 'function') onSearch('');
        }
    });

    /**
     * Met en surbrillance l'onglet actif dans le header (desktop)
     * @param {string} tabName ('catalog' | 'orders' | 'seller')
     */
    headerEl.setActiveTab = (tabName) => {
        const catalogBtn = headerEl.querySelector('#header-catalog-btn');
        const ordersBtn = headerEl.querySelector('#header-orders-btn');
        const sellerBtn = headerEl.querySelector('#header-seller-btn');

        if (catalogBtn) {
            if (tabName === 'catalog') {
                catalogBtn.className = 'flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded-full transition-colors min-h-[44px]';
                catalogBtn.querySelector('i')?.classList.replace('text-slate-500', 'text-primary');
            } else {
                catalogBtn.className = 'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-primary bg-slate-100 hover:bg-slate-200/80 rounded-full transition-colors min-h-[44px]';
                catalogBtn.querySelector('i')?.classList.replace('text-primary', 'text-slate-500');
            }
        }

        if (ordersBtn) {
            if (tabName === 'orders') {
                ordersBtn.className = 'flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-primary bg-primary/10 border border-primary/20 rounded-full transition-colors min-h-[44px]';
                ordersBtn.querySelector('i')?.classList.replace('text-slate-500', 'text-primary');
            } else {
                ordersBtn.className = 'flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-primary bg-slate-100 hover:bg-slate-200/80 rounded-full transition-colors min-h-[44px]';
                ordersBtn.querySelector('i')?.classList.replace('text-primary', 'text-slate-500');
            }
        }

        if (sellerBtn) {
            if (tabName === 'seller') {
                sellerBtn.className = 'flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-950 bg-amber-200 border border-amber-400 rounded-full transition-colors min-h-[44px]';
            } else {
                sellerBtn.className = 'flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-950 bg-amber-100/80 hover:bg-amber-200/90 rounded-full transition-colors min-h-[44px]';
            }
        }
    };

    headerEl.setMode = (mode) => {
        const searchRow = headerEl.querySelector('#header-search-row');

        if (mode === 'hidden') {
            headerEl.classList.add('hidden');
        } else if (mode === 'orders') {
            headerEl.classList.remove('hidden');
            if (searchRow) searchRow.classList.add('hidden');
            headerEl.setActiveTab('orders');
        } else {
            // mode === 'catalog' (par défaut)
            headerEl.classList.remove('hidden');
            if (searchRow) searchRow.classList.remove('hidden');
            headerEl.setActiveTab('catalog');
        }
    };

    /**
     * Met à jour l'affichage de l'état vendeur (nom de boutique & pastille connectée sur desktop)
     * @param {Object|null} seller
     */
    headerEl.updateSellerState = (seller) => {
        const desktopText = headerEl.querySelector('#header-seller-btn-text');
        const desktopDot = headerEl.querySelector('#header-seller-dot-desktop');

        if (seller && (seller.role === 'vendeur' || seller.role === 'superadmin')) {
            const displayName = seller.prenom ? `Boutique ${seller.prenom}` : 'Ma Boutique';
            if (desktopText) desktopText.textContent = displayName;
            if (desktopDot) desktopDot.classList.remove('hidden');
        } else {
            if (desktopText) desktopText.textContent = 'Espace Vendeur';
            if (desktopDot) desktopDot.classList.add('hidden');
        }
    };

    headerEl.focusSearch = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(() => {
            searchInput?.focus();
        }, 150);
    };

    return headerEl;
}

export default createHeader;
