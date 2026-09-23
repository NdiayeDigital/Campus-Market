/**
 * Composant SellerDashboard (Back-Office Marchand - Campus Market UIDT)
 * Tableau de bord épuré, synchronisé avec la charte graphique de l'administration centrale.
 * - Suivi KPI Bento épuré (Revenus FCFA, Commandes actives, Articles en ligne, Statut boutique)
 * - Navigation fluide (Commandes en direct, Mes Articles, Formulaire d'ajout 2 colonnes avec Live Preview)
 * - Supabase Realtime + Polling automatique de secours
 * - Alertes sonores Web Audio API et bascule de disponibilité boutique en 1 clic
 */

import { supabase } from '../../services/supabase.js';
import {
    getSellerDashboardData,
    toggleShopStatus,
    updateOrderStatus,
    logoutSeller,
} from '../../services/seller-service.js';
import { createProductManager } from './ProductManager.js';
import { isSellerSuspended } from '../../services/admin-service.js';
import { audioAlert, playNotificationSound } from '../../utils/audio-alert.js';
import { escapeHTML, formatSenegalPhone } from '../../utils/security.js';
import { showToast, showConfirm } from '../../utils/notifications.js';

/**
 * Crée le tableau de bord marchand moderne et fluide.
 * @param {Object} props
 * @param {Object} props.seller - Données du vendeur ({ id, prenom, nom, ... })
 * @param {Function} [props.onBackToCatalog] - Callback pour retourner à la boutique
 * @param {Function} props.onLogout - Callback lors de la déconnexion
 * @param {Function} props.onShowToast - Callback pour afficher un toast
 * @returns {HTMLElement}
 */
