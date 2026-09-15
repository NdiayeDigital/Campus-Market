/**
 * Composant OrderStatus
 * Affichage du statut d'avancement des commandes (Pavillon-à-Pavillon)
 * avec lien direct d'appel/WhatsApp vendeur et gestion des états vides.
 */

import { supabase } from '../services/supabase.js';
import { escapeHTML, formatSenegalPhone } from '../utils/security.js';

const RECENT_ORDERS_KEY = 'campus_market_recent_orders';

const STATUS_STEPS = [
    { key: 'pending', label: 'En attente', icon: 'fa-clock' },
    { key: 'confirmed', label: 'Confirmée', icon: 'fa-check' },
    { key: 'processing', label: 'En préparation', icon: 'fa-fire-burner' },
    { key: 'shipped', label: 'En livraison', icon: 'fa-motorcycle' },
    { key: 'delivered', label: 'Livrée', icon: 'fa-box-open' },
];

/**
 * Enregistre une référence de commande récente dans le LocalStorage pour les acheteurs sans compte.
 * @param {Object} orderInfo
 */
export function trackRecentOrder(orderInfo) {
    try {
        const raw = localStorage.getItem(RECENT_ORDERS_KEY);
        const list = raw ? JSON.parse(raw) : [];
        list.unshift({
            ...orderInfo,
            date: new Date().toISOString(),
        });
        localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(list.slice(0, 10)));
    } catch (e) {
        console.warn('[OrderStatus] Erreur sauvegarde commande récente:', e);
    }
}

/**
 * Crée le composant de suivi de commande.
 * @param {Object} props
 * @param {Function} props.onBackToCatalog - Callback pour retourner au catalogue
 * @returns {HTMLElement}
 */
