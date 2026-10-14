/**
 * Composant SubscriptionModal (Gestion des formules & Passerelle SasPay).
 * Permet au vendeur de choisir parmi les formules (Starter 1 500F ou Pro 2 500F)
 * et d'accéder au paiement direct via le lien SasPay (Wave ou Orange Money).
 */

import { SUBSCRIPTION_PLANS } from '../../config/subscription.js';
import { initiateSubscriptionPayment, confirmSubscriptionPayment } from '../../services/seller-service.js';
import logoUrl from '../../assets/logo.webp';

/**
 * Crée le modal d'abonnement et de renouvellement marchand.
 * @param {Object} props
 * @param {Object} props.seller - Profil du vendeur
 * @param {Function} [props.onSubscribed] - Callback appelée après paiement réussi ({ profile, plan })
 * @param {Function} [props.onShowToast] - Notification toast
 * @returns {Object} Contrôleur ({ element, open, close })
 */
export function createSubscriptionModal({ seller, onSubscribed, onShowToast } = {}) {
    const modalEl = document.createElement('div');
    modalEl.id = 'seller-subscription-modal-overlay';
    modalEl.className = 'fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-300';

    let selectedPlanId = seller?.subscription_plan && SUBSCRIPTION_PLANS[seller.subscription_plan] ? seller.subscription_plan : 'starter';
    let isProcessing = false;
    let awaitingConfirmation = false;
    let currentSession = null;

    function render() {
        const currentPlan = SUBSCRIPTION_PLANS[selectedPlanId] || SUBSCRIPTION_PLANS.starter;

        modalEl.innerHTML = `
            <div class="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in duration-200">
                <!-- En-tête -->
                <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                    <div class="flex items-center gap-3">
                        <img src="${logoUrl}" alt="Campus Market" class="h-9 w-auto max-w-[130px] object-contain">
                        <div>
                            <h2 class="font-heading font-extrabold text-slate-900 text-base leading-tight">Abonnement Marchand</h2>
                            <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">UIDT Thiès • SasPay</span>
                        </div>
                    </div>
                    <button id="btn-close-subscription-modal" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer min-h-[44px] min-w-[44px]">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <!-- Contenu défilable -->
                <div class="p-6 overflow-y-auto flex flex-col gap-5 text-slate-900">
                    ${awaitingConfirmation ? renderConfirmationScreen(currentPlan) : renderSelectionScreen(currentPlan)}
                </div>
            </div>
        `;

        bindEvents();
    }

    function renderSelectionScreen(currentPlan) {
        return `
            <!-- Introduction / Avantages -->
            <div class="bg-blue-50/70 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
                <div class="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center text-sm shrink-0 mt-0.5 shadow-sm">
                    <i class="fa-solid fa-crown"></i>
                </div>
                <div>
                    <h3 class="font-heading font-bold text-xs text-blue-950 uppercase tracking-wide">Pérennisez votre boutique étudiante</h3>
                    <p class="text-xs text-blue-800/90 leading-relaxed mt-0.5">
                        Activez votre abonnement mensuel pour garder vos articles visibles du campus et recevoir les commandes en continu.
                    </p>
                </div>
            </div>

            <!-- Sélection de la Formule (Starter ou Pro) -->
            <div class="flex flex-col gap-2.5">
                <div class="flex items-center justify-between">
                    <h4 class="font-heading font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <i class="fa-solid fa-layer-group text-primary text-xs"></i>
                        <span>1. Choisissez votre formule</span>
                    </h4>
                    <span class="text-[10px] text-slate-400 font-bold">Renouvellement 30 jours</span>
                </div>

                <div class="grid grid-cols-1 gap-3">
                    ${Object.values(SUBSCRIPTION_PLANS).map((p) => {
                        const isSelected = p.id === selectedPlanId;
                        return `
                            <div 
                                data-plan-id="${p.id}"
                                class="plan-card p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 relative overflow-hidden ${
                                    isSelected 
                                        ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/30' 
                                        : 'border-slate-200 bg-white hover:border-slate-300'
                                }"
                            >
                                <div class="flex items-center gap-3.5 min-w-0">
                                    <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                        isSelected ? 'border-primary' : 'border-slate-300'
                                    }">
                                        ${isSelected ? '<span class="w-2.5 h-2.5 rounded-full bg-primary"></span>' : ''}
                                    </div>
                                    <div class="truncate">
                                        <div class="flex items-center gap-2">
                                            <span class="font-heading font-extrabold text-sm text-slate-900">${p.name}</span>
                                            <span class="text-[10px] font-black px-2 py-0.5 rounded-full ${p.badgeColor}">
                                                ${p.maxProducts} articles
                                            </span>
                                            <span class="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                                                ${p.badge}
                                            </span>
                                        </div>
                                        <p class="text-[11px] text-slate-500 truncate mt-0.5">${p.description}</p>
                                    </div>
                                </div>
                                <div class="text-right shrink-0">
                                    <span class="font-heading font-black text-base text-slate-900 tabular-nums">${p.price.toLocaleString('fr-FR')}</span>
                                    <span class="text-[10px] font-bold text-slate-400 block leading-none">FCFA / mois</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Note Passerelle SasPay (Wave / OM) -->
            <div class="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl flex items-center gap-2.5 text-emerald-900 text-xs">
                <i class="fa-solid fa-shield-halved text-emerald-600 text-sm shrink-0"></i>
                <div class="flex-1 text-[11px] leading-snug">
                    Paiement sécurisé par <strong>SasPay</strong>. Vous choisirez <strong>Wave</strong> ou <strong>Orange Money</strong> directement sur la page de paiement.
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                    <span class="w-6 h-6 rounded-full bg-sky-500 text-white text-[10px] flex items-center justify-center font-bold" title="Wave">W</span>
                    <span class="w-6 h-6 rounded-full bg-orange-500 text-white text-[10px] flex items-center justify-center font-bold" title="Orange Money">OM</span>
                </div>
            </div>

            <!-- Bouton Unique de Paiement -->
            <button 
                type="button" 
                id="btn-proceed-subscription"
                ${isProcessing ? 'disabled' : ''}
                class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-heading font-extrabold text-sm rounded-2xl shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-2.5 min-h-[52px] cursor-pointer disabled:opacity-50"
            >
                ${isProcessing ? `
                    <i class="fa-solid fa-spinner fa-spin text-sm"></i>
                    <span>Ouverture de SasPay...</span>
                ` : `
                    <i class="fa-solid fa-credit-card text-sm"></i>
                    <span>Payer ${currentPlan.price.toLocaleString('fr-FR')} FCFA via SasPay</span>
                    <i class="fa-solid fa-arrow-up-right-from-square text-xs opacity-75"></i>
                `}
            </button>
        `;
    }

    function renderConfirmationScreen(currentPlan) {
        const link = currentPlan.paymentLink || 'https://link.saspay.me/hgc4jifsarq';

        return `
            <div class="flex flex-col items-center text-center py-2 gap-4">
                <div class="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl shadow-sm animate-pulse">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </div>

                <div>
                    <span class="text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        Page SasPay Ouverte
                    </span>
                    <h3 class="font-heading font-black text-xl text-slate-900 mt-2">Finaliser votre abonnement</h3>
                    <p class="text-xs text-slate-500 mt-1 max-w-sm">
                        La page de règlement sécurisée s'est ouverte dans votre navigateur. Choisissez Wave ou Orange Money pour valider les <strong>${currentPlan.price.toLocaleString('fr-FR')} FCFA</strong>.
                    </p>
                </div>

                <!-- Récapitulatif ticket -->
                <div class="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col gap-2 text-left text-xs">
                    <div class="flex justify-between pb-1.5 border-b border-slate-200/60">
                        <span class="text-slate-500">Formule :</span>
                        <strong class="text-slate-900">${currentPlan.name} (${currentPlan.maxProducts} articles)</strong>
                    </div>
                    <div class="flex justify-between pb-1.5 border-b border-slate-200/60">
                        <span class="text-slate-500">Durée :</span>
                        <strong class="text-emerald-700 font-bold">30 jours d'accès</strong>
                    </div>
                    <div class="flex justify-between pt-0.5">
                        <span class="text-slate-800 font-bold">Montant :</span>
                        <strong class="text-slate-900 text-base font-extrabold font-heading">${currentPlan.price.toLocaleString('fr-FR')} FCFA</strong>
                    </div>
                </div>

                <!-- Lien de secours si popup bloquée -->
                <div class="text-xs text-slate-500">
                    La page de paiement ne s'est pas ouverte ?
                    <a href="${link}" target="_blank" rel="noopener noreferrer" class="text-primary font-bold underline inline-flex items-center gap-1 ml-1">
                        Ouvrir le lien SasPay <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </a>
                </div>

                <!-- Actions de confirmation -->
                <div class="w-full flex flex-col gap-2 pt-2">
                    <button 
                        type="button" 
                        id="btn-confirm-active-sub"
                        ${isProcessing ? 'disabled' : ''}
                        class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-heading font-extrabold text-xs sm:text-sm rounded-xl shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 min-h-[46px] cursor-pointer disabled:opacity-50"
                    >
                        ${isProcessing ? `
                            <i class="fa-solid fa-spinner fa-spin"></i>
                            <span>Activation de votre boutique...</span>
                        ` : `
                            <i class="fa-solid fa-circle-check"></i>
                            <span>J'ai validé mon paiement • Activer ma boutique</span>
                        `}
                    </button>

                    <button 
                        type="button" 
                        id="btn-back-to-plans"
                        class="w-full py-2 text-xs text-slate-400 hover:text-slate-700 font-semibold transition-colors cursor-pointer"
                    >
                        Retourner au choix des formules
                    </button>
                </div>
            </div>
        `;
    }

    function bindEvents() {
        modalEl.querySelector('#btn-close-subscription-modal')?.addEventListener('click', close);
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) close();
        });

        // 1. Clic sur une formule (Plan Card)
        modalEl.querySelectorAll('.plan-card').forEach((card) => {
            card.addEventListener('click', () => {
                const planId = card.getAttribute('data-plan-id');
                if (planId) {
                    selectedPlanId = planId;
                    render();
                }
            });
        });

        // 2. Bouton unique pour ouvrir le paiement SasPay
        modalEl.querySelector('#btn-proceed-subscription')?.addEventListener('click', async () => {
            if (isProcessing) return;
            const currentPlan = SUBSCRIPTION_PLANS[selectedPlanId] || SUBSCRIPTION_PLANS.starter;
            const paymentUrl = currentPlan.paymentLink || 'https://link.saspay.me/hgc4jifsarq';

            // Ouvre immédiatement la page SasPay dans un nouvel onglet
            try {
                window.open(paymentUrl, '_blank', 'noopener,noreferrer');
            } catch {}

            isProcessing = true;
            render();

            try {
                const res = await initiateSubscriptionPayment({
                    sellerId: seller.id,
                    plan: selectedPlanId,
                    operator: 'wave',
                    sellerEmail: seller.email,
                    sellerName: `${seller.prenom || ''} ${seller.nom || ''}`.trim(),
                });
                currentSession = res;
            } catch (err) {
                console.warn('[SubscriptionModal] Note initiation:', err);
                currentSession = { sessionId: `session_${Date.now()}` };
            } finally {
                isProcessing = false;
                awaitingConfirmation = true;
                render();
            }
        });

        // 3. Bouton "J'ai validé mon paiement • Activer ma boutique"
        const handleConfirm = async () => {
            if (isProcessing) return;
            isProcessing = true;
            render();

            try {
                const sessionId = currentSession?.sessionId || `saspay_direct_${Date.now()}`;
                const result = await confirmSubscriptionPayment({
                    sessionId,
                    sellerId: seller.id,
                    plan: selectedPlanId,
                    operator: 'wave',
                });

                if (typeof onShowToast === 'function') {
                    const planObj = SUBSCRIPTION_PLANS[selectedPlanId] || SUBSCRIPTION_PLANS.starter;
                    onShowToast(`🎉 Félicitations ! Votre ${planObj.name} est activé pour 30 jours (${planObj.maxProducts} articles).`, 'success');
                }

                close();

                if (typeof onSubscribed === 'function') {
                    onSubscribed({
                        profile: result.profile,
                        plan: selectedPlanId,
                        operator: 'wave',
                    });
                }
            } catch (err) {
                console.error('[SubscriptionModal] Erreur validation:', err);
                if (typeof onShowToast === 'function') {
                    onShowToast(err.message || 'Échec d\'activation de l\'abonnement.', 'error');
                }
            } finally {
                isProcessing = false;
                awaitingConfirmation = false;
                render();
            }
        };

        modalEl.querySelector('#btn-confirm-active-sub')?.addEventListener('click', () => handleConfirm());

        // 4. Retour au choix
        modalEl.querySelector('#btn-back-to-plans')?.addEventListener('click', () => {
            awaitingConfirmation = false;
            isProcessing = false;
            render();
        });
    }

    function open(defaultPlan = null) {
        if (defaultPlan && SUBSCRIPTION_PLANS[defaultPlan]) {
            selectedPlanId = defaultPlan;
        } else if (seller?.subscription_plan && SUBSCRIPTION_PLANS[seller.subscription_plan]) {
            selectedPlanId = seller.subscription_plan;
        }
        awaitingConfirmation = false;
        currentSession = null;
        isProcessing = false;
        render();

        modalEl.classList.remove('opacity-0', 'pointer-events-none');
        modalEl.classList.add('opacity-100');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        modalEl.classList.remove('opacity-100');
        modalEl.classList.add('opacity-0', 'pointer-events-none');
        document.body.style.overflow = '';
        awaitingConfirmation = false;
        currentSession = null;
        isProcessing = false;
    }

    render();

    return {
        element: modalEl,
        open,
        close,
    };
}

export default createSubscriptionModal;
