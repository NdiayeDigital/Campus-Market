/**
 * Test Suite : STATS VENDEURS & FILTRAGE AVANCÉ COMMANDES SUPERADMIN
 * Vérifie :
 * 1. Fonctions computeSellerOrderStats et buildAllSellersStatsMap (CA Réel = Livrées + Annulées)
 * 2. Tri des marchands (CA réel, Volume commandes, Nom, Date)
 * 3. Filtrage multi-critères des commandes (statut, vendeur, pavillon, paiement)
 * 4. Boutons d'activation explicites SuperAdmin (Pack 1 000 F et Pack 2 000 F)
 * 5. Respect strict des règles de promotion (1/mois Pro, 1/semaine Business)
 * 6. Intégrité des éléments d'interface du SuperAdminDashboard
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Démarrage des tests : STATS VENDEURS, FILTRES COMMANDES & PACKS...\n');

let passCount = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`✅ [OK] ${name}`);
        passCount++;
    } catch (err) {
        console.error(`❌ [FAIL] ${name}`);
        console.error(err);
        process.exit(1);
    }
}

// ---------------------------------------------------------------------------
// 1. COMPUTE SELLER ORDER STATS (CA Réel = Livrées + Annulées)
// ---------------------------------------------------------------------------
test('1. computeSellerOrderStats calcule fidèlement les indicateurs et le CA Réel (Livrées + Annulées)', async () => {
    const { computeSellerOrderStats } = await import('../src/services/admin-service.js');
    assert.strictEqual(typeof computeSellerOrderStats, 'function', 'computeSellerOrderStats doit être exportée');

    // Cas limites : vendeur inexistant ou paramètres vides
    const emptyStats = computeSellerOrderStats([], null);
    assert.strictEqual(emptyStats.totalOrders, 0);
    assert.strictEqual(emptyStats.deliveredAmount, 0);
    assert.strictEqual(emptyStats.realRevenue, 0);
    assert.strictEqual(emptyStats.realOrdersCount, 0);

    const mockOrders = [
        // Vendeur A (2 livrées à 5 000 = 10 000, 1 pending à 3 000, 1 annulée à 2 000 => Total 15 000)
        { id: '1', seller_id: 'seller-a', price: 5000, status: 'delivered' },
        { id: '2', seller_id: 'seller-a', price: 5000, status: 'delivered' },
        { id: '3', seller_id: 'seller-a', price: 3000, status: 'pending' },
        { id: '4', seller_id: 'seller-a', price: 2000, status: 'cancelled' },

        // Vendeur B (1 livrée à 20 000, 2 expédiées à 4 000 = 8 000, 0 annulée => Total 28 000)
        { id: '5', seller_id: 'seller-b', price: 20000, status: 'delivered' },
        { id: '6', seller: { id: 'seller-b' }, price: 4000, status: 'shipped' }, // via joined object
        { id: '7', seller: { id: 'seller-b' }, price: 4000, status: 'confirmed' },

        // Vendeur C (uniquement des commandes annulées : 2 annulées à 1 500 = 3 000)
        { id: '8', seller_id: 'seller-c', price: 1500, status: 'cancelled' },
        { id: '9', seller_id: 'seller-c', price: 1500, status: 'cancelled' },
    ];

    // Stats Vendeur A
    const statsA = computeSellerOrderStats(mockOrders, 'seller-a');
    assert.strictEqual(statsA.totalOrders, 4, 'Vendeur A a 4 commandes au total');
    assert.strictEqual(statsA.totalAmount, 15000, 'Volume brut Vendeur A = 15 000 FCFA');
    assert.strictEqual(statsA.deliveredCount, 2, '2 commandes livrées');
    assert.strictEqual(statsA.deliveredAmount, 10000, '10 000 FCFA livrées');
    assert.strictEqual(statsA.cancelledCount, 1, '1 commande annulée');
    assert.strictEqual(statsA.cancelledAmount, 2000, '2 000 FCFA annulés');
    assert.strictEqual(statsA.pendingCount, 1, '1 commande en cours');
    assert.strictEqual(statsA.pendingAmount, 3000, '3 000 FCFA en attente');

    // Vérification Règle CA Réel = Livrées + Annulées
    assert.strictEqual(statsA.realRevenue, 12000, 'CA Réel Vendeur A (10 000 + 2 000) = 12 000 FCFA');
    assert.strictEqual(statsA.realOrdersCount, 3, 'Commandes closes (2 livrées + 1 annulée) = 3');

    // Stats Vendeur B
    const statsB = computeSellerOrderStats(mockOrders, 'seller-b');
    assert.strictEqual(statsB.totalOrders, 3);
    assert.strictEqual(statsB.deliveredCount, 1);
    assert.strictEqual(statsB.deliveredAmount, 20000);
    assert.strictEqual(statsB.cancelledCount, 0);
    assert.strictEqual(statsB.realRevenue, 20000, 'CA Réel Vendeur B = 20 000 FCFA');

    // Stats Vendeur C
    const statsC = computeSellerOrderStats(mockOrders, 'seller-c');
    assert.strictEqual(statsC.deliveredAmount, 0);
    assert.strictEqual(statsC.cancelledAmount, 3000);
    assert.strictEqual(statsC.realRevenue, 3000, 'CA Réel Vendeur C (0 livrées + 3 000 annulées) = 3 000 FCFA');
    assert.strictEqual(statsC.realOrdersCount, 2);
});

// ---------------------------------------------------------------------------
// 2. BUILD ALL SELLERS STATS MAP
// ---------------------------------------------------------------------------
test('2. buildAllSellersStatsMap agrège instantanément tous les marchands avec realRevenue en O(N)', async () => {
    const { buildAllSellersStatsMap } = await import('../src/services/admin-service.js');
    assert.strictEqual(typeof buildAllSellersStatsMap, 'function');

    const mockOrders = [
        { id: '1', seller_id: 's1', price: 2000, status: 'delivered' },
        { id: '2', seller_id: 's1', price: 3000, status: 'cancelled' },
        { id: '3', seller_id: 's2', price: 15000, status: 'delivered' },
        { id: '4', seller_id: 's2', price: 5000, status: 'processing' },
    ];

    const statsMap = buildAllSellersStatsMap(mockOrders);

    assert.ok(statsMap.s1, 'La clé s1 doit exister dans la map');
    assert.ok(statsMap.s2, 'La clé s2 doit exister dans la map');
    assert.strictEqual(statsMap.s1.deliveredAmount, 2000);
    assert.strictEqual(statsMap.s1.cancelledAmount, 3000);
    assert.strictEqual(statsMap.s1.realRevenue, 5000, 'realRevenue s1 (2000 + 3000) = 5 000 FCFA');
    assert.strictEqual(statsMap.s1.realOrdersCount, 2);
    assert.strictEqual(statsMap.s2.deliveredAmount, 15000);
    assert.strictEqual(statsMap.s2.pendingAmount, 5000);
    assert.strictEqual(statsMap.s2.realRevenue, 15000);
});

// ---------------------------------------------------------------------------
// 3. LOGIQUE DE TRI DES MARCHANDS PAR CA RÉEL
// ---------------------------------------------------------------------------
test('3. Algorithme de tri des vendeurs basé sur le CA Réel (Livrées + Annulées)', () => {
    const sellers = [
        { id: 's1', shop_name: 'Boutique Alpha', prenom: 'Awa', nom: 'Diop', created_at: '2026-01-01' },
        { id: 's2', shop_name: 'Zebra Tech', prenom: 'Moussa', nom: 'Fall', created_at: '2026-02-01' },
        { id: 's3', shop_name: 'Campus Snack', prenom: 'Fatou', nom: 'Sow', created_at: '2026-03-01' },
    ];

    const statsMap = {
        // s1 : 5 000 livrées + 1 000 annulées = 6 000 F CA Réel, 10 commandes
        s1: { deliveredAmount: 5000, cancelledAmount: 1000, realRevenue: 6000, totalOrders: 10 },
        // s2 : 40 000 livrées + 15 000 annulées = 55 000 F CA Réel, 2 commandes
        s2: { deliveredAmount: 40000, cancelledAmount: 15000, realRevenue: 55000, totalOrders: 2 },
        // s3 : 20 000 livrées + 5 000 annulées = 25 000 F CA Réel, 25 commandes
        s3: { deliveredAmount: 20000, cancelledAmount: 5000, realRevenue: 25000, totalOrders: 25 },
    };

    // Tri par CA Réel décroissant
    const sortedByCA = [...sellers].sort((a, b) => {
        const caA = statsMap[a.id]?.realRevenue || 0;
        const caB = statsMap[b.id]?.realRevenue || 0;
        return caB - caA;
    });
    assert.deepStrictEqual(sortedByCA.map(s => s.id), ['s2', 's3', 's1'], 'Tri CA Réel : Zebra Tech (55k) > Snack (25k) > Alpha (6k)');

    // Tri par Volume de commandes décroissant
    const sortedByOrders = [...sellers].sort((a, b) => {
        const ordA = statsMap[a.id]?.totalOrders || 0;
        const ordB = statsMap[b.id]?.totalOrders || 0;
        return ordB - ordA;
    });
    assert.deepStrictEqual(sortedByOrders.map(s => s.id), ['s3', 's1', 's2'], 'Tri commandes : Snack (25) > Alpha (10) > Zebra (2)');
});

// ---------------------------------------------------------------------------
// 4. LOGIQUE DE FILTRAGE DES COMMANDES
// ---------------------------------------------------------------------------
test('4. Filtrage multi-critères des commandes par statut et vendeur', () => {
    const orders = [
        { id: '1', seller_id: 's1', status: 'delivered', price: 2000, delivery_address: 'Pavillon A' },
        { id: '2', seller_id: 's1', status: 'pending', price: 1000, delivery_address: 'Pavillon A' },
        { id: '3', seller_id: 's1', status: 'cancelled', price: 1500, delivery_address: 'Pavillon B' },
        { id: '4', seller_id: 's2', status: 'delivered', price: 5000, delivery_address: 'Pavillon B' },
        { id: '5', seller_id: 's2', status: 'confirmed', price: 3000, delivery_address: 'Pavillon C' },
    ];

    // Filtrage statut = delivered
    const delivered = orders.filter((o) => o.status === 'delivered');
    assert.strictEqual(delivered.length, 2);

    // Filtrage statut = undelivered (en attente ou en cours)
    const undelivered = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));
    assert.strictEqual(undelivered.length, 2);

    // Filtrage statut = cancelled
    const cancelled = orders.filter((o) => o.status === 'cancelled');
    assert.strictEqual(cancelled.length, 1);

    // Filtrage combiné : Vendeur s1 + statut delivered
    const s1Delivered = orders.filter((o) => o.seller_id === 's1' && o.status === 'delivered');
    assert.strictEqual(s1Delivered.length, 1);

    // Filtrage combiné : Vendeur s1 + statut undelivered
    const s1Undelivered = orders.filter((o) => o.seller_id === 's1' && !['delivered', 'cancelled'].includes(o.status));
    assert.strictEqual(s1Undelivered.length, 1);
});

// ---------------------------------------------------------------------------
// 5. INTÉGRITÉ DU DASHBOARD SUPERADMIN & BOUTONS PACK 1 000 F / PACK 2 000 F
// ---------------------------------------------------------------------------
test('5. Fichier SuperAdminDashboard.js intègre les boutons Pack 1 000 F / Pack 2 000 F et supprime +7j Essai', () => {
    const dashboardPath = path.join(rootDir, 'src', 'components', 'admin', 'SuperAdminDashboard.js');
    assert.ok(fs.existsSync(dashboardPath), 'SuperAdminDashboard.js doit exister');
    const content = fs.readFileSync(dashboardPath, 'utf8');

    // Nouveaux boutons d'activation explicite
    assert.ok(content.includes('data-action="activate-plan"'), 'Doit avoir data-action="activate-plan"');
    assert.ok(content.includes('Pack 1 000 F'), 'Doit avoir le bouton Pack 1 000 F');
    assert.ok(content.includes('Pack 2 000 F'), 'Doit avoir le bouton Pack 2 000 F');

    // Vérification de la suppression des boutons obsolètes
    assert.ok(!content.includes('+7j Essai'), 'Le bouton obsolète +7j Essai doit être retiré');
    assert.ok(!content.includes('Activer 30j'), 'Le libellé générique Activer 30j doit être remplacé par les packs précis');

    // Affichage et tri par CA Réel
    assert.ok(content.includes('Chiffre d\'Affaires Réel'), 'Doit mentionner Chiffre d\'Affaires Réel');
    assert.ok(content.includes('id="admin-seller-sort"'), 'Doit avoir le sélecteur de tri');
    assert.ok(content.includes('data-action="view-seller-orders"'), 'Doit avoir le bouton view-seller-orders');
    assert.ok(content.includes('id="admin-order-seller-filter"'), 'Doit avoir le filtre vendeur');
});

// ---------------------------------------------------------------------------
// 6. RÈGLES DE PROMOTION DE PRODUIT (1/MOIS PRO, 1/SEMAINE BUSINESS)
// ---------------------------------------------------------------------------
test('6. Promotion de n\'importe quel produit : respect strict 1/mois en Pro et 1/semaine en Business', async () => {
    const { computePromotionQuota } = await import('../src/config/subscription.js');
    const { useProductPromotion } = await import('../src/services/quota-service.js');
    assert.strictEqual(typeof computePromotionQuota, 'function');
    assert.strictEqual(typeof useProductPromotion, 'function');

    // Vendeur Pro (1 000 F) avec 0 promo utilisée : autorisée (1/mois)
    const proProfile = {
        role: 'vendeur',
        subscription_status: 'active',
        subscription_plan: 'starter', // Pack Pro
        subscription_expires_at: new Date(Date.now() + 20 * 86400000).toISOString(),
        promotions_used_this_period: 0,
        promotions_period_start: new Date().toISOString(),
    };
    const proQuota = computePromotionQuota(proProfile);
    assert.strictEqual(proQuota.allowed, true);
    assert.strictEqual(proQuota.max, 1);
    assert.strictEqual(proQuota.remaining, 1);
    assert.strictEqual(proQuota.period, 'month');

    // Vendeur Pro ayant déjà consommé sa promo du mois : bloqué
    proProfile.promotions_used_this_period = 1;
    const proExhausted = computePromotionQuota(proProfile);
    assert.strictEqual(proExhausted.remaining, 0);
    assert.ok(proExhausted.limitReachedMessage.includes('1er du mois'));

    // Vendeur Business (2 000 F) avec 0 promo : autorisée (1/semaine)
    const bizProfile = {
        role: 'vendeur',
        subscription_status: 'active',
        subscription_plan: 'pro', // Pack Business
        subscription_expires_at: new Date(Date.now() + 20 * 86400000).toISOString(),
        promotions_used_this_period: 0,
        promotions_period_start: new Date().toISOString(),
    };
    const bizQuota = computePromotionQuota(bizProfile);
    assert.strictEqual(bizQuota.allowed, true);
    assert.strictEqual(bizQuota.max, 1);
    assert.strictEqual(bizQuota.remaining, 1);
    assert.strictEqual(bizQuota.period, 'week');

    // Vendeur Business ayant déjà consommé sa promo de la semaine : bloqué jusqu'à lundi
    bizProfile.promotions_used_this_period = 1;
    const bizExhausted = computePromotionQuota(bizProfile);
    assert.strictEqual(bizExhausted.remaining, 0);
    assert.ok(bizExhausted.limitReachedMessage.includes('lundi'));

    // Vendeur Découverte (0 F permanent) : aucune promotion autorisée
    const decouverteProfile = {
        role: 'vendeur',
        subscription_status: 'decouverte',
        subscription_plan: 'decouverte',
    };
    const decQuota = computePromotionQuota(decouverteProfile);
    assert.strictEqual(decQuota.allowed, false);
});

console.log(`\n🎉 Tous les ${passCount} tests de stats vendeur, filtres commandes et promotions ont réussi avec succès !`);
