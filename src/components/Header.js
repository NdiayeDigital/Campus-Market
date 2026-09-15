/**
 * Composant Header (Barre supérieure fixe)
 * Intègre le logo officiel, la recherche prédictive et le badge dynamique du panier.
 */

import { subscribeCart } from '../services/cart-store.js';

/**
 * Crée le composant Header.
 * @param {Object} props
 * @param {Function} props.onSearch - Callback appelé lors de la saisie de recherche (query)
 * @param {Function} props.onOpenCart - Callback lors du clic sur l'icône Panier
 * @param {Function} props.onOpenOrders - Callback lors du clic sur Mes Commandes
 * @param {Function} props.onOpenSeller - Callback lors du clic sur Espace Vendeur
 * @returns {HTMLElement}
 */
export function createHeader({ onSearch, onOpenCart, onOpenOrders, onOpenSeller } = {}) {
    const headerEl = document.createElement('header');
    headerEl.className = 'sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all';

    headerEl.innerHTML = `
        <div class="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-2.5">
            <!-- Ligne supérieure : Logo & Actions rapides -->
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-3 cursor-pointer group" id="header-logo-btn">
                    <img src="/assets/logo.webp" alt="Campus Market" class="h-9 w-auto object-contain transition-transform group-hover:scale-105" onerror="this.src='/images/icon-192x192.png'">
                    <div class="hidden sm:flex flex-col">
                        <span class="font-heading font-extrabold text-primary text-base tracking-tight leading-none">CAMPUS MARKET</span>
                        <span class="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">UIDT Thiès</span>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <!-- Bouton Espace Vendeur -->
                    <button id="header-seller-btn" title="Accéder à l'espace vendeur" class="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 rounded-full transition-colors min-h-[44px]">
                        <i class="fa-solid fa-store text-amber-700 text-sm"></i>
                        <span class="hidden sm:inline">Espace Vendeur</span>
                    </button>

                    <!-- Bouton Mes Commandes -->
                    <button id="header-orders-btn" title="Suivi de mes commandes" class="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors min-h-[44px]">
                        <i class="fa-solid fa-box text-primary text-sm"></i>
                        <span class="hidden xs:inline">Commandes</span>
                    </button>

                    <!-- Bouton Panier avec Badge dynamique -->
                    <button id="header-cart-btn" class="relative flex items-center justify-center w-11 h-11 bg-primary-light hover:bg-primary text-primary hover:text-white rounded-full transition-all duration-200 shadow-sm min-h-[44px] min-w-[44px]">
                        <i class="fa-solid fa-bag-shopping text-base"></i>
                        <span id="cart-badge-count" class="hidden absolute -top-1 -right-1 bg-accent text-slate-900 font-extrabold text-[11px] px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm min-w-[20px] text-center transform scale-100 transition-transform">
                            0
                        </span>
                    </button>
                </div>
            </div>

            <!-- Ligne inférieure : Champ de recherche avec icône loupe -->
            <div class="relative w-full">
                <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <i class="fa-solid fa-magnifying-glass text-sm"></i>
                </div>
                <input 
                    type="text" 
                    id="header-search-input" 
                    placeholder="Rechercher un plat, un t-shirt, une clé USB... (tolérance aux fautes)" 
                    class="w-full pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-full text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent focus:bg-white transition-all shadow-inner"
                >
                <button id="header-search-clear" class="hidden absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 min-h-[44px] min-w-[44px] justify-center">
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
    headerEl.querySelector('#header-cart-btn')?.addEventListener('click', () => {
        if (typeof onOpenCart === 'function') onOpenCart();
    });

    headerEl.querySelector('#header-orders-btn')?.addEventListener('click', () => {
        if (typeof onOpenOrders === 'function') onOpenOrders();
    });

    headerEl.querySelector('#header-seller-btn')?.addEventListener('click', () => {
        if (typeof onOpenSeller === 'function') onOpenSeller();
    });

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

    return headerEl;
}

export default createHeader;
