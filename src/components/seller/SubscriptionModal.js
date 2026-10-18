/**
 * Composant SubscriptionModal (Gestion des formules & Passerelle SasPay).
 * Permet au vendeur de choisir parmi les formules (Starter 1 500F ou Pro 2 500F)
 * et d'accéder au paiement direct via SasPay (Wave ou Orange Money) avec vérification 100% automatique.
 */

import { SUBSCRIPTION_PLANS } from '../../config/subscription.js';
import { 
    initiateSubscriptionPayment, 
    confirmSubscriptionPayment, 
    submitSubscriptionPaymentProof,
    fetchSellerPendingPayments 
} from '../../services/seller-service.js';
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
    let submittedProof = false;
    let submittedReference = '';
    let currentSession = null;
    let pollInterval = null;
    let pendingPaymentInfo = null;

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    function startAutoPolling() {
        stopPolling();
        if (!currentSession?.sessionId) return;

        let attempts = 0;
        const maxAttempts = 40; // ~2.5 minutes de polling

        pollInterval = setInterval(async () => {
            attempts++;
            if (attempts > maxAttempts) {
                stopPolling();
                return;
            }

            try {
                const res = await confirmSubscriptionPayment({
                    sessionId: currentSession.sessionId,
                    sellerId: seller.id,
                    plan: selectedPlanId,
                    operator: 'wave',
                });

                if (res?.success) {
                    stopPolling();
                    awaitingConfirmation = false;
                    isProcessing = false;

                    if (typeof onShowToast === 'function') {
                        const planObj = SUBSCRIPTION_PLANS[selectedPlanId] || SUBSCRIPTION_PLANS.starter;
                        onShowToast(`🎉 Paiement certifié par SasPay ! Votre ${planObj.name} est activé pour 30 jours.`, 'success');
                    }

                    close();

                    if (typeof onSubscribed === 'function') {
                        onSubscribed({
                            profile: res.profile,
                            plan: selectedPlanId,
                        });
                    }
                }
            } catch (pollErr) {
                // Le paiement est encore en attente côté SasPay, on continue à sonder
            }
        }, 4000);
    }

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
                            <span class="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">UIDT Thiès • Passerelle SasPay</span>
                        </div>
                    </div>
                    <button id="btn-close-subscription-modal" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer min-h-[44px] min-w-[44px]">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <!-- Contenu défilable -->
                <div class="p-6 overflow-y-auto flex flex-col gap-5 text-slate-900">
                    ${submittedProof ? renderProofSubmittedScreen() : (awaitingConfirmation ? renderConfirmationScreen(currentPlan) : renderSelectionScreen(currentPlan))}
                </div>
            </div>
        `;

        bindEvents();
    }

    function renderSelectionScreen(currentPlan) {
        return `
            ${pendingPaymentInfo ? `
                <div class="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
                    <i class="fa-solid fa-clock-rotate-left text-amber-600 text-base shrink-0 mt-0.5"></i>
                    <div>
                        <strong class="font-heading font-bold block text-amber-950">Demande en cours d'examen</strong>
                        <p class="text-[11px] text-amber-800 leading-snug mt-0.5">
                            Un paiement pour le <strong>${pendingPaymentInfo.plan?.toUpperCase()}</strong> est en attente de validation administrative (Réf : <code>${pendingPaymentInfo.provider_session_id || 'N/A'}</code>).
                        </p>
                    </div>
                </div>
            ` : ''}

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
                    Paiement direct sécurisé par <strong>SasPay</strong>. Vous choisirez <strong>Wave</strong> ou <strong>Orange Money</strong> sur la page de règlement.
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
                class="w-full py-3.5 bg-primary hover:bg-primary-dark active:scale-[0.99] text-white font-heading font-extrabold text-sm rounded-2xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer disabled:opacity-50"
            >
                ${isProcessing ? `
                    <i class="fa-solid fa-spinner fa-spin"></i>
                    <span>Ouverture de SasPay...</span>
                ` : `
                    <i class="fa-solid fa-lock"></i>
                    <span>Payer ${currentPlan.price.toLocaleString('fr-FR')} FCFA via SasPay</span>
                `}
            </button>
        `;
    }

    function renderConfirmationScreen(currentPlan) {
        const link = currentPlan.paymentLink || 'https://link.saspay.me/hgc4jifsarq';

        return `
            <div class="flex flex-col items-center text-center py-2 gap-4">
                <!-- Animation Radar / Vérification en temps réel -->
                <div class="relative w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl shadow-xs">
                    <i class="fa-solid fa-satellite-dish animate-pulse"></i>
                    <span class="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                    </span>
                </div>

                <div>
                    <span class="text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full bg-emerald-100 text-emerald-800">
                        Paiement en cours • SasPay
                    </span>
                    <h3 class="font-heading font-black text-lg text-slate-900 mt-2">En attente de validation sur votre téléphone</h3>
                    <p class="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                        Validez le débit Wave ou Orange Money de <strong>${currentPlan.price.toLocaleString('fr-FR')} FCFA</strong>. Dès confirmation de l'opérateur, cette page <strong>s'activera automatiquement</strong>.
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
                        <span class="text-slate-800 font-bold">Montant à régler :</span>
                        <strong class="text-slate-900 text-base font-extrabold font-heading">${currentPlan.price.toLocaleString('fr-FR')} FCFA</strong>
                    </div>
                </div>

                <!-- Lien de secours pour ré-ouvrir le lien de paiement si fermé -->
                <div class="text-xs text-slate-500">
                    La page de paiement s'est fermée ?
                    <a href="${link}" target="_blank" rel="noopener noreferrer" class="text-primary font-bold underline inline-flex items-center gap-1 ml-1">
                        Ré-ouvrir le lien SasPay <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                    </a>
                </div>

                <!-- Section alternative : Soumission manuelle de référence si paiement direct -->
                <div class="w-full pt-2 border-t border-slate-100 text-left">
                    <details class="group bg-slate-50 rounded-2xl p-3 border border-slate-200/70 transition-all">
                        <summary class="font-heading font-bold text-xs text-slate-700 cursor-pointer flex items-center justify-between select-none">
                            <span class="flex items-center gap-2">
                                <i class="fa-solid fa-receipt text-slate-400"></i>
                                <span>Déjà payé mais non détecté automatiquement ?</span>
                            </span>
                            <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 group-open:rotate-180 transition-transform"></i>
                        </summary>

                        <div class="pt-3 flex flex-col gap-3">
                            <p class="text-[11px] text-slate-500 leading-snug">
                                Saisissez la <strong>référence de transaction</strong> reçue par SMS (Wave ou Orange Money) ou votre <strong>numéro payeur</strong>. Notre administration validera immédiatement votre compte.
                            </p>

                            <div class="flex flex-col gap-1.5">
                                <label class="text-[11px] font-semibold text-slate-700" for="proof-txn-ref">Référence de paiement ou Numéro *</label>
                                <input 
                                    type="text" 
                                    id="proof-txn-ref" 
                                    placeholder="Ex: WAVE-123456 ou 770000000" 
                                    class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-primary focus:outline-none"
                                >
                            </div>

                            <button 
                                type="button" 
                                id="btn-submit-proof"
                                class="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-heading font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <i class="fa-solid fa-paper-plane text-xs"></i>
                                <span>Transmettre à l'administration</span>
                            </button>
                        </div>
                    </details>
                </div>

                <!-- Actions de navigation -->
                <div class="w-full flex flex-col gap-2 pt-1">
                    <button 
                        type="button" 
                        id="btn-back-to-plans"
                        class="w-full py-2.5 text-xs text-slate-400 hover:text-slate-700 font-semibold transition-colors cursor-pointer"
                    >
                        Annuler et retourner au choix des formules
                    </button>
                </div>
            </div>
        `;
    }

    function renderProofSubmittedScreen() {
        return `
            <div class="flex flex-col items-center text-center py-4 gap-4">
                <div class="w-16 h-16 rounded-3xl bg-blue-100 text-blue-600 flex items-center justify-center text-3xl shadow-sm">
                    <i class="fa-solid fa-clock"></i>
                </div>

                <div>
                    <span class="text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full bg-blue-100 text-blue-800">
                        Demande Enregistrée
                    </span>
                    <h3 class="font-heading font-black text-xl text-slate-900 mt-2">Preuve de paiement transmise !</h3>
                    <p class="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
                        Votre référence <code class="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold">${submittedReference}</code> a été envoyée à l'équipe SuperAdmin. Dès constatation du crédit SasPay, votre boutique sera activée pour 30 jours.
                    </p>
                </div>

                <div class="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-[11px] text-blue-800 text-left w-full leading-relaxed">
                    💡 <strong>Délai habituel de validation :</strong> quelques minutes à 30 minutes. Vous recevrez une confirmation et vos quotas de produits seront immédiatement débloqués.
                </div>

                <button 
                    type="button" 
                    id="btn-close-after-proof"
                    class="w-full py-3 bg-primary hover:bg-primary-dark text-white font-heading font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer mt-2"
                >
                    Compris, fermer
                </button>
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

        // 2. Bouton pour ouvrir le paiement SasPay
        modalEl.querySelector('#btn-proceed-subscription')?.addEventListener('click', async () => {
            if (isProcessing) return;
            const currentPlan = SUBSCRIPTION_PLANS[selectedPlanId] || SUBSCRIPTION_PLANS.starter;
            const paymentUrl = currentPlan.paymentLink || 'https://link.saspay.me/hgc4jifsarq';

            isProcessing = true;
            render();

            try {
                // Tentative d'initialisation de session dynamique
                const res = await initiateSubscriptionPayment({
                    sellerId: seller.id,
                    plan: selectedPlanId,
                    operator: 'wave',
                    sellerEmail: seller.email,
                    sellerName: `${seller.prenom || ''} ${seller.nom || ''}`.trim(),
                });
                currentSession = res;

                // Ouvre l'URL SasPay (soit dynamique soit statique)
                const targetUrl = res.checkoutUrl || paymentUrl;
                window.open(targetUrl, '_blank', 'noopener,noreferrer');
            } catch (err) {
                console.warn('[SubscriptionModal] Fallback lien statique:', err);
                currentSession = { sessionId: `saspay_link_${Date.now()}` };
                window.open(paymentUrl, '_blank', 'noopener,noreferrer');
            } finally {
                isProcessing = false;
                awaitingConfirmation = true;
                render();
                startAutoPolling();
            }
        });

        // 3. Bouton pour soumettre manuellement une référence de paiement
        modalEl.querySelector('#btn-submit-proof')?.addEventListener('click', async () => {
            const refInput = modalEl.querySelector('#proof-txn-ref');
            const refVal = refInput?.value?.trim();

            if (!refVal) {
                if (typeof onShowToast === 'function') {
                    onShowToast('Veuillez renseigner votre référence de paiement ou numéro Wave/OM.', 'error');
                }
                refInput?.focus();
                return;
            }

            const btn = modalEl.querySelector('#btn-submit-proof');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Envoi en cours...`;
            }

            try {
                await submitSubscriptionPaymentProof({
                    sellerId: seller.id,
                    plan: selectedPlanId,
                    operator: 'wave',
                    transactionRef: refVal,
                    phone: seller.telephone || '',
                });

                stopPolling();
                submittedProof = true;
                submittedReference = refVal;
                render();

                if (typeof onShowToast === 'function') {
                    onShowToast('Preuve de paiement enregistrée ! En cours de vérification par l\'administration.', 'success');
                }
            } catch (err) {
                if (typeof onShowToast === 'function') {
                    onShowToast(err.message || 'Échec de transmission de la référence.', 'error');
                }
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = `<i class="fa-solid fa-paper-plane text-xs"></i><span>Transmettre à l'administration</span>`;
                }
            }
        });

        // 4. Bouton de fermeture après soumission
        modalEl.querySelector('#btn-close-after-proof')?.addEventListener('click', () => {
            close();
        });

        // 5. Retour au choix des formules
        modalEl.querySelector('#btn-back-to-plans')?.addEventListener('click', () => {
            stopPolling();
            awaitingConfirmation = false;
            isProcessing = false;
            submittedProof = false;
            render();
        });
    }

    async function open(defaultPlan = null) {
        stopPolling();
        if (defaultPlan && SUBSCRIPTION_PLANS[defaultPlan]) {
            selectedPlanId = defaultPlan;
        } else if (seller?.subscription_plan && SUBSCRIPTION_PLANS[seller.subscription_plan]) {
            selectedPlanId = seller.subscription_plan;
        }
        awaitingConfirmation = false;
        submittedProof = false;
        submittedReference = '';
        currentSession = null;
        isProcessing = false;

        // Vérifier s'il y a un paiement déjà en attente
        try {
            const pendingList = await fetchSellerPendingPayments(seller?.id);
            if (pendingList && pendingList.length > 0) {
                pendingPaymentInfo = pendingList[0];
            } else {
                pendingPaymentInfo = null;
            }
        } catch {
            pendingPaymentInfo = null;
        }

        render();

        modalEl.classList.remove('opacity-0', 'pointer-events-none');
        modalEl.classList.add('opacity-100');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        stopPolling();
        modalEl.classList.remove('opacity-100');
        modalEl.classList.add('opacity-0', 'pointer-events-none');
        document.body.style.overflow = '';
        awaitingConfirmation = false;
        submittedProof = false;
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
