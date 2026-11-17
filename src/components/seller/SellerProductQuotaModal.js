/**
 * Composant SellerProductQuotaModal
 * Permet à un marchand en Pack Découverte (limité à 1 article actif)
 * de choisir quel article conserver en ligne parmi son catalogue.
 * Les autres articles passent en statut réversible 'masqué_quota' sans aucune suppression.
 */

import { supabase } from '../../services/supabase.js';
import { escapeHTML } from '../../utils/security.js';
import { resolveMediaUrl } from '../../utils/image-compressor.js';

/**
 * Crée le modal de sélection de l'article actif pour le Pack Découverte.
 * @param {Object} props
 * @param {Object} props.seller - Profil du vendeur
 * @param {Array} props.products - Liste complète des produits du vendeur
 * @param {Function} [props.onProductChosen] - Callback appelée après mise à jour ({ activeProduct })
 * @param {Function} [props.onShowToast] - Notification toast
 * @returns {Object} Contrôleur ({ element, open, close })
 */
export function createSellerProductQuotaModal({ seller, products = [], onProductChosen, onShowToast } = {}) {
    const modalEl = document.createElement('div');
    modalEl.id = 'seller-product-quota-modal-overlay';
    modalEl.className = 'fixed inset-0 z-[75] bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-300';

    let localProducts = Array.isArray(products) ? [...products] : [];
    let selectedProductId = null;
    let isSaving = false;

    // Détermination du produit actuellement actif par défaut
    const currentActive = localProducts.find((p) => p.is_active !== false && p.quota_status !== 'masqué_quota') || localProducts[0];
    selectedProductId = currentActive ? currentActive.id : null;

    function render() {
        modalEl.innerHTML = `
            <div class="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in duration-200">
                <!-- En-tête -->
                <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-slate-900 to-blue-900 text-white flex items-center justify-center text-lg shadow-sm">
                            <i class="fa-solid fa-compass text-amber-400"></i>
                        </div>
                        <div>
                            <h2 class="font-heading font-extrabold text-slate-900 text-base leading-tight">Choisir mon article actif</h2>
                            <span class="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Pack Découverte • 1 article en ligne</span>
                        </div>
                    </div>
                    <button id="btn-close-quota-modal" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer min-h-[44px] min-w-[44px]">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <!-- Explication bienveillante -->
                <div class="p-6 overflow-y-auto flex flex-col gap-4 text-slate-900">
                    <div class="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                        <i class="fa-solid fa-circle-info text-blue-600 text-base mt-0.5 shrink-0"></i>
                        <p class="text-xs text-blue-900 leading-relaxed">
                            Le <strong>Pack Découverte (0 FCFA)</strong> permet de garder <strong>1 article actif</strong> en vente sur le campus. 
                            Sélectionnez l'article que vous souhaitez rendre visible. Vos autres articles sont <strong>conservés intacts</strong> (photos, prix et avis) et redeviendront actifs dès que vous passerez au Pack Starter ou Pro.
                        </p>
                    </div>

                    <!-- Liste des produits avec sélection radio -->
                    <div class="flex flex-col gap-2.5">
                        <span class="text-xs font-bold text-slate-700 uppercase tracking-wider">Vos articles enregistrés (${localProducts.length})</span>
                        
                        ${localProducts.length === 0 ? `
                            <p class="text-xs text-slate-400 italic py-4 text-center">Aucun article enregistré pour le moment.</p>
                        ` : localProducts.map((p) => {
                            const isSelected = p.id === selectedProductId;
                            const isCurrentlyActive = p.is_active !== false && p.quota_status !== 'masqué_quota';
                            const imgUrl = resolveMediaUrl(p.image_url || p.images?.[0] || '');

                            return `
                                <div 
                                    data-product-select-id="${p.id}"
                                    class="p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                        isSelected 
                                            ? 'border-primary bg-blue-50/40 ring-2 ring-primary/20 shadow-xs' 
                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                    }"
                                >
                                    <div class="flex items-center gap-3 min-w-0">
                                        <div class="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                                            ${imgUrl ? `
                                                <img src="${imgUrl}" alt="${escapeHTML(p.title)}" class="w-full h-full object-cover">
                                            ` : `
                                                <div class="w-full h-full flex items-center justify-center text-slate-400 text-lg">
                                                    <i class="fa-solid fa-box"></i>
                                                </div>
                                            `}
                                        </div>
                                        <div class="min-w-0">
                                            <div class="flex items-center gap-2 flex-wrap">
                                                <h4 class="font-heading font-bold text-xs sm:text-sm text-slate-900 truncate">
                                                    ${escapeHTML(p.title)}
                                                </h4>
                                                ${isCurrentlyActive ? `
                                                    <span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-100 text-emerald-800">
                                                        En ligne
                                                    </span>
                                                ` : `
                                                    <span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-100 text-slate-600 flex items-center gap-1">
                                                        <i class="fa-solid fa-lock text-[8px]"></i> Masqué
                                                    </span>
                                                `}
                                            </div>
                                            <p class="text-xs font-black text-slate-900 mt-0.5">
                                                ${Number(p.price || 0).toLocaleString('fr-FR')} FCFA
                                            </p>
                                        </div>
                                    </div>

                                    <!-- Indicateur radio -->
                                    <div class="w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                                        isSelected ? 'border-primary bg-primary text-white' : 'border-slate-300 bg-white'
                                    }">
                                        ${isSelected ? '<i class="fa-solid fa-check text-xs"></i>' : ''}
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Pied de page -->
                <div class="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
                    <button 
                        type="button" 
                        id="btn-cancel-quota-modal"
                        class="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-colors cursor-pointer"
                    >
                        Annuler
                    </button>
                    <button 
                        type="button" 
                        id="btn-confirm-quota-modal"
                        ${isSaving || !selectedProductId ? 'disabled' : ''}
                        class="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-heading font-extrabold text-xs shadow-md shadow-primary/20 transition-all cursor-pointer flex items-center gap-2"
                    >
                        ${isSaving ? '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...' : '<i class="fa-solid fa-check"></i> Activer cet article'}
                    </button>
                </div>
            </div>
        `;

        bindEvents();
    }

    function bindEvents() {
        // Clic sur un article pour le sélectionner
        modalEl.querySelectorAll('[data-product-select-id]').forEach((card) => {
            card.addEventListener('click', () => {
                selectedProductId = card.dataset.productSelectId;
                render();
            });
        });

        // Fermeture
        modalEl.querySelector('#btn-close-quota-modal')?.addEventListener('click', close);
        modalEl.querySelector('#btn-cancel-quota-modal')?.addEventListener('click', close);

        // Validation du choix
        modalEl.querySelector('#btn-confirm-quota-modal')?.addEventListener('click', async () => {
            if (!selectedProductId || isSaving) return;
            isSaving = true;
            render();

            try {
                // 1. Définir le produit sélectionné comme actif
                const { error: activeErr } = await supabase
                    .from('products')
                    .update({
                        is_active: true,
                        quota_status: null,
                    })
                    .eq('id', selectedProductId);

                if (activeErr) throw activeErr;

                // 2. Masquer les autres produits du marchand
                const otherProductIds = localProducts
                    .filter((p) => p.id !== selectedProductId)
                    .map((p) => p.id);

                if (otherProductIds.length > 0) {
                    const { error: maskErr } = await supabase
                        .from('products')
                        .update({
                            is_active: false,
                            quota_status: 'masqué_quota',
                        })
                        .in('id', otherProductIds);

                    if (maskErr) throw maskErr;
                }

                // 3. Mémoriser le choix dans le profil
                if (seller?.id) {
                    try {
                        await supabase
                            .from('profiles')
                            .update({ produit_conserve_choisi: selectedProductId })
                            .eq('id', seller.id);
                    } catch {}
                }

                // Mettre à jour l'état local
                localProducts = localProducts.map((p) => {
                    if (p.id === selectedProductId) {
                        return { ...p, is_active: true, quota_status: null };
                    }
                    return { ...p, is_active: false, quota_status: 'masqué_quota' };
                });

                if (typeof onShowToast === 'function') {
                    const chosen = localProducts.find((p) => p.id === selectedProductId);
                    onShowToast(`⭐ "${chosen?.title || 'Article'}" est désormais votre produit actif en vitrine !`, 'success');
                }

                if (typeof onProductChosen === 'function') {
                    onProductChosen({
                        activeProduct: localProducts.find((p) => p.id === selectedProductId),
                        allProducts: localProducts,
                    });
                }

                close();
            } catch (err) {
                console.error('[SellerProductQuotaModal] Erreur mise à jour produit actif:', err);
                if (typeof onShowToast === 'function') {
                    onShowToast(err.message || 'Échec de la mise à jour du produit actif.', 'error');
                }
                isSaving = false;
                render();
            }
        });
    }

    function open(updatedProducts = null) {
        if (Array.isArray(updatedProducts)) {
            localProducts = [...updatedProducts];
            const currentActive = localProducts.find((p) => p.is_active !== false && p.quota_status !== 'masqué_quota') || localProducts[0];
            selectedProductId = currentActive ? currentActive.id : null;
        }
        isSaving = false;
        render();

        modalEl.classList.remove('opacity-0', 'pointer-events-none');
        modalEl.classList.add('opacity-100');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        modalEl.classList.remove('opacity-100');
        modalEl.classList.add('opacity-0', 'pointer-events-none');
        document.body.style.overflow = '';
        isSaving = false;
    }

    render();

    return {
        element: modalEl,
        open,
        close,
    };
}

export default createSellerProductQuotaModal;
