/**
 * Composant PartnersSection
 * Section officielle "Nos Partenaires" affichée tout en bas de page avant le pied de page.
 * Présente les logos, noms et avantages étudiants sous forme de petits blocs compacts côte à côte.
 */

import { escapeHTML } from '../utils/security.js';
import { PARTNER_CATEGORIES, DEFAULT_PARTNERS, getBecomePartnerWhatsappUrl } from '../config/partners.js';

/**
 * Crée la section des partenaires officiels en petits blocs compacts côte à côte.
 * @param {Object} props
 * @param {Array} [props.partners] - Liste des partenaires
 * @param {Function} [props.onBecomePartner] - Callback lors du clic sur Devenir Partenaire
 * @returns {HTMLElement}
 */
export function createPartnersSection({
    partners = DEFAULT_PARTNERS,
    onBecomePartner,
} = {}) {
    const containerEl = document.createElement('section');
    containerEl.id = 'partners-section';
    containerEl.className = 'w-full py-8 sm:py-10 flex flex-col gap-5 select-none overflow-hidden';
    containerEl.setAttribute('aria-label', 'Section des Partenaires Campus Market');

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
                class="partner-tile group bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 hover:border-primary/50 hover:shadow-card transition-all flex flex-col items-center text-center justify-between gap-2.5 cursor-pointer active:scale-95 min-w-0 w-full min-h-[148px] sm:min-h-[160px] select-none"
            >
                <!-- Boîte Logo Carrée Strictement 56x56 / 64x64 -->
                <div class="w-14 h-14 sm:w-16 sm:h-16 min-w-[56px] min-h-[56px] sm:min-w-[64px] sm:min-h-[64px] rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1.5 shrink-0 group-hover:bg-primary/5 transition-colors overflow-hidden shadow-2xs">
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

                <!-- Nom & Catégorie -->
                <div class="w-full flex flex-col items-center gap-0.5 min-w-0">
                    <span class="font-heading font-extrabold text-xs sm:text-sm text-slate-800 group-hover:text-primary transition-colors truncate w-full" title="${escapeHTML(partner.name)}">
                        ${escapeHTML(partner.name)}
                    </span>
                    <span class="text-[10px] text-slate-400 font-semibold truncate w-full">
                        ${escapeHTML(partner.category_label || catConfig.label)}
                    </span>
                </div>

                <!-- Pastille Avantage Étudiant ou Badge -->
                ${partner.perk ? `
                    <div class="w-full px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/70 text-emerald-800 text-[10px] font-bold flex items-center justify-center gap-1 truncate" title="${escapeHTML(partner.perk)}">
                        <i class="fa-solid fa-gift text-emerald-600 text-[9px] shrink-0"></i>
                        <span class="truncate">${escapeHTML(partner.perk)}</span>
                    </div>
                ` : `
                    <div class="w-full px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold flex items-center justify-center gap-1">
                        <i class="fa-solid fa-circle-check text-emerald-500 text-[9px]"></i>
                        <span>Partenaire</span>
                    </div>
                `}
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
            <div class="bg-white w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-100 flex flex-col gap-4 relative animate-pop-in max-h-[90vh] overflow-y-auto no-scrollbar">
                <!-- Bouton Fermer -->
                <button 
                    type="button" 
                    id="btn-close-partner-modal"
                    aria-label="Fermer"
                    class="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center text-xs active:scale-90 transition-all cursor-pointer"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>

                <!-- En-tête : Logo Centré & Titre -->
                <div class="flex flex-col items-center text-center gap-3 pt-1">
                    <div class="w-20 h-20 rounded-2xl bg-slate-50 border border-slate-200/80 p-2.5 flex items-center justify-center shadow-xs overflow-hidden">
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
                                <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                    <i class="fa-solid fa-certificate text-[9px] mr-1 text-amber-600"></i>
                                    ${escapeHTML(partner.badge)}
                                </span>
                            ` : ''}
                        </div>
                        <h3 class="font-heading font-extrabold text-lg text-slate-900 mt-1">
                            ${escapeHTML(partner.name)}
                        </h3>
                    </div>
                </div>

                <!-- Description -->
                ${partner.description ? `
                    <div class="text-xs sm:text-sm text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        ${escapeHTML(partner.description)}
                    </div>
                ` : ''}

                <!-- Avantage Réservé aux Étudiants UIDT -->
                ${partner.perk ? `
                    <div class="p-3.5 sm:p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
                        <div class="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                            <i class="fa-solid fa-gift text-sm"></i>
                        </div>
                        <div class="flex flex-col min-w-0">
                            <span class="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">Avantage Étudiant Exclusif</span>
                            <span class="text-xs sm:text-sm font-extrabold text-emerald-950 mt-0.5 leading-snug">${escapeHTML(partner.perk)}</span>
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
                        class="w-full py-2 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all active:scale-95 cursor-pointer mt-1"
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

        containerEl.innerHTML = `
            <div class="flex flex-col gap-5 w-full">
                <!-- En-tête de la section -->
                <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200/80 pb-4">
                    <div>
                        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-2">
                            <i class="fa-solid fa-handshake"></i>
                            <span>Écosystème & Alliances UIDT</span>
                        </div>
                        <h2 class="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 tracking-tight">
                            Nos Partenaires Campus
                        </h2>
                        <p class="text-xs sm:text-sm text-slate-500 max-w-2xl mt-1">
                            Amicales étudiantes, solutions de paiement et commerces locaux engagés pour la vie étudiante à Thiès.
                        </p>
                    </div>

                    <!-- Bouton Devenir Partenaire En-tête -->
                    <div class="flex items-center">
                        <a 
                            href="${whatsappUrl}" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            id="btn-partner-cta-top"
                            class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-xs active:scale-95"
                        >
                            <i class="fa-brands fa-whatsapp text-sm"></i>
                            <span>Devenir Partenaire</span>
                        </a>
                    </div>
                </div>

                <!-- Grille des Partenaires Réels Côte à Côte -->
                ${currentPartners.length === 0 ? `
                    <!-- État d'attente élégant avant configuration des premiers partenaires par le SuperAdmin -->
                    <div class="text-center py-8 px-4 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col items-center justify-center gap-2">
                        <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-lg mb-1">
                            <i class="fa-solid fa-handshake-angle"></i>
                        </div>
                        <h3 class="font-heading font-extrabold text-sm sm:text-base text-slate-800">
                            Nos partenariats officiels arrivent très prochainement
                        </h3>
                        <p class="text-xs text-slate-500 max-w-md">
                            Amicales étudiantes, commerces de Thiès et sponsors engagés pour les étudiants de l'UIDT.
                        </p>
                    </div>
                ` : `
                    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 w-full">
                        ${currentPartners.map((partner) => renderPartnerTile(partner)).join('')}
                    </div>
                `}

                <!-- Bloc Appel à Candidature (Devenir Partenaire) -->
                <div class="bg-gradient-to-br from-slate-900 via-primary to-indigo-950 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg mt-2 w-full">
                    <div class="absolute -right-10 -bottom-10 w-44 h-44 bg-accent/20 rounded-full blur-2xl pointer-events-none"></div>
                    <div class="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                        <div class="flex flex-col gap-1.5 max-w-xl">
                            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-bold text-accent w-fit">
                                <i class="fa-solid fa-bullhorn"></i>
                                <span>Opportunité de Partenariat</span>
                            </span>
                            <h3 class="font-heading font-extrabold text-lg sm:text-xl text-white">
                                Vous êtes une amicale, un commerce ou un sponsor ?
                            </h3>
                            <p class="text-xs sm:text-sm text-slate-200 leading-relaxed">
                                Rejoignez l'écosystème Campus Market pour valoriser vos offres et services auprès de toute la communauté universitaire de Thiès.
                            </p>
                        </div>
                        <a 
                            href="${whatsappUrl}" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            id="btn-partner-cta-bottom"
                            class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs sm:text-sm shadow-md transition-all active:scale-95 shrink-0"
                        >
                            <i class="fa-brands fa-whatsapp text-base"></i>
                            <span>Devenir Partenaire Officiel</span>
                        </a>
                    </div>
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
