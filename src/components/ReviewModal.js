/**
 * Composant ReviewModal
 * Modal interactive pour noter un vendeur (1 à 5 étoiles) et rédiger un avis client.
 */

import { submitReview } from '../services/review-service.js';
import { escapeHTML } from '../utils/security.js';

const RATING_LABELS = {
    1: '😞 Décevant',
    2: '😐 Passable',
    3: '🙂 Bien',
    4: '😊 Très bien',
    5: '🤩 Excellent !',
};

/**
 * Crée le contrôleur de la modal d'évaluation.
 * @param {Object} props
 * @param {Function} [props.onReviewSubmitted] - Callback après insertion réussie
 * @param {Function} [props.onShowToast] - Callback de notification toast
 * @returns {Object} { open, close, element }
 */
export function createReviewModal({ onReviewSubmitted, onShowToast } = {}) {
    let currentSeller = null;
    let currentOrderId = null;
    let selectedRating = 5;
    let isSubmitting = false;

    const modalEl = document.createElement('div');
    modalEl.id = 'seller-review-modal';
    modalEl.className = 'fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 hidden opacity-0 transition-opacity duration-300 select-none';

    function renderContent() {
        const sellerName = currentSeller
            ? `${currentSeller.prenom || ''} ${currentSeller.nom || ''}`.trim()
            : 'ce marchand';

        modalEl.innerHTML = `
            <div class="bg-white rounded-3xl border border-slate-200/80 shadow-2xl max-w-md w-full p-5 sm:p-7 flex flex-col gap-5 transform transition-all duration-300 scale-95" id="review-modal-box">
                <!-- En-tête -->
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center text-lg shadow-xs">
                            <i class="fa-solid fa-star"></i>
                        </div>
                        <div>
                            <h3 class="font-heading font-extrabold text-base sm:text-lg text-slate-900 leading-tight">
                                Évaluer la boutique
                            </h3>
                            <p class="text-xs text-slate-500 mt-0.5 truncate max-w-[220px]">
                                ${escapeHTML(sellerName)}
                            </p>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        id="btn-close-review-modal" 
                        aria-label="Fermer" 
                        class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-xs transition-colors cursor-pointer"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Sélecteur d'étoiles interactif -->
                <div class="flex flex-col items-center gap-2 py-2 bg-slate-50/80 rounded-2xl border border-slate-100 p-4">
                    <span class="text-xs font-semibold text-slate-500">Votre note globale</span>
                    <div class="flex items-center gap-2" id="star-picker-container">
                        ${[1, 2, 3, 4, 5].map((star) => `
                            <button 
                                type="button" 
                                data-star-value="${star}"
                                class="star-btn text-3xl transition-transform active:scale-125 focus:outline-none cursor-pointer ${
                                    star <= selectedRating ? 'text-amber-400' : 'text-slate-200 hover:text-amber-200'
                                }"
                            >
                                <i class="fa-solid fa-star"></i>
                            </button>
                        `).join('')}
                    </div>
                    <span id="rating-label-text" class="text-xs font-bold text-slate-700 mt-1 transition-all">
                        ${RATING_LABELS[selectedRating] || ''}
                    </span>
                </div>

                <!-- Formulaire de commentaire -->
                <div class="flex flex-col gap-3.5">
                    <div>
                        <label for="review-buyer-name" class="block text-xs font-bold text-slate-700 mb-1">
                            Votre prénom / identité <span class="text-slate-400 font-normal">(optionnel)</span>
                        </label>
                        <input 
                            type="text" 
                            id="review-buyer-name" 
                            placeholder="Ex : Moussa Diop (L2 Informatique)" 
                            class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all"
                        >
                    </div>

                    <div>
                        <label for="review-comment-textarea" class="block text-xs font-bold text-slate-700 mb-1">
                            Votre commentaire sur l'expérience
                        </label>
                        <textarea 
                            id="review-comment-textarea" 
                            rows="3" 
                            placeholder="Livraison rapide au pavillon, article bien emballé et conforme... Partagez votre avis aux autres étudiants !" 
                            class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none transition-all resize-none"
                        ></textarea>
                    </div>
                </div>

                <!-- Boutons d'action -->
                <div class="flex items-center gap-3 pt-2">
                    <button 
                        type="button" 
                        id="btn-cancel-review" 
                        class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer"
                    >
                        Annuler
                    </button>
                    <button 
                        type="button" 
                        id="btn-submit-review-action" 
                        class="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold text-xs shadow-md shadow-primary/20 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer ${
                            isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
                        }"
                    >
                        ${isSubmitting ? `
                            <i class="fa-solid fa-circle-notch fa-spin text-xs"></i>
                            <span>Publication...</span>
                        ` : `
                            <i class="fa-solid fa-paper-plane text-xs"></i>
                            <span>Publier mon avis</span>
                        `}
                    </button>
                </div>
            </div>
        `;

        bindEvents();
    }

    function updateStarsUI(rating) {
        selectedRating = rating;
        const starBtns = modalEl.querySelectorAll('.star-btn');
        starBtns.forEach((btn) => {
            const val = parseInt(btn.dataset.starValue, 10);
            if (val <= rating) {
                btn.className = 'star-btn text-3xl text-amber-400 transition-transform active:scale-125 focus:outline-none cursor-pointer';
            } else {
                btn.className = 'star-btn text-3xl text-slate-200 hover:text-amber-200 transition-transform active:scale-125 focus:outline-none cursor-pointer';
            }
        });
        const labelEl = modalEl.querySelector('#rating-label-text');
        if (labelEl) {
            labelEl.textContent = RATING_LABELS[rating] || '';
        }
    }

    function bindEvents() {
        modalEl.querySelector('#btn-close-review-modal')?.addEventListener('click', close);
        modalEl.querySelector('#btn-cancel-review')?.addEventListener('click', close);

        // Clic en dehors de la boîte
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) close();
        });

        // Étoiles
        modalEl.querySelectorAll('.star-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const val = parseInt(btn.dataset.starValue, 10);
                if (val >= 1 && val <= 5) {
                    updateStarsUI(val);
                }
            });
        });

        // Soumission
        modalEl.querySelector('#btn-submit-review-action')?.addEventListener('click', handleSubmit);
    }

    async function handleSubmit() {
        if (isSubmitting || !currentSeller) return;

        const commentInput = modalEl.querySelector('#review-comment-textarea');
        const nameInput = modalEl.querySelector('#review-buyer-name');
        const comment = (commentInput?.value || '').trim();
        const buyerName = (nameInput?.value || '').trim();

        isSubmitting = true;
        renderContent();

        try {
            const review = await submitReview({
                sellerId: currentSeller.id,
                orderId: currentOrderId,
                rating: selectedRating,
                comment,
                buyerName,
            });

            if (typeof onShowToast === 'function') {
                onShowToast(`🎉 Merci pour votre avis sur ${currentSeller.prenom || 'la boutique'} !`, 'success');
            }

            close();

            if (typeof onReviewSubmitted === 'function') {
                onReviewSubmitted(review);
            }
        } catch (err) {
            console.error('[ReviewModal] Erreur soumission avis:', err);
            if (typeof onShowToast === 'function') {
                onShowToast(err.message || 'Impossible d\'enregistrer votre avis.', 'error');
            }
            isSubmitting = false;
            renderContent();
        }
    }

    function open({ seller, orderId = null } = {}) {
        if (!seller || !seller.id) return;
        currentSeller = seller;
        currentOrderId = orderId;
        selectedRating = 5;
        isSubmitting = false;

        renderContent();
        modalEl.classList.remove('hidden');
        requestAnimationFrame(() => {
            modalEl.classList.remove('opacity-0');
            const box = modalEl.querySelector('#review-modal-box');
            if (box) {
                box.classList.remove('scale-95');
                box.classList.add('scale-100');
            }
        });
    }

    function close() {
        modalEl.classList.add('opacity-0');
        const box = modalEl.querySelector('#review-modal-box');
        if (box) {
            box.classList.remove('scale-100');
            box.classList.add('scale-95');
        }
        setTimeout(() => {
            modalEl.classList.add('hidden');
            currentSeller = null;
            currentOrderId = null;
        }, 250);
    }

    // Montage propre dans le body (remplacement si existant)
    const existingModal = document.getElementById('seller-review-modal');
    if (existingModal) existingModal.remove();
    document.body.appendChild(modalEl);

    return {
        open,
        close,
        element: modalEl,
    };
}

export default createReviewModal;
