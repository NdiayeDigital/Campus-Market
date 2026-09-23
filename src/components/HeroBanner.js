/**
 * Composant HeroBanner
 * Section d'accueil chaleureuse et engageante spécifique à l'UIDT Thiès.
 * Présente la promesse de valeur, la réassurance pavillon et les tags de recherche rapide en 1 clic.
 */

import { escapeHTML } from '../utils/security.js';

const TRENDING_TAGS = [
    { label: 'Thiéboudienne', query: 'thieb', icon: 'fa-bowl-food' },
    { label: 'Café Touba', query: 'café', icon: 'fa-mug-hot' },
    { label: 'Vêtements', query: 'vêtements', icon: 'fa-shirt' },
    { label: 'Tech & Clés USB', query: 'usb', icon: 'fa-laptop' },
    { label: 'Fournitures', query: 'fournitures', icon: 'fa-book' },
];

/**
 * Crée la section héroïque du catalogue.
 * @param {Object} props
 * @param {Function} props.onSelectTag - Callback appelé lors du clic sur un tag de recherche rapide
 * @param {Function} props.onExploreCatalog - Callback lors du clic sur le bouton Découvrir
 * @returns {HTMLElement}
 */
export function createHeroBanner({ onSelectTag, onExploreCatalog } = {}) {
    const bannerEl = document.createElement('section');
    bannerEl.className = 'relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-primary to-indigo-950 text-white shadow-xl p-5 sm:p-7 md:p-9 transition-all duration-300';
    bannerEl.setAttribute('aria-label', 'Bannière de présentation Campus Market');

    bannerEl.innerHTML = `
        <!-- Formes géométriques décoratives douces d'arrière-plan -->
        <div class="absolute -top-16 -right-16 w-56 h-56 bg-accent/20 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none opacity-40"></div>

        <div class="relative z-10 flex flex-col gap-4 max-w-2xl">
            <!-- Badge Institutionnel UIDT -->
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-[11px] sm:text-xs font-semibold text-white/90 w-fit">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Université Iba Der Thiam de Thiès (UIDT)</span>
            </div>

            <!-- Titre Principal -->
            <h1 class="font-heading font-extrabold text-2xl sm:text-3xl md:text-4xl text-white leading-tight tracking-tight">
                La vie sur le campus, <br class="hidden sm:inline">
                <span class="text-accent underline decoration-accent/40 underline-offset-4">livrée à votre porte.</span>
            </h1>

            <!-- Sous-titre explicatif -->
            <p class="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-xl">
                Commandez vos repas chauds, vêtements, fournitures et accessoires directement auprès des étudiants-marchands de l'université.
            </p>

            <!-- Piliers de Réassurance (USPs) -->
            <div class="flex items-center gap-3 sm:gap-4 flex-wrap pt-1 text-[11px] sm:text-xs text-white/95 font-semibold">
                <div class="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10">
                    <i class="fa-solid fa-motorcycle text-accent"></i>
                    <span>Livraison Pavillon</span>
                </div>
                <div class="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10">
                    <i class="fa-solid fa-wallet text-emerald-400"></i>
                    <span>Wave & Cash à la livraison</span>
                </div>
                <div class="flex items-center gap-1.5 bg-black/20 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-white/10">
                    <i class="fa-solid fa-graduation-cap text-sky-300"></i>
                    <span>100% Étudiants UIDT</span>
                </div>
            </div>

            <!-- Recherches Tendances en 1 clic -->
            <div class="pt-3 border-t border-white/15 flex flex-col gap-2">
                <span class="text-[11px] font-semibold uppercase tracking-wider text-blue-200/80 flex items-center gap-1.5">
                    <i class="fa-solid fa-fire text-accent text-xs"></i> Tendances du moment sur le campus :
                </span>
                <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5" id="hero-trending-tags">
                    ${TRENDING_TAGS.map((tag) => `
                        <button 
                            type="button" 
                            data-query="${escapeHTML(tag.query)}"
                            class="tag-chip flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white text-white hover:text-slate-900 border border-white/20 text-xs font-semibold backdrop-blur-md transition-all duration-200 active:scale-95"
                        >
                            <i class="fa-solid ${tag.icon} text-[11px] text-accent group-hover:text-primary"></i>
                            <span>${tag.label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    // Attachement des écouteurs sur les tags
    bannerEl.querySelectorAll('.tag-chip').forEach((btn) => {
        btn.addEventListener('click', () => {
            const query = btn.getAttribute('data-query');
            if (typeof onSelectTag === 'function') {
                onSelectTag(query);
            }
        });
    });

    return bannerEl;
}

export default createHeroBanner;
