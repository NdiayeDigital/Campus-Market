/**
 * Composant OrderStatus
 * Affichage et suivi en temps réel des commandes (Pavillon-à-Pavillon),
 * synchronisation dynamique avec Supabase, contact direct vendeur (WhatsApp / Appel),
 * possibilité d'annulation et dépôt d'avis / notation marchand.
 */

import { fetchLiveOrderStatus, cancelOrderByBuyer, submitOrderReview } from '../services/order-service.js';
import { escapeHTML, formatSenegalPhone } from '../utils/security.js';
import { showToast, showConfirm } from '../utils/notifications.js';

const RECENT_ORDERS_KEY = 'campus_market_recent_orders';

const STATUS_STEPS = [
    { key: 'pending', label: 'En attente', icon: 'fa-clock' },
    { key: 'confirmed', label: 'Confirmée', icon: 'fa-check' },
    { key: 'processing', label: 'En préparation', icon: 'fa-fire-burner' },
    { key: 'shipped', label: 'En livraison', icon: 'fa-motorcycle' },
    { key: 'delivered', label: 'Livrée', icon: 'fa-box-open' },
];

/**
 * Enregistre ou met à jour une commande récente dans le LocalStorage.
 * @param {Object} orderInfo
 */
export function trackRecentOrder(orderInfo) {
    try {
        const raw = localStorage.getItem(RECENT_ORDERS_KEY);
        const list = raw ? JSON.parse(raw) : [];

        // Évite les doublons sur la même référence
        const existingIdx = list.findIndex(
            (o) => (o.reference && o.reference === orderInfo.reference) || (o.orderId && o.orderId === orderInfo.orderId)
        );

        if (existingIdx > -1) {
            list[existingIdx] = { ...list[existingIdx], ...orderInfo };
        } else {
            list.unshift({
                ...orderInfo,
                date: orderInfo.date || new Date().toISOString(),
                status: orderInfo.status || 'pending',
            });
        }

        localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(list.slice(0, 15)));
    } catch (e) {
        console.warn('[OrderStatus] Erreur sauvegarde commande récente:', e);
    }
}

/**
 * Crée le composant de suivi de commande.
 * @param {Object} props
 * @param {Function} props.onBackToCatalog - Callback pour retourner au catalogue
 * @param {Function} [props.onShowToast] - Notification toast
 * @returns {HTMLElement}
 */
