/**
 * Composant ProductDetailModal
 * Fiche détaillée d'un produit : image grand format, description,
 * coordonnées de la boutique et ajout immédiat au panier.
 */

import { escapeHTML, formatSenegalPhone } from '../utils/security.js';
import { shareProduct } from '../utils/share.js';
import { showToast } from '../utils/notifications.js';
import { setProductSEO, resetDefaultSEO } from '../utils/seo.js';

/**
 * Crée le modal de détails d'un produit.
 * @param {Object} props
 * @param {Function} props.onAddToCart - Callback lors de l'ajout au panier ({ product, quantity })
 * @param {Function} [props.onOpenSeller] - Callback ouverture de la boutique
 * @param {Function} [props.onClose] - Callback fermeture du modal
 * @returns {Object} Contrôleur du modal ({ element, open, close })
 */
export function createProductDetailModal({ onAddToCart, onOpenSeller, onClose } = {}) {
    const modalEl = document.createElement('div');
    modalEl.id = 'product-detail-modal-overlay';
    modalEl.className = 'fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 opacity-0 pointer-events-none transition-opacity duration-300';

    let currentProduct = null;
    let selectedQuantity = 1;
    let activeImageIndex = 0;

    function render() {
        if (!currentProduct) {
            modalEl.innerHTML = '';
            return;
        }

        const p = currentProduct;
        const isSuspended = p.seller 
            ? (p.seller.is_suspended === true || p.seller.role === 'vendeur_desactive' || p.seller.role === 'suspendu') 
            : false;
        const isOpen = p.seller ? (p.seller.is_open !== false && !isSuspended) : true;
        const isOutOfStock = p.stock === 0;
        const isUnavailable = !isOpen || isOutOfStock || isSuspended;

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

        // Galerie multi-photos (jusqu'à 3 images)
        const rawImages = Array.isArray(p.images) && p.images.length > 0 
            ? p.images.filter(Boolean) 
            : (p.image_url ? [p.image_url] : []);
        const productImages = rawImages.map((img) => 
            img?.includes('photo-1611591475823-3882f0592965')
                ? 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600&auto=format&fit=crop&q=80'
                : img
        );
        const hasMultipleImages = productImages.length > 1;
        const safeActiveImage = productImages[activeImageIndex] || productImages[0] || null;

        modalEl.innerHTML = `
            <div class="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh] sm:max-h-[90vh] animate-in fade-in zoom-in-95 duration-200 text-slate-900 dark:text-slate-100 border border-transparent dark:border-slate-800">
                <!-- Poignée tactile mobile (Grab handle) -->
                <div class="sm:hidden pt-3 pb-1 flex justify-center cursor-pointer" id="detail-grab-handle">
                    <div class="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
                </div>

                <!-- En-tête / Image principale -->
                <div class="relative w-full aspect-video sm:aspect-[16/10] bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 group">
                    ${safeActiveImage 
                        ? `<img src="${escapeHTML(safeActiveImage)}" alt="${escapeHTML(p.title)}" id="detail-active-image" class="w-full h-full object-cover transition-all duration-300" onerror="this.onerror=null; this.src='/assets/placeholder.webp';">`
                        : `<div class="w-full h-full flex items-center justify-center bg-primary/5 text-primary text-5xl">
                             <i class="fa-solid ${escapeHTML(p.icon || 'fa-box')}"></i>
                           </div>`
                    }

                    <!-- Flèches de navigation (si multi-photos) -->
                    ${hasMultipleImages ? `
                        <button type="button" id="btn-prev-photo" aria-label="Photo précédente" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white flex items-center justify-center transition-all cursor-pointer z-20 backdrop-blur-xs active:scale-95 shadow-md">
                            <i class="fa-solid fa-chevron-left text-xs"></i>
                        </button>
                        <button type="button" id="btn-next-photo" aria-label="Photo suivante" class="absolute right-2.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white flex items-center justify-center transition-all cursor-pointer z-20 backdrop-blur-xs active:scale-95 shadow-md">
                            <i class="fa-solid fa-chevron-right text-xs"></i>
                        </button>
                    ` : ''}

                    <!-- Compteur de photos flottant -->
                    ${hasMultipleImages ? `
                        <div class="absolute top-3 left-3 z-10 bg-slate-900/70 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                            <i class="fa-solid fa-camera text-[10px]"></i>
                            <span>${activeImageIndex + 1} / ${productImages.length}</span>
                        </div>
                    ` : ''}

                    <!-- Boutons Partager & Fermer -->
                    <div class="absolute top-3 right-3 flex items-center gap-2 z-20">
                        <button id="btn-share-detail" title="Partager ce produit (Lien & WhatsApp)" aria-label="Partager ce produit" class="w-10 h-10 rounded-full bg-slate-900/60 hover:bg-slate-900/80 backdrop-blur-md text-white flex items-center justify-center transition-all shadow-md min-h-[44px] min-w-[44px] cursor-pointer active:scale-95">
                            <i class="fa-solid fa-share-nodes text-sm"></i>
                        </button>
                        <button id="btn-close-detail" class="w-10 h-10 rounded-full bg-slate-900/60 hover:bg-slate-900/80 backdrop-blur-md text-white flex items-center justify-center transition-all shadow-md min-h-[44px] min-w-[44px] cursor-pointer active:scale-95">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>

                    <!-- Badges flottants -->
                    <div class="absolute bottom-3 left-3 flex items-center gap-2 z-10">
                        ${discountBadge}
                        <span class="px-2.5 py-1 rounded-full text-xs font-bold ${
                            isSuspended
                                ? 'bg-red-600 text-white'
                                : !isOpen
                                ? 'bg-slate-900/85 text-white'
                                : isOutOfStock
                                ? 'bg-red-600 text-white'
                                : 'bg-emerald-600/90 text-white'
                        }">
                            ${isSuspended ? 'Boutique suspendue' : !isOpen ? 'Boutique fermée' : isOutOfStock ? 'Rupture' : 'En stock'}
                        </span>
                    </div>
                </div>

                <!-- Barre de vignettes miniatures cliquables (si multi-photos) -->
                ${hasMultipleImages ? `
                    <div class="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 shrink-0 overflow-x-auto">
                        <span class="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1 hidden sm:inline">Photos :</span>
                        ${productImages.map((img, idx) => `
                            <button 
                                type="button" 
                                class="btn-detail-thumbnail w-12 h-12 rounded-xl overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                                    idx === activeImageIndex 
                                        ? 'border-primary ring-2 ring-primary/30 scale-105 shadow-xs' 
                                        : 'border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-600'
                                }"
                                data-photo-index="${idx}"
                                title="Voir photo ${idx + 1}"
                            >
                                <img src="${escapeHTML(img)}" alt="Miniature ${idx + 1}" class="w-full h-full object-cover">
                            </button>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- Corps défilable fluide -->
                <div class="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0 flex flex-col gap-4" style="-webkit-overflow-scrolling: touch;">
                    <!-- Catégorie & Titre -->
                    <div>
                        <span class="text-xs font-bold uppercase tracking-wider text-primary dark:text-blue-400">
                            ${escapeHTML(p.category || 'Article')}
                        </span>
                        <h2 class="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white mt-1 leading-tight">
                            ${escapeHTML(p.title)}
                        </h2>
                    </div>

                    <!-- Prix -->
                    <div class="flex items-baseline gap-3">
                        <span class="font-heading font-extrabold text-2xl text-slate-900 dark:text-white">
                            ${Number(p.price).toLocaleString('fr-FR')} <span class="text-sm font-semibold text-slate-500 dark:text-slate-400">FCFA</span>
                        </span>
                        ${p.old_price ? `<span class="text-sm text-slate-400 dark:text-slate-500 line-through">${Number(p.old_price).toLocaleString('fr-FR')} FCFA</span>` : ''}
                    </div>

                    <!-- Description -->
                    <div class="bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        <h4 class="font-heading font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <i class="fa-solid fa-align-left text-primary dark:text-blue-400"></i> Description
                        </h4>
                        <p class="whitespace-pre-line">
                            ${p.description ? escapeHTML(p.description) : "Article disponible à la livraison pavillon-à-pavillon sur le campus de l'UIDT."}
                        </p>
                    </div>

                    <!-- Info Vendeur & Contact direct -->
                    <div class="border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-primary/10 text-primary dark:bg-primary/20 dark:text-blue-400 font-heading font-extrabold flex items-center justify-center text-sm overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700">
                                ${p.seller?.avatar_url 
                                    ? `<img src="${escapeHTML(p.seller.avatar_url)}" alt="${escapeHTML(sellerName)}" class="w-full h-full object-cover" onerror="this.onerror=null; this.parentElement.textContent='${((sellerName[0] || 'V')).toUpperCase()}';">`
                                    : ((sellerName[0] || 'V')).toUpperCase()
                                }
                            </div>
                            <div class="flex flex-col">
                                <span class="text-[11px] text-slate-400 dark:text-slate-500 block">Vendu par</span>
                                <span class="font-heading font-bold text-slate-900 dark:text-white text-xs sm:text-sm leading-tight">${escapeHTML(sellerName)}</span>
                                ${p.seller ? `
                                    <button 
                                        type="button" 
                                        id="btn-detail-view-shop" 
                                        class="text-[11px] font-bold text-primary dark:text-blue-400 hover:text-primary-hover flex items-center gap-1 transition-colors cursor-pointer mt-1 w-fit"
                                    >
                                        <i class="fa-solid fa-store text-[10px]"></i>
                                        <span>Visiter la boutique</span>
                                        <i class="fa-solid fa-chevron-right text-[8px]"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </div>

                        <div class="flex items-center gap-2">
                            <button type="button" id="btn-detail-share-product" title="Partager ce produit (Lien & WhatsApp)" aria-label="Partager ce produit" class="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-90 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all min-h-[44px] min-w-[44px] cursor-pointer">
                                <i class="fa-solid fa-share-nodes text-xs text-primary dark:text-blue-400"></i>
                            </button>
                            ${cleanPhone ? `
                                <a href="tel:${cleanPhone}" title="Appeler le vendeur" aria-label="Appeler le vendeur" class="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 active:scale-90 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all min-h-[44px] min-w-[44px]">
                                    <i class="fa-solid fa-phone text-xs text-emerald-600 dark:text-emerald-400"></i>
                                </a>
                                <a href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Bonjour ! Je vous contacte au sujet de votre article "${p.title}" sur Campus Market.`)}" target="_blank" rel="noopener" title="Discuter sur WhatsApp" aria-label="Discuter sur WhatsApp" class="w-10 h-10 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 active:scale-90 text-[#25D366] flex items-center justify-center transition-all min-h-[44px] min-w-[44px]">
                                    <i class="fa-brands fa-whatsapp text-lg"></i>
                                </a>
                            ` : ''}
                        </div>
                    </div>
                </div>

                <!-- Barre d'action basse FIXE (Pinned Action Footer avec pb-safe) -->
                <div class="shrink-0 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 pb-safe flex flex-col sm:flex-row items-center gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
                    <!-- Sélecteur quantité -->
                    <div class="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl w-full sm:w-auto justify-between sm:justify-start">
                        <button id="btn-detail-qty-minus" aria-label="Diminuer" class="w-11 h-11 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-90 transition-all font-bold text-sm min-h-[44px] min-w-[44px] cursor-pointer">
                            <i class="fa-solid fa-minus text-xs"></i>
                        </button>
                        <span id="detail-qty-display" class="font-heading font-extrabold text-sm text-slate-900 dark:text-white w-8 text-center select-none">
                            ${selectedQuantity}
                        </span>
                        <button id="btn-detail-qty-plus" aria-label="Augmenter" class="w-11 h-11 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 active:scale-90 transition-all font-bold text-sm min-h-[44px] min-w-[44px] cursor-pointer">
                            <i class="fa-solid fa-plus text-xs"></i>
                        </button>
                    </div>

                    <!-- Bouton d'ajout au panier -->
                    <button 
                        id="btn-detail-add-cart"
                        ${isUnavailable ? 'disabled' : ''}
                        class="flex-1 w-full py-3.5 px-5 rounded-2xl font-heading font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all min-h-[48px] cursor-pointer ${
                            isUnavailable 
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                                : 'bg-gradient-to-r from-primary to-blue-600 hover:from-primary-dark hover:to-primary active:scale-[0.98] text-white shadow-primary/30'
                        }"
                    >
                        <i class="fa-solid fa-bag-shopping text-sm"></i>
                        <span>${isUnavailable ? 'Non disponible à la commande' : 'Ajouter au panier'}</span>
                    </button>
                </div>
            </div>
        `;

        bindEvents();
    }

    function bindEvents() {
        modalEl.querySelector('#btn-close-detail')?.addEventListener('click', close);
        modalEl.querySelector('#detail-grab-handle')?.addEventListener('click', close);
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) close();
        });

        // Navigation multi-photos (vignettes miniatures)
        modalEl.querySelectorAll('.btn-detail-thumbnail').forEach((thumb) => {
            thumb.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(thumb.getAttribute('data-photo-index'), 10);
                if (!isNaN(idx) && idx !== activeImageIndex) {
                    activeImageIndex = idx;
                    render();
                }
            });
        });

        // Navigation multi-photos (flèches Précédent / Suivant)
        const rawImages = Array.isArray(currentProduct?.images) && currentProduct.images.length > 0 
            ? currentProduct.images.filter(Boolean) 
            : (currentProduct?.image_url ? [currentProduct.image_url] : []);
        const totalPhotos = rawImages.length;

        modalEl.querySelector('#btn-prev-photo')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (totalPhotos > 1) {
                activeImageIndex = (activeImageIndex - 1 + totalPhotos) % totalPhotos;
                render();
            }
        });

        modalEl.querySelector('#btn-next-photo')?.addEventListener('click', (e) => {
            e.stopPropagation();
            if (totalPhotos > 1) {
                activeImageIndex = (activeImageIndex + 1) % totalPhotos;
                render();
            }
        });

        // Actions de partage du produit
        const shareAction = () => {
            if (currentProduct) {
                shareProduct(currentProduct, showToast);
            }
        };
        modalEl.querySelector('#btn-share-detail')?.addEventListener('click', shareAction);
        modalEl.querySelector('#btn-detail-share-product')?.addEventListener('click', shareAction);

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

        modalEl.querySelector('#btn-detail-view-shop')?.addEventListener('click', () => {
            const seller = currentProduct?.seller;
            close();
            if (seller && typeof onOpenSeller === 'function') {
                onOpenSeller(seller);
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
        activeImageIndex = 0;
        setProductSEO(product);
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
        resetDefaultSEO();
        if (typeof onClose === 'function') {
            onClose();
        }
    }

    return {
        element: modalEl,
        open,
        close,
    };
}

export default createProductDetailModal;
