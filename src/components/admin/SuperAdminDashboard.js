/**
 * Composant SuperAdminDashboard (Panneau d'administration centrale de l'UIDT)
 * Supervision globale, modération des demandes d'adhésion, suspension des boutiques,
 * modération du catalogue produits et traçabilité des commandes.
 * Architecture responsive Bento et conversion automatique Table -> Cartes sur smartphone.
 */

import {
    fetchGlobalMetrics,
    fetchPendingSellers,
    fetchActiveSellers,
    fetchAllProductsAdmin,
    fetchAllOrdersAdmin,
    fetchAllProfilesAdmin,
    approveSeller,
    rejectSeller,
    suspendSeller,
    revokeSeller,
    deleteSellerAccount,
    deleteProductAdmin,
    fetchDeliveryLocations,
    addDeliveryLocation,
    toggleDeliveryLocation,
    deleteDeliveryLocation,
    updateOrderStatusAdmin,
    updateUserRoleAdmin,
    loginAdmin,
    isSellerSuspended,
} from '../../services/admin-service.js';
import { supabase } from '../../services/supabase.js';
import { escapeHTML } from '../../utils/security.js';
import { showToast, showConfirm } from '../../utils/notifications.js';

/**
 * Crée le tableau de bord SuperAdmin.
 * @param {Object} props
 * @param {Function} props.onExit - Callback lors de la fermeture ou déconnexion
 * @param {Function} [props.onBackToCatalog] - Callback pour retourner au site public
 * @param {Function} props.onShowToast - Callback pour afficher les toasts
 * @returns {HTMLElement}
 */
