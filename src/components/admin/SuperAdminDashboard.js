/**
 * Composant SuperAdminDashboard (Panneau d'administration centrale de l'UIDT)
 * Supervision globale, modération des demandes d'adhésion, suspension des boutiques,
 * modération du catalogue produits et traçabilité des commandes.
 */

import {
    fetchGlobalMetrics,
    fetchPendingSellers,
    fetchActiveSellers,
    fetchAllProductsAdmin,
    fetchAllOrdersAdmin,
    approveSeller,
    rejectSeller,
    suspendSeller,
    deleteProductAdmin,
    fetchDeliveryLocations,
    addDeliveryLocation,
    toggleDeliveryLocation,
    deleteDeliveryLocation,
    updateOrderStatusAdmin,
    loginAdmin,
} from '../../services/admin-service.js';
import { supabase } from '../../services/supabase.js';
import { escapeHTML } from '../../utils/security.js';
import { showToast, showConfirm } from '../../utils/notifications.js';

/**
 * Crée le tableau de bord SuperAdmin.
 * @param {Object} props
 * @param {Function} props.onExit - Callback lors de la fermeture ou déconnexion
 * @param {Function} props.onShowToast - Callback pour afficher les toasts
 * @returns {HTMLElement}
 */
export function createSuperAdminDashboard({ onExit, onShowToast } = {}) {
    const containerEl = document.createElement('div');
    containerEl.className = 'w-full max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6';

    let currentAdmin = null;
    let metrics = null;
    let pendingSellers = [];
    let activeSellers = [];
    let allProducts = [];
    let allOrders = [];
    let deliveryLocations = [];
    let activeTab = 'sellers'; // 'sellers' | 'products' | 'orders' | 'locations'
    let productSearchQuery = '';
    let isLoading = true;
    let isAuthenticated = false;

    async function checkExistingAuth() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (profile && profile.role === 'superadmin') {
                    currentAdmin = profile;
                    isAuthenticated = true;
                    await loadAdminData();
                    return;
                }
            }
        } catch {
            // Ignorer
        }
        isAuthenticated = false;
        isLoading = false;
        render();
    }

    async function loadAdminData() {
        isLoading = true;
        render();

        try {
            const [m, p, a, prods, ords, locs] = await Promise.all([
                fetchGlobalMetrics(),
                fetchPendingSellers(),
                fetchActiveSellers(),
                fetchAllProductsAdmin().catch(() => []),
                fetchAllOrdersAdmin().catch(() => []),
                fetchDeliveryLocations(true).catch(() => []),
            ]);
            metrics = m;
            pendingSellers = p || [];
            activeSellers = a || [];
            allProducts = prods || [];
            allOrders = ords || [];
            deliveryLocations = locs || [];
        } catch (err) {
            console.error('[SuperAdmin] Erreur chargement données:', err);
            if (typeof onShowToast === 'function') {
                onShowToast(err.message, 'warning');
            }
        } finally {
            isLoading = false;
            render();
        }
    }

    function render() {
        if (!isAuthenticated) {
            renderLoginModal();
            return;
        }

        if (isLoading) {
            containerEl.innerHTML = `
                <div class="flex flex-col gap-4 animate-pulse py-8">
                    <div class="h-10 bg-slate-200 rounded-xl w-1/4"></div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        ${Array(4).fill(0).map(() => `<div class="h-24 bg-slate-200 rounded-2xl"></div>`).join('')}
                    </div>
                </div>
            `;
            return;
        }

        const m = metrics || {
            activeSellersCount: 0,
            pendingSellersCount: 0,
            totalOrdersCount: 0,
            totalDeliveredRevenue: 0,
        };

        containerEl.innerHTML = `
            <!-- En-tête SuperAdmin -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-5 rounded-3xl shadow-md">
                <div class="flex items-center gap-3.5">
                    <div class="w-12 h-12 rounded-2xl bg-accent text-slate-950 font-extrabold flex items-center justify-center text-xl shadow-sm">
                        <i class="fa-solid fa-shield-halved"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h1 class="font-heading font-extrabold text-lg text-white">Administration Centrale</h1>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-accent/20 text-accent border border-accent/40">
                                UIDT Thiès
                            </span>
                        </div>
                        <p class="text-xs text-slate-400 mt-0.5">Superviseur : ${escapeHTML(currentAdmin?.prenom || '')} ${escapeHTML(currentAdmin?.nom || 'Admin')}</p>
                    </div>
                </div>

                <div class="flex items-center gap-2.5">
                    <button id="btn-refresh-admin" class="flex items-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-2xl text-xs font-bold transition-colors min-h-[44px]">
                        <i class="fa-solid fa-arrows-rotate"></i>
                        <span>Actualiser</span>
                    </button>
                    <button id="btn-exit-admin" class="flex items-center gap-1.5 px-4 py-2.5 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-2xl text-xs font-bold transition-all min-h-[44px]">
                        <i class="fa-solid fa-arrow-right-from-bracket"></i>
                        <span>Quitter</span>
                    </button>
                </div>
            </div>

            <!-- Cartes KPI réelles -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div class="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div class="flex items-center justify-between text-slate-500 mb-2">
                        <span class="text-xs font-semibold">Marchands certifiés</span>
                        <i class="fa-solid fa-store text-emerald-600 text-sm"></i>
                    </div>
                    <span class="font-heading font-extrabold text-2xl text-slate-900">${m.activeSellersCount}</span>
                    <span class="text-[10px] text-slate-400 mt-1">Boutiques actives</span>
                </div>

                <div class="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    ${m.pendingSellersCount > 0 ? `<div class="absolute -top-6 -right-6 w-12 h-12 bg-accent/20 rounded-full animate-ping"></div>` : ''}
                    <div class="flex items-center justify-between text-slate-500 mb-2">
                        <span class="text-xs font-semibold">Demandes en attente</span>
                        <i class="fa-solid fa-hourglass-half text-amber-500 text-sm"></i>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="font-heading font-extrabold text-2xl text-slate-900">${m.pendingSellersCount}</span>
                        ${m.pendingSellersCount > 0 ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-accent text-slate-950">Action requise</span>` : ''}
                    </div>
                    <span class="text-[10px] text-slate-400 mt-1">Candidatures étudiantes</span>
                </div>

                <div class="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div class="flex items-center justify-between text-slate-500 mb-2">
                        <span class="text-xs font-semibold">Total Commandes</span>
                        <i class="fa-solid fa-boxes-packing text-primary text-sm"></i>
                    </div>
                    <span class="font-heading font-extrabold text-2xl text-slate-900">${m.totalOrdersCount}</span>
                    <span class="text-[10px] text-slate-400 mt-1">Historique complet</span>
                </div>

                <div class="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div class="flex items-center justify-between text-slate-500 mb-2">
                        <span class="text-xs font-semibold">Volume d'affaires réel</span>
                        <i class="fa-solid fa-coins text-emerald-600 text-sm"></i>
                    </div>
                    <span class="font-heading font-extrabold text-xl text-emerald-600 leading-tight">
                        ${Number(m.totalDeliveredRevenue).toLocaleString('fr-FR')} <span class="text-xs font-bold text-slate-500">FCFA</span>
                    </span>
                    <span class="text-[10px] text-slate-400 mt-1">Commandes livrées uniquement</span>
                </div>
            </div>

            <!-- Onglets d'administration -->
            <div class="flex border-b border-slate-200 gap-2">
                <button id="tab-admin-sellers" class="flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                    activeTab === 'sellers'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                }">
                    <i class="fa-solid fa-users-gear text-xs"></i>
                    <span>Marchands & Demandes (${pendingSellers.length + activeSellers.length})</span>
                </button>

                <button id="tab-admin-products" class="flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                    activeTab === 'products'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                }">
                    <i class="fa-solid fa-box text-xs"></i>
                    <span>Modération Produits (${allProducts.length})</span>
                </button>

                <button id="tab-admin-orders" class="flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                    activeTab === 'orders'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                }">
                    <i class="fa-solid fa-truck-ramp-box text-xs"></i>
                    <span>Suivi Commandes (${allOrders.length})</span>
                </button>

                <button id="tab-admin-locations" class="flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                    activeTab === 'locations'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                }">
                    <i class="fa-solid fa-location-dot text-xs"></i>
                    <span>Lieux & Pavillons (${deliveryLocations.length})</span>
                </button>
            </div>

            <!-- Contenu dynamique de l'onglet -->
            <div id="admin-tab-content">
                ${activeTab === 'sellers' ? renderSellersTab() : ''}
                ${activeTab === 'products' ? renderProductsTab() : ''}
                ${activeTab === 'orders' ? renderOrdersTab() : ''}
                ${activeTab === 'locations' ? renderLocationsTab() : ''}
            </div>
        `;

        bindEvents();
    }

    function renderSellersTab() {
        return `
            <div class="flex flex-col gap-6">
                <!-- Demandes en attente -->
                <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <h2 class="font-heading font-bold text-base text-slate-900">Demandes de validation de Vendeur</h2>
                            <span class="px-2 py-0.5 rounded-full text-[11px] font-extrabold ${pendingSellers.length > 0 ? 'bg-accent text-slate-900' : 'bg-slate-100 text-slate-600'}">
                                ${pendingSellers.length}
                            </span>
                        </div>
                    </div>

                    ${renderPendingSellersList()}
                </div>

                <!-- Marchands actifs -->
                <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-4">
                    <div class="flex items-center justify-between">
                        <h2 class="font-heading font-bold text-base text-slate-900">Marchands enregistrés</h2>
                        <span class="text-xs text-slate-500">${activeSellers.length} inscrit${activeSellers.length > 1 ? 's' : ''}</span>
                    </div>

                    ${renderActiveSellersList()}
                </div>
            </div>
        `;
    }

    function renderPendingSellersList() {
        if (pendingSellers.length === 0) {
            return `
                <div class="text-center py-8 text-slate-400">
                    <i class="fa-solid fa-circle-check text-emerald-500 text-2xl mb-2"></i>
                    <p class="text-xs font-medium">Toutes les demandes de vendeurs sont à jour. Aucune action requise.</p>
                </div>
            `;
        }

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${pendingSellers.map((s) => `
                    <div class="p-4 rounded-2xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between gap-3">
                        <div>
                            <div class="flex items-center justify-between">
                                <h3 class="font-heading font-bold text-slate-900 text-sm">
                                    ${escapeHTML(s.prenom)} ${escapeHTML(s.nom)}
                                </h3>
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">En attente</span>
                            </div>
                            <p class="text-xs text-slate-600 mt-1">
                                <i class="fa-solid fa-phone text-slate-400 mr-1 text-[10px]"></i> ${escapeHTML(s.telephone || 'Non renseigné')}
                            </p>
                            <p class="text-xs text-slate-400 mt-0.5">
                                Candidature du ${s.created_at ? new Date(s.created_at).toLocaleDateString('fr-FR') : 'Récemment'}
                            </p>
                        </div>

                        <div class="flex items-center gap-2 pt-2 border-t border-amber-200/60">
                            <button 
                                data-action="approve" 
                                data-id="${s.id}" 
                                class="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 min-h-[40px]"
                            >
                                <i class="fa-solid fa-check text-xs"></i>
                                <span>Approuver</span>
                            </button>
                            <button 
                                data-action="reject" 
                                data-id="${s.id}" 
                                class="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs rounded-xl transition-all min-h-[40px]"
                            >
                                Rejeter
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderActiveSellersList() {
        if (activeSellers.length === 0) {
            return `
                <div class="text-center py-8 text-slate-400 text-xs">
                    Aucun marchand enregistré pour l'instant.
                </div>
            `;
        }

        return `
            <div class="flex flex-col divide-y divide-slate-100">
                ${activeSellers.map((s) => {
                    const isSuspended = s.role === 'vendeur_desactive';

                    return `
                        <div class="py-3 flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs ${
                                    isSuspended ? 'bg-slate-100 text-slate-400' : 'bg-primary-light text-primary'
                                }">
                                    ${((s.prenom?.[0] || '') + (s.nom?.[0] || '')).toUpperCase() || 'V'}
                                </div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <span class="font-heading font-bold text-slate-900 text-xs sm:text-sm">
                                            ${escapeHTML(s.prenom)} ${escapeHTML(s.nom)}
                                        </span>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            isSuspended ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                                        }">
                                            ${isSuspended ? 'Suspendu' : 'Actif'}
                                        </span>
                                    </div>
                                    <p class="text-[11px] text-slate-400">${escapeHTML(s.telephone || '')}</p>
                                </div>
                            </div>

                            <button 
                                data-action="toggle-suspend" 
                                data-id="${s.id}" 
                                data-suspended="${isSuspended ? 'true' : 'false'}"
                                class="px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors min-h-[36px] ${
                                    isSuspended 
                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                                        : 'border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                                }"
                            >
                                ${isSuspended ? 'Réactiver' : 'Suspendre'}
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderProductsTab() {
        const filtered = allProducts.filter((p) => {
            if (!productSearchQuery) return true;
            const q = productSearchQuery.toLowerCase();
            return (
                (p.title || '').toLowerCase().includes(q) ||
                (p.category || '').toLowerCase().includes(q) ||
                (p.seller?.prenom || '').toLowerCase().includes(q) ||
                (p.seller?.nom || '').toLowerCase().includes(q)
            );
        });

        return `
            <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-4">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 class="font-heading font-bold text-base text-slate-900">Modération du Catalogue Produits</h2>
                        <p class="text-xs text-slate-500">Suppression des articles non conformes aux règles du campus</p>
                    </div>

                    <!-- Champ recherche -->
                    <div class="relative w-full sm:w-64">
                        <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input 
                            type="text" 
                            id="admin-product-search" 
                            value="${escapeHTML(productSearchQuery)}"
                            placeholder="Rechercher un produit..." 
                            class="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                        >
                    </div>
                </div>

                ${filtered.length === 0 ? `
                    <div class="text-center py-12 text-slate-400 text-xs">
                        Aucun produit ne correspond à votre filtre.
                    </div>
                ` : `
                    <div class="flex flex-col divide-y divide-slate-100">
                        ${filtered.map((prod) => `
                            <div class="py-3 flex items-center justify-between gap-3">
                                <div class="flex items-center gap-3 min-w-0">
                                    <div class="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                        ${prod.image_url 
                                            ? `<img src="${escapeHTML(prod.image_url)}" alt="${escapeHTML(prod.title)}" class="w-full h-full object-cover" onerror="this.onerror=null; this.src='/assets/placeholder.webp';">`
                                            : `<i class="fa-solid ${escapeHTML(prod.icon || 'fa-box')} text-primary"></i>`
                                        }
                                    </div>
                                    <div class="min-w-0">
                                        <h4 class="font-heading font-bold text-slate-900 text-xs sm:text-sm truncate">${escapeHTML(prod.title)}</h4>
                                        <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                                            <span class="font-extrabold text-primary">${Number(prod.price).toLocaleString('fr-FR')} FCFA</span>
                                            <span>•</span>
                                            <span>${escapeHTML(prod.category || 'Catégorie')}</span>
                                            <span>•</span>
                                            <span>Vendeur : ${prod.seller ? `${escapeHTML(prod.seller.prenom)} ${escapeHTML(prod.seller.nom)}` : 'Inconnu'}</span>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    data-action="delete-product" 
                                    data-id="${prod.id}" 
                                    title="Modérer / Supprimer"
                                    class="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors min-h-[38px] min-w-[38px]"
                                >
                                    <i class="fa-solid fa-trash-can text-sm"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>
        `;
    }

    function renderOrdersTab() {
        return `
            <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-4">
                <div>
                    <h2 class="font-heading font-bold text-base text-slate-900">Historique des Commandes Récentes</h2>
                    <p class="text-xs text-slate-500">Traçabilité des transactions et résolution directe des litiges</p>
                </div>

                ${allOrders.length === 0 ? `
                    <div class="text-center py-12 text-slate-400 text-xs">
                        Aucune commande enregistrée pour le moment.
                    </div>
                ` : `
                    <div class="overflow-x-auto">
                        <table class="w-full text-left text-xs">
                            <thead class="text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100">
                                <tr>
                                    <th class="py-2.5 px-3">Réf / Date</th>
                                    <th class="py-2.5 px-3">Client</th>
                                    <th class="py-2.5 px-3">Pavillon / Chambre</th>
                                    <th class="py-2.5 px-3">Produit</th>
                                    <th class="py-2.5 px-3">Montant</th>
                                    <th class="py-2.5 px-3">Statut</th>
                                    <th class="py-2.5 px-3 text-right">Action Admin</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${allOrders.map((ord) => `
                                    <tr class="hover:bg-slate-50/60 transition-colors">
                                        <td class="py-3 px-3">
                                            <span class="font-heading font-bold text-primary block">
                                                ${escapeHTML(ord.reference || ('#CMD-' + ord.id.slice(0, 6).toUpperCase()))}
                                            </span>
                                            <span class="text-[10px] text-slate-400">${new Date(ord.created_at).toLocaleDateString('fr-FR')}</span>
                                        </td>
                                        <td class="py-3 px-3">
                                            <span class="font-bold text-slate-900 block">${escapeHTML(ord.buyer_name || 'Invité')}</span>
                                            <span class="text-[10px] text-slate-400">${escapeHTML(ord.buyer_phone || '')}</span>
                                        </td>
                                        <td class="py-3 px-3 text-slate-600">
                                            ${escapeHTML(ord.delivery_address || 'Non spécifié')}
                                        </td>
                                        <td class="py-3 px-3">
                                            <span class="font-medium text-slate-800">${escapeHTML(ord.product?.title || 'Article')}</span>
                                            <span class="text-[10px] text-slate-400 block">(x${ord.quantity || 1})</span>
                                        </td>
                                        <td class="py-3 px-3 font-extrabold text-slate-900">
                                            ${Number(ord.price).toLocaleString('fr-FR')} F
                                        </td>
                                        <td class="py-3 px-3">
                                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                ord.status === 'delivered'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : ord.status === 'cancelled'
                                                    ? 'bg-red-100 text-red-700'
                                                    : ord.status === 'shipped'
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-amber-100 text-amber-800'
                                            }">
                                                ${escapeHTML(ord.status || 'pending')}
                                            </span>
                                        </td>
                                        <td class="py-3 px-3 text-right">
                                            <select 
                                                data-action="change-order-status" 
                                                data-id="${ord.id}"
                                                class="px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                                            >
                                                <option value="" disabled selected>Modifier...</option>
                                                <option value="pending" ${ord.status === 'pending' ? 'disabled' : ''}>En attente</option>
                                                <option value="confirmed" ${ord.status === 'confirmed' ? 'disabled' : ''}>Confirmée</option>
                                                <option value="shipped" ${ord.status === 'shipped' ? 'disabled' : ''}>Expédiée</option>
                                                <option value="delivered" ${ord.status === 'delivered' ? 'disabled' : ''}>Livrée</option>
                                                <option value="cancelled" ${ord.status === 'cancelled' ? 'disabled' : ''}>Annuler (Litige)</option>
                                            </select>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `}
            </div>
        `;
    }

    function renderLocationsTab() {
        return `
            <div class="flex flex-col gap-6">
                <!-- Formulaire d'ajout d'un lieu -->
                <div class="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col gap-3">
                    <div>
                        <h3 class="font-heading font-bold text-sm text-slate-900">Ajouter un Lieu ou Pavillon de Livraison</h3>
                        <p class="text-xs text-slate-500">Ce lieu sera immédiatement proposé aux étudiants lors de la finalisation de commande.</p>
                    </div>
                    <form id="form-add-location" class="flex flex-col sm:flex-row gap-3 items-end">
                        <div class="flex-1 w-full">
                            <label class="block text-xs font-semibold text-slate-600 mb-1" for="new-location-name">Nom du site ou pavillon *</label>
                            <input 
                                type="text" 
                                id="new-location-name" 
                                placeholder="Ex: Site ENSA, Pavillon D, Amphi B..." 
                                required
                                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                            >
                        </div>
                        <div class="w-full sm:w-56">
                            <label class="block text-xs font-semibold text-slate-600 mb-1" for="new-location-category">Catégorie</label>
                            <select 
                                id="new-location-category" 
                                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                            >
                                <option value="pavillon">Pavillon Résidence</option>
                                <option value="site">Site Universitaire / Pédagogique</option>
                                <option value="bu">Bibliothèque (BU)</option>
                                <option value="autre">Autre Espace</option>
                            </select>
                        </div>
                        <button 
                            type="submit" 
                            id="btn-submit-location"
                            class="w-full sm:w-auto px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                        >
                            <i class="fa-solid fa-plus"></i> Ajouter le lieu
                        </button>
                    </form>
                </div>

                <!-- Liste des lieux configurés -->
                <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-4">
                    <div>
                        <h3 class="font-heading font-bold text-base text-slate-900">Lieux et Pavillons Configurés (${deliveryLocations.length})</h3>
                        <p class="text-xs text-slate-500">Activez ou désactivez les zones selon la disponibilité des livraisons sur le campus.</p>
                    </div>

                    ${deliveryLocations.length === 0 ? `
                        <div class="text-center py-10 text-slate-400 text-xs">Aucun lieu configuré pour le moment.</div>
                    ` : `
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs">
                                <thead class="text-[11px] font-bold text-slate-400 uppercase border-b border-slate-100">
                                    <tr>
                                        <th class="py-2.5 px-3">Nom du lieu</th>
                                        <th class="py-2.5 px-3">Catégorie</th>
                                        <th class="py-2.5 px-3">Statut</th>
                                        <th class="py-2.5 px-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${deliveryLocations.map((loc) => `
                                        <tr class="hover:bg-slate-50/60 transition-colors">
                                            <td class="py-3 px-3 font-bold text-slate-900 flex items-center gap-2">
                                                <i class="fa-solid fa-location-dot text-primary text-xs"></i>
                                                <span>${escapeHTML(loc.name)}</span>
                                            </td>
                                            <td class="py-3 px-3">
                                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                                    ${escapeHTML(loc.category || 'pavillon')}
                                                </span>
                                            </td>
                                            <td class="py-3 px-3">
                                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                    loc.is_active 
                                                        ? 'bg-emerald-100 text-emerald-800' 
                                                        : 'bg-slate-100 text-slate-500'
                                                }">
                                                    ${loc.is_active ? 'Actif' : 'Désactivé'}
                                                </span>
                                            </td>
                                            <td class="py-3 px-3 text-right">
                                                <div class="flex items-center justify-end gap-2">
                                                    <button 
                                                        data-action="toggle-location" 
                                                        data-id="${loc.id}" 
                                                        data-active="${loc.is_active}"
                                                        class="px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-colors ${
                                                            loc.is_active 
                                                                ? 'border-amber-300 text-amber-700 hover:bg-amber-50' 
                                                                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                                        }"
                                                    >
                                                        ${loc.is_active ? 'Désactiver' : 'Activer'}
                                                    </button>
                                                    <button 
                                                        data-action="delete-location" 
                                                        data-id="${loc.id}" 
                                                        data-name="${escapeHTML(loc.name)}"
                                                        class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                        title="Supprimer ce lieu"
                                                    >
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    function renderLoginModal() {
        containerEl.innerHTML = `
            <div class="w-full max-w-md mx-auto my-12 bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-6 flex flex-col gap-5">
                <div class="flex items-center gap-3">
                    <img src="/assets/logo.webp" alt="Campus Market" class="h-10 w-auto object-contain">
                    <div>
                        <h2 class="font-heading font-extrabold text-base text-slate-900 leading-tight">Super Administrateur</h2>
                        <p class="text-[11px] text-slate-500">Accès sécurisé réservé à l'UIDT</p>
                    </div>
                </div>

                <div id="admin-login-error" class="hidden p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium"></div>

                <form id="superadmin-login-form" class="flex flex-col gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1" for="admin-login-email">Email SuperAdmin</label>
                        <input type="email" id="admin-login-email" required placeholder="admin@univ-thies.sn" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1" for="admin-login-password">Mot de passe</label>
                        <input type="password" id="admin-login-password" required placeholder="••••••••" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                    </div>

                    <div class="flex items-center gap-2 pt-2">
                        <button type="submit" id="btn-admin-submit" class="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-heading font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 min-h-[44px]">
                            <i class="fa-solid fa-key text-xs"></i>
                            <span>Connexion sécurisée</span>
                        </button>
                        <button type="button" id="btn-admin-cancel" class="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors min-h-[44px]">
                            Retour
                        </button>
                    </div>
                </form>
            </div>
        `;

        const form = containerEl.querySelector('#superadmin-login-form');
        const errEl = containerEl.querySelector('#admin-login-error');
        const submitBtn = containerEl.querySelector('#btn-admin-submit');

        containerEl.querySelector('#btn-admin-cancel')?.addEventListener('click', () => {
            if (typeof onExit === 'function') onExit();
        });

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = containerEl.querySelector('#admin-login-email').value;
            const password = containerEl.querySelector('#admin-login-password').value;

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Vérification...`;
            if (errEl) errEl.classList.add('hidden');

            try {
                const { user, profile } = await loginAdmin({ email, password });
                currentAdmin = profile;
                isAuthenticated = true;
                if (typeof onShowToast === 'function') {
                    onShowToast(`Session administrateur ouverte : ${profile.prenom}`, 'success');
                }
                await loadAdminData();
            } catch (err) {
                if (errEl) {
                    errEl.textContent = err.message || 'Identifiants administrateur incorrects.';
                    errEl.classList.remove('hidden');
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-key text-xs"></i><span>Connexion sécurisée</span>`;
            }
        });
    }

    function bindEvents() {
        containerEl.querySelector('#btn-refresh-admin')?.addEventListener('click', loadAdminData);

        containerEl.querySelector('#btn-exit-admin')?.addEventListener('click', async () => {
            await supabase.auth.signOut();
            isAuthenticated = false;
            currentAdmin = null;
            if (typeof onExit === 'function') onExit();
        });

        // Navigation d'onglets
        containerEl.querySelector('#tab-admin-sellers')?.addEventListener('click', () => {
            activeTab = 'sellers';
            render();
        });
        containerEl.querySelector('#tab-admin-products')?.addEventListener('click', () => {
            activeTab = 'products';
            render();
        });
        containerEl.querySelector('#tab-admin-orders')?.addEventListener('click', () => {
            activeTab = 'orders';
            render();
        });
        containerEl.querySelector('#tab-admin-locations')?.addEventListener('click', () => {
            activeTab = 'locations';
            render();
        });

        // Formulaire d'ajout de lieu
        const formAddLoc = containerEl.querySelector('#form-add-location');
        formAddLoc?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const nameInput = formAddLoc.querySelector('#new-location-name');
            const catSelect = formAddLoc.querySelector('#new-location-category');
            const submitBtn = formAddLoc.querySelector('#btn-submit-location');
            const name = nameInput.value.trim();
            const category = catSelect.value;
            if (!name) return;

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Ajout...`;
            try {
                const newLoc = await addDeliveryLocation({ name, category });
                deliveryLocations.push(newLoc);
                showToast(`Lieu "${name}" ajouté aux zones de livraison ! 📍`, 'success');
                render();
            } catch (err) {
                showToast(err.message, 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-plus"></i> Ajouter le lieu`;
            }
        });

        // Toggle activation d'un lieu
        containerEl.querySelectorAll('button[data-action="toggle-location"]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const isCurrentlyActive = btn.getAttribute('data-active') === 'true';
                btn.disabled = true;
                try {
                    await toggleDeliveryLocation(id, !isCurrentlyActive);
                    const target = deliveryLocations.find((l) => l.id === id);
                    if (target) target.is_active = !isCurrentlyActive;
                    showToast(`Statut du lieu mis à jour : ${!isCurrentlyActive ? 'Actif' : 'Désactivé'}`, 'info');
                    render();
                } catch (err) {
                    showToast(err.message, 'error');
                    btn.disabled = false;
                }
            });
        });

        // Suppression d'un lieu
        containerEl.querySelectorAll('button[data-action="delete-location"]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name') || 'ce lieu';
                const confirmed = await showConfirm({
                    title: 'Supprimer le lieu de livraison',
                    message: `Voulez-vous vraiment supprimer "${name}" des zones de livraison ?`,
                    confirmText: 'Supprimer',
                    cancelText: 'Annuler',
                    isDestructive: true,
                    icon: 'fa-location-dot',
                });

                if (confirmed) {
                    btn.disabled = true;
                    try {
                        await deleteDeliveryLocation(id);
                        deliveryLocations = deliveryLocations.filter((l) => l.id !== id);
                        showToast(`Lieu "${name}" supprimé.`, 'info');
                        render();
                    } catch (err) {
                        showToast(err.message, 'error');
                        btn.disabled = false;
                    }
                }
            });
        });

        // Modification du statut de commande par le SuperAdmin
        containerEl.querySelectorAll('select[data-action="change-order-status"]').forEach((sel) => {
            sel.addEventListener('change', async (e) => {
                const orderId = sel.getAttribute('data-id');
                const newStatus = e.target.value;
                if (!newStatus) return;

                const confirmed = await showConfirm({
                    title: 'Modifier le statut de commande',
                    message: `Confirmez-vous le passage de cette commande au statut "${newStatus}" ?`,
                    confirmText: 'Modifier le statut',
                    cancelText: 'Annuler',
                    isDestructive: false,
                    icon: 'fa-truck-fast',
                });

                if (confirmed) {
                    sel.disabled = true;
                    try {
                        await updateOrderStatusAdmin(orderId, newStatus);
                        const ord = allOrders.find((o) => o.id === orderId);
                        if (ord) ord.status = newStatus;
                        showToast(`Statut de commande mis à jour : ${newStatus} ✔️`, 'success');
                        render();
                    } catch (err) {
                        showToast(err.message, 'error');
                        sel.disabled = false;
                    }
                } else {
                    sel.value = '';
                }
            });
        });

        // Recherche produits
        const prodSearchInput = containerEl.querySelector('#admin-product-search');
        prodSearchInput?.addEventListener('input', (e) => {
            productSearchQuery = e.target.value;
            const contentEl = containerEl.querySelector('#admin-tab-content');
            if (contentEl && activeTab === 'products') {
                contentEl.innerHTML = renderProductsTab();
                bindProductsEvents();
            }
        });

        function bindProductsEvents() {
            containerEl.querySelectorAll('button[data-action="delete-product"]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const confirmed = await showConfirm({
                        title: 'Modération - Supprimer le produit',
                        message: 'Voulez-vous vraiment supprimer définitivement ce produit du catalogue ?',
                        confirmText: 'Supprimer du catalogue',
                        cancelText: 'Annuler',
                        isDestructive: true,
                        icon: 'fa-trash-can',
                    });

                    if (confirmed) {
                        btn.disabled = true;
                        try {
                            await deleteProductAdmin(id);
                            allProducts = allProducts.filter((p) => p.id !== id);
                            showToast('Article modéré et supprimé du catalogue.', 'info');
                            render();
                        } catch (err) {
                            showToast(err.message, 'error');
                            btn.disabled = false;
                        }
                    }
                });
            });
        }

        bindProductsEvents();

        // Actions Approuver / Rejeter / Suspendre
        containerEl.querySelectorAll('button[data-action]').forEach((btn) => {
            const action = btn.getAttribute('data-action');
            if (action === 'delete-product' || action === 'toggle-location' || action === 'delete-location') return;

            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');

                btn.disabled = true;
                try {
                    if (action === 'approve') {
                        await approveSeller(id);
                        showToast('Vendeur approuvé avec succès ! 🟢', 'success');
                    } else if (action === 'reject') {
                        const confirmed = await showConfirm({
                            title: 'Rejeter la candidature',
                            message: 'Voulez-vous vraiment rejeter la demande d\'adhésion de ce vendeur ?',
                            confirmText: 'Rejeter la demande',
                            cancelText: 'Annuler',
                            isDestructive: true,
                            icon: 'fa-user-xmark',
                        });

                        if (confirmed) {
                            await rejectSeller(id);
                            showToast('Candidature rejetée.', 'info');
                        }
                    } else if (action === 'toggle-suspend') {
                        const isSuspended = btn.getAttribute('data-suspended') === 'true';
                        await suspendSeller(id, !isSuspended);
                        showToast(!isSuspended ? 'Boutique suspendue.' : 'Boutique réactivée.', 'info');
                    }
                    await loadAdminData();
                } catch (err) {
                    showToast(err.message, 'error');
                } finally {
                    btn.disabled = false;
                }
            });
        });
    }

    checkExistingAuth();
    return containerEl;
}

export default createSuperAdminDashboard;
