/**
 * Composant ProductCard
 * Carte produit mobile-first avec bouton tactile ergonomique d'ajout rapide.
 */

import { escapeHTML } from '../utils/security.js';

/**
 * Crée une carte de produit.
 * @param {Object} props
 * @param {Object} props.product - Données du produit
 * @param {Function} props.onAddToCart - Callback lors du clic sur le bouton Ajouter
 * @param {Function} [props.onClickCard] - Callback pour voir les détails éventuels
 * @returns {HTMLElement}
 */
export function createProductCard({ product, onAddToCart, onClickCard } = {}) {
    const cardEl = document.createElement('article');
    cardEl.className = 'group relative flex flex-col bg-surface rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden';

    const isOpen = product.seller ? product.seller.is_open !== false : true;
    const isOutOfStock = product.stock === 0;
    const isUnavailable = !isOpen || isOutOfStock;

    // Badges statut
    let statusBadge = '';
    if (!isOpen) {
        statusBadge = `<span class="absolute top-2.5 left-2.5 z-10 bg-slate-900/80 backdrop-blur-sm text-white text-[11px] font-bold px-2 py-1 rounded-md">Boutique fermée</span>`;
    } else if (isOutOfStock) {
        statusBadge = `<span class="absolute top-2.5 left-2.5 z-10 bg-red-600 text-white text-[11px] font-bold px-2 py-1 rounded-md shadow-sm">Rupture de stock</span>`;
    } else if (product.old_price && Number(product.old_price) > Number(product.price)) {
        const discount = Math.round(((product.old_price - product.price) / product.old_price) * 100);
        statusBadge = `<span class="absolute top-2.5 left-2.5 z-10 bg-accent text-slate-900 font-extrabold text-[11px] px-2 py-0.5 rounded-md shadow-sm">-${discount}%</span>`;
    }

    // Gestion de l'image ou icône
    let imageContent = '';
    if (product.image_url) {
        // Remplacement préventif de l'URL Unsplash restreinte par ORB (bracelet)
        const safeImageUrl = product.image_url.includes('photo-1611591475823-3882f0592965')
            ? 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600&auto=format&fit=crop&q=80'
            : product.image_url;

        imageContent = `
            <img 
                src="${escapeHTML(safeImageUrl)}" 
                alt="${escapeHTML(product.title)}" 
                loading="lazy"
                class="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                onerror="this.onerror=null; this.src='/assets/placeholder.webp';"
            >
        `;
    } else {
        const iconClass = product.icon || 'fa-box';
        const bgColor = product.color || '#EFF6FF';
        imageContent = `
            <div class="w-full h-full flex items-center justify-center text-primary" style="background-color: ${bgColor};">
                <i class="fa-solid ${escapeHTML(iconClass)} text-4xl opacity-80 group-hover:scale-110 transition-transform"></i>
            </div>
        `;
    }

    // Formattage vendeur
    const sellerName = product.seller
        ? `${product.seller.prenom || ''} ${product.seller.nom || ''}`.trim()
        : 'Vendeur UIDT';

    cardEl.innerHTML = `
        <!-- Image Container -->
        <div class="relative w-full aspect-square bg-slate-100 overflow-hidden">
            ${statusBadge}
            ${imageContent}
        </div>

        <!-- Informations Produit -->
        <div class="p-3.5 flex flex-col flex-1 justify-between gap-3">
            <div class="flex flex-col gap-1">
                <span class="text-[11px] font-medium text-slate-500 line-clamp-1 flex items-center gap-1">
                    <i class="fa-solid fa-store text-[10px] text-slate-400"></i> ${escapeHTML(sellerName)}
                </span>
                <h3 class="font-heading font-semibold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    ${escapeHTML(product.title)}
                </h3>
            </div>

            <!-- Prix et Bouton d'action -->
            <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 mt-auto">
                <div class="flex flex-col">
                    <span class="font-heading font-extrabold text-slate-900 text-base leading-none">
                        ${Number(product.price).toLocaleString('fr-FR')} <span class="text-xs font-semibold text-slate-500">FCFA</span>
                    </span>
                    ${product.old_price ? `<span class="text-[11px] text-slate-400 line-through mt-0.5">${Number(product.old_price).toLocaleString('fr-FR')} F</span>` : ''}
                </div>

                <!-- Bouton tactile min 44x44px -->
                <button 
                    type="button" 
                    id="btn-add-to-cart"
                    title="${isUnavailable ? 'Non disponible' : 'Ajouter au panier'}"
                    ${isUnavailable ? 'disabled' : ''}
                    class="flex items-center justify-center w-11 h-11 min-w-[44px] min-h-[44px] rounded-full transition-all duration-200 shadow-sm ${
                        isUnavailable 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                            : 'bg-primary hover:bg-primary-dark text-white active:scale-95 shadow-primary/20'
                    }"
                >
                    <i class="fa-solid fa-plus text-sm"></i>
                </button>
            </div>
        </div>
    `;

    // Attachement des événements
    const addBtn = cardEl.querySelector('#btn-add-to-cart');
    addBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!isUnavailable && typeof onAddToCart === 'function') {
            // Effet d'animation visuel sur le bouton
            addBtn.classList.add('scale-125');
            setTimeout(() => addBtn.classList.remove('scale-125'), 150);
            onAddToCart(product);
        }
    });

    if (typeof onClickCard === 'function') {
        cardEl.addEventListener('click', () => onClickCard(product));
        cardEl.classList.add('cursor-pointer');
    }

    return cardEl;
}

export default createProductCard;
