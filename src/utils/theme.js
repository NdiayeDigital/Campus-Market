/**
 * Campus Market — Moteur de Thème (Mode Clair / Mode Sombre)
 * Gère l'activation, la détection des préférences système et la persistance du thème.
 */

export const THEME_STORAGE_KEY = 'cm_theme';
export const THEME_CHANGED_EVENT = 'cm:theme-changed';

/**
 * Met à jour la balise meta theme-color pour harmoniser la barre de statut mobile.
 * @param {boolean} isDark
 */
export function updateThemeColorMeta(isDark) {
    if (typeof document === 'undefined') return;
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.setAttribute('name', 'theme-color');
        document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', isDark ? '#0F172A' : '#1D4ED8');
}

/**
 * Vérifie si le mode sombre est actuellement actif sur le document.
 * @returns {boolean}
 */
export function isDarkMode() {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
}

/**
 * Récupère le thème actuellement configuré.
 * @returns {'dark'|'light'}
 */
export function getTheme() {
    if (typeof window === 'undefined') return 'light';
    try {
        const stored = localStorage.getItem(THEME_STORAGE_KEY);
        if (stored === 'dark' || stored === 'light') return stored;
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
        return 'light';
    }
}

/**
 * Applique explicitement un thème ('dark' ou 'light').
 * @param {'dark'|'light'} theme
 */
export function setTheme(theme) {
    if (typeof document === 'undefined') return;
    const isDark = theme === 'dark';

    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {}

    updateThemeColorMeta(isDark);

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(THEME_CHANGED_EVENT, { detail: { theme, isDark } }));
    }
    return theme;
}

/**
 * Bascule dynamiquement entre le mode clair et le mode sombre.
 * @returns {'dark'|'light'} Nouveau thème actif
 */
export function toggleTheme() {
    const nextTheme = isDarkMode() ? 'light' : 'dark';
    setTheme(nextTheme);
    return nextTheme;
}

/**
 * Initialise le thème au démarrage de l'application.
 * S'exécute immédiatement pour éviter tout clignotement blanc (FOUC).
 */
export function initTheme() {
    if (typeof window === 'undefined') return;

    const theme = getTheme();
    const isDark = theme === 'dark';

    if (isDark) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    updateThemeColorMeta(isDark);

    // Écoute les changements de préférences système de l'OS si l'utilisateur n'a pas fixé de choix strict
    try {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener?.('change', (e) => {
            const hasManualChoice = localStorage.getItem(THEME_STORAGE_KEY);
            if (!hasManualChoice) {
                setTheme(e.matches ? 'dark' : 'light');
            }
        });
    } catch {}
}

/**
 * Permet à un composant de s'abonner aux changements de thème.
 * @param {Function} callback - Appelé avec (theme, isDark)
 * @returns {Function} Fonction de désabonnement
 */
export function subscribeTheme(callback) {
    if (typeof window === 'undefined') return () => {};
    const handler = (e) => callback(e.detail?.theme, e.detail?.isDark);
    window.addEventListener(THEME_CHANGED_EVENT, handler);
    return () => window.removeEventListener(THEME_CHANGED_EVENT, handler);
}

export default {
    THEME_STORAGE_KEY,
    THEME_CHANGED_EVENT,
    initTheme,
    getTheme,
    setTheme,
    toggleTheme,
    isDarkMode,
    subscribeTheme,
    updateThemeColorMeta,
};