export function createSuperAdminDashboard({ onExit, onBackToCatalog, onShowToast } = {}) {
    const containerEl = document.createElement('div');
    containerEl.className = 'w-full flex flex-col view-transition-enter';

    let currentAdmin = null;
    let metrics = null;
    let pendingSellers = [];
    let activeSellers = [];
    let allProducts = [];
    let allOrders = [];
    let deliveryLocations = [];
    let allProfiles = [];
    let activeTab = 'overview'; // 'overview' | 'sellers' | 'accounts' | 'products' | 'orders' | 'locations'
    let productSearchQuery = '';
    let sellerSearchQuery = '';
    let sellerFilterTab = 'all'; // 'all' | 'pending' | 'active' | 'suspended'
    let accountSearchQuery = '';
    let accountRoleFilter = 'all'; // 'all' | 'acheteur' | 'vendeur' | 'superadmin' | 'suspendu'
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
            const [m, p, a, prods, ords, locs, profs] = await Promise.all([
                fetchGlobalMetrics(),
                fetchPendingSellers(),
                fetchActiveSellers(),
                fetchAllProductsAdmin().catch(() => []),
                fetchAllOrdersAdmin().catch(() => []),
                fetchDeliveryLocations(true).catch(() => []),
                fetchAllProfilesAdmin().catch(() => []),
            ]);
            metrics = m;
            pendingSellers = p || [];
            activeSellers = a || [];
            allProducts = prods || [];
            allOrders = ords || [];
            deliveryLocations = locs || [];
            allProfiles = (profs && profs.length > 0) ? profs : [...pendingSellers, ...activeSellers];
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
                <div class="flex flex-col gap-5 animate-pulse py-8">
                    <div class="h-24 bg-slate-200/70 rounded-3xl w-full"></div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        ${Array(4).fill(0).map(() => `<div class="h-28 bg-slate-200/70 rounded-3xl"></div>`).join('')}
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
            totalSubscriptionRevenue: 0,
            sellerMonthlyFee: 2000,
        };

        const pendingAlert = pendingSellers.length > 0;
        const navTabs = [
            { id: 'overview', label: "Vue d'ensemble", icon: 'fa-chart-pie', badge: null },
            { id: 'sellers', label: "Marchands", icon: 'fa-users-gear', badge: pendingSellers.length + activeSellers.length, badgeAlert: pendingAlert },
            { id: 'accounts', label: "Comptes", icon: 'fa-id-card-clip', badge: allProfiles.length || (pendingSellers.length + activeSellers.length + 1) },
            { id: 'products', label: "Produits", icon: 'fa-box', badge: allProducts.length },
            { id: 'orders', label: "Commandes", icon: 'fa-truck-ramp-box', badge: allOrders.length },
            { id: 'locations', label: "Lieux", icon: 'fa-location-dot', badge: deliveryLocations.length },
        ];

        containerEl.innerHTML = `
            <!-- Header Unique SuperAdmin (Compact, Glassmorphic & Sticky) -->
            <header class="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white shadow-xs w-full">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-3">
                    <!-- Logo & Titre SuperAdmin -->
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-accent to-amber-400 text-slate-950 font-black flex items-center justify-center text-base shadow-sm shrink-0">
                            <i class="fa-solid fa-shield-halved"></i>
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-2">
                                <span class="font-heading font-extrabold text-white text-sm sm:text-base leading-none truncate">Administration Centrale</span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-accent text-slate-950 leading-none shrink-0">
                                    UIDT Thiès
                                </span>
                            </div>
                            <p class="text-[11px] text-slate-400 leading-tight mt-0.5 truncate">
                                Superviseur : <strong class="text-slate-200 font-semibold">${escapeHTML(currentAdmin?.prenom || '')} ${escapeHTML(currentAdmin?.nom || 'Admin')}</strong>
                            </p>
                        </div>
                    </div>

                    <!-- Actions Rapides -->
                    <div class="flex items-center gap-1.5 sm:gap-2 shrink-0">
                        <!-- Actualiser -->
                        <button 
                            id="hdr-btn-refresh-admin" 
                            title="Actualiser toutes les données"
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all min-h-[38px] active:scale-95 cursor-pointer"
                        >
                            <i class="fa-solid fa-arrows-rotate text-xs"></i>
                            <span class="hidden sm:inline">Actualiser</span>
                        </button>

                        <!-- Voir le catalogue public / site -->
                        <button 
                            id="hdr-btn-admin-view-site" 
                            title="Voir la marketplace publique"
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/20 hover:bg-primary/30 text-accent border border-accent/30 transition-all min-h-[38px] active:scale-95 cursor-pointer"
                        >
                            <i class="fa-solid fa-store text-xs"></i>
                            <span class="hidden sm:inline">Boutique</span>
                        </button>

                        <!-- Quitter / Déconnexion -->
                        <button 
                            id="hdr-btn-exit-admin" 
                            title="Quitter l'administration"
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 transition-all min-h-[38px] active:scale-95 cursor-pointer"
                        >
                            <i class="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                            <span class="hidden sm:inline">Quitter</span>
                        </button>
                    </div>
                </div>
            </header>

            <!-- Navigation Mobile / Tablette (< lg) : Barre d'onglets compacte sticky avec scroll horizontal masqué -->
            <nav class="lg:hidden sticky top-[53px] z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 shadow-xs w-full">
                <div class="px-3 sm:px-4 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    ${navTabs.map(tab => `
                        <button 
                            data-tab-target="${tab.id}"
                            id="admin-nav-${tab.id}"
                            class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap min-h-[44px] active:scale-95 cursor-pointer ${
                                activeTab === tab.id
                                    ? 'bg-accent text-slate-950 shadow-sm font-extrabold'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                            }"
                        >
                            <i class="fa-solid ${tab.icon} text-xs"></i>
                            <span>${tab.label}</span>
                            ${tab.badge !== null ? `
                                <span class="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold leading-none ${
                                    activeTab === tab.id ? 'bg-slate-950 text-accent' : (tab.badgeAlert ? 'bg-amber-400 text-slate-950 animate-pulse' : 'bg-slate-800 text-slate-300')
                                }">
                                    ${tab.badge}
                                </span>
                            ` : ''}
                        </button>
                    `).join('')}
                </div>
            </nav>

            <!-- Shell Desktop + Contenu dynamique -->
            <div class="w-full max-w-7xl mx-auto flex flex-1 items-start">
                <!-- Sidebar Desktop (>= lg) -->
                <aside class="hidden lg:flex flex-col w-64 p-4 border-r border-slate-200/80 bg-white sticky top-[53px] h-[calc(100vh-53px)] shrink-0 justify-between">
                    <div class="flex flex-col gap-1.5">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 py-1">
                            Navigation Centrale
                        </span>
                        ${navTabs.map(tab => `
                            <button 
                                data-tab-target="${tab.id}"
                                id="admin-sidebar-${tab.id}"
                                class="flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all min-h-[42px] cursor-pointer group ${
                                    activeTab === tab.id
                                        ? 'bg-slate-900 text-white shadow-sm'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                }"
                            >
                                <div class="flex items-center gap-3">
                                    <i class="fa-solid ${tab.icon} text-xs w-4 text-center ${activeTab === tab.id ? 'text-accent' : 'text-slate-400 group-hover:text-slate-700'}"></i>
                                    <span>${tab.label}</span>
                                </div>
                                ${tab.badge !== null ? `
                                    <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold leading-none ${
                                        activeTab === tab.id 
                                            ? 'bg-slate-800 text-accent' 
                                            : (tab.badgeAlert ? 'bg-amber-100 text-amber-800 animate-pulse' : 'bg-slate-100 text-slate-600')
                                    }">
                                        ${tab.badge}
                                    </span>
                                ` : ''}
                            </button>
                        `).join('')}
                    </div>

                    <div class="pt-4 border-t border-slate-100 flex flex-col gap-2">
                        <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center gap-2.5">
                            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                            <div class="min-w-0 flex-1">
                                <span class="text-[11px] font-bold text-slate-900 block truncate">Système UIDT Actif</span>
                                <span class="text-[10px] text-slate-500 block truncate">Session superviseur</span>
                            </div>
                        </div>
                    </div>
                </aside>

                <!-- Zone de contenu dynamique pour l'onglet actif -->
                <main class="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 bg-slate-50/40">
                    <div id="admin-tab-content" class="w-full">
                        ${activeTab === 'overview' ? renderOverviewTab() : ''}
                        ${activeTab === 'sellers' ? renderSellersTab() : ''}
                        ${activeTab === 'accounts' ? renderAccountsTab() : ''}
                        ${activeTab === 'products' ? renderProductsTab() : ''}
                        ${activeTab === 'orders' ? renderOrdersTab() : ''}
                        ${activeTab === 'locations' ? renderLocationsTab() : ''}
                    </div>
                </main>
            </div>
        `;

        bindEvents();
    }

    function renderOverviewTab() {
        const m = metrics || {
            activeSellersCount: 0,
            pendingSellersCount: 0,
            totalOrdersCount: 0,
            totalDeliveredRevenue: 0,
            totalSubscriptionRevenue: 0,
            sellerMonthlyFee: 2000,
        };

        const deliveredOrdersCount = allOrders.filter((o) => o.status === 'delivered').length;

        return `
            <div class="flex flex-col gap-5 sm:gap-6">
                <!-- Grille Bento KPI réelles (4 Métriques Clés : 2 col mobile / 4 col desktop) -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                    <!-- Marchands certifiés -->
                    <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <div class="flex items-center justify-between text-slate-500 mb-2">
                            <span class="text-xs font-semibold text-slate-600 truncate">Marchands certifiés</span>
                            <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0">
                                <i class="fa-solid fa-store"></i>
                            </div>
                        </div>
                        <span class="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">${m.activeSellersCount}</span>
                        <span class="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-1">
                            <i class="fa-solid fa-circle-check text-[9px]"></i> Boutiques actives
                        </span>
                    </div>

                    <!-- Demandes en attente -->
                    <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden">
                        <div class="flex items-center justify-between text-slate-500 mb-2">
                            <span class="text-xs font-semibold text-slate-600 truncate">Demandes d'adhésion</span>
                            <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs shrink-0">
                                <i class="fa-solid fa-hourglass-half"></i>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">${m.pendingSellersCount}</span>
                            ${m.pendingSellersCount > 0 ? `
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 animate-pulse">
                                    Action
                                </span>
                            ` : ''}
                        </div>
                        <span class="text-[11px] font-medium text-slate-400 mt-1">Candidatures</span>
                    </div>

                    <!-- Total Commandes -->
                    <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <div class="flex items-center justify-between text-slate-500 mb-2">
                            <span class="text-xs font-semibold text-slate-600 truncate">Total Commandes</span>
                            <div class="w-8 h-8 rounded-xl bg-blue-50 text-primary flex items-center justify-center text-xs shrink-0">
                                <i class="fa-solid fa-boxes-packing"></i>
                            </div>
                        </div>
                        <span class="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">${m.totalOrdersCount}</span>
                        <span class="text-[11px] font-medium text-slate-400 mt-1">Transactions campus</span>
                    </div>

                    <!-- Volume d'affaires vendeur -->
                    <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <div class="flex items-center justify-between text-slate-500 mb-2">
                            <span class="text-xs font-semibold text-slate-600 truncate">Volume d'affaires</span>
                            <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0">
                                <i class="fa-solid fa-coins"></i>
                            </div>
                        </div>
                        <span class="font-heading font-extrabold text-xl sm:text-2xl text-emerald-600 tracking-tight tabular-nums">
                            ${Number(m.totalDeliveredRevenue).toLocaleString('fr-FR')} <span class="text-xs font-bold text-slate-500">FCFA</span>
                        </span>
                        <span class="text-[11px] font-medium text-slate-400 mt-1">Commandes livrées</span>
                    </div>
                </div>

                <!-- Analyse Financière et Modèle Économique UIDT -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
                        <div class="flex items-center justify-between gap-3">
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs shrink-0">
                                    <i class="fa-solid fa-hand-holding-dollar"></i>
                                </div>
                                <div>
                                    <h3 class="font-heading font-bold text-sm text-slate-900">Abonnements Plateforme</h3>
                                    <p class="text-xs text-slate-500">${m.activeSellersCount} marchands certifiés actifs</p>
                                </div>
                            </div>
                            <span class="font-heading font-extrabold text-lg text-indigo-600 tabular-nums">
                                ${Number(m.totalSubscriptionRevenue || 0).toLocaleString('fr-FR')} FCFA
                            </span>
                        </div>
                        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span class="text-[11px] text-slate-400">Recettes récurrentes (2 000 F / boutique)</span>
                            <button data-jump-tab="sellers" class="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-1 active:scale-95 cursor-pointer">
                                <span>Gérer</span>
                                <i class="fa-solid fa-arrow-right text-[10px]"></i>
                            </button>
                        </div>
                    </div>

                    <div class="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
                        <div class="flex items-center justify-between gap-3">
                            <div class="flex items-center gap-2.5">
                                <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0">
                                    <i class="fa-solid fa-chart-line"></i>
                                </div>
                                <div>
                                    <h3 class="font-heading font-bold text-sm text-slate-900">Volume d'Affaires Brut (GMV)</h3>
                                    <p class="text-xs text-slate-500">${deliveredOrdersCount} commande${deliveredOrdersCount > 1 ? 's' : ''} livrée${deliveredOrdersCount > 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            <span class="font-heading font-extrabold text-lg text-emerald-600 tabular-nums">
                                ${Number(m.totalDeliveredRevenue).toLocaleString('fr-FR')} FCFA
                            </span>
                        </div>
                        <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <span class="text-[11px] text-slate-400">Transactions Pavillon-à-Pavillon</span>
                            <button data-jump-tab="orders" class="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-1 active:scale-95 cursor-pointer">
                                <span>Consulter</span>
                                <i class="fa-solid fa-arrow-right text-[10px]"></i>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Raccourcis Opérationnels et Actions Rapides -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button data-jump-tab="sellers" class="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-amber-300 hover:shadow-xs transition-all text-left flex items-center gap-3 group active:scale-95 cursor-pointer min-h-[44px]">
                        <div class="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs shrink-0 group-hover:scale-105 transition-transform">
                            <i class="fa-solid fa-user-plus"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <span class="font-heading font-bold text-xs sm:text-sm text-slate-900 block truncate">Candidatures</span>
                            <span class="text-[11px] text-slate-500 block truncate">${m.pendingSellersCount} en attente</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-slate-300 text-xs group-hover:text-amber-500 transition-colors"></i>
                    </button>

                    <button data-jump-tab="accounts" class="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-blue-300 hover:shadow-xs transition-all text-left flex items-center gap-3 group active:scale-95 cursor-pointer min-h-[44px]">
                        <div class="w-9 h-9 rounded-xl bg-blue-50 text-primary flex items-center justify-center text-xs shrink-0 group-hover:scale-105 transition-transform">
                            <i class="fa-solid fa-id-card-clip"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <span class="font-heading font-bold text-xs sm:text-sm text-slate-900 block truncate">Gestion Comptes</span>
                            <span class="text-[11px] text-slate-500 block truncate">${allProfiles.length || 0} profils</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-slate-300 text-xs group-hover:text-primary transition-colors"></i>
                    </button>

                    <button data-jump-tab="locations" class="p-3.5 bg-white rounded-2xl border border-slate-200/80 hover:border-emerald-300 hover:shadow-xs transition-all text-left flex items-center gap-3 group active:scale-95 cursor-pointer min-h-[44px]">
                        <div class="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0 group-hover:scale-105 transition-transform">
                            <i class="fa-solid fa-map-location-dot"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <span class="font-heading font-bold text-xs sm:text-sm text-slate-900 block truncate">Zones Livraison</span>
                            <span class="text-[11px] text-slate-500 block truncate">${deliveryLocations.length} lieux</span>
                        </div>
                        <i class="fa-solid fa-chevron-right text-slate-300 text-xs group-hover:text-emerald-500 transition-colors"></i>
                    </button>
                </div>
            </div>
        `;
    }

    function renderAccountsTab() {
        const query = (accountSearchQuery || '').toLowerCase().trim();
        const matchesQuery = (p) => {
            if (!query) return true;
            return (
                (p.prenom || '').toLowerCase().includes(query) ||
                (p.nom || '').toLowerCase().includes(query) ||
                (p.telephone || '').toLowerCase().includes(query) ||
                (p.email || '').toLowerCase().includes(query) ||
                (p.role || '').toLowerCase().includes(query)
            );
        };

        const filtered = allProfiles.filter((p) => {
            if (!matchesQuery(p)) return false;
            const suspended = isSellerSuspended(p);
            if (accountRoleFilter === 'acheteur') return p.role === 'acheteur';
            if (accountRoleFilter === 'vendeur') return (p.role === 'vendeur' || p.role === 'vendeur_pending') && !suspended;
            if (accountRoleFilter === 'superadmin') return p.role === 'superadmin';
            if (accountRoleFilter === 'suspendu') return suspended;
            return true;
        });

        return `
            <div class="flex flex-col gap-5">
                <!-- Barre d'outils comptes -->
                <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div class="relative flex-1 max-w-md">
                        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input 
                            type="text" 
                            id="admin-account-search" 
                            placeholder="Rechercher par nom, téléphone, email..." 
                            value="${escapeHTML(accountSearchQuery)}"
                            class="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[40px]"
                        >
                        ${accountSearchQuery ? `
                            <button id="btn-clear-account-search" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                                <i class="fa-solid fa-circle-xmark text-xs"></i>
                            </button>
                        ` : ''}
                    </div>

                    <!-- Filtres rôles -->
                    <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                        <button type="button" data-account-filter="all" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer min-h-[36px] ${accountRoleFilter === 'all' ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
                            Tous (${allProfiles.length})
                        </button>
                        <button type="button" data-account-filter="acheteur" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer min-h-[36px] ${accountRoleFilter === 'acheteur' ? 'bg-blue-600 text-white shadow-xs' : 'bg-blue-50 text-blue-800 hover:bg-blue-100'}">
                            Acheteurs
                        </button>
                        <button type="button" data-account-filter="vendeur" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer min-h-[36px] ${accountRoleFilter === 'vendeur' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}">
                            Vendeurs
                        </button>
                        <button type="button" data-account-filter="suspendu" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer min-h-[36px] ${accountRoleFilter === 'suspendu' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'}">
                            Suspendus
                        </button>
                        <button type="button" data-account-filter="superadmin" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer min-h-[36px] ${accountRoleFilter === 'superadmin' ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
                            SuperAdmin
                        </button>
                    </div>
                </div>

                <!-- Liste des comptes -->
                <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                    <div class="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 class="font-heading font-extrabold text-base text-slate-900">Comptes Utilisateurs</h2>
                            <p class="text-xs text-slate-500">Supervision des rôles et statuts d'accès de la plateforme</p>
                        </div>
                        <span class="text-xs text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-full">${filtered.length} compte${filtered.length > 1 ? 's' : ''}</span>
                    </div>

                    ${filtered.length === 0 ? `
                        <div class="text-center py-12 text-slate-400 text-xs">Aucun compte ne correspond à votre filtre.</div>
                    ` : `
                        <!-- Version Desktop (Tableau HTML stylisé) -->
                        <div class="hidden md:block overflow-x-auto">
                            <table class="w-full text-left text-xs border-collapse">
                                <thead class="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200/80">
                                    <tr>
                                        <th class="py-3 px-4">Utilisateur</th>
                                        <th class="py-3 px-4">Rôle</th>
                                        <th class="py-3 px-4">Téléphone</th>
                                        <th class="py-3 px-4">Inscription</th>
                                        <th class="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${filtered.map((prof) => {
                                        const suspended = isSellerSuspended(prof);
                                        const isSelf = currentAdmin?.id === prof.id;

                                        return `
                                            <tr class="even:bg-slate-50/40 hover:bg-slate-50/80 transition-colors">
                                                <td class="py-3 px-4">
                                                    <div class="flex items-center gap-3">
                                                        <div class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                                            suspended ? 'bg-rose-100 text-rose-700' : prof.role === 'superadmin' ? 'bg-slate-900 text-accent' : prof.role === 'vendeur' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                                        }">
                                                            ${((prof.prenom?.[0] || '') + (prof.nom?.[0] || '')).toUpperCase() || 'U'}
                                                        </div>
                                                        <div class="min-w-0">
                                                            <div class="flex items-center gap-1.5">
                                                                <span class="font-bold text-slate-900 block truncate">${escapeHTML(prof.prenom || '')} ${escapeHTML(prof.nom || '')}</span>
                                                                ${isSelf ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-200 text-slate-700">Vous</span>` : ''}
                                                            </div>
                                                            ${prof.email ? `<span class="text-[11px] text-slate-400 block truncate">${escapeHTML(prof.email)}</span>` : ''}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td class="py-3 px-4">
                                                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                        suspended ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                        prof.role === 'superadmin' ? 'bg-slate-900 text-accent' :
                                                        prof.role === 'vendeur' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                                                        prof.role === 'vendeur_pending' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                                                        'bg-blue-50 text-blue-700 border border-blue-200'
                                                    }">
                                                        ${suspended ? 'Suspendu' : prof.role === 'superadmin' ? 'SuperAdmin' : prof.role === 'vendeur' ? 'Vendeur' : prof.role === 'vendeur_pending' ? 'Candidat' : 'Acheteur'}
                                                    </span>
                                                </td>
                                                <td class="py-3 px-4 text-slate-600">
                                                    ${escapeHTML(prof.telephone || 'Non renseigné')}
                                                </td>
                                                <td class="py-3 px-4 text-slate-400 text-[11px]">
                                                    ${prof.created_at ? new Date(prof.created_at).toLocaleDateString('fr-FR') : '-'}
                                                </td>
                                                <td class="py-3 px-4 text-right">
                                                    ${!isSelf ? `
                                                        <div class="flex items-center justify-end gap-1.5">
                                                            <button 
                                                                type="button" 
                                                                data-action="toggle-account-suspend" 
                                                                data-id="${prof.id}" 
                                                                data-suspended="${suspended ? 'true' : 'false'}"
                                                                class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                                                                    suspended ? 'bg-emerald-600 text-white' : 'border border-rose-200 text-rose-600 hover:bg-rose-50'
                                                                }"
                                                            >
                                                                ${suspended ? 'Réactiver' : 'Suspendre'}
                                                            </button>
                                                            <button 
                                                                type="button" 
                                                                data-action="change-account-role" 
                                                                data-id="${prof.id}" 
                                                                data-current-role="${prof.role}" 
                                                                data-name="${escapeHTML(prof.prenom)} ${escapeHTML(prof.nom)}"
                                                                class="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                                                            >
                                                                Rôle
                                                            </button>
                                                            <button 
                                                                type="button" 
                                                                data-action="delete-account" 
                                                                data-id="${prof.id}" 
                                                                data-name="${escapeHTML(prof.prenom)} ${escapeHTML(prof.nom)}"
                                                                class="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors flex items-center justify-center cursor-pointer"
                                                                title="Supprimer définitivement"
                                                            >
                                                                <i class="fa-solid fa-trash-can text-xs"></i>
                                                            </button>
                                                        </div>
                                                    ` : ''}
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>

                        <!-- Version Mobile (< md) : Cartes compactes avec zones tactiles confortables -->
                        <div class="md:hidden flex flex-col divide-y divide-slate-100 p-3">
                            ${filtered.map((prof) => {
                                const suspended = isSellerSuspended(prof);
                                const isSelf = currentAdmin?.id === prof.id;

                                return `
                                    <div class="py-3 flex flex-col gap-2.5">
                                        <div class="flex items-center gap-3">
                                            <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                                suspended ? 'bg-rose-100 text-rose-700' : prof.role === 'superadmin' ? 'bg-slate-900 text-accent' : prof.role === 'vendeur' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                                            }">
                                                ${((prof.prenom?.[0] || '') + (prof.nom?.[0] || '')).toUpperCase() || 'U'}
                                            </div>
                                            <div class="min-w-0 flex-1">
                                                <div class="flex items-center gap-1.5 flex-wrap">
                                                    <span class="font-bold text-slate-900 text-sm truncate">${escapeHTML(prof.prenom || '')} ${escapeHTML(prof.nom || '')}</span>
                                                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                        suspended ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                        prof.role === 'superadmin' ? 'bg-slate-900 text-accent' :
                                                        prof.role === 'vendeur' ? 'bg-emerald-50 text-emerald-800' :
                                                        'bg-blue-50 text-blue-700'
                                                    }">
                                                        ${suspended ? 'Suspendu' : prof.role === 'superadmin' ? 'SuperAdmin' : prof.role === 'vendeur' ? 'Vendeur' : 'Acheteur'}
                                                    </span>
                                                    ${isSelf ? `<span class="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-200 text-slate-700">Vous</span>` : ''}
                                                </div>
                                                <div class="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                                    <span><i class="fa-solid fa-phone text-[9px] mr-1"></i>${escapeHTML(prof.telephone || 'Non renseigné')}</span>
                                                    ${prof.email ? `<span>•</span><span class="truncate">${escapeHTML(prof.email)}</span>` : ''}
                                                </div>
                                            </div>
                                        </div>

                                        ${!isSelf ? `
                                            <div class="flex items-center gap-2 pt-1">
                                                <button 
                                                    type="button" 
                                                    data-action="toggle-account-suspend" 
                                                    data-id="${prof.id}" 
                                                    data-suspended="${suspended ? 'true' : 'false'}"
                                                    class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all min-h-[44px] active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                                                        suspended ? 'bg-emerald-600 text-white' : 'border border-rose-200 text-rose-600 bg-rose-50/50'
                                                    }"
                                                >
                                                    <i class="fa-solid ${suspended ? 'fa-rotate-left' : 'fa-ban'} text-[11px]"></i>
                                                    <span>${suspended ? 'Réactiver' : 'Suspendre'}</span>
                                                </button>
                                                <button 
                                                    type="button" 
                                                    data-action="change-account-role" 
                                                    data-id="${prof.id}" 
                                                    data-current-role="${prof.role}" 
                                                    data-name="${escapeHTML(prof.prenom)} ${escapeHTML(prof.nom)}"
                                                    class="py-2 px-3.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold min-h-[44px] cursor-pointer"
                                                >
                                                    Rôle
                                                </button>
                                                <button 
                                                    type="button" 
                                                    data-action="delete-account" 
                                                    data-id="${prof.id}" 
                                                    data-name="${escapeHTML(prof.prenom)} ${escapeHTML(prof.nom)}"
                                                    class="w-11 h-11 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                                                    title="Supprimer"
                                                >
                                                    <i class="fa-solid fa-trash-can text-xs"></i>
                                                </button>
                                            </div>
                                        ` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    function renderSellersTab() {
        const query = (sellerSearchQuery || '').toLowerCase().trim();
        const matchesQuery = (s) => {
            if (!query) return true;
            return (
                (s.prenom || '').toLowerCase().includes(query) ||
                (s.nom || '').toLowerCase().includes(query) ||
                (s.telephone || '').toLowerCase().includes(query) ||
                (s.shop_name || '').toLowerCase().includes(query) ||
                (s.email || '').toLowerCase().includes(query)
            );
        };

        const totalPending = pendingSellers.length;
        const activeCount = activeSellers.filter((s) => !isSellerSuspended(s)).length;
        const suspendedCount = activeSellers.filter((s) => isSellerSuspended(s)).length;
        const totalAccounts = totalPending + activeSellers.length;

        const filteredPending = pendingSellers.filter(matchesQuery);
        const filteredActive = activeSellers.filter((s) => {
            if (!matchesQuery(s)) return false;
            const suspended = isSellerSuspended(s);
            if (sellerFilterTab === 'active') return !suspended;
            if (sellerFilterTab === 'suspended') return suspended;
            return true;
        });

        const showPendingSection = (sellerFilterTab === 'all' || sellerFilterTab === 'pending') && (filteredPending.length > 0 || sellerFilterTab === 'pending');
        const showActiveSection = sellerFilterTab === 'all' || sellerFilterTab === 'active' || sellerFilterTab === 'suspended';

        return `
            <div class="flex flex-col gap-5">
                <!-- Barre d'outils marchands -->
                <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div class="relative flex-1 max-w-md">
                        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input 
                            type="text" 
                            id="admin-seller-search" 
                            placeholder="Rechercher nom, boutique, téléphone..." 
                            value="${escapeHTML(sellerSearchQuery)}"
                            class="w-full pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[40px]"
                        >
                        ${sellerSearchQuery ? `
                            <button id="btn-clear-seller-search" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                                <i class="fa-solid fa-circle-xmark text-xs"></i>
                            </button>
                        ` : ''}
                    </div>

                    <!-- Filtres statut -->
                    <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
                        <button type="button" data-seller-filter="all" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer min-h-[36px] ${sellerFilterTab === 'all' ? 'bg-primary text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">
                            Tous (${totalAccounts})
                        </button>
                        <button type="button" data-seller-filter="pending" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer min-h-[36px] flex items-center gap-1.5 ${sellerFilterTab === 'pending' ? 'bg-amber-500 text-white shadow-xs' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'}">
                            <span>En attente</span>
                            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${sellerFilterTab === 'pending' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'}">${totalPending}</span>
                        </button>
                        <button type="button" data-seller-filter="active" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer min-h-[36px] flex items-center gap-1.5 ${sellerFilterTab === 'active' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}">
                            <span>Actifs</span>
                            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${sellerFilterTab === 'active' ? 'bg-emerald-800 text-white' : 'bg-emerald-200 text-emerald-900'}">${activeCount}</span>
                        </button>
                        <button type="button" data-seller-filter="suspended" class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 cursor-pointer min-h-[36px] flex items-center gap-1.5 ${sellerFilterTab === 'suspended' ? 'bg-rose-600 text-white shadow-xs' : 'bg-rose-50 text-rose-800 hover:bg-rose-100'}">
                            <span>Suspendus</span>
                            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${sellerFilterTab === 'suspended' ? 'bg-rose-800 text-white' : 'bg-rose-200 text-rose-900'}">${suspendedCount}</span>
                        </button>
                    </div>
                </div>

                ${showPendingSection ? `
                    <!-- Demandes en attente -->
                    <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5 flex flex-col gap-3.5">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <h2 class="font-heading font-extrabold text-base text-slate-900">Demandes d'adhésion Vendeurs</h2>
                                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${filteredPending.length > 0 ? 'bg-amber-400 text-slate-950' : 'bg-slate-100 text-slate-600'}">
                                    ${filteredPending.length}
                                </span>
                            </div>
                        </div>

                        ${renderPendingSellersList(filteredPending)}
                    </div>
                ` : ''}

                ${showActiveSection ? `
                    <!-- Marchands enregistrés -->
                    <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                        <div class="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <h2 class="font-heading font-extrabold text-base text-slate-900">
                                    ${sellerFilterTab === 'suspended' ? 'Marchands Suspendus' : sellerFilterTab === 'active' ? 'Marchands Actifs' : 'Marchands Enregistrés'}
                                </h2>
                                <p class="text-xs text-slate-500">Supervision, disponibilité de boutique et modération</p>
                            </div>
                            <span class="text-xs text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-full">${filteredActive.length} compte${filteredActive.length > 1 ? 's' : ''}</span>
                        </div>

                        ${renderActiveSellersList(filteredActive)}
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderPendingSellersList(list = pendingSellers) {
        if (list.length === 0) {
            return `
                <div class="text-center py-6 text-slate-400">
                    <i class="fa-solid fa-circle-check text-emerald-500 text-2xl mb-1 block"></i>
                    <p class="text-xs font-semibold">Toutes les candidatures de vendeurs sont à jour.</p>
                </div>
            `;
        }

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                ${list.map((s) => `
                    <div class="p-4 rounded-2xl border border-amber-200/80 bg-amber-50/40 flex flex-col justify-between gap-3">
                        <div>
                            <div class="flex items-center justify-between">
                                <h3 class="font-heading font-bold text-slate-900 text-sm">
                                    ${escapeHTML(s.prenom)} ${escapeHTML(s.nom)}
                                </h3>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">En attente</span>
                            </div>
                            <p class="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                                <i class="fa-solid fa-phone text-slate-400 text-xs"></i>
                                <span>${escapeHTML(s.telephone || 'Non renseigné')}</span>
                            </p>
                            <p class="text-[11px] text-slate-400 mt-0.5">
                                Soumise le ${s.created_at ? new Date(s.created_at).toLocaleDateString('fr-FR') : 'Récemment'}
                            </p>
                        </div>

                        <div class="flex items-center gap-2 pt-2 border-t border-amber-200/60">
                            <button 
                                data-action="approve" 
                                data-id="${s.id}" 
                                class="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                            >
                                <i class="fa-solid fa-check text-xs"></i>
                                <span>Approuver</span>
                            </button>
                            <button 
                                data-action="reject" 
                                data-id="${s.id}" 
                                class="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 font-bold text-xs rounded-xl border border-rose-200 transition-all min-h-[44px] cursor-pointer"
                            >
                                Rejeter
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderActiveSellersList(list = activeSellers) {
        if (list.length === 0) {
            return `
                <div class="text-center py-10 text-slate-400 text-xs">
                    <i class="fa-solid fa-users-slash text-2xl text-slate-300 mb-2 block"></i>
                    Aucun marchand ne correspond à ces critères.
                </div>
            `;
        }

        return `
            <!-- Version Desktop (Tableau HTML stylisé) -->
            <div class="hidden md:block overflow-x-auto">
                <table class="w-full text-left text-xs border-collapse">
                    <thead class="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200/80">
                        <tr>
                            <th class="py-3 px-4">Marchand</th>
                            <th class="py-3 px-4">Articles</th>
                            <th class="py-3 px-4">Contact</th>
                            <th class="py-3 px-4">Disponibilité</th>
                            <th class="py-3 px-4">Statut Compte</th>
                            <th class="py-3 px-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${list.map((s) => {
                            const isSuspended = isSellerSuspended(s);
                            const prodCount = allProducts.filter((p) => p.seller_id === s.id).length;
                            const cleanPhone = (s.telephone || '').replace(/\D/g, '');
                            const waUrl = cleanPhone ? `https://wa.me/221${cleanPhone.slice(-9)}` : null;

                            return `
                                <tr class="even:bg-slate-50/40 hover:bg-slate-50/80 transition-colors">
                                    <td class="py-3 px-4">
                                        <div class="flex items-center gap-3">
                                            <div class="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                                isSuspended ? 'bg-slate-200 text-slate-500' : 'bg-primary/10 text-primary'
                                            }">
                                                ${((s.prenom?.[0] || '') + (s.nom?.[0] || '')).toUpperCase() || 'V'}
                                            </div>
                                            <div class="min-w-0">
                                                <span class="font-bold text-slate-900 block truncate">${escapeHTML(s.prenom)} ${escapeHTML(s.nom)}</span>
                                                <span class="text-[10px] text-slate-400 block">${escapeHTML(s.shop_name || 'Boutique')}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="py-3 px-4">
                                        <span class="font-semibold text-slate-700">${prodCount}</span>
                                        <span class="text-[10px] text-slate-400">produit${prodCount > 1 ? 's' : ''}</span>
                                    </td>
                                    <td class="py-3 px-4">
                                        <div class="flex items-center gap-2">
                                            <span class="text-slate-700">${escapeHTML(s.telephone || 'Non renseigné')}</span>
                                            ${waUrl ? `
                                                <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="text-emerald-600 hover:text-emerald-700" title="WhatsApp">
                                                    <i class="fa-brands fa-whatsapp"></i>
                                                </a>
                                            ` : ''}
                                        </div>
                                    </td>
                                    <td class="py-3 px-4">
                                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${s.is_open !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
                                            ${s.is_open !== false ? 'Ouverte' : 'En pause'}
                                        </span>
                                    </td>
                                    <td class="py-3 px-4">
                                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isSuspended ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
                                            ${isSuspended ? 'Suspendu' : 'Actif'}
                                        </span>
                                    </td>
                                    <td class="py-3 px-4 text-right">
                                        <div class="flex items-center justify-end gap-1.5">
                                            <button 
                                                type="button" 
                                                data-action="toggle-suspend" 
                                                data-id="${s.id}" 
                                                data-suspended="${isSuspended ? 'true' : 'false'}"
                                                class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer ${
                                                    isSuspended ? 'bg-emerald-600 text-white' : 'border border-rose-200 text-rose-600 hover:bg-rose-50'
                                                }"
                                            >
                                                ${isSuspended ? 'Réactiver' : 'Suspendre'}
                                            </button>
                                            <button 
                                                type="button" 
                                                data-action="revoke-seller" 
                                                data-id="${s.id}" 
                                                data-name="${escapeHTML(s.prenom)} ${escapeHTML(s.nom)}"
                                                class="px-2 py-1.5 rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50 text-xs font-semibold cursor-pointer"
                                                title="Rétrograder en simple acheteur"
                                            >
                                                Rétrograder
                                            </button>
                                            <button 
                                                type="button" 
                                                data-action="delete-seller" 
                                                data-id="${s.id}" 
                                                data-name="${escapeHTML(s.prenom)} ${escapeHTML(s.nom)}"
                                                class="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors flex items-center justify-center cursor-pointer"
                                                title="Supprimer"
                                            >
                                                <i class="fa-solid fa-trash-can text-xs"></i>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Version Mobile (< md) : Cartes compactes -->
            <div class="md:hidden flex flex-col divide-y divide-slate-100 p-3">
                ${list.map((s) => {
                    const isSuspended = isSellerSuspended(s);
                    const prodCount = allProducts.filter((p) => p.seller_id === s.id).length;
                    const cleanPhone = (s.telephone || '').replace(/\D/g, '');
                    const waUrl = cleanPhone ? `https://wa.me/221${cleanPhone.slice(-9)}` : null;

                    return `
                        <div class="py-3 flex flex-col gap-2.5">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                    isSuspended ? 'bg-slate-200 text-slate-500' : 'bg-primary/10 text-primary'
                                }">
                                    ${((s.prenom?.[0] || '') + (s.nom?.[0] || '')).toUpperCase() || 'V'}
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <span class="font-bold text-slate-900 text-sm truncate">${escapeHTML(s.prenom)} ${escapeHTML(s.nom)}</span>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isSuspended ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
                                            ${isSuspended ? 'Suspendu' : 'Actif'}
                                        </span>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-medium ${s.is_open !== false ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-800'}">
                                            ${s.is_open !== false ? 'Ouverte' : 'En pause'}
                                        </span>
                                    </div>
                                    <div class="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                        <span>${escapeHTML(s.telephone || 'Non renseigné')}</span>
                                        <span>•</span>
                                        <span>${prodCount} produit${prodCount > 1 ? 's' : ''}</span>
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-center gap-2 pt-1">
                                ${waUrl ? `
                                    <a 
                                        href="${waUrl}" 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        class="w-11 h-11 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 flex items-center justify-center min-h-[44px] min-w-[44px]"
                                        title="WhatsApp"
                                    >
                                        <i class="fa-brands fa-whatsapp text-sm"></i>
                                    </a>
                                ` : ''}

                                <button 
                                    type="button"
                                    data-action="toggle-suspend" 
                                    data-id="${s.id}" 
                                    data-suspended="${isSuspended ? 'true' : 'false'}"
                                    class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all min-h-[44px] active:scale-95 cursor-pointer flex items-center justify-center gap-1.5 ${
                                        isSuspended ? 'bg-emerald-600 text-white' : 'border border-rose-200 text-rose-600 bg-rose-50/50'
                                    }"
                                >
                                    <i class="fa-solid ${isSuspended ? 'fa-rotate-left' : 'fa-ban'} text-[11px]"></i>
                                    <span>${isSuspended ? 'Réactiver' : 'Suspendre'}</span>
                                </button>

                                <button 
                                    type="button" 
                                    data-action="revoke-seller" 
                                    data-id="${s.id}" 
                                    data-name="${escapeHTML(s.prenom)} ${escapeHTML(s.nom)}"
                                    class="py-2 px-3 rounded-xl border border-amber-200 text-amber-700 text-xs font-semibold min-h-[44px] cursor-pointer"
                                >
                                    Rétrograder
                                </button>

                                <button 
                                    type="button" 
                                    data-action="delete-seller" 
                                    data-id="${s.id}" 
                                    data-name="${escapeHTML(s.prenom)} ${escapeHTML(s.nom)}"
                                    class="w-11 h-11 rounded-xl border border-slate-200 text-slate-400 hover:text-rose-600 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                                    title="Supprimer"
                                >
                                    <i class="fa-solid fa-trash-can text-xs"></i>
                                </button>
                            </div>
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
            <div class="flex flex-col gap-5">
                <!-- Barre d'outils recherche produits -->
                <div class="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 class="font-heading font-extrabold text-base text-slate-900">Modération du Catalogue Produits</h2>
                        <p class="text-xs text-slate-500">Supervision et suppression des articles non conformes aux chartes UIDT</p>
                    </div>

                    <div class="relative w-full sm:w-72">
                        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input 
                            type="text" 
                            id="admin-product-search" 
                            value="${escapeHTML(productSearchQuery)}"
                            placeholder="Rechercher produit, vendeur..." 
                            class="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[40px]"
                        >
                    </div>
                </div>

                ${filtered.length === 0 ? `
                    <div class="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 text-xs">
                        <i class="fa-solid fa-box-open text-3xl text-slate-300 mb-2 block"></i>
                        Aucun produit ne correspond à votre recherche.
                    </div>
                ` : `
                    <!-- 1. Version Mobile (< md) : Cartes compactes horizontales (vignette w-24 h-24 object-cover arrondie à gauche, infos au centre, bouton supprimer à droite) -->
                    <div class="md:hidden flex flex-col gap-3">
                        ${filtered.map((prod) => {
                            const rawImg = prod.image_url;
                            const safeImg = (rawImg && rawImg.includes('photo-1611591475823-3882f0592965'))
                                ? 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600&auto=format&fit=crop&q=80'
                                : rawImg;
                            const sellerName = prod.seller ? `${prod.seller.prenom || ''} ${prod.seller.nom || ''}`.trim() : 'Vendeur UIDT';

                            return `
                                <div class="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
                                    <!-- Vignette carrée object-cover rounded-xl w-20 h-20 à gauche -->
                                    <div class="w-20 h-20 min-w-[5rem] rounded-xl overflow-hidden bg-slate-100 relative shrink-0 border border-slate-100 flex items-center justify-center">
                                        ${safeImg ? `
                                            <img 
                                                src="${escapeHTML(safeImg)}" 
                                                alt="${escapeHTML(prod.title)}" 
                                                loading="lazy"
                                                class="w-full h-full object-cover"
                                                onerror="this.onerror=null; this.src='/assets/placeholder.webp';"
                                            >
                                        ` : `
                                            <i class="fa-solid ${escapeHTML(prod.icon || 'fa-box')} text-2xl text-slate-400"></i>
                                        `}
                                    </div>

                                    <!-- Infos produit / prix / vendeur au centre -->
                                    <div class="min-w-0 flex-1 flex flex-col justify-between py-0.5">
                                        <div>
                                            <h4 class="font-heading font-bold text-xs sm:text-sm text-slate-900 truncate">${escapeHTML(prod.title)}</h4>
                                            <span class="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                ${escapeHTML(prod.category || 'Général')}
                                            </span>
                                        </div>
                                        <div class="mt-1.5 flex flex-col gap-0.5">
                                            <span class="font-heading font-extrabold text-sm text-primary tabular-nums">
                                                ${Number(prod.price).toLocaleString('fr-FR')} FCFA
                                            </span>
                                            <span class="text-[11px] text-slate-500 truncate flex items-center gap-1">
                                                <i class="fa-solid fa-store text-[9px] text-slate-400"></i>
                                                ${escapeHTML(sellerName)}
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Bouton supprimer/action à droite -->
                                    <button 
                                        data-action="delete-product" 
                                        data-id="${prod.id}" 
                                        title="Supprimer du catalogue"
                                        class="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 active:scale-95 transition-all shrink-0 cursor-pointer"
                                    >
                                        <i class="fa-solid fa-trash-can text-sm"></i>
                                    </button>
                                </div>
                            `;
                        }).join('')}
                    </div>

                    <!-- 2. Version Desktop (>= md) : Grille fluide soignée (grid-cols-3 xl:grid-cols-4) -->
                    <div class="hidden md:grid md:grid-cols-3 xl:grid-cols-4 gap-4.5">
                        ${filtered.map((prod) => {
                            const rawImg = prod.image_url;
                            const safeImg = (rawImg && rawImg.includes('photo-1611591475823-3882f0592965'))
                                ? 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?w=600&auto=format&fit=crop&q=80'
                                : rawImg;
                            const sellerName = prod.seller ? `${prod.seller.prenom || ''} ${prod.seller.nom || ''}`.trim() : 'Vendeur UIDT';

                            return `
                                <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-card hover:border-slate-300 transition-all flex flex-col overflow-hidden group">
                                    <div class="relative aspect-[4/3] w-full bg-slate-100 overflow-hidden flex items-center justify-center">
                                        ${safeImg ? `
                                            <img 
                                                src="${escapeHTML(safeImg)}" 
                                                alt="${escapeHTML(prod.title)}" 
                                                loading="lazy"
                                                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                onerror="this.onerror=null; this.src='/assets/placeholder.webp';"
                                            >
                                        ` : `
                                            <i class="fa-solid ${escapeHTML(prod.icon || 'fa-box')} text-3xl text-slate-400"></i>
                                        `}
                                        <span class="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full text-xs font-black bg-slate-900/90 text-accent backdrop-blur-md shadow-sm tabular-nums">
                                            ${Number(prod.price).toLocaleString('fr-FR')} F
                                        </span>
                                        <span class="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/95 text-slate-800 backdrop-blur-md shadow-xs">
                                            ${escapeHTML(prod.category || 'Général')}
                                        </span>
                                    </div>

                                    <div class="p-4 flex flex-col justify-between flex-1">
                                        <div>
                                            <h4 class="font-heading font-bold text-sm text-slate-900 truncate" title="${escapeHTML(prod.title)}">
                                                ${escapeHTML(prod.title)}
                                            </h4>
                                            <div class="flex items-center gap-1.5 mt-1 text-xs text-slate-500 truncate">
                                                <i class="fa-solid fa-store text-[10px] text-slate-400"></i>
                                                <span class="truncate">${escapeHTML(sellerName)}</span>
                                            </div>
                                        </div>

                                        <button 
                                            data-action="delete-product" 
                                            data-id="${prod.id}" 
                                            class="w-full mt-3.5 py-2 px-3 rounded-xl border border-rose-200/80 bg-rose-50/40 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer min-h-[38px]"
                                        >
                                            <i class="fa-solid fa-trash-can text-xs"></i>
                                            <span>Supprimer</span>
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

    function renderOrdersTab() {
        if (allOrders.length === 0) {
            return `
                <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-8 text-center text-slate-400 text-xs">
                    <i class="fa-solid fa-truck-ramp-box text-3xl text-slate-300 mb-2 block"></i>
                    Aucune commande enregistrée pour le moment.
                </div>
            `;
        }

        return `
            <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div class="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 class="font-heading font-extrabold text-base text-slate-900">Historique des Commandes</h2>
                        <p class="text-xs text-slate-500">Traçabilité des transactions et résolution directe des litiges campus</p>
                    </div>
                    <span class="text-xs text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-full">${allOrders.length} commande${allOrders.length > 1 ? 's' : ''}</span>
                </div>

                <!-- 1. Version Desktop (Tableau HTML stylisé avec Tailwind) -->
                <div class="hidden md:block overflow-x-auto">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead class="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200/80">
                            <tr>
                                <th class="py-3 px-4">Réf / Date</th>
                                <th class="py-3 px-4">Client</th>
                                <th class="py-3 px-4">Pavillon / Lieu</th>
                                <th class="py-3 px-4">Produit</th>
                                <th class="py-3 px-4">Montant</th>
                                <th class="py-3 px-4">Statut</th>
                                <th class="py-3 px-4 text-right">Action SuperAdmin</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100">
                            ${allOrders.map((ord) => {
                                const statusClass = ord.status === 'delivered'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold'
                                    : ord.status === 'cancelled'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                                    : ord.status === 'shipped'
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200 font-bold';

                                return `
                                    <tr class="even:bg-slate-50/40 hover:bg-slate-50/80 transition-colors">
                                        <td class="py-3 px-4">
                                            <span class="font-heading font-bold text-primary block">
                                                ${escapeHTML(ord.reference || ('#CMD-' + ord.id.slice(0, 6).toUpperCase()))}
                                            </span>
                                            <span class="text-[10px] text-slate-400">${new Date(ord.created_at).toLocaleDateString('fr-FR')}</span>
                                        </td>
                                        <td class="py-3 px-4">
                                            <span class="font-bold text-slate-900 block">${escapeHTML(ord.buyer_name || 'Invité')}</span>
                                            <a href="tel:${escapeHTML(ord.buyer_phone || '')}" class="text-[11px] text-slate-500 hover:text-primary">${escapeHTML(ord.buyer_phone || '')}</a>
                                        </td>
                                        <td class="py-3 px-4 text-slate-600">
                                            ${escapeHTML(ord.delivery_address || 'Non spécifié')}
                                        </td>
                                        <td class="py-3 px-4">
                                            <span class="font-medium text-slate-800">${escapeHTML(ord.product?.title || 'Article')}</span>
                                            <span class="text-[10px] text-slate-400 block">(x${ord.quantity || 1})</span>
                                        </td>
                                        <td class="py-3 px-4 font-extrabold text-slate-900 tabular-nums">
                                            ${Number(ord.price).toLocaleString('fr-FR')} F
                                        </td>
                                        <td class="py-3 px-4">
                                            <span class="px-2.5 py-0.5 rounded-full text-[10px] ${statusClass}">
                                                ${escapeHTML(ord.status || 'pending')}
                                            </span>
                                        </td>
                                        <td class="py-3 px-4 text-right">
                                            <select 
                                                data-action="change-order-status" 
                                                data-id="${ord.id}"
                                                class="px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer min-h-[36px]"
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
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- 2. Version Cartes pour Mobile (< md) : Padding réduit, badges contrastés, zones confortables -->
                <div class="md:hidden flex flex-col gap-3 p-3">
                    ${allOrders.map((ord) => {
                        const statusClass = ord.status === 'delivered'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold'
                            : ord.status === 'cancelled'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 font-bold'
                            : ord.status === 'shipped'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 font-bold'
                            : 'bg-amber-50 text-amber-700 border border-amber-200 font-bold';

                        return `
                            <div class="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 flex flex-col gap-2.5">
                                <div class="flex items-center justify-between border-b border-slate-200/60 pb-2">
                                    <div>
                                        <span class="font-heading font-extrabold text-sm text-primary block">
                                            ${escapeHTML(ord.reference || ('#CMD-' + ord.id.slice(0, 6).toUpperCase()))}
                                        </span>
                                        <span class="text-[10px] text-slate-400">${new Date(ord.created_at).toLocaleDateString('fr-FR')}</span>
                                    </div>
                                    <span class="px-2.5 py-0.5 rounded-full text-[10px] ${statusClass}">
                                        ${escapeHTML(ord.status || 'pending')}
                                    </span>
                                </div>

                                <div class="grid grid-cols-2 gap-2 text-xs">
                                    <div>
                                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Client</span>
                                        <span class="font-bold text-slate-900 block truncate">${escapeHTML(ord.buyer_name || 'Invité')}</span>
                                        <a href="tel:${escapeHTML(ord.buyer_phone || '')}" class="text-[11px] text-primary hover:underline">${escapeHTML(ord.buyer_phone || '')}</a>
                                    </div>
                                    <div>
                                        <span class="text-[10px] text-slate-400 font-bold uppercase block">Lieu Livraison</span>
                                        <span class="text-slate-700 block truncate">${escapeHTML(ord.delivery_address || 'Non spécifié')}</span>
                                    </div>
                                </div>

                                <div class="flex items-center justify-between border-t border-slate-200/60 pt-2.5">
                                    <div class="min-w-0 flex-1 pr-2">
                                        <span class="text-xs font-semibold text-slate-800 block truncate">${escapeHTML(ord.product?.title || 'Article')} (x${ord.quantity || 1})</span>
                                        <span class="font-heading font-extrabold text-sm text-slate-900 block mt-0.5 tabular-nums">${Number(ord.price).toLocaleString('fr-FR')} FCFA</span>
                                    </div>

                                    <div class="w-36 shrink-0">
                                        <select 
                                            data-action="change-order-status" 
                                            data-id="${ord.id}"
                                            class="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer min-h-[44px]"
                                        >
                                            <option value="" disabled selected>Modifier...</option>
                                            <option value="pending" ${ord.status === 'pending' ? 'disabled' : ''}>En attente</option>
                                            <option value="confirmed" ${ord.status === 'confirmed' ? 'disabled' : ''}>Confirmée</option>
                                            <option value="shipped" ${ord.status === 'shipped' ? 'disabled' : ''}>Expédiée</option>
                                            <option value="delivered" ${ord.status === 'delivered' ? 'disabled' : ''}>Livrée</option>
                                            <option value="cancelled" ${ord.status === 'cancelled' ? 'disabled' : ''}>Annuler</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }

    function renderLocationsTab() {
        return `
            <div class="flex flex-col gap-5">
                <!-- Formulaire d'ajout d'un lieu -->
                <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-3">
                    <div>
                        <h3 class="font-heading font-extrabold text-base text-slate-900">Ajouter un Lieu ou Pavillon de Livraison</h3>
                        <p class="text-xs text-slate-500">Disponible immédiatement pour les étudiants lors de la commande</p>
                    </div>
                    <form id="form-add-location" class="flex flex-col sm:flex-row gap-3 items-end">
                        <div class="flex-1 w-full">
                            <label class="block text-xs font-bold text-slate-700 mb-1" for="new-location-name">Nom du site ou pavillon *</label>
                            <input 
                                type="text" 
                                id="new-location-name" 
                                placeholder="Ex: Site ENSA, Pavillon D, Amphi B..." 
                                required
                                class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all min-h-[44px]"
                            >
                        </div>
                        <div class="w-full sm:w-56">
                            <label class="block text-xs font-bold text-slate-700 mb-1" for="new-location-category">Catégorie</label>
                            <select 
                                id="new-location-category" 
                                class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all min-h-[44px]"
                            >
                                <option value="pavillon">Pavillon Résidence</option>
                                <option value="site">Site Pédagogique</option>
                                <option value="bu">Bibliothèque (BU)</option>
                                <option value="autre">Autre Espace</option>
                            </select>
                        </div>
                        <button 
                            type="submit" 
                            id="btn-submit-location"
                            class="w-full sm:w-auto px-5 py-2.5 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                        >
                            <i class="fa-solid fa-plus"></i>
                            <span>Ajouter</span>
                        </button>
                    </form>
                </div>

                <!-- Liste des lieux configurés -->
                <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                    <div class="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h3 class="font-heading font-extrabold text-base text-slate-900">Lieux et Pavillons de Livraison</h3>
                            <p class="text-xs text-slate-500">Activez ou désactivez les zones selon la disponibilité</p>
                        </div>
                        <span class="text-xs text-slate-500 font-bold bg-slate-100 px-2.5 py-1 rounded-full">${deliveryLocations.length} lieu${deliveryLocations.length > 1 ? 'x' : ''}</span>
                    </div>

                    ${deliveryLocations.length === 0 ? `
                        <div class="text-center py-10 text-slate-400 text-xs">Aucun lieu configuré pour le moment.</div>
                    ` : `
                        <!-- Version Desktop (Tableau HTML stylisé) -->
                        <div class="hidden md:block overflow-x-auto">
                            <table class="w-full text-left text-xs border-collapse">
                                <thead class="bg-slate-50 text-slate-500 uppercase font-semibold text-[11px] border-b border-slate-200/80">
                                    <tr>
                                        <th class="py-3 px-4">Nom du lieu</th>
                                        <th class="py-3 px-4">Catégorie</th>
                                        <th class="py-3 px-4">Statut</th>
                                        <th class="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${deliveryLocations.map((loc) => `
                                        <tr class="even:bg-slate-50/40 hover:bg-slate-50/80 transition-colors">
                                            <td class="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                                                <i class="fa-solid fa-location-dot text-primary text-xs"></i>
                                                <span>${escapeHTML(loc.name)}</span>
                                            </td>
                                            <td class="py-3 px-4">
                                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                                    ${escapeHTML(loc.category || 'pavillon')}
                                                </span>
                                            </td>
                                            <td class="py-3 px-4">
                                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                                    loc.is_active 
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                        : 'bg-slate-100 text-slate-500'
                                                }">
                                                    ${loc.is_active ? 'Actif' : 'Désactivé'}
                                                </span>
                                            </td>
                                            <td class="py-3 px-4 text-right">
                                                <div class="flex items-center justify-end gap-1.5">
                                                    <button 
                                                        data-action="toggle-location" 
                                                        data-id="${loc.id}" 
                                                        data-active="${loc.is_active}"
                                                        class="px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-all active:scale-95 cursor-pointer ${
                                                            loc.is_active 
                                                                ? 'border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100' 
                                                                : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                                                        }"
                                                    >
                                                        ${loc.is_active ? 'Désactiver' : 'Activer'}
                                                    </button>
                                                    <button 
                                                        data-action="delete-location" 
                                                        data-id="${loc.id}" 
                                                        data-name="${escapeHTML(loc.name)}"
                                                        class="w-8 h-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center justify-center cursor-pointer"
                                                        title="Supprimer ce lieu"
                                                    >
                                                        <i class="fa-solid fa-trash-can text-xs"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>

                        <!-- Version Mobile (Cartes avec boutons tactiles min-h-[44px]) -->
                        <div class="md:hidden flex flex-col gap-2.5 p-3">
                            ${deliveryLocations.map((loc) => `
                                <div class="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3 flex items-center justify-between gap-3">
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-1.5">
                                            <i class="fa-solid fa-location-dot text-primary text-xs shrink-0"></i>
                                            <span class="font-bold text-slate-900 text-xs sm:text-sm truncate">${escapeHTML(loc.name)}</span>
                                        </div>
                                        <div class="flex items-center gap-1.5 mt-1">
                                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border border-slate-200 text-slate-600">
                                                ${escapeHTML(loc.category || 'pavillon')}
                                            </span>
                                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${loc.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-200 text-slate-500'}">
                                                ${loc.is_active ? 'Actif' : 'Désactivé'}
                                            </span>
                                        </div>
                                    </div>

                                    <div class="flex items-center gap-1.5 shrink-0">
                                        <button 
                                            data-action="toggle-location" 
                                            data-id="${loc.id}" 
                                            data-active="${loc.is_active}"
                                            class="px-3 py-2 text-xs font-bold rounded-xl border transition-all active:scale-95 min-h-[44px] cursor-pointer ${
                                                loc.is_active 
                                                    ? 'border-amber-200 text-amber-800 bg-amber-50' 
                                                    : 'border-emerald-200 text-emerald-800 bg-emerald-50'
                                            }"
                                        >
                                            ${loc.is_active ? 'Pause' : 'Activer'}
                                        </button>
                                        <button 
                                            data-action="delete-location" 
                                            data-id="${loc.id}" 
                                            data-name="${escapeHTML(loc.name)}"
                                            class="w-11 h-11 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors flex items-center justify-center min-h-[44px] min-w-[44px] cursor-pointer"
                                            title="Supprimer"
                                        >
                                            <i class="fa-solid fa-trash-can text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    function renderLoginModal() {
        containerEl.innerHTML = `
            <div class="w-full max-w-md mx-auto my-12 bg-white rounded-3xl shadow-2xl border border-slate-200/80 p-6 sm:p-7 flex flex-col gap-5 view-transition-enter">
                <div class="flex items-center gap-3.5">
                    <img src="/assets/logo.webp" alt="Campus Market" class="h-11 w-auto object-contain" onerror="this.src='/assets/logo.webp'">
                    <div>
                        <h2 class="font-heading font-extrabold text-base sm:text-lg text-slate-900 leading-tight">Portail Administrateur</h2>
                        <p class="text-xs text-slate-500">Accès institutionnel réservé à l'UIDT</p>
                    </div>
                </div>

                <div id="admin-login-error" class="hidden p-3.5 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-600 font-medium"></div>

                <form id="superadmin-login-form" class="flex flex-col gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 mb-1" for="admin-login-email">Email institutionnel SuperAdmin</label>
                        <input type="email" id="admin-login-email" required placeholder="admin@univ-thies.sn" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-700 mb-1" for="admin-login-password">Mot de passe</label>
                        <input type="password" id="admin-login-password" required placeholder="••••••••" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none transition-all">
                    </div>

                    <div class="flex items-center gap-2.5 pt-2">
                        <button type="submit" id="btn-admin-submit" class="flex-1 py-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-heading font-bold text-xs sm:text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 min-h-[46px]">
                            <i class="fa-solid fa-key text-xs"></i>
                            <span>Connexion sécurisée</span>
                        </button>
                        <button type="button" id="btn-admin-cancel" class="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-2xl transition-colors min-h-[46px]">
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
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authentification...`;
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
        // 1. Header SuperAdmin
        containerEl.querySelector('#hdr-btn-refresh-admin')?.addEventListener('click', loadAdminData);
        containerEl.querySelector('#btn-refresh-admin')?.addEventListener('click', loadAdminData);

        containerEl.querySelector('#hdr-btn-admin-view-site')?.addEventListener('click', () => {
            if (typeof onBackToCatalog === 'function') {
                onBackToCatalog();
            } else if (typeof onExit === 'function') {
                onExit();
            }
        });

        const exitAdminHandler = async () => {
            await supabase.auth.signOut();
            isAuthenticated = false;
            currentAdmin = null;
            if (typeof onExit === 'function') onExit();
        };
        containerEl.querySelector('#hdr-btn-exit-admin')?.addEventListener('click', exitAdminHandler);
        containerEl.querySelector('#btn-exit-admin')?.addEventListener('click', exitAdminHandler);

        // 2. Navigation d'onglets (Sidebar desktop + Navbar mobile via data-tab-target et rétrocompatibilité)
        containerEl.querySelectorAll('[data-tab-target]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab-target');
                if (targetTab && activeTab !== targetTab) {
                    activeTab = targetTab;
                    render();
                }
            });
        });

        const legacyTabMappings = [
            { id: '#tab-admin-sellers', tab: 'sellers' },
            { id: '#tab-admin-products', tab: 'products' },
            { id: '#tab-admin-orders', tab: 'orders' },
            { id: '#tab-admin-locations', tab: 'locations' },
        ];

        legacyTabMappings.forEach(({ id, tab }) => {
            containerEl.querySelector(id)?.addEventListener('click', () => {
                if (activeTab !== tab) {
                    activeTab = tab;
                    render();
                }
            });
        });

        // 3. Raccourcis rapides [data-jump-tab]
        containerEl.querySelectorAll('[data-jump-tab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-jump-tab');
                if (targetTab && activeTab !== targetTab) {
                    activeTab = targetTab;
                    render();
                }
            });
        });

        // Modale d'attribution/modification de rôle
        function openRoleModal(userId, currentRole, userName) {
            const modal = document.createElement('div');
            modal.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in';
            modal.innerHTML = `
                <div class="bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 max-w-sm sm:max-w-md w-full flex flex-col gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg flex-shrink-0">
                            <i class="fa-solid fa-arrows-spin"></i>
                        </div>
                        <div>
                            <h3 class="font-heading font-extrabold text-slate-900 text-base leading-snug">Modifier le Rôle</h3>
                            <p class="text-xs text-slate-500">${escapeHTML(userName)}</p>
                        </div>
                    </div>
                    <div class="flex flex-col gap-2">
                        <label class="text-xs font-semibold text-slate-700">Sélectionnez le nouveau statut pour cet utilisateur :</label>
                        <select id="modal-select-role" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary font-medium">
                            <option value="acheteur" ${currentRole === 'acheteur' ? 'selected' : ''}>Acheteur (Étudiant acheteur standard)</option>
                            <option value="vendeur" ${currentRole === 'vendeur' ? 'selected' : ''}>Vendeur (Peut créer et gérer une boutique)</option>
                            <option value="superadmin" ${currentRole === 'superadmin' ? 'selected' : ''}>SuperAdmin (Droits complets de modération)</option>
                        </select>
                    </div>
                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                        <button type="button" id="btn-cancel-role-modal" class="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 active:scale-95 transition-all">Annuler</button>
                        <button type="button" id="btn-confirm-role-modal" class="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover active:scale-95 shadow-sm transition-all">Enregistrer</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector('#btn-cancel-role-modal').addEventListener('click', () => modal.remove());
            modal.querySelector('#btn-confirm-role-modal').addEventListener('click', async () => {
                const newRole = modal.querySelector('#modal-select-role').value;
                const confirmBtn = modal.querySelector('#btn-confirm-role-modal');
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-xs"></i> Enregistrement...`;
                try {
                    await updateUserRoleAdmin(userId, newRole);
                    const prof = allProfiles.find((p) => p.id === userId);
                    if (prof) prof.role = newRole;
                    showToast(`Rôle mis à jour avec succès : "${newRole}" ✔️`, 'success');
                    modal.remove();
                    render();
                } catch (err) {
                    showToast(err.message, 'error');
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = 'Enregistrer';
                }
            });
        }

        function bindAccountsEvents() {
            // Recherche comptes
            const accountSearchInput = containerEl.querySelector('#admin-account-search');
            accountSearchInput?.addEventListener('input', (e) => {
                accountSearchQuery = e.target.value;
                const contentEl = containerEl.querySelector('#admin-tab-content');
                if (contentEl && activeTab === 'accounts') {
                    contentEl.innerHTML = renderAccountsTab();
                    bindAccountsEvents();
                }
            });

            // Effacer la recherche comptes
            containerEl.querySelector('#btn-clear-account-search')?.addEventListener('click', () => {
                accountSearchQuery = '';
                const contentEl = containerEl.querySelector('#admin-tab-content');
                if (contentEl && activeTab === 'accounts') {
                    contentEl.innerHTML = renderAccountsTab();
                    bindAccountsEvents();
                }
            });

            // Filtres par pilule de rôle
            containerEl.querySelectorAll('button[data-account-filter]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    accountRoleFilter = btn.getAttribute('data-account-filter') || 'all';
                    const contentEl = containerEl.querySelector('#admin-tab-content');
                    if (contentEl && activeTab === 'accounts') {
                        contentEl.innerHTML = renderAccountsTab();
                        bindAccountsEvents();
                    }
                });
            });

            // Suspendre / Réactiver un compte
            containerEl.querySelectorAll('button[data-action="toggle-account-suspend"]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const isSuspended = btn.getAttribute('data-suspended') === 'true';

                    const confirmed = await showConfirm({
                        title: !isSuspended ? 'Suspendre le compte' : 'Réactiver le compte',
                        message: !isSuspended
                            ? 'Voulez-vous vraiment suspendre ce compte utilisateur ? Ses accès seront restreints sur la plateforme.'
                            : 'Voulez-vous réactiver ce compte utilisateur ?',
                        confirmText: !isSuspended ? 'Suspendre' : 'Réactiver',
                        cancelText: 'Annuler',
                        isDestructive: !isSuspended,
                        icon: !isSuspended ? 'fa-ban' : 'fa-circle-check',
                    });

                    if (!confirmed) return;

                    btn.disabled = true;
                    try {
                        await suspendSeller(id, !isSuspended);

                        const prof = allProfiles.find((p) => p.id === id);
                        if (prof) {
                            prof.is_suspended = !isSuspended;
                            if (!isSuspended) {
                                prof.role = 'suspendu';
                            } else {
                                prof.role = prof.shop_name ? 'vendeur' : 'acheteur';
                            }
                        }
                        const activeSel = activeSellers.find((s) => s.id === id);
                        if (activeSel) {
                            activeSel.is_suspended = !isSuspended;
                            activeSel.role = !isSuspended ? 'vendeur_desactive' : 'vendeur';
                        }

                        showToast(!isSuspended ? 'Compte suspendu. 🛑' : 'Compte réactivé. 🟢', 'info');

                        const contentEl = containerEl.querySelector('#admin-tab-content');
                        if (contentEl && activeTab === 'accounts') {
                            contentEl.innerHTML = renderAccountsTab();
                            bindAccountsEvents();
                        }
                    } catch (err) {
                        showToast(err.message, 'error');
                        btn.disabled = false;
                    }
                });
            });

            // Modifier rôle
            containerEl.querySelectorAll('button[data-action="change-account-role"]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    const id = btn.getAttribute('data-id');
                    const currentRole = btn.getAttribute('data-current-role');
                    const name = btn.getAttribute('data-name');
                    openRoleModal(id, currentRole, name);
                });
            });

            // Supprimer définitivement un compte
            containerEl.querySelectorAll('button[data-action="delete-account"]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const name = btn.getAttribute('data-name') || 'cet utilisateur';
                    const confirmed = await showConfirm({
                        title: 'Supprimer définitivement le compte',
                        message: `ATTENTION : Voulez-vous supprimer définitivement le compte de "${name}" ? Cette action est irréversible.`,
                        confirmText: 'Supprimer',
                        cancelText: 'Annuler',
                        isDestructive: true,
                        icon: 'fa-trash-can',
                    });

                    if (confirmed) {
                        btn.disabled = true;
                        try {
                            await deleteSellerAccount(id);
                            allProfiles = allProfiles.filter((p) => p.id !== id);
                            activeSellers = activeSellers.filter((s) => s.id !== id);
                            pendingSellers = pendingSellers.filter((s) => s.id !== id);
                            showToast(`Compte de "${name}" supprimé.`, 'info');
                            render();
                        } catch (err) {
                            showToast(err.message, 'error');
                            btn.disabled = false;
                        }
                    }
                });
            });
        }

        function bindProductsEvents() {
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

            // Modération / Suppression produit
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

        function bindOrdersEvents() {
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
        }

        function bindLocationsEvents() {
            // Formulaire d'ajout de lieu
            const formAddLoc = containerEl.querySelector('#form-add-location');
            formAddLoc?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const nameInput = formAddLoc.querySelector('#new-location-name');
                const catSelect = formAddLoc.querySelector('#new-location-category');
                const submitBtn = formAddLoc.querySelector('#btn-submit-location');
                const name = nameInput?.value?.trim();
                const category = catSelect?.value;
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
        }

        function bindSellersEvents() {
            // Recherche vendeurs
            const sellerSearchInput = containerEl.querySelector('#admin-seller-search');
            sellerSearchInput?.addEventListener('input', (e) => {
                sellerSearchQuery = e.target.value;
                const contentEl = containerEl.querySelector('#admin-tab-content');
                if (contentEl && activeTab === 'sellers') {
                    contentEl.innerHTML = renderSellersTab();
                    bindSellersEvents();
                }
            });

            // Effacer la recherche
            containerEl.querySelector('#btn-clear-seller-search')?.addEventListener('click', () => {
                sellerSearchQuery = '';
                const contentEl = containerEl.querySelector('#admin-tab-content');
                if (contentEl && activeTab === 'sellers') {
                    contentEl.innerHTML = renderSellersTab();
                    bindSellersEvents();
                }
            });

            // Filtres par pilule
            containerEl.querySelectorAll('button[data-seller-filter]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    sellerFilterTab = btn.getAttribute('data-seller-filter') || 'all';
                    const contentEl = containerEl.querySelector('#admin-tab-content');
                    if (contentEl && activeTab === 'sellers') {
                        contentEl.innerHTML = renderSellersTab();
                        bindSellersEvents();
                    }
                });
            });

            // Approuver un vendeur
            containerEl.querySelectorAll('button[data-action="approve"]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    btn.disabled = true;
                    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-xs"></i>`;
                    try {
                        await approveSeller(id);
                        const target = pendingSellers.find((s) => s.id === id);
                        if (target) {
                            pendingSellers = pendingSellers.filter((s) => s.id !== id);
                            target.role = 'vendeur';
                            target.is_open = true;
                            target.is_suspended = false;
                            activeSellers.unshift(target);
                        }
                        showToast('Vendeur approuvé avec succès ! 🟢', 'success');
                        const contentEl = containerEl.querySelector('#admin-tab-content');
                        if (contentEl && activeTab === 'sellers') {
                            contentEl.innerHTML = renderSellersTab();
                            bindSellersEvents();
                        }
                    } catch (err) {
                        showToast(err.message, 'error');
                        btn.disabled = false;
                        btn.innerHTML = `<i class="fa-solid fa-check text-xs"></i> <span>Approuver</span>`;
                    }
                });
            });

            // Rejeter un vendeur
            containerEl.querySelectorAll('button[data-action="reject"]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const confirmed = await showConfirm({
                        title: 'Rejeter la candidature',
                        message: 'Voulez-vous vraiment rejeter la demande d\'adhésion de ce vendeur ?',
                        confirmText: 'Rejeter la demande',
                        cancelText: 'Annuler',
                        isDestructive: true,
                        icon: 'fa-user-xmark',
                    });

                    if (confirmed) {
                        btn.disabled = true;
                        try {
                            await rejectSeller(id);
                            pendingSellers = pendingSellers.filter((s) => s.id !== id);
                            showToast('Candidature rejetée.', 'info');
                            const contentEl = containerEl.querySelector('#admin-tab-content');
                            if (contentEl && activeTab === 'sellers') {
                                contentEl.innerHTML = renderSellersTab();
                                bindSellersEvents();
                            }
                        } catch (err) {
                            showToast(err.message, 'error');
                            btn.disabled = false;
                        }
                    }
                });
            });

            // Suspendre ou Réactiver un vendeur
            containerEl.querySelectorAll('button[data-action="toggle-suspend"]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const isSuspended = btn.getAttribute('data-suspended') === 'true';

                    const confirmed = await showConfirm({
                        title: !isSuspended ? 'Suspendre la boutique' : 'Réactiver la boutique',
                        message: !isSuspended
                            ? 'Voulez-vous vraiment suspendre la boutique de ce vendeur ? Ses produits ne seront plus proposés aux acheteurs sur le campus.'
                            : 'Voulez-vous réactiver la boutique de ce marchand ? Ses produits redeviendront visibles et commandables dans le catalogue.',
                        confirmText: !isSuspended ? 'Suspendre le vendeur' : 'Réactiver la boutique',
                        cancelText: 'Annuler',
                        isDestructive: !isSuspended,
                        icon: !isSuspended ? 'fa-ban' : 'fa-circle-check',
                    });

                    if (!confirmed) return;

                    btn.disabled = true;
                    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-xs"></i> <span>Traitement...</span>`;

                    try {
                        await suspendSeller(id, !isSuspended);

                        // Mise à jour immédiate en mémoire
                        const target = activeSellers.find((s) => s.id === id);
                        if (target) {
                            target.is_suspended = !isSuspended;
                            target.role = !isSuspended ? 'vendeur_desactive' : 'vendeur';
                            target.is_open = isSuspended;
                        }

                        showToast(!isSuspended ? 'Boutique suspendue avec succès. 🛑' : 'Boutique réactivée avec succès. 🟢', 'info');

                        const contentEl = containerEl.querySelector('#admin-tab-content');
                        if (contentEl && activeTab === 'sellers') {
                            contentEl.innerHTML = renderSellersTab();
                            bindSellersEvents();
                        }
                    } catch (err) {
                        showToast(err.message, 'error');
                        btn.disabled = false;
                        btn.innerHTML = `<i class="fa-solid ${isSuspended ? 'fa-rotate-left' : 'fa-ban'} text-[11px]"></i> <span>${isSuspended ? 'Réactiver' : 'Suspendre'}</span>`;
                    }
                });
            });

            // Rétrograder en simple acheteur
            containerEl.querySelectorAll('button[data-action="revoke-seller"]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const name = btn.getAttribute('data-name') || 'ce marchand';

                    const confirmed = await showConfirm({
                        title: 'Rétrograder en simple acheteur',
                        message: `Voulez-vous vraiment révoquer les droits marchand de "${name}" ? Son rôle deviendra simple acheteur et ses articles ne seront plus vendus.`,
                        confirmText: 'Rétrograder en acheteur',
                        cancelText: 'Annuler',
                        isDestructive: true,
                        icon: 'fa-user-minus',
                    });

                    if (confirmed) {
                        btn.disabled = true;
                        try {
                            await revokeSeller(id);
                            activeSellers = activeSellers.filter((s) => s.id !== id);
                            showToast(`Marchand "${name}" rétrogradé en acheteur.`, 'info');
                            const contentEl = containerEl.querySelector('#admin-tab-content');
                            if (contentEl && activeTab === 'sellers') {
                                contentEl.innerHTML = renderSellersTab();
                                bindSellersEvents();
                            }
                        } catch (err) {
                            showToast(err.message, 'error');
                            btn.disabled = false;
                        }
                    }
                });
            });

            // Supprimer le compte marchand
            containerEl.querySelectorAll('button[data-action="delete-seller"]').forEach((btn) => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-id');
                    const name = btn.getAttribute('data-name') || 'ce marchand';

                    const confirmed = await showConfirm({
                        title: 'Supprimer définitivement le compte',
                        message: `ATTENTION : Êtes-vous sûr de vouloir supprimer définitivement le compte de "${name}" ? Cette action est irréversible.`,
                        confirmText: 'Supprimer définitivement',
                        cancelText: 'Annuler',
                        isDestructive: true,
                        icon: 'fa-trash-can',
                    });

                    if (confirmed) {
                        btn.disabled = true;
                        try {
                            await deleteSellerAccount(id);
                            activeSellers = activeSellers.filter((s) => s.id !== id);
                            pendingSellers = pendingSellers.filter((s) => s.id !== id);
                            showToast(`Compte de "${name}" définitivement supprimé.`, 'info');
                            const contentEl = containerEl.querySelector('#admin-tab-content');
                            if (contentEl && activeTab === 'sellers') {
                                contentEl.innerHTML = renderSellersTab();
                                bindSellersEvents();
                            }
                        } catch (err) {
                            showToast(err.message, 'error');
                            btn.disabled = false;
                        }
                    }
                });
            });
        }

        // Lier les événements de l'onglet actif
        if (activeTab === 'sellers') bindSellersEvents();
        if (activeTab === 'accounts') bindAccountsEvents();
        if (activeTab === 'products') bindProductsEvents();
        if (activeTab === 'orders') bindOrdersEvents();
        if (activeTab === 'locations') bindLocationsEvents();
    }

    checkExistingAuth();
    return containerEl;
}

export default createSuperAdminDashboard;
