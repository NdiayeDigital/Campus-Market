/**
 * Tests Unitaires & d'Intégration :
 * 1. Promotions Illimitées & 10 Produits Actifs pour les Admins Marchands
 * 2. Système de Points (Strictement entre 5 et 10 pts) & Classement des Vendeurs
 * 3. Intégration Bouton Classement dans Profil Vendeur & Colonne Classement dans SuperAdmin
 * Campus Market - Université Iba Der Thiam de Thiès (UIDT).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    computePromotionQuota,
    computeSubscriptionStatus,
} from '../src/config/subscription.js';
import {
    POINTS_RULES,
    SELLER_TIERS,
    getSellerTier,
    computeSellerPoints,
    buildSellersLeaderboard,
    getSellerRankInfo,
    fetchCampusLeaderboard,
} from '../src/services/seller-ranking-service.js';
import {
    computeSellerOrderStats,
    buildAllSellersStatsMap,
} from '../src/services/admin-service.js';

console.log('🧪 Démarrage des tests : Promotions Illimitées Admin & Système de Points/Classement...');

// =========================================================================
// 1. Tests Promotions Illimitées & 10 Produits Actifs pour Admins Marchands
// =========================================================================

// 1.1 SuperAdmin bénéficie de promotions illimitées
const superAdminProfile = {
    id: 'admin-uuid-1',
    role: 'superadmin',
    subscription_plan: 'pro',
    subscription_status: 'superadmin',
};

const adminQuota = computePromotionQuota(superAdminProfile);
assert.equal(adminQuota.allowed, true, 'Un compte SuperAdmin doit être autorisé à promouvoir ses produits');
assert.equal(adminQuota.isSuperAdmin, true, 'isSuperAdmin doit être vrai');
assert.equal(adminQuota.remaining, 999, 'Les promotions doivent être illimitées (remaining: 999)');
assert.ok(adminQuota.counterText.includes('illimitée'), 'Le texte doit indiquer une mise en avant illimitée');
console.log('✅ [1.1] Promotions illimitées validées pour les comptes SuperAdmin !');

// 1.2 Non-SuperAdmin conserve ses quotas standards
const proProfile = {
    id: 'pro-uuid-2',
    role: 'vendeur',
    subscription_plan: 'starter', // Pack Pro 1 000 FCFA
    subscription_expires_at: new Date(Date.now() + 86400000 * 15).toISOString(),
    promotions_used_this_period: 0,
};
const proQuota = computePromotionQuota(proProfile);
assert.equal(proQuota.allowed, true);
assert.equal(proQuota.max, 1, 'Pack Pro doit avoir 1 promo par mois');
assert.equal(proQuota.remaining, 1);
assert.equal(proQuota.isBusiness, false);

const businessProfile = {
    id: 'biz-uuid-3',
    role: 'vendeur',
    subscription_plan: 'pro', // Pack Business 2 000 FCFA
    subscription_expires_at: new Date(Date.now() + 86400000 * 15).toISOString(),
    promotions_used_this_period: 0,
};
const bizQuota = computePromotionQuota(businessProfile);
assert.equal(bizQuota.allowed, true);
assert.equal(bizQuota.isBusiness, true);
assert.equal(bizQuota.max, 1, 'Pack Business doit avoir 1 promo par semaine');

const decouverteProfile = {
    id: 'dec-uuid-4',
    role: 'vendeur',
    subscription_plan: 'decouverte',
};
const decQuota = computePromotionQuota(decouverteProfile);
assert.equal(decQuota.allowed, false, 'Pack Découverte ne doit pas avoir de promotion');
console.log('✅ [1.2] Isolation stricte des quotas Pro (1/mois), Business (1/semaine) et Découverte (0) validée !');

// 1.3 SuperAdmin dispose toujours de 10 produits sans blocage de quota
const adminSubStatus = computeSubscriptionStatus(superAdminProfile);
assert.equal(adminSubStatus.maxProducts, 10, 'Un SuperAdmin doit avoir un plafond de 10 produits');
assert.equal(adminSubStatus.canPublish, true);
assert.equal(adminSubStatus.canSell, true);
console.log('✅ [1.3] Quota permanent de 10 articles actifs validé pour les comptes SuperAdmin !');

// =========================================================================
// 2. Tests du Barème des Points (Règle stricte : entre 5 et 10 points)
// =========================================================================

assert.ok(POINTS_RULES.DELIVERED_ORDER >= 5 && POINTS_RULES.DELIVERED_ORDER <= 10, 'Commande livrée doit valoir entre 5 et 10 points');
assert.equal(POINTS_RULES.DELIVERED_ORDER, 10, 'Commande livrée doit valoir 10 points (le max autorisé)');

assert.ok(POINTS_RULES.REVIEW_5_STAR >= 5 && POINTS_RULES.REVIEW_5_STAR <= 10, 'Avis 5 étoiles doit valoir entre 5 et 10 points');
assert.equal(POINTS_RULES.REVIEW_5_STAR, 8, 'Avis 5 étoiles fixé à 8 points');

assert.ok(POINTS_RULES.REVIEW_4_STAR >= 5 && POINTS_RULES.REVIEW_4_STAR <= 10, 'Avis 4 étoiles doit valoir entre 5 et 10 points');
assert.equal(POINTS_RULES.REVIEW_4_STAR, 6, 'Avis 4 étoiles fixé à 6 points');

assert.ok(POINTS_RULES.REVIEW_3_STAR >= 5 && POINTS_RULES.REVIEW_3_STAR <= 10, 'Avis 3 étoiles doit valoir entre 5 et 10 points');
assert.equal(POINTS_RULES.REVIEW_3_STAR, 5, 'Avis 3 étoiles fixé à 5 points');

assert.ok(POINTS_RULES.PROFILE_COMPLETE_BONUS >= 5 && POINTS_RULES.PROFILE_COMPLETE_BONUS <= 10, 'Bonus profil complet doit valoir entre 5 et 10 points');
assert.equal(POINTS_RULES.PROFILE_COMPLETE_BONUS, 5, 'Bonus profil complet fixé à 5 points');

assert.ok(POINTS_RULES.ACTIVE_SHOP_BONUS >= 5 && POINTS_RULES.ACTIVE_SHOP_BONUS <= 10, 'Bonus boutique active doit valoir entre 5 et 10 points');
assert.equal(POINTS_RULES.ACTIVE_SHOP_BONUS, 5, 'Bonus boutique active fixé à 5 points');

assert.ok(POINTS_RULES.CANCELLED_PENALTY >= 5 && POINTS_RULES.CANCELLED_PENALTY <= 10, 'Pénalité annulation doit valoir entre 5 et 10 points');
assert.equal(POINTS_RULES.CANCELLED_PENALTY, 5, 'Pénalité annulation fixée à 5 points');
console.log('✅ [2.1] Règle stricte respectée : tous les gains/pénalités sont calibrés entre 5 et 10 points !');

// =========================================================================
// 3. Tests de Calcul des Points et des Paliers (Bronze, Argent, Or, Diamant)
// =========================================================================

// Test 3.1 : Marchand Novice (Bronze)
const sellerNovice = {
    id: 's-novice',
    shop_name: 'Boutique Débutante',
    telephone: '771234567',
    pavillon: 'Pavillon A',
    chambre: '101',
    is_open: true,
};
const mockOrdersNovice = [
    { seller_id: 's-novice', status: 'delivered', price: 2000 }, // +10 pts
    { seller_id: 's-novice', status: 'delivered', price: 3000 }, // +10 pts
    { seller_id: 's-novice', status: 'cancelled', cancelled_by: 'seller', price: 1500 }, // -5 pts (vendeur)
    { seller_id: 's-novice', status: 'cancelled', cancelled_by: 'buyer', price: 1200 }, // 0 pt (client/acheteur)
];
const mockReviewsNovice = [
    { seller_id: 's-novice', rating: 5 }, // +8 pts
];
// Total attendu : 10 + 10 - 5 + 0 + 8 + 5 (profil) + 5 (active shop) = 33 pts -> Bronze
const pointsNovice = computeSellerPoints({
    seller: sellerNovice,
    orders: mockOrdersNovice,
    reviews: mockReviewsNovice,
    activeProductsCount: 2,
});
assert.equal(pointsNovice.totalPoints, 33, 'Le total de points doit être exactement 33');
assert.equal(pointsNovice.cancelledBySellerCount, 1, '1 commande annulée par le vendeur');
assert.equal(pointsNovice.cancelledByBuyerCount, 1, '1 commande annulée par l\'acheteur');
assert.equal(pointsNovice.breakdown.cancelledPenalty, 5, 'Pénalité de 5 points uniquement pour l\'annulation vendeur');
assert.equal(pointsNovice.tier.id, 'bronze', '33 points doit correspondre au niveau Bronze');
assert.equal(pointsNovice.tier.name, 'Bronze');
assert.equal(pointsNovice.tier.pointsToNextTier, 17, 'Il doit manquer 17 points pour atteindre Argent (50)');
console.log('✅ [3.1] Calcul exact, palier Bronze et distinction annulation vendeur/client validés !');

// Test 3.1.b : Vérification rigoureuse de la règle métier :
// Annulée par le client (cancelled_by === 'buyer') => 0 pénalité
// Annulée par le vendeur (cancelled_by === 'seller') => -5 pts
const testBuyerCancelled = computeSellerPoints({
    seller: { id: 's-test' },
    orders: [
        { seller_id: 's-test', status: 'delivered', price: 1000 }, // +10
        { seller_id: 's-test', status: 'cancelled', cancelled_by: 'buyer', price: 1000 }, // 0 pt
        { seller_id: 's-test', status: 'cancelled', cancelled_by: 'buyer', price: 2000 }, // 0 pt
    ],
});
assert.equal(testBuyerCancelled.totalPoints, 10, 'Une commande annulée par le client ne doit JAMAIS pénaliser le vendeur');
assert.equal(testBuyerCancelled.breakdown.cancelledPenalty, 0, 'La pénalité doit être strictement 0 pt');
assert.equal(testBuyerCancelled.cancelledByBuyerCount, 2);
assert.equal(testBuyerCancelled.cancelledBySellerCount, 0);

const testSellerCancelled = computeSellerPoints({
    seller: { id: 's-test' },
    orders: [
        { seller_id: 's-test', status: 'delivered', price: 1000 }, // +10
        { seller_id: 's-test', status: 'cancelled', cancelled_by: 'seller', price: 1000 }, // -5
    ],
});
assert.equal(testSellerCancelled.totalPoints, 5, 'Une commande refusée/annulée par le vendeur doit déduire 5 pts');
assert.equal(testSellerCancelled.breakdown.cancelledPenalty, 5);
assert.equal(testSellerCancelled.cancelledBySellerCount, 1);
assert.equal(testSellerCancelled.cancelledByBuyerCount, 0);
console.log('✅ [3.1.b] 0 pénalité pour les annulations clients et -5 pts pour annulation vendeur validé à 100% !');

// Test 3.2 : Paliers Argent (50+), Or (150+) et Diamant (300+)
const tierArgent = getSellerTier(60);
assert.equal(tierArgent.id, 'argent');
assert.equal(tierArgent.icon, '🥈');

const tierOr = getSellerTier(180);
assert.equal(tierOr.id, 'or');
assert.equal(tierOr.icon, '🥇');

const tierDiamant = getSellerTier(350);
assert.equal(tierDiamant.id, 'diamant');
assert.equal(tierDiamant.icon, '💎');
console.log('✅ [3.2] Paliers Argent (🥈), Or (🥇) et Diamant (💎) validés !');

// =========================================================================
// 4. Tests de Construction du Classement (Leaderboard Plateforme - Packs Payants Uniquement)
// =========================================================================

const sellers = [
    { id: 's-1', shop_name: 'Boutique Alpha', prenom: 'Amadou', nom: 'Diallo', role: 'vendeur', subscription_plan: 'starter', subscription_expires_at: new Date(Date.now() + 86400000 * 30).toISOString() },
    { id: 's-2', shop_name: 'Boutique Beta', prenom: 'Fatou', nom: 'Sow', role: 'vendeur', subscription_plan: 'pro', subscription_expires_at: new Date(Date.now() + 86400000 * 30).toISOString() },
    { id: 's-3', shop_name: 'Boutique Gamma', prenom: 'Moussa', nom: 'Diop', role: 'superadmin' },
    // Vendeur en formule gratuite Pack Découverte : doit être exclu du classement
    { id: 's-decouverte', shop_name: 'Boutique Découverte', prenom: 'Awa', nom: 'Fall', role: 'vendeur', subscription_plan: 'decouverte' },
];

const allOrders = [
    // s-1 : 4 livrées (+40 pts)
    { seller_id: 's-1', status: 'delivered', price: 1000 },
    { seller_id: 's-1', status: 'delivered', price: 1000 },
    { seller_id: 's-1', status: 'delivered', price: 1000 },
    { seller_id: 's-1', status: 'delivered', price: 1000 },
    // s-2 : 10 livrées (+100 pts) -> Devrait être #1
    ...Array(10).fill(null).map(() => ({ seller_id: 's-2', status: 'delivered', price: 1500 })),
    // s-3 : 1 livrée (+10 pts), 1 annulée vendeur (-5 pts), 1 annulée acheteur (0 pt) -> 5 pts
    { seller_id: 's-3', status: 'delivered', price: 500 },
    { seller_id: 's-3', status: 'cancelled', cancelled_by: 'seller', price: 500 },
    { seller_id: 's-3', status: 'cancelled', cancelled_by: 'buyer', price: 500 },
    // s-decouverte : 2 livrées (+20 pts)
    { seller_id: 's-decouverte', status: 'delivered', price: 1000 },
    { seller_id: 's-decouverte', status: 'delivered', price: 1000 },
];

const leaderboard = buildSellersLeaderboard(sellers, allOrders, []);
assert.equal(leaderboard.length, 3, 'Le leaderboard ne doit contenir QUE les 3 vendeurs payants (Découverte exclu)');
assert.equal(leaderboard.some((s) => s.id === 's-decouverte'), false, 'Un vendeur en Pack Découverte ne doit JAMAIS figurer dans le classement officiel');
assert.equal(leaderboard[0].id, 's-2', 'Boutique Beta avec 100 pts doit être classée #1');
assert.equal(leaderboard[0].rank, 1);
assert.equal(leaderboard[1].id, 's-1', 'Boutique Alpha avec 40 pts doit être classée #2');
assert.equal(leaderboard[1].rank, 2);
assert.equal(leaderboard[2].id, 's-3', 'Boutique Gamma avec 5 pts doit être classée #3');
assert.equal(leaderboard[2].rank, 3);
assert.equal(leaderboard[2].cancelledBySellerCount, 1);
assert.equal(leaderboard[2].cancelledByBuyerCount, 1);

const rankInfo = getSellerRankInfo('s-1', leaderboard);
assert.equal(rankInfo.rank, 2);
assert.equal(rankInfo.totalSellers, 3);
assert.equal(rankInfo.isPaid, true);

const rankInfoDecouverte = getSellerRankInfo('s-decouverte', leaderboard);
assert.equal(rankInfoDecouverte.rank, null, 'Un vendeur Découverte n\'a pas de rang officiel');
assert.equal(rankInfoDecouverte.isPaid, false);
console.log('✅ [4.1] Règle stricte respectée : seuls les vendeurs avec Pack Payant (Pro, Business, SuperAdmin) figurent au classement !');

// Test 4.2 : computeSellerOrderStats & buildAllSellersStatsMap dans admin-service
const sellerStats = computeSellerOrderStats(allOrders, 's-3');
assert.equal(sellerStats.deliveredCount, 1);
assert.equal(sellerStats.cancelledCount, 2);
assert.equal(sellerStats.cancelledBySellerCount, 1);
assert.equal(sellerStats.cancelledByBuyerCount, 1);
assert.equal(sellerStats.points, 5, 'Points admin pour s-3 doivent être 10 - 5 = 5 (l\'annulation client ne déduit aucun point)');

const statsMap = buildAllSellersStatsMap(allOrders);
assert.equal(statsMap['s-3'].cancelledBySellerCount, 1);
assert.equal(statsMap['s-3'].cancelledByBuyerCount, 1);
assert.equal(statsMap['s-3'].points, 5);
console.log('✅ [4.2] computeSellerOrderStats et buildAllSellersStatsMap avec traçabilité d\'annulation validés !');

// =========================================================================
// 5. Tests d'Intégration UI : Bouton Profil Vendeur & Colonne SuperAdmin
// =========================================================================

// 5.1 Profil Vendeur (SellerProfileView.js)
const profileViewFile = fs.readFileSync(path.resolve('src/components/seller/SellerProfileView.js'), 'utf8');
assert.ok(profileViewFile.includes('btn-open-leaderboard-from-profile'), 'Le bouton Classement doit être présent dans le profil vendeur');
assert.ok(profileViewFile.includes('Classement'), 'Le libellé Classement doit être présent');
assert.ok(profileViewFile.includes('openSellerLeaderboardModal'), 'L\'ouverture de la modale de classement doit être branchée');
console.log('✅ [5.1] Intégration du bouton Classement dans SellerProfileView validée !');

// 5.2 SuperAdmin Dashboard (SuperAdminDashboard.js)
const adminDashboardFile = fs.readFileSync(path.resolve('src/components/admin/SuperAdminDashboard.js'), 'utf8');
assert.ok(adminDashboardFile.includes('<th class="py-3 px-4">Classement</th>'), 'L\'en-tête doit s\'intituler strictement "Classement" au lieu de "Points & Rang"');
assert.ok(adminDashboardFile.includes('points_desc'), 'L\'option de tri par classement/points doit être présente');
assert.ok(adminDashboardFile.includes('🏆 Classement (Top Points)'), 'Le libellé du sélecteur de tri doit être présent');
assert.ok(!adminDashboardFile.includes('<th class="py-3 px-4">Points & Rang</th>'), 'L\'ancien libellé "Points & Rang" ne doit pas exister');
console.log('✅ [5.2] Intégration de la colonne "Classement" et du tri dans SuperAdminDashboard validée !');

// 5.3 ProductManager : SuperAdmin exempté de masquage quota
const productManagerFile = fs.readFileSync(path.resolve('src/components/seller/ProductManager.js'), 'utf8');
assert.ok(productManagerFile.includes('isSuperAdminSeller'), 'ProductManager doit vérifier si le vendeur est superadmin');
assert.ok(productManagerFile.includes('!isSuperAdminSeller'), 'Le masquage de quota doit être contourné pour les superadmins');
console.log('✅ [5.3] Maintien des 10 articles actifs sans masquage quota pour superadmin validé !');

// =========================================================================
// 6. Tests du Classement Inter-Vendeurs (Accès Dashboard, Modale, Filtre Pavillon & RPC)
// =========================================================================

// 6.1 Fonction de service fetchCampusLeaderboard
assert.equal(typeof fetchCampusLeaderboard, 'function', 'fetchCampusLeaderboard doit être exportée');
console.log('✅ [6.1] Fonction fetchCampusLeaderboard prête pour l\'agrégation inter-vendeurs !');

// 6.2 Intégration dans SellerDashboard.js
const sellerDashboardFile = fs.readFileSync(path.resolve('src/components/seller/SellerDashboard.js'), 'utf8');
assert.ok(sellerDashboardFile.includes('id="subtab-leaderboard"'), 'Bouton Classement présent dans la sidebar desktop');
assert.ok(sellerDashboardFile.includes('id="drawer-btn-leaderboard"'), 'Bouton Classement présent dans le tiroir mobile');
assert.ok(sellerDashboardFile.includes('id="card-seller-leaderboard"'), 'Bannière interactive Classement présente sur l\'accueil Dashboard');
assert.ok(sellerDashboardFile.includes('id="btn-open-leaderboard-dashboard"'), 'Bouton direct Voir le classement présent sur la bannière');
assert.ok(sellerDashboardFile.includes('fetchCampusLeaderboard'), 'SellerDashboard doit faire appel à fetchCampusLeaderboard');
console.log('✅ [6.2] Intégration complète de l\'accès au classement dans SellerDashboard (Sidebar, Drawer, Accueil) validée !');

// 6.3 Modale SellerLeaderboardModal.js : Plateforme uniquement (pas de filtres pavillons) & Réservé aux packs payants
const modalFile = fs.readFileSync(path.resolve('src/components/seller/SellerLeaderboardModal.js'), 'utf8');
assert.ok(modalFile.includes('Classement Plateforme') || modalFile.includes('Classement Officiel des Vendeurs'), 'Titre officiel Classement Plateforme présent');
assert.ok(!modalFile.includes('btn-filter-pavillon'), 'Les filtres par pavillon doivent être formellement supprimés (classement 100% plateforme)');
assert.ok(!modalFile.includes('leaderboard-pavillon-filters'), 'Le conteneur des filtres pavillons ne doit plus exister');
assert.ok(modalFile.includes('Pack Découverte'), 'Le bandeau d\'invitation pour les vendeurs Découverte doit être présent');
assert.ok(modalFile.includes('Pack Pro (1 000 F)') && modalFile.includes('Business (2 000 F)'), 'L\'explication de réservation aux formules Pro et Business doit être présente');
console.log('✅ [6.3] Modale de classement plateforme sans pavillon et avec invitation Pack Découverte validée !');

// 6.4 Migration SQL Additive pour l'agrégation inter-vendeurs avec filtre packs payants
const migrationFile = fs.readFileSync(path.resolve('database/migration_sellers_inter_ranking.sql'), 'utf8');
assert.ok(migrationFile.includes('CREATE OR REPLACE FUNCTION public.get_seller_ranking_stats()'), 'Fonction RPC get_seller_ranking_stats définie');
assert.ok(migrationFile.includes('SECURITY DEFINER'), 'La fonction doit être SECURITY DEFINER pour contourner l\'isolation des commandes sans fuite de données');
assert.ok(migrationFile.includes('cancelled_by_seller_count'), 'La fonction doit compter les annulations vendeur');
assert.ok(migrationFile.includes('delivered_orders_count'), 'La fonction doit compter les livraisons');
assert.ok(migrationFile.includes('subscription_expires_at > NOW()'), 'La fonction SQL doit filtrer exclusivement les abonnements payants actifs');
assert.ok(migrationFile.includes("p.role = 'superadmin'"), 'La fonction SQL doit inclure les comptes superadmin marchands');
console.log('✅ [6.4] Script de migration SQL additive avec filtre exclusif abonnements payants validé !');

console.log('🎉 TOUS LES TESTS DES PROMOTIONS ADMIN ET DU CLASSEMENT ONT RÉUSSI AVEC SUCCÈS !');
process.exit(0);
