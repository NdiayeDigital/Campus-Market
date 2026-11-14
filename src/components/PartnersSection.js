/**
 * Composant PartnersSection
 * Section officielle "Nos Partenaires" affichée tout en bas de page avant le pied de page.
 * Présente les logos, noms et avantages étudiants sous forme de petits blocs compacts côte à côte.
 */

import { escapeHTML } from '../utils/security.js';
import { PARTNER_CATEGORIES, DEFAULT_PARTNERS, getBecomePartnerWhatsappUrl } from '../config/partners.js';

/**
 * Crée la section des partenaires officiels en petits blocs compacts côte à côte.
 * Supporte deux variantes :
 * - 'full' : Le bloc complet avec en-tête officiel, bande défilante et bandeau d'appel (tout en bas de page)
 * - 'ticker' : Uniquement la bande défilante pure sans en-tête ni bandeau (insérée au cœur du catalogue)
 * 
 * @param {Object} props
 * @param {Array} [props.partners] - Liste des partenaires
 * @param {Function} [props.onBecomePartner] - Callback lors du clic sur Devenir Partenaire
 * @param {'full'|'ticker'} [props.variant='full'] - Mode d'affichage ('full' ou 'ticker')
 * @returns {HTMLElement}
 */
export function createPartnersSection({
    partners = DEFAULT_PARTNERS,
    onBecomePartner,
    variant = 'full',
} = {}) {
    const isTicker = variant === 'ticker';
    const containerEl = document.createElement('section');
    containerEl.id = isTicker ? 'partners-ticker-section' : 'partners-section';
    containerEl.className = isTicker 
        ? 'w-full py-2.5 sm:py-3.5 select-none overflow-hidden my-1 sm:my-2' 
        : 'w-full py-5 sm:py-7 flex flex-col gap-3.5 select-none overflow-hidden my-2 sm:my-3';
    containerEl.setAttribute('aria-label', isTicker ? 'Bande Défilante des Partenaires Campus' : 'Section des Partenaires Campus Market');

    let currentPartners = Array.isArray(partners) && partners.length > 0 
        ? partners.filter((p) => p.is_active !== false) 
        : DEFAULT_PARTNERS;

    function renderPartnerTile(partner) {
        const hasLogo = Boolean(partner.logo_url && partner.logo_url.trim());
        const initial = (partner.name?.[0] || 'P').toUpperCase();
        const catConfig = PARTNER_CATEGORIES[partner.category] || PARTNER_CATEGORIES.autre;

        return `
            <div 
                data-partner-id="${escapeHTML(partner.id)}"
                role="button"
                tabindex="0"
                title="Cliquer pour découvrir ${escapeHTML(partner.name)}"
                class="partner-tile group bg-white dark:bg-slate-900 hover:bg-slate-50/90 dark:hover:bg-slate-800/90 rounded-2xl p-2 sm:p-2.5 border border-slate-200/90 dark:border-slate-800 hover:border-primary/40 dark:hover:border-primary/50 hover:shadow-card transition-all flex items-center gap-2.5 cursor-pointer active:scale-95 shrink-0 w-[215px] sm:w-[245px] select-none"
            >
                <!-- Boîte Logo Carrée 56x56 -->
                <div class="w-14 h-14 min-w-[56px] min-h-[56px] rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center p-1.5 shrink-0 group-hover:bg-primary/5 dark:group-hover:bg-primary/20 transition-colors overflow-hidden shadow-2xs">
                    ${hasLogo ? `
                        <img 
                            src="${escapeHTML(partner.logo_url)}" 
                            alt="Logo ${escapeHTML(partner.name)}" 
                            class="max-w-full max-h-full w-auto h-auto object-contain"
                            onerror="this.parentElement.innerHTML='<span class=\\'font-heading font-black text-primary text-base\\'>${escapeHTML(initial)}</span>'"
                        />
                    ` : `
                        <span class="font-heading font-black text-primary text-base">${escapeHTML(initial)}</span>
                    `}
                </div>

                <!-- Nom, Catégorie & Avantage compact -->
                <div class="flex flex-col justify-center min-w-0 flex-1 gap-0.5">
                    <span class="font-heading font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-100 group-hover:text-primary dark:group-hover:text-blue-400 transition-colors truncate w-full" title="${escapeHTML(partner.name)}">
                        ${escapeHTML(partner.name)}
                    </span>
                    <span class="text-[10px] text-slate-400 dark:text-slate-500 font-semibold truncate w-full">
                        ${escapeHTML(partner.category_label || catConfig.label)}
                    </span>
                    ${partner.perk ? `
                        <span class="text-[9px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/70 rounded-md px-1.5 py-0.5 truncate w-fit max-w-full flex items-center gap-1 mt-0.5" title="${escapeHTML(partner.perk)}">
                            <i class="fa-solid fa-gift text-emerald-600 dark:text-emerald-400 text-[8px] shrink-0"></i>
                            <span class="truncate">${escapeHTML(partner.perk)}</span>
                        </span>
                    ` : `
                        <span class="text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded px-1.5 py-0.5 truncate w-fit flex items-center gap-1 mt-0.5">
                            <i class="fa-solid fa-circle-check text-emerald-500 text-[8px]"></i>
                            <span>Partenaire</span>
                        </span>
                    `}
                </div>
            </div>
        `;
    }

    function openPartnerDetailModal(partner) {
        document.getElementById('partner-detail-modal')?.remove();

        const catConfig = PARTNER_CATEGORIES[partner.category] || PARTNER_CATEGORIES.autre;
        const badgeStyle = catConfig.badgeClass || 'bg-slate-50 text-slate-700 border-slate-200';
        const hasLogo = Boolean(partner.logo_url && partner.logo_url.trim());
        const initial = (partner.name?.[0] || 'P').toUpperCase();
        const whatsappUrl = getBecomePartnerWhatsappUrl();

        const modal = document.createElement('div');
        modal.id = 'partner-detail-modal';
        modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs select-none view-transition-enter';

        modal.innerHTML = `
            <div class="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col gap-4 relative animate-pop-in max-h-[90vh] overflow-y-auto no-scrollbar">
                <!-- Bouton Fermer -->
                <button 
                    type="button" 
                    id="btn-close-partner-modal"
                    aria-label="Fermer"
                    class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center text-xs active:scale-90 transition-all cursor-pointer"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>

                <!-- En-tête : Logo Centré & Titre -->
                <div class="flex flex-col items-center text-center gap-3 pt-1">
                    <div class="w-20 h-20 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 p-2.5 flex items-center justify-center shadow-xs overflow-hidden">
                        ${hasLogo ? `
                            <img 
                                src="${escapeHTML(partner.logo_url)}" 
                                alt="Logo ${escapeHTML(partner.name)}" 
                                class="max-w-full max-h-full w-auto h-auto object-contain"
                                onerror="this.parentElement.innerHTML='<span class=\\'font-heading font-black text-primary text-2xl\\'>${escapeHTML(initial)}</span>'"
                            />
                        ` : `
                            <span class="font-heading font-black text-primary text-2xl">${escapeHTML(initial)}</span>
                        `}
                    </div>

                    <div class="flex flex-col items-center gap-1">
                        <div class="flex items-center gap-1.5 flex-wrap justify-center">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeStyle}">
                                ${escapeHTML(partner.category_label || catConfig.label)}
                            </span>
                            ${partner.badge ? `
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                                    <i class="fa-solid fa-certificate text-[9px] mr-1 text-amber-600"></i>
                                    ${escapeHTML(partner.badge)}
                                </span>
                            ` : ''}
                        </div>
                        <h3 class="font-heading font-extrabold text-lg text-slate-900 dark:text-white mt-1">
                            ${escapeHTML(partner.name)}
                        </h3>
                    </div>
                </div>

                <!-- Description -->
                ${partner.description ? `
                    <div class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-700">
                        ${escapeHTML(partner.description)}
                    </div>
                ` : ''}

                <!-- Avantage Réservé aux Étudiants UIDT -->
                ${partner.perk ? `
                    <div class="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 flex items-start gap-3">
                        <div class="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                            <i class="fa-solid fa-gift text-sm"></i>
                        </div>
                        <div class="flex flex-col min-w-0">
                            <span class="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-300 tracking-wider">Avantage Étudiant Exclusif</span>
                            <span class="text-xs sm:text-sm font-extrabold text-emerald-950 dark:text-emerald-100 mt-0.5 leading-snug">${escapeHTML(partner.perk)}</span>
                        </div>
                    </div>
                ` : ''}

                <!-- Actions / Liens -->
                <div class="flex flex-col gap-2 pt-1">
                    ${partner.website_url ? `
                        <a 
                            href="${escapeHTML(partner.website_url)}" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-all active:scale-95"
                        >
                            <span>Visiter le site web officiel</span>
                            <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                        </a>
                    ` : ''}
                    <a 
                        href="${whatsappUrl}" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        class="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                        <i class="fa-brands fa-whatsapp text-sm"></i>
                        <span>Écrire sur WhatsApp</span>
                    </a>
                    <button 
                        type="button" 
                        id="btn-close-partner-modal-alt"
                        class="w-full py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all active:scale-95 cursor-pointer mt-1"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeModal = () => modal.remove();
        modal.querySelector('#btn-close-partner-modal')?.addEventListener('click', closeModal);
        modal.querySelector('#btn-close-partner-modal-alt')?.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    function render() {
        const whatsappUrl = getBecomePartnerWhatsappUrl();

        // Répétition intelligente pour garantir un défilement continu fluide sans coupure visuelle
        const repeatCount = currentPartners.length < 3 ? 6 : (currentPartners.length < 6 ? 4 : 2);
        const duplicatedPartners = currentPartners.length > 0 
            ? Array(repeatCount).fill(currentPartners).flat() 
            : [];

        // Mode Ticker : SEULE la bande défilante (affichée en haut après les premières lignes de produits)
        if (isTicker) {
            if (currentPartners.length === 0) {
                containerEl.style.display = 'none';
                containerEl.innerHTML = '';
                return;
            }

            containerEl.style.display = '';
            containerEl.innerHTML = `
                <div class="relative w-full overflow-hidden py-1 group/marquee">
                    <!-- Masques dégradés latéraux gauche & droite -->
                    <div class="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-slate-50 dark:from-slate-950 to-transparent z-10 pointer-events-none"></div>
                    <div class="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-slate-50 dark:from-slate-950 to-transparent z-10 pointer-events-none"></div>

                    <!-- Piste défilante continue (pause au survol/clic) -->
                    <div class="animate-marquee flex items-center gap-3 sm:gap-4 w-max py-1 hover:[animation-play-state:paused]">
                        ${duplicatedPartners.map((partner) => renderPartnerTile(partner)).join('')}
                    </div>
                </div>
            `;
            bindEvents();
            return;
        }

        // Mode Complet : Le bloc complet avec en-tête officiel, bande défilante et bandeau d'appel (répété tout en bas)
        containerEl.style.display = '';
        containerEl.innerHTML = `
            <div class="flex flex-col gap-3.5 w-full">
                <!-- En-tête compact de la section -->
                <div class="flex items-center justify-between gap-3 border-b border-slate-200/80 dark:border-slate-800 pb-2.5">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                            <i class="fa-solid fa-handshake"></i>
                        </div>
                        <div class="flex flex-col min-w-0">
                            <div class="flex items-center gap-2">
                                <h2 class="font-heading font-extrabold text-base sm:text-lg text-slate-900 dark:text-white tracking-tight leading-snug truncate">
                                    Nos Partenaires Campus
                                </h2>
                                <span class="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 text-[10px] font-bold shrink-0">
                                    Officiel UIDT
                                </span>
                            </div>
                            <p class="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">
                                Amicales étudiantes, paiements et commerces locaux engagés
                            </p>
                        </div>
                    </div>

                    <!-- Bouton Devenir Partenaire En-tête -->
                    <a 
                        href="${whatsappUrl}" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        id="btn-partner-cta-top"
                        class="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs active:scale-95 shrink-0"
                    >
                        <i class="fa-brands fa-whatsapp text-xs sm:text-sm"></i>
                        <span class="hidden sm:inline">Devenir Partenaire</span>
                        <span class="sm:hidden">Partenaire</span>
                    </a>
                </div>

                <!-- Bande défilante des Partenaires (Marquee fluide) -->
                ${currentPartners.length === 0 ? `
                    <!-- État d'attente élégant et compact -->
                    <div class="text-center py-6 px-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center justify-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm shrink-0">
                            <i class="fa-solid fa-handshake-angle"></i>
                        </div>
                        <div class="text-left">
                            <h3 class="font-heading font-extrabold text-xs sm:text-sm text-slate-800 dark:text-slate-100">
                                Nos partenariats officiels arrivent très prochainement
                            </h3>
                            <p class="text-[11px] text-slate-500 dark:text-slate-400">
                                Amicales étudiantes, commerces de Thiès et sponsors engagés pour les étudiants de l'UIDT.
                            </p>
                        </div>
                    </div>
                ` : `
                    <div class="relative w-full overflow-hidden py-1 group/marquee">
                        <!-- Masques dégradés latéraux gauche & droite -->
                        <div class="absolute left-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-r from-slate-50 dark:from-slate-950 to-transparent z-10 pointer-events-none"></div>
                        <div class="absolute right-0 top-0 bottom-0 w-8 sm:w-16 bg-gradient-to-l from-slate-50 dark:from-slate-950 to-transparent z-10 pointer-events-none"></div>

                        <!-- Piste défilante continue (pause au survol/clic) -->
                        <div class="animate-marquee flex items-center gap-3 sm:gap-4 w-max py-1 hover:[animation-play-state:paused]">
                            ${duplicatedPartners.map((partner) => renderPartnerTile(partner)).join('')}
                        </div>
                    </div>
                `}

                <!-- Bandeau compact Appel à Partenariat -->
                <div class="bg-gradient-to-r from-slate-900 via-primary to-indigo-950 rounded-2xl px-4 py-3 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <span class="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-accent text-xs shrink-0">
                            <i class="fa-solid fa-bullhorn"></i>
                        </span>
                        <p class="text-xs text-slate-200 truncate">
                            <strong class="text-white font-bold">Amicale, commerce ou sponsor à Thiès ?</strong> Rejoignez l'écosystème Campus Market.
                        </p>
                    </div>
                    <a 
                        href="${whatsappUrl}" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        id="btn-partner-cta-bottom"
                        class="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-[11px] shadow-xs transition-all active:scale-95 shrink-0 self-end sm:self-auto"
                    >
                        <i class="fa-brands fa-whatsapp text-xs"></i>
                        <span>Devenir Partenaire Officiel</span>
                    </a>
                </div>
            </div>
        `;

        bindEvents();
    }

    function bindEvents() {
        // Clic sur un petit bloc partenaire -> ouvre la modale de détails
        containerEl.querySelectorAll('.partner-tile').forEach((tile) => {
            tile.addEventListener('click', () => {
                const id = tile.getAttribute('data-partner-id');
                const partner = currentPartners.find((p) => p.id === id);
                if (partner) openPartnerDetailModal(partner);
            });
        });

        const topCta = containerEl.querySelector('#btn-partner-cta-top');
        const bottomCta = containerEl.querySelector('#btn-partner-cta-bottom');

        if (typeof onBecomePartner === 'function') {
            topCta?.addEventListener('click', (e) => {
                e.preventDefault();
                onBecomePartner();
            });
            bottomCta?.addEventListener('click', (e) => {
                e.preventDefault();
                onBecomePartner();
            });
        }
    }

    render();

    // Méthode publique de rafraîchissement
    containerEl.setPartners = function (newPartners) {
        if (Array.isArray(newPartners)) {
            currentPartners = newPartners.filter((p) => p.is_active !== false);
            render();
        }
    };

    return containerEl;
}

/**
 * Crée uniquement la bande défilante pure des partenaires (variante 'ticker').
 * @param {Object} props
 * @returns {HTMLElement}
 */
export function createPartnersTicker(props = {}) {
    return createPartnersSection({ ...props, variant: 'ticker' });
}
