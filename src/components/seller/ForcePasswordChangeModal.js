/**
 * Composant ForcePasswordChangeModal
 * Modal bloquant imposant au vendeur de modifier son mot de passe
 * suite à une réinitialisation administrative (mot de passe temporaire 'campus1234!').
 */

import { changeSellerPassword, logoutSeller } from '../../services/seller-service.js';

/**
 * Crée le contrôleur du modal bloquant de changement obligatoire de mot de passe.
 * @param {Object} props
 * @param {Function} [props.onSuccess] - Callback après changement réussi ({ profile })
 * @param {Function} [props.onLogout] - Callback lors de la déconnexion
 * @returns {Object} Contrôleur ({ element, open, close })
 */
export function createForcePasswordChangeModal({ onSuccess, onLogout } = {}) {
    const modalEl = document.createElement('div');
    modalEl.id = 'force-password-change-modal-overlay';
    modalEl.className = 'fixed inset-0 z-[9999] bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-300';

    let currentProfile = null;
    let showPassword = false;

    function render() {
        modalEl.innerHTML = `
            <div class="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-slate-100 animate-scale-up">
                <!-- En-tête de sécurité -->
                <div class="px-6 py-5 border-b border-amber-100 bg-amber-50/70 flex items-center gap-3">
                    <div class="w-11 h-11 rounded-2xl bg-amber-500/15 text-amber-700 flex items-center justify-center text-xl shrink-0 shadow-xs">
                        <i class="fa-solid fa-shield-halved"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="font-heading font-extrabold text-slate-900 text-base leading-tight">Sécurité du Compte Vendeur</h2>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-950 uppercase tracking-wide">Obligatoire</span>
                        </div>
                        <span class="text-xs text-slate-500">Changement de mot de passe requis</span>
                    </div>
                </div>

                <!-- Corps du formulaire -->
                <div class="p-6 flex flex-col gap-4 overflow-y-auto max-h-[80vh]">
                    <!-- Message explicatif -->
                    <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed flex flex-col gap-1.5">
                        <p>
                            Bonjour <strong class="text-slate-900">${currentProfile?.prenom ? currentProfile.prenom : 'Cher marchand'}</strong>, votre mot de passe a été réinitialisé avec le code temporaire <code class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold">campus1234!</code>.
                        </p>
                        <p class="text-[11px] text-slate-500">
                            Pour protéger votre boutique, vos produits et vos paiements sur Campus Market, vous devez <strong>définir votre mot de passe personnel dès maintenant</strong>.
                        </p>
                    </div>

                    <!-- Zone d'erreur -->
                    <div id="force-pwd-error" class="hidden p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium"></div>

                    <form id="force-pwd-form" class="flex flex-col gap-3.5">
                        <!-- Nouveau mot de passe -->
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <label class="block text-xs font-semibold text-slate-700" for="force-new-password">Nouveau mot de passe *</label>
                                <button type="button" id="btn-toggle-show-pwd" class="text-[11px] text-slate-400 hover:text-slate-700 cursor-pointer flex items-center gap-1">
                                    <i class="fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}"></i>
                                    <span>${showPassword ? 'Masquer' : 'Afficher'}</span>
                                </button>
                            </div>
                            <div class="relative">
                                <input 
                                    type="${showPassword ? 'text' : 'password'}" 
                                    id="force-new-password" 
                                    required 
                                    minlength="6"
                                    placeholder="Minimum 6 caractères" 
                                    class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                                >
                            </div>
                            <p class="text-[10px] text-slate-400 mt-1">Au moins 6 caractères (différent de <code>campus1234!</code>)</p>
                        </div>

                        <!-- Confirmation -->
                        <div>
                            <label class="block text-xs font-semibold text-slate-700 mb-1" for="force-confirm-password">Confirmer le nouveau mot de passe *</label>
                            <input 
                                type="${showPassword ? 'text' : 'password'}" 
                                id="force-confirm-password" 
                                required 
                                minlength="6"
                                placeholder="Confirmez à l'identique" 
                                class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                            >
                        </div>

                        <!-- Boutons d'action -->
                        <div class="flex flex-col gap-2 pt-2">
                            <button 
                                type="submit" 
                                id="btn-force-pwd-submit"
                                class="w-full py-3.5 bg-primary hover:bg-primary-dark active:scale-[0.99] text-white font-heading font-bold text-sm rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer"
                            >
                                <i class="fa-solid fa-lock"></i>
                                <span>Valider mon nouveau mot de passe</span>
                            </button>

                            <button 
                                type="button" 
                                id="btn-force-pwd-logout" 
                                class="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors min-h-[40px] cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <i class="fa-solid fa-right-from-bracket text-[11px]"></i>
                                <span>Me déconnecter pour l'instant</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        bindEvents();
    }

    function bindEvents() {
        const errorEl = modalEl.querySelector('#force-pwd-error');
        const formEl = modalEl.querySelector('#force-pwd-form');
        const toggleBtn = modalEl.querySelector('#btn-toggle-show-pwd');
        const logoutBtn = modalEl.querySelector('#btn-force-pwd-logout');
        const submitBtn = modalEl.querySelector('#btn-force-pwd-submit');

        toggleBtn?.addEventListener('click', () => {
            showPassword = !showPassword;
            const newPwdInput = modalEl.querySelector('#force-new-password');
            const confirmPwdInput = modalEl.querySelector('#force-confirm-password');
            if (newPwdInput) newPwdInput.type = showPassword ? 'text' : 'password';
            if (confirmPwdInput) confirmPwdInput.type = showPassword ? 'text' : 'password';
            toggleBtn.innerHTML = `
                <i class="fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}"></i>
                <span>${showPassword ? 'Masquer' : 'Afficher'}</span>
            `;
        });

        logoutBtn?.addEventListener('click', async () => {
            close();
            try {
                await logoutSeller();
            } catch {}
            if (typeof onLogout === 'function') {
                onLogout();
            }
        });

        formEl?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = modalEl.querySelector('#force-new-password').value;
            const confirmPassword = modalEl.querySelector('#force-confirm-password').value;

            if (errorEl) errorEl.classList.add('hidden');

            if (newPassword === 'campus1234!') {
                if (errorEl) {
                    errorEl.textContent = 'Pour votre sécurité, vous ne pouvez pas conserver le mot de passe temporaire "campus1234!". Veuillez en choisir un autre.';
                    errorEl.classList.remove('hidden');
                }
                return;
            }

            if (newPassword !== confirmPassword) {
                if (errorEl) {
                    errorEl.textContent = 'Les deux mots de passe ne correspondent pas.';
                    errorEl.classList.remove('hidden');
                }
                return;
            }

            if (newPassword.length < 6) {
                if (errorEl) {
                    errorEl.textContent = 'Le mot de passe doit comporter au moins 6 caractères.';
                    errorEl.classList.remove('hidden');
                }
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Mise à jour sécurisée...`;
            }

            try {
                await changeSellerPassword({ newPassword, confirmPassword });
                close();
                if (currentProfile) {
                    currentProfile.must_change_password = false;
                }
                if (typeof onSuccess === 'function') {
                    onSuccess({ profile: currentProfile });
                }
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = err.message || 'Échec de modification du mot de passe.';
                    errorEl.classList.remove('hidden');
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = `<i class="fa-solid fa-lock"></i><span>Valider mon nouveau mot de passe</span>`;
                }
            }
        });
    }

    function open(profile = null) {
        currentProfile = profile;
        showPassword = false;
        render();
        modalEl.classList.remove('opacity-0', 'pointer-events-none');
        modalEl.classList.add('opacity-100');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        modalEl.classList.remove('opacity-100');
        modalEl.classList.add('opacity-0', 'pointer-events-none');
        document.body.style.overflow = '';
    }

    render();

    return {
        element: modalEl,
        open,
        close,
    };
}

export default createForcePasswordChangeModal;
