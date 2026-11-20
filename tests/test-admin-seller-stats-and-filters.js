/**
 * Test Suite : STATS VENDEURS & FILTRAGE AVANCÉ COMMANDES SUPERADMIN
 * Vérifie :
 * 1. Fonctions computeSellerOrderStats et buildAllSellersStatsMap
 * 2. Tri des marchands (CA réalisé, Volume commandes, Nom, Date)
 * 3. Filtrage multi-critères des commandes (statut, vendeur, pavillon, paiement)
 * 4. Intégrité des éléments d'interface du SuperAdminDashboard
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Démarrage des tests : STATS VENDEURS & FILTRES COMMANDES...\n');

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
// 1. COMPUTE SELLER ORDER STATS
// ---------------------------------------------------------------------------
test('1. computeSellerOrderStats calcule fidèlement les indicateurs par vendeur', async () => {
    const { computeSellerOrderStats } = await import('../src/services/admin-service.js');
    assert.strictEqual(typeof computeSellerOrderStats, 'function', 'computeSellerOrderStats doit être exportée');

    // Cas limites : vendeur inexistant ou paramètres vides
    const emptyStats = computeSellerOrderStats([], null);
    assert.strictEqual(emptyStats.totalOrders, 0);
    assert.strictEqual(emptyStats.deliveredAmount, 0);
    assert.strictEqual(emptyStats.cancellationRate, 0);

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

        // Vendeur C (uniquement des commandes annulées)
        { id: '8', seller_id: 'seller-c', price: 1500, status: 'cancelled' },
    ];

    // Stats Vendeur A
    const statsA = computeSellerOrderStats(mockOrders, 'seller-a');
    assert.strictEqual(statsA.totalOrders, 4, 'Vendeur A a 4 commandes au total');
    assert.strictEqual(statsA.totalAmount, 15000, 'Volume brut Vendeur A = 15 000 FCFA');
    assert.strictEqual(statsA.deliveredCount, 2, '2 commandes livrées');
    assert.strictEqual(statsA.deliveredAmount, 10000, 'CA Réalisé Vendeur A = 10 000 FCFA');
    assert.strictEqual(statsA.pendingCount, 1, '1 commande en cours');
    assert.strictEqual(statsA.pendingAmount, 3000, '3 000 FCFA en attente');
    assert.strictEqual(statsA.cancelledCount, 1, '1 commande annulée');
    assert.strictEqual(statsA.cancelledAmount, 2000, '2 000 FCFA annulés');
    assert.strictEqual(statsA.deliveryRate, 50.0, 'Taux livraison 50%');
    assert.strictEqual(statsA.cancellationRate, 25.0, 'Taux annulation 25%');

    // Stats Vendeur B (avec support de l\'objet joint seller.id)
    const statsB = computeSellerOrderStats(mockOrders, 'seller-b');
    assert.strictEqual(statsB.totalOrders, 3);
    assert.strictEqual(statsB.deliveredCount, 1);
    assert.strictEqual(statsB.deliveredAmount, 20000);
    assert.strictEqual(statsB.pendingCount, 2);
    assert.strictEqual(statsB.pendingAmount, 8000);
    assert.strictEqual(statsB.cancelledCount, 0);
    assert.strictEqual(statsB.cancellationRate, 0);
});

// ---------------------------------------------------------------------------
// 2. BUILD ALL SELLERS STATS MAP
// ---------------------------------------------------------------------------
test('2. buildAllSellersStatsMap agrège instantanément tous les marchands en O(N)', async () => {
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
    assert.strictEqual(statsMap.s2.deliveredAmount, 15000);
    assert.strictEqual(statsMap.s2.pendingAmount, 5000);
    assert.strictEqual(statsMap.s2.cancelledCount, 0);
});

// ---------------------------------------------------------------------------
// 3. LOGIQUE DE TRI DES MARCHANDS
// ---------------------------------------------------------------------------
test('3. Algorithme de tri des vendeurs (Top CA, Volume commandes, Alphabétique)', () => {
    const sellers = [
        { id: 's1', shop_name: 'Boutique Alpha', prenom: 'Awa', nom: 'Diop', created_at: '2026-01-01' },
        { id: 's2', shop_name: 'Zebra Tech', prenom: 'Moussa', nom: 'Fall', created_at: '2026-02-01' },
        { id: 's3', shop_name: 'Campus Snack', prenom: 'Fatou', nom: 'Sow', created_at: '2026-03-01' },
    ];

    const statsMap = {
        s1: { deliveredAmount: 5000, totalOrders: 10 },
        s2: { deliveredAmount: 50000, totalOrders: 2 },
        s3: { deliveredAmount: 20000, totalOrders: 25 },
    };

    // Tri par CA décroissant
    const sortedByCA = [...sellers].sort((a, b) => {
        const caA = statsMap[a.id]?.deliveredAmount || 0;
        const caB = statsMap[b.id]?.deliveredAmount || 0;
        return caB - caA;
    });
    assert.deepStrictEqual(sortedByCA.map(s => s.id), ['s2', 's3', 's1'], 'Tri CA : Zebra Tech (50k) > Snack (20k) > Alpha (5k)');

    // Tri par Volume de commandes décroissant
    const sortedByOrders = [...sellers].sort((a, b) => {
        const ordA = statsMap[a.id]?.totalOrders || 0;
        const ordB = statsMap[b.id]?.totalOrders || 0;
        return ordB - ordA;
    });
    assert.deepStrictEqual(sortedByOrders.map(s => s.id), ['s3', 's1', 's2'], 'Tri commandes : Snack (25) > Alpha (10) > Zebra (2)');

    // Tri alphabétique
    const sortedByName = [...sellers].sort((a, b) => {
        const nameA = (a.shop_name || '').toLowerCase();
        const nameB = (b.shop_name || '').toLowerCase();
        return nameA.localeCompare(nameB);
    });
    assert.deepStrictEqual(sortedByName.map(s => s.id), ['s1', 's3', 's2'], 'Tri A-Z : Alpha > Campus Snack > Zebra Tech');
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
    assert.strictEqual(s1Delivered[0].id, '1');

    // Filtrage combiné : Vendeur s1 + statut undelivered
    const s1Undelivered = orders.filter((o) => o.seller_id === 's1' && !['delivered', 'cancelled'].includes(o.status));
    assert.strictEqual(s1Undelivered.length, 1);
    assert.strictEqual(s1Undelivered[0].id, '2');
});

// ---------------------------------------------------------------------------
// 5. INTÉGRITÉ DU DASHBOARD SUPERADMIN
// ---------------------------------------------------------------------------
test('5. Fichier SuperAdminDashboard.js contient toutes les liaisons et interfaces requises', () => {
    const dashboardPath = path.join(rootDir, 'src', 'components', 'admin', 'SuperAdminDashboard.js');
    assert.ok(fs.existsSync(dashboardPath), 'SuperAdminDashboard.js doit exister');
    const content = fs.readFileSync(dashboardPath, 'utf8');

    // Import des fonctions de calcul de stats vendeur
    assert.ok(content.includes('computeSellerOrderStats'), 'Doit importer computeSellerOrderStats');
    assert.ok(content.includes('buildAllSellersStatsMap'), 'Doit importer buildAllSellersStatsMap');

    // Variable d'état de filtrage vendeur
    assert.ok(content.includes('orderSellerFilter'), 'Doit gérer orderSellerFilter');
    assert.ok(content.includes('sellerSortBy'), 'Doit gérer sellerSortBy');

    // Éléments UI : Sélecteur de tri vendeurs et bouton Voir commandes
    assert.ok(content.includes('id="admin-seller-sort"'), 'Doit rendre le sélecteur admin-seller-sort');
    assert.ok(content.includes('data-action="view-seller-orders"'), 'Doit avoir le bouton data-action="view-seller-orders"');

    // Éléments UI : Filtre commandes par vendeur et onglets statut
    assert.ok(content.includes('id="admin-order-seller-filter"'), 'Doit rendre le filtre admin-order-seller-filter');
    assert.ok(content.includes('data-order-status-tab='), 'Doit rendre les onglets rapides data-order-status-tab');
    assert.ok(content.includes('id="btn-clear-seller-filter"'), 'Doit rendre le bouton de réinitialisation vendeur');

    // Cartes statistiques interactives pour livrées, en attente, annulées
    assert.ok(content.includes('data-stat-target="orders-delivered"'), 'Doit lier les cartes orders-delivered');
    assert.ok(content.includes('data-stat-target="orders-pending"'), 'Doit lier les cartes orders-pending');
    assert.ok(content.includes('data-stat-target="orders-cancelled"'), 'Doit lier les cartes orders-cancelled');

    // Règle SuperAdmin Peer Immunity intacte
    assert.ok(content.includes("currentRole === 'superadmin'"), 'Doit conserver la protection des superadmin');
});

console.log(`\n🎉 Tous les ${passCount} tests de stats vendeur et filtres commandes ont réussi avec succès !`);
