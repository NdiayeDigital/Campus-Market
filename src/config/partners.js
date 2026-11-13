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
