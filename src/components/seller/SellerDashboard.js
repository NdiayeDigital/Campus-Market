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
import { showOrderNotification, requestNotificationPermission } from '../../utils/background-notifications.js';
import { SUPPORT_CONFIG } from '../../config/support.js';
import { escapeHTML, formatSenegalPhone } from '../../utils/security.js';
import { showToast, showConfirm } from '../../utils/notifications.js';
import { exportOrdersToCSV } from '../../utils/export-csv.js';
import { shareSellerShop } from '../../utils/share.js';
import { createSubscriptionModal } from './SubscriptionModal.js';
import { computeSubscriptionStatus, SUBSCRIPTION_PLANS } from '../../config/subscription.js';
import logoUrl from '../../assets/logo.webp';

/**
 * Crée le tableau de bord marchand moderne et fluide.
 * @param {Object} props
 * @param {Object} props.seller - Données du vendeur ({ id, prenom, nom, ... })
 * @param {Function} [props.onBackToCatalog] - Callback pour retourner à la boutique
 * @param {Function} [props.onOpenAdminDashboard] - Callback pour retourner au portail SuperAdmin
 * @param {Function} props.onLogout - Callback lors de la déconnexion
 * @param {Function} props.onShowToast - Callback pour afficher un toast
 * @returns {HTMLElement}
 */