export function createOrderStatusView({ onBackToCatalog } = {}) {
    const container = document.createElement('div');
    container.className = 'w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6';

    let recentOrders = [];
    try {
        const raw = localStorage.getItem(RECENT_ORDERS_KEY);
        recentOrders = raw ? JSON.parse(raw) : [];
    } catch {
        recentOrders = [];
    }

    // Si aucune commande enregistrée : Empty State "Aucune commande active"
    if (recentOrders.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center text-center p-8 bg-surface rounded-2xl border border-slate-200 shadow-sm my-8">
                <div class="w-20 h-20 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center text-3xl mb-4">
                    <i class="fa-solid fa-box-open"></i>
                </div>
                <h3 class="font-heading font-bold text-slate-900 text-xl mb-1">Aucune commande active</h3>
                <p class="text-sm text-slate-500 max-w-sm mb-6">
                    Vous n'avez pas encore passé de commande aujourd'hui. Vos commandes en cours s'afficheront ici en temps réel.
                </p>
                <button id="btn-empty-back-catalog" class="px-6 py-3 bg-primary hover:bg-primary-dark text-white font-heading font-bold text-sm rounded-xl shadow-md transition-all min-h-[44px]">
                    Explorer le catalogue
                </button>
            </div>
        `;

        container.querySelector('#btn-empty-back-catalog')?.addEventListener('click', () => {
            if (typeof onBackToCatalog === 'function') onBackToCatalog();
        });

        return container;
    }

    // Affichage des commandes récentes
    container.innerHTML = `
        <div class="flex items-center justify-between">
            <div>
                <h1 class="font-heading font-extrabold text-2xl text-slate-900">Suivi de vos commandes</h1>
                <p class="text-xs text-slate-500 mt-0.5">Livraison directe dans votre chambre</p>
            </div>
            <button id="btn-back-to-shop" class="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors min-h-[44px]">
                <i class="fa-solid fa-arrow-left text-xs"></i>
                <span>Boutique</span>
            </button>
        </div>

        <div id="orders-list-wrapper" class="flex flex-col gap-4">
            ${recentOrders.map((order, idx) => {
                const currentStatus = order.status || 'pending';
                const stepIndex = STATUS_STEPS.findIndex((s) => s.key === currentStatus);
                const activeIndex = stepIndex === -1 ? 0 : stepIndex;

                const firstItem = order.items && order.items[0] ? order.items[0] : null;
                const totalItemsCount = order.items ? order.items.reduce((sum, i) => sum + (i.quantity || 1), 0) : 1;
                const formattedDate = order.date ? new Date(order.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Aujourd\'hui';

                // Préparation du contact vendeur
                const sellerPhone = order.seller_phone || '770000000';
                const cleanPhone = formatSenegalPhone(sellerPhone);
                const sellerName = order.seller_name || 'Vendeur UIDT';

                return `
                    <div class="bg-surface rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4 transition-all">
                        <!-- En-tête de la commande -->
                        <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <span class="font-heading font-extrabold text-primary text-base">${escapeHTML(order.reference || `#CMD-${idx + 1}`)}</span>
                                <span class="text-[11px] text-slate-400 block">${formattedDate} • ${order.pavillon || 'Pavillon UIDT'}</span>
                            </div>
                            <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                currentStatus === 'delivered'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-800'
                            }">
                                ${STATUS_STEPS[activeIndex].label}
                            </span>
                        </div>

                        <!-- Stepper visuel de progression -->
                        <div class="py-2">
                            <div class="relative flex items-center justify-between w-full">
                                <!-- Barre de fond -->
                                <div class="absolute top-1/2 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0"></div>
                                <!-- Barre active -->
                                <div class="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 z-0 transition-all duration-500" style="width: ${(activeIndex / (STATUS_STEPS.length - 1)) * 100}%;"></div>

                                ${STATUS_STEPS.map((step, sIdx) => {
                                    const isPassed = sIdx <= activeIndex;
                                    const isCurrent = sIdx === activeIndex;

                                    return `
                                        <div class="relative z-10 flex flex-col items-center">
                                            <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${
                                                isPassed
                                                    ? 'bg-primary text-white shadow-md shadow-primary/30'
                                                    : 'bg-white border-2 border-slate-200 text-slate-400'
                                            } ${isCurrent ? 'ring-4 ring-primary/20 scale-110' : ''}">
                                                <i class="fa-solid ${step.icon}"></i>
                                            </div>
                                            <span class="text-[10px] font-semibold mt-1 hidden sm:block ${isPassed ? 'text-primary' : 'text-slate-400'}">
                                                ${step.label}
                                            </span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <!-- Détail article commandé -->
                        <div class="bg-slate-50 rounded-xl p-3 flex items-center justify-between text-xs text-slate-700">
                            <span class="font-medium">
                                ${firstItem ? escapeHTML(firstItem.title) : 'Commande Campus Market'}
                                ${totalItemsCount > 1 ? `<span class="text-slate-400">(+${totalItemsCount - 1} autre${totalItemsCount > 2 ? 's' : ''})</span>` : ''}
                            </span>
                            <span class="font-bold text-slate-900">
                                Chambre : ${escapeHTML(order.chambre || 'N/A')}
                            </span>
                        </div>

                        <!-- Actions vendeur directes -->
                        <div class="flex items-center gap-2 pt-1">
                            <a 
                                href="tel:${cleanPhone}" 
                                class="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors min-h-[44px]"
                            >
                                <i class="fa-solid fa-phone text-emerald-600 text-sm"></i>
                                <span>Appeler le vendeur</span>
                            </a>
                            <a 
                                href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Bonjour ! Je vous contacte au sujet de ma commande ${order.reference || ''} sur Campus Market.`)}" 
                                target="_blank"
                                rel="noopener"
                                class="flex-1 py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors min-h-[44px]"
                            >
                                <i class="fa-brands fa-whatsapp text-base"></i>
                                <span>WhatsApp</span>
                            </a>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    container.querySelector('#btn-back-to-shop')?.addEventListener('click', () => {
        if (typeof onBackToCatalog === 'function') onBackToCatalog();
    });

    return container;
}

export default createOrderStatusView;
