/**
 * Composant SellerAnnounceModal
 * Formulaire de soumission d'une annonce commerciale (250 FCFA - FR-19).
 * Permet au vendeur de renseigner le contenu de l'annonce, d'accéder au paiement
 * SasPay Wave / OM puis de renseigner sa référence de transaction pour validation administrative.
 */

import { supabase } from '../../services/supabase.js';
import { ANNONCE_CONFIG } from '../../config/announcements.js';
import { uploadMediaFile } from '../../services/storage-service.js';
import { escapeHTML } from '../../utils/security.js';
import logoUrl from '../../assets/logo.webp';

/**
 * Crée le modal de passage d'annonce 250 FCFA.
 * @param {Object} props
 * @param {Object} props.seller - Profil vendeur
 * @param {Function} [props.onSuccess] - Callback après soumission réussie
 * @param {Function} [props.onShowToast] - Notification toast
 * @returns {Object} Contrôleur ({ element, open, close })
 */
export function createSellerAnnounceModal({ seller, onSuccess, onShowToast } = {}) {
    const modalEl = document.createElement('div');
    modalEl.id = 'seller-announce-modal-overlay';
    modalEl.className = 'fixed inset-0 z-[75] bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-300';

    let step = 1; // 1: Formulaire, 2: Paiement & Référence, 3: Succès
    let formData = {
        title: '',
        content: '',
        linkUrl: '',
        imageFile: null,
        imageUrl: null,
        operator: 'wave',
        transactionRef: '',
    };
    let isSubmitting = false;

    function render() {
        modalEl.innerHTML = `
            <div class="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in duration-200">
                <!-- En-tête -->
                <div class="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                    <div class="flex items-center gap-2.5">
                        <img src="${logoUrl}" alt="Campus Market" class="h-7 w-auto max-w-[110px] object-contain">
                        <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                            📢 Annonce ${ANNONCE_CONFIG.priceDisplay}
                        </span>
                    </div>
                    <button 
                        type="button" 
                        id="btn-close-announce-modal" 
                        class="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                        aria-label="Fermer"
                    >
                        <i class="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                <!-- Corps du formulaire -->
                <div class="p-5 overflow-y-auto flex-1 no-scrollbar space-y-4">
                    ${step === 1 ? renderStep1() : (step === 2 ? renderStep2() : renderStep3())}
                </div>
            </div>
        `;

        bindEvents();
    }

    function renderStep1() {
        return `
            <div class="space-y-4">
                <div class="bg-blue-50 border border-blue-200/70 rounded-2xl p-3.5 flex items-start gap-3">
                    <i class="fa-solid fa-bullhorn text-primary text-lg mt-0.5"></i>
                    <div class="text-xs text-slate-700 leading-relaxed">
                        <strong class="font-bold text-slate-900 block mb-0.5">Visibilité maximale sur l'accueil acheteur</strong>
                        Faites passer votre offre, promo ou événement auprès de toute la communauté de l'UIDT pendant <strong>7 jours</strong> pour seulement <strong>${ANNONCE_CONFIG.priceDisplay}</strong>.
                    </div>
                </div>

                <div>
                    <div class="flex justify-between items-center mb-1">
                        <label class="block text-xs font-bold text-slate-800" for="ad-title">
                            Titre accrocheur *
                        </label>
                        <span class="text-[11px] text-slate-400" id="ad-title-count">${formData.title.length}/${ANNONCE_CONFIG.maxTitleLength}</span>
                    </div>
                    <input 
                        type="text" 
                        id="ad-title" 
                        maxlength="${ANNONCE_CONFIG.maxTitleLength}" 
                        placeholder="Ex: Nouveaux sandwichs chauds à B1 !" 
                        value="${escapeHTML(formData.title)}"
                        class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                    >
                </div>

                <div>
                    <div class="flex justify-between items-center mb-1">
                        <label class="block text-xs font-bold text-slate-800" for="ad-content">
                            Message de l'annonce *
                        </label>
                        <span class="text-[11px] text-slate-400" id="ad-content-count">${formData.content.length}/${ANNONCE_CONFIG.maxTextLength}</span>
                    </div>
                    <textarea 
                        id="ad-content" 
                        rows="3" 
                        maxlength="${ANNONCE_CONFIG.maxTextLength}" 
                        placeholder="Décrivez votre offre en quelques mots clairs..." 
                        class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all resize-none"
                    >${escapeHTML(formData.content)}</textarea>
                </div>

                <div>
                    <label class="block text-xs font-bold text-slate-800 mb-1" for="ad-image-file">
                        Affiche ou photo promotionnelle (Optionnel)
                    </label>
                    <input 
                        type="file" 
                        id="ad-image-file" 
                        accept="image/jpeg,image/png,image/webp" 
                        class="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer"
                    >
                    <p class="text-[10px] text-slate-400 mt-1">Format recommandé : JPEG, PNG ou WebP (compression automatique).</p>
                </div>

                <div>
                    <label class="block text-xs font-bold text-slate-800 mb-1" for="ad-link-url">
                        Lien ou redirection externe (Optionnel)
                    </label>
                    <input 
                        type="text" 
                        id="ad-link-url" 
                        placeholder="Ex: #category/restauration ou https://wa.me/..." 
                        value="${escapeHTML(formData.linkUrl)}"
                        class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                    >
                </div>

                <button 
                    type="button" 
                    id="btn-go-to-payment" 
                    class="w-full py-3 bg-primary hover:bg-primary-hover active:scale-95 text-white font-heading font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2"
                >
                    <span>Continuer vers le règlement (${ANNONCE_CONFIG.priceDisplay})</span>
                    <i class="fa-solid fa-arrow-right text-xs"></i>
                </button>
            </div>
        `;
    }

    function renderStep2() {
        return `
            <div class="space-y-4">
                <div class="text-center p-3">
                    <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-xl mx-auto mb-2 shadow-xs">
                        <i class="fa-solid fa-credit-card"></i>
                    </div>
                    <h3 class="font-heading font-extrabold text-sm sm:text-base text-slate-900">Règlement de votre annonce</h3>
                    <p class="text-xs text-slate-500 mt-0.5">Montant fixe certifié : <strong class="text-slate-900 font-bold">${ANNONCE_CONFIG.priceDisplay}</strong></p>
                </div>

                <!-- 1. Bouton d'accès au lien SasPay officiel -->
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center space-y-2">
                    <span class="text-xs font-bold text-slate-700 block">Étape 1 : Effectuez le paiement de 250 FCFA</span>
                    <a 
                        href="${ANNONCE_CONFIG.paymentLink}" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        id="btn-open-payment-link"
                        class="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                    >
                        <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                        <span>Ouvrir le paiement Wave / OM (250 F)</span>
                    </a>
                    <p class="text-[11px] text-slate-400">Le paiement s'ouvre dans un nouvel onglet sécurisé.</p>
                </div>

                <!-- 2. Saisie de la référence de paiement -->
                <div class="space-y-3 pt-1">
                    <span class="text-xs font-bold text-slate-700 block">Étape 2 : Renseignez la référence reçue par SMS</span>
                    
                    <div class="flex gap-2">
                        <button 
                            type="button" 
                            data-operator="wave" 
                            class="flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${formData.operator === 'wave' ? 'border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-300' : 'border-slate-200 bg-white text-slate-600'}"
                        >
                            <i class="fa-solid fa-water text-sky-500"></i> Wave
                        </button>
                        <button 
                            type="button" 
                            data-operator="om" 
                            class="flex-1 py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${formData.operator === 'om' ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-300' : 'border-slate-200 bg-white text-slate-600'}"
                        >
                            <i class="fa-solid fa-mobile-screen-button text-orange-500"></i> Orange Money
                        </button>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-800 mb-1" for="ad-transaction-ref">
                            Référence de transaction Wave ou Orange Money *
                        </label>
                        <input 
                            type="text" 
                            id="ad-transaction-ref" 
                            placeholder="Ex: TXN-94821 ou référence SMS Wave" 
                            value="${escapeHTML(formData.transactionRef)}"
                            class="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                        >
                        <p class="text-[10px] text-slate-400 mt-1">Chaque référence est scellée de manière unique en base (anti-fraude FR-19).</p>
                    </div>
                </div>

                <div class="flex gap-2 pt-2">
                    <button 
                        type="button" 
                        id="btn-back-to-step-1" 
                        class="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
                    >
                        <i class="fa-solid fa-arrow-left mr-1"></i> Retour
                    </button>
                    <button 
                        type="button" 
                        id="btn-submit-announce" 
                        ${isSubmitting ? 'disabled' : ''}
                        class="flex-1 py-3 bg-primary hover:bg-primary-hover active:scale-95 text-white font-heading font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}"
                    >
                        ${isSubmitting ? '<i class="fa-solid fa-spinner fa-spin"></i> Envoi en cours...' : '<i class="fa-solid fa-paper-plane text-xs"></i> Transmettre mon annonce'}
                    </button>
                </div>
            </div>
        `;
    }

    function renderStep3() {
        return `
            <div class="text-center py-6 px-4 space-y-4">
                <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-2xl mx-auto shadow-sm">
                    <i class="fa-solid fa-check"></i>
                </div>
                <div>
                    <h3 class="font-heading font-extrabold text-base sm:text-lg text-slate-900">Annonce transmise avec succès !</h3>
                    <p class="text-xs sm:text-sm text-slate-600 mt-1 max-w-xs mx-auto">
                        Votre annonce est actuellement <strong>en attente de validation</strong> par l'administration du campus.
                    </p>
                </div>
                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-left text-xs text-slate-600 space-y-1">
                    <div><strong>Titre :</strong> ${escapeHTML(formData.title)}</div>
                    <div><strong>Référence :</strong> ${escapeHTML(formData.transactionRef)}</div>
                    <div><strong>Montant :</strong> 250 FCFA</div>
                    <div><strong>Durée :</strong> 7 jours dès validation</div>
                </div>
                <p class="text-[11px] text-slate-400">
                    Délai habituel de validation administrative : moins de 2 heures.
                </p>
                <button 
                    type="button" 
                    id="btn-finish-announce" 
                    class="w-full py-3 bg-primary hover:bg-primary-hover active:scale-95 text-white font-heading font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer"
                >
                    Fermer et retourner à ma boutique
                </button>
            </div>
        `;
    }

    function bindEvents() {
        modalEl.querySelector('#btn-close-announce-modal')?.addEventListener('click', close);
        modalEl.querySelector('#btn-finish-announce')?.addEventListener('click', close);

        if (step === 1) {
            const titleInput = modalEl.querySelector('#ad-title');
            const contentInput = modalEl.querySelector('#ad-content');
            const linkInput = modalEl.querySelector('#ad-link-url');
            const fileInput = modalEl.querySelector('#ad-image-file');

            titleInput?.addEventListener('input', (e) => {
                formData.title = e.target.value;
                const counter = modalEl.querySelector('#ad-title-count');
                if (counter) counter.textContent = `${formData.title.length}/${ANNONCE_CONFIG.maxTitleLength}`;
            });

            contentInput?.addEventListener('input', (e) => {
                formData.content = e.target.value;
                const counter = modalEl.querySelector('#ad-content-count');
                if (counter) counter.textContent = `${formData.content.length}/${ANNONCE_CONFIG.maxTextLength}`;
            });

            linkInput?.addEventListener('input', (e) => {
                formData.linkUrl = e.target.value;
            });

            fileInput?.addEventListener('change', (e) => {
                formData.imageFile = e.target.files?.[0] || null;
            });

            modalEl.querySelector('#btn-go-to-payment')?.addEventListener('click', () => {
                if (!formData.title.trim()) {
                    if (typeof onShowToast === 'function') onShowToast('Veuillez renseigner un titre pour votre annonce.', 'error');
                    titleInput?.focus();
                    return;
                }
                if (!formData.content.trim()) {
                    if (typeof onShowToast === 'function') onShowToast('Veuillez rédiger le message de votre annonce.', 'error');
                    contentInput?.focus();
                    return;
                }
                step = 2;
                render();
            });
        } else if (step === 2) {
            modalEl.querySelectorAll('button[data-operator]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    formData.operator = btn.getAttribute('data-operator');
                    render();
                });
            });

            const refInput = modalEl.querySelector('#ad-transaction-ref');
            refInput?.addEventListener('input', (e) => {
                formData.transactionRef = e.target.value;
            });

            modalEl.querySelector('#btn-back-to-step-1')?.addEventListener('click', () => {
                step = 1;
                render();
            });

            modalEl.querySelector('#btn-submit-announce')?.addEventListener('click', async () => {
                const cleanRef = formData.transactionRef.trim();
                if (!cleanRef) {
                    if (typeof onShowToast === 'function') onShowToast('Veuillez renseigner la référence de transaction reçue par SMS.', 'error');
                    refInput?.focus();
                    return;
                }

                isSubmitting = true;
                render();

                try {
                    // Upload image optionnelle via storage-service
                    let finalImageUrl = null;
                    if (formData.imageFile) {
                        try {
                            finalImageUrl = await uploadMediaFile(formData.imageFile, {
                                folder: 'annonces',
                                filename: `ad_${seller.id.slice(0, 8)}_${Date.now()}`,
                                maxWidth: 800,
                                maxHeight: 600,
                                quality: 0.75,
                                context: 'ad',
                            });
                        } catch (imgErr) {
                            console.warn('[SellerAnnounceModal] Erreur upload image, poursuite sans photo:', imgErr);
                        }
                    }

                    // Appel RPC sécurisé submit_advertisement
                    const { data: res, error: rpcErr } = await supabase.rpc('submit_advertisement', {
                        p_title: formData.title.trim(),
                        p_content: formData.content.trim(),
                        p_image_url: finalImageUrl,
                        p_link_url: formData.linkUrl.trim() || null,
                        p_product_id: null,
                        p_operator: formData.operator,
                        p_transaction_ref: cleanRef,
                    });

                    if (rpcErr) throw new Error(rpcErr.message);
                    if (res && res.success === false) throw new Error(res.message);

                    step = 3;
                    render();

                    if (typeof onShowToast === 'function') {
                        onShowToast('🎉 Annonce transmise avec succès pour validation !', 'success');
                    }
                    if (typeof onSuccess === 'function') {
                        onSuccess(res);
                    }
                } catch (err) {
                    isSubmitting = false;
                    render();
                    if (typeof onShowToast === 'function') {
                        onShowToast(`Erreur : ${err.message}`, 'error');
                    }
                }
            });
        }
    }

    function open() {
        step = 1;
        formData = {
            title: '',
            content: '',
            linkUrl: '',
            imageFile: null,
            imageUrl: null,
            operator: 'wave',
            transactionRef: '',
        };
        isSubmitting = false;
        render();

        document.body.appendChild(modalEl);
        requestAnimationFrame(() => {
            modalEl.classList.remove('opacity-0', 'pointer-events-none');
        });
    }

    function close() {
        modalEl.classList.add('opacity-0', 'pointer-events-none');
        setTimeout(() => {
            modalEl.remove();
        }, 300);
    }

    return {
        element: modalEl,
        open,
        close,
    };
}
