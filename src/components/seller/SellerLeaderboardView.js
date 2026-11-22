/**
 * Composant SellerLeaderboardView
 * Vue intégrée pleine page du Classement Officiel de la Plateforme (Campus UIDT).
 * Affiche la liste ordonnée des marchands méritocratiques sans aucune modale flottante.
 */

import { fetchCampusLeaderboard } from '../../services/seller-ranking-service.js';
import { escapeHTML } from '../../utils/security.js';

/**
 * Crée la vue intégrée du classement des vendeurs du campus.
 *
 * @param {Object} props
 * @param {string} props.currentSellerId - UUID du vendeur connecté
 * @param {Function} [props.onBack] - Callback de retour vers le tableau de bord
 * @param {Function} [props.onOpenSubscription] - Callback pour ouvrir la modale d'abonnement
 * @returns {HTMLElement} Élément DOM de la vue classement
 */
export function createSellerLeaderboardView({ currentSellerId, onBack, onOpenSubscription } = {}) {
    const containerEl = document.createElement('div');
    containerEl.id = 'seller-leaderboard-view';
    containerEl.className = 'w-full flex flex-col gap-6 animate-fade-in pb-12';

    let leaderboard = [];
    let isLoading = true;
    let errorMessage = '';

    async function loadData() {
        isLoading = true;
        errorMessage = '';
        render();

        try {
            leaderboard = await fetchCampusLeaderboard({ currentSellerId });
        } catch (err) {
            console.error('[SellerLeaderboardView] Erreur chargement leaderboard:', err);
            errorMessage = 'Impossible de charger le classement de la plateforme actuellement.';
        } finally {
            isLoading = false;
            render();
        }
    }

    function render() {
        if (isLoading) {
            containerEl.innerHTML = `
                <div class="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-xs flex flex-col items-center justify-center gap-4 min-h-[350px]">
                    <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shadow-xs">
                        <i class="fa-solid fa-trophy fa-bounce"></i>
                    </div>
                    <div class="flex flex-col items-center text-center">
                        <h3 class="font-heading font-black text-slate-900 text-base">Chargement du Classement Officiel...</h3>
                        <p class="text-xs text-slate-500 mt-1">Calcul des scores méritocratiques et vérification des packs payants en cours.</p>
                    </div>
                </div>
            `;
            return;
        }

        if (errorMessage) {
            containerEl.innerHTML = `
                <div class="bg-white rounded-3xl border border-rose-200 p-8 shadow-xs flex flex-col items-center justify-center text-center gap-4 min-h-[300px]">
                    <div class="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center text-xl">
                        <i class="fa-solid fa-triangle-exclamation"></i>
                    </div>
                    <div>
                        <h3 class="font-heading font-bold text-slate-900 text-base">Erreur de chargement</h3>
                        <p class="text-xs text-slate-600 mt-1">${escapeHTML(errorMessage)}</p>
                    </div>
                    <div class="flex items-center gap-3">
                        <button type="button" id="btn-retry-leaderboard" class="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-xs active:scale-95 cursor-pointer">
                            <i class="fa-solid fa-rotate-right mr-1.5"></i>Réessayer
                        </button>
                        ${typeof onBack === 'function' ? `
                            <button type="button" id="btn-error-back-dashboard" class="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 active:scale-95 cursor-pointer">
                                ← Retour au tableau de bord
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
            bindEvents();
            return;
        }

        const currentSellerInfo = leaderboard.find((s) => s.id === currentSellerId) || leaderboard.currentSellerInfo || null;
        const isCurrentSellerRanked = Boolean(currentSellerInfo && currentSellerInfo.rank !== null && currentSellerInfo.rank !== undefined);
        const topThree = leaderboard.slice(0, 3);

        // Calcul de l'écart avec le vendeur précédent si classé
        let gapMessage = '';
        if (isCurrentSellerRanked) {
            if (currentSellerInfo.rank === 1) {
                gapMessage = '👑 Félicitations ! Vous occupez la 1ère place de la plateforme Campus Market !';
            } else {
                const sellerAbove = leaderboard[currentSellerInfo.rank - 2];
                if (sellerAbove) {
                    const diff = Math.max(1, (sellerAbove.points - currentSellerInfo.points) + 1);
                    gapMessage = `🔥 Plus que <strong>${diff} pt${diff > 1 ? 's' : ''}</strong> pour dépasser <em>${escapeHTML(sellerAbove.shopName)}</em> (#${sellerAbove.rank})`;
                }
            }
        }

        containerEl.innerHTML = `
            <!-- 1. EN-TÊTE DU CLASSEMENT OFFICIEL -->
            <div class="flex items-center justify-between gap-3 flex-wrap bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div class="flex items-center gap-3">
                    ${typeof onBack === 'function' ? `
                        <button 
                            type="button" 
                            id="btn-leaderboard-back-dashboard" 
                            class="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer active:scale-95"
                            title="Retour"
                        >
                            <i class="fa-solid fa-arrow-left text-xs"></i>
                            <span>${currentSellerId ? 'Tableau de bord' : 'Retour aux offres'}</span>
                        </button>
                    ` : ''}
                    <div class="flex items-center gap-2.5">
                        <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                        <div>
                            <h2 class="font-heading font-black text-slate-900 text-sm sm:text-base leading-tight">
                                Classement Officiel de la Plateforme
                            </h2>
                            <span class="text-[11px] text-slate-500 hidden sm:inline">Méritocratie des marchands certifiés • Campus UIDT</span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2">
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs">
                        Packs Pro & Business
                    </span>
                    <button 
                        type="button" 
                        id="btn-refresh-leaderboard" 
                        class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-xs transition-colors cursor-pointer active:scale-95 shadow-2xs"
                        title="Actualiser les scores en temps réel"
                    >
                        <i class="fa-solid fa-arrows-rotate"></i>
                    </button>
                </div>
            </div>

            <!-- 2. BARÈME MÉDITOCRATIQUE OFFICIEL (5 à 10 points) -->
            <div class="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
                <div class="flex items-center justify-between gap-2 mb-3">
                    <h4 class="font-heading font-extrabold text-xs uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                        <i class="fa-solid fa-calculator text-primary"></i>
                        <span>Barème Officiel des Points (Entre 5 et 10 points)</span>
                    </h4>
                    <span class="text-[11px] text-slate-400 font-medium hidden sm:inline">Calcul automatique et équitable</span>
                </div>
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                    <div class="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                        <span class="text-sm font-black text-emerald-700 block">+10 pts</span>
                        <span class="text-[11px] text-slate-600 font-semibold block mt-0.5">Commande livrée</span>
                    </div>
                    <div class="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80">
                        <span class="text-sm font-black text-amber-700 block">+8 pts</span>
                        <span class="text-[11px] text-slate-600 font-semibold block mt-0.5">Avis client 5★</span>
                    </div>
                    <div class="p-3 rounded-xl bg-blue-50/70 border border-blue-200/80">
                        <span class="text-sm font-black text-primary block">+5 pts</span>
                        <span class="text-[11px] text-slate-600 font-semibold block mt-0.5">Profil vérifié & actif</span>
                    </div>
                    <div class="p-3 rounded-xl bg-rose-50/70 border border-rose-200/80">
                        <span class="text-sm font-black text-rose-700 block">-5 pts</span>
                        <span class="text-[11px] text-slate-600 font-semibold block mt-0.5">Annulée par vendeur (0 client)</span>
                    </div>
                </div>
            </div>

            <!-- 3. PODIUM DE LA PLATEFORME (TOP 3 🥇🥈🥉) -->
            ${topThree.length > 0 ? `
                <div class="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col gap-4">
                    <div class="flex items-center justify-between gap-3">
                        <h3 class="font-heading font-extrabold text-sm sm:text-base text-slate-900 flex items-center gap-2">
                            <span>🥇🥈🥉</span>
                            <span>Podium d'Honneur de la Plateforme</span>
                        </h3>
                        <span class="text-xs text-slate-400 font-medium">Top 3 Campus</span>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        ${topThree.map((seller) => {
                            const isCurrent = seller.id === currentSellerId;
                            const medal = seller.rank === 1 ? '🥇' : (seller.rank === 2 ? '🥈' : '🥉');
                            const borderClass = seller.rank === 1 
                                ? 'border-amber-300 bg-gradient-to-b from-amber-50/70 to-white shadow-sm ring-1 ring-amber-300/50' 
                                : (seller.rank === 2 ? 'border-slate-300 bg-gradient-to-b from-slate-50 to-white' : 'border-orange-200 bg-gradient-to-b from-orange-50/40 to-white');

                            return `
                                <div class="p-4 rounded-2xl border ${borderClass} flex flex-col items-center text-center relative ${isCurrent ? 'ring-2 ring-primary ring-offset-2' : ''}">
                                    ${isCurrent ? `
                                        <span class="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-primary text-white shadow-2xs">
                                            Vous
                                        </span>
                                    ` : ''}
                                    <span class="text-3xl mb-1">${medal}</span>
                                    <span class="text-[10px] font-black uppercase text-slate-400">Rang #${seller.rank}</span>
                                    <h4 class="font-heading font-black text-sm sm:text-base text-slate-900 truncate w-full mt-1">
                                        ${escapeHTML(seller.shopName)}
                                    </h4>
                                    <span class="text-[11px] text-slate-500 font-medium truncate w-full">
                                        ${escapeHTML(seller.prenom ? `${seller.prenom} ${seller.nom || ''}`.trim() : 'Marchand')}
                                    </span>
                                    <div class="mt-2.5 flex items-center gap-1.5">
                                        <span class="text-xs font-black ${seller.tier.badgeClass} px-2.5 py-0.5 rounded-full border">
                                            ${seller.tier.icon} ${seller.tier.name}
                                        </span>
                                    </div>
                                    <span class="mt-2 font-heading font-black text-base text-primary tabular-nums">
                                        ${seller.points} pts
                                    </span>
                                    <div class="mt-1 text-[11px] text-slate-500 flex items-center gap-2">
                                        <span>${seller.deliveredCount} livraison${seller.deliveredCount > 1 ? 's' : ''}</span>
                                        <span>•</span>
                                        <span class="text-amber-600 font-bold">★ ${seller.avgRating > 0 ? seller.avgRating.toFixed(1) : '5.0'}</span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            ` : ''}

            <!-- 5. LISTE PLEINE PAGE DE TOUS LES VENDEURS CLASSÉS (EN LISTE ÉPURÉE) -->
            <div class="bg-white rounded-3xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col gap-4">
                <div class="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                        <h3 class="font-heading font-black text-sm sm:text-base text-slate-900">
                            Tous les Marchands Classés (${leaderboard.length})
                        </h3>
                        <p class="text-xs text-slate-500 mt-0.5">
                            Liste officielle par ordre décroissant de points méritocratiques
                        </p>
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                        🏆 Top Campus UIDT
                    </span>
                </div>

                <div id="leaderboard-sellers-list" class="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/40">
                    ${leaderboard.length === 0 ? `
                        <div class="p-8 text-center text-xs sm:text-sm text-slate-500 font-medium">
                            Aucun marchand avec pack payant actif sur la plateforme pour le moment.
                        </div>
                    ` : leaderboard.map((seller) => {
                        const isCurrent = seller.id === currentSellerId;

                        return `
                            <div class="p-3.5 sm:p-4 flex items-center justify-between gap-3 sm:gap-4 ${
                                isCurrent 
                                    ? 'bg-primary/5 font-semibold ring-2 ring-primary/30 z-10' 
                                    : 'bg-white hover:bg-slate-50'
                            } transition-colors">
                                <!-- Position & Identité -->
                                <div class="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                                    <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl ${
                                        seller.rank === 1 
                                            ? 'bg-amber-400 text-slate-950 font-black' 
                                            : (seller.rank === 2 ? 'bg-slate-300 text-slate-900 font-black' : (seller.rank === 3 ? 'bg-amber-200 text-amber-950 font-black' : 'bg-slate-100 text-slate-700 font-bold'))
                                    } flex items-center justify-center text-xs sm:text-sm tabular-nums shrink-0 shadow-2xs">
                                        #${seller.rank}
                                    </div>

                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="font-heading font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                                                ${escapeHTML(seller.shopName)}
                                            </span>
                                            ${isCurrent ? `
                                                <span class="px-2 py-0.2 rounded-full text-[9px] font-black uppercase bg-primary text-white shadow-2xs">
                                                    Vous
                                                </span>
                                            ` : ''}
                                            <span class="text-[10px] font-bold ${seller.tier.badgeClass} px-2 py-0.2 rounded-full border shrink-0">
                                                ${seller.tier.icon} ${seller.tier.name}
                                            </span>
                                        </div>
                                        <div class="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                                            <span>${escapeHTML(seller.prenom ? `${seller.prenom} ${seller.nom || ''}`.trim() : 'Marchand UIDT')}</span>
                                            ${seller.pavillon ? `
                                                <span>•</span>
                                                <span class="flex items-center gap-0.5">
                                                    <i class="fa-solid fa-location-dot text-rose-500 text-[9px]"></i>
                                                    <span>${escapeHTML(seller.pavillon)}</span>
                                                </span>
                                            ` : ''}
                                            <span>•</span>
                                            <span class="text-emerald-700 font-medium">${seller.deliveredCount} vente${seller.deliveredCount > 1 ? 's' : ''}</span>
                                            <span>•</span>
                                            <span class="text-amber-600 font-bold">★ ${seller.avgRating > 0 ? seller.avgRating.toFixed(1) : '5.0'} (${seller.reviewsCount})</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Score en points -->
                                <div class="text-right shrink-0">
                                    <span class="font-heading font-black text-sm sm:text-base text-primary tabular-nums block">
                                        ${seller.points} pts
                                    </span>
                                    <span class="text-[10px] text-slate-400 font-medium hidden sm:inline">
                                        Total méritoire
                                    </span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        bindEvents();
    }

    function bindEvents() {
        containerEl.querySelector('#btn-leaderboard-back-dashboard')?.addEventListener('click', () => {
            if (typeof onBack === 'function') onBack();
        });

        containerEl.querySelector('#btn-error-back-dashboard')?.addEventListener('click', () => {
            if (typeof onBack === 'function') onBack();
        });

        containerEl.querySelector('#btn-refresh-leaderboard')?.addEventListener('click', () => {
            loadData();
        });

        containerEl.querySelector('#btn-retry-leaderboard')?.addEventListener('click', () => {
            loadData();
        });

        containerEl.querySelector('#btn-upgrade-from-leaderboard-view')?.addEventListener('click', () => {
            if (typeof onOpenSubscription === 'function') {
                onOpenSubscription();
            } else {
                window.dispatchEvent(new CustomEvent('open-subscription-modal'));
            }
        });
    }

    loadData();

    return containerEl;
}

export default createSellerLeaderboardView;
