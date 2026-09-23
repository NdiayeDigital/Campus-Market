/**
 * Composant ProductManager (Espace Vendeur - Campus Market UIDT)
 * Gestion complète du catalogue marchand :
 * 1. "Ajouter un produit" : Formulaire 2 colonnes avec Live Preview dynamique à droite sur desktop,
 *    zone de drag & drop photo, input prix avec mention 'FCFA' intégrée, bouton mis en avant.
 * 2. "Mes Articles" : Cartes compactes avec badges de statut (En vente, Vendu, Pause),
 *    actions rapides de modification, mise en pause et suppression.
 * 3. Modal de modification avec prévisualisation immédiate.
 */

import {
    createProduct,
    updateProduct,
    getSellerProducts,
    toggleProductStock,
    deleteProduct,
} from '../../services/product-management.js';
import { CATEGORIES } from '../../services/catalog-service.js';
import { escapeHTML } from '../../utils/security.js';
import { showToast, showConfirm } from '../../utils/notifications.js';

/**
 * Crée le gestionnaire de catalogue vendeur.
 * @param {Object} props
 * @param {string} props.sellerId - UUID du vendeur
 * @param {boolean} [props.isSuspended=false] - Compte vendeur suspendu
 * @param {string} [props.initialTab='list'] - Onglet initial ('list' | 'add')
 * @param {Function} [props.onProductChanged] - Callback lors d'un ajout, modif ou suppression
 * @returns {HTMLElement}
 */
