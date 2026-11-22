/**
 * Modale interactive : Classement Officiel de la Plateforme (Leaderboard UIDT)
 * Affiche le podium et la liste de tous les marchands payants de la plateforme (Packs Pro & Business),
 * les points cumulés et la position du vendeur connecté.
 */

import { escapeHTML } from '../../utils/security.js';

/**
 * Crée et affiche la modale de classement de la plateforme.
 * @param {Object} props
 * @param {Array} props.leaderboard - Liste ordonnée des vendeurs payants avec rank, points, tier, stats
 * @param {string} props.currentSellerId - ID du vendeur connecté
 * @param {Function} [props.onClose] - Callback à la fermeture
 */
export function openSellerLeaderboardModal({ leaderboard = [], currentSellerId = null, onClose } = {}) {
    const existing = document.getElementById('seller-leaderboard-modal');
    if (existing) existing.remove();

    // Récupération des informations du vendeur connecté
    const currentSellerInfo = leaderboard.find((s) => s.id === currentSellerId) || leaderboard.currentSellerInfo || null;
    const isCurrentSellerRanked = Boolean(currentSellerInfo && currentSellerInfo.rank !== null && currentSellerInfo.rank !== undefined);

    const overlay = document.createElement('div');
    overlay.id = 'seller-leaderboard-modal';
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-fade-in';

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

    overlay.innerHTML = `
        <div class="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-scale-up">
            <!-- En-tête de la modale avec dégradé campus -->
            <div class="bg-gradient-to-r from-primary to-blue-700 text-white p-5 sm:p-6 relative">
                <button 
                    type="button" 
                    id="btn-close-leaderboard-modal"
                    class="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-sm transition-colors cursor-pointer"
                    title="Fermer"
                >
                    <i class="fa-solid fa-xmark"></i>
                </button>

                <div class="flex items-center gap-2 mb-1">
                    <span class="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-white/20 text-amber-300">
                        🏆 Classement Plateforme
                    </span>
                    <span class="text-xs text-white/80">Campus UIDT</span>
                </div>
                <h3 class="font-heading font-black text-xl sm:text-2xl text-white">
                    Classement Officiel des Vendeurs
                </h3>
                <p class="text-xs text-white/80 mt-1 max-w-md">
                    Classement méritocratique de tous les marchands actifs du campus de l’Université Iba Der Thiam de Thiès.
                </p>

                <!-- Carte du vendeur connecté -->
                ${isCurrentSellerRanked ? `
                    <!-- Position Officielle du Vendeur -->
                    <div class="mt-4 p-3.5 rounded-2xl bg-white/10 backdrop-blur-xs border border-white/20 flex flex-col gap-2">
                        <div class="flex items-center justify-between gap-3 flex-wrap">
                            <div class="flex items-center gap-3">
                                <div class="w-11 h-11 rounded-xl bg-white text-slate-900 font-heading font-black text-sm flex items-center justify-center shadow-md">
                                    #${currentSellerInfo.rank}
                                </div>
                                <div>
                                    <span class="text-xs text-white/80 font-medium block">Votre Rang Plateforme (${currentSellerInfo.rank}e sur ${leaderboard.length})</span>
                                    <span class="font-heading font-black text-sm sm:text-base text-white">
                                        ${escapeHTML(currentSellerInfo.shopName)}
                                    </span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="px-3 py-1 rounded-full text-xs font-black ${currentSellerInfo.tier?.badgeClass || 'bg-slate-100 text-slate-700'} border flex items-center gap-1.5 shadow-xs">
                                    <span>${currentSellerInfo.tier?.icon || '🌱'}</span>
                                    <span>${currentSellerInfo.tier?.name || 'Débutant'}</span>
                                </span>
                                <span class="font-heading font-black text-lg text-amber-300 tabular-nums">
                                    ${currentSellerInfo.points || 0} pts
                                </span>
                            </div>
                        </div>
                        ${gapMessage ? `
                            <div class="text-[11px] text-amber-200/90 bg-white/5 py-1 px-2.5 rounded-lg border border-white/10">
                                ${gapMessage}
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>

            <!-- Corps défilant du classement -->
            <div class="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1">
                <!-- Barème explicatif rapide (5 à 10 points) -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                    <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span class="text-xs font-black text-emerald-600 block">+10 pts</span>
                        <span class="text-[10px] text-slate-500 font-semibold">Par commande livrée</span>
                    </div>
                    <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span class="text-xs font-black text-amber-600 block">+8 pts</span>
                        <span class="text-[10px] text-slate-500 font-semibold">Par avis 5 étoiles ⭐</span>
                    </div>
                    <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span class="text-xs font-black text-primary block">+5 pts</span>
                        <span class="text-[10px] text-slate-500 font-semibold">Profil 100% complet</span>
                    </div>
                    <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span class="text-xs font-black text-rose-600 block">-5 pts</span>
                        <span class="text-[10px] text-slate-500 font-semibold">Annulée par vendeur (0 pt client)</span>
                    </div>
                </div>

                <!-- Podium des 3 premiers -->
                ${topThree.length > 0 ? `
                    <div>
                        <h4 class="font-heading font-bold text-xs uppercase text-slate-400 tracking-wider mb-3">
                            Podium de la Plateforme 🥇🥈🥉
                        </h4>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            ${topThree.map((seller) => {
                                const isCurrent = seller.id === currentSellerId;
                                const medal = seller.rank === 1 ? '🥇' : (seller.rank === 2 ? '🥈' : '🥉');
                                const borderClass = seller.rank === 1 ? 'border-amber-400 bg-amber-50/40 shadow-md' : (seller.rank === 2 ? 'border-slate-300 bg-slate-50' : 'border-orange-200 bg-orange-50/30');

                                return `
                                    <div class="p-3.5 rounded-2xl border ${borderClass} flex flex-col items-center text-center relative ${isCurrent ? 'ring-2 ring-primary ring-offset-1' : ''}">
                                        <span class="text-2xl mb-1">${medal}</span>
                                        <span class="text-[10px] font-black uppercase text-slate-400">Rang #${seller.rank}</span>
                                        <span class="font-heading font-extrabold text-xs sm:text-sm text-slate-900 truncate w-full mt-0.5">
                                            ${escapeHTML(seller.shopName)}
                                        </span>
                                        <div class="mt-2 flex items-center gap-1.5">
                                            <span class="text-xs font-black ${seller.tier.badgeClass} px-2 py-0.5 rounded-full border">
                                                ${seller.tier.icon} ${seller.tier.name}
                                            </span>
                                        </div>
                                        <span class="mt-1 font-heading font-black text-sm text-primary tabular-nums">
                                            ${seller.points} pts
                                        </span>
                                        <span class="text-[10px] text-slate-400 mt-0.5">
                                            ${seller.deliveredCount} livraison${seller.deliveredCount > 1 ? 's' : ''}
                                        </span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- Liste unique et globale de tous les vendeurs classés sur la plateforme -->
                <div>
                    <div class="flex items-center justify-between gap-3 mb-3">
                        <h4 class="font-heading font-bold text-xs uppercase text-slate-400 tracking-wider">
                            Tous les Marchands Classés (${leaderboard.length})
                        </h4>
                        <span class="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                            Tous les Marchands
                        </span>
                    </div>

                    <div id="leaderboard-sellers-container" class="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden bg-slate-50/50">
                        ${leaderboard.length === 0 ? `
                            <div class="p-6 text-center text-xs text-slate-400 font-medium">
                                Aucun marchand enregistré actuellement.
                            </div>
                        ` : leaderboard.map((seller) => {
                            const isCurrent = seller.id === currentSellerId;

                            return `
                                <div class="p-3 sm:p-3.5 flex items-center justify-between gap-3 ${isCurrent ? 'bg-primary/5 font-semibold ring-1 ring-primary/20' : 'hover:bg-white'} transition-colors">
                                    <div class="flex items-center gap-3 min-w-0">
                                        <span class="w-7 h-7 rounded-lg ${seller.rank <= 3 ? 'bg-amber-100 text-amber-900 font-black' : 'bg-slate-200 text-slate-700 font-bold'} flex items-center justify-center text-xs tabular-nums shrink-0">
                                            #${seller.rank}
                                        </span>
                                        <div class="min-w-0">
                                            <div class="flex items-center gap-1.5">
                                                <span class="font-heading font-extrabold text-xs sm:text-sm text-slate-900 truncate">
                                                    ${escapeHTML(seller.shopName)}
                                                </span>
                                                ${isCurrent ? `<span class="px-1.5 py-0.2 rounded-md bg-primary text-white text-[9px] font-bold">Vous</span>` : ''}
                                            </div>
                                            <span class="text-[10px] text-slate-400 block truncate">
                                                ${seller.pavillon ? `Pavillon ${escapeHTML(seller.pavillon)}` : 'Campus UIDT'} • ${seller.deliveredCount} commande${seller.deliveredCount > 1 ? 's' : ''} livrée${seller.deliveredCount > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                    </div>
                                    <div class="flex items-center gap-2 shrink-0">
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${seller.tier.badgeClass} border hidden sm:inline-flex items-center gap-1">
                                            ${seller.tier.icon} ${seller.tier.name}
                                        </span>
                                        <span class="font-heading font-black text-xs sm:text-sm text-slate-900 tabular-nums">
                                            ${seller.points} pts
                                        </span>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <!-- Pied de page avec bouton fermer -->
            <div class="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                <span class="text-[11px] text-slate-400">
                    Mise à jour en temps réel • Campus UIDT
                </span>
                <button 
                    type="button" 
                    id="btn-close-leaderboard-modal-footer"
                    class="px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold transition-all cursor-pointer"
                >
                    Fermer
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
        overlay.classList.add('animate-fade-out');
        setTimeout(() => {
            overlay.remove();
            if (typeof onClose === 'function') onClose();
        }, 150);
    };

    overlay.querySelector('#btn-close-leaderboard-modal')?.addEventListener('click', closeModal);
    overlay.querySelector('#btn-close-leaderboard-modal-footer')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
}

export default {
    openSellerLeaderboardModal,
};
