/**
 * Test Suite : STATS ADMIN V2 (ADMIN_STATS_V2)
 * Vérification de la cohérence des calculs, de l'intégrité de la migration SQL,
 * du respect du feature flag et de l'affichage dans le dashboard SuperAdmin.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Démarrage des tests : STATS ADMIN V2 (ADMIN_STATS_V2)...\n');

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
// 1. FEATURE FLAG
// ---------------------------------------------------------------------------
test('1. Feature Flag ADMIN_STATS_V2 configuré à false par défaut', async () => {
    const { FEATURE_FLAGS } = await import('../src/config/subscription.js');
    assert.strictEqual(typeof FEATURE_FLAGS.ADMIN_STATS_V2, 'boolean', 'ADMIN_STATS_V2 doit être un booléen');
    assert.strictEqual(FEATURE_FLAGS.ADMIN_STATS_V2, false, 'ADMIN_STATS_V2 doit être désactivé par défaut (sécurité production)');
});

// ---------------------------------------------------------------------------
// 2. MIGRATION SQL & AGRÉGATION SERVEUR
// ---------------------------------------------------------------------------
test('2. Fichier de migration SQL database/migration_admin_stats_v2.sql conforme', () => {
    const sqlPath = path.join(rootDir, 'database', 'migration_admin_stats_v2.sql');
    assert.ok(fs.existsSync(sqlPath), 'Le fichier migration_admin_stats_v2.sql doit exister');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    assert.ok(sql.includes('ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_same_room'), 'Doit assurer la présence de is_same_room');
    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.get_admin_global_stats_v2()'), 'Doit créer la fonction get_admin_global_stats_v2');
    assert.ok(sql.includes('SECURITY DEFINER'), 'La fonction doit être SECURITY DEFINER');
    assert.ok(sql.includes("role = 'superadmin'"), 'Doit vérifier que l\'appelant est SuperAdmin');
    assert.ok(sql.includes('total_count'), 'Doit agréger total_count');
    assert.ok(sql.includes('total_amount'), 'Doit agréger total_amount');
    assert.ok(sql.includes('delivered_count'), 'Doit agréger delivered_count');
    assert.ok(sql.includes('delivered_amount'), 'Doit agréger delivered_amount');
    assert.ok(sql.includes('undelivered_count'), 'Doit agréger undelivered_count');
    assert.ok(sql.includes('undelivered_amount'), 'Doit agréger undelivered_amount');
    assert.ok(sql.includes('cancelled_count'), 'Doit agréger cancelled_count');
    assert.ok(sql.includes('cancelled_amount'), 'Doit agréger cancelled_amount');
    assert.ok(sql.includes('cancellation_rate'), 'Doit calculer le taux d\'annulation');
    assert.ok(sql.includes('delivery_rate'), 'Doit calculer le taux de livraison');
    assert.ok(sql.includes('same_room_count'), 'Doit décompter les commandes même_chambre');
});

// ---------------------------------------------------------------------------
// 3. COHÉRENCE MATHÉMATIQUE DES CALCULS (fetchAdminGlobalStatsV2)
// ---------------------------------------------------------------------------
test('3. Cohérence mathématique de l\'agrégation sur échantillon de commandes mixtes', async () => {
    const { fetchAdminGlobalStatsV2 } = await import('../src/services/admin-service.js');
    assert.strictEqual(typeof fetchAdminGlobalStatsV2, 'function', 'fetchAdminGlobalStatsV2 doit être une fonction exportée');

    const mockOrders = [
        // 5 livrées (2000 FCFA chacune = 10 000 FCFA)
        { id: '1', price: 2000, status: 'delivered', is_same_room: false },
        { id: '2', price: 2000, status: 'delivered', is_same_room: true },
        { id: '3', price: 2000, status: 'delivered', is_same_room: false },
        { id: '4', price: 2000, status: 'delivered', is_same_room: false },
        { id: '5', price: 2000, status: 'delivered', is_same_room: false },
        // 2 annulées (1500 FCFA chacune = 3 000 FCFA)
        { id: '6', price: 1500, status: 'cancelled', is_same_room: true },
        { id: '7', price: 1500, status: 'cancelled', is_same_room: false },
        // 3 non livrées (1 pending = 1000, 1 confirmed = 2500, 1 shipped = 1500 => 5 000 FCFA)
        { id: '8', price: 1000, status: 'pending', is_same_room: false },
        { id: '9', price: 2500, status: 'confirmed', is_same_room: true },
        { id: '10', price: 1500, status: 'shipped', is_same_room: false },
    ];

    const stats = await fetchAdminGlobalStatsV2(mockOrders);

    // Totaux
    assert.strictEqual(stats.total_count, 10, 'Total count doit être 10');
    assert.strictEqual(stats.total_amount, 18000, 'Total amount doit être 18 000 FCFA');

    // Livrées
    assert.strictEqual(stats.delivered_count, 5, 'Livrées count doit être 5');
    assert.strictEqual(stats.delivered_amount, 10000, 'Livrées montant doit être 10 000 FCFA');

    // Annulées
    assert.strictEqual(stats.cancelled_count, 2, 'Annulées count doit être 2');
    assert.strictEqual(stats.cancelled_amount, 3000, 'Annulées montant doit être 3 000 FCFA');

    // Non livrées
    assert.strictEqual(stats.undelivered_count, 3, 'Non livrées count doit être 3');
    assert.strictEqual(stats.undelivered_amount, 5000, 'Non livrées montant doit être 5 000 FCFA');
    assert.strictEqual(stats.pending_count, 1);
    assert.strictEqual(stats.pending_amount, 1000);
    assert.strictEqual(stats.confirmed_count, 1);
    assert.strictEqual(stats.confirmed_amount, 2500);
    assert.strictEqual(stats.shipped_count, 1);
    assert.strictEqual(stats.shipped_amount, 1500);

    // Équations d'intégrité globale
    assert.strictEqual(
        stats.total_count,
        stats.delivered_count + stats.undelivered_count + stats.cancelled_count,
        'Intégrité des volumes : Total = Livrées + Non livrées + Annulées'
    );
    assert.strictEqual(
        stats.total_amount,
        stats.delivered_amount + stats.undelivered_amount + stats.cancelled_amount,
        'Intégrité financière : Total FCFA = Livrées FCFA + Non livrées FCFA + Annulées FCFA'
    );

    // Taux
    assert.strictEqual(stats.cancellation_rate, 20, 'Taux d\'annulation doit être (2/10)*100 = 20.00%');
    assert.strictEqual(stats.delivery_rate, 50, 'Taux de livraison doit être (5/10)*100 = 50.00%');

    // Même chambre
    assert.strictEqual(stats.same_room_count, 3, 'Commandes même chambre doit être 3');
});

// ---------------------------------------------------------------------------
// 4. GESTION DES CAS LIMITES (Division par zéro, 100% annulé, 100% livré)
// ---------------------------------------------------------------------------
test('4. Gestion des cas limites (0 commande, 100% annulé, 100% livré)', async () => {
    const { fetchAdminGlobalStatsV2 } = await import('../src/services/admin-service.js');

    // Cas A : 0 commande (évite toute division par zéro NaN)
    const zeroStats = await fetchAdminGlobalStatsV2([]);
    assert.strictEqual(zeroStats.total_count, 0);
    assert.strictEqual(zeroStats.total_amount, 0);
    assert.strictEqual(zeroStats.cancellation_rate, 0, 'Le taux d\'annulation doit être 0 si aucune commande');
    assert.strictEqual(zeroStats.delivery_rate, 0, 'Le taux de livraison doit être 0 si aucune commande');
    assert.strictEqual(zeroStats.same_room_count, 0);

    // Cas B : 100% annulé
    const allCancelled = [
        { id: 'c1', price: 5000, status: 'cancelled' },
        { id: 'c2', price: 5000, status: 'cancelled' },
    ];
    const cancelStats = await fetchAdminGlobalStatsV2(allCancelled);
    assert.strictEqual(cancelStats.cancellation_rate, 100);
    assert.strictEqual(cancelStats.delivery_rate, 0);
    assert.strictEqual(cancelStats.cancelled_amount, 10000);
    assert.strictEqual(cancelStats.delivered_amount, 0);

    // Cas C : 100% livré
    const allDelivered = [
        { id: 'd1', price: 3000, status: 'delivered' },
        { id: 'd2', price: 7000, status: 'delivered' },
    ];
    const delivStats = await fetchAdminGlobalStatsV2(allDelivered);
    assert.strictEqual(delivStats.cancellation_rate, 0);
    assert.strictEqual(delivStats.delivery_rate, 100);
    assert.strictEqual(delivStats.delivered_amount, 10000);
    assert.strictEqual(delivStats.cancelled_amount, 0);
});

// ---------------------------------------------------------------------------
// 5. INTÉGRATION DASHBOARD & VÉRIFICATION DU COMPORTEMENT AVEC LE FLAG
// ---------------------------------------------------------------------------
test('5. Préservation stricte du comportement V1 quand le flag est false', () => {
    const dashboardSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'admin', 'SuperAdminDashboard.js'), 'utf8');

    // Vérification de la présence de la bascule conditionnelle
    assert.ok(dashboardSrc.includes('FEATURE_FLAGS.ADMIN_STATS_V2'), 'Le dashboard doit consulter le flag FEATURE_FLAGS.ADMIN_STATS_V2');
    assert.ok(dashboardSrc.includes('m.totalDeliveredRevenue'), 'Le comportement V1 doit continuer d\'utiliser totalDeliveredRevenue');
    assert.ok(dashboardSrc.includes('admin-order-status-filter'), 'Le filtre statut V2 doit exister sous condition');
    assert.ok(dashboardSrc.includes("Taux d'annulation"), 'L\'indicateur de taux d\'annulation doit exister');
    assert.ok(dashboardSrc.includes('Même chambre'), 'Le badge Même chambre doit exister');
});

console.log(`\n🎉 TOUS LES ${passCount} TESTS STATS ADMIN V2 ONT RÉUSSI AVEC SUCCÈS !\n`);
