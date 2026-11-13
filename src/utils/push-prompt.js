/**
 * Utilitaire d'invitation aux notifications Push (Campus Market)
 * Propose poliment aux étudiants et visiteurs d'activer les notifications push
 * pour recevoir les alertes de bons plans et annonces du campus.
 * Respecte les préférences utilisateur avec un délai de 7 jours après rejet.
 */

import { isNotificationSupported, getNotificationPermission, subscribePlatformPush } from './background-notifications.js';
import { showToast } from './notifications.js';

const DISMISSED_KEY = 'campus_push_dismissed_until';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

let bannerEl = null;

/**
 * Initialise l'invitation aux notifications push si le terminal est éligible.
 * Si la permission est déjà accordée, met à jour silencieusement l'abonnement.
 */
export function initPushNotificationPrompt() {
    if (!isNotificationSupported()) return;

    const currentPermission = getNotificationPermission();

    // 1. Si déjà accordé, synchroniser silencieusement en arrière-plan
    if (currentPermission === 'granted') {
        subscribePlatformPush().catch(() => {});
        return;
    }

    // 2. Si bloqué explicitement par l'utilisateur, ne rien demander
    if (currentPermission === 'denied') {
        return;
    }

    // 3. Vérifier le délai de grâce (7 jours après un refus)
    try {
        const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
        if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
            return;
        }
    } catch {
        // Ignorer si localStorage indisponible
    }

    // Afficher après un délai d'engagement de 8 secondes
    setTimeout(() => {
        showPushPromptBanner();
    }, 8000);
}

/**
 * Affiche la bannière d'invitation aux alertes push.
 */
function showPushPromptBanner() {
    if (getNotificationPermission() !== 'default') return;
    if (bannerEl && document.body?.contains(bannerEl)) return;

    bannerEl = document.createElement('aside');
    bannerEl.id = 'push-prompt-banner';
    bannerEl.setAttribute('aria-label', 'Activer les alertes notifications Campus Market');
    bannerEl.className = 'fixed bottom-24 lg:bottom-6 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-40 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl p-3.5 flex items-center justify-between gap-3 transform translate-y-8 opacity-0 transition-all duration-300 animate-in mb-safe';

    bannerEl.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-primary text-base flex-shrink-0">
                <i class="fa-solid fa-bell animate-bounce"></i>
            </div>
            <div class="flex flex-col min-w-0">
                <span class="font-heading font-extrabold text-xs sm:text-sm text-slate-900 leading-tight truncate">
                    Bons plans & Repas en chambre
                </span>
                <span class="text-[11px] text-slate-500 font-medium leading-tight truncate">
                    Activez les alertes pour ne rater aucun arrivage
                </span>
            </div>
        </div>

        <div class="flex items-center gap-1.5 flex-shrink-0">
            <button 
                type="button" 
                id="btn-push-prompt-accept"
                class="px-3.5 py-2 bg-primary hover:bg-primary-hover active:scale-95 text-white font-heading font-bold text-xs rounded-xl shadow-xs transition-all min-h-[38px] cursor-pointer"
            >
                Activer
            </button>
            <button 
                type="button" 
                id="btn-push-prompt-dismiss" 
                aria-label="Plus tard" 
                title="Plus tard"
                class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors min-h-[38px] min-w-[38px] cursor-pointer"
            >
                <i class="fa-solid fa-xmark text-sm"></i>
            </button>
        </div>
    `;

    document.body.appendChild(bannerEl);

    // Animation d'apparition
    requestAnimationFrame(() => {
        bannerEl.classList.remove('translate-y-8', 'opacity-0');
        bannerEl.classList.add('translate-y-0', 'opacity-100');
    });

    // Clic Activer
    bannerEl.querySelector('#btn-push-prompt-accept')?.addEventListener('click', async () => {
        dismissBanner();
        try {
            const success = await subscribePlatformPush({ role: 'visitor' });
            if (success) {
                showToast('🔔 Notifications activées ! Vous recevrez nos meilleures alertes.', 'success');
            }
        } catch {
            // Ignorer
        }
    });

    // Clic Fermer (Plus tard)
    bannerEl.querySelector('#btn-push-prompt-dismiss')?.addEventListener('click', () => {
        try {
            localStorage.setItem(DISMISSED_KEY, (Date.now() + SEVEN_DAYS_MS).toString());
        } catch {}
        dismissBanner();
    });
}

function dismissBanner() {
    if (!bannerEl || !document.body?.contains(bannerEl)) return;
    bannerEl.classList.remove('translate-y-0', 'opacity-100');
    bannerEl.classList.add('translate-y-8', 'opacity-0');
    setTimeout(() => {
        bannerEl?.remove();
        bannerEl = null;
    }, 300);
}
