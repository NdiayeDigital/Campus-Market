/**
 * Composant SellerDashboard (Back-Office Marchand)
 * Tableau de bord KPI, gestion des commandes en direct (Supabase Realtime),
 * bascule de disponibilité boutique, alertes sonores Web Audio API et gestion de catalogue.
 */

import { supabase } from '../../services/supabase.js';
import {
    getSellerDashboardData,
    toggleShopStatus,
    updateOrderStatus,
    logoutSeller,
} from '../../services/seller-service.js';
import { createProductManager } from './ProductManager.js';
import { audioAlert, playNotificationSound } from '../../utils/audio-alert.js';
import { escapeHTML, formatSenegalPhone } from '../../utils/security.js';

/**
 * Crée le tableau de bord marchand.
 * @param {Object} props
 * @param {Object} props.seller - Données du vendeur ({ id, prenom, nom, ... })
 * @param {Function} props.onLogout - Callback lors de la déconnexion
 * @param {Function} props.onShowToast - Callback pour afficher un toast
 * @returns {HTMLElement}
 */
export function createSellerDashboard({ seller, onLogout, onShowToast } = {}) {
    const containerEl = document.createElement('div');
    containerEl.className = 'w-full max-w-5xl mx-auto px-4 py-6 flex flex-col gap-6';

    const sellerId = seller.id;
    let dashboardData = null;
    let isLoading = true;
    let activeSubTab = 'orders'; // 'orders' | 'products'
    let realtimeChannel = null;

    async function loadData() {
        try {
            dashboardData = await getSellerDashboardData(sellerId);
        } catch (err) {
            console.error('[SellerDashboard] Erreur chargement:', err);
        } finally {
            isLoading = false;
            render();
        }
    }

    /**
     * Initialise l'écoute temps réel Supabase Realtime pour les commandes entrantes.
     */
    function initRealtime() {
        if (!sellerId) return;

        // Évite les doublons de souscription
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

                    // Alerte sonore instantanée
                    playNotificationSound();

                    // Notification Toast
                    if (payload.eventType === 'INSERT') {
                        const buyer = payload.new.buyer_name || 'Un client';
                        if (typeof onShowToast === 'function') {
                            onShowToast(`🔔 Nouvelle commande de ${buyer} !`, 'info');
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        if (typeof onShowToast === 'function') {
                            onShowToast(`Mise à jour commande #${payload.new.id.slice(0, 6)}`, 'info');
                        }
                    }

                    // Rafraîchissement silencieux des métriques
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
                <div class="flex flex-col gap-4 animate-pulse py-8">
                    <div class="h-12 bg-slate-200 rounded-2xl w-1/3"></div>
                    <div class="grid grid-cols-3 gap-3">
                        <div class="h-24 bg-slate-200 rounded-2xl"></div>
                        <div class="h-24 bg-slate-200 rounded-2xl"></div>
                        <div class="h-24 bg-slate-200 rounded-2xl"></div>
                    </div>
                </div>
            `;
            return;
        }

        const data = dashboardData || {};
        const isOpen = data.isOpen !== false;

        containerEl.innerHTML = `
            <!-- Barre de navigation Vendeur & Identité Boutique -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
                <div class="flex items-center gap-3.5">
                    <div class="w-12 h-12 rounded-2xl bg-primary text-white font-heading font-extrabold text-lg flex items-center justify-center shadow-md shadow-primary/25">
                        ${((seller.prenom?.[0] || 'V') + (seller.nom?.[0] || '')).toUpperCase()}
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="font-heading font-extrabold text-slate-900 text-lg leading-tight">
                                ${escapeHTML(seller.prenom)} ${escapeHTML(seller.nom)}
                            </h2>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Vendeur Certifié
                            </span>
                        </div>
                        <p class="text-xs text-slate-500 mt-0.5">${escapeHTML(seller.telephone || '')} • UIDT Thiès</p>
                    </div>
                </div>

                <!-- Contrôles : Alertes Audio, Statut Boutique & Déconnexion -->
                <div class="flex items-center gap-2.5 flex-wrap">
                    <!-- Toggle Sonore -->
                    <button 
                        id="btn-toggle-audio" 
                        title="Activer ou désactiver les alertes sonores de commande"
                        class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all min-h-[44px] ${
                            audioAlert.isEnabled 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }"
                    >
                        <i class="fa-solid ${audioAlert.isEnabled ? 'fa-volume-high text-emerald-600' : 'fa-volume-xmark'}"></i>
                        <span>${audioAlert.isEnabled ? 'Bips actifs' : 'Activer le son'}</span>
                    </button>

                    <!-- Toggle Ouvert/Fermé -->
                    <button 
                        id="btn-toggle-shop" 
                        class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all min-h-[44px] ${
                            isOpen 
                                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 shadow-sm' 
                                : 'bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200'
                        }"
                    >
                        <span class="w-2 h-2 rounded-full ${isOpen ? 'bg-white animate-ping' : 'bg-slate-400'}"></span>
                        <span>${isOpen ? 'Boutique Ouverte' : 'Boutique Fermée'}</span>
                    </button>

                    <!-- Déconnexion -->
                    <button id="btn-seller-logout" title="Se déconnecter" class="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 transition-colors min-h-[44px] min-w-[44px]">
                        <i class="fa-solid fa-right-from-bracket"></i>
                    </button>
                </div>
            </div>

            <!-- Cartes KPI métriques réelles -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
                    <div class="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl flex-shrink-0">
                        <i class="fa-solid fa-sack-dollar"></i>
                    </div>
                    <div>
                        <span class="text-xs font-semibold text-slate-500 block">Revenus cumulés</span>
                        <span class="font-heading font-extrabold text-xl text-slate-900 leading-tight">
                            ${Number(data.totalRevenue || 0).toLocaleString('fr-FR')} <span class="text-xs font-semibold text-slate-500">FCFA</span>
                        </span>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
                    <div class="w-12 h-12 rounded-xl bg-primary-light text-primary flex items-center justify-center text-xl flex-shrink-0">
                        <i class="fa-solid fa-bell"></i>
                    </div>
                    <div>
                        <span class="text-xs font-semibold text-slate-500 block">Commandes en cours</span>
                        <span class="font-heading font-extrabold text-xl text-slate-900 leading-tight">
                            ${data.pendingCount || 0}
                        </span>
                    </div>
                </div>

                <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex items-center gap-3.5">
                    <div class="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl flex-shrink-0">
                        <i class="fa-solid fa-boxes-stacked"></i>
                    </div>
                    <div>
                        <span class="text-xs font-semibold text-slate-500 block">Articles en ligne</span>
                        <span class="font-heading font-extrabold text-xl text-slate-900 leading-tight">
                            ${data.activeProductsCount || 0} / ${data.totalProductsCount || 0}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Sous-onglets : Commandes / Gestion Produits -->
            <div class="flex border-b border-slate-200">
                <button id="subtab-orders" class="flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
                    activeSubTab === 'orders'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                }">
                    <i class="fa-solid fa-clipboard-list text-xs"></i>
                    <span>Commandes Récentes (${data.recentOrders?.length || 0})</span>
                </button>
                <button id="subtab-products" class="flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all ${
                    activeSubTab === 'products'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                }">
                    <i class="fa-solid fa-tags text-xs"></i>
                    <span>Mon Catalogue</span>
                </button>
            </div>

            <!-- Contenu dynamique de l'onglet -->
            <div id="seller-tab-content">
                ${activeSubTab === 'orders' ? renderOrdersTab(data.recentOrders || []) : ''}
            </div>
        `;

        if (activeSubTab === 'products') {
            const productManagerEl = createProductManager({
                sellerId,
                onProductChanged: loadData,
            });
            containerEl.querySelector('#seller-tab-content')?.appendChild(productManagerEl);
        }

        bindEvents();
    }

    function renderOrdersTab(orders) {
        if (orders.length === 0) {
            return `
                <div class="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
                    <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-2xl mx-auto mb-3">
                        <i class="fa-solid fa-inbox"></i>
                    </div>
                    <h3 class="font-heading font-bold text-slate-800 text-lg mb-1">Aucune commande pour le moment</h3>
                    <p class="text-xs text-slate-500 max-w-sm mx-auto">Vos commandes clients apparaîtront ici en temps réel dès qu'un étudiant valide son panier.</p>
                </div>
            `;
        }

        return `
            <div class="flex flex-col gap-3.5">
                ${orders.map((o) => {
                    const clientPhone = formatSenegalPhone(o.buyer_phone || '');
                    const productTitle = o.product ? o.product.title : 'Article Campus Market';

                    let nextActionBtn = '';
                    let statusLabel = '';
                    let statusBadgeClass = '';

                    switch (o.status) {
                        case 'pending':
                            statusLabel = 'En attente';
                            statusBadgeClass = 'bg-amber-100 text-amber-800';
                            nextActionBtn = `
                                <button data-action="update-status" data-id="${o.id}" data-next="confirmed" class="px-3.5 py-2 bg-primary hover:bg-primary-dark text-white font-bold text-xs rounded-xl shadow-sm transition-all min-h-[40px]">
                                    <i class="fa-solid fa-check mr-1"></i> Accepter
                                </button>
                                <button data-action="update-status" data-id="${o.id}" data-next="cancelled" class="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs rounded-xl transition-all min-h-[40px]">
                                    Refuser
                                </button>
                            `;
                            break;
                        case 'confirmed':
                            statusLabel = 'Confirmée';
                            statusBadgeClass = 'bg-blue-100 text-blue-800';
                            nextActionBtn = `
                                <button data-action="update-status" data-id="${o.id}" data-next="processing" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all min-h-[40px]">
                                    <i class="fa-solid fa-fire-burner mr-1"></i> Préparer
                                </button>
                            `;
                            break;
                        case 'processing':
                            statusLabel = 'En préparation';
                            statusBadgeClass = 'bg-indigo-100 text-indigo-800';
                            nextActionBtn = `
                                <button data-action="update-status" data-id="${o.id}" data-next="shipped" class="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 font-extrabold text-xs rounded-xl shadow-sm transition-all min-h-[40px]">
                                    <i class="fa-solid fa-motorcycle mr-1"></i> Expédier
                                </button>
                            `;
                            break;
                        case 'shipped':
                            statusLabel = 'En livraison';
                            statusBadgeClass = 'bg-purple-100 text-purple-800';
                            nextActionBtn = `
                                <button data-action="update-status" data-id="${o.id}" data-next="delivered" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all min-h-[40px]">
                                    <i class="fa-solid fa-box-open mr-1"></i> Marquer Livré
                                </button>
                            `;
                            break;
                        case 'delivered':
                            statusLabel = 'Livrée';
                            statusBadgeClass = 'bg-emerald-100 text-emerald-800';
                            break;
                        case 'cancelled':
                            statusLabel = 'Annulée';
                            statusBadgeClass = 'bg-slate-100 text-slate-500 line-through';
                            break;
                    }

                    return `
                        <div class="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-3 shadow-sm hover:border-slate-300 transition-all">
                            <!-- En-tête commande -->
                            <div class="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                <div>
                                    <span class="font-heading font-bold text-sm text-slate-900">${escapeHTML(o.reference || `#CMD-${o.id.slice(0, 6).toUpperCase()}`)}</span>
                                    <span class="text-[11px] text-slate-400 ml-2">${new Date(o.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <span class="px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusBadgeClass}">
                                    ${statusLabel}
                                </span>
                            </div>

                            <!-- Détails Client & Article -->
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                <div>
                                    <div class="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                                        <i class="fa-solid fa-user text-slate-400 text-xs"></i>
                                        <span>${escapeHTML(o.buyer_name || 'Client UIDT')}</span>
                                    </div>
                                    <p class="text-slate-500 mt-0.5">
                                        <i class="fa-solid fa-location-dot text-primary text-[10px]"></i> ${escapeHTML(o.delivery_address || 'Pavillon')}
                                    </p>
                                </div>

                                <div class="sm:text-right">
                                    <span class="font-semibold text-slate-700 block">${escapeHTML(productTitle)} (x${o.quantity || 1})</span>
                                    <span class="font-heading font-extrabold text-sm text-primary leading-tight">${Number(o.price).toLocaleString('fr-FR')} FCFA</span>
                                </div>
                            </div>

                            <!-- Actions : Contact & Statut -->
                            <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
                                <!-- Contact Client -->
                                <div class="flex items-center gap-1.5">
                                    <a href="tel:${clientPhone}" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg flex items-center gap-1.5 min-h-[38px]">
                                        <i class="fa-solid fa-phone text-emerald-600"></i>
                                        <span class="hidden sm:inline">Appel</span>
                                    </a>
                                    <a href="https://wa.me/${clientPhone}?text=${encodeURIComponent(`Bonjour ${o.buyer_name || ''} ! Je suis votre vendeur Campus Market pour votre commande ${o.reference || ('#CMD-' + o.id.slice(0, 6).toUpperCase())}.`)}" target="_blank" rel="noopener" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-lg flex items-center gap-1.5 min-h-[38px]">
                                        <i class="fa-brands fa-whatsapp text-sm"></i>
                                        <span class="hidden sm:inline">WhatsApp</span>
                                    </a>
                                </div>

                                <!-- Transition de Statut -->
                                <div class="flex items-center gap-2">
                                    ${nextActionBtn}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function bindEvents() {
        // Toggle Audio
        containerEl.querySelector('#btn-toggle-audio')?.addEventListener('click', async () => {
            await audioAlert.toggle();
            render();
            if (audioAlert.isEnabled) {
                playNotificationSound();
                if (typeof onShowToast === 'function') onShowToast('Alertes sonores activées ! 🔊', 'success');
            }
        });

        // Toggle Boutique
        containerEl.querySelector('#btn-toggle-shop')?.addEventListener('click', async () => {
            const currentIsOpen = dashboardData?.isOpen !== false;
            try {
                await toggleShopStatus(sellerId, !currentIsOpen);
                if (dashboardData) dashboardData.isOpen = !currentIsOpen;
                render();
                if (typeof onShowToast === 'function') {
                    onShowToast(!currentIsOpen ? 'Boutique ouverte aux commandes ! 🟢' : 'Boutique mise en pause ⏸️', 'info');
                }
            } catch (err) {
                alert(err.message);
            }
        });

        // Déconnexion
        containerEl.querySelector('#btn-seller-logout')?.addEventListener('click', async () => {
            if (confirm('Voulez-vous vous déconnecter de votre espace vendeur ?')) {
                cleanup();
                await logoutSeller();
                if (typeof onLogout === 'function') onLogout();
            }
        });

        // Sous-onglets
        containerEl.querySelector('#subtab-orders')?.addEventListener('click', () => {
            activeSubTab = 'orders';
            render();
        });

        containerEl.querySelector('#subtab-products')?.addEventListener('click', () => {
            activeSubTab = 'products';
            render();
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
                    if (typeof onShowToast === 'function') {
                        onShowToast('Statut de la commande mis à jour.', 'success');
                    }
                } catch (err) {
                    alert(err.message);
                }
            });
        });
    }

    function cleanup() {
        if (realtimeChannel) {
            supabase.removeChannel(realtimeChannel);
            realtimeChannel = null;
        }
    }

    // Démarrage
    loadData();
    initRealtime();

    containerEl.cleanup = cleanup;
    return containerEl;
}

export default createSellerDashboard;
