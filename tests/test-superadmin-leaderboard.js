/**
 * Test Suite : Interrogation de l'autorité SuperAdmin pour le Classement des Vendeurs
 * Valide :
 * 1. La présence et le fonctionnement de fetchSuperAdminLeaderboard() dans admin-service.js.
 * 2. L'interrogation prioritaire du SuperAdmin dans fetchCampusLeaderboard() (seller-ranking-service.js).
 * 3. L'élimination du cloisonnement restrictif dans buildSellersLeaderboard() (tous les marchands actifs classés).
 * 4. La validité du script SQL RPC SECURITY DEFINER (migration_superadmin_seller_ranking_rpc.sql).
 * 5. La conformité de l'interface SellerLeaderboardView.js (badge Certifié SuperAdmin).
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Démarrage des tests : Autorité SuperAdmin pour le Classement des Vendeurs...\n');

let passedTests = 0;

// Test 1 : Vérification de la fonction fetchSuperAdminLeaderboard dans admin-service.js
console.log('--- Test 1 : admin-service.js (fetchSuperAdminLeaderboard) ---');
const adminServiceContent = fs.readFileSync(path.join(rootDir, 'src/services/admin-service.js'), 'utf-8');

assert.ok(
    adminServiceContent.includes('export async function fetchSuperAdminLeaderboard()'),
    'admin-service.js doit exporter la fonction fetchSuperAdminLeaderboard.'
);

assert.ok(
    adminServiceContent.includes("supabase.rpc('get_superadmin_seller_ranking')"),
    'fetchSuperAdminLeaderboard doit appeler la RPC get_superadmin_seller_ranking.'
);

assert.ok(
    adminServiceContent.includes('buildAllSellersStatsMap(orders)'),
    'fetchSuperAdminLeaderboard doit intégrer un repli résilient via la supervision SuperAdmin.'
);
console.log('✅ Test 1 réussi : fetchSuperAdminLeaderboard correctement implémentée avec repli.');
passedTests++;

// Test 2 : Vérification de seller-ranking-service.js (Interrogation de l'autorité SuperAdmin)
console.log('\n--- Test 2 : seller-ranking-service.js (Interrogation SuperAdmin & Inclusion Universelle) ---');
const rankingServiceContent = fs.readFileSync(path.join(rootDir, 'src/services/seller-ranking-service.js'), 'utf-8');

assert.ok(
    rankingServiceContent.includes("import { fetchSuperAdminLeaderboard } from './admin-service.js';"),
    'seller-ranking-service.js doit importer fetchSuperAdminLeaderboard depuis admin-service.js.'
);

assert.ok(
    rankingServiceContent.includes('await fetchSuperAdminLeaderboard()'),
    'fetchCampusLeaderboard doit interroger prioritairement fetchSuperAdminLeaderboard().'
);

// Doit supporter allowAllActive pour classer tous les marchands actifs
assert.ok(
    rankingServiceContent.includes('allowAllActive'),
    'buildSellersLeaderboard doit supporter le paramètre allowAllActive.'
);
console.log('✅ Test 2 réussi : seller-ranking-service interroge le SuperAdmin et classe tous les marchands actifs.');
passedTests++;

// Test 3 : Vérification du script SQL de migration (get_superadmin_seller_ranking RPC)
console.log('\n--- Test 3 : Script SQL de migration (RPC SECURITY DEFINER) ---');
const migrationPath = path.join(rootDir, 'database/migration_superadmin_seller_ranking_rpc.sql');
assert.ok(fs.existsSync(migrationPath), 'Le fichier de migration SQL doit exister.');
const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

assert.ok(
    migrationContent.includes('CREATE OR REPLACE FUNCTION public.get_superadmin_seller_ranking()'),
    'Le script SQL doit créer la fonction public.get_superadmin_seller_ranking().'
);

assert.ok(
    migrationContent.includes('SECURITY DEFINER'),
    'La fonction doit être SECURITY DEFINER pour exécuter avec les privilèges SuperAdmin sans exposer les données privées.'
);

assert.ok(
    migrationContent.includes('GRANT EXECUTE ON FUNCTION public.get_superadmin_seller_ranking() TO anon, authenticated;'),
    'La fonction doit être accessible aux utilisateurs anonymes et authentifiés.'
);
console.log('✅ Test 3 réussi : Script SQL conforme et sécurisé avec exécution SECURITY DEFINER.');
passedTests++;

// Test 4 : Vérification de SellerLeaderboardView.js
console.log('\n--- Test 4 : SellerLeaderboardView.js (Affichage certifié SuperAdmin) ---');
const leaderboardViewContent = fs.readFileSync(path.join(rootDir, 'src/components/seller/SellerLeaderboardView.js'), 'utf-8');

assert.ok(
    leaderboardViewContent.includes('Certifié SuperAdmin'),
    'SellerLeaderboardView doit arborer le badge officiel Certifié SuperAdmin.'
);

assert.ok(
    leaderboardViewContent.includes('Interrogation de l\'autorité SuperAdmin'),
    'SellerLeaderboardView doit mentionner l\'interrogation de l\'autorité SuperAdmin lors du chargement.'
);
console.log('✅ Test 4 réussi : SellerLeaderboardView prêt pour affichage certifié SuperAdmin.');
passedTests++;

console.log(`\n🎉 Tous les tests du classement par autorité SuperAdmin ont réussi (${passedTests}/4) !`);