export function createSellerDashboard({ seller, onBackToCatalog, onLogout, onShowToast } = {}) {
    const containerEl = document.createElement('div');
    containerEl.className = 'w-full flex flex-col bg-slate-50 min-h-screen text-slate-900 view-transition-enter';

    const sellerId = seller.id;
    let dashboardData = null;
    let isLoading = true;
    let activeSubTab = 'orders'; // 'orders' | 'products' | 'add-product'
    let orderFilter = 'all'; // 'all' | 'pending' | 'in_progress' | 'delivered'
    let realtimeChannel = null;
    let pollingTimer = null;

    async function loadData(silent = false) {
        if (!silent) {
            isLoading = true;
            render();
        }
        try {
            const freshData = await getSellerDashboardData(sellerId);

            // Détection de nouvelles commandes arrivées en arrière-plan
            if (silent && dashboardData && freshData) {
                const prevOrders = dashboardData.recentOrders || [];
                const newOrders = freshData.recentOrders || [];
                const prevIds = new Set(prevOrders.map((o) => o.id));
                const newlyAdded = newOrders.filter((o) => !prevIds.has(o.id));

                if (newlyAdded.length > 0) {
                    playNotificationSound();
                    const firstNew = newlyAdded[0];
                    const buyerName = firstNew.buyer_name || 'Un étudiant';
                    if (typeof onShowToast === 'function') {
                        onShowToast(`🔔 Nouvelle commande de ${buyerName} !`, 'info');
                    }
                }
            }

            dashboardData = freshData;
        } catch (err) {
            console.error('[SellerDashboard] Erreur chargement:', err);
        } finally {
            isLoading = false;
            render();
        }
    }

    /**
     * Active le polling de secours régulier (toutes les 12 secondes).
     * Garantit la réception des commandes même si les websockets sont restreints sur le réseau campus.
     */
    function startPolling() {
        if (pollingTimer) clearInterval(pollingTimer);
        pollingTimer = setInterval(() => {
            if (typeof document !== 'undefined' && document.visibilityState === 'visible' && containerEl.isConnected) {
                loadData(true);
            }
        }, 12000);
    }

    /**
     * Initialise l'écoute temps réel Supabase Realtime pour les commandes entrantes.
     */
    function initRealtime() {
        if (!sellerId) return;

        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
        }

        realtimeChannel = supabase
            .channel(`seller-orders-${sellerId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `seller_id=eq.${sellerId}`,
                },
                (payload) => {
                    console.log('[Realtime] Événement commande reçu:', payload);
                    playNotificationSound();

                    if (payload.eventType === 'INSERT') {
                        const buyer = payload.new.buyer_name || 'Un étudiant';
                        if (typeof onShowToast === 'function') {
                            onShowToast(`🔔 Nouvelle commande de ${buyer} !`, 'info');
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        if (typeof onShowToast === 'function') {
                            onShowToast(`Mise à jour commande #${payload.new.id.slice(0, 6)}`, 'info');
                        }
                    }

                    loadData();
                }
            )
            .subscribe((status) => {
                console.log(`[Realtime] Statut du canal seller-orders: ${status}`);
            });
    }

    function render() {
        if (isLoading) {
            containerEl.innerHTML = `
                <div class="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-5 animate-pulse w-full">
                    <div class="h-20 bg-white rounded-2xl w-full border border-slate-200/60"></div>
                    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div class="h-28 bg-white rounded-2xl border border-slate-200/60"></div>
                        <div class="h-28 bg-white rounded-2xl border border-slate-200/60"></div>
                        <div class="h-28 bg-white rounded-2xl border border-slate-200/60"></div>
                        <div class="h-28 bg-white rounded-2xl border border-slate-200/60"></div>
                    </div>
                </div>
            `;
            return;
        }

        const data = dashboardData || {};
        const isSuspended = isSellerSuspended(seller) || seller.is_suspended === true || seller.role === 'vendeur_desactive' || seller.role === 'suspendu';
        const isOpen = !isSuspended && (data.isOpen !== false);
        const allOrders = data.recentOrders || [];

        const pendingCount = allOrders.filter((o) => o.status === 'pending').length;
        const inProgressCount = allOrders.filter((o) => ['confirmed', 'processing', 'shipped'].includes(o.status)).length;
        const deliveredCount = allOrders.filter((o) => o.status === 'delivered').length;

        containerEl.innerHTML = `
            <!-- Header Compact & Sticky Espace Vendeur -->
            <header class="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs w-full">
                <div class="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-3">
                    <!-- Logo & Titre Vendeur -->
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl ${isSuspended ? 'bg-slate-200 text-slate-500' : 'bg-primary text-white'} flex items-center justify-center font-extrabold text-sm sm:text-base shadow-xs flex-shrink-0">
                            <i class="fa-solid fa-shop"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="font-heading font-extrabold text-slate-900 text-sm sm:text-base leading-tight">Espace Vendeur</span>
                                ${isSuspended ? `
                                    <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                                        Suspendu
                                    </span>
                                ` : `
                                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                        Marchand UIDT
                                    </span>
                                `}
                            </div>
                            <div class="text-[11px] text-slate-500 flex items-center gap-1.5 leading-tight mt-0.5">
                                <span class="font-medium text-slate-700 truncate max-w-[120px] sm:max-w-none">${escapeHTML(seller.prenom)} ${escapeHTML(seller.nom)}</span>
                                <span>•</span>
                                <span class="flex items-center gap-1 font-semibold ${isOpen ? 'text-emerald-600' : 'text-amber-600'}">
                                    <span class="w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
                                    <span>${isOpen ? 'Ouvert aux commandes' : 'En pause'}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Actions Rapides Header -->
                    <div class="flex items-center gap-1.5 sm:gap-2">
                        <!-- Toggle Disponibilité Boutique -->
                        ${!isSuspended ? `
                            <button 
                                type="button"
                                id="hdr-btn-toggle-shop" 
                                title="${isOpen ? 'Mettre la boutique en pause' : 'Ouvrir la boutique aux commandes'}"
                                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-95 min-h-[38px] cursor-pointer ${
                                    isOpen 
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' 
                                        : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                }"
                            >
                                <span class="w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
                                <span class="hidden sm:inline">${isOpen ? 'Boutique Ouverte' : 'En Pause'}</span>
                            </button>
                        ` : ''}

                        <!-- Actualiser -->
                        <button 
                            type="button"
                            id="hdr-btn-refresh-orders" 
                            title="Actualiser les données"
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors min-h-[38px] active:scale-95 cursor-pointer"
                        >
                            <i class="fa-solid fa-arrows-rotate text-xs"></i>
                            <span class="hidden md:inline">Actualiser</span>
                        </button>

                        <!-- Alerte Sonore -->
                        <button 
                            type="button"
                            id="hdr-btn-toggle-audio" 
                            title="Activer/Désactiver les alertes sonores"
                            class="flex items-center justify-center w-9 h-9 rounded-xl text-xs border transition-all active:scale-95 min-h-[38px] min-w-[38px] cursor-pointer ${
                                audioAlert.isEnabled 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-xs' 
                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }"
                        >
                            <i class="fa-solid ${audioAlert.isEnabled ? 'fa-volume-high text-emerald-600' : 'fa-volume-xmark'} text-xs"></i>
                        </button>

                        <!-- Voir la Boutique Publique -->
                        <button 
                            type="button"
                            id="hdr-btn-seller-back-shop" 
                            title="Voir le catalogue public du campus"
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors min-h-[38px] active:scale-95 cursor-pointer"
                        >
                            <i class="fa-solid fa-store text-xs"></i>
                            <span class="hidden sm:inline">Boutique</span>
                        </button>

                        <!-- Déconnexion -->
                        <button 
                            type="button"
                            id="hdr-btn-seller-logout" 
                            title="Se déconnecter de l'espace marchand"
                            class="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors min-h-[38px] min-w-[38px] active:scale-95 cursor-pointer"
                        >
                            <i class="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                        </button>
                    </div>
                </div>
            </header>

            <main class="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6 w-full flex-1">
                ${isSuspended ? `
                    <!-- Alerte rouge Vendeur Suspendu -->
                    <div class="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 text-rose-950 animate-fade-in">
                        <div class="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 text-lg shadow-xs">
                            <i class="fa-solid fa-ban"></i>
                        </div>
                        <div class="flex-1">
                            <div class="flex items-center gap-2">
                                <h3 class="font-heading font-extrabold text-sm sm:text-base text-rose-800">Boutique Temporairement Suspendue</h3>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-200 text-rose-900">Action requise</span>
                            </div>
                            <p class="text-xs text-rose-700 mt-1 leading-relaxed">
                                Votre compte marchand a été suspendu par l'administration centrale de l'UIDT. Vos articles ne sont plus visibles ni commandables par les étudiants dans le catalogue public.
                            </p>
                            <p class="text-[11px] text-rose-600 font-semibold mt-2 flex items-center gap-1.5">
                                <i class="fa-solid fa-headset text-xs"></i> Contactez la direction de la scolarité ou l'administration pour régulariser votre compte.
                            </p>
                        </div>
                    </div>
                ` : ''}

                <!-- Grille Bento KPI (2 colonnes mobile, 4 colonnes desktop) -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                    <!-- Revenus Cumulés -->
                    <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <div class="flex items-center justify-between text-slate-500 mb-2">
                            <span class="text-xs font-semibold text-slate-600 truncate">Revenus réalisés</span>
                            <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0">
                                <i class="fa-solid fa-sack-dollar"></i>
                            </div>
                        </div>
                        <span class="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 tracking-tight tabular-nums">
                            ${Number(data.totalRevenue || 0).toLocaleString('fr-FR')} <span class="text-xs font-bold text-slate-500">FCFA</span>
                        </span>
                        <span class="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-1">
                            <i class="fa-solid fa-circle-check text-[9px]"></i> Ventes confirmées
                        </span>
                    </div>

                    <!-- Commandes en cours -->
                    <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden">
                        <div class="flex items-center justify-between text-slate-500 mb-2">
                            <span class="text-xs font-semibold text-slate-600 truncate">Commandes actives</span>
                            <div class="w-8 h-8 rounded-xl bg-blue-50 text-primary flex items-center justify-center text-xs shrink-0">
                                <i class="fa-solid fa-bell"></i>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
                                ${data.pendingCount || 0}
                            </span>
                            ${(data.pendingCount || 0) > 0 ? `
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 animate-pulse">
                                    À traiter
                                </span>
                            ` : ''}
                        </div>
                        <span class="text-[11px] font-medium text-slate-400 mt-1">Flux direct campus</span>
                    </div>

                    <!-- Articles en ligne -->
                    <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <div class="flex items-center justify-between text-slate-500 mb-2">
                            <span class="text-xs font-semibold text-slate-600 truncate">Articles en ligne</span>
                            <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs shrink-0">
                                <i class="fa-solid fa-boxes-stacked"></i>
                            </div>
                        </div>
                        <span class="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
                            ${data.activeProductsCount || 0} <span class="text-xs font-bold text-slate-400">/ ${data.totalProductsCount || 0}</span>
                        </span>
                        <span class="text-[11px] font-medium text-slate-400 mt-1">Catalogue actif</span>
                    </div>

                    <!-- Disponibilité Boutique -->
                    <div class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                        <div class="flex items-center justify-between text-slate-500 mb-2">
                            <span class="text-xs font-semibold text-slate-600 truncate">Statut boutique</span>
                            <div class="w-8 h-8 rounded-xl ${isOpen ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'} flex items-center justify-center text-xs shrink-0">
                                <i class="fa-solid ${isOpen ? 'fa-store' : 'fa-pause'}"></i>
                            </div>
                        </div>
                        <span class="font-heading font-extrabold text-lg sm:text-xl ${isOpen ? 'text-emerald-700' : 'text-amber-700'} tracking-tight">
                            ${isOpen ? 'Boutique Ouverte' : 'En Pause'}
                        </span>
                        <span class="text-[11px] font-medium text-slate-400 mt-1">Commandes étudiantes</span>
                    </div>
                </div>

                <!-- Barre d'onglets de navigation épurée (scroll horizontal sur mobile) -->
                <div class="flex items-center gap-1.5 border-b border-slate-200/80 overflow-x-auto no-scrollbar pb-2">
                    <button 
                        type="button" 
                        id="subtab-orders" 
                        class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap min-h-[44px] cursor-pointer active:scale-95 ${
                            activeSubTab === 'orders'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }"
                    >
                        <i class="fa-solid fa-clipboard-list text-xs"></i>
                        <span>Commandes</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            activeSubTab === 'orders' 
                                ? 'bg-slate-800 text-slate-200' 
                                : (pendingCount > 0 ? 'bg-amber-400 text-slate-950 animate-pulse' : 'bg-slate-100 text-slate-600')
                        }">
                            ${allOrders.length}
                        </span>
                    </button>

                    <button 
                        type="button" 
                        id="subtab-products" 
                        class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap min-h-[44px] cursor-pointer active:scale-95 ${
                            activeSubTab === 'products'
                                ? 'bg-slate-900 text-white shadow-xs'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }"
                    >
                        <i class="fa-solid fa-tags text-xs"></i>
                        <span>Mes Articles</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            activeSubTab === 'products' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-600'
                        }">
                            ${data.totalProductsCount || 0}
                        </span>
                    </button>

                    ${!isSuspended ? `
                        <button 
                            type="button" 
                            id="subtab-add-product" 
                            class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap min-h-[44px] cursor-pointer active:scale-95 ${
                                activeSubTab === 'add-product'
                                    ? 'bg-primary text-white shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                            }"
                        >
                            <i class="fa-solid fa-plus text-xs"></i>
                            <span>Ajouter un produit</span>
                        </button>
                    ` : ''}
                </div>

                <!-- Zone de contenu dynamique -->
                <div id="seller-tab-content" class="w-full">
                    ${activeSubTab === 'orders' ? renderOrdersTab(allOrders) : ''}
                </div>
            </main>
        `;

        if (activeSubTab === 'products' || activeSubTab === 'add-product') {
            const productManagerEl = createProductManager({
                sellerId,
                isSuspended,
                initialTab: activeSubTab === 'add-product' ? 'add' : 'list',
                onProductChanged: () => {
                    loadData(true);
                },
            });
            containerEl.querySelector('#seller-tab-content')?.appendChild(productManagerEl);
        }

        bindEvents();
    }

    function renderOrdersTab(orders) {
        if (orders.length === 0) {
            return `
                <div class="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-200/90 shadow-xs my-2">
                    <div class="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl mx-auto mb-3">
                        <i class="fa-solid fa-inbox"></i>
                    </div>
                    <h3 class="font-heading font-extrabold text-slate-900 text-base mb-1">Aucune commande pour le moment</h3>
                    <p class="text-xs text-slate-500 max-w-sm mx-auto">Vos commandes clients apparaîtront ici en temps réel dès qu'un étudiant valide son panier.</p>
                </div>
            `;
        }

        // Filtrage des commandes selon le filtre actif
        const filtered = orders.filter((o) => {
            if (orderFilter === 'all') return true;
            if (orderFilter === 'pending') return o.status === 'pending';
            if (orderFilter === 'in_progress') return ['confirmed', 'processing', 'shipped'].includes(o.status);
            if (orderFilter === 'delivered') return o.status === 'delivered';
            return true;
        });

        const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;
        const inProgressOrdersCount = orders.filter((o) => ['confirmed', 'processing', 'shipped'].includes(o.status)).length;
        const deliveredOrdersCount = orders.filter((o) => o.status === 'delivered').length;

        return `
            <div class="flex flex-col gap-4">
                <!-- Filtres par pilules de statut -->
                <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    <button type="button" data-order-filter="all" class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap min-h-[38px] cursor-pointer active:scale-95 ${
                        orderFilter === 'all'
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                    }">
                        Toutes (${orders.length})
                    </button>
                    <button type="button" data-order-filter="pending" class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap min-h-[38px] cursor-pointer active:scale-95 ${
                        orderFilter === 'pending'
                            ? 'bg-amber-500 text-slate-950 font-extrabold shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                    }">
                        À valider (${pendingOrdersCount})
                    </button>
                    <button type="button" data-order-filter="in_progress" class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap min-h-[38px] cursor-pointer active:scale-95 ${
                        orderFilter === 'in_progress'
                            ? 'bg-primary text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                    }">
                        En cours (${inProgressOrdersCount})
                    </button>
                    <button type="button" data-order-filter="delivered" class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap min-h-[38px] cursor-pointer active:scale-95 ${
                        orderFilter === 'delivered'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50'
                    }">
                        Livrées (${deliveredOrdersCount})
                    </button>
                </div>

                <!-- Liste des cartes de commandes compactes et soignées -->
                ${filtered.length === 0 ? `
                    <div class="p-8 text-center bg-white rounded-2xl border border-slate-200/80 text-slate-400 text-xs">
                        Aucune commande ne correspond à ce filtre.
                    </div>
                ` : `
                    <div class="flex flex-col gap-3">
                        ${filtered.map((o) => {
                            const clientPhone = formatSenegalPhone(o.buyer_phone || '');
                            const productTitle = o.product ? o.product.title : 'Article Campus Market';

                            let nextActionBtn = '';
                            let statusLabel = '';
                            let statusBadgeClass = '';

                            switch (o.status) {
                                case 'pending':
                                    statusLabel = 'En attente';
                                    statusBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                                    nextActionBtn = `
                                        <button data-action="update-status" data-id="${o.id}" data-next="confirmed" class="px-4 py-2 bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all min-h-[44px] flex items-center gap-1.5 cursor-pointer">
                                            <i class="fa-solid fa-check text-xs"></i>
                                            <span>Accepter</span>
                                        </button>
                                        <button data-action="update-status" data-id="${o.id}" data-next="cancelled" class="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl border border-rose-200 transition-all min-h-[44px] cursor-pointer">
                                            Refuser
                                        </button>
                                    `;
                                    break;
                                case 'confirmed':
                                    statusLabel = 'Confirmée';
                                    statusBadgeClass = 'bg-blue-50 text-blue-800 border-blue-200';
                                    nextActionBtn = `
                                        <button data-action="update-status" data-id="${o.id}" data-next="processing" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all min-h-[44px] flex items-center gap-1.5 cursor-pointer">
                                            <i class="fa-solid fa-fire-burner text-xs"></i>
                                            <span>Préparer</span>
                                        </button>
                                    `;
                                    break;
                                case 'processing':
                                    statusLabel = 'En préparation';
                                    statusBadgeClass = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                                    nextActionBtn = `
                                        <button data-action="update-status" data-id="${o.id}" data-next="shipped" class="px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black text-xs rounded-xl shadow-xs transition-all min-h-[44px] flex items-center gap-1.5 cursor-pointer">
                                            <i class="fa-solid fa-motorcycle text-xs"></i>
                                            <span>Remettre au livreur</span>
                                        </button>
                                    `;
                                    break;
                                case 'shipped':
                                    statusLabel = 'En livraison';
                                    statusBadgeClass = 'bg-purple-50 text-purple-800 border-purple-200';
                                    nextActionBtn = `
                                        <button data-action="update-status" data-id="${o.id}" data-next="delivered" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all min-h-[44px] flex items-center gap-1.5 cursor-pointer">
                                            <i class="fa-solid fa-box-open text-xs"></i>
                                            <span>Marquer Livrée</span>
                                        </button>
                                    `;
                                    break;
                                case 'delivered':
                                    statusLabel = 'Livrée';
                                    statusBadgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                                    nextActionBtn = `
                                        <span class="text-xs font-bold text-emerald-700 flex items-center gap-1 py-1">
                                            <i class="fa-solid fa-circle-check"></i> Terminée
                                        </span>
                                    `;
                                    break;
                                case 'cancelled':
                                    statusLabel = 'Annulée';
                                    statusBadgeClass = 'bg-slate-100 text-slate-500 line-through border-slate-200';
                                    break;
                            }

                            const orderRef = o.reference || `#CMD-${o.id.slice(0, 6).toUpperCase()}`;

                            return `
                                <div class="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs transition-all">
                                    <!-- En-tête de la commande -->
                                    <div class="flex items-center justify-between border-b border-slate-100 pb-2.5 flex-wrap gap-2">
                                        <div class="flex items-center gap-2">
                                            <span class="font-heading font-extrabold text-sm text-slate-900">${escapeHTML(orderRef)}</span>
                                            <span class="text-slate-300">•</span>
                                            <span class="text-xs text-slate-400">
                                                ${new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeClass}">
                                            ${statusLabel}
                                        </span>
                                    </div>

                                    <!-- Détails Acheteur, Pavillon & Article -->
                                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                                        <div>
                                            <div class="font-bold text-slate-900 text-sm flex items-center gap-2">
                                                <div class="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs">
                                                    <i class="fa-solid fa-user text-[10px]"></i>
                                                </div>
                                                <span>${escapeHTML(o.buyer_name || 'Client UIDT')}</span>
                                            </div>
                                            <p class="text-slate-600 mt-1 flex items-center gap-1.5 font-medium">
                                                <i class="fa-solid fa-location-dot text-primary text-xs"></i>
                                                <span>${escapeHTML(o.delivery_address || 'Pavillon')}</span>
                                            </p>
                                        </div>

                                        <div class="sm:text-right border-t sm:border-t-0 border-slate-200/60 pt-2 sm:pt-0">
                                            <span class="font-semibold text-slate-700 block">${escapeHTML(productTitle)} <span class="text-slate-400 font-normal">(x${o.quantity || 1})</span></span>
                                            <span class="font-heading font-extrabold text-base text-primary leading-tight block mt-0.5 tabular-nums">
                                                ${Number(o.price).toLocaleString('fr-FR')} FCFA
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Actions : Contact & Progression -->
                                    <div class="flex items-center justify-between gap-2 pt-1 flex-wrap">
                                        <!-- Liens 1-clic Appel & WhatsApp -->
                                        <div class="flex items-center gap-2">
                                            <a 
                                                href="tel:${clientPhone}" 
                                                class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 min-h-[44px] transition-colors active:scale-95"
                                            >
                                                <i class="fa-solid fa-phone text-emerald-600 text-xs"></i>
                                                <span>Appel</span>
                                            </a>
                                            <a 
                                                href="https://wa.me/${clientPhone}?text=${encodeURIComponent(`Bonjour ${o.buyer_name || ''} ! Je suis votre vendeur Campus Market concernant votre commande ${orderRef}.`)}" 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                class="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-200 flex items-center gap-1.5 min-h-[44px] transition-colors active:scale-95"
                                            >
                                                <i class="fa-brands fa-whatsapp text-sm text-emerald-600"></i>
                                                <span>WhatsApp</span>
                                            </a>
                                        </div>

                                        <!-- Bouton progression de statut -->
                                        <div class="flex items-center gap-2">
                                            ${nextActionBtn}
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `}
            </div>
        `;
    }

    function bindEvents() {
        // Toggle Audio (Header & Body)
        const toggleAudioHandler = async () => {
            await audioAlert.toggle();
            render();
            if (audioAlert.isEnabled) {
                playNotificationSound();
                if (typeof onShowToast === 'function') onShowToast('Alertes sonores activées ! 🔊', 'success');
            }
        };
        containerEl.querySelector('#hdr-btn-toggle-audio')?.addEventListener('click', toggleAudioHandler);

        // Toggle Boutique
        const toggleShopHandler = async () => {
            const isSuspended = isSellerSuspended(seller) || seller.is_suspended === true || seller.role === 'vendeur_desactive' || seller.role === 'suspendu';
            if (isSuspended) {
                showToast("Votre boutique est suspendue par l'administration. Impossible de modifier la disponibilité.", 'warning');
                return;
            }
            const currentIsOpen = dashboardData?.isOpen !== false;
            try {
                await toggleShopStatus(sellerId, !currentIsOpen);
                if (dashboardData) dashboardData.isOpen = !currentIsOpen;
                render();
                showToast(!currentIsOpen ? 'Boutique ouverte aux commandes ! 🟢' : 'Boutique mise en pause ⏸️', 'info');
            } catch (err) {
                showToast(err.message, 'error');
            }
        };
        containerEl.querySelector('#hdr-btn-toggle-shop')?.addEventListener('click', toggleShopHandler);

        // Retour à la boutique
        const backShopHandler = () => {
            if (typeof onBackToCatalog === 'function') {
                onBackToCatalog();
            }
        };
        containerEl.querySelector('#hdr-btn-seller-back-shop')?.addEventListener('click', backShopHandler);

        // Déconnexion
        const logoutHandler = async () => {
            const confirmed = await showConfirm({
                title: 'Déconnexion Marchand',
                message: 'Voulez-vous vraiment vous déconnecter de votre espace vendeur ?',
                confirmText: 'Se déconnecter',
                cancelText: 'Annuler',
                isDestructive: false,
                icon: 'fa-arrow-right-from-bracket',
            });

            if (confirmed) {
                cleanup();
                await logoutSeller();
                if (typeof onLogout === 'function') onLogout();
            }
        };
        containerEl.querySelector('#hdr-btn-seller-logout')?.addEventListener('click', logoutHandler);

        // Actualisation manuelle
        const refreshHandler = async (e) => {
            const btn = e.currentTarget;
            const icon = btn?.querySelector('i');
            if (icon) icon.classList.add('fa-spin');
            if (btn) btn.disabled = true;
            try {
                await loadData(false);
                if (typeof onShowToast === 'function') onShowToast('Données actualisées avec succès.', 'info');
            } finally {
                if (icon) icon.classList.remove('fa-spin');
                if (btn) btn.disabled = false;
            }
        };
        containerEl.querySelector('#hdr-btn-refresh-orders')?.addEventListener('click', refreshHandler);

        // Sous-onglets de navigation
        containerEl.querySelector('#subtab-orders')?.addEventListener('click', () => {
            activeSubTab = 'orders';
            render();
        });

        containerEl.querySelector('#subtab-products')?.addEventListener('click', () => {
            activeSubTab = 'products';
            render();
        });

        containerEl.querySelector('#subtab-add-product')?.addEventListener('click', () => {
            activeSubTab = 'add-product';
            render();
        });

        // Filtres par pilule de statut
        containerEl.querySelectorAll('button[data-order-filter]').forEach((btn) => {
            btn.addEventListener('click', () => {
                orderFilter = btn.getAttribute('data-order-filter') || 'all';
                render();
            });
        });

        // Actions sur statut commande
        containerEl.querySelectorAll('button[data-action="update-status"]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const next = btn.getAttribute('data-next');
                btn.disabled = true;
                try {
                    await updateOrderStatus(id, next);
                    await loadData();
                    showToast('Statut de la commande mis à jour.', 'success');
                } catch (err) {
                    showToast(err.message, 'error');
                }
            });
        });
    }

    function cleanup() {
        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
        }
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }
    }

    // Démarrage
    loadData();
    initRealtime();
    startPolling();

    containerEl.cleanup = cleanup;
    return containerEl;
}

export default createSellerDashboard;
