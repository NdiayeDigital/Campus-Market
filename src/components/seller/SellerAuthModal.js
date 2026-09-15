/**
 * Composant SellerAuthModal
 * Modal d'authentification pour les étudiants marchands (Connexion & Demande Vendeur).
 * Affiche un écran de révision si le compte est au statut 'vendeur_pending'.
 */

import { loginSeller, registerSeller } from '../../services/seller-service.js';
import { CATEGORIES } from '../../services/catalog-service.js';

/**
 * Crée le modal d'authentification marchand.
 * @param {Object} props
 * @param {Function} props.onAuthenticated - Callback lors d'une connexion réussie avec compte validé ({ user, profile })
 * @returns {Object} Contrôleur ({ element, open, close })
 */
export function createSellerAuthModal({ onAuthenticated } = {}) {
    const modalEl = document.createElement('div');
    modalEl.id = 'seller-auth-modal-overlay';
    modalEl.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-300';

    let activeTab = 'login'; // 'login' | 'register' | 'pending'

    function render() {
        modalEl.innerHTML = `
            <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <!-- En-tête -->
                <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                            <i class="fa-solid fa-store"></i>
                        </div>
                        <h2 class="font-heading font-bold text-slate-900 text-lg">Espace Vendeur UIDT</h2>
                    </div>
                    <button id="btn-close-seller-auth" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors min-h-[44px] min-w-[44px]">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                ${activeTab === 'pending' ? renderPendingScreen() : renderTabsAndForm()}
            </div>
        `;

        bindEvents();
    }

    function renderPendingScreen() {
        return `
            <div class="p-6 flex flex-col items-center text-center my-auto">
                <div class="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-3xl mb-4 animate-pulse">
                    <i class="fa-solid fa-hourglass-half"></i>
                </div>
                <h3 class="font-heading font-extrabold text-xl text-slate-900 mb-2">Demande en cours d'examen</h3>
                <p class="text-sm text-slate-600 mb-6 leading-relaxed">
                    Votre candidature pour ouvrir une boutique sur Campus Market a bien été transmise au Super Administrateur de l'UIDT.
                    <br><br>
                    Vous recevrez une confirmation sous <strong>24h à 48h</strong>.
                </p>
                <button id="btn-back-to-login" class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors min-h-[44px]">
                    Retour à la connexion
                </button>
            </div>
        `;
    }

    function renderTabsAndForm() {
        return `
            <!-- Onglets Connexion / Inscription -->
            <div class="flex border-b border-slate-200 bg-slate-50/50">
                <button id="tab-login" class="flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                    activeTab === 'login'
                        ? 'border-primary text-primary bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                }">
                    Se connecter
                </button>
                <button id="tab-register" class="flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                    activeTab === 'register'
                        ? 'border-primary text-primary bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                }">
                    Devenir Vendeur
                </button>
            </div>

            <!-- Formulaires -->
            <div class="p-6 overflow-y-auto">
                <div id="seller-auth-error" class="hidden mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium"></div>

                ${activeTab === 'login' ? renderLoginForm() : renderRegisterForm()}
            </div>
        `;
    }

    function renderLoginForm() {
        return `
            <form id="seller-login-form" class="flex flex-col gap-4">
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1" for="seller-email">Email institutionnel (@univ-thies.sn)</label>
                    <input 
                        type="email" 
                        id="seller-login-email" 
                        required 
                        placeholder="prenom.nom@univ-thies.sn" 
                        class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                    >
                </div>
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1" for="seller-password">Mot de passe</label>
                    <input 
                        type="password" 
                        id="seller-login-password" 
                        required 
                        placeholder="••••••••" 
                        class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                    >
                </div>

                <button 
                    type="submit" 
                    id="btn-seller-login-submit"
                    class="w-full mt-2 py-3.5 bg-primary hover:bg-primary-dark active:scale-[0.99] text-white font-heading font-bold text-sm rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 min-h-[48px]"
                >
                    <span>Accéder à mon tableau de bord</span>
                    <i class="fa-solid fa-arrow-right text-xs"></i>
                </button>
            </form>
        `;
    }

    function renderRegisterForm() {
        return `
            <form id="seller-register-form" class="flex flex-col gap-3.5">
                <div class="grid grid-cols-2 gap-2.5">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1" for="reg-prenom">Prénom *</label>
                        <input type="text" id="reg-prenom" required placeholder="Awa" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1" for="reg-nom">Nom *</label>
                        <input type="text" id="reg-nom" required placeholder="Diop" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1" for="reg-email">Email étudiant (@univ-thies.sn) *</label>
                    <input type="email" id="reg-email" required placeholder="etudiant@univ-thies.sn" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                </div>

                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1" for="reg-phone">Téléphone portable (Wave/OM) *</label>
                    <input type="tel" id="reg-phone" required placeholder="77 000 00 00" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                </div>

                <div class="grid grid-cols-2 gap-2.5">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1" for="reg-shop-name">Nom de boutique *</label>
                        <input type="text" id="reg-shop-name" required placeholder="Ex: Délices UIDT" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1" for="reg-category">Catégorie *</label>
                        <select id="reg-category" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                            ${CATEGORIES.filter((c) => c.id !== 'all').map((c) => `
                                <option value="${c.id}">${c.label}</option>
                            `).join('')}
                        </select>
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1" for="reg-password">Mot de passe (min 6 car.) *</label>
                    <input type="password" id="reg-password" required minlength="6" placeholder="••••••••" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                </div>

                <button 
                    type="submit" 
                    id="btn-seller-reg-submit"
                    class="w-full mt-2 py-3 bg-accent text-slate-900 hover:bg-amber-500 font-heading font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 min-h-[44px]"
                >
                    <i class="fa-solid fa-paper-plane"></i>
                    <span>Soumettre ma demande de vendeur</span>
                </button>
            </form>
        `;
    }

    function bindEvents() {
        modalEl.querySelector('#btn-close-seller-auth')?.addEventListener('click', close);
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) close();
        });

        // Bascule d'onglets
        modalEl.querySelector('#tab-login')?.addEventListener('click', () => {
            activeTab = 'login';
            render();
        });

        modalEl.querySelector('#tab-register')?.addEventListener('click', () => {
            activeTab = 'register';
            render();
        });

        modalEl.querySelector('#btn-back-to-login')?.addEventListener('click', () => {
            activeTab = 'login';
            render();
        });

        const errorEl = modalEl.querySelector('#seller-auth-error');

        // Soumission Connexion
        modalEl.querySelector('#seller-login-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = modalEl.querySelector('#seller-login-email').value;
            const password = modalEl.querySelector('#seller-login-password').value;
            const btn = modalEl.querySelector('#btn-seller-login-submit');

            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Connexion...`;
            if (errorEl) errorEl.classList.add('hidden');

            try {
                const res = await loginSeller({ email, password });
                if (res.status === 'pending') {
                    activeTab = 'pending';
                    render();
                } else if (res.status === 'approved') {
                    close();
                    if (typeof onAuthenticated === 'function') {
                        onAuthenticated({ user: res.user, profile: res.profile });
                    }
                }
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = err.message || 'Identifiants invalides.';
                    errorEl.classList.remove('hidden');
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = `<span>Accéder à mon tableau de bord</span><i class="fa-solid fa-arrow-right text-xs"></i>`;
            }
        });

        // Soumission Inscription
        modalEl.querySelector('#seller-register-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const prenom = modalEl.querySelector('#reg-prenom').value;
            const nom = modalEl.querySelector('#reg-nom').value;
            const email = modalEl.querySelector('#reg-email').value;
            const telephone = modalEl.querySelector('#reg-phone').value;
            const shopName = modalEl.querySelector('#reg-shop-name').value;
            const category = modalEl.querySelector('#reg-category').value;
            const password = modalEl.querySelector('#reg-password').value;
            const btn = modalEl.querySelector('#btn-seller-reg-submit');

            btn.disabled = true;
            btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Envoi en cours...`;
            if (errorEl) errorEl.classList.add('hidden');

            try {
                await registerSeller({
                    prenom,
                    nom,
                    email,
                    telephone,
                    shopName,
                    category,
                    password,
                });
                activeTab = 'pending';
                render();
            } catch (err) {
                if (errorEl) {
                    errorEl.textContent = err.message || "Erreur lors de l'enregistrement.";
                    errorEl.classList.remove('hidden');
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i><span>Soumettre ma demande de vendeur</span>`;
            }
        });
    }

    function open(defaultTab = 'login') {
        activeTab = defaultTab;
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

export default createSellerAuthModal;