export function createSellerDashboard({ seller, onBackToCatalog, onOpenAdminDashboard, onLogout, onShowToast } = {}) {
    const containerEl = document.createElement('div');
    containerEl.className = 'w-full flex flex-col bg-slate-50 min-h-screen text-slate-900';

    const sellerId = seller.id;
    let dashboardData = null;
    let isLoading = true;
    let activeSubTab = 'dashboard'; // 'dashboard' | 'orders' | 'products' | 'add-product'
    let orderFilter = 'all'; // 'all' | 'pending' | 'in_progress' | 'delivered'
    let orderSearchQuery = '';
    let orderPavillonFilter = 'all';
    let realtimeChannel = null;
    let pollingTimer = null;

    /**
     * Vérifie de façon centralisée si la boutique ou le profil vendeur est suspendu.
     * @returns {boolean}
     */
    function checkSellerSuspended() {
        const currentProfile = dashboardData?.profile || seller;
        return (
            isSellerSuspended(currentProfile) || 
            isSellerSuspended(seller) || 
            currentProfile?.is_suspended === true || 
            currentProfile?.role === 'vendeur_desactive' || 
            currentProfile?.role === 'suspendu' ||
            seller?.is_suspended === true || 
            seller?.role === 'vendeur_desactive' || 
            seller?.role === 'suspendu'
        );
    }

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
                    for (const newOrd of newlyAdded) {
                        const buyerName = newOrd.buyer_name || 'Un étudiant';
                        const total = newOrd.total_price || newOrd.price || '';
                        const pavillon = newOrd.delivery_location || newOrd.room_delivery || newOrd.delivery_address || 'UIDT';
                        
                        showOrderNotification({
                            title: '🛍️ Nouvelle commande - Campus Market',
                            body: `Commande de ${buyerName} (${total ? Number(total).toLocaleString('fr-FR') + ' FCFA' : ''}) au ${pavillon}`,
                            url: '/#seller',
                            order: newOrd,
                        });

                        if (typeof onShowToast === 'function') {
                            onShowToast(`🔔 Nouvelle commande de ${buyerName} !`, 'info');
                        }
                    }
                }
            }

            dashboardData = freshData;
        } catch (err) {
            console.error('[SellerDashboard] Erreur chargement:', err);
        } finally {
            isLoading = false;
            // Si le rechargement est silencieux (polling régulier ou notification temps réel),
            // NE JAMAIS ré-exécuter render() pour ne pas détruire la saisie de l'utilisateur ni écraser les formulaires
            if (silent) {
                updateBadgesOnly();
                return;
            }
            render();
        }
    }

    /**
     * Met à jour uniquement les compteurs et badges sans toucher au DOM du formulaire actif.
     */
    function updateBadgesOnly() {
        const allOrders = dashboardData?.recentOrders || [];
        const pendingCount = allOrders.filter((o) => o.status === 'pending').length;
        const totalProductsCount = dashboardData?.totalProductsCount || 0;

        const ordersBadge = containerEl.querySelector('#subtab-orders span:last-child');
        if (ordersBadge) ordersBadge.textContent = allOrders.length;

        const prodsBadge = containerEl.querySelector('#subtab-products span:last-child');
        if (prodsBadge) prodsBadge.textContent = totalProductsCount;

        const bnavOrdersBadge = containerEl.querySelector('#bnav-seller-orders .bg-amber-400');
        if (bnavOrdersBadge) {
            bnavOrdersBadge.textContent = pendingCount;
            bnavOrdersBadge.classList.toggle('hidden', pendingCount === 0);
        }
    }

    /**
     * Active le polling de secours régulier (toutes les 12 secondes).
     * Garantit la réception des commandes même si les websockets sont restreints sur le réseau campus.
     */
    function startPolling() {
        if (pollingTimer) clearInterval(pollingTimer);
        pollingTimer = setInterval(() => {
            if (typeof document !== 'undefined' && containerEl.isConnected) {
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
                        const total = payload.new.total_price || payload.new.price || '';
                        const pavillon = payload.new.delivery_location || payload.new.room_delivery || payload.new.delivery_address || 'UIDT';

                        showOrderNotification({
                            title: '🛍️ Nouvelle commande - Campus Market',
                            body: `Commande de ${buyer} (${total ? Number(total).toLocaleString('fr-FR') + ' FCFA' : ''}) au ${pavillon}`,
                            url: '/#seller',
                            order: payload.new,
                        });

                        if (typeof onShowToast === 'function') {
                            onShowToast(`🔔 Nouvelle commande de ${buyer} !`, 'info');
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        if (typeof onShowToast === 'function') {
                            onShowToast(`Mise à jour commande #${payload.new.id.slice(0, 6)}`, 'info');
                        }
                    }

                    loadData(true);
                }
            )
            .subscribe((status) => {
                console.log(`[Realtime] Statut du canal seller-orders: ${status}`);
            });
    }

    let subscriptionModal = null;

    function renderSubscriptionBanner(subCalc) {
        if (!subCalc || subCalc.status === 'superadmin') return '';

        if (subCalc.status === 'trial_active') {
            return `
                <div class="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
                    <div class="flex items-start gap-3.5">
                        <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg shrink-0 shadow-xs">
                            <i class="fa-solid fa-gift"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-heading font-extrabold text-sm sm:text-base text-emerald-950">
                                    🎁 Essai Gratuit : ${subCalc.daysLeft} jour${subCalc.daysLeft > 1 ? 's' : ''} restant${subCalc.daysLeft > 1 ? 's' : ''}
                                </span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-200 text-emerald-900">
                                    3 articles inclus
                                </span>
                            </div>
                            <p class="text-xs text-emerald-800 mt-0.5 leading-relaxed">
                                Profitez de vos 7 jours offerts pour publier jusqu'à 3 articles et enregistrer vos commandes sans aucun frais.
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        class="btn-trigger-subscription px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-extrabold text-xs rounded-xl shadow-md shadow-emerald-600/20 transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
                    >
                        <i class="fa-solid fa-crown text-xs"></i>
                        <span>S'abonner dès maintenant</span>
                    </button>
                </div>
            `;
        }

        if (subCalc.status === 'trial_expiring') {
            return `
                <div class="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/60 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-pulse-slow">
                    <div class="flex items-start gap-3.5">
                        <div class="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center text-lg shrink-0 shadow-xs">
                            <i class="fa-solid fa-hourglass-half"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-heading font-extrabold text-sm sm:text-base text-amber-950">
                                    ⏰ Attention : Votre essai gratuit expire dans ${subCalc.daysLeft} jour${subCalc.daysLeft > 1 ? 's' : ''} !
                                </span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-950">
                                    Action recommandée
                                </span>
                            </div>
                            <p class="text-xs text-amber-900 mt-0.5 leading-relaxed">
                                Sécurisez votre boutique avant la fin de l'essai pour éviter que vos articles ne soient mis en pause. Règlement Wave ou Orange Money.
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        class="btn-trigger-subscription px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-heading font-extrabold text-xs rounded-xl shadow-md shadow-amber-500/25 transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
                    >
                        <i class="fa-solid fa-wallet text-xs"></i>
                        <span>Pérenniser ma boutique (Wave / OM)</span>
                    </button>
                </div>
            `;
        }

        if (subCalc.isExpired) {
            return `
                <div class="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
                    <div class="flex items-start gap-3.5">
                        <div class="w-11 h-11 rounded-2xl bg-rose-600 text-white flex items-center justify-center text-xl shrink-0 shadow-xs">
                            <i class="fa-solid fa-lock"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="font-heading font-extrabold text-base text-rose-950">
                                    ⛔ Période d'essai terminée — Boutique en pause
                                </span>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-200 text-rose-950">
                                    Paywall
                                </span>
                            </div>
                            <p class="text-xs text-rose-800 mt-1 leading-relaxed">
                                Votre période d'essai de 7 jours est terminée. Vos articles sont temporairement masqués aux acheteurs sur le campus. Activez votre formule dès 1 500 F/mois pour réactiver votre boutique immédiatement.
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        class="btn-trigger-subscription px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-heading font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 shrink-0 cursor-pointer active:scale-95"
                    >
                        <i class="fa-solid fa-bolt text-xs"></i>
                        <span>Activer mon abonnement</span>
                    </button>
                </div>
            `;
        }

        if (subCalc.status === 'active') {
            return `
                <div class="bg-white border border-slate-200/80 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 text-xs shadow-2xs flex-wrap">
                    <div class="flex items-center gap-2.5 flex-wrap">
                        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span class="text-slate-600">Abonnement actif :</span>
                        <strong class="text-slate-900 font-extrabold">${subCalc.plan.name} (${subCalc.plan.maxProducts} articles max)</strong>
                        <span class="text-slate-400">•</span>
                        <span class="text-slate-500 font-medium">${subCalc.daysLeft} jours restants</span>
                    </div>
                    <button 
                        type="button" 
                        class="btn-trigger-subscription text-primary font-bold hover:underline text-xs cursor-pointer shrink-0 flex items-center gap-1"
                    >
                        <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                        <span>Gérer mon pack / Changer</span>
                    </button>
                </div>
            `;
        }

        return '';
    }

    function render() {
        if (isLoading) {
            containerEl.innerHTML = `
                <div class="w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-5 animate-pulse">
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
        const currentProfile = data.profile || seller;
        const subCalc = computeSubscriptionStatus(currentProfile);
        const isSuspended = checkSellerSuspended();
        const isOpen = !isSuspended && (data.isOpen !== false);
        const allOrders = data.recentOrders || [];

        const pendingCount = allOrders.filter((o) => o.status === 'pending').length;
        const inProgressCount = allOrders.filter((o) => ['confirmed', 'processing', 'shipped'].includes(o.status)).length;
        const deliveredCount = allOrders.filter((o) => o.status === 'delivered').length;

        containerEl.innerHTML = `
            <!-- 1. SIDEBAR VENDEUR DESKTOP : Collée TOUT À GAUCHE de l'écran (w-64 fixed h-screen) -->
            <aside id="seller-desktop-sidebar" aria-label="Navigation vendeur desktop" class="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 h-screen bg-white border-r border-slate-200/80 z-40 flex-col justify-between p-5 select-none shadow-xs">
                <div class="flex flex-col gap-6">
                    <!-- Logo & Titre Vendeur -->
                    <div class="flex flex-col items-start gap-1.5 px-1 py-1">
                        <img src="${logoUrl}" alt="Campus Market" class="h-11 w-auto max-w-[190px] object-contain shrink-0" onerror="this.src='/assets/logo.webp'">
                        <span class="text-[10px] font-bold text-primary uppercase tracking-widest pl-1">Espace Marchand</span>
                    </div>

                    <!-- Marchand certifié -->
                    <div class="px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                        <span class="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Marchand certifié</span>
                        <span class="text-xs font-extrabold text-slate-900 block truncate mt-0.5">${escapeHTML(seller.prenom)} ${escapeHTML(seller.nom)}</span>
                    </div>

                    <!-- Statut Boutique interactif -->
                    ${!isSuspended ? `
                        <button 
                            type="button"
                            id="hdr-btn-toggle-shop" 
                            title="${isOpen ? 'Mettre la boutique en pause' : 'Ouvrir la boutique aux commandes'}"
                            class="flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                                isOpen 
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' 
                                    : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                            }"
                        >
                            <div class="flex items-center gap-2">
                                <span class="w-2.5 h-2.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
                                <span>${isOpen ? 'Boutique Ouverte' : 'Boutique en Pause'}</span>
                            </div>
                            <i class="fa-solid ${isOpen ? 'fa-toggle-on text-emerald-600' : 'fa-toggle-off text-amber-600'} text-base"></i>
                        </button>
                    ` : `
                        <div class="px-3.5 py-2.5 rounded-2xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-2">
                            <i class="fa-solid fa-ban text-rose-600"></i>
                            <span>Compte Suspendu</span>
                        </div>
                    `}

                    <!-- Liens verticaux sidebar desktop -->
                    <div class="flex flex-col gap-1.5">
                        <span class="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-3 py-1">
                            Gestion Marchande
                        </span>

                        <!-- Tableau de bord -->
                        <button 
                            type="button" 
                            id="subtab-dashboard" 
                            class="flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs transition-all min-h-[44px] cursor-pointer group active:scale-95 ${
                                activeSubTab === 'dashboard'
                                    ? 'bg-primary text-white shadow-md shadow-primary/20 font-bold'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold'
                            }"
                        >
                            <div class="flex items-center gap-3">
                                <i class="fa-solid fa-chart-pie text-xs w-4 text-center ${activeSubTab === 'dashboard' ? 'text-white' : 'text-slate-400 group-hover:text-primary'}"></i>
                                <span>Tableau de bord</span>
                            </div>
                        </button>

                        <!-- Commandes -->
                        <button 
                            type="button" 
                            id="subtab-orders" 
                            class="flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs transition-all min-h-[44px] cursor-pointer group active:scale-95 ${
                                activeSubTab === 'orders'
                                    ? 'bg-primary text-white shadow-md shadow-primary/20 font-bold'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold'
                            }"
                        >
                            <div class="flex items-center gap-3">
                                <i class="fa-solid fa-clipboard-list text-xs w-4 text-center ${activeSubTab === 'orders' ? 'text-white' : 'text-slate-400 group-hover:text-primary'}"></i>
                                <span>Commandes</span>
                            </div>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold leading-none ${
                                activeSubTab === 'orders' 
                                    ? 'bg-white/20 text-white' 
                                    : (pendingCount > 0 ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse' : 'bg-slate-100 text-slate-600')
                            }">
                                ${allOrders.length}
                            </span>
                        </button>

                        <!-- Mes Articles -->
                        <button 
                            type="button" 
                            id="subtab-products" 
                            class="flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs transition-all min-h-[44px] cursor-pointer group active:scale-95 ${
                                activeSubTab === 'products'
                                    ? 'bg-primary text-white shadow-md shadow-primary/20 font-bold'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold'
                            }"
                        >
                            <div class="flex items-center gap-3">
                                <i class="fa-solid fa-tags text-xs w-4 text-center ${activeSubTab === 'products' ? 'text-white' : 'text-slate-400 group-hover:text-primary'}"></i>
                                <span>Mes Articles</span>
                            </div>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold leading-none ${
                                activeSubTab === 'products' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                            }">
                                ${data.totalProductsCount || 0}
                            </span>
                        </button>

                        <!-- Ajouter un produit -->
                        ${!isSuspended ? `
                            <button 
                                type="button" 
                                id="subtab-add-product" 
                                class="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs transition-all min-h-[44px] cursor-pointer group active:scale-95 ${
                                    activeSubTab === 'add-product'
                                        ? 'bg-primary text-white shadow-md shadow-primary/20 font-bold'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold'
                                }"
                            >
                                <i class="fa-solid fa-plus text-xs w-4 text-center ${activeSubTab === 'add-product' ? 'text-white' : 'text-slate-400 group-hover:text-primary'}"></i>
                                <span>Ajouter un produit</span>
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Bas de Sidebar : Actions Vendeur Desktop -->
                <div class="flex flex-col gap-2 pt-4 border-t border-slate-100">
                    <div class="grid grid-cols-2 gap-2">
                        <button 
                            type="button"
                            id="hdr-btn-refresh-orders" 
                            title="Actualiser les données"
                            class="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        >
                            <i class="fa-solid fa-arrows-rotate text-xs"></i>
                            <span>Actualiser</span>
                        </button>

                        <button 
                            type="button"
                            id="hdr-btn-toggle-audio" 
                            title="Activer/Désactiver les alertes sonores"
                            class="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                audioAlert.isEnabled 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }"
                        >
                            <i class="fa-solid ${audioAlert.isEnabled ? 'fa-volume-high text-emerald-600' : 'fa-volume-xmark'} text-xs"></i>
                            <span>${audioAlert.isEnabled ? 'Son ON' : 'Son OFF'}</span>
                        </button>
                    </div>

                    <button 
                        type="button"
                        id="sidebar-btn-seller-share-shop" 
                        title="Partager le lien de ma boutique (Lien & WhatsApp)"
                        class="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition-colors cursor-pointer"
                    >
                        <i class="fa-solid fa-share-nodes text-xs text-emerald-600"></i>
                        <span>Partager ma boutique</span>
                    </button>

                    <button 
                        type="button"
                        id="sidebar-btn-subscription" 
                        title="Gérer mon abonnement et mes formules"
                        class="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-colors cursor-pointer"
                    >
                        <i class="fa-solid fa-crown text-xs text-amber-600"></i>
                        <span>Mon Abonnement</span>
                    </button>

                    <button 
                        type="button"
                        id="hdr-btn-seller-back-shop" 
                        title="Voir la marketplace publique"
                        class="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors cursor-pointer"
                    >
                        <i class="fa-solid fa-store text-xs"></i>
                        <span>Voir Marketplace</span>
                    </button>

                    ${seller.role === 'superadmin' ? `
                        <button 
                            type="button"
                            id="sidebar-btn-seller-back-admin" 
                            title="Retourner au portail SuperAdmin"
                            class="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors cursor-pointer active:scale-95 shadow-xs"
                        >
                            <i class="fa-solid fa-shield-halved text-xs text-indigo-600"></i>
                            <span>Supervision SuperAdmin</span>
                        </button>
                    ` : ''}

                    <button 
                        type="button"
                        id="hdr-btn-seller-logout" 
                        title="Se déconnecter de l'espace marchand"
                        class="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/60 transition-colors cursor-pointer"
                    >
                        <i class="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                        <span>Déconnexion</span>
                    </button>
                </div>
            </aside>

            <!-- 2. HEADER MOBILE VENDEUR : Épuré avec Titre + Badge statut + Menu ⋮ unique (lg:hidden) -->
            <header class="lg:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs w-full">
                <div class="w-full px-4 py-2.5 flex items-center justify-between gap-3">
                    <!-- Logo & Titre Vendeur -->
                    <div class="flex items-center gap-2.5 min-w-0">
                        <img src="${logoUrl}" alt="Campus Market" class="h-8 w-auto max-w-[130px] object-contain shrink-0" onerror="this.src='/assets/logo.webp'">
                        <div class="min-w-0">
                            <div class="flex items-center gap-1.5">
                                <span class="font-heading font-extrabold text-slate-900 text-sm leading-tight block truncate">Espace Vendeur</span>
                            </div>
                            <span class="text-[10px] text-slate-500 font-medium truncate block">${escapeHTML(seller.prenom)} ${escapeHTML(seller.nom)}</span>
                        </div>
                    </div>

                    <!-- Droite : Badge Statut Compact + Déconnexion Directe + Menu ⋮ -->
                    <div class="flex items-center gap-1.5 shrink-0">
                        ${!isSuspended ? `
                            <button 
                                type="button" 
                                id="hdr-btn-toggle-shop-mobile" 
                                title="${isOpen ? 'Mettre en pause' : 'Ouvrir la boutique'}"
                                class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all active:scale-95 cursor-pointer ${
                                    isOpen 
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                                        : 'bg-amber-50 text-amber-800 border-amber-300'
                                }"
                            >
                                <span class="w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
                                <span>${isOpen ? 'Ouverte' : 'Pause'}</span>
                            </button>
                        ` : ''}

                        <!-- Bouton Partager Boutique Mobile -->
                        <button 
                            type="button" 
                            id="hdr-btn-seller-share-mobile" 
                            title="Partager ma boutique"
                            class="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80 transition-all active:scale-95 cursor-pointer"
                        >
                            <i class="fa-solid fa-share-nodes text-xs"></i>
                        </button>

                        <!-- Bouton Déconnexion Directe Mobile -->
                        <button 
                            type="button" 
                            id="hdr-btn-seller-logout-mobile" 
                            title="Se déconnecter de l'espace marchand"
                            class="flex items-center justify-center w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 transition-all active:scale-95 cursor-pointer"
                        >
                            <i class="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                        </button>

                        <!-- Bouton Menu Unique Mobile ⋮ -->
                        <button 
                            type="button" 
                            id="hdr-btn-seller-menu-mobile" 
                            title="Menu des actions marchand"
                            class="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all active:scale-95 cursor-pointer"
                        >
                            <i class="fa-solid fa-ellipsis-vertical text-sm"></i>
                        </button>
                    </div>
                </div>
            </header>

            <!-- 3. TIROIR MOBILE (Bottom Sheet) pour actions essentielles (z-[60] au-dessus de la barre fixe) -->
            <div id="seller-mobile-drawer" class="hidden fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-xs flex flex-col justify-end transition-opacity duration-300 select-none">
                <div class="flex-1 w-full" id="seller-drawer-backdrop"></div>
                <div class="bg-white rounded-t-3xl border-t border-slate-200/80 p-5 pb-28 sm:pb-8 shadow-2xl flex flex-col gap-4 animate-slide-up w-full max-h-[85vh] overflow-y-auto">
                    <div class="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1"></div>
                    
                    <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                        <div class="flex items-center gap-2.5">
                            <img src="${logoUrl}" alt="Campus Market" class="h-8 w-auto max-w-[130px] object-contain shrink-0" onerror="this.src='/assets/logo.webp'">
                            <div>
                                <h4 class="font-heading font-extrabold text-sm text-slate-900">Boutique ${escapeHTML(seller.prenom)}</h4>
                                <p class="text-[11px] text-slate-400">Actions et paramètres du compte</p>
                            </div>
                        </div>
                        <button type="button" id="btn-close-seller-drawer" class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs cursor-pointer">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div class="flex flex-col gap-2">
                        <!-- Partager ma boutique -->
                        <button type="button" id="drawer-btn-share-shop" class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors cursor-pointer border border-emerald-200">
                            <i class="fa-solid fa-share-nodes text-sm text-emerald-600 w-5 text-center"></i>
                            <span>Partager ma boutique (Lien & WhatsApp)</span>
                        </button>

                        <!-- Mon Abonnement -->
                        <button type="button" id="drawer-btn-subscription" class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition-colors cursor-pointer border border-amber-200">
                            <i class="fa-solid fa-crown text-sm text-amber-600 w-5 text-center"></i>
                            <span>Mon Abonnement (3 Formules)</span>
                        </button>

                        <!-- Actualiser -->
                        <button type="button" id="drawer-btn-refresh-orders" class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer">
                            <i class="fa-solid fa-arrows-rotate text-sm text-slate-500 w-5 text-center"></i>
                            <span>Actualiser les commandes</span>
                        </button>

                        <!-- Alerte sonore -->
                        <button type="button" id="drawer-btn-toggle-audio" class="flex items-center justify-between px-4 py-3 rounded-2xl ${audioAlert.isEnabled ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-50 text-slate-700'} font-bold text-xs transition-colors cursor-pointer">
                            <div class="flex items-center gap-3">
                                <i class="fa-solid ${audioAlert.isEnabled ? 'fa-volume-high text-emerald-600' : 'fa-volume-xmark text-slate-500'} text-sm w-5 text-center"></i>
                                <span>Alerte sonore de commande</span>
                            </div>
                            <span class="text-[10px] font-extrabold ${audioAlert.isEnabled ? 'text-emerald-700' : 'text-slate-400'}">${audioAlert.isEnabled ? 'Activé' : 'Désactivé'}</span>
                        </button>

                        <!-- Voir boutique publique -->
                        <button type="button" id="drawer-btn-back-shop" class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-colors cursor-pointer">
                            <i class="fa-solid fa-store text-sm w-5 text-center"></i>
                            <span>Voir la marketplace publique</span>
                        </button>

                        ${seller.role === 'superadmin' ? `
                            <!-- Supervision SuperAdmin -->
                            <button type="button" id="drawer-btn-seller-back-admin" class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors cursor-pointer border border-indigo-200">
                                <i class="fa-solid fa-shield-halved text-sm text-indigo-600 w-5 text-center"></i>
                                <span>Supervision SuperAdmin</span>
                            </button>
                        ` : ''}

                        <!-- Déconnexion -->
                        <button type="button" id="drawer-btn-logout" class="flex items-center gap-3 px-4 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition-colors cursor-pointer">
                            <i class="fa-solid fa-arrow-right-from-bracket text-sm w-5 text-center"></i>
                            <span>Se déconnecter de l'espace marchand</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- 4. CONTENU PRINCIPAL PLEIN ÉCRAN (w-full lg:ml-64 lg:w-[calc(100%-16rem)]) -->
            <main class="w-full lg:ml-64 lg:w-[calc(100%-16rem)] min-h-screen bg-[#F8FAFC] flex flex-col flex-1 pb-28 sm:pb-8">
                <!-- TOP HEADER VENDEUR DESKTOP (hidden lg:flex, sticky top-0, z-30) -->
                <header class="hidden lg:flex sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 w-full px-8 py-3.5 items-center justify-between select-none shadow-xs">
                    <!-- Gauche : Fil d'Ariane & Titre de section -->
                    <div class="flex items-center gap-3">
                        <img src="${logoUrl}" alt="Campus Market" class="h-7.5 w-auto max-w-[140px] object-contain shrink-0" onerror="this.src='/assets/logo.webp'">
                        <div class="flex items-center gap-2 text-xs text-slate-400 font-semibold">
                            <span class="hover:text-slate-600 transition-colors">Espace Marchand</span>
                            <i class="fa-solid fa-chevron-right text-[10px] text-slate-300"></i>
                            <span class="text-primary font-bold">
                                ${activeSubTab === 'dashboard' ? 'Tableau de bord' : activeSubTab === 'orders' ? 'Commandes en direct' : activeSubTab === 'products' ? 'Mes Articles' : 'Ajouter un produit'}
                            </span>
                        </div>
                    </div>

                    <!-- Droite : Statut Boutique + Son + Actions Rapides + Profil -->
                    <div class="flex items-center gap-3">
                        <!-- Statut Boutique interactif -->
                        ${!isSuspended ? `
                            <button 
                                type="button" 
                                id="top-hdr-btn-toggle-shop" 
                                title="${isOpen ? 'Mettre la boutique en pause' : 'Ouvrir la boutique'}"
                                class="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all active:scale-95 cursor-pointer ${
                                    isOpen 
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100' 
                                        : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                                }"
                            >
                                <span class="w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
                                <span>${isOpen ? 'Boutique Ouverte' : 'Boutique en Pause'}</span>
                            </button>
                        ` : `
                            <div class="px-3 py-1.5 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1.5">
                                <i class="fa-solid fa-ban text-rose-600 text-xs"></i>
                                <span>Compte Suspendu</span>
                            </div>
                        `}

                        <div class="h-4 w-px bg-slate-200"></div>

                        <!-- Bouton Alerte Sonore Top -->
                        <button 
                            type="button" 
                            id="top-hdr-btn-toggle-audio" 
                            title="Activer/Désactiver les alertes sonores"
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer min-h-[36px] ${
                                audioAlert.isEnabled 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }"
                        >
                            <i class="fa-solid ${audioAlert.isEnabled ? 'fa-volume-high text-emerald-600' : 'fa-volume-xmark'} text-xs"></i>
                            <span>${audioAlert.isEnabled ? 'Son ON' : 'Son OFF'}</span>
                        </button>

                        <!-- Bouton Actualiser Top -->
                        <button 
                            type="button" 
                            id="top-hdr-btn-refresh-orders" 
                            title="Actualiser les commandes"
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                        >
                            <i class="fa-solid fa-arrows-rotate text-xs"></i>
                            <span>Actualiser</span>
                        </button>

                        <!-- Bouton Partager Boutique Top -->
                        <button 
                            type="button" 
                            id="top-hdr-btn-seller-share-shop" 
                            title="Partager le lien de ma boutique (Lien & WhatsApp)"
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                        >
                            <i class="fa-solid fa-share-nodes text-xs text-emerald-600"></i>
                            <span>Partager boutique</span>
                        </button>

                        <!-- Bouton Marketplace Top -->
                        <button 
                            type="button" 
                            id="top-hdr-btn-seller-back-shop" 
                            title="Voir la marketplace publique"
                            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                        >
                            <i class="fa-solid fa-store text-xs"></i>
                            <span>Marketplace</span>
                        </button>

                        ${seller.role === 'superadmin' ? `
                            <!-- Bouton Retour Supervision SuperAdmin Top -->
                            <button 
                                type="button" 
                                id="top-hdr-btn-seller-back-admin" 
                                title="Retourner au portail SuperAdmin"
                                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 active:scale-95 transition-all cursor-pointer min-h-[36px]"
                            >
                                <i class="fa-solid fa-shield-halved text-xs text-indigo-600"></i>
                                <span>SuperAdmin</span>
                            </button>
                        ` : ''}

                        <div class="h-4 w-px bg-slate-200"></div>

                        <!-- Profil Marchand & Déconnexion -->
                        <div class="flex items-center gap-2.5 pl-1">
                            <div class="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-extrabold text-xs shadow-xs">
                                ${((seller?.prenom?.[0] || '') + (seller?.nom?.[0] || 'V')).toUpperCase()}
                            </div>
                            <div class="flex flex-col text-left">
                                <span class="text-xs font-extrabold text-slate-900 leading-tight truncate max-w-[120px]">${escapeHTML(seller.prenom)} ${escapeHTML(seller.nom)}</span>
                                <span class="text-[10px] text-slate-400 font-bold uppercase leading-none">Marchand</span>
                            </div>
                            <button 
                                type="button" 
                                id="top-hdr-btn-seller-logout" 
                                title="Se déconnecter de l'espace marchand"
                                class="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 flex items-center justify-center text-xs active:scale-95 transition-all cursor-pointer ml-1"
                            >
                                <i class="fa-solid fa-arrow-right-from-bracket"></i>
                            </button>
                        </div>
                    </div>
                </header>

                <div class="p-4 sm:p-6 lg:p-8 xl:p-10 flex flex-col gap-6 flex-1">
                ${isSuspended ? `
                    <!-- Alerte rouge Vendeur Suspendu -->
                    <div class="bg-rose-50 border-2 border-rose-300 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5 text-rose-950 animate-fade-in shadow-xs">
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
                            <div class="mt-3 flex items-center gap-3 flex-wrap">
                                <a 
                                    href="${SUPPORT_CONFIG.whatsappUrl}" 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    class="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer min-h-[40px]"
                                >
                                    <i class="fa-brands fa-whatsapp text-sm"></i>
                                    <span>Assistance et Déblocage (${SUPPORT_CONFIG.phoneDisplay})</span>
                                </a>
                                <a 
                                    href="tel:${SUPPORT_CONFIG.phoneRaw}" 
                                    class="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-rose-200 text-rose-800 font-semibold text-xs rounded-xl hover:bg-rose-50 transition-colors min-h-[40px]"
                                >
                                    <i class="fa-solid fa-phone text-xs"></i>
                                    <span>Appeler</span>
                                </a>
                            </div>
                        </div>
                    </div>
                ` : ''}

                <!-- Barre d'onglets de navigation Tablette (sm à lg uniquement, masquée sur desktop et mobile) -->
                <div class="hidden sm:flex lg:hidden items-center gap-1.5 border-b border-slate-200/80 overflow-x-auto no-scrollbar pb-2">
                    <button 
                        type="button" 
                        data-seller-tab="dashboard"
                        class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap min-h-[44px] cursor-pointer active:scale-95 ${
                            activeSubTab === 'dashboard'
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }"
                    >
                        <i class="fa-solid fa-chart-pie text-xs"></i>
                        <span>Dashboard</span>
                    </button>

                    <button 
                        type="button" 
                        data-seller-tab="orders"
                        class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap min-h-[44px] cursor-pointer active:scale-95 ${
                            activeSubTab === 'orders'
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }"
                    >
                        <i class="fa-solid fa-clipboard-list text-xs"></i>
                        <span>Commandes</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            activeSubTab === 'orders' 
                                ? 'bg-white/20 text-white' 
                                : (pendingCount > 0 ? 'bg-amber-400 text-slate-950 animate-pulse' : 'bg-slate-100 text-slate-600')
                        }">
                            ${allOrders.length}
                        </span>
                    </button>

                    <button 
                        type="button" 
                        data-seller-tab="products"
                        class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap min-h-[44px] cursor-pointer active:scale-95 ${
                            activeSubTab === 'products'
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }"
                    >
                        <i class="fa-solid fa-tags text-xs"></i>
                        <span>Mes Articles</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            activeSubTab === 'products' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }">
                            ${data.totalProductsCount || 0}
                        </span>
                    </button>

                    ${!isSuspended ? `
                        <button 
                            type="button" 
                            data-seller-tab="add-product"
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
                    ${activeSubTab === 'dashboard' ? renderDashboardHomeTab(data, allOrders, subCalc, isSuspended, isOpen) : ''}
                    ${activeSubTab === 'orders' ? renderOrdersTab(allOrders) : ''}
                </div>
            </main>

            <!-- 5. BARRE INFÉRIEURE FIXE MOBILE VENDEUR (lg:hidden, TOUJOURS visible, z-50) -->
            <nav class="lg:hidden fixed bottom-0 inset-x-0 z-50 w-full bg-white/95 backdrop-blur-xl border-t border-slate-200/80 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.08)] select-none" aria-label="Navigation vendeur mobile">
                <div class="max-w-md mx-auto px-2 py-1.5 flex items-center justify-around">
                    <!-- Dashboard -->
                    <button 
                        type="button" 
                        id="bnav-seller-dashboard" 
                        class="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-h-[48px] min-w-[56px] cursor-pointer active:scale-95 ${
                            activeSubTab === 'dashboard'
                                ? 'text-primary font-bold'
                                : 'text-slate-500 hover:text-slate-800 font-medium'
                        }"
                    >
                        ${activeSubTab === 'dashboard' ? '<span class="absolute top-0 w-8 h-1 bg-primary rounded-full"></span>' : ''}
                        <i class="fa-solid fa-chart-pie text-lg mb-0.5"></i>
                        <span class="text-[10px] leading-tight">Dashboard</span>
                    </button>

                    <!-- Commandes -->
                    <button 
                        type="button" 
                        id="bnav-seller-orders" 
                        class="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-h-[48px] min-w-[56px] cursor-pointer active:scale-95 ${
                            activeSubTab === 'orders'
                                ? 'text-primary font-bold'
                                : 'text-slate-500 hover:text-slate-800 font-medium'
                        }"
                    >
                        ${activeSubTab === 'orders' ? '<span class="absolute top-0 w-8 h-1 bg-primary rounded-full"></span>' : ''}
                        <div class="relative">
                            <i class="fa-solid fa-clipboard-list text-lg mb-0.5"></i>
                            ${pendingCount > 0 ? `
                                <span class="absolute -top-1.5 -right-2.5 bg-amber-400 text-slate-950 font-extrabold text-[10px] px-1.5 py-0.2 rounded-full border-2 border-white shadow-sm min-w-[18px] text-center transform scale-100 animate-pulse">
                                    ${pendingCount}
                                </span>
                            ` : ''}
                        </div>
                        <span class="text-[10px] leading-tight">Commandes</span>
                    </button>

                    <!-- Mes Articles -->
                    <button 
                        type="button" 
                        id="bnav-seller-products" 
                        class="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-h-[48px] min-w-[56px] cursor-pointer active:scale-95 ${
                            activeSubTab === 'products'
                                ? 'text-primary font-bold'
                                : 'text-slate-500 hover:text-slate-800 font-medium'
                        }"
                    >
                        ${activeSubTab === 'products' ? '<span class="absolute top-0 w-8 h-1 bg-primary rounded-full"></span>' : ''}
                        <div class="relative">
                            <i class="fa-solid fa-tags text-lg mb-0.5"></i>
                            <span class="absolute -top-1.5 -right-2.5 bg-slate-100 text-slate-700 font-bold text-[9px] px-1 py-0.2 rounded-full border border-slate-200 min-w-[16px] text-center">
                                ${data.totalProductsCount || 0}
                            </span>
                        </div>
                        <span class="text-[10px] leading-tight">Articles</span>
                    </button>

                    <!-- Ajouter un produit (si non suspendu) -->
                    ${!isSuspended ? `
                        <button 
                            type="button" 
                            id="bnav-seller-add" 
                            class="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-h-[48px] min-w-[56px] cursor-pointer active:scale-95 ${
                                activeSubTab === 'add-product'
                                    ? 'text-emerald-700 font-bold'
                                    : 'text-emerald-600 hover:text-emerald-800 font-medium'
                            }"
                        >
                            ${activeSubTab === 'add-product' ? '<span class="absolute top-0 w-8 h-1 bg-emerald-600 rounded-full"></span>' : ''}
                            <i class="fa-solid fa-circle-plus text-lg mb-0.5"></i>
                            <span class="text-[10px] leading-tight">Ajouter</span>
                        </button>
                    ` : ''}

                    <!-- Voir Boutique Publique -->
                    <button 
                        type="button" 
                        id="bnav-seller-shop" 
                        class="relative flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all duration-200 min-h-[48px] min-w-[56px] text-slate-500 hover:text-primary font-medium cursor-pointer active:scale-95"
                    >
                        <i class="fa-solid fa-store text-lg mb-0.5"></i>
                        <span class="text-[10px] leading-tight">Boutique</span>
                    </button>
                </div>
            </nav>
        `;

        if (activeSubTab === 'products' || activeSubTab === 'add-product') {
            const currentProfile = dashboardData?.profile || seller;
            const productManagerEl = createProductManager({
                sellerId,
                sellerProfile: currentProfile,
                isSuspended,
                initialTab: activeSubTab === 'add-product' ? 'add' : 'list',
                onTabChange: (tab) => {
                    activeSubTab = tab;
                },
                onProductChanged: () => {
                    activeSubTab = 'products';
                    loadData(true);
                },
            });
            containerEl.querySelector('#seller-tab-content')?.appendChild(productManagerEl);
        }

        bindEvents();
    }

    function renderDashboardHomeTab(data, allOrders, subCalc, isSuspended, isOpen) {
        const pendingOrders = allOrders.filter(
            (o) => o.status === 'pending' || o.status === 'processing' || o.status === 'confirmed'
        );
        const maxAllowed = data.maxAllowed || 3;

        return `
            <div class="flex flex-col gap-6 w-full animate-fade-in">
                <!-- 1. Bannière d'Abonnement (uniquement sur le Dashboard) -->
                ${renderSubscriptionBanner(subCalc)}

                <!-- 2. Guide de Démarrage Rapide (Onboarding Hero) si nouveau vendeur -->
                ${(allOrders.length === 0 || Number(data.totalProductsCount || 0) === 0) && !isSuspended ? `
                    <div class="bg-gradient-to-br from-blue-50/70 via-white to-amber-50/30 rounded-3xl border border-primary/20 shadow-card p-5 sm:p-7 relative overflow-hidden flex flex-col gap-5">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                            <div class="flex items-center gap-3.5">
                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-blue-600 text-white flex items-center justify-center text-xl shadow-md shadow-primary/20 flex-shrink-0">
                                    <i class="fa-solid fa-rocket"></i>
                                </div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <h3 class="font-heading font-extrabold text-slate-900 text-base sm:text-lg">
                                            Bienvenue sur votre Espace Marchand, ${escapeHTML(seller.prenom)} !
                                        </h3>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                                            Guide 3 étapes
                                        </span>
                                    </div>
                                    <p class="text-xs text-slate-500 mt-0.5">
                                        Activez votre boutique en quelques clics pour recevoir vos premières commandes sur le campus de Thiès.
                                    </p>
                                </div>
                            </div>
                            <div class="flex items-center gap-2 self-start sm:self-center">
                                <span class="px-3 py-1 rounded-full text-xs font-extrabold ${Number(data.totalProductsCount || 0) > 0 ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-blue-100 text-primary border border-blue-200'}">
                                    ${Number(data.totalProductsCount || 0) > 0 ? 'Étape 2 sur 3 • 66%' : 'Étape 1 sur 3 • 33%'}
                                </span>
                            </div>
                        </div>

                        <!-- Jauge de progression animée -->
                        <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                            <div class="bg-gradient-to-r from-primary to-amber-500 h-full rounded-full transition-all duration-500" style="width: ${Number(data.totalProductsCount || 0) > 0 ? (allOrders.length > 0 ? '100%' : '66%') : '33%'}"></div>
                        </div>

                        <!-- Les 3 étapes interactives -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                            <!-- Étape 1 -->
                            <div class="bg-white/80 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between gap-3 shadow-xs">
                                <div class="flex items-start gap-3">
                                    <div class="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black shrink-0">
                                        <i class="fa-solid fa-check"></i>
                                    </div>
                                    <div>
                                        <h4 class="font-heading font-bold text-xs text-slate-900">1. Boutique Ouverte</h4>
                                        <p class="text-[11px] text-slate-500 mt-0.5 leading-snug">Votre boutique est active et prête à recevoir les commandes étudiantes.</p>
                                    </div>
                                </div>
                                <span class="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                    <i class="fa-solid fa-circle-check text-[10px]"></i> Opérationnel
                                </span>
                            </div>

                            <!-- Étape 2 -->
                            <div class="bg-white/80 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between gap-3 shadow-xs">
                                <div class="flex items-start gap-3">
                                    <div class="w-7 h-7 rounded-xl ${Number(data.totalProductsCount || 0) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary'} flex items-center justify-center text-xs font-black shrink-0">
                                        ${Number(data.totalProductsCount || 0) > 0 ? '<i class="fa-solid fa-check"></i>' : '2'}
                                    </div>
                                    <div>
                                        <h4 class="font-heading font-bold text-xs text-slate-900">2. Publier un Article</h4>
                                        <p class="text-[11px] text-slate-500 mt-0.5 leading-snug">Ajoutez votre premier plat, fourniture ou produit avec photo et prix.</p>
                                    </div>
                                </div>
                                ${Number(data.totalProductsCount || 0) > 0 ? `
                                    <span class="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                                        <i class="fa-solid fa-circle-check text-[10px]"></i> ${data.totalProductsCount} article(s) en ligne
                                    </span>
                                ` : `
                                    <button type="button" id="btn-onboarding-add-product" class="px-3 py-1.5 bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer">
                                        <i class="fa-solid fa-plus text-[10px]"></i> Publier maintenant
                                    </button>
                                `}
                            </div>

                            <!-- Étape 3 -->
                            <div class="bg-white/80 p-4 rounded-2xl border border-slate-200/80 flex flex-col justify-between gap-3 shadow-xs">
                                <div class="flex items-start gap-3">
                                    <div class="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs font-black shrink-0">
                                        <i class="fa-brands fa-whatsapp text-sm"></i>
                                    </div>
                                    <div>
                                        <h4 class="font-heading font-bold text-xs text-slate-900">3. Partager sur WhatsApp</h4>
                                        <p class="text-[11px] text-slate-500 mt-0.5 leading-snug">Diffusez votre catalogue dans les groupes de vos pavillons.</p>
                                    </div>
                                </div>
                                <button type="button" id="btn-onboarding-share-wa" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer">
                                    <i class="fa-brands fa-whatsapp text-xs"></i> Partager le lien
                                </button>
                            </div>
                        </div>

                        <!-- Astuce campus UIDT -->
                        <div class="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 sm:p-3.5 flex items-start gap-2.5 text-amber-900 text-xs">
                            <i class="fa-solid fa-lightbulb text-amber-600 text-sm mt-0.5 shrink-0"></i>
                            <div>
                                <span class="font-bold">Conseil Campus UIDT :</span> Les étudiants commandent principalement entre 12h-14h et 19h-22h dans les Pavillons A et B. Gardez votre boutique en statut "Ouvert" et votre téléphone actif durant ces créneaux pour maximiser vos ventes !
                            </div>
                        </div>
                    </div>
                ` : ''}

                <!-- 3. Grille Bento KPI (2 colonnes mobile, 4 colonnes desktop) -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
                    <!-- Revenus Cumulés -->
                    <div 
                        data-seller-kpi="orders-delivered" 
                        title="Cliquer pour afficher les commandes livrées"
                        class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between cursor-pointer group hover:border-emerald-400 hover:shadow-md transition-all active:scale-[0.99]"
                    >
                        <div class="flex items-center justify-between text-slate-500 mb-2">
                            <span class="text-xs font-semibold text-slate-600 truncate group-hover:text-emerald-700 transition-colors">Revenus réalisés</span>
                            <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xs shrink-0 group-hover:bg-emerald-100 transition-colors">
                                <i class="fa-solid fa-sack-dollar"></i>
                            </div>
                        </div>
                        <span class="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 tracking-tight tabular-nums">
                            ${Number(data.totalRevenue || 0).toLocaleString('fr-FR')} <span class="text-xs font-bold text-slate-500">FCFA</span>
                        </span>
                        <div class="flex items-center justify-between text-[11px] font-medium text-emerald-600 mt-1">
                            <span class="flex items-center gap-1"><i class="fa-solid fa-circle-check text-[9px]"></i> Ventes confirmées</span>
                            <span class="text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 flex items-center gap-0.5 transition-colors">Voir <i class="fa-solid fa-chevron-right text-[8px]"></i></span>
                        </div>
                    </div>

                    <!-- Commandes en cours -->
                    <div 
                        data-seller-kpi="orders-pending" 
                        title="Cliquer pour afficher les commandes actives à traiter"
                        class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between relative overflow-hidden cursor-pointer group hover:border-amber-400 hover:shadow-md transition-all active:scale-[0.99]"
                    >
                        <div class="flex items-center justify-between text-slate-500 mb-2">
                            <span class="text-xs font-semibold text-slate-600 truncate group-hover:text-amber-700 transition-colors">Commandes actives</span>
                            <div class="w-8 h-8 rounded-xl bg-blue-50 text-primary flex items-center justify-center text-xs shrink-0 group-hover:bg-blue-100 transition-colors">
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
                        <div class="flex items-center justify-between text-[11px] font-medium text-slate-400 mt-1">
                            <span>Flux direct campus</span>
                            <span class="text-[10px] font-bold text-slate-400 group-hover:text-primary flex items-center gap-0.5 transition-colors">Voir <i class="fa-solid fa-chevron-right text-[8px]"></i></span>
                        </div>
                    </div>

                    <!-- Articles en ligne (Quota Formule : X / maxAllowed) -->
                    <div 
                        data-seller-kpi="products" 
                        title="Cliquer pour gérer mes articles en ligne"
                        class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between cursor-pointer group hover:border-amber-400 hover:shadow-md transition-all active:scale-[0.99]"
                    >
                        <div class="flex items-center justify-between text-slate-500 mb-2">
                            <span class="text-xs font-semibold text-slate-600 truncate group-hover:text-amber-700 transition-colors">Articles en ligne</span>
                            <div class="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xs shrink-0 group-hover:bg-amber-100 transition-colors">
                                <i class="fa-solid fa-boxes-stacked"></i>
                            </div>
                        </div>
                        <span class="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900 tracking-tight">
                            ${data.totalProductsCount || 0} <span class="text-xs font-bold text-slate-400">/ ${maxAllowed}</span>
                        </span>
                        <div class="flex items-center justify-between text-[11px] font-medium text-slate-400 mt-1">
                            <span>${data.activeProductsCount || 0} en stock</span>
                            <span class="text-[10px] font-bold text-slate-400 group-hover:text-amber-600 flex items-center gap-0.5 transition-colors">Gérer <i class="fa-solid fa-chevron-right text-[8px]"></i></span>
                        </div>
                    </div>

                    <!-- Disponibilité Boutique -->
                    <div 
                        data-seller-kpi="toggle-shop" 
                        title="${isOpen ? 'Cliquer pour mettre la boutique en pause' : 'Cliquer pour ouvrir la boutique aux commandes'}"
                        class="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between cursor-pointer group hover:border-emerald-400 hover:shadow-md transition-all active:scale-[0.99]"
                    >
                        <div class="flex items-center justify-between text-slate-500 mb-2">
                            <span class="text-xs font-semibold text-slate-600 truncate group-hover:text-slate-900 transition-colors">Statut boutique</span>
                            <div class="w-8 h-8 rounded-xl ${isOpen ? 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 group-hover:bg-amber-100'} flex items-center justify-center text-xs shrink-0 transition-colors">
                                <i class="fa-solid ${isOpen ? 'fa-store' : 'fa-pause'}"></i>
                            </div>
                        </div>
                        <span class="font-heading font-extrabold text-lg sm:text-xl ${isOpen ? 'text-emerald-700' : 'text-amber-700'} tracking-tight">
                            ${isOpen ? 'Boutique Ouverte' : 'En Pause'}
                        </span>
                        <div class="flex items-center justify-between text-[11px] font-medium text-slate-400 mt-1">
                            <span>Commandes étudiantes</span>
                            <span class="text-[10px] font-bold text-slate-400 group-hover:text-slate-700 flex items-center gap-0.5 transition-colors">Changer <i class="fa-solid fa-arrows-rotate text-[8px]"></i></span>
                        </div>
                    </div>
                </div>

                <!-- 4. Raccourcis d'action rapide -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <button 
                        type="button" 
                        id="btn-dashboard-go-products" 
                        class="flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl shadow-xs transition-all text-left cursor-pointer group active:scale-[0.99]"
                    >
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm group-hover:scale-105 transition-transform">
                                <i class="fa-solid fa-tags"></i>
                            </div>
                            <div>
                                <h4 class="font-heading font-bold text-xs sm:text-sm text-slate-900">Mes Articles</h4>
                                <p class="text-[11px] text-slate-500 mt-0.5">${data.totalProductsCount || 0} produit(s) au catalogue</p>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-right text-xs text-slate-400 group-hover:text-primary transition-colors"></i>
                    </button>

                    ${!isSuspended ? `
                        <button 
                            type="button" 
                            id="btn-dashboard-go-add-product" 
                            class="flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl shadow-xs transition-all text-left cursor-pointer group active:scale-[0.99]"
                        >
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm group-hover:scale-105 transition-transform">
                                    <i class="fa-solid fa-plus"></i>
                                </div>
                                <div>
                                    <h4 class="font-heading font-bold text-xs sm:text-sm text-slate-900">Ajouter un produit</h4>
                                    <p class="text-[11px] text-slate-500 mt-0.5">${Math.max(0, maxAllowed - (data.totalProductsCount || 0))} place(s) restante(s)</p>
                                </div>
                            </div>
                            <i class="fa-solid fa-chevron-right text-xs text-slate-400 group-hover:text-emerald-600 transition-colors"></i>
                        </button>
                    ` : ''}

                    <button 
                        type="button" 
                        id="btn-dashboard-go-orders" 
                        class="flex items-center justify-between p-4 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl shadow-xs transition-all text-left cursor-pointer group active:scale-[0.99]"
                    >
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm group-hover:scale-105 transition-transform">
                                <i class="fa-solid fa-clipboard-list"></i>
                            </div>
                            <div>
                                <h4 class="font-heading font-bold text-xs sm:text-sm text-slate-900">Gérer les commandes</h4>
                                <p class="text-[11px] text-slate-500 mt-0.5">${allOrders.length} commande(s) reçue(s)</p>
                            </div>
                        </div>
                        <i class="fa-solid fa-chevron-right text-xs text-slate-400 group-hover:text-amber-600 transition-colors"></i>
                    </button>
                </div>

                <!-- 5. Aperçu des dernières commandes -->
                <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-6 flex flex-col gap-4">
                    <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                        <div class="flex items-center gap-2">
                            <h3 class="font-heading font-extrabold text-sm sm:text-base text-slate-900">Commandes récentes</h3>
                            ${pendingOrders.length > 0 ? `
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                    ${pendingOrders.length} en attente
                                </span>
                            ` : ''}
                        </div>
                        <button 
                            type="button" 
                            id="btn-dashboard-view-all-orders" 
                            class="text-xs font-bold text-primary hover:text-primary-hover inline-flex items-center gap-1 cursor-pointer"
                        >
                            <span>Voir tout (${allOrders.length})</span>
                            <i class="fa-solid fa-arrow-right text-[10px]"></i>
                        </button>
                    </div>

                    ${allOrders.length === 0 ? `
                        <div class="py-8 text-center flex flex-col items-center justify-center gap-2">
                            <div class="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-lg">
                                <i class="fa-solid fa-inbox"></i>
                            </div>
                            <p class="text-xs text-slate-500 font-medium max-w-sm">
                                Vous n'avez pas encore de commandes. Dès qu'un étudiant passe une commande sur votre vitrine, elle apparaîtra ici avec une alerte sonore !
                            </p>
                        </div>
                    ` : `
                        <div class="divide-y divide-slate-100">
                            ${allOrders.slice(0, 5).map((order) => {
                                const buyerName = escapeHTML(order.buyer_name || 'Étudiant');
                                const total = Number(order.total_price || order.price || 0).toLocaleString('fr-FR');
                                const statusLabels = {
                                    pending: { label: 'En attente', color: 'bg-amber-100 text-amber-900 border-amber-300' },
                                    processing: { label: 'En cours', color: 'bg-blue-100 text-blue-900 border-blue-300' },
                                    confirmed: { label: 'Confirmée', color: 'bg-blue-100 text-blue-900 border-blue-300' },
                                    shipped: { label: 'En livraison', color: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
                                    delivered: { label: 'Livrée', color: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
                                    cancelled: { label: 'Annulée', color: 'bg-rose-100 text-rose-900 border-rose-300' },
                                };
                                const st = statusLabels[order.status] || { label: order.status, color: 'bg-slate-100 text-slate-700 border-slate-200' };

                                return `
                                    <div class="py-3 flex items-center justify-between gap-3 text-xs">
                                        <div class="flex items-center gap-3 min-w-0">
                                            <div class="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-bold shrink-0">
                                                <i class="fa-solid fa-bag-shopping"></i>
                                            </div>
                                            <div class="min-w-0">
                                                <div class="flex items-center gap-2">
                                                    <span class="font-bold text-slate-900 truncate">${buyerName}</span>
                                                    <span class="text-[10px] text-slate-400 font-mono">#${(order.id || '').slice(0, 6)}</span>
                                                </div>
                                                <p class="text-[11px] text-slate-500 truncate">
                                                    ${escapeHTML(order.product?.title || order.delivery_address || 'Commande')}
                                                </p>
                                            </div>
                                        </div>
                                        <div class="flex items-center gap-3 shrink-0">
                                            <span class="font-extrabold text-slate-900 tabular-nums">${total} F</span>
                                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${st.color}">
                                                ${st.label}
                                            </span>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    function renderOrdersTab(orders) {
        const isSuspended = checkSellerSuspended();

        // Filtrage multi-critères : statut, recherche textuelle, pavillon
        const filtered = orders.filter((o) => {
            // 1. Statut
            if (orderFilter === 'pending' && o.status !== 'pending') return false;
            if (orderFilter === 'in_progress' && !['confirmed', 'processing', 'shipped'].includes(o.status)) return false;
            if (orderFilter === 'delivered' && o.status !== 'delivered') return false;

            // 2. Recherche textuelle
            if (orderSearchQuery) {
                const q = orderSearchQuery.toLowerCase();
                const name = (o.buyer_name || '').toLowerCase();
                const phone = (o.buyer_phone || '').toLowerCase();
                const ref = (o.reference || `#cmd-${(o.id || '').slice(0, 6)}`).toLowerCase();
                const item = (o.product?.title || '').toLowerCase();
                if (!name.includes(q) && !phone.includes(q) && !ref.includes(q) && !item.includes(q)) {
                    return false;
                }
            }

            // 3. Pavillon
            if (orderPavillonFilter !== 'all') {
                const addr = (o.delivery_address || '').toLowerCase();
                if (!addr.includes(orderPavillonFilter.toLowerCase())) return false;
            }

            return true;
        });

        const pendingOrdersCount = orders.filter((o) => o.status === 'pending').length;
        const inProgressOrdersCount = orders.filter((o) => ['confirmed', 'processing', 'shipped'].includes(o.status)).length;
        const deliveredOrdersCount = orders.filter((o) => o.status === 'delivered').length;

        return `
            <div class="flex flex-col gap-4">
                <!-- Barre d'outils commandes : Recherche, Filtre Pavillon & Export CSV -->
                <div class="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <!-- Recherche textuelle -->
                    <div class="relative flex-1">
                        <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
                        <input 
                            type="text" 
                            id="input-seller-search-orders" 
                            value="${escapeHTML(orderSearchQuery)}"
                            placeholder="Rechercher étudiant, tél, #CMD..." 
                            class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all min-h-[40px]"
                        >
                    </div>

                    <div class="flex items-center gap-2 flex-wrap">
                        <!-- Filtre Pavillon -->
                        <select 
                            id="select-seller-pavillon" 
                            class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all min-h-[40px] cursor-pointer"
                        >
                            <option value="all" ${orderPavillonFilter === 'all' ? 'selected' : ''}>Tous les pavillons</option>
                            <option value="Pavillon A1" ${orderPavillonFilter === 'Pavillon A1' ? 'selected' : ''}>Pavillon A1</option>
                            <option value="Pavillon A2" ${orderPavillonFilter === 'Pavillon A2' ? 'selected' : ''}>Pavillon A2</option>
                            <option value="Pavillon B" ${orderPavillonFilter === 'Pavillon B' ? 'selected' : ''}>Pavillon B</option>
                            <option value="Pavillon C" ${orderPavillonFilter === 'Pavillon C' ? 'selected' : ''}>Pavillon C</option>
                            <option value="Pavillon D" ${orderPavillonFilter === 'Pavillon D' ? 'selected' : ''}>Pavillon D</option>
                            <option value="Jardin Social" ${orderPavillonFilter === 'Jardin Social' ? 'selected' : ''}>Jardin Social</option>
                        </select>

                        <!-- Bouton Export CSV -->
                        <button 
                            type="button" 
                            id="btn-seller-export-orders" 
                            title="Exporter mes ventes en format CSV"
                            class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all min-h-[40px] cursor-pointer"
                        >
                            <i class="fa-solid fa-file-csv text-primary text-xs"></i>
                            <span>Exporter CSV</span>
                        </button>
                    </div>
                </div>

                <!-- Filtres par pilules de statut -->
                <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    <button type="button" data-order-filter="all" class="px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap min-h-[38px] cursor-pointer active:scale-95 ${
                        orderFilter === 'all'
                            ? 'bg-primary text-white shadow-xs'
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
                    <div class="p-8 sm:p-12 text-center bg-gradient-to-br from-blue-50/50 via-white to-amber-50/30 rounded-3xl border border-primary/20 shadow-card my-2">
                        <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-blue-600 text-white flex items-center justify-center text-2xl mx-auto mb-3 shadow-md shadow-primary/20">
                            <i class="fa-solid fa-inbox"></i>
                        </div>
                        <h4 class="font-heading font-extrabold text-slate-900 text-base sm:text-lg mb-1">
                            ${orderSearchQuery || orderPavillonFilter !== 'all' ? 'Aucune commande ne correspond à ces critères' : 'Aucune commande enregistrée pour le moment'}
                        </h4>
                        <p class="text-xs text-slate-500 max-w-sm mx-auto mb-5 leading-relaxed">
                            ${orderSearchQuery || orderPavillonFilter !== 'all' ? 'Essayez de modifier votre recherche ou de réinitialiser le filtre pavillon.' : 'Vos commandes apparaîtront ici dès qu\'un étudiant valide son panier sur le campus.'}
                        </p>
                        <button type="button" id="btn-empty-share-wa" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all inline-flex items-center gap-2 cursor-pointer">
                            <i class="fa-brands fa-whatsapp text-sm"></i>
                            <span>Diffuser le lien de ma boutique sur WhatsApp</span>
                        </button>
                    </div>
                ` : `
                    <div class="flex flex-col gap-3.5">
                        ${filtered.map((o) => {
                            const clientPhone = formatSenegalPhone(o.buyer_phone || '');
                            const productTitle = o.product ? o.product.title : 'Article Campus Market';

                            let nextActionBtn = '';
                            let statusLabel = '';
                            let statusBadgeClass = '';
                            let stepIdx = 1;

                            switch (o.status) {
                                case 'pending':
                                    statusLabel = 'En attente';
                                    statusBadgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                                    stepIdx = 1;
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
                                    stepIdx = 2;
                                    nextActionBtn = `
                                        <button data-action="update-status" data-id="${o.id}" data-next="processing" class="px-4 py-2 bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all min-h-[44px] flex items-center gap-1.5 cursor-pointer">
                                            <i class="fa-solid fa-fire-burner text-xs"></i>
                                            <span>Préparer</span>
                                        </button>
                                    `;
                                    break;
                                case 'processing':
                                    statusLabel = 'En préparation';
                                    statusBadgeClass = 'bg-indigo-50 text-indigo-800 border-indigo-200';
                                    stepIdx = 3;
                                    nextActionBtn = `
                                        <button data-action="update-status" data-id="${o.id}" data-next="shipped" class="px-4 py-2 bg-primary hover:bg-primary-hover active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all min-h-[44px] flex items-center gap-1.5 cursor-pointer">
                                            <i class="fa-solid fa-motorcycle text-xs"></i>
                                            <span>Remettre au livreur</span>
                                        </button>
                                    `;
                                    break;
                                case 'shipped':
                                    statusLabel = 'En livraison';
                                    statusBadgeClass = 'bg-purple-50 text-purple-800 border-purple-200';
                                    stepIdx = 3;
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
                                    stepIdx = 4;
                                    nextActionBtn = `
                                        <span class="text-xs font-bold text-emerald-700 flex items-center gap-1 py-1">
                                            <i class="fa-solid fa-circle-check"></i> Terminée
                                        </span>
                                    `;
                                    break;
                                case 'cancelled':
                                    statusLabel = 'Annulée';
                                    statusBadgeClass = 'bg-slate-100 text-slate-500 line-through border-slate-200';
                                    stepIdx = 0;
                                    break;
                            }

                            if (isSuspended) {
                                nextActionBtn = `
                                    <span class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 inline-flex items-center gap-1.5 cursor-not-allowed" title="Compte suspendu par l'administration">
                                        <i class="fa-solid fa-lock text-[10px]"></i>
                                        <span>Action bloquée (Suspendu)</span>
                                    </span>
                                `;
                            }

                            const orderRef = o.reference || `#CMD-${o.id.slice(0, 6).toUpperCase()}`;

                            // Badges officiels de mode de règlement (Wave cyan, OM orange, Cash vert)
                            let paymentBadge = '';
                            if (o.payment_method === 'wave') {
                                paymentBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-50 text-sky-700 border border-sky-200 inline-flex items-center gap-1"><i class="fa-solid fa-water text-[9px]"></i> Wave</span>`;
                            } else if (o.payment_method === 'om') {
                                paymentBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-orange-50 text-orange-700 border border-orange-200 inline-flex items-center gap-1"><i class="fa-solid fa-mobile-screen text-[9px]"></i> Orange Money</span>`;
                            } else {
                                paymentBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1"><i class="fa-solid fa-money-bill-wave text-[9px]"></i> Espèces</span>`;
                            }

                            // Message WhatsApp type poli et direct
                            const waText = `Bonjour ${o.buyer_name || 'cher client'} ! Je suis votre marchand Campus Market concernant votre commande ${orderRef} (${productTitle}). Je prépare votre commande pour livraison au ${o.delivery_address || 'campus'}. Confirmez-vous votre présence ?`;

                            return `
                                <div class="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5 shadow-xs hover:shadow-card transition-all">
                                    <!-- En-tête de la commande -->
                                    <div class="flex items-center justify-between border-b border-slate-100 pb-2.5 flex-wrap gap-2">
                                        <div class="flex items-center gap-2">
                                            <span class="font-mono font-bold text-xs text-primary">${escapeHTML(orderRef)}</span>
                                            <span class="text-slate-300">•</span>
                                            <span class="text-xs text-slate-400">
                                                ${new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à ${new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            ${paymentBadge}
                                            <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeClass}">
                                                ${statusLabel}
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Stepper Visuel 4 Étapes de Commande -->
                                    ${stepIdx > 0 ? `
                                        <div class="w-full bg-slate-50/80 p-2.5 rounded-xl border border-slate-100/90 my-0.5">
                                            <div class="flex items-center justify-between text-[11px] font-bold">
                                                <div class="flex items-center gap-1.5 ${stepIdx >= 1 ? 'text-primary' : 'text-slate-400'}">
                                                    <span class="w-4 h-4 rounded-full ${stepIdx >= 1 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'} flex items-center justify-center text-[9px] font-black">1</span>
                                                    <span>Reçue</span>
                                                </div>
                                                <div class="flex-1 h-0.5 mx-2 ${stepIdx >= 2 ? 'bg-primary' : 'bg-slate-200'}"></div>
                                                <div class="flex items-center gap-1.5 ${stepIdx >= 2 ? 'text-primary' : 'text-slate-400'}">
                                                    <span class="w-4 h-4 rounded-full ${stepIdx >= 2 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'} flex items-center justify-center text-[9px] font-black">2</span>
                                                    <span>Confirmée</span>
                                                </div>
                                                <div class="flex-1 h-0.5 mx-2 ${stepIdx >= 3 ? 'bg-primary' : 'bg-slate-200'}"></div>
                                                <div class="flex items-center gap-1.5 ${stepIdx >= 3 ? 'text-primary' : 'text-slate-400'}">
                                                    <span class="w-4 h-4 rounded-full ${stepIdx >= 3 ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'} flex items-center justify-center text-[9px] font-black">3</span>
                                                    <span>En route</span>
                                                </div>
                                                <div class="flex-1 h-0.5 mx-2 ${stepIdx >= 4 ? 'bg-emerald-600' : 'bg-slate-200'}"></div>
                                                <div class="flex items-center gap-1.5 ${stepIdx >= 4 ? 'text-emerald-700 font-extrabold' : 'text-slate-400'}">
                                                    <span class="w-4 h-4 rounded-full ${stepIdx >= 4 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'} flex items-center justify-center text-[9px] font-black">4</span>
                                                    <span>Livrée</span>
                                                </div>
                                            </div>
                                        </div>
                                    ` : ''}

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
                                                <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold inline-flex items-center gap-1">
                                                    <i class="fa-solid fa-location-dot text-[10px]"></i>
                                                    <span>${escapeHTML(o.delivery_address || 'Pavillon Campus')}</span>
                                                </span>
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
                                        <!-- Liens 1-clic Appel & WhatsApp avec Message Pré-rempli -->
                                        <div class="flex items-center gap-2">
                                            <a 
                                                href="tel:${clientPhone}" 
                                                class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5 min-h-[44px] transition-colors active:scale-95 cursor-pointer shadow-xs"
                                            >
                                                <i class="fa-solid fa-phone text-emerald-600 text-xs"></i>
                                                <span>Appel</span>
                                            </a>
                                            <a 
                                                href="https://wa.me/${clientPhone}?text=${encodeURIComponent(waText)}" 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 min-h-[44px] transition-all active:scale-95 shadow-xs cursor-pointer"
                                            >
                                                <i class="fa-brands fa-whatsapp text-sm"></i>
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
        // Gestion de l'Abonnement Marchand (Modal SasPay)
        const openSubscriptionHandler = () => {
            if (!subscriptionModal) {
                subscriptionModal = createSubscriptionModal({
                    seller: dashboardData?.profile || seller,
                    onSubscribed: ({ profile, plan }) => {
                        if (dashboardData) {
                            dashboardData.profile = profile;
                        }
                        loadData();
                    },
                    onShowToast,
                });
                document.body.appendChild(subscriptionModal.element);
            }
            subscriptionModal.open();
        };

        containerEl.querySelectorAll('.btn-trigger-subscription').forEach((btn) => {
            btn.addEventListener('click', openSubscriptionHandler);
        });
        containerEl.querySelector('#sidebar-btn-subscription')?.addEventListener('click', openSubscriptionHandler);
        containerEl.querySelector('#drawer-btn-subscription')?.addEventListener('click', () => {
            closeDrawer();
            openSubscriptionHandler();
        });

        // Toggle Audio (Header, Sidebar & Drawer)
        const toggleAudioHandler = async () => {
            await audioAlert.toggle();
            render();
            if (audioAlert.isEnabled) {
                playNotificationSound();
                if (typeof onShowToast === 'function') onShowToast('Alertes sonores activées ! 🔊', 'success');
            }
        };
        containerEl.querySelector('#hdr-btn-toggle-audio')?.addEventListener('click', toggleAudioHandler);
        containerEl.querySelector('#top-hdr-btn-toggle-audio')?.addEventListener('click', toggleAudioHandler);
        containerEl.querySelector('#drawer-btn-toggle-audio')?.addEventListener('click', () => {
            closeDrawer();
            toggleAudioHandler();
        });

        // Toggle Boutique (Desktop Sidebar, Mobile Header & Drawer)
        const toggleShopHandler = async () => {
            const isSuspended = checkSellerSuspended();
            if (isSuspended) {
                showToast(`Votre boutique est suspendue par l'administration. Veuillez contacter le support au ${SUPPORT_CONFIG.phoneDisplay}`, 'warning');
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
        containerEl.querySelector('#top-hdr-btn-toggle-shop')?.addEventListener('click', toggleShopHandler);
        containerEl.querySelector('#hdr-btn-toggle-shop-mobile')?.addEventListener('click', toggleShopHandler);

        // Retour à la boutique publique
        const backShopHandler = () => {
            if (typeof onBackToCatalog === 'function') {
                onBackToCatalog();
            }
        };
        containerEl.querySelector('#hdr-btn-seller-back-shop')?.addEventListener('click', backShopHandler);
        containerEl.querySelector('#top-hdr-btn-seller-back-shop')?.addEventListener('click', backShopHandler);
        containerEl.querySelector('#drawer-btn-back-shop')?.addEventListener('click', () => {
            closeDrawer();
            backShopHandler();
        });
        containerEl.querySelector('#bnav-seller-shop')?.addEventListener('click', backShopHandler);

        // Partage de la vitrine marchand (Sidebar, Top Header, Mobile Header, Mobile Drawer)
        const shareShopHandler = () => {
            shareSellerShop(seller, onShowToast);
        };
        containerEl.querySelector('#sidebar-btn-seller-share-shop')?.addEventListener('click', shareShopHandler);
        containerEl.querySelector('#top-hdr-btn-seller-share-shop')?.addEventListener('click', shareShopHandler);
        containerEl.querySelector('#hdr-btn-seller-share-mobile')?.addEventListener('click', shareShopHandler);
        containerEl.querySelector('#drawer-btn-share-shop')?.addEventListener('click', () => {
            closeDrawer();
            shareShopHandler();
        });

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
        containerEl.querySelector('#top-hdr-btn-seller-logout')?.addEventListener('click', logoutHandler);
        containerEl.querySelector('#hdr-btn-seller-logout-mobile')?.addEventListener('click', logoutHandler);
        containerEl.querySelector('#drawer-btn-logout')?.addEventListener('click', () => {
            closeDrawer();
            logoutHandler();
        });

        // Gestion du tiroir tactile mobile (Bottom Sheet)
        const drawerEl = containerEl.querySelector('#seller-mobile-drawer');
        const openDrawer = () => drawerEl?.classList.remove('hidden');
        const closeDrawer = () => drawerEl?.classList.add('hidden');

        containerEl.querySelector('#hdr-btn-seller-menu-mobile')?.addEventListener('click', openDrawer);
        containerEl.querySelector('#btn-close-seller-drawer')?.addEventListener('click', closeDrawer);
        containerEl.querySelector('#seller-drawer-backdrop')?.addEventListener('click', closeDrawer);

        // Actualisation manuelle (Sidebar Desktop & Drawer Mobile)
        const refreshHandler = async (e) => {
            const btn = e?.currentTarget || containerEl.querySelector('#hdr-btn-refresh-orders');
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
        containerEl.querySelector('#top-hdr-btn-refresh-orders')?.addEventListener('click', refreshHandler);
        containerEl.querySelector('#drawer-btn-refresh-orders')?.addEventListener('click', (e) => {
            closeDrawer();
            refreshHandler(e);
        });

        // Retour SuperAdmin (pour les comptes avec rôle superadmin)
        const handleBackAdmin = () => {
            if (typeof onOpenAdminDashboard === 'function') {
                onOpenAdminDashboard();
            }
        };
        containerEl.querySelector('#sidebar-btn-seller-back-admin')?.addEventListener('click', handleBackAdmin);
        containerEl.querySelector('#top-hdr-btn-seller-back-admin')?.addEventListener('click', handleBackAdmin);
        containerEl.querySelector('#drawer-btn-seller-back-admin')?.addEventListener('click', () => {
            closeDrawer();
            handleBackAdmin();
        });

        // Cartes Bento KPI interactives [data-seller-kpi]
        containerEl.querySelectorAll('[data-seller-kpi]').forEach((kpiCard) => {
            kpiCard.addEventListener('click', () => {
                const action = kpiCard.getAttribute('data-seller-kpi');
                if (action === 'orders-delivered') {
                    activeSubTab = 'orders';
                    orderFilter = 'delivered';
                    orderSearchQuery = '';
                    orderPavillonFilter = 'all';
                    render();
                } else if (action === 'orders-pending') {
                    activeSubTab = 'orders';
                    orderFilter = 'pending';
                    orderSearchQuery = '';
                    orderPavillonFilter = 'all';
                    render();
                } else if (action === 'products') {
                    activeSubTab = 'products';
                    render();
                } else if (action === 'toggle-shop') {
                    toggleShopHandler();
                }
            });
        });

        // Sous-onglets de navigation Sidebar Desktop
        containerEl.querySelector('#subtab-dashboard')?.addEventListener('click', () => {
            activeSubTab = 'dashboard';
            render();
        });

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

        // Sous-onglets de navigation Tablette
        containerEl.querySelectorAll('button[data-seller-tab]').forEach((btn) => {
            btn.addEventListener('click', () => {
                activeSubTab = btn.getAttribute('data-seller-tab') || 'dashboard';
                render();
            });
        });

        // Navigation fixe mobile vendeur (Bottom Nav)
        containerEl.querySelector('#bnav-seller-dashboard')?.addEventListener('click', () => {
            activeSubTab = 'dashboard';
            render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        containerEl.querySelector('#bnav-seller-orders')?.addEventListener('click', () => {
            activeSubTab = 'orders';
            render();
        });

        containerEl.querySelector('#bnav-seller-products')?.addEventListener('click', () => {
            activeSubTab = 'products';
            render();
        });

        containerEl.querySelector('#bnav-seller-add')?.addEventListener('click', () => {
            activeSubTab = 'add-product';
            render();
        });

        // Raccourcis et boutons de l'onglet Dashboard
        containerEl.querySelector('#btn-dashboard-go-products')?.addEventListener('click', () => {
            activeSubTab = 'products';
            render();
        });

        containerEl.querySelector('#btn-dashboard-go-add-product')?.addEventListener('click', () => {
            activeSubTab = 'add-product';
            render();
        });

        containerEl.querySelector('#btn-dashboard-go-orders')?.addEventListener('click', () => {
            activeSubTab = 'orders';
            render();
        });

        containerEl.querySelector('#btn-dashboard-view-all-orders')?.addEventListener('click', () => {
            activeSubTab = 'orders';
            render();
        });

        // Recherche textuelle commandes
        const searchInput = containerEl.querySelector('#input-seller-search-orders');
        searchInput?.addEventListener('input', (e) => {
            orderSearchQuery = e.target.value;
            render();
            const reFocus = containerEl.querySelector('#input-seller-search-orders');
            if (reFocus) {
                reFocus.focus();
                reFocus.setSelectionRange(reFocus.value.length, reFocus.value.length);
            }
        });

        // Filtre pavillon commandes
        containerEl.querySelector('#select-seller-pavillon')?.addEventListener('change', (e) => {
            orderPavillonFilter = e.target.value;
            render();
        });

        // Export CSV commandes vendeur
        containerEl.querySelector('#btn-seller-export-orders')?.addEventListener('click', () => {
            const allOrders = dashboardData?.recentOrders || [];
            if (allOrders.length === 0) {
                showToast("Aucune commande à exporter.", 'info');
                return;
            }
            exportOrdersToCSV(allOrders, `ventes-${seller.prenom || 'vendeur'}-${new Date().toISOString().slice(0, 10)}.csv`);
            showToast("Export CSV des commandes téléchargé !", 'success');
        });

        // Onboarding CTA: Publier un article
        containerEl.querySelector('#btn-onboarding-add-product')?.addEventListener('click', () => {
            activeSubTab = 'add-product';
            render();
        });

        // Onboarding CTA: Partager sur WhatsApp
        const shareWaHandler = () => {
            const shopUrl = `${window.location.origin}/#seller/${sellerId}`;
            const shareText = `Bonjour ! Retrouvez tous mes plats et articles sur ma boutique Campus Market UIDT : ${shopUrl}`;
            const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
            window.open(waUrl, '_blank', 'noopener,noreferrer');
            if (navigator.clipboard?.writeText) {
                navigator.clipboard.writeText(shopUrl).catch(() => {});
            }
            showToast("Lien de votre boutique copié et WhatsApp ouvert !", 'success');
        };
        containerEl.querySelector('#btn-onboarding-share-wa')?.addEventListener('click', shareWaHandler);
        containerEl.querySelector('#btn-empty-share-wa')?.addEventListener('click', shareWaHandler);

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
                const isSuspended = checkSellerSuspended();

                if (isSuspended) {
                    showToast(`Action bloquée : votre boutique est suspendue par l'administration UIDT. Contactez le support au ${SUPPORT_CONFIG.phoneDisplay}.`, 'warning');
                    return;
                }

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
    requestNotificationPermission();
    loadData();
    initRealtime();
    startPolling();

    containerEl.cleanup = cleanup;
    return containerEl;
}

export default createSellerDashboard;
