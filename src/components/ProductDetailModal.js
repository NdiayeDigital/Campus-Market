/**
 * Composant ProductDetailModal
 * Fiche détaillée d'un produit : image grand format, description,
 * coordonnées de la boutique et ajout immédiat au panier.
 */

import { escapeHTML, formatSenegalPhone } from '../utils/security.js';

/**
 * Crée le modal de détails d'un produit.
 * @param {Object} props
 * @param {Function} props.onAddToCart - Callback lors de l'ajout au panier ({ product, quantity })
 * @returns {Object} Contrôleur du modal ({ element, open, close })
 */
export function createProductDetailModal({ onAddToCart } = {}) {
    const modalEl = document.createElement('div');
    modalEl.id = 'product-detail-modal-overlay';
    modalEl.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-300';

    let currentProduct = null;
    let selectedQuantity = 1;

    function render() {
        if (!currentProduct) {
            modalEl.innerHTML = '';
            return;
        }

        const p = currentProduct;
        const isOpen = p.seller ? p.seller.is_open !== false : true;
        const isOutOfStock = p.stock === 0;
        const isUnavailable = !isOpen || isOutOfStock;

        const sellerName = p.seller
            ? `${p.seller.prenom || ''} ${p.seller.nom || ''}`.trim()
            : (p.seller_name || 'Vendeur UIDT');

        const sellerPhone = p.seller?.telephone || p.seller_phone || '';
        const cleanPhone = formatSenegalPhone(sellerPhone);

        // Calcul réduction éventuelle
        let discountBadge = '';
        if (p.old_price && Number(p.old_price) > Number(p.price)) {
            const pct = Math.round(((p.old_price - p.price) / p.old_price) * 100);
            discountBadge = `<span class="bg-accent text-slate-900 font-extrabold text-xs px-2.5 py-1 rounded-full shadow-sm">-${pct}%</span>`;
        }

        // Image sécurisée
        const safeImageUrl = p.image_url?.includes('photo-1611591475823-3882f0592965')
            ? 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600&auto=format&fit=crop&q=80'
            : p.image_url;

        modalEl.innerHTML = `
            <div class="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
                <!-- En-tête / Image -->
                <div class="relative w-full aspect-video sm:aspect-[16/10] bg-slate-100 overflow-hidden">
                    ${safeImageUrl 
                        ? `<img src="${escapeHTML(safeImageUrl)}" alt="${escapeHTML(p.title)}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/assets/placeholder.webp';">`
                        : `<div class="w-full h-full flex items-center justify-center bg-primary/5 text-primary text-5xl">
                             <i class="fa-solid ${escapeHTML(p.icon || 'fa-box')}"></i>
                           </div>`
                    }

                    <!-- Bouton Fermer -->
                    <button id="btn-close-detail" class="absolute top-3 right-3 w-10 h-10 rounded-full bg-slate-900/60 hover:bg-slate-900/80 backdrop-blur-md text-white flex items-center justify-center transition-all shadow-md min-h-[44px] min-w-[44px]">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>

                    <!-- Badges flottants -->
                    <div class="absolute bottom-3 left-3 flex items-center gap-2">
                        ${discountBadge}
                        <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
                            !isOpen
                                ? 'bg-slate-900/85 text-white'
                                : isOutOfStock
                                ? 'bg-red-600 text-white'
                                : 'bg-emerald-600/90 text-white'
                        }">
                            ${!isOpen ? 'Boutique fermée' : isOutOfStock ? 'Rupture' : 'En stock'}
                        </span>
                    </div>
                </div>

                <!-- Corps défilable -->
                <div class="p-5 sm:p-6 overflow-y-auto flex flex-col gap-4">
                    <!-- Catégorie & Titre -->
                    <div>
                        <span class="text-xs font-bold uppercase tracking-wider text-primary">
                            ${escapeHTML(p.category || 'Article')}
                        </span>
                        <h2 class="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 mt-1 leading-tight">
                            ${escapeHTML(p.title)}
                        </h2>
                    </div>

                    <!-- Prix -->
                    <div class="flex items-baseline gap-3">
                        <span class="font-heading font-extrabold text-2xl text-slate-900">
                            ${Number(p.price).toLocaleString('fr-FR')} <span class="text-sm font-semibold text-slate-500">FCFA</span>
                        </span>
                        ${p.old_price ? `<span class="text-sm text-slate-400 line-through">${Number(p.old_price).toLocaleString('fr-FR')} FCFA</span>` : ''}
                    </div>

                    <!-- Description -->
                    <div class="bg-slate-50 border border-slate-100 rounded-2xl p-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
                        <h4 class="font-heading font-bold text-slate-800 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <i class="fa-solid fa-align-left text-primary"></i> Description
                        </h4>
                        <p class="whitespace-pre-line">
                            ${p.description ? escapeHTML(p.description) : "Article disponible à la livraison pavillon-à-pavillon sur le campus de l'UIDT."}
                        </p>
                    </div>

                    <!-- Info Vendeur & Contact direct -->
                    <div class="border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 bg-white">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-primary/10 text-primary font-heading font-extrabold flex items-center justify-center text-sm">
                                ${((sellerName[0] || 'V')).toUpperCase()}
                            </div>
                            <div>
                                <span class="text-[11px] text-slate-400 block">Vendu par</span>
                                <span class="font-heading font-bold text-slate-900 text-xs sm:text-sm leading-tight">${escapeHTML(sellerName)}</span>
                            </div>
                        </div>

                        ${cleanPhone ? `
                            <div class="flex items-center gap-1.5">
                                <a href="tel:${cleanPhone}" title="Appeler le vendeur" class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors min-h-[40px] min-w-[40px]">
                                    <i class="fa-solid fa-phone text-xs text-emerald-600"></i>
                                </a>
                                <a href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Bonjour ! Je vous contacte au sujet de votre article "${p.title}" sur Campus Market.`)}" target="_blank" rel="noopener" title="Discuter sur WhatsApp" class="w-9 h-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-600 flex items-center justify-center transition-colors min-h-[40px] min-w-[40px]">
                                    <i class="fa-brands fa-whatsapp text-sm"></i>
                                </a>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Sélecteur quantité et Bouton d'ajout -->
                    <div class="pt-2 flex flex-col sm:flex-row items-center gap-3">
                        <!-- Sélecteur quantité -->
                        <div class="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl w-full sm:w-auto justify-between sm:justify-start">
                            <button id="btn-detail-qty-minus" class="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors font-bold text-sm min-h-[40px] min-w-[40px]">
                                <i class="fa-solid fa-minus text-xs"></i>
                            </button>
                            <span id="detail-qty-display" class="font-heading font-extrabold text-sm text-slate-900 w-8 text-center">
                                ${selectedQuantity}
                            </span>
                            <button id="btn-detail-qty-plus" class="w-9 h-9 bg-white rounded-xl flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors font-bold text-sm min-h-[40px] min-w-[40px]">
                                <i class="fa-solid fa-plus text-xs"></i>
                            </button>
                        </div>

                        <!-- Bouton d'ajout au panier -->
                        <button 
                            id="btn-detail-add-cart"
                            ${isUnavailable ? 'disabled' : ''}
                            class="flex-1 w-full py-3.5 px-5 rounded-2xl font-heading font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-all min-h-[48px] ${
                                isUnavailable 
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                                    : 'bg-primary hover:bg-primary-dark active:scale-[0.99] text-white shadow-primary/30'
                            }"
                        >
                            <i class="fa-solid fa-bag-shopping text-sm"></i>
                            <span>${isUnavailable ? 'Non disponible à la commande' : 'Ajouter au panier'}</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        bindEvents();
    }

    function bindEvents() {
        modalEl.querySelector('#btn-close-detail')?.addEventListener('click', close);
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) close();
        });

        const qtyDisplay = modalEl.querySelector('#detail-qty-display');
        modalEl.querySelector('#btn-detail-qty-minus')?.addEventListener('click', () => {
            if (selectedQuantity > 1) {
                selectedQuantity--;
                if (qtyDisplay) qtyDisplay.textContent = selectedQuantity;
            }
        });

        modalEl.querySelector('#btn-detail-qty-plus')?.addEventListener('click', () => {
            if (selectedQuantity < 20) {
                selectedQuantity++;
                if (qtyDisplay) qtyDisplay.textContent = selectedQuantity;
            }
        });

        modalEl.querySelector('#btn-detail-add-cart')?.addEventListener('click', () => {
            if (!currentProduct) return;
            const isOpen = currentProduct.seller ? currentProduct.seller.is_open !== false : true;
            if (!isOpen || currentProduct.stock === 0) return;

            if (typeof onAddToCart === 'function') {
                onAddToCart(currentProduct, selectedQuantity);
            }
            close();
        });
    }

    function open(product) {
        currentProduct = product;
        selectedQuantity = 1;
        render();
        modalEl.classList.remove('opacity-0', 'pointer-events-none');
        modalEl.classList.add('opacity-100');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        modalEl.classList.remove('opacity-100');
        modalEl.classList.add('opacity-0', 'pointer-events-none');
        document.body.style.overflow = '';
        currentProduct = null;
    }

    return {
        element: modalEl,
        open,
        close,
    };
}

export default createProductDetailModal;
