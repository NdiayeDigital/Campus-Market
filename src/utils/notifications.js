/**
 * Module de notifications et modales modernes (Campus Market)
 * Fournit des Toasts animés glassmorphism et des boîtes de dialogue de confirmation
 * stylisées sans bloquer le thread UI avec alert() ou confirm().
 */

import { escapeHTML } from './security.js';

let toastContainer = null;

function getToastContainer() {
    if (typeof document === 'undefined') return null;
    if (!toastContainer || !document.body || !document.body.contains(toastContainer)) {
        toastContainer = document.createElement('div');
        toastContainer.id = 'toast-root';
        toastContainer.className = 'fixed top-4 inset-x-4 sm:inset-x-auto sm:right-5 sm:top-5 z-[9999] pointer-events-none flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full';
        document.body.appendChild(toastContainer);
    }
    return toastContainer;
}

const TOAST_THEMES = {
    success: {
        icon: 'fa-circle-check',
        iconBg: 'bg-emerald-100 text-emerald-700',
        barColor: 'bg-emerald-500',
        accentShadow: 'shadow-emerald-500/10',
    },
    error: {
        icon: 'fa-circle-exclamation',
        iconBg: 'bg-rose-100 text-rose-700',
        barColor: 'bg-rose-500',
        accentShadow: 'shadow-rose-500/10',
    },
    warning: {
        icon: 'fa-triangle-exclamation',
        iconBg: 'bg-amber-100 text-amber-800',
        barColor: 'bg-amber-500',
        accentShadow: 'shadow-amber-500/10',
    },
    info: {
        icon: 'fa-circle-info',
        iconBg: 'bg-blue-100 text-primary',
        barColor: 'bg-primary',
        accentShadow: 'shadow-primary/10',
    },
};

/**
 * Affiche une notification toast moderne, animée avec jauge de progression.
 * @param {string} message
 * @param {('success'|'error'|'warning'|'info')} [type='success']
 * @param {number} [duration=3500]
 */
