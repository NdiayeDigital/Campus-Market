/**
 * Composant de présentation des pages institutionnelles et légales :
 * - À propos de Campus Market (#about)
 * - Conditions Générales d'Utilisation (#terms)
 * - Politique de Confidentialité & Données Personnelles (#privacy)
 */

import { ABOUT_DATA, TERMS_DATA, PRIVACY_DATA } from '../content/legal-content.js';
import { SUPPORT_CONFIG } from '../config/support.js';
import { escapeHTML } from '../utils/security.js';

const logoUrl = '/assets/logo.webp';
const logoDarkUrl = '/assets/logo-dark.webp';

/**
 * Crée la vue légale et institutionnelle complète avec onglets interactifs.
 * @param {Object} props
 * @param {'about'|'terms'|'privacy'} [props.initialTab='about'] - Onglet actif initial
 * @param {Function} [props.onBackToCatalog] - Callback pour retourner au catalogue
 * @param {Function} [props.onNavigate] - Callback pour changer d'URL hash
 * @returns {HTMLElement}
 */
export function createLegalView({ initialTab = 'about', onBackToCatalog, onNavigate } = {}) {
    const containerEl = document.createElement('div');
    containerEl.className = 'w-full flex flex-col gap-6 animate-fade-in max-w-5xl mx-auto py-2 sm:py-4';

    let currentTab = ['about', 'terms', 'privacy'].includes(initialTab) ? initialTab : 'about';

    function render() {
        containerEl.innerHTML = `
            <!-- 1. En-tête de navigation & Bouton retour -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
                <div class="flex items-center gap-3">
                    <button 
                        type="button" 
                        id="btn-back-catalog" 
                        class="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-primary flex items-center justify-center shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                        title="Retourner au catalogue"
                        aria-label="Retourner au catalogue"
                    >
                        <i class="fa-solid fa-arrow-left text-sm"></i>
                    </button>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                                UIDT Thiès
                            </span>
                            <span class="text-[11px] text-slate-400 font-medium">Informations & Règles</span>
                        </div>
                        <h1 class="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white leading-tight mt-0.5" id="legal-page-title">
                            ${getPageTitle(currentTab)}
                        </h1>
                    </div>
                </div>

                <!-- Bouton Support WhatsApp direct -->
                <a 
                    href="${SUPPORT_CONFIG.whatsappUrl}" 
                    target="_blank" 
                    rel="noopener"
                    class="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 rounded-xl text-xs font-bold transition-all shrink-0 self-start sm:self-auto shadow-xs active:scale-95"
                >
                    <i class="fa-brands fa-whatsapp text-sm text-emerald-600"></i>
                    <span>Assistance WhatsApp</span>
                </a>
            </div>

            <!-- 2. Barre d'onglets tactile & animée -->
            <div class="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-1 overflow-x-auto select-none no-scrollbar">
                <button 
                    type="button" 
                    data-tab-target="about"
                    class="flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer ${
                        currentTab === 'about'
                            ? 'bg-primary text-white shadow-sm shadow-primary/25'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                    }"
                >
                    <i class="fa-solid fa-circle-info ${currentTab === 'about' ? 'text-accent' : 'text-slate-400'}"></i>
                    <span>À Propos</span>
                </button>

                <button 
                    type="button" 
                    data-tab-target="terms"
                    class="flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer ${
                        currentTab === 'terms'
                            ? 'bg-primary text-white shadow-sm shadow-primary/25'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                    }"
                >
                    <i class="fa-solid fa-scroll ${currentTab === 'terms' ? 'text-accent' : 'text-slate-400'}"></i>
                    <span>Conditions d'Utilisation</span>
                </button>

                <button 
                    type="button" 
                    data-tab-target="privacy"
                    class="flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer ${
                        currentTab === 'privacy'
                            ? 'bg-primary text-white shadow-sm shadow-primary/25'
                            : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800'
                    }"
                >
                    <i class="fa-solid fa-shield-halved ${currentTab === 'privacy' ? 'text-accent' : 'text-slate-400'}"></i>
                    <span>Confidentialité</span>
                </button>
            </div>

            <!-- 3. Contenu de l'onglet actif -->
            <div id="legal-tab-content" class="w-full">
                ${currentTab === 'about' ? renderAboutTab() : ''}
                ${currentTab === 'terms' ? renderTermsTab() : ''}
                ${currentTab === 'privacy' ? renderPrivacyTab() : ''}
            </div>

            <!-- 4. Pied de page interne & Retour -->
            <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
                <div class="flex items-center gap-3 text-center sm:text-left">
                    <img src="${logoUrl}" alt="Campus Market" class="h-10 w-auto max-w-[140px] object-contain dark:hidden" onerror="this.src='/assets/logo.webp'">
                    <img src="${logoDarkUrl}" alt="Campus Market" class="h-10 w-auto max-w-[140px] object-contain hidden dark:block" onerror="this.src='/assets/logo-dark.webp'">
                    <div>
                        <span class="font-heading font-extrabold text-sm text-slate-900 dark:text-white block">Campus Market UIDT</span>
                        <span class="text-xs text-slate-500 dark:text-slate-400">Plateforme collaborative des étudiants de Thiès</span>
                    </div>
                </div>

                <div class="flex items-center gap-3">
                    <button 
                        type="button" 
                        id="btn-footer-back-catalog" 
                        class="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 flex items-center gap-2"
                    >
                        <i class="fa-solid fa-store text-xs text-primary"></i>
                        <span>Explorer les Offres</span>
                    </button>
                </div>
            </div>
        `;

        bindEvents();
    }

    function getPageTitle(tab) {
        if (tab === 'terms') return "Conditions Générales d'Utilisation (CGU)";
        if (tab === 'privacy') return "Politique de Confidentialité & Données";
        return "À Propos de Campus Market";
    }

    // =========================================================================
    // RENDU ONGLET 1 : À PROPOS
    // =========================================================================
    function renderAboutTab() {
        const d = ABOUT_DATA;
        return `
            <div class="flex flex-col gap-6 text-slate-800 dark:text-slate-200">
                <!-- Hero Banner Présentation -->
                <div class="bg-gradient-to-br from-primary to-blue-900 text-white rounded-3xl p-6 sm:p-8 lg:p-10 shadow-lg relative overflow-hidden">
                    <div class="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/5 blur-2xl pointer-events-none"></div>
                    <div class="max-w-2xl relative z-10">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider bg-white/10 text-white border border-white/20 mb-3 backdrop-blur-xs">
                            <i class="fa-solid fa-graduation-cap text-accent"></i> ${escapeHTML(d.badge)}
                        </span>
                        <h2 class="font-heading font-extrabold text-2xl sm:text-3xl lg:text-4xl leading-tight">
                            ${escapeHTML(d.title)}
                        </h2>
                        <p class="text-sm sm:text-base text-blue-100 mt-3 font-medium leading-relaxed">
                            ${escapeHTML(d.tagline)}
                        </p>
                    </div>
                </div>

                <!-- Histoire & Problème résolu -->
                <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
                    <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                        <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center text-sm">
                            <i class="fa-solid fa-bullseye"></i>
                        </div>
                        <h3 class="font-heading font-extrabold text-lg text-slate-900 dark:text-white">${escapeHTML(d.problemStory.title)}</h3>
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-3">
                        ${escapeHTML(d.problemStory.description)}
                    </p>
                    <div class="bg-amber-50/80 dark:bg-amber-950/40 border-l-4 border-amber-500 p-4 rounded-r-2xl my-3 text-xs sm:text-sm text-amber-950 dark:text-amber-200 font-medium leading-relaxed">
                        ${escapeHTML(d.problemStory.highlight)}
                    </div>
                    <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        ${escapeHTML(d.problemStory.conclusion)}
                    </p>
                </div>

                <!-- 4 Piliers Fondateurs -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    ${d.pillars.map((p) => `
                        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex items-start gap-4 hover:border-primary/40 transition-all">
                            <div class="w-12 h-12 rounded-2xl ${p.color} flex items-center justify-center text-lg shrink-0">
                                <i class="fa-solid ${p.icon}"></i>
                            </div>
                            <div>
                                <h4 class="font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white mb-1">${escapeHTML(p.title)}</h4>
                                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${escapeHTML(p.desc)}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Comment commander en 4 étapes -->
                <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
                    <div class="text-center max-w-xl mx-auto mb-6">
                        <span class="text-xs font-bold uppercase tracking-wider text-primary">Simplicité & Rapidité</span>
                        <h3 class="font-heading font-extrabold text-xl text-slate-900 dark:text-white mt-1">Commander en 4 Étapes</h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">De votre smartphone à votre chambre de pavillon</p>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
                        ${d.steps.map((st) => `
                            <div class="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/70 dark:border-slate-700 p-4 flex flex-col items-center text-center relative">
                                <div class="w-10 h-10 rounded-2xl bg-primary text-white font-heading font-extrabold text-sm flex items-center justify-center mb-3 shadow-xs">
                                    ${st.num}
                                </div>
                                <h5 class="font-heading font-bold text-xs sm:text-sm text-slate-900 dark:text-white mb-1">${escapeHTML(st.title)}</h5>
                                <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">${escapeHTML(st.desc)}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Zones couvertes sur le campus -->
                <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
                    <div class="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-slate-800 mb-4">
                        <div class="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center text-sm">
                            <i class="fa-solid fa-location-dot"></i>
                        </div>
                        <div>
                            <h3 class="font-heading font-extrabold text-lg text-slate-900 dark:text-white">Zones & Pavillons Couverts à Thiès</h3>
                            <p class="text-xs text-slate-400">Livraison de proximité assurée par les vendeurs du campus</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        ${d.zones.map((z) => `
                            <div class="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/70 dark:border-slate-700">
                                <span class="font-bold text-xs sm:text-sm text-slate-900 dark:text-white block">${escapeHTML(z.name)}</span>
                                <span class="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">${escapeHTML(z.desc)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Ambition & Contact officiel -->
                <div class="bg-slate-900 dark:bg-slate-800/90 text-white rounded-3xl p-6 sm:p-8 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-6 border dark:border-slate-700">
                    <div class="max-w-xl text-center sm:text-left">
                        <h4 class="font-heading font-extrabold text-lg text-white mb-2">${escapeHTML(d.ambition.title)}</h4>
                        <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">${escapeHTML(d.ambition.text)}</p>
                        <div class="flex items-center gap-3 mt-4 text-xs text-slate-400 flex-wrap justify-center sm:justify-start">
                            <span><i class="fa-solid fa-envelope mr-1 text-primary"></i> ${escapeHTML(d.contact.supportEmail)}</span>
                            <span>•</span>
                            <span><i class="fa-solid fa-globe mr-1 text-primary"></i> ${escapeHTML(d.contact.website)}</span>
                        </div>
                    </div>
                    <button 
                        type="button" 
                        data-action="go-to-seller-flow"
                        class="px-5 py-3 bg-accent hover:bg-accent-hover text-slate-950 font-heading font-extrabold text-xs sm:text-sm rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer shrink-0"
                    >
                        Devenir Vendeur UIDT
                    </button>
                </div>
            </div>
        `;
    }

    // =========================================================================
    // RENDU ONGLET 2 : CONDITIONS D'UTILISATION (CGU)
    // =========================================================================
    function renderTermsTab() {
        const t = TERMS_DATA;
        return `
            <div class="flex flex-col gap-6 text-slate-800 dark:text-slate-200">
                <!-- Cartouche d'avertissement & Version -->
                <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                ${escapeHTML(t.badge)}
                            </span>
                            <span class="text-xs text-slate-400 font-mono">${escapeHTML(t.version)}</span>
                        </div>
                        <h3 class="font-heading font-extrabold text-lg text-slate-900 dark:text-white mt-1">
                            Règles d'Utilisation de la Marketplace
                        </h3>
                        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Applicables à tous les étudiants acheteurs, vendeurs et partenaires de l'UIDT
                        </p>
                    </div>
                </div>

                <!-- 🌟 Charte d'engagement étudiant en 8 points (Annexe A du document officiel) -->
                <div class="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-3xl p-5 sm:p-7 shadow-xs">
                    <div class="flex items-center gap-3 pb-3 border-b border-amber-200/60 dark:border-amber-800/60 mb-4">
                        <div class="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-base shadow-xs shrink-0">
                            <i class="fa-solid fa-handshake-simple"></i>
                        </div>
                        <div>
                            <h4 class="font-heading font-extrabold text-base sm:text-lg text-amber-950 dark:text-amber-200">
                                La Charte d'Engagement Étudiant (8 Règles d'Or)
                            </h4>
                            <p class="text-xs text-amber-800 dark:text-amber-300">Ce que chaque étudiant s'engage à respecter sur le campus</p>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                        ${t.charterPoints.map((pt, idx) => `
                            <div class="flex items-start gap-2.5 bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-amber-200/50 dark:border-amber-800/50">
                                <span class="w-5 h-5 rounded-full bg-amber-500/20 text-amber-900 dark:text-amber-200 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                                    ${idx + 1}
                                </span>
                                <span class="font-medium text-slate-800 dark:text-slate-200 leading-snug">${escapeHTML(pt)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Boîte d'alerte : Rôle d'intermédiation & Paiements directs -->
                <div class="bg-blue-50 dark:bg-blue-950/40 border border-blue-200/90 dark:border-blue-900 rounded-2xl p-4 sm:p-5 flex items-start gap-3.5">
                    <div class="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center text-base shrink-0 shadow-xs mt-0.5">
                        <i class="fa-solid fa-scale-balanced"></i>
                    </div>
                    <div>
                        <h5 class="font-heading font-extrabold text-xs sm:text-sm text-blue-950 dark:text-blue-200">
                            Campus Market est une plateforme d'intermédiation technique
                        </h5>
                        <p class="text-xs text-blue-900/90 dark:text-blue-300 leading-relaxed mt-1">
                            La plateforme n'encaisse pas le paiement de vos commandes. Vous réglez directement votre marchand étudiant en <strong>Espèces</strong> ou par <strong>Wave / Orange Money</strong>. Chaque vendeur est entièrement responsable de ses produits, de leur qualité et de leur livraison en chambre.
                        </p>
                    </div>
                </div>

                <!-- Articles détaillés -->
                <div class="space-y-4">
                    ${t.sections.map((sec) => `
                        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs" id="term-${sec.id}">
                            <div class="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
                                <span class="w-7 h-7 rounded-lg bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                                    ${sec.num}
                                </span>
                                <h4 class="font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white">
                                    ${escapeHTML(sec.title)}
                                </h4>
                            </div>

                            ${sec.alert ? `
                                <div class="bg-rose-50 dark:bg-rose-950/40 border-l-4 border-rose-500 p-3 rounded-r-xl text-xs text-rose-900 dark:text-rose-200 font-bold mb-3 flex items-center gap-2">
                                    <i class="fa-solid fa-ban text-rose-600 dark:text-rose-400"></i>
                                    <span>${escapeHTML(sec.alert)}</span>
                                </div>
                            ` : ''}

                            <div class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                ${escapeHTML(sec.content)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // =========================================================================
    // RENDU ONGLET 3 : CONFIDENTIALITÉ & DONNÉES PERSONNELLES
    // =========================================================================
    function renderPrivacyTab() {
        const p = PRIVACY_DATA;
        return `
            <div class="flex flex-col gap-6 text-slate-800 dark:text-slate-200">
                <!-- En-tête protection des données -->
                <div class="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-xs">
                    <div class="flex items-center gap-2 mb-2">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            ${escapeHTML(p.badge)}
                        </span>
                        <span class="text-xs text-slate-400 font-mono">${escapeHTML(p.version)}</span>
                    </div>
                    <h3 class="font-heading font-extrabold text-xl sm:text-2xl text-slate-900 dark:text-white leading-tight">
                        Protection de Votre Vie Privée & Données Personnelles
                    </h3>
                    <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mt-2">
                        ${escapeHTML(p.intro)}
                    </p>
                </div>

                <!-- 4 Principes cardinaux de confidentialité -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    ${p.keyPrinciples.map((k) => `
                        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 shadow-xs flex items-start gap-3.5 hover:border-emerald-300 transition-all">
                            <div class="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-base shrink-0 shadow-xs">
                                <i class="fa-solid ${k.icon}"></i>
                            </div>
                            <div>
                                <h4 class="font-heading font-bold text-sm text-slate-900 dark:text-white mb-0.5">${escapeHTML(k.title)}</h4>
                                <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">${escapeHTML(k.desc)}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <!-- Articles de confidentialité -->
                <div class="space-y-4">
                    ${p.sections.map((sec) => `
                        <div class="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-xs">
                            <h4 class="font-heading font-bold text-sm sm:text-base text-slate-900 dark:text-white pb-2.5 mb-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
                                <i class="fa-solid fa-lock text-primary text-xs"></i>
                                <span>${escapeHTML(sec.title)}</span>
                            </h4>
                            <div class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                                ${escapeHTML(sec.content)}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    function bindEvents() {
        // Retour au catalogue
        containerEl.querySelector('#btn-back-catalog')?.addEventListener('click', () => {
            if (typeof onBackToCatalog === 'function') {
                onBackToCatalog();
            }
        });
        containerEl.querySelector('#btn-footer-back-catalog')?.addEventListener('click', () => {
            if (typeof onBackToCatalog === 'function') {
                onBackToCatalog();
            }
        });

        // Changement d'onglet
        containerEl.querySelectorAll('button[data-tab-target]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const target = btn.getAttribute('data-tab-target');
                if (target && target !== currentTab) {
                    currentTab = target;
                    if (typeof onNavigate === 'function') {
                        onNavigate(target);
                    }
                    render();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });

        // CTA Vendeur dans l'onglet À Propos
        containerEl.querySelector('button[data-action="go-to-seller-flow"]')?.addEventListener('click', () => {
            window.location.hash = '#seller';
        });
    }

    // Méthode publique pour changer d'onglet depuis l'extérieur
    containerEl.setActiveTab = function(tabName) {
        if (['about', 'terms', 'privacy'].includes(tabName) && tabName !== currentTab) {
            currentTab = tabName;
            render();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    render();
    return containerEl;
}

export default createLegalView;
