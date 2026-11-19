/**
 * Composant SellerAnnounceModal
 * Formulaire de soumission d'une annonce commerciale (250 FCFA - FR-19).
 * Permet au vendeur de renseigner son annonce et de procéder directement
 * au règlement via SasPay (Wave / Orange Money) sans saisie manuelle de référence SMS.
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

    let step = 1; // 1: Formulaire & Règlement direct, 2: Redirection
    let formData = {
        title: '',
        content: '',
        linkUrl: '',
        imageFile: null,
        imageUrl: null,
        operator: 'wave',
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
                    ${step === 1 ? renderForm() : renderRedirecting()}
                </div>
            </div>
        `;

        bindEvents();
    }

    function renderForm() {
        return `
            <div class="space-y-4">
                <div class="bg-blue-50 border border-blue-200/70 rounded-2xl p-3.5 flex items-start gap-3">
                    <i class="fa-solid fa-bullhorn text-primary text-lg mt-0.5"></i>
                    <div class="text-xs text-slate-700 leading-relaxed">
                        <strong class="font-bold text-slate-900 block mb-0.5">Visibilité maximale sur l'accueil acheteur</strong>
                        Faites passer votre offre, promo ou événement auprès de toute la communauté de l'UIDT pendant <strong>7 jours</strong> pour seulement <strong>${ANNONCE_CONFIG.priceDisplay}</strong> via Wave ou Orange Money.
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

                <!-- Mode de paiement SasPay direct (Wave / Orange Money) -->
                <div>
                    <label class="block text-xs font-bold text-slate-800 mb-1.5">
                        Moyen de règlement (${ANNONCE_CONFIG.priceDisplay}) *
                    </label>
                    <div class="flex gap-2">
                        <button 
                            type="button" 
                            data-operator="wave" 
                            class="flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${formData.operator === 'wave' ? 'border-sky-500 bg-sky-50 text-sky-700 ring-2 ring-sky-300' : 'border-slate-200 bg-white text-slate-600'}"
                        >
                            <i class="fa-solid fa-water text-sky-500"></i> Wave Sénégal
                        </button>
                        <button 
                            type="button" 
                            data-operator="om" 
                            class="flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${formData.operator === 'om' ? 'border-orange-500 bg-orange-50 text-orange-700 ring-2 ring-orange-300' : 'border-slate-200 bg-white text-slate-600'}"
                        >
                            <i class="fa-solid fa-mobile-screen-button text-orange-500"></i> Orange Money
                        </button>
                    </div>
                </div>

                <button 
                    type="button" 
                    id="btn-submit-announce-direct" 
                    ${isSubmitting ? 'disabled' : ''}
                    class="w-full py-3 bg-primary hover:bg-primary-hover active:scale-95 text-white font-heading font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer mt-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}"
                >
                    ${isSubmitting ? '<i class="fa-solid fa-spinner fa-spin"></i> Traitement en cours...' : `<i class="fa-solid fa-credit-card text-xs"></i> Continuer vers le paiement (${ANNONCE_CONFIG.priceDisplay})`}
                </button>
            </div>
        `;
    }

    function renderRedirecting() {
        return `
            <div class="text-center py-6 px-4 space-y-4">
                <div class="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center text-2xl mx-auto shadow-sm">
                    <i class="fa-solid fa-spinner fa-spin"></i>
                </div>
                <div>
                    <h3 class="font-heading font-extrabold text-base sm:text-lg text-slate-900">Redirection vers le paiement...</h3>
                    <p class="text-xs sm:text-sm text-slate-600 mt-1 max-w-xs mx-auto">
                        Votre annonce est enregistrée. Vous allez être redirigé vers la session de paiement sécurisée SasPay (Wave / OM).
                    </p>
                </div>
                <div class="pt-2">
                    <a 
                        href="${ANNONCE_CONFIG.paymentLink}" 
                        id="btn-direct-payment-fallback"
                        class="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-sm transition-all"
                    >
                        <span>Ouvrir la page de paiement (${ANNONCE_CONFIG.priceDisplay})</span>
                        <i class="fa-solid fa-arrow-up-right-from-square text-xs"></i>
                    </a>
                </div>
                <p class="text-[11px] text-slate-400">Dès la confirmation du paiement, votre annonce sera activée automatiquement pour 7 jours.</p>
            </div>
        `;
    }

    function bindEvents() {
        modalEl.querySelector('#btn-close-announce-modal')?.addEventListener('click', close);

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

            modalEl.querySelectorAll('button[data-operator]').forEach((btn) => {
                btn.addEventListener('click', () => {
                    formData.operator = btn.getAttribute('data-operator');
                    render();
                });
            });

            modalEl.querySelector('#btn-submit-announce-direct')?.addEventListener('click', async () => {
                const cleanTitle = formData.title.trim();
                const cleanContent = formData.content.trim();

                if (!cleanTitle || cleanTitle.length < 3) {
                    if (typeof onShowToast === 'function') onShowToast('Le titre doit comporter au moins 3 caractères.', 'error');
                    titleInput?.focus();
                    return;
                }
                if (!cleanContent || cleanContent.length < 10) {
                    if (typeof onShowToast === 'function') onShowToast('Le message doit comporter au moins 10 caractères.', 'error');
                    contentInput?.focus();
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
                                filename: `ad_${(seller?.id || 'uidt').slice(0, 8)}_${Date.now()}`,
                                maxWidth: 800,
                                maxHeight: 600,
                                quality: 0.75,
                                context: 'ad',
                            });
                        } catch (imgErr) {
                            console.warn('[SellerAnnounceModal] Erreur upload image, poursuite sans photo:', imgErr);
                        }
                    }

                    // Enregistrement de l'annonce en statut 'paiement_en_attente' via la RPC PostgreSQL
                    const { data: res, error: rpcErr } = await supabase.rpc('submit_advertisement', {
                        p_title: cleanTitle,
                        p_content: cleanContent,
                        p_image_url: finalImageUrl,
                        p_link_url: formData.linkUrl.trim() || null,
                        p_product_id: null,
                        p_operator: formData.operator,
                        p_session_id: null,
                    });

                    if (rpcErr) throw new Error(rpcErr.message);
                    if (res && res.success === false) throw new Error(res.message);

                    step = 2;
                    render();

                    if (typeof onShowToast === 'function') {
                        onShowToast('📢 Annonce enregistrée ! Redirection vers le paiement Wave / OM...', 'success');
                    }
                    if (typeof onSuccess === 'function') {
                        onSuccess(res);
                    }

                    // Redirection directe vers la session de paiement SasPay 250 FCFA
                    const targetPaymentUrl = ANNONCE_CONFIG.paymentLink;
                    if (typeof window !== 'undefined' && targetPaymentUrl) {
                        setTimeout(() => {
                            window.location.href = targetPaymentUrl;
                        }, 900);
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
