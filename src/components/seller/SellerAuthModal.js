/**
 * Composant SellerAuthModal
 * Modal d'authentification pour les étudiants marchands (Connexion & Demande Vendeur).
 * Affiche un écran de révision si le compte est au statut 'vendeur_pending'.
 */

import { loginSeller, registerSeller, verifySellerOtp, resendSellerOtp } from '../../services/seller-service.js';
import { CATEGORIES } from '../../services/catalog-service.js';
import { SUPPORT_CONFIG } from '../../config/support.js';
import { SUBSCRIPTION_PLANS } from '../../config/subscription.js';
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

    let activeTab = 'login'; // 'login' | 'terms' | 'register' | 'otp' | 'pending' | 'forgot-password'
    let selectedPlan = 'starter'; // 'starter' (1500 FCFA/mois - 5 produits) | 'pro' (2500 FCFA/mois - 10 produits)
    let pendingOtpEmail = '';
    let otpCooldown = 0;
    let otpTimer = null;

    function startOtpCooldown(seconds = 60) {
        if (otpTimer) clearInterval(otpTimer);
        otpCooldown = seconds;
        updateOtpResendButton();
        otpTimer = setInterval(() => {
            otpCooldown--;
            if (otpCooldown <= 0) {
                clearInterval(otpTimer);
                otpTimer = null;
            }
            updateOtpResendButton();
        }, 1000);
    }

    function updateOtpResendButton() {
        const resendBtn = modalEl.querySelector('#btn-seller-otp-resend');
        if (!resendBtn) return;
        if (otpCooldown > 0) {
            resendBtn.disabled = true;
            resendBtn.classList.add('opacity-50', 'cursor-not-allowed');
            resendBtn.classList.remove('hover:underline', 'text-primary');
            resendBtn.classList.add('text-slate-400');
            resendBtn.innerHTML = `<i class="fa-regular fa-clock mr-1"></i>Renvoyer (${otpCooldown}s)`;
        } else {
            resendBtn.disabled = false;
            resendBtn.classList.remove('opacity-50', 'cursor-not-allowed', 'text-slate-400');
            resendBtn.classList.add('hover:underline', 'text-primary');
            resendBtn.innerHTML = `<i class="fa-solid fa-rotate-right mr-1"></i>Renvoyer un nouveau code`;
        }
    }

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

                ${activeTab === 'pending' 
                    ? renderPendingScreen() 
                    : (activeTab === 'otp' 
                        ? renderOtpScreen() 
                        : (activeTab === 'terms' 
                            ? renderTermsScreen() 
                            : (activeTab === 'forgot-password' 
                                ? renderForgotPasswordScreen() 
                                : renderTabsAndForm())))}
            </div>
        `;

        bindEvents();
    }

    function renderPendingScreen() {
        const planLabel = selectedPlan === 'pro' 
            ? 'Pack Pro (10 produits max • 2 500 FCFA/mois)' 
            : 'Pack Starter (5 produits max • 1 500 FCFA/mois)';

        return `
            <div class="p-6 flex flex-col items-center text-center my-auto overflow-y-auto">
                <div class="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center text-3xl mb-4 animate-pulse">
                    <i class="fa-solid fa-hourglass-half"></i>
                </div>
                <h3 class="font-heading font-extrabold text-xl text-slate-900 mb-2">Demande en cours d'examen</h3>
                <div class="mb-4 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700">
                    <span class="text-slate-400 text-[10px] uppercase font-bold block">Formule sélectionnée</span>
                    <strong class="text-slate-900">${planLabel}</strong>
                </div>
                <p class="text-xs text-slate-600 mb-4 leading-relaxed">
                    Votre candidature pour ouvrir une boutique sur Campus Market a bien été transmise au Super Administrateur de l'UIDT.
                    <br><br>
                    Vous recevrez une confirmation sous <strong>24h à 48h</strong>.
                </p>

                <div class="w-full mb-5 p-3 rounded-xl bg-blue-50/70 border border-blue-100 flex flex-col gap-2 text-left">
                    <span class="text-[10px] font-bold text-blue-900 uppercase flex items-center gap-1.5">
                        <i class="fa-solid fa-headset text-blue-600"></i> Support & Assistance
                    </span>
                    <p class="text-[11px] text-slate-600">
                        Une question sur votre dossier ? Contactez directement notre équipe au <strong>${SUPPORT_CONFIG.phoneDisplay}</strong>.
                    </p>
                    <a 
                        href="${SUPPORT_CONFIG.whatsappUrl}" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        class="inline-flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer min-h-[38px]"
                    >
                        <i class="fa-brands fa-whatsapp text-sm"></i>
                        <span>Assistance WhatsApp (${SUPPORT_CONFIG.phoneDisplay})</span>
                    </a>
                </div>

                <button id="btn-back-to-login" class="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition-colors min-h-[44px] cursor-pointer">
                    Retour à la connexion
                </button>
            </div>
        `;
    }

    function renderOtpScreen() {
        return `
            <div class="p-6 flex flex-col items-center text-center my-auto overflow-y-auto">
                <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-3xl mb-3 shadow-xs">
                    <i class="fa-solid fa-envelope-circle-check"></i>
                </div>
                <h3 class="font-heading font-extrabold text-xl text-slate-900 mb-1">Vérification de votre compte</h3>
                <p class="text-xs text-slate-600 mb-2 leading-relaxed">
                    Un code de confirmation à <strong>6 chiffres</strong> vous a été envoyé par email à l'adresse :
                </p>
                <div class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-800 mb-4 max-w-full truncate">
                    <i class="fa-solid fa-at text-primary text-xs"></i>
                    <span class="truncate">${pendingOtpEmail || 'votre email institutionnel'}</span>
                </div>

                <div id="seller-otp-error" class="hidden w-full mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium text-left"></div>
                <div id="seller-otp-success" class="hidden w-full mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700 font-medium text-left"></div>

                <form id="seller-otp-form" class="w-full flex flex-col gap-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wider" for="seller-otp-input">
                            Code de confirmation (6 chiffres)
                        </label>
                        <input 
                            type="text" 
                            id="seller-otp-input" 
                            name="token"
                            required 
                            maxlength="6"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            autocomplete="one-time-code"
                            placeholder="••••••" 
                            class="w-full text-center text-2xl font-mono font-extrabold tracking-[0.5em] px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all placeholder:text-slate-300"
                            autofocus
                        >
                    </div>

                    <button 
                        type="submit" 
                        id="btn-seller-otp-submit"
                        class="w-full py-3.5 bg-primary hover:bg-primary-dark active:scale-[0.99] text-white font-heading font-bold text-sm rounded-xl shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 min-h-[48px] cursor-pointer"
                    >
                        <i class="fa-solid fa-circle-check"></i>
                        <span>Confirmer et ouvrir ma boutique</span>
                    </button>
                </form>

                <div class="w-full mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2.5">
                    <div class="flex items-center justify-between text-xs">
                        <span class="text-slate-500">Vous n'avez rien reçu ?</span>
                        <button 
                            type="button" 
                            id="btn-seller-otp-resend" 
                            class="font-bold text-primary hover:underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            ${otpCooldown > 0 ? 'disabled' : ''}
                        >
                            ${otpCooldown > 0 
                                ? `<i class="fa-regular fa-clock mr-1"></i>Renvoyer (${otpCooldown}s)` 
                                : `<i class="fa-solid fa-rotate-right mr-1"></i>Renvoyer un nouveau code`}
                        </button>
                    </div>

                    <p class="text-[11px] text-slate-400 text-left leading-relaxed">
                        <i class="fa-solid fa-lightbulb text-amber-500 mr-1"></i>
                        Pensez à vérifier vos courriers indésirables (Spam) si le code tarde à arriver.
                    </p>

                    <button 
                        type="button" 
                        id="btn-seller-otp-back" 
                        class="mt-1 py-2 text-xs text-slate-500 hover:text-slate-800 font-semibold cursor-pointer text-center hover:underline"
                    >
                        ← Modifier mon adresse email ou retourner
                    </button>
                </div>
            </div>
        `;
    }

    function renderForgotPasswordScreen() {
        return `
            <div class="p-6 flex flex-col items-center text-center my-auto overflow-y-auto">
                <div class="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl mb-3 shadow-xs animate-bounce-subtle">
                    <i class="fa-solid fa-key"></i>
                </div>
                <h3 class="font-heading font-extrabold text-lg text-slate-900 mb-1.5">Récupération de mot de passe</h3>
                <p class="text-xs text-slate-600 mb-4 leading-relaxed max-w-sm">
                    Pour garantir la sécurité et vérifier l'identité étudiante à l'UIDT, la réinitialisation de mot de passe est effectuée directement auprès de notre assistance.
                </p>

                <!-- Encadré explicatif de la procédure -->
                <div class="w-full mb-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-700 flex flex-col gap-2">
                    <span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider flex items-center gap-1.5">
                        <i class="fa-solid fa-shield-halved text-primary"></i> Procédure sécurisée :
                    </span>
                    <ol class="list-decimal list-inside flex flex-col gap-1.5 text-[11px] text-slate-600">
                        <li>Contactez l'assistance par <strong>WhatsApp</strong> ou par <strong>Email</strong>.</li>
                        <li>L'administrateur réinitialisera votre compte avec le mot de passe temporaire <code class="px-1.5 py-0.5 bg-amber-100 text-amber-900 font-bold rounded">campus1234!</code>.</li>
                        <li>Dès votre connexion avec ce code, vous serez <strong>obligé de définir votre mot de passe personnel</strong>.</li>
                    </ol>
                </div>

                <!-- Boutons d'action : WhatsApp et Email -->
                <div class="w-full flex flex-col gap-2.5 mb-4">
                    <a 
                        href="${SUPPORT_CONFIG.whatsappResetUrl}" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                    >
                        <i class="fa-brands fa-whatsapp text-base"></i>
                        <span>Assistance WhatsApp (${SUPPORT_CONFIG.phoneDisplay})</span>
                    </a>

                    <a 
                        href="${SUPPORT_CONFIG.mailResetUrl}" 
                        class="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                    >
                        <i class="fa-solid fa-envelope text-sm"></i>
                        <span>Assistance Email (${SUPPORT_CONFIG.email})</span>
                    </a>
                </div>

                <button id="btn-forgot-back-to-login" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors min-h-[40px] cursor-pointer">
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

                <!-- Offre de bienvenue Free Tier -->
                <div class="bg-emerald-50 rounded-2xl border border-emerald-200/90 p-3.5 flex items-start gap-3">
                    <div class="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm shrink-0 mt-0.5 shadow-xs">
                        <i class="fa-solid fa-gift"></i>
                    </div>
                    <div>
                        <span class="font-heading font-extrabold text-xs text-emerald-950 block">🎉 7 Jours d'essai 100% GRATUIT</span>
                        <p class="text-[11px] text-emerald-800 leading-snug mt-0.5">
                            Dès validation de votre candidature, profitez de <strong>7 jours d'essai offerts (3 articles inclus)</strong> pour tester la vente sans aucun frais initial.
                        </p>
                    </div>
                </div>

                <!-- Formules d'abonnement -->
                <div class="flex flex-col gap-2.5">
                    <div class="flex items-center justify-between">
                        <h4 class="font-heading font-bold text-xs text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                            <i class="fa-solid fa-crown text-amber-500 text-xs"></i>
                            <span>Formules d'abonnement post-essai</span>
                        </h4>
                        <span class="text-[10px] text-slate-400 font-semibold">Tarifs transparents</span>
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
                                <span class="text-[11px] text-slate-500">Catalogue de 5 produits</span>
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
                                <span class="text-[11px] text-slate-500">Catalogue de 10 produits & stats avancées</span>
                            </div>
                        </div>
                        <div class="text-right shrink-0">
                            <span class="font-heading font-extrabold text-base text-slate-900 tabular-nums">2 500</span>
                            <span class="text-[10px] font-bold text-slate-500 block leading-none">FCFA / mois</span>
                        </div>
                    </div>
                </div>

                <!-- Information Paiement SasPay Wave & OM -->
                <div class="bg-sky-50/70 rounded-2xl border border-sky-200/90 p-3 flex items-start gap-2.5">
                    <div class="w-7 h-7 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center text-xs shrink-0 mt-0.5">
                        <i class="fa-solid fa-mobile-screen"></i>
                    </div>
                    <div>
                        <span class="font-heading font-bold text-xs text-sky-950 block">Paiement Mobile Wave & Orange Money</span>
                        <p class="text-[11px] text-sky-800 leading-snug mt-0.5">
                            Aucun paiement immédiat n'est requis aujourd'hui. Vos 7 jours d'essai démarrent gratuitement. Vous choisirez ensuite votre opérateur (Wave ou OM) pour vous abonner.
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
                    <div class="flex items-center justify-between mb-1">
                        <label class="block text-xs font-semibold text-slate-700" for="seller-login-password">Mot de passe</label>
                        <button type="button" id="btn-to-forgot-password" class="text-[11px] text-primary hover:underline font-semibold cursor-pointer">
                            Mot de passe oublié ?
                        </button>
                    </div>
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
                            <span class="text-slate-500 text-[10px] block leading-none">Formule choisie (Essai 7j inclus)</span>
                            <span class="text-slate-800 font-bold text-xs truncate">
                                ${selectedPlan === 'pro' 
                                    ? 'Pack Pro (2 500 FCFA/mois — 10 produits)' 
                                    : 'Pack Starter (1 500 FCFA/mois — 5 produits)'}
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

        modalEl.querySelector('#btn-to-forgot-password')?.addEventListener('click', () => {
            activeTab = 'forgot-password';
            render();
        });

        modalEl.querySelector('#btn-forgot-back-to-login')?.addEventListener('click', () => {
            activeTab = 'login';
            render();
        });

        // 3. Événements de l'écran OTP (Vérification email Brevo)
        if (activeTab === 'otp') {
            const otpForm = modalEl.querySelector('#seller-otp-form');
            const otpInput = modalEl.querySelector('#seller-otp-input');
            const otpSubmitBtn = modalEl.querySelector('#btn-seller-otp-submit');
            const otpResendBtn = modalEl.querySelector('#btn-seller-otp-resend');
            const otpBackBtn = modalEl.querySelector('#btn-seller-otp-back');
            const otpErrorEl = modalEl.querySelector('#seller-otp-error');
            const otpSuccessEl = modalEl.querySelector('#seller-otp-success');

            // Focus automatique sur le champ OTP
            setTimeout(() => {
                otpInput?.focus();
            }, 100);

            // Filtrer les entrées pour n'accepter que les chiffres
            otpInput?.addEventListener('input', (e) => {
                const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
                e.target.value = clean;
            });

            // Soumission OTP
            otpForm?.addEventListener('submit', async (e) => {
                e.preventDefault();
                const token = otpInput?.value.trim();
                if (!token || token.length !== 6) {
                    if (otpErrorEl) {
                        otpErrorEl.textContent = 'Veuillez saisir le code complet à 6 chiffres.';
                        otpErrorEl.classList.remove('hidden');
                    }
                    return;
                }

                otpSubmitBtn.disabled = true;
                otpSubmitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Validation du code...`;
                if (otpErrorEl) otpErrorEl.classList.add('hidden');
                if (otpSuccessEl) otpSuccessEl.classList.add('hidden');

                try {
                    const res = await verifySellerOtp({
                        email: pendingOtpEmail,
                        token,
                    });

                    if (otpTimer) {
                        clearInterval(otpTimer);
                        otpTimer = null;
                    }

                    close();
                    if (typeof onAuthenticated === 'function') {
                        onAuthenticated({
                            user: res.user,
                            profile: res.profile,
                            mustChangePassword: false,
                        });
                    }
                } catch (err) {
                    if (otpErrorEl) {
                        otpErrorEl.textContent = err.message || 'Code de confirmation incorrect.';
                        otpErrorEl.classList.remove('hidden');
                    }
                } finally {
                    otpSubmitBtn.disabled = false;
                    otpSubmitBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i><span>Confirmer et ouvrir ma boutique</span>`;
                }
            });

            // Renvoi du code OTP
            otpResendBtn?.addEventListener('click', async () => {
                if (otpCooldown > 0) return;
                otpResendBtn.disabled = true;
                if (otpErrorEl) otpErrorEl.classList.add('hidden');

                try {
                    await resendSellerOtp(pendingOtpEmail);
                    if (otpSuccessEl) {
                        otpSuccessEl.textContent = 'Un nouveau code de confirmation a été envoyé sur votre email.';
                        otpSuccessEl.classList.remove('hidden');
                    }
                    startOtpCooldown(60);
                } catch (err) {
                    if (otpErrorEl) {
                        otpErrorEl.textContent = err.message || 'Erreur lors du renvoi du code.';
                        otpErrorEl.classList.remove('hidden');
                    }
                    otpResendBtn.disabled = false;
                }
            });

            // Retour à l'inscription
            otpBackBtn?.addEventListener('click', () => {
                if (otpTimer) {
                    clearInterval(otpTimer);
                    otpTimer = null;
                }
                activeTab = 'register';
                render();
            });
        }

        const errorEl = modalEl.querySelector('#seller-auth-error');

        // 4. Soumission Connexion
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
                } else if (res.status === 'needs_confirmation') {
                    pendingOtpEmail = res.email || email;
                    activeTab = 'otp';
                    render();
                    startOtpCooldown(60);
                } else if (res.status === 'suspended') {
                    close();
                    if (typeof onAuthenticated === 'function') {
                        onAuthenticated({ user: res.user, profile: res.profile, isSuspended: true });
                    }
                } else if (res.status === 'approved') {
                    close();
                    if (typeof onAuthenticated === 'function') {
                        onAuthenticated({
                            user: res.user,
                            profile: res.profile,
                            mustChangePassword: res.mustChangePassword === true || res.profile?.must_change_password === true,
                        });
                    }
                } else if (res.status === 'unauthorized') {
                    if (errorEl) {
                        errorEl.textContent = "Ce compte est un profil étudiant acheteur. Pour ouvrir votre boutique, veuillez soumettre votre candidature via l'onglet 'Créer ma boutique'.";
                        errorEl.classList.remove('hidden');
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

        // 5. Soumission Inscription
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
                const regRes = await registerSeller({
                    prenom,
                    nom,
                    email,
                    telephone,
                    shopName,
                    category,
                    password,
                    plan: selectedPlan,
                });
                if (regRes?.status === 'approved') {
                    close();
                    if (typeof onAuthenticated === 'function') {
                        onAuthenticated({ user: regRes.user, profile: regRes.profile });
                    }
                } else {
                    pendingOtpEmail = email;
                    activeTab = 'otp';
                    render();
                    startOtpCooldown(60);
                }
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
        if (otpTimer) {
            clearInterval(otpTimer);
            otpTimer = null;
        }
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
