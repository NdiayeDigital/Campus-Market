/**
 * Composant ProductManager (Espace Vendeur)
 * Gestion du catalogue marchand : ajout d'article avec photo compressée,
 * modification rapide de stock et suppression.
 */

import {
    createProduct,
    getSellerProducts,
    toggleProductStock,
    deleteProduct,
} from '../../services/product-management.js';
import { CATEGORIES } from '../../services/catalog-service.js';
import { escapeHTML } from '../../utils/security.js';

/**
 * Crée le gestionnaire de produits du vendeur.
 * @param {Object} props
 * @param {string} props.sellerId - UUID du vendeur
 * @param {Function} [props.onProductChanged] - Callback lors d'un ajout, modif ou suppression
 * @returns {HTMLElement}
 */
export function createProductManager({ sellerId, onProductChanged } = {}) {
    const containerEl = document.createElement('div');
    containerEl.className = 'flex flex-col gap-5';

    let products = [];
    let isLoading = true;

    async function loadData() {
        isLoading = true;
        render();
        try {
            products = await getSellerProducts(sellerId);
        } catch (err) {
            console.error('[ProductManager] Erreur chargement produits:', err);
            products = [];
        } finally {
            isLoading = false;
            render();
        }
    }

    function render() {
        containerEl.innerHTML = `
            <!-- En-tête avec bouton Nouveau Produit -->
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="font-heading font-extrabold text-slate-900 text-lg">Mes Produits en Vente</h3>
                    <p class="text-xs text-slate-500">${products.length} référence${products.length > 1 ? 's' : ''} au catalogue</p>
                </div>
                <button id="btn-open-add-product" class="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-dark active:scale-95 text-white font-heading font-bold text-xs rounded-xl shadow-md transition-all min-h-[44px]">
                    <i class="fa-solid fa-plus text-xs"></i>
                    <span>Ajouter un produit</span>
                </button>
            </div>

            <!-- Liste des produits ou Empty State -->
            ${isLoading ? renderSkeleton() : renderProductsList()}

            <!-- Modal d'ajout de produit (intégré) -->
            <div id="add-product-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden opacity-0 transition-opacity duration-300">
                <div class="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                    <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                        <h4 class="font-heading font-bold text-slate-900 text-base">Nouveau produit</h4>
                        <button id="btn-close-add-modal" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 min-h-[36px] min-w-[36px]">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <form id="add-product-form" class="p-5 overflow-y-auto flex flex-col gap-4">
                        <div id="add-product-error" class="hidden p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium"></div>

                        <!-- Titre -->
                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-1" for="new-prod-title">Nom du produit / plat *</label>
                            <input type="text" id="new-prod-title" required placeholder="Ex: Thiéboudienne Penda Mbaye" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                        </div>

                        <!-- Prix & Stock -->
                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1" for="new-prod-price">Prix unitaire (FCFA) *</label>
                                <input type="number" id="new-prod-price" required min="100" step="50" placeholder="1500" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-700 mb-1" for="new-prod-stock">Stock initial</label>
                                <input type="number" id="new-prod-stock" value="10" min="-1" placeholder="-1 = illimité" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                            </div>
                        </div>

                        <!-- Catégorie -->
                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-1" for="new-prod-category">Catégorie *</label>
                            <select id="new-prod-category" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                                ${CATEGORIES.filter((c) => c.id !== 'all').map((c) => `
                                    <option value="${c.id}">${c.label}</option>
                                `).join('')}
                            </select>
                        </div>

                        <!-- Photo & Prévisualisation -->
                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-1">Photo de l'article (recommandé)</label>
                            <div class="flex items-center gap-3">
                                <label class="cursor-pointer flex-1 flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-200 hover:border-primary rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                                    <i class="fa-solid fa-camera text-slate-400 text-lg mb-1"></i>
                                    <span class="text-[11px] font-semibold text-slate-600">Sélectionner une image</span>
                                    <span class="text-[10px] text-slate-400">Compression auto JPEG</span>
                                    <input type="file" id="new-prod-image-file" accept="image/*" class="sr-only">
                                </label>
                                <div id="image-preview-container" class="w-16 h-16 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden hidden">
                                    <img id="image-preview-img" src="" alt="Aperçu" class="w-full h-full object-cover">
                                </div>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            id="btn-submit-new-product"
                            class="w-full mt-2 py-3 bg-primary hover:bg-primary-dark active:scale-[0.99] text-white font-heading font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 min-h-[44px]"
                        >
                            <i class="fa-solid fa-check"></i>
                            <span>Publier le produit</span>
                        </button>
                    </form>
                </div>
            </div>
        `;

        bindEvents();
    }

    function renderSkeleton() {
        return `
            <div class="flex flex-col gap-2.5 animate-pulse">
                ${Array(3).fill(0).map(() => `
                    <div class="h-20 bg-slate-100 rounded-xl w-full"></div>
                `).join('')}
            </div>
        `;
    }

    function renderProductsList() {
        if (products.length === 0) {
            return `
                <div class="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 my-2">
                    <div class="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-xl mx-auto mb-3">
                        <i class="fa-solid fa-boxes-stacked"></i>
                    </div>
                    <h4 class="font-heading font-bold text-slate-800 text-base mb-1">Aucun produit publié</h4>
                    <p class="text-xs text-slate-500 max-w-xs mx-auto mb-4">Mettez vos premiers plats, articles ou services en vente dès aujourd'hui.</p>
                </div>
            `;
        }

        return `
            <div class="flex flex-col gap-2.5">
                ${products.map((prod) => {
                    const isOutOfStock = prod.stock === 0;

                    return `
                        <div class="bg-white border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm hover:border-slate-300 transition-all">
                            <!-- Image / Miniature -->
                            <div class="w-14 h-14 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                                ${prod.image_url 
                                    ? `<img src="${escapeHTML(prod.image_url)}" alt="${escapeHTML(prod.title)}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/assets/placeholder.webp';">`
                                    : `<i class="fa-solid ${escapeHTML(prod.icon || 'fa-box')} text-lg text-primary"></i>`
                                }
                            </div>

                            <!-- Infos -->
                            <div class="flex-1 min-w-0">
                                <h4 class="font-heading font-bold text-slate-900 text-xs sm:text-sm truncate leading-tight">${escapeHTML(prod.title)}</h4>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="text-xs font-extrabold text-primary">${Number(prod.price).toLocaleString('fr-FR')} FCFA</span>
                                    <span class="text-[11px] px-2 py-0.5 rounded-full font-bold ${
                                        isOutOfStock 
                                            ? 'bg-red-100 text-red-700' 
                                            : 'bg-emerald-100 text-emerald-700'
                                    }">
                                        ${isOutOfStock ? 'Rupture' : 'En stock'}
                                    </span>
                                </div>
                            </div>

                            <!-- Actions -->
                            <div class="flex items-center gap-1.5">
                                <button 
                                    data-action="toggle-stock" 
                                    data-id="${prod.id}" 
                                    data-stock="${prod.stock}"
                                    title="${isOutOfStock ? 'Remettre en stock' : 'Marquer rupture'}"
                                    class="px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors min-h-[38px] ${
                                        isOutOfStock 
                                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                                            : 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                    }"
                                >
                                    <i class="fa-solid ${isOutOfStock ? 'fa-check' : 'fa-ban'} text-xs"></i>
                                    <span class="hidden sm:inline ml-1">${isOutOfStock ? 'Réappro' : 'Rupture'}</span>
                                </button>

                                <button 
                                    data-action="delete" 
                                    data-id="${prod.id}"
                                    title="Supprimer définitivement"
                                    class="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors min-h-[38px] min-w-[38px]"
                                >
                                    <i class="fa-solid fa-trash-can text-sm"></i>
                                </button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function bindEvents() {
        const modal = containerEl.querySelector('#add-product-modal');
        const openBtn = containerEl.querySelector('#btn-open-add-product');
        const closeBtn = containerEl.querySelector('#btn-close-add-modal');
        const form = containerEl.querySelector('#add-product-form');
        const fileInput = containerEl.querySelector('#new-prod-image-file');
        const previewContainer = containerEl.querySelector('#image-preview-container');
        const previewImg = containerEl.querySelector('#image-preview-img');
        const errorEl = containerEl.querySelector('#add-product-error');
        const submitBtn = containerEl.querySelector('#btn-submit-new-product');

        function openModal() {
            if (modal) {
                modal.classList.remove('hidden');
                requestAnimationFrame(() => modal.classList.remove('opacity-0'));
            }
        }

        function closeModal() {
            if (modal) {
                modal.classList.add('opacity-0');
                setTimeout(() => modal.classList.add('hidden'), 300);
            }
            if (form) form.reset();
            if (previewContainer) previewContainer.classList.add('hidden');
        }

        openBtn?.addEventListener('click', openModal);
        closeBtn?.addEventListener('click', closeModal);

        // Prévisualisation instantanée de l'image
        fileInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file && previewContainer && previewImg) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    previewImg.src = event.target.result;
                    previewContainer.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            }
        });

        // Soumission ajout produit
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = containerEl.querySelector('#new-prod-title').value;
            const price = containerEl.querySelector('#new-prod-price').value;
            const stock = containerEl.querySelector('#new-prod-stock').value;
            const category = containerEl.querySelector('#new-prod-category').value;
            const imageFile = fileInput?.files?.[0] || null;

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Compression & Envoi...`;
            if (errorEl) errorEl.classList.add('hidden');

            try {
                await createProduct({
                    sellerId,
                    title,
                    price,
                    stock,
                    category,
                    imageFile,
                });
                closeModal();
                await loadData();
                if (typeof onProductChanged === 'function') onProductChanged();
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = err.message || "Erreur d'ajout de produit.";
                    errorEl.classList.remove('hidden');
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-check"></i><span>Publier le produit</span>`;
            }
        });

        // Boutons de la liste
        containerEl.querySelectorAll('button[data-action]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const action = btn.getAttribute('data-action');
                const id = btn.getAttribute('data-id');

                if (action === 'toggle-stock') {
                    const currentStock = parseInt(btn.getAttribute('data-stock'), 10);
                    btn.disabled = true;
                    try {
                        await toggleProductStock(id, currentStock);
                        await loadData();
                        if (typeof onProductChanged === 'function') onProductChanged();
                    } catch (err) {
                        alert(err.message);
                    }
                } else if (action === 'delete') {
                    if (confirm('Voulez-vous vraiment supprimer cet article de votre catalogue ?')) {
                        btn.disabled = true;
                        try {
                            await deleteProduct(id);
                            await loadData();
                            if (typeof onProductChanged === 'function') onProductChanged();
                        } catch (err) {
                            alert(err.message);
                        }
                    }
                }
            });
        });
    }

    loadData();
    return containerEl;
}

export default createProductManager;