export function createProductManager({
    sellerId,
    isSuspended = false,
    initialTab = 'list',
    onProductChanged,
} = {}) {
    const containerEl = document.createElement('div');
    containerEl.className = 'w-full flex flex-col gap-5 view-transition-enter';

    let products = [];
    let isLoading = true;
    let activeTab = initialTab; // 'list' | 'add'
    let articleFilter = 'all'; // 'all' | 'active' | 'sold' | 'paused'
    let editingProduct = null;

    // Formulaire d'ajout & état dynamique Live Preview
    let addFormData = {
        title: '',
        price: '',
        stock: '10',
        category: 'restauration',
        description: '',
        imageFile: null,
        imagePreviewUrl: null,
    };

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
        const forSaleCount = products.filter((p) => p.stock !== 0 && !p.is_paused).length;
        const soldCount = products.filter((p) => p.stock === 0).length;
        const pausedCount = products.filter((p) => p.is_paused === true || p.stock === -2).length;

        containerEl.innerHTML = `
            <!-- Barre de sous-navigation interne du catalogue -->
            <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3 sm:p-4 flex items-center justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-1.5 sm:gap-2">
                    <button 
                        type="button" 
                        id="pm-tab-list" 
                        class="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[42px] cursor-pointer active:scale-95 ${
                            activeTab === 'list'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }"
                    >
                        <i class="fa-solid fa-boxes-stacked text-xs"></i>
                        <span>Mes Articles</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            activeTab === 'list' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                        }">
                            ${products.length}
                        </span>
                    </button>

                    ${!isSuspended ? `
                        <button 
                            type="button" 
                            id="pm-tab-add" 
                            class="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all min-h-[42px] cursor-pointer active:scale-95 ${
                                activeTab === 'add'
                                    ? 'bg-primary text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }"
                        >
                            <i class="fa-solid fa-plus text-xs"></i>
                            <span>Ajouter un produit</span>
                        </button>
                    ` : `
                        <div class="px-3 py-2 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold border border-rose-200 flex items-center gap-1.5">
                            <i class="fa-solid fa-ban text-[11px]"></i>
                            <span>Ajout bloqué (boutique suspendue)</span>
                        </div>
                    `}
                </div>

                ${activeTab === 'list' ? `
                    <div class="text-xs text-slate-500 font-medium">
                        ${products.length} produit${products.length > 1 ? 's' : ''} au total
                    </div>
                ` : `
                    <button 
                        type="button" 
                        id="pm-btn-cancel-add" 
                        class="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <i class="fa-solid fa-arrow-left text-[11px]"></i>
                        <span>Retour aux articles</span>
                    </button>
                `}
            </div>

            <!-- Contenu dynamique selon l'onglet actif -->
            ${isLoading ? renderSkeleton() : (activeTab === 'add' ? renderAddProductView() : renderProductsListView(forSaleCount, soldCount, pausedCount))}

            <!-- Modal d'édition de produit existant -->
            ${renderEditModalMarkup()}
        `;

        bindEvents();
    }

    function renderSkeleton() {
        return `
            <div class="flex flex-col gap-3 animate-pulse py-4">
                ${Array(3).fill(0).map(() => `
                    <div class="h-24 bg-slate-100 rounded-2xl w-full border border-slate-200/60"></div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Rendu du formulaire "Ajouter un produit" :
     * Disposition 2 colonnes sur Desktop (Formulaire à gauche, Live Preview à droite).
     */
    function renderAddProductView() {
        const previewTitle = addFormData.title || 'Nom de votre article';
        const rawPrice = Number(addFormData.price || 1500);
        const previewPrice = rawPrice.toLocaleString('fr-FR');
        const selectedCat = CATEGORIES.find((c) => c.id === addFormData.category) || CATEGORIES[1] || { label: 'Restauration' };
        const previewImg = addFormData.imagePreviewUrl || '/assets/placeholder.webp';

        return `
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <!-- Colonne de gauche : Formulaire de saisie -->
                <div class="lg:col-span-7 xl:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 flex flex-col gap-5">
                    <div>
                        <h3 class="font-heading font-extrabold text-slate-900 text-base sm:text-lg">Nouvelle Annonce</h3>
                        <p class="text-xs text-slate-500 mt-0.5">Remplissez les détails pour publier immédiatement votre article aux étudiants de l'UIDT.</p>
                    </div>

                    <div id="add-product-error" class="hidden p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium"></div>

                    <form id="add-product-form" class="flex flex-col gap-4.5">
                        <!-- 1. Zone d'upload photo soignée (Drag & drop + bouton tactile) -->
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1.5">
                                Photo de l'article <span class="text-slate-400 font-normal">(Recommandée pour vendre vite)</span>
                            </label>

                            <div 
                                id="photo-dropzone" 
                                class="border-2 border-dashed border-slate-200 hover:border-primary/60 bg-slate-50/70 hover:bg-slate-50 rounded-2xl p-5 sm:p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center relative overflow-hidden group min-h-[160px]"
                            >
                                <input type="file" id="new-prod-image-file" accept="image/*" class="sr-only">
                                
                                ${addFormData.imagePreviewUrl ? `
                                    <div class="flex items-center gap-4 w-full">
                                        <div class="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                                            <img src="${addFormData.imagePreviewUrl}" alt="Aperçu sélection" class="w-full h-full object-cover">
                                        </div>
                                        <div class="flex-1 text-left min-w-0">
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                                <i class="fa-solid fa-check text-[9px]"></i> Photo prête
                                            </span>
                                            <p class="text-xs font-bold text-slate-800 truncate mt-1">${addFormData.imageFile ? escapeHTML(addFormData.imageFile.name) : 'Image sélectionnée'}</p>
                                            <p class="text-[11px] text-slate-400">Cliquez ou glissez pour remplacer</p>
                                        </div>
                                        <button type="button" id="btn-remove-selected-photo" class="w-9 h-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors shrink-0" title="Retirer la photo">
                                            <i class="fa-solid fa-trash-can text-xs"></i>
                                        </button>
                                    </div>
                                ` : `
                                    <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl mb-2 group-hover:scale-110 transition-transform">
                                        <i class="fa-solid fa-camera"></i>
                                    </div>
                                    <span class="text-xs font-bold text-slate-800">Cliquez pour choisir une photo</span>
                                    <span class="text-[11px] text-slate-500 mt-0.5">ou glissez-déposez le fichier ici</span>
                                    <span class="text-[10px] text-slate-400 mt-2 px-2.5 py-0.5 rounded-full bg-white border border-slate-200/80">
                                        JPEG, PNG, WebP • Compression automatique
                                    </span>
                                `}
                            </div>
                        </div>

                        <!-- 2. Nom du produit -->
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1" for="new-prod-title">
                                Nom du produit ou plat *
                            </label>
                            <input 
                                type="text" 
                                id="new-prod-title" 
                                required 
                                value="${escapeHTML(addFormData.title)}"
                                placeholder="Ex: Thiéboudienne Penda Mbaye, Clé USB 32Go, Calculatrice TI..." 
                                class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all min-h-[42px]"
                            >
                        </div>

                        <!-- 3. Prix avec mention 'FCFA' intégrée & Stock initial -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label class="block text-xs font-bold text-slate-700 mb-1" for="new-prod-price">
                                    Prix unitaire *
                                </label>
                                <div class="relative">
                                    <input 
                                        type="number" 
                                        id="new-prod-price" 
                                        required 
                                        min="50" 
                                        step="50" 
                                        value="${addFormData.price}"
                                        placeholder="1500" 
                                        class="w-full pl-3.5 pr-14 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all min-h-[42px]"
                                    >
                                    <span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400 select-none pointer-events-none">
                                        FCFA
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label class="block text-xs font-bold text-slate-700 mb-1" for="new-prod-stock">
                                    Quantité en stock
                                </label>
                                <input 
                                    type="number" 
                                    id="new-prod-stock" 
                                    value="${addFormData.stock}" 
                                    min="-1" 
                                    placeholder="-1 = illimité" 
                                    class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all min-h-[42px]"
                                >
                            </div>
                        </div>

                        <!-- 4. Catégorie -->
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1" for="new-prod-category">
                                Catégorie de l'article *
                            </label>
                            <select 
                                id="new-prod-category" 
                                required 
                                class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all min-h-[42px] cursor-pointer"
                            >
                                ${CATEGORIES.filter((c) => c.id !== 'all').map((c) => `
                                    <option value="${c.id}" ${c.id === addFormData.category ? 'selected' : ''}>${c.label}</option>
                                `).join('')}
                            </select>
                        </div>

                        <!-- 5. Description -->
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1" for="new-prod-desc">
                                Description détaillée <span class="text-slate-400 font-normal">(facultatif)</span>
                            </label>
                            <textarea 
                                id="new-prod-desc" 
                                rows="3" 
                                placeholder="Précisez la taille, les ingrédients, la garantie, le pavillon de retrait..." 
                                class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                            >${escapeHTML(addFormData.description)}</textarea>
                        </div>

                        <!-- 6. Bouton principal 'Publier le produit' mis en avant -->
                        <button 
                            type="submit" 
                            id="btn-submit-new-product" 
                            class="w-full mt-2 py-3.5 bg-primary hover:bg-primary-hover active:scale-[0.99] text-white font-heading font-bold text-xs sm:text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer"
                        >
                            <i class="fa-solid fa-check text-xs"></i>
                            <span>Publier le produit sur Campus Market</span>
                        </button>
                    </form>
                </div>

                <!-- Colonne de droite (Desktop) : Carte d'aperçu dynamique (Live Preview) -->
                <div class="lg:col-span-5 xl:col-span-5 hidden lg:flex flex-col gap-3.5 sticky top-20">
                    <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col gap-4">
                        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div class="flex items-center gap-2">
                                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <h4 class="font-heading font-bold text-xs uppercase tracking-wider text-slate-600">Aperçu en direct (Vue Étudiant)</h4>
                            </div>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Live Preview
                            </span>
                        </div>

                        <!-- Carte produit reproduite fidèlement -->
                        <div class="bg-white rounded-2xl border border-slate-200/80 shadow-card overflow-hidden flex flex-col">
                            <div class="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden flex items-center justify-center">
                                <img 
                                    id="live-preview-img" 
                                    src="${previewImg}" 
                                    alt="Aperçu" 
                                    class="w-full h-full object-cover transition-transform duration-300"
                                    onerror="this.onerror=null; this.src='/assets/placeholder.webp';"
                                >
                                <span id="live-preview-price" class="absolute top-2.5 right-2.5 px-3 py-1 rounded-full text-xs font-black bg-slate-900/90 text-amber-300 backdrop-blur-md shadow-sm tabular-nums">
                                    ${previewPrice} F
                                </span>
                                <span id="live-preview-category" class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/95 text-slate-800 backdrop-blur-md shadow-xs">
                                    ${escapeHTML(selectedCat.label)}
                                </span>
                            </div>

                            <div class="p-4 flex flex-col gap-2.5">
                                <h4 id="live-preview-title" class="font-heading font-bold text-sm text-slate-900 truncate">
                                    ${escapeHTML(previewTitle)}
                                </h4>

                                <div class="flex items-center justify-between text-xs text-slate-500">
                                    <span class="flex items-center gap-1.5 truncate">
                                        <i class="fa-solid fa-store text-[10px] text-slate-400"></i>
                                        <span>Votre Boutique • UIDT</span>
                                    </span>
                                    <span id="live-preview-stock-badge" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        En stock
                                    </span>
                                </div>

                                <div class="pt-3 border-t border-slate-100 mt-1 flex items-center justify-between">
                                    <span class="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                                        <i class="fa-solid fa-truck-fast text-primary"></i> Livraison campus
                                    </span>
                                    <span class="px-3 py-1 bg-slate-900 text-white text-[11px] font-bold rounded-lg pointer-events-none">
                                        Ajouter au panier
                                    </span>
                                </div>
                            </div>
                        </div>

                        <p class="text-[11px] text-slate-400 text-center leading-relaxed">
                            Cet aperçu montre exactement le rendu de votre annonce tel qu'il apparaîtra aux étudiants dans le catalogue.
                        </p>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Rendu de la liste "Mes Articles" sous forme de cartes compactes avec badges de statut :
     * En vente, Vendu, Pause.
     */
    function renderProductsListView(forSaleCount, soldCount, pausedCount) {
        if (products.length === 0) {
            return `
                <div class="p-10 text-center bg-white rounded-2xl border border-dashed border-slate-200/90 shadow-xs my-2">
                    <div class="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl mx-auto mb-3">
                        <i class="fa-solid fa-boxes-stacked"></i>
                    </div>
                    <h4 class="font-heading font-extrabold text-slate-900 text-base mb-1">Votre catalogue est encore vide</h4>
                    <p class="text-xs text-slate-500 max-w-sm mx-auto mb-4">Publiez votre premier article pour commencer à recevoir des commandes des étudiants de l'UIDT.</p>
                    ${!isSuspended ? `
                        <button type="button" id="btn-empty-add-product" class="px-4 py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white text-xs font-bold rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 min-h-[42px] cursor-pointer">
                            <i class="fa-solid fa-plus text-xs"></i>
                            <span>Publier mon premier article</span>
                        </button>
                    ` : ''}
                </div>
            `;
        }

        const filtered = products.filter((prod) => {
            const isSold = prod.stock === 0;
            const isPaused = prod.is_paused === true || prod.stock === -2;
            if (articleFilter === 'active') return !isSold && !isPaused;
            if (articleFilter === 'sold') return isSold;
            if (articleFilter === 'paused') return isPaused;
            return true;
        });

        return `
            <div class="flex flex-col gap-4">
                <!-- Filtres pills de statut d'articles -->
                <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    <button type="button" data-article-filter="all" class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap min-h-[38px] cursor-pointer active:scale-95 ${
                        articleFilter === 'all'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                    }">
                        Tous (${products.length})
                    </button>
                    <button type="button" data-article-filter="active" class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap min-h-[38px] cursor-pointer active:scale-95 ${
                        articleFilter === 'active'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-emerald-800 border border-emerald-200 hover:bg-emerald-50'
                    }">
                        En vente (${forSaleCount})
                    </button>
                    <button type="button" data-article-filter="sold" class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap min-h-[38px] cursor-pointer active:scale-95 ${
                        articleFilter === 'sold'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-white text-rose-800 border border-rose-200 hover:bg-rose-50'
                    }">
                        Vendu (${soldCount})
                    </button>
                    <button type="button" data-article-filter="paused" class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap min-h-[38px] cursor-pointer active:scale-95 ${
                        articleFilter === 'paused'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-white text-amber-800 border border-amber-200 hover:bg-amber-50'
                    }">
                        Pause (${pausedCount})
                    </button>
                </div>

                <!-- Liste des articles sous forme de cartes compactes -->
                ${filtered.length === 0 ? `
                    <div class="p-8 text-center bg-white rounded-2xl border border-slate-200/80 text-xs text-slate-400">
                        Aucun article ne correspond à ce filtre.
                    </div>
                ` : `
                    <div class="flex flex-col gap-3">
                        ${filtered.map((prod) => {
                            const isSold = prod.stock === 0;
                            const isPaused = prod.is_paused === true || prod.stock === -2;
                            const rawImg = prod.image_url;
                            const safeImg = (rawImg && rawImg.includes('photo-1611591475823-3882f0592965'))
                                ? 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600&auto=format&fit=crop&q=80'
                                : rawImg;

                            // Badge de statut (En vente, Vendu, Pause)
                            let statusBadge = '';
                            if (isSold) {
                                statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">Vendu</span>`;
                            } else if (isPaused) {
                                statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">Pause</span>`;
                            } else {
                                statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">En vente</span>`;
                            }

                            return `
                                <div class="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 shadow-xs transition-all">
                                    <!-- Vignette carrée w-20 h-20 object-cover + Métadonnées au centre -->
                                    <div class="flex items-center gap-3.5 min-w-0 flex-1">
                                        <div class="w-20 h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-100 shrink-0 flex items-center justify-center relative">
                                            ${safeImg ? `
                                                <img 
                                                    src="${escapeHTML(safeImg)}" 
                                                    alt="${escapeHTML(prod.title)}" 
                                                    loading="lazy"
                                                    class="w-full h-full object-cover"
                                                    onerror="this.onerror=null; this.src='/assets/placeholder.webp';"
                                                >
                                            ` : `
                                                <i class="fa-solid ${escapeHTML(prod.icon || 'fa-box')} text-xl text-primary/60"></i>
                                            `}
                                        </div>

                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2 flex-wrap">
                                                <h4 class="font-heading font-bold text-slate-900 text-sm truncate leading-snug" title="${escapeHTML(prod.title)}">
                                                    ${escapeHTML(prod.title)}
                                                </h4>
                                                ${statusBadge}
                                            </div>

                                            <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                                                <span class="font-heading font-extrabold text-sm sm:text-base text-primary tabular-nums">
                                                    ${Number(prod.price).toLocaleString('fr-FR')} FCFA
                                                </span>
                                                <span class="text-slate-300">•</span>
                                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                                    ${escapeHTML(prod.category || 'Général')}
                                                </span>
                                                <span class="text-slate-300">•</span>
                                                <span class="text-[11px] text-slate-400">
                                                    ${prod.stock > 0 ? `Stock : ${prod.stock}` : (prod.stock === 0 ? 'Stock épuisé' : 'Stock illimité')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <!-- Actions rapides sur l'article (Boutons tactiles min-h-[44px] pour mobile) -->
                                    <div class="flex items-center gap-2 self-end sm:self-center border-t sm:border-t-0 border-slate-100 pt-2.5 sm:pt-0 w-full sm:w-auto justify-end">
                                        <button 
                                            type="button" 
                                            data-action="edit" 
                                            data-id="${prod.id}" 
                                            title="Modifier l'article"
                                            class="px-3.5 py-2 rounded-xl border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all min-h-[44px] flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-xs"
                                        >
                                            <i class="fa-solid fa-pen text-xs text-primary"></i>
                                            <span>Modifier</span>
                                        </button>

                                        <button 
                                            type="button" 
                                            data-action="toggle-stock" 
                                            data-id="${prod.id}" 
                                            data-stock="${prod.stock}"
                                            title="${isSold ? 'Remettre en stock' : 'Mettre en pause / rupture'}"
                                            class="px-3 py-2 rounded-xl border text-xs font-bold transition-all min-h-[44px] flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-xs ${
                                                isSold 
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' 
                                                    : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                            }"
                                        >
                                            <i class="fa-solid ${isSold ? 'fa-rotate-left' : 'fa-pause'} text-xs"></i>
                                            <span>${isSold ? 'Réappro' : 'Pause'}</span>
                                        </button>

                                        <button 
                                            type="button" 
                                            data-action="delete" 
                                            data-id="${prod.id}" 
                                            title="Supprimer définitivement"
                                            class="w-11 h-11 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors min-h-[44px] min-w-[44px] active:scale-95 cursor-pointer"
                                        >
                                            <i class="fa-solid fa-trash-can text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        `;
    }

    /**
     * Modal d'édition d'article existant
     */
    function renderEditModalMarkup() {
        return `
            <div id="edit-product-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 hidden opacity-0 transition-opacity duration-300">
                <div class="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-popIn">
                    <div class="w-12 h-1 bg-slate-300 rounded-full mx-auto sm:hidden mt-2.5"></div>

                    <div class="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
                        <div class="flex items-center gap-2">
                            <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm">
                                <i class="fa-solid fa-pen"></i>
                            </div>
                            <h4 class="font-heading font-bold text-slate-900 text-base">Modifier l'article</h4>
                        </div>
                        <button id="btn-close-edit-modal" aria-label="Fermer" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 min-h-[38px] min-w-[38px] transition-colors cursor-pointer">
                            <i class="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>

                    <form id="edit-product-form" class="p-5 overflow-y-auto flex flex-col gap-4">
                        <div id="edit-product-error" class="hidden p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-600 font-medium"></div>

                        <!-- Titre -->
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1" for="edit-prod-title">Nom du produit ou plat *</label>
                            <input type="text" id="edit-prod-title" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all min-h-[42px]">
                        </div>

                        <!-- Prix avec mention FCFA & Stock -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-bold text-slate-700 mb-1" for="edit-prod-price">Prix *</label>
                                <div class="relative">
                                    <input type="number" id="edit-prod-price" required min="50" step="50" class="w-full pl-3.5 pr-14 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all min-h-[42px]">
                                    <span class="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400 select-none pointer-events-none">FCFA</span>
                                </div>
                            </div>
                            <div>
                                <label class="block text-xs font-bold text-slate-700 mb-1" for="edit-prod-stock">Stock restant</label>
                                <input type="number" id="edit-prod-stock" min="-1" placeholder="-1 = illimité" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all min-h-[42px]">
                            </div>
                        </div>

                        <!-- Catégorie -->
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1" for="edit-prod-category">Catégorie *</label>
                            <select id="edit-prod-category" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all min-h-[42px]">
                                ${CATEGORIES.filter((c) => c.id !== 'all').map((c) => `
                                    <option value="${c.id}">${c.label}</option>
                                `).join('')}
                            </select>
                        </div>

                        <!-- Description -->
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1" for="edit-prod-desc">Description</label>
                            <textarea id="edit-prod-desc" rows="2" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"></textarea>
                        </div>

                        <!-- Remplacement photo -->
                        <div>
                            <label class="block text-xs font-bold text-slate-700 mb-1">Remplacer la photo (facultatif)</label>
                            <div class="flex items-center gap-3">
                                <label class="cursor-pointer flex-1 flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-200 hover:border-primary rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                                    <i class="fa-solid fa-camera text-slate-400 text-base mb-0.5"></i>
                                    <span class="text-xs font-semibold text-slate-600">Choisir un nouveau fichier</span>
                                    <input type="file" id="edit-prod-image-file" accept="image/*" class="sr-only">
                                </label>
                                <div class="w-16 h-16 rounded-xl border border-slate-200 bg-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                    <img id="edit-image-preview-img" src="" alt="Aperçu" class="w-full h-full object-cover">
                                </div>
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            id="btn-submit-edit-product" 
                            class="w-full mt-2 py-3.5 bg-primary hover:bg-primary-hover active:scale-[0.99] text-white font-heading font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 min-h-[46px] cursor-pointer"
                        >
                            <i class="fa-solid fa-floppy-disk text-xs"></i>
                            <span>Enregistrer les modifications</span>
                        </button>
                    </form>
                </div>
            </div>
        `;
    }

    function bindEvents() {
        // 1. Bascule d'onglets internes (Mes Articles / Ajouter un produit)
        containerEl.querySelector('#pm-tab-list')?.addEventListener('click', () => {
            activeTab = 'list';
            render();
        });

        containerEl.querySelector('#pm-tab-add')?.addEventListener('click', () => {
            if (isSuspended) {
                showToast("Action bloquée : votre boutique est suspendue.", 'warning');
                return;
            }
            activeTab = 'add';
            render();
        });

        containerEl.querySelector('#pm-btn-cancel-add')?.addEventListener('click', () => {
            activeTab = 'list';
            render();
        });

        containerEl.querySelector('#btn-empty-add-product')?.addEventListener('click', () => {
            activeTab = 'add';
            render();
        });

        // 2. Filtres par statut d'articles (Tous, En vente, Vendu, Pause)
        containerEl.querySelectorAll('button[data-article-filter]').forEach((btn) => {
            btn.addEventListener('click', () => {
                articleFilter = btn.getAttribute('data-article-filter') || 'all';
                render();
            });
        });

        // 3. Interactions formulaire "Ajouter un produit" & Live Preview
        if (activeTab === 'add') {
            const dropzone = containerEl.querySelector('#photo-dropzone');
            const fileInput = containerEl.querySelector('#new-prod-image-file');
            const titleInput = containerEl.querySelector('#new-prod-title');
            const priceInput = containerEl.querySelector('#new-prod-price');
            const stockInput = containerEl.querySelector('#new-prod-stock');
            const catSelect = containerEl.querySelector('#new-prod-category');
            const descInput = containerEl.querySelector('#new-prod-desc');
            const form = containerEl.querySelector('#add-product-form');
            const submitBtn = containerEl.querySelector('#btn-submit-new-product');
            const errorEl = containerEl.querySelector('#add-product-error');

            const liveTitle = containerEl.querySelector('#live-preview-title');
            const livePrice = containerEl.querySelector('#live-preview-price');
            const liveCategory = containerEl.querySelector('#live-preview-category');
            const liveImg = containerEl.querySelector('#live-preview-img');

            // Mise à jour synchrone de l'aperçu dynamique
            const updateLivePreview = () => {
                if (liveTitle && titleInput) {
                    liveTitle.textContent = titleInput.value.trim() || 'Nom de votre article';
                }
                if (livePrice && priceInput) {
                    const num = Number(priceInput.value || 0);
                    livePrice.textContent = `${num.toLocaleString('fr-FR')} F`;
                }
                if (liveCategory && catSelect) {
                    const selOpt = catSelect.options[catSelect.selectedIndex];
                    if (selOpt) liveCategory.textContent = selOpt.text;
                }
            };

            titleInput?.addEventListener('input', (e) => {
                addFormData.title = e.target.value;
                updateLivePreview();
            });

            priceInput?.addEventListener('input', (e) => {
                addFormData.price = e.target.value;
                updateLivePreview();
            });

            stockInput?.addEventListener('input', (e) => {
                addFormData.stock = e.target.value;
            });

            catSelect?.addEventListener('change', (e) => {
                addFormData.category = e.target.value;
                updateLivePreview();
            });

            descInput?.addEventListener('input', (e) => {
                addFormData.description = e.target.value;
            });

            // Gestion de sélection / Drag & drop d'image
            const processFile = (file) => {
                if (!file || !file.type.startsWith('image/')) {
                    showToast('Veuillez sélectionner un fichier image valide (JPEG, PNG, WebP).', 'warning');
                    return;
                }
                addFormData.imageFile = file;
                const reader = new FileReader();
                reader.onload = (ev) => {
                    addFormData.imagePreviewUrl = ev.target.result;
                    if (liveImg) liveImg.src = ev.target.result;
                    render();
                };
                reader.readAsDataURL(file);
            };

            dropzone?.addEventListener('click', (e) => {
                if (e.target.closest('#btn-remove-selected-photo')) return;
                fileInput?.click();
            });

            fileInput?.addEventListener('change', (e) => {
                const file = e.target.files?.[0];
                if (file) processFile(file);
            });

            containerEl.querySelector('#btn-remove-selected-photo')?.addEventListener('click', (e) => {
                e.stopPropagation();
                addFormData.imageFile = null;
                addFormData.imagePreviewUrl = null;
                render();
            });

            // Événements Drag & Drop
            if (dropzone) {
                ['dragenter', 'dragover'].forEach((evt) => {
                    dropzone.addEventListener(evt, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dropzone.classList.add('border-primary', 'bg-blue-50/50');
                    });
                });

                ['dragleave', 'drop'].forEach((evt) => {
                    dropzone.addEventListener(evt, (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        dropzone.classList.remove('border-primary', 'bg-blue-50/50');
                    });
                });

                dropzone.addEventListener('drop', (e) => {
                    const dt = e.dataTransfer;
                    if (dt && dt.files && dt.files.length > 0) {
                        processFile(dt.files[0]);
                    }
                });
            }

            // Soumission du formulaire d'ajout
            form?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const title = titleInput?.value.trim();
                const price = priceInput?.value;
                const stock = stockInput?.value;
                const category = catSelect?.value;
                const description = descInput?.value.trim();
                const imageFile = addFormData.imageFile;

                if (!title || !price) {
                    if (errorEl) {
                        errorEl.textContent = 'Le nom du produit et le prix sont obligatoires.';
                        errorEl.classList.remove('hidden');
                    }
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-xs"></i><span>Publication en cours...</span>`;
                if (errorEl) errorEl.classList.add('hidden');

                try {
                    await createProduct({
                        sellerId,
                        title,
                        price,
                        stock,
                        category,
                        description,
                        imageFile,
                    });

                    // Réinitialisation de l'état du formulaire
                    addFormData = {
                        title: '',
                        price: '',
                        stock: '10',
                        category: 'restauration',
                        description: '',
                        imageFile: null,
                        imagePreviewUrl: null,
                    };

                    showToast('Produit publié au catalogue avec succès ! 🎉', 'success');
                    activeTab = 'list';
                    await loadData();
                    if (typeof onProductChanged === 'function') onProductChanged();
                } catch (err) {
                    if (errorEl) {
                        errorEl.textContent = err.message || "Erreur lors de la publication du produit.";
                        errorEl.classList.remove('hidden');
                    }
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<i class="fa-solid fa-check text-xs"></i><span>Publier le produit sur Campus Market</span>`;
                }
            });
        }

        // 4. Modal d'édition
        const editModal = containerEl.querySelector('#edit-product-modal');
        const closeEditBtn = containerEl.querySelector('#btn-close-edit-modal');
        const editForm = containerEl.querySelector('#edit-product-form');
        const editFileInput = containerEl.querySelector('#edit-prod-image-file');
        const editPreviewImg = containerEl.querySelector('#edit-image-preview-img');
        const editErrorEl = containerEl.querySelector('#edit-product-error');
        const editSubmitBtn = containerEl.querySelector('#btn-submit-edit-product');

        function openEditModal(prod) {
            editingProduct = prod;
            if (!editModal) return;

            containerEl.querySelector('#edit-prod-title').value = prod.title || '';
            containerEl.querySelector('#edit-prod-price').value = prod.price || '';
            containerEl.querySelector('#edit-prod-stock').value = prod.stock !== undefined ? prod.stock : -1;
            containerEl.querySelector('#edit-prod-category').value = prod.category || 'autres';
            containerEl.querySelector('#edit-prod-desc').value = prod.description || '';

            if (editPreviewImg) {
                editPreviewImg.src = prod.image_url || '/assets/placeholder.webp';
            }

            editModal.classList.remove('hidden');
            requestAnimationFrame(() => editModal.classList.remove('opacity-0'));
        }

        function closeEditModal() {
            if (editModal) {
                editModal.classList.add('opacity-0');
                setTimeout(() => editModal.classList.add('hidden'), 300);
            }
            editingProduct = null;
        }

        closeEditBtn?.addEventListener('click', closeEditModal);
        editModal?.addEventListener('click', (e) => {
            if (e.target === editModal) closeEditModal();
        });

        editFileInput?.addEventListener('change', (e) => {
            const file = e.target.files?.[0];
            if (file && editPreviewImg) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    editPreviewImg.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            }
        });

        editForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!editingProduct) return;

            const title = containerEl.querySelector('#edit-prod-title').value.trim();
            const price = containerEl.querySelector('#edit-prod-price').value;
            const stock = containerEl.querySelector('#edit-prod-stock').value;
            const category = containerEl.querySelector('#edit-prod-category').value;
            const description = containerEl.querySelector('#edit-prod-desc').value.trim();
            const imageFile = editFileInput?.files?.[0] || null;

            editSubmitBtn.disabled = true;
            editSubmitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-xs"></i> Enregistrement...`;
            if (editErrorEl) editErrorEl.classList.add('hidden');

            try {
                await updateProduct({
                    productId: editingProduct.id,
                    sellerId,
                    title,
                    price,
                    stock,
                    category,
                    description,
                    imageFile,
                });
                closeEditModal();
                await loadData();
                showToast('Article mis à jour avec succès.', 'success');
                if (typeof onProductChanged === 'function') onProductChanged();
            } catch (err) {
                if (editErrorEl) {
                    editErrorEl.textContent = err.message || 'Erreur de mise à jour.';
                    editErrorEl.classList.remove('hidden');
                }
            } finally {
                editSubmitBtn.disabled = false;
                editSubmitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk text-xs"></i><span>Enregistrer les modifications</span>`;
            }
        });

        // 5. Actions sur les cartes de produits de la liste
        containerEl.querySelectorAll('button[data-action]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const action = btn.getAttribute('data-action');
                const id = btn.getAttribute('data-id');

                if (action === 'edit') {
                    const prod = products.find((p) => p.id === id);
                    if (prod) openEditModal(prod);
                } else if (action === 'toggle-stock') {
                    const currentStock = parseInt(btn.getAttribute('data-stock'), 10);
                    btn.disabled = true;
                    try {
                        await toggleProductStock(id, currentStock);
                        await loadData();
                        showToast(`Statut mis à jour : ${currentStock === 0 ? 'En vente' : 'En pause / rupture'}`, 'info');
                        if (typeof onProductChanged === 'function') onProductChanged();
                    } catch (err) {
                        showToast(err.message, 'error');
                        btn.disabled = false;
                    }
                } else if (action === 'delete') {
                    const confirmed = await showConfirm({
                        title: "Supprimer l'article",
                        message: "Voulez-vous vraiment supprimer cet article de votre catalogue ? Cette action est irréversible.",
                        confirmText: "Supprimer définitivement",
                        cancelText: "Annuler",
                        isDestructive: true,
                        icon: "fa-trash-can",
                    });

                    if (confirmed) {
                        btn.disabled = true;
                        try {
                            await deleteProduct(id);
                            await loadData();
                            showToast("Article retiré de votre catalogue.", 'info');
                            if (typeof onProductChanged === 'function') onProductChanged();
                        } catch (err) {
                            showToast(err.message, 'error');
                            btn.disabled = false;
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
