/**
 * Module d'utilitaires de sécurité et d'échappement pour Campus Market.
 * Prévient les attaques XSS (Cross-Site Scripting) et valide les règles métiers de l'UIDT.
 */

/**
 * Échappe les caractères HTML dangereux pour éviter les failles XSS lors des injections dans le DOM.
 * @param {string|null|undefined} str - Chaîne de caractères à assainir
 * @returns {string} Chaîne sécurisée
 */
export function escapeHTML(str) {
    if (str === null || str === undefined) {
        return '';
    }
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Valide si une adresse email appartient bien au domaine universitaire officiel de Thiès.
 * @param {string} email
 * @returns {boolean}
 */
export function isUniversityEmail(email) {
    if (!email || typeof email !== 'string') return false;
    return email.trim().toLowerCase().endsWith('@univ-thies.sn');
}

/**
 * Normalise un numéro de téléphone au format sénégalais (ex: '771234567' -> '221771234567').
 * Utile pour les liens WhatsApp direct et les SMS.
 * @param {string} phone
 * @returns {string}
 */
export function formatSenegalPhone(phone) {
    if (!phone) return '';
    const cleaned = String(phone).replace(/[^0-9]/g, '');
    if (!cleaned.startsWith('221') && cleaned.length === 9) {
        return `221${cleaned}`;
    }
    return cleaned;
}

export default {
    escapeHTML,
    isUniversityEmail,
    formatSenegalPhone
};
