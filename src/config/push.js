/**
 * Configuration des Notifications Web Push (VAPID).
 * Campus Market - Université Iba Der Thiam de Thiès (UIDT).
 */

export const VAPID_CONFIG = {
    // Clé publique VAPID (publique et sans danger côté client - surchargeable par VITE_VAPID_PUBLIC_KEY)
    publicKey: (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_VAPID_PUBLIC_KEY)
        ? import.meta.env.VITE_VAPID_PUBLIC_KEY
        : 'BHqBPmVryy2hCYhoRicHjMK-mKP7d211SBwUOVaVxnXBU52ljxIAPCNGuw9fMJjqqC9O_iaBvhNgpoyALrci3w4',
    subject: 'mailto:contact@campusmarket-uidt.com',
};

/**
 * Convertit une clé publique base64 URL-safe en Uint8Array pour PushManager.
 * @param {string} base64String
 * @returns {Uint8Array}
 */
export function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = typeof window !== 'undefined' && typeof window.atob === 'function'
        ? window.atob(base64)
        : (typeof Buffer !== 'undefined' ? Buffer.from(base64, 'base64').toString('binary') : atob(base64));

    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}
