/**
 * Composant CartModal
 * Modal latéral ou centré affichant le contenu du panier, calculant le total et initiant le checkout.
 */

import { cartStore, subscribeCart } from '../services/cart-store.js';
import { escapeHTML } from '../utils/security.js';

const DELIVERY_FEE = 500; // Frais de livraison forfaitaire campus

/**
 * Crée et gère la modale du panier.
 * @param {Object} props
 * @param {Function} props.onProceedToCheckout - Callback lors du clic sur 'Passer la commande'
 * @returns {Object} Contrôleur de la modal ({ element, open, close })
 */
export function createCartModal({ onProceedToCheckout } = {}) {
    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'cart-modal-overlay';
    modalOverlay.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end opacity-0 pointer-events-none transition-opacity duration-300';

    modalOverlay.innerHTML = `
        <div id="cart-drawer" class="w-full max-w-md bg-white h-full flex flex-col shadow-2xl transform translate-x-full transition-transform duration-300">
            <!-- Header du Panier -->
            <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-full bg-primary-light flex items-center justify-center text-primary">
                        <i class="fa-solid fa-bag-shopping text-sm"></i>
                    </div>
                    <div>
                        <h2 class="font-heading font-bold text-slate-900 text-lg leading-tight">Mon Panier</h2>
                        <span id="cart-items-count-subtitle" class="text-xs text-slate-500 font-medium">0 article</span>
                    </div>
                </div>
                <button id="btn-close-cart" class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors min-h-[44px] min-w-[44px]">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>

            <!-- Liste scrollable des articles ou Empty State -->
            <div id="cart-items-container" class="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
                <!-- Rempli dynamiquement -->
            </div>

            <!-- Footer avec récapitulatif & Bouton de commande -->
            <div id="cart-footer" class="border-t border-slate-200 p-5 bg-slate-50 flex flex-col gap-3.5">
                <div class="flex flex-col gap-2 text-sm">
                    <div class="flex justify-between text-slate-600">
                        <span>Sous-total</span>
                        <span id="cart-subtotal" class="font-semibold text-slate-900">0 FCFA</span>
                    </div>
                    <div class="flex justify-between text-slate-600 items-center">
                        <span class="flex items-center gap-1.5">
                            <i class="fa-solid fa-motorcycle text-primary text-xs"></i> Livraison pavillon
                        </span>
                        <span class="font-semibold text-slate-900">${DELIVERY_FEE.toLocaleString('fr-FR')} FCFA</span>
                    </div>
                    <div class="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                        <span class="font-heading font-bold text-base text-slate-900">Total à régler</span>
                        <span id="cart-total-price" class="font-heading font-extrabold text-xl text-primary leading-none">0 FCFA</span>
                    </div>
                </div>

                <button 
                    id="btn-checkout" 
                    class="w-full py-3.5 px-4 bg-primary hover:bg-primary-dark active:scale-[0.99] text-white font-heading font-bold rounded-xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 transition-all min-h-[48px]"
                >
                    <span>Passer la commande</span>
                    <i class="fa-solid fa-arrow-right text-sm"></i>
                </button>
            </div>
        </div>
    `;

    const itemsContainer = modalOverlay.querySelector('#cart-items-container');
    const footerEl = modalOverlay.querySelector('#cart-footer');
    const subtotalEl = modalOverlay.querySelector('#cart-subtotal');
    const totalEl = modalOverlay.querySelector('#cart-total-price');
    const subtitleEl = modalOverlay.querySelector('#cart-items-count-subtitle');
    const drawerEl = modalOverlay.querySelector('#cart-drawer');

    function open() {
        modalOverlay.classList.remove('opacity-0', 'pointer-events-none');
        modalOverlay.classList.add('opacity-100');
        drawerEl.classList.remove('translate-x-full');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        modalOverlay.classList.remove('opacity-100');
        modalOverlay.classList.add('opacity-0', 'pointer-events-none');
        drawerEl.classList.add('translate-x-full');
        document.body.style.overflow = '';
    }

    modalOverlay.querySelector('#btn-close-cart')?.addEventListener('click', close);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) close();
    });

    modalOverlay.querySelector('#btn-checkout')?.addEventListener('click', () => {
        const cart = cartStore.getCart();
        if (cart.length === 0) return;
        close();
        if (typeof onProceedToCheckout === 'function') {
            onProceedToCheckout(cart);
        }
    });

    // Rendu réactif des articles
    subscribeCart(({ cart, total, count }) => {
        if (subtitleEl) subtitleEl.textContent = `${count} article${count > 1 ? 's' : ''}`;
        if (subtotalEl) subtotalEl.textContent = `${total.toLocaleString('fr-FR')} FCFA`;
        if (totalEl) totalEl.textContent = `${(total > 0 ? total + DELIVERY_FEE : 0).toLocaleString('fr-FR')} FCFA`;

        if (cart.length === 0) {
            itemsContainer.innerHTML = `
                <div class="flex-1 flex flex-col items-center justify-center text-center p-6 my-auto">
                    <div class="w-20 h-20 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center text-3xl mb-4">
                        <i class="fa-solid fa-cart-shopping"></i>
                    </div>
                    <h3 class="font-heading font-bold text-slate-800 text-lg mb-1">Votre panier est vide</h3>
                    <p class="text-sm text-slate-500 max-w-xs mb-6">Explorez les offres des étudiants et faites-vous livrer en bas de votre chambre !</p>
                    <button id="btn-discover-offers" class="px-5 py-2.5 bg-primary-light text-primary hover:bg-primary hover:text-white font-semibold text-xs rounded-full transition-all min-h-[44px]">
                        Découvrir les offres
                    </button>
                </div>
            `;
            footerEl.classList.add('hidden');

            itemsContainer.querySelector('#btn-discover-offers')?.addEventListener('click', close);
            return;
        }

        footerEl.classList.remove('hidden');

        itemsContainer.innerHTML = cart.map((item) => `
            <div class="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm">
                <!-- Image / Icone -->
                <div class="w-16 h-16 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    ${item.image_url 
                        ? `<img src="${escapeHTML(item.image_url)}" alt="${escapeHTML(item.title)}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/assets/placeholder.webp';">`
                        : `<i class="fa-solid ${escapeHTML(item.icon || 'fa-box')} text-xl text-primary"></i>`
                    }
                </div>

                <!-- Info produit -->
                <div class="flex-1 min-w-0">
                    <h4 class="font-heading font-semibold text-slate-900 text-sm truncate leading-tight">${escapeHTML(item.title)}</h4>
                    <span class="text-xs font-bold text-primary mt-0.5 block">${Number(item.price).toLocaleString('fr-FR')} FCFA</span>
                </div>

                <!-- Sélecteur quantité tactile -->
                <div class="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
                    <button data-action="decrement" data-id="${item.id}" class="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-slate-200 text-slate-600 transition-colors min-h-[36px] min-w-[36px]">
                        <i class="fa-solid fa-minus text-xs"></i>
                    </button>
                    <span class="w-5 text-center text-xs font-bold text-slate-900">${item.quantity}</span>
                    <button data-action="increment" data-id="${item.id}" class="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-slate-200 text-slate-600 transition-colors min-h-[36px] min-w-[36px]">
                        <i class="fa-solid fa-plus text-xs"></i>
                    </button>
                </div>

                <!-- Bouton supprimer -->
                <button data-action="remove" data-id="${item.id}" title="Retirer" class="text-slate-400 hover:text-red-500 p-2 transition-colors min-h-[36px] min-w-[36px]">
                    <i class="fa-solid fa-trash-can text-sm"></i>
                </button>
            </div>
        `).join('');

        // Événements sur la liste
        itemsContainer.querySelectorAll('button[data-action]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const action = btn.getAttribute('data-action');
                const id = btn.getAttribute('data-id');
                const currentItem = cart.find((i) => i.id === id);
                if (!currentItem) return;

                if (action === 'increment') {
                    cartStore.updateQuantity(id, currentItem.quantity + 1);
                } else if (action === 'decrement') {
                    cartStore.updateQuantity(id, currentItem.quantity - 1);
                } else if (action === 'remove') {
                    cartStore.removeFromCart(id);
                }
            });
        });
    });

    return {
        element: modalOverlay,
        open,
        close,
    };
}

export default createCartModal;
