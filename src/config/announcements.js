/**
 * Configuration & Données par défaut du Carrousel d'Accueil (16:9)
 * Panneau d'Annonces Campus, Publicités / Bons Plans & Mises en avant Partenaires.
 */

import { SUPPORT_CONFIG } from './support.js';

export const CAROUSEL_TYPES = {
    annonce: {
        id: 'annonce',
        label: 'Annonce Campus',
        icon: 'fa-bullhorn',
        badgeColor: 'bg-blue-500/90 text-white',
        defaultBadge: '📢 Info Campus',
        gradient: 'from-blue-700 via-indigo-700 to-slate-900',
    },
    pub: {
        id: 'pub',
        label: 'Publicité & Promo',
        icon: 'fa-fire',
        badgeColor: 'bg-amber-500/95 text-slate-950 font-black',
        defaultBadge: '🔥 Promo Flash',
        gradient: 'from-amber-600 via-rose-700 to-indigo-950',
    },
    partenaire: {
        id: 'partenaire',
        label: 'Mise en avant Partenaire',
        icon: 'fa-handshake',
        badgeColor: 'bg-emerald-500/90 text-white',
        defaultBadge: '🤝 Partenaire Officiel',
        gradient: 'from-emerald-700 via-teal-800 to-slate-950',
    },
};

export const DEFAULT_CAROUSEL_SLIDES = [
    {
        id: 'slide-default-1',
        title: 'Vos repas & fournitures à votre porte',
        subtitle: 'Commandez directement auprès des étudiants-marchands de l’UIDT. Livraison pavillon-à-pavillon.',
        slide_type: 'annonce',
        badge: '📢 Info Campus',
        image_url: '/assets/banners/banner-welcome.svg',
        link_url: '#catalog',
        link_text: 'Explorer les offres',
        display_order: 1,
        is_active: true,
    },
    {
        id: 'slide-default-2',
        title: 'Bons plans & Réductions spéciales examens',
        subtitle: 'Menus chauds, polycopiés et clés USB à prix étudiants négociés avec les commerçants du campus.',
        slide_type: 'pub',
        badge: '🔥 Bons Plans',
        image_url: '/assets/banners/banner-bons-plans.svg',
        link_url: '#category/restauration',
        link_text: 'Profiter des promos',
        display_order: 2,
        is_active: true,
    },
    {
        id: 'slide-default-3',
        title: 'Amicales, Commerces & Sponsors : Devenez Partenaire',
        subtitle: 'Valorisez vos activités, événements ou services auprès de toute la communauté estudiantine de Thiès.',
        slide_type: 'annonce',
        badge: '🤝 Partenariat',
        image_url: '/assets/banners/banner-partenaires.svg',
        link_url: `https://wa.me/${SUPPORT_CONFIG.phoneRaw}?text=${encodeURIComponent("Bonjour Campus Market ! Je souhaite devenir partenaire officiel de la plateforme.")}`,
        link_text: 'Devenir Partenaire',
        display_order: 3,
        is_active: true,
    },
];