export function createOrderStatusView({ onBackToCatalog, onShowToast } = {}) {
    const container = document.createElement('div');
    container.className = 'w-full max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6';

    let recentOrders = [];
    let isRefreshing = false;
    let reviewModalOrder = null;

    function loadLocalOrders() {
        try {
            const raw = localStorage.getItem(RECENT_ORDERS_KEY);
            recentOrders = raw ? JSON.parse(raw) : [];
        } catch {
            recentOrders = [];
        }
    }

    /**
     * Synchronise les commandes actives avec Supabase pour obtenir le dernier statut.
     */
    async function syncOrdersWithBackend() {
        if (!navigator.onLine || recentOrders.length === 0) return;
        isRefreshing = true;

        let hasUpdates = false;
        try {
            for (let i = 0; i < recentOrders.length; i++) {
                const ord = recentOrders[i];
                // Ne synchronise que les commandes non finales
                if (ord.status !== 'delivered' && ord.status !== 'cancelled') {
                    const live = await fetchLiveOrderStatus({
                        orderId: ord.orderId || ord.id,
                        reference: ord.reference,
                        phone: ord.telephone || ord.buyer_phone,
                    });

                    if (live && live.status && live.status !== ord.status) {
                        recentOrders[i].status = live.status;
                        if (live.seller_name) recentOrders[i].seller_name = live.seller_name;
                        if (live.seller_phone) recentOrders[i].seller_phone = live.seller_phone;
                        hasUpdates = true;
                    }
                }
            }

            if (hasUpdates) {
                localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(recentOrders));
            }
        } catch (err) {
            console.warn('[OrderStatus] Erreur synchronisation commandes:', err);
        } finally {
            isRefreshing = false;
            render();
        }
    }

    function render() {
        loadLocalOrders();

        if (recentOrders.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-8 bg-white rounded-3xl border border-dashed border-slate-300 shadow-sm my-8">
                    <div class="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center text-3xl mb-4">
                        <i class="fa-solid fa-box-open"></i>
                    </div>
                    <h3 class="font-heading font-extrabold text-slate-900 text-xl mb-1">Aucune commande active</h3>
                    <p class="text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
                        Vous n'avez pas encore passé de commande aujourd'hui. Vos commandes pavillon-à-pavillon s'afficheront ici en temps réel.
                    </p>
                    <button id="btn-empty-back-catalog" class="px-6 py-3.5 bg-primary hover:bg-primary-dark text-white font-heading font-bold text-sm rounded-2xl shadow-md shadow-primary/20 transition-all min-h-[44px]">
                        Explorer les offres du campus
                    </button>
                </div>
            `;

            container.querySelector('#btn-empty-back-catalog')?.addEventListener('click', () => {
                if (typeof onBackToCatalog === 'function') onBackToCatalog();
            });

            return;
        }

        container.innerHTML = `
            <!-- En-tête -->
            <div class="flex items-center justify-between gap-3">
                <div>
                    <h1 class="font-heading font-extrabold text-2xl text-slate-900">Suivi de vos commandes</h1>
                    <p class="text-xs text-slate-500 mt-0.5">Livraison directe pavillon-à-pavillon UIDT</p>
                </div>
                <div class="flex items-center gap-2">
                    <button id="btn-refresh-orders" title="Rafraîchir l'état" class="w-10 h-10 rounded-full flex items-center justify-center text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors min-h-[44px] min-w-[44px]">
                        <i class="fa-solid fa-arrows-rotate ${isRefreshing ? 'fa-spin text-primary' : ''}"></i>
                    </button>
                    <button id="btn-back-to-shop" class="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold bg-primary-light hover:bg-primary text-primary hover:text-white transition-all min-h-[44px]">
                        <i class="fa-solid fa-store text-xs"></i>
                        <span>Boutique</span>
                    </button>
                </div>
            </div>

            <!-- Liste des commandes -->
            <div id="orders-list-wrapper" class="flex flex-col gap-4">
                ${recentOrders.map((order, idx) => {
                    const currentStatus = order.status || 'pending';
                    const stepIndex = STATUS_STEPS.findIndex((s) => s.key === currentStatus);
                    const activeIndex = stepIndex === -1 ? 0 : stepIndex;

                    const firstItem = order.items && order.items[0] ? order.items[0] : null;
                    const totalItemsCount = order.items ? order.items.reduce((sum, i) => sum + (i.quantity || 1), 0) : 1;
                    const formattedDate = order.date ? new Date(order.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'Aujourd\'hui';

                    const sellerPhone = order.seller_phone || (firstItem?.seller_phone) || (firstItem?.seller?.telephone) || '';
                    const cleanPhone = formatSenegalPhone(sellerPhone);
                    const sellerName = order.seller_name || (firstItem?.seller_name) || 'Marchand UIDT';

                    const isCancelled = currentStatus === 'cancelled';
                    const isDelivered = currentStatus === 'delivered';
                    const isPending = currentStatus === 'pending';

                    return `
                        <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-4 transition-all">
                            <!-- En-tête de la commande -->
                            <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                                <div>
                                    <span class="font-heading font-extrabold text-primary text-base">
                                        ${escapeHTML(order.reference || `#CMD-${idx + 1}`)}
                                    </span>
                                    <span class="text-[11px] text-slate-400 block">${formattedDate} • ${escapeHTML(order.pavillon || 'Campus UIDT')}</span>
                                </div>
                                <span class="px-3 py-1 rounded-full text-[11px] font-bold ${
                                    isCancelled
                                        ? 'bg-red-100 text-red-700'
                                        : isDelivered
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-amber-100 text-amber-900'
                                }">
                                    ${isCancelled ? 'Annulée' : STATUS_STEPS[activeIndex]?.label || 'En cours'}
                                </span>
                            </div>

                            <!-- Stepper visuel (masqué si annulée) -->
                            ${!isCancelled ? `
                                <div class="py-2 px-1 flex flex-col gap-3">
                                    <!-- Carte étape active avec radar visuel -->
                                    <div class="flex items-center gap-2.5 p-3 rounded-2xl bg-blue-50/70 border border-blue-100/80">
                                        <div class="relative flex items-center justify-center w-6 h-6">
                                            <span class="absolute w-full h-full rounded-full bg-primary/30 animate-ping"></span>
                                            <span class="relative w-2.5 h-2.5 rounded-full bg-primary"></span>
                                        </div>
                                        <div class="flex flex-col min-w-0">
                                            <span class="text-xs font-heading font-extrabold text-primary leading-tight">
                                                Statut actuel : ${STATUS_STEPS[activeIndex]?.label || 'En cours'}
                                            </span>
                                            <span class="text-[11px] text-slate-500 mt-0.5 leading-snug">
                                                ${
                                                    currentStatus === 'pending'
                                                        ? 'Votre commande a été transmise au marchand étudiant. En attente de confirmation.'
                                                        : currentStatus === 'confirmed'
                                                        ? 'Le vendeur a confirmé votre commande et prépare les articles.'
                                                        : currentStatus === 'processing'
                                                        ? 'Commande en cours de préparation / emballage.'
                                                        : currentStatus === 'shipped'
                                                        ? 'Le livreur est en route vers votre pavillon ! Tenez-vous prêt(e).'
                                                        : 'Commande livrée avec succès à votre pavillon.'
                                                }
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Barre d'étapes -->
                                    <div class="relative flex items-center justify-between w-full pt-1">
                                        <div class="absolute top-4 left-0 right-0 h-1 bg-slate-100 -translate-y-1/2 z-0"></div>
                                        <div class="absolute top-4 left-0 h-1 bg-gradient-to-r from-primary to-blue-500 -translate-y-1/2 z-0 transition-all duration-500" style="width: ${(activeIndex / (STATUS_STEPS.length - 1)) * 100}%;"></div>

                                        ${STATUS_STEPS.map((step, sIdx) => {
                                            const isPassed = sIdx <= activeIndex;
                                            const isCurrent = sIdx === activeIndex;

                                            return `
                                                <div class="relative z-10 flex flex-col items-center">
                                                    <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all duration-300 ${
                                                        isPassed
                                                            ? 'bg-primary text-white shadow-md shadow-primary/30'
                                                            : 'bg-white border-2 border-slate-200 text-slate-400'
                                                    } ${isCurrent ? 'ring-4 ring-primary/30 scale-110' : ''}">
                                                        <i class="fa-solid ${step.icon}"></i>
                                                    </div>
                                                    <span class="text-[9px] sm:text-[10px] font-semibold mt-1.5 ${isCurrent ? 'text-primary font-bold' : isPassed ? 'text-slate-700' : 'text-slate-400'} text-center max-w-[50px] sm:max-w-none leading-tight">
                                                        ${step.label}
                                                    </span>
                                                </div>
                                            `;
                                        }).join('')}
                                    </div>
                                </div>
                            ` : `
                                <div class="p-3 bg-red-50 rounded-2xl border border-red-100 text-xs text-red-700 flex items-center gap-2">
                                    <i class="fa-solid fa-circle-xmark"></i>
                                    <span>Cette commande a été annulée.</span>
                                </div>
                            `}

                            <!-- Détail article commandé -->
                            <div class="bg-slate-50/80 rounded-2xl p-3.5 flex items-center justify-between text-xs text-slate-700 border border-slate-100">
                                <div>
                                    <span class="font-bold text-slate-900 block sm:inline">
                                        ${firstItem ? escapeHTML(firstItem.title) : 'Commande Campus Market'}
                                    </span>
                                    ${totalItemsCount > 1 ? `<span class="text-slate-400 ml-1">(+${totalItemsCount - 1} autre${totalItemsCount > 2 ? 's' : ''})</span>` : ''}
                                </div>
                                <span class="font-semibold text-slate-700 bg-white px-2.5 py-1 rounded-xl border border-slate-200/60 shadow-sm">
                                    Chambre : ${escapeHTML(order.chambre || 'N/A')}
                                </span>
                            </div>

                            <!-- Actions vendeur directes -->
                            <div class="flex items-center gap-2 pt-1 flex-wrap">
                                ${cleanPhone ? `
                                    <a 
                                        href="tel:${cleanPhone}" 
                                        class="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all min-h-[44px]"
                                    >
                                        <i class="fa-solid fa-phone text-emerald-600 text-sm"></i>
                                        <span>Appeler</span>
                                    </a>
                                    <a 
                                        href="https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Bonjour ! Je vous contacte au sujet de ma commande ${order.reference || ''} sur Campus Market.`)}" 
                                        target="_blank" 
                                        rel="noopener" 
                                        class="flex-1 py-2.5 px-3 bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm min-h-[44px]"
                                    >
                                        <i class="fa-brands fa-whatsapp text-base"></i>
                                        <span>WhatsApp</span>
                                    </a>
                                ` : `
                                    <span class="text-xs text-slate-400 italic">Vendeur : ${escapeHTML(sellerName)}</span>
                                `}

                                ${isDelivered && !order.hasReviewed ? `
                                    <button 
                                        data-action="open-review" 
                                        data-idx="${idx}"
                                        class="py-2.5 px-4 bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
                                    >
                                        <i class="fa-solid fa-star text-amber-500"></i>
                                        <span>Noter le marchand</span>
                                    </button>
                                ` : ''}

                                ${isPending ? `
                                    <button 
                                        data-action="cancel-order" 
                                        data-idx="${idx}"
                                        class="py-2.5 px-3 bg-slate-100 hover:bg-red-50 text-slate-500 hover:text-red-600 font-semibold text-xs rounded-xl transition-colors min-h-[44px]"
                                    >
                                        Annuler
                                    </button>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Modal de dépôt d'avis marchand -->
            <div id="review-modal" class="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 hidden opacity-0 transition-opacity duration-300">
                <div class="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 flex flex-col gap-4">
                    <div class="flex items-center justify-between border-b border-slate-100 pb-3">
                        <h3 class="font-heading font-extrabold text-slate-900 text-base">Noter votre expérience</h3>
                        <button id="btn-close-review" class="w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 text-slate-400">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <p class="text-xs text-slate-500">
                        Votre commande est bien livrée ! Attribuez une note à votre marchand étudiant pour valoriser son sérieux sur le campus.
                    </p>

                    <!-- Étoiles tactiles -->
                    <div class="flex items-center justify-center gap-2 py-2 text-2xl text-slate-300 cursor-pointer" id="star-rating-selector">
                        <i class="fa-solid fa-star transition-colors text-amber-400" data-star="1"></i>
                        <i class="fa-solid fa-star transition-colors text-amber-400" data-star="2"></i>
                        <i class="fa-solid fa-star transition-colors text-amber-400" data-star="3"></i>
                        <i class="fa-solid fa-star transition-colors text-amber-400" data-star="4"></i>
                        <i class="fa-solid fa-star transition-colors text-amber-400" data-star="5"></i>
                    </div>

                    <textarea 
                        id="review-comment-input" 
                        rows="3" 
                        placeholder="Commentaire facultatif (ex: Plat très chaud, livraison rapide au pavillon A !)" 
                        class="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none"
                    ></textarea>

                    <button 
                        id="btn-submit-review"
                        class="w-full py-3.5 bg-primary hover:bg-primary-dark text-white font-heading font-bold text-xs rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 min-h-[44px]"
                    >
                        <span>Publier mon avis</span>
                        <i class="fa-solid fa-check text-xs"></i>
                    </button>
                </div>
            </div>
        `;

        bindEvents();
    }

    function bindEvents() {
        container.querySelector('#btn-back-to-shop')?.addEventListener('click', () => {
            if (typeof onBackToCatalog === 'function') onBackToCatalog();
        });

        container.querySelector('#btn-refresh-orders')?.addEventListener('click', () => {
            syncOrdersWithBackend();
        });

        // Annulation de commande
        container.querySelectorAll('button[data-action="cancel-order"]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                const target = recentOrders[idx];
                if (!target) return;

                const confirmed = await showConfirm({
                    title: 'Annuler la commande',
                    message: `Voulez-vous vraiment annuler votre commande ${target.reference || ''} ?`,
                    confirmText: 'Oui, annuler',
                    cancelText: 'Non, garder',
                    isDestructive: true,
                    icon: 'fa-ban',
                });

                if (confirmed) {
                    btn.disabled = true;
                    try {
                        if (target.orderId || target.id) {
                            await cancelOrderByBuyer(target.orderId || target.id);
                        }
                        recentOrders[idx].status = 'cancelled';
                        localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(recentOrders));
                        showToast('Commande annulée avec succès.', 'info');
                        render();
                    } catch (err) {
                        showToast(`Impossible d'annuler : ${err.message}`, 'error');
                        btn.disabled = false;
                    }
                }
            });
        });

        // Modal d'avis
        const reviewModal = container.querySelector('#review-modal');
        const closeReviewBtn = container.querySelector('#btn-close-review');
        let currentRating = 5;

        container.querySelectorAll('button[data-action="open-review"]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                reviewModalOrder = recentOrders[idx];
                if (reviewModal) {
                    reviewModal.classList.remove('hidden');
                    requestAnimationFrame(() => reviewModal.classList.remove('opacity-0'));
                }
            });
        });

        closeReviewBtn?.addEventListener('click', () => {
            if (reviewModal) {
                reviewModal.classList.add('opacity-0');
                setTimeout(() => reviewModal.classList.add('hidden'), 300);
            }
        });

        // Sélection d'étoiles
        const stars = container.querySelectorAll('#star-rating-selector i');
        stars.forEach((star) => {
            star.addEventListener('click', () => {
                const val = parseInt(star.getAttribute('data-star'), 10);
                currentRating = val;
                stars.forEach((s, sIdx) => {
                    if (sIdx < val) {
                        s.classList.add('text-amber-400');
                        s.classList.remove('text-slate-300');
                    } else {
                        s.classList.remove('text-amber-400');
                        s.classList.add('text-slate-300');
                    }
                });
            });
        });

        // Soumission de l'avis
        container.querySelector('#btn-submit-review')?.addEventListener('click', async () => {
            if (!reviewModalOrder) return;
            const comment = container.querySelector('#review-comment-input')?.value || '';
            const submitBtn = container.querySelector('#btn-submit-review');

            const sellerId = reviewModalOrder.items?.[0]?.seller_id || reviewModalOrder.seller_id;
            if (!sellerId) {
                showToast('Marchand non identifiable pour cet avis.', 'warning');
                return;
            }

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Envoi...`;

            try {
                await submitOrderReview({
                    sellerId,
                    orderId: reviewModalOrder.orderId || reviewModalOrder.id || null,
                    rating: currentRating,
                    comment,
                });

                reviewModalOrder.hasReviewed = true;
                localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(recentOrders));

                if (reviewModal) {
                    reviewModal.classList.add('opacity-0');
                    setTimeout(() => reviewModal.classList.add('hidden'), 300);
                }

                showToast('🎉 Merci pour votre avis sur le marchand !', 'success');
                render();
            } catch (err) {
                showToast(`Erreur envoi avis : ${err.message}`, 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<span>Publier mon avis</span><i class="fa-solid fa-check text-xs"></i>`;
            }
        });
    }

    render();
    // Lancement de la synchronisation asynchrone dès l'affichage
    syncOrdersWithBackend();

    return container;
}

export default createOrderStatusView;
