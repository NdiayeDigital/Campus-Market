/**
 * Configuration & Catégories des Partenaires Campus Market (UIDT)
 * La liste est initialisée vide pour permettre à l'administrateur d'ajouter
 * lui-même les partenaires réels via l'espace SuperAdmin.
 */

import { SUPPORT_CONFIG } from './support.js';

export const PARTNER_CATEGORIES = {
    all: {
        id: 'all',
        label: 'Tous les partenaires',
        icon: 'fa-layer-group',
    },
    amicale: {
        id: 'amicale',
        label: 'Amicales & Associations',
        icon: 'fa-graduation-cap',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    },
    payment: {
        id: 'payment',
        label: 'Paiements Sécurisés',
        icon: 'fa-shield-halved',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    },
    local_business: {
        id: 'local_business',
        label: 'Commerces & Restauration',
        icon: 'fa-utensils',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    },
    sponsor: {
        id: 'sponsor',
        label: 'Sponsors & Alliances',
        icon: 'fa-award',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    },
    autre: {
        id: 'autre',
        label: 'Autres Services',
        icon: 'fa-handshake',
        badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
    },
};

/**
 * Liste par défaut des partenaires : vide au démarrage.
 * L'administrateur gère lui-même les partenariats réels depuis le SuperAdmin.
 */
export const DEFAULT_PARTNERS = [];

/**
 * Génère le lien WhatsApp pré-rempli pour soumettre une demande de partenariat.
 * @returns {string}
 */
export function getBecomePartnerWhatsappUrl() {
    const text = "Bonjour l'équipe Campus Market UIDT ! Je représente une amicale / un commerce / un service et je souhaite devenir partenaire officiel de la plateforme.";
    return `https://wa.me/${SUPPORT_CONFIG.phoneRaw}?text=${encodeURIComponent(text)}`;
}

/**
 * Génère le lien WhatsApp pré-rempli pour contacter un partenaire officiel depuis Campus Market.
 * Précise explicitement que la prise de contact se fait à travers la plateforme Campus Market (UIDT).
 *
 * @param {Object} partner
 * @returns {string}
 */
export function getPartnerContactWhatsappUrl(partner) {
    const partnerName = partner?.name?.trim() || 'Partenaire';
    const perkText = partner?.perk?.trim() ? ` concernant l'avantage étudiant "${partner.perk.trim()}"` : '';
    const message = `Bonjour ${partnerName}, je vous contacte depuis la plateforme Campus Market (Université Iba Der Thiam de Thiès - UIDT)${perkText} au sujet de vos services et offres partenaires.`;

    // 1. Détection d'un numéro de téléphone dédié
    let rawPhone = partner?.whatsapp_phone || partner?.phone || '';
    if (typeof rawPhone === 'string') {
        rawPhone = rawPhone.replace(/[^0-9]/g, '');
        if (rawPhone.startsWith('00221')) rawPhone = rawPhone.slice(2);
        if (rawPhone.length === 9 && ['77', '78', '76', '70', '75'].some((p) => rawPhone.startsWith(p))) {
            rawPhone = `221${rawPhone}`;
        }
    }

    if (rawPhone && rawPhone.length >= 9) {
        return `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`;
    }

    // 2. Si le lien website_url est déjà un lien wa.me
    if (partner?.website_url && partner.website_url.includes('wa.me')) {
        const cleanUrl = partner.website_url.split('?')[0];
        return `${cleanUrl}?text=${encodeURIComponent(message)}`;
    }

    // 3. Repli intelligent sur le guichet officiel de la plateforme Campus Market avec mention du partenaire
    const fallbackMsg = `Bonjour l'équipe Campus Market UIDT, je vous contacte depuis la plateforme au sujet du partenaire officiel "${partnerName}". Pouvez-vous me mettre en relation ?`;
    return `https://wa.me/${SUPPORT_CONFIG.phoneRaw}?text=${encodeURIComponent(fallbackMsg)}`;
}
