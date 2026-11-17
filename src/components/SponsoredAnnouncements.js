/**
 * Composant SponsoredAnnouncements
 * Affiche de manière discrète les annonces validées et actives sur l'accueil acheteur.
 * Si aucune annonce n'est publiée, le composant n'affiche rien (zéro encombrement visuel).
 */

import { supabase } from '../services/supabase.js';
import { FEATURE_FLAGS } from '../config/subscription.js';
import { escapeHTML } from '../utils/security.js';
import { resolveMediaUrl } from '../utils/image-compressor.js';

/**
 * Crée le conteneur des annonces sponsorisées de l'accueil.
 * @returns {HTMLElement}
 */
export function createSponsoredAnnouncements() {
    const containerEl = document.createElement('section');
    containerEl.id = 'sponsored-announcements-section';
    containerEl.className = 'w-full max-w-7xl mx-auto px-4 sm:px-6 my-2 sm:my-3 hidden';
    containerEl.setAttribute('aria-label', 'Annonces et Bons Plans du Campus');

    let announcements = [];

    async function fetchAnnouncements() {
        if (!FEATURE_FLAGS.ANNONCES_ENABLED) {
            containerEl.classList.add('hidden');
            return;
        }

        try {
            const nowIso = new Date().toISOString();
            const { data, error } = await supabase
                .from('advertisements')
                .select('id, title, content, image_url, link_url, validated_at, expires_at, seller:seller_id(prenom, nom, shop_name)')
                .eq('status', 'publiee')
                .gt('expires_at', nowIso)
                .order('validated_at', { ascending: false })
                .limit(5);

            if (error || !data || data.length === 0) {
                containerEl.classList.add('hidden');
                return;
            }

            announcements = data;
            render();
            containerEl.classList.remove('hidden');
        } catch {
            containerEl.classList.add('hidden');
        }
    }

    function render() {
        if (announcements.length === 0) {
            containerEl.classList.add('hidden');
            return;
        }

        const ad = announcements[0]; // Affichage épuré de l'annonce la plus récente
        const sellerName = ad.seller?.shop_name || (ad.seller?.prenom ? `Boutique ${ad.seller.prenom}` : 'Marchand UIDT');
        const resolvedImage = ad.image_url ? resolveMediaUrl(ad.image_url) : null;

        containerEl.innerHTML = `
            <div class="relative bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50/80 border border-amber-200/80 rounded-2xl p-3.5 sm:p-4 shadow-2xs flex flex-col sm:flex-row items-center gap-3 sm:gap-4 transition-all">
                ${resolvedImage ? `
                    <div class="w-full sm:w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-white border border-amber-200 shadow-2xs">
                        <img 
                            src="${escapeHTML(resolvedImage)}" 
                            alt="${escapeHTML(ad.title)}" 
                            class="w-full h-full object-cover"
                            loading="lazy"
                            decoding="async"
                            onerror="this.parentElement.style.display='none';"
                        >
                    </div>
                ` : ''}

                <div class="flex-1 min-w-0 text-center sm:text-left">
                    <div class="flex items-center justify-center sm:justify-start gap-2 mb-1 flex-wrap">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-slate-950 uppercase tracking-wider">
                            📢 Annonce Campus
                        </span>
                        <span class="text-[11px] text-slate-500 truncate">
                            Par ${escapeHTML(sellerName)}
                        </span>
                    </div>

                    <h4 class="font-heading font-extrabold text-sm sm:text-base text-slate-900 leading-snug">
                        ${escapeHTML(ad.title)}
                    </h4>

                    <p class="text-xs text-slate-700 mt-1 line-clamp-2 leading-relaxed">
                        ${escapeHTML(ad.content)}
                    </p>
                </div>

                ${ad.link_url ? `
                    <div class="shrink-0 w-full sm:w-auto mt-1 sm:mt-0">
                        <a 
                            href="${escapeHTML(ad.link_url)}" 
                            class="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-xs transition-all"
                        >
                            <span>Découvrir</span>
                            <i class="fa-solid fa-arrow-right text-[10px]"></i>
                        </a>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Chargement initial
    fetchAnnouncements();

    return containerEl;
}
