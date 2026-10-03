/**
 * Composant SellerAuthModal
 * Modal d'authentification pour les étudiants marchands (Connexion & Demande Vendeur).
 * Affiche un écran de révision si le compte est au statut 'vendeur_pending'.
 */

import { loginSeller, registerSeller } from '../../services/seller-service.js';
import { CATEGORIES } from '../../services/catalog-service.js';
import logoUrl from '../../assets/logo.webp';

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

    let activeTab = 'login'; // 'login' | 'terms' | 'register' | 'pending'
    let selectedPlan = 'starter'; // 'starter' (1500 FCFA/mois - 5 produits) | 'pro' (2500 FCFA/mois - 10 produits)

    function render() {
        modalEl.innerHTML = `
            <div class="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
                <!-- En-tête -->
                <div class="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
                    <div class="flex items-center gap-2.5">
                        <img src="${logoUrl}" alt="Campus Market" class="h-9 w-auto max-w-[140px] object-contain">
                        <div>
                            <h2 class="font-heading font-bold text-slate-900 text-base leading-tight">Espace Vendeur</h2>
                            <span class="text-[10px] text-slate-400 font-medium">UIDT Thiès</span>
                        </div>
                    </div>
                    <button id="btn-close-seller-auth" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors min-h-[44px] min-w-[44px] cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                ${activeTab === 'pending' ? renderPendingScreen() : (activeTab === 'terms' ? renderTermsScreen() : renderTabsAndForm())}
            </div>
        `;

        bindEvents();
    }

    function renderPendingScreen() {
        return `
            <div class="p-6 flex flex-col items-center text-center my-auto overflow-y-auto">
                <div class="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-3xl mb-4 animate-pulse">
                    <i class="fa-solid fa-hourglass-half"></i>
                </div>
                <h3 class="font-heading font-extrabold text-xl text-slate-900 mb-2">Demande en cours d'examen</h3>
                <p class="text-sm text-slate-600 mb-6 leading-relaxed">
                    Votre candidature pour ouvrir une boutique sur Campus Market a bien été transmise au Super Administrateur de l'UIDT.
                    <br><br>
                    Vous recevrez une confirmation sous <strong>24h à 48h</strong>.
                </p>
                <button id="btn-back-to-login" class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors min-h-[44px] cursor-pointer">
                    Retour à la connexion
                </button>
            </div>
        `;
    }

    function renderTermsScreen() {
        return `
            <div class="p-5 sm:p-6 overflow-y-auto flex flex-col gap-4 text-slate-900">
                <div class="text-center">
                    <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-xl mx-auto mb-2">
                        <i class="fa-solid fa-handshake"></i>
                    </div>
                    <h3 class="font-heading font-extrabold text-base sm:text-lg text-slate-900 leading-tight">Conditions & Formules d'Adhésion</h3>
                    <p class="text-xs text-slate-500 mt-1">Rejoignez la première marketplace étudiante de l'UIDT</p>
                </div>

                <!-- Conditions essentielles -->
                <div class="bg-slate-50 rounded-2xl border border-slate-200/80 p-3.5 flex flex-col gap-2">
                    <h4 class="font-heading font-bold text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                        <i class="fa-solid fa-scroll text-primary text-xs"></i>
                        <span>Modalités pour devenir vendeur</span>
                    </h4>
                    <ul class="flex flex-col gap-1.5 text-xs text-slate-600 leading-snug">
                        <li class="flex items-start gap-2">
                            <i class="fa-solid fa-check text-emerald-600 text-[11px] mt-0.5 shrink-0"></i>
                            <span>Être <strong>étudiant inscrit</strong> à l'Université Iba Der Thiam de Thiès.</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <i class="fa-solid fa-check text-emerald-600 text-[11px] mt-0.5 shrink-0"></i>
                            <span>Email étudiant institutionnel <strong>@univ-thies.sn</strong> obligatoire.</span>
                        </li>
                        <li class="flex items-start gap-2">
                            <i class="fa-solid fa-check text-emerald-600 text-[11px] mt-0.5 shrink-0"></i>
                            <span>Examen et validation de votre dossier sous <strong>24h à 48h</strong> par l'administration.</span>
                        </li>
                    </ul>
                </div>

                <!-- Formules d'abonnement -->
                <div class="flex flex-col gap-2.5">
                    <div class="flex items-center justify-between">
                        <h4 class="font-heading font-bold text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                            <i class="fa-solid fa-crown text-amber-500 text-xs"></i>
                            <span>Tarifs d'abonnement</span>
                        </h4>
                        <span class="text-[10px] text-slate-400 font-semibold">Mensuel</span>
                    </div>

                    <!-- Option Starter -->
                    <div 
                        id="plan-option-starter" 
                        class="p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                            selectedPlan === 'starter' 
                                ? 'border-primary bg-primary/5 shadow-xs' 
                                : 'border-slate-200 bg-white hover:border-slate-300'
                        }"
                    >
                        <div class="flex items-center gap-3">
                            <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                selectedPlan === 'starter' ? 'border-primary' : 'border-slate-300'
                            }">
                                ${selectedPlan === 'starter' ? '<span class="w-2.5 h-2.5 rounded-full bg-primary"></span>' : ''}
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="font-heading font-extrabold text-sm text-slate-900">Pack Starter</span>
                                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">5 produits</span>
                                </div>
                                <span class="text-[11px] text-slate-500">Catalogue de 5 produits par mois</span>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <span class="font-heading font-extrabold text-base text-primary tabular-nums">1 500</span>
                            <span class="text-[10px] font-bold text-slate-500 block leading-none">FCFA / mois</span>
                        </div>
                    </div>

                    <!-- Option Pro -->
                    <div 
                        id="plan-option-pro" 
                        class="p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 relative overflow-hidden ${
                            selectedPlan === 'pro' 
                                ? 'border-amber-400 bg-amber-50/50 shadow-xs' 
                                : 'border-slate-200 bg-white hover:border-slate-300'
                        }"
                    >
                        <div class="flex items-center gap-3">
                            <div class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                                selectedPlan === 'pro' ? 'border-amber-500' : 'border-slate-300'
                            }">
                                ${selectedPlan === 'pro' ? '<span class="w-2.5 h-2.5 rounded-full bg-amber-500"></span>' : ''}
                            </div>
                            <div>
                                <div class="flex items-center gap-2">
                                    <span class="font-heading font-extrabold text-sm text-slate-900">Pack Pro</span>
                                    <span class="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">10 produits</span>
                                </div>
                                <span class="text-[11px] text-slate-500">Catalogue de 10 produits par mois</span>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <span class="font-heading font-extrabold text-base text-slate-900 tabular-nums">2 500</span>
                            <span class="text-[10px] font-bold text-slate-500 block leading-none">FCFA / mois</span>
                        </div>
                    </div>
                </div>

                <!-- Garantie 100% Remboursé -->
                <div class="bg-emerald-50 rounded-2xl border border-emerald-200/90 p-3 flex items-start gap-2.5">
                    <div class="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs shrink-0 mt-0.5">
                        <i class="fa-solid fa-shield-heart"></i>
                    </div>
                    <div>
                        <span class="font-heading font-bold text-xs text-emerald-900 block">Garantie 100% Remboursé</span>
                        <p class="text-[11px] text-emerald-800 leading-snug mt-0.5">
                            La souscription à un abonnement est demandée avant votre demande d'adhésion. 
                            <strong>Si votre demande est annulée ou rejetée par l'administration</strong>, 
                            la <strong>totalité de la somme vous sera intégralement remboursée</strong> sans aucun frais.
                        </p>
                    </div>
                </div>

                <!-- Case à cocher d'acceptation -->
                <label class="flex items-start gap-2.5 cursor-pointer pt-1 group">
                    <input 
                        type="checkbox" 
                        id="terms-checkbox" 
                        class="mt-0.5 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/20 cursor-pointer"
                    >
                    <span class="text-xs text-slate-700 leading-tight group-hover:text-slate-900 select-none">
                        J'ai lu et j'accepte les <strong>modalités pour devenir vendeur</strong> et je confirme ma souscription à la formule sélectionnée.
                    </span>
                </label>

                <!-- Boutons d'action -->
                <div class="flex flex-col gap-2 pt-1">
                    <button 
                        type="button" 
                        id="btn-proceed-to-register" 
                        disabled
                        class="w-full py-3.5 bg-primary text-white font-heading font-bold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 min-h-[46px] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-95"
                    >
                        <span>Continuer vers ma demande</span>
                        <i class="fa-solid fa-arrow-right text-xs"></i>
                    </button>

                    <button 
                        type="button" 
                        id="btn-terms-back-login" 
                        class="w-full py-2.5 text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors min-h-[40px] cursor-pointer"
                    >
                        Déjà un compte ? Se connecter
                    </button>
                </div>
            </div>
        `;
    }

    function renderTabsAndForm() {
        return `
            <!-- Onglets Connexion / Inscription -->
            <div class="flex border-b border-slate-200 bg-slate-50/50 shrink-0">
                <button id="tab-login" class="flex-1 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    activeTab === 'login'
                        ? 'border-primary text-primary bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                }">
                    Se connecter
                </button>
                <button id="tab-register" class="flex-1 py-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                    activeTab === 'register' || activeTab === 'terms'
                        ? 'border-primary text-primary bg-white'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                }">
                    Devenir Vendeur
                </button>
            </div>

            <!-- Formulaires -->
            <div class="p-5 sm:p-6 overflow-y-auto">
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
                <!-- Récapitulatif de la formule sélectionnée -->
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-2.5 h-2.5 rounded-full shrink-0 ${selectedPlan === 'pro' ? 'bg-amber-400' : 'bg-primary'}"></span>
                        <div class="truncate">
                            <span class="text-slate-500 text-[10px] block leading-none">Formule choisie</span>
                            <span class="text-slate-800 font-bold text-xs truncate">
                                ${selectedPlan === 'pro' ? 'Pack Pro (2 500 FCFA/mois — 10 produits)' : 'Pack Starter (1 500 FCFA/mois — 5 produits)'}
                            </span>
                        </div>
                    </div>
                    <button type="button" id="btn-change-selected-plan" class="text-primary font-bold hover:underline shrink-0 text-xs ml-2 cursor-pointer">
                        Changer
                    </button>
                </div>

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
                        <select id="reg-category" required class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer">
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
                    class="w-full mt-2 py-3 bg-accent text-slate-900 hover:bg-amber-500 font-heading font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 min-h-[44px] cursor-pointer active:scale-95"
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

        // 1. Événements de l'écran Modalités & Conditions (terms)
        if (activeTab === 'terms') {
            const planStarter = modalEl.querySelector('#plan-option-starter');
            const planPro = modalEl.querySelector('#plan-option-pro');
            const checkbox = modalEl.querySelector('#terms-checkbox');
            const proceedBtn = modalEl.querySelector('#btn-proceed-to-register');
            const backLoginBtn = modalEl.querySelector('#btn-terms-back-login');

            planStarter?.addEventListener('click', () => {
                selectedPlan = 'starter';
                render();
            });

            planPro?.addEventListener('click', () => {
                selectedPlan = 'pro';
                render();
            });

            checkbox?.addEventListener('change', (e) => {
                if (proceedBtn) {
                    proceedBtn.disabled = !e.target.checked;
                }
            });

            proceedBtn?.addEventListener('click', () => {
                activeTab = 'register';
                render();
            });

            backLoginBtn?.addEventListener('click', () => {
                activeTab = 'login';
                render();
            });
        }

        // 2. Bascule d'onglets
        modalEl.querySelector('#tab-login')?.addEventListener('click', () => {
            activeTab = 'login';
            render();
        });

        modalEl.querySelector('#tab-register')?.addEventListener('click', () => {
            activeTab = 'terms';
            render();
        });

        modalEl.querySelector('#btn-change-selected-plan')?.addEventListener('click', () => {
            activeTab = 'terms';
            render();
        });

        modalEl.querySelector('#btn-back-to-login')?.addEventListener('click', () => {
            activeTab = 'login';
            render();
        });

        const errorEl = modalEl.querySelector('#seller-auth-error');

        // 3. Soumission Connexion
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
                } else if (res.status === 'suspended') {
                    close();
                    if (typeof onAuthenticated === 'function') {
                        onAuthenticated({ user: res.user, profile: res.profile, isSuspended: true });
                    }
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

        // 4. Soumission Inscription
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
                    plan: selectedPlan,
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