export function showToast(message, type = 'success', duration = 3500) {
    const container = getToastContainer();
    if (!container) return;
    const theme = TOAST_THEMES[type] || TOAST_THEMES.success;

    const toast = document.createElement('div');
    toast.className = `pointer-events-auto relative overflow-hidden flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl bg-white/95 backdrop-blur-md border border-slate-200/80 shadow-xl ${theme.accentShadow} transition-all duration-300 transform -translate-y-3 opacity-0`;

    toast.innerHTML = `
        <div class="w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${theme.iconBg}">
            <i class="fa-solid ${theme.icon}"></i>
        </div>
        <div class="flex-1 min-w-0 pr-1">
            <p class="text-xs sm:text-sm font-semibold text-slate-800 leading-snug break-words">
                ${escapeHTML(message)}
            </p>
        </div>
        <button type="button" aria-label="Fermer" class="text-slate-400 hover:text-slate-600 p-1 -mr-1 -mt-1 rounded-lg transition-colors flex-shrink-0">
            <i class="fa-solid fa-xmark text-sm"></i>
        </button>
        <div class="absolute bottom-0 inset-x-0 h-1 bg-slate-100 overflow-hidden">
            <div class="toast-progress-bar h-full ${theme.barColor} transition-all ease-linear" style="width: 100%;"></div>
        </div>
    `;

    container.appendChild(toast);

    // Entrée animée
    requestAnimationFrame(() => {
        toast.classList.remove('-translate-y-3', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
        const progressBar = toast.querySelector('.toast-progress-bar');
        if (progressBar) {
            progressBar.style.transitionDuration = `${duration}ms`;
            requestAnimationFrame(() => {
                progressBar.style.width = '0%';
            });
        }
    });

    let dismissTimer = null;

    function dismiss() {
        if (dismissTimer) clearTimeout(dismissTimer);
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('-translate-y-2', 'opacity-0', 'scale-95');
        setTimeout(() => toast.remove(), 250);
    }

    toast.querySelector('button')?.addEventListener('click', (e) => {
        e.stopPropagation();
        dismiss();
    });

    dismissTimer = setTimeout(dismiss, duration);
}

/**
 * Affiche une boîte de dialogue de confirmation moderne retournant une Promise<boolean>.
 * Remplace confirm() natif du navigateur.
 * @param {Object} options
 * @param {string} options.title - Titre de l'action
 * @param {string} options.message - Message explicatif
 * @param {string} [options.confirmText='Confirmer'] - Libellé bouton validation
 * @param {string} [options.cancelText='Annuler'] - Libellé bouton annulation
 * @param {boolean} [options.isDestructive=false] - Si vrai, style rouge d'avertissement
 * @param {string} [options.icon] - Classe d'icône FontAwesome personnalisée
 * @returns {Promise<boolean>}
 */
export function showConfirm({
    title = 'Confirmation',
    message,
    confirmText = 'Confirmer',
    cancelText = 'Annuler',
    isDestructive = false,
    icon,
} = {}) {
    if (typeof document === 'undefined') {
        return Promise.resolve(true);
    }
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm opacity-0 transition-opacity duration-200';

        const iconClass = icon || (isDestructive ? 'fa-triangle-exclamation' : 'fa-circle-question');
        const iconBg = isDestructive
            ? 'bg-rose-100 text-rose-600'
            : 'bg-primary-light text-primary';
        const confirmBtnClass = isDestructive
            ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/30'
            : 'bg-primary hover:bg-primary-dark text-white shadow-primary/30';

        overlay.innerHTML = `
            <div class="bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 max-w-sm sm:max-w-md w-full flex flex-col gap-4 transform scale-95 transition-transform duration-200" role="dialog" aria-modal="true">
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl flex-shrink-0 ${iconBg}">
                        <i class="fa-solid ${iconClass}"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-heading font-extrabold text-slate-900 text-base sm:text-lg leading-snug">
                            ${escapeHTML(title)}
                        </h3>
                        <p class="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
                            ${escapeHTML(message || '')}
                        </p>
                    </div>
                </div>

                <div class="flex items-center justify-end gap-2.5 pt-2">
                    <button id="modal-confirm-cancel" type="button" class="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-semibold transition-colors min-h-[44px]">
                        ${escapeHTML(cancelText)}
                    </button>
                    <button id="modal-confirm-action" type="button" class="px-5 py-2.5 rounded-xl font-heading font-bold text-xs sm:text-sm shadow-md transition-all min-h-[44px] ${confirmBtnClass}">
                        ${escapeHTML(confirmText)}
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Animation d'entrée
        requestAnimationFrame(() => {
            overlay.classList.remove('opacity-0');
            const card = overlay.firstElementChild;
            if (card) {
                card.classList.remove('scale-95');
                card.classList.add('scale-100');
            }
        });

        function cleanup(result) {
            window.removeEventListener('keydown', handleKeyDown);
            overlay.classList.add('opacity-0');
            const card = overlay.firstElementChild;
            if (card) {
                card.classList.remove('scale-100');
                card.classList.add('scale-95');
            }
            setTimeout(() => {
                overlay.remove();
                resolve(result);
            }, 180);
        }

        function handleKeyDown(e) {
            if (e.key === 'Escape') {
                e.preventDefault();
                cleanup(false);
            }
        }

        window.addEventListener('keydown', handleKeyDown);

        overlay.querySelector('#modal-confirm-cancel')?.addEventListener('click', () => cleanup(false));
        overlay.querySelector('#modal-confirm-action')?.addEventListener('click', () => cleanup(true));

        // Clic sur l'arrière-plan pour fermer
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cleanup(false);
            }
        });

        // Focus par défaut sur le bouton d'action
        setTimeout(() => {
            overlay.querySelector('#modal-confirm-action')?.focus();
        }, 50);
    });
}
