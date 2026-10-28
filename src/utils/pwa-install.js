/**
 * Utilitaire d'installation PWA (Add to Home Screen)
 * Capture discrètement l'événement 'beforeinstallprompt' et affiche une bannière
 * non intrusive avec mémorisation du rejet pendant 7 jours.
 */

const LOGO_URL = '/assets/logo.webp';
const DISMISSED_KEY = 'campus_pwa_dismissed_until';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

let deferredPrompt = null;
let bannerEl = null;

/**
 * Vérifie si l'application est déjà exécutée en mode Standalone (PWA installée).
 * @returns {boolean}
 */
export function isAppInstalled() {
    if (typeof window === 'undefined') return false;
    return (
        window.matchMedia?.('(display-mode: standalone)').matches === true ||
        window.navigator.standalone === true ||
        localStorage.getItem('campus_pwa_installed') === 'true'
    );
}

/**
 * Affiche la bannière d'installation PWA si les conditions sont réunies.
 */
function showInstallBanner() {
    if (!deferredPrompt || isAppInstalled()) return;

    // Vérifie le délai de grâce après fermeture (7 jours)
    try {
        const dismissedUntil = localStorage.getItem(DISMISSED_KEY);
        if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
            return;
        }
    } catch {
        // Ignorer si localStorage inaccessible
    }

    if (bannerEl && document.body.contains(bannerEl)) return;

    bannerEl = document.createElement('aside');
    bannerEl.id = 'pwa-install-banner';
    bannerEl.setAttribute('aria-label', 'Installation de l\'application Campus Market');
    bannerEl.className = 'fixed bottom-20 lg:bottom-6 right-3 left-3 sm:left-auto sm:right-6 sm:max-w-md z-40 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200/90 shadow-xl p-3.5 flex items-center justify-between gap-3 transform translate-y-8 opacity-0 transition-all duration-300 animate-in';

    bannerEl.innerHTML = `
        <div class="flex items-center gap-3 min-w-0">
            <img src="${LOGO_URL}" alt="Campus Market" class="w-10 h-10 rounded-xl object-contain bg-slate-50 border border-slate-100 p-1 flex-shrink-0">
            <div class="flex flex-col min-w-0">
                <span class="font-heading font-extrabold text-xs sm:text-sm text-slate-900 leading-tight truncate">
                    Installer Campus Market
                </span>
                <span class="text-[11px] text-slate-500 font-medium leading-tight truncate">
                    Commandez en 1 clic sur votre écran d'accueil
                </span>
            </div>
        </div>

        <div class="flex items-center gap-1.5 flex-shrink-0">
            <button 
                type="button" 
                id="btn-pwa-install-action"
                class="px-3.5 py-2 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-dark hover:to-primary active:scale-95 text-white font-heading font-bold text-xs rounded-xl shadow-sm transition-all min-h-[38px] cursor-pointer"
            >
                Installer
            </button>
            <button 
                type="button" 
                id="btn-pwa-install-close" 
                aria-label="Plus tard" 
                title="Plus tard"
                class="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors min-h-[38px] min-w-[38px] cursor-pointer"
            >
                <i class="fa-solid fa-xmark text-sm"></i>
            </button>
        </div>
    `;

    document.body.appendChild(bannerEl);

    // Animation d'apparition douce
    requestAnimationFrame(() => {
        bannerEl.classList.remove('translate-y-8', 'opacity-0');
        bannerEl.classList.add('translate-y-0', 'opacity-100');
    });

    // Clic sur Installer
    bannerEl.querySelector('#btn-pwa-install-action')?.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                try {
                    localStorage.setItem('campus_pwa_installed', 'true');
                } catch {}
            }
        } catch (err) {
            console.warn('[PWA] Erreur déclenchement prompt:', err);
        } finally {
            deferredPrompt = null;
            hideInstallBanner();
        }
    });

    // Clic sur Fermer (cooldown de 7 jours)
    bannerEl.querySelector('#btn-pwa-install-close')?.addEventListener('click', () => {
        try {
            localStorage.setItem(DISMISSED_KEY, String(Date.now() + SEVEN_DAYS_MS));
        } catch {}
        hideInstallBanner();
    });
}

/**
 * Cache et supprime la bannière du DOM avec transition fluide.
 */
function hideInstallBanner() {
    if (!bannerEl) return;
    bannerEl.classList.remove('translate-y-0', 'opacity-100');
    bannerEl.classList.add('translate-y-8', 'opacity-0');
    setTimeout(() => {
        if (bannerEl && bannerEl.parentNode) {
            bannerEl.parentNode.removeChild(bannerEl);
        }
        bannerEl = null;
    }, 300);
}

/**
 * Initialise les écouteurs PWA. À appeler au démarrage dans main.js.
 */
export function initPwaInstallPrompt() {
    if (typeof window === 'undefined') return;

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallBanner();
    });

    window.addEventListener('appinstalled', () => {
        hideInstallBanner();
        deferredPrompt = null;
        try {
            localStorage.setItem('campus_pwa_installed', 'true');
        } catch {}
    });
}
