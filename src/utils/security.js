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
 * Valide si un numéro de téléphone est un numéro sénégalais conforme (mobile ou fixe).
 * Doit comporter 9 chiffres (ex: 77 123 45 67) avec un préfixe valide :
 * - Mobiles : 77, 78 (Orange), 76 (Free), 70 (Expresso), 75 (Promobile)
 * - Fixes : 33 (Sonatel), 30 (Expresso), 36 (Free)
 * Tolère l'indicatif international +221 ou 00221 ainsi que les espaces, tirets et points.
 *
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidSenegalPhone(phone) {
    if (!phone || typeof phone !== 'string') return false;
    let clean = phone.replace(/[^0-9]/g, '');
    if (clean.startsWith('00221') && clean.length === 14) {
        clean = clean.slice(5);
    } else if (clean.startsWith('221') && clean.length === 12) {
        clean = clean.slice(3);
    }
    return /^(7[05678]|3[036])[0-9]{7}$/.test(clean);
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
    formatSenegalPhone,
    isValidSenegalPhone,
};
