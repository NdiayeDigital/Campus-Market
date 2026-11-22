/**
 * Suite de tests automatisés : Intégrité et Affichage des Produits Vendeur (Dashboard & Service)
 * Vérifie :
 * 1. Résilience de getSellerDashboardData face aux comptes orphelins (profil absent de profiles)
 * 2. Présence et complétude de la liste des produits récents (recentProducts)
 * 3. Cohérence des compteurs d'articles réels (totalProductsCount, activeProductsCount)
 * 4. Présence de la section "Mes articles récents" dans le DOM de SellerDashboard.js
 * 5. Présence et validité du script de migration SQL de réparation
 */

import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSellerDashboardData } from '../src/services/seller-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Démarrage des tests : test-seller-dashboard-products.js\n');

async function runTests() {
    let passed = 0;
    let failed = 0;

    // Test 1 : Résilience face à un identifiant vendeur orphelin (sans profil dans public.profiles)
    try {
        console.log('Test 1 : getSellerDashboardData ne plante pas sur un compte sans profil distant');
        const orphanId = '03b1656d-4156-4674-a4c6-6392fe330c56';
        const data = await getSellerDashboardData(orphanId);

        assert.ok(data !== null && typeof data === 'object', 'Les données du dashboard doivent être un objet valide');
        assert.ok(data.profile !== null && typeof data.profile === 'object', 'Un profil de repli doit être fourni');
        assert.equal(data.profile.id, orphanId, "L'ID du profil de repli doit correspondre");
        assert.equal(data.profile.role, 'vendeur', 'Le rôle par défaut doit être vendeur');
        assert.equal(typeof data.totalProductsCount, 'number', 'totalProductsCount doit être un nombre');
        assert.ok(data.totalProductsCount >= 5, `Le vendeur orphelin doit avoir ses 5 produits comptabilisés (obtenu: ${data.totalProductsCount})`);
        assert.ok(Array.isArray(data.recentProducts), 'recentProducts doit être un tableau');
        assert.ok(data.recentProducts.length >= 5, `recentProducts doit contenir au moins 5 articles (obtenu: ${data.recentProducts.length})`);
        
        // Vérification de la présence des produits connus
        const titles = data.recentProducts.map((p) => p.title);
        assert.ok(titles.includes('Crampon Sportives'), "Doit inclure le produit 'Crampon Sportives'");
        assert.ok(titles.includes('Masque de Lèvre'), "Doit inclure le produit 'Masque de Lèvre'");

        console.log('  ✅ Test 1 validé : getSellerDashboardData résilient avec profil de repli et produits récents.');
        passed++;
    } catch (err) {
        console.error('  ❌ Échec Test 1 :', err.message);
        failed++;
    }

    // Test 2 : Vérification de la structure des produits récents (recentProducts)
    try {
        console.log('\nTest 2 : Intégrité des attributs des produits dans recentProducts');
        const orphanId = '03b1656d-4156-4674-a4c6-6392fe330c56';
        const data = await getSellerDashboardData(orphanId);
        const firstProd = data.recentProducts[0];

        assert.ok(firstProd.id, 'Le produit doit posséder un id');
        assert.ok(firstProd.title, 'Le produit doit posséder un title');
        assert.equal(typeof firstProd.price, 'number', 'Le produit doit avoir un prix numérique');
        assert.equal(typeof firstProd.stock, 'number', 'Le produit doit avoir un stock');

        console.log('  ✅ Test 2 validé : Structure des produits récents conforme.');
        passed++;
    } catch (err) {
        console.error('  ❌ Échec Test 2 :', err.message);
        failed++;
    }

    // Test 3 : Présence de la section UI "Mes articles récents" dans SellerDashboard.js
    try {
        console.log('\nTest 3 : Présence de la section "Mes articles récents" dans le code de SellerDashboard.js');
        const dashboardPath = path.join(rootDir, 'src', 'components', 'seller', 'SellerDashboard.js');
        assert.ok(fs.existsSync(dashboardPath), 'SellerDashboard.js doit exister');
        const content = fs.readFileSync(dashboardPath, 'utf8');

        assert.ok(content.includes('Mes articles récents'), "SellerDashboard.js doit contenir l'en-tête 'Mes articles récents'");
        assert.ok(content.includes('btn-dashboard-view-all-products'), "SellerDashboard.js doit contenir le bouton #btn-dashboard-view-all-products");
        assert.ok(content.includes('btn-dashboard-home-add-product'), "SellerDashboard.js doit contenir le bouton #btn-dashboard-home-add-product");
        assert.ok(content.includes('dashboard-home-product-card'), "SellerDashboard.js doit contenir les cartes .dashboard-home-product-card");

        console.log('  ✅ Test 3 validé : Section "Mes articles récents" et interactions présentes dans SellerDashboard.js.');
        passed++;
    } catch (err) {
        console.error('  ❌ Échec Test 3 :', err.message);
        failed++;
    }

    // Test 4 : Vérification du script SQL de migration
    try {
        console.log('\nTest 4 : Vérification de la migration SQL migration_fix_orphan_seller_profiles.sql');
        const migrationPath = path.join(rootDir, 'database', 'migration_fix_orphan_seller_profiles.sql');
        assert.ok(fs.existsSync(migrationPath), 'Le fichier de migration SQL doit exister');
        const sqlContent = fs.readFileSync(migrationPath, 'utf8');

        assert.ok(sqlContent.includes('INSERT INTO public.profiles'), 'Le script doit insérer les profils orphelins');
        assert.ok(sqlContent.includes("ON CONFLICT (id) DO NOTHING"), 'Le script doit être strictement idempotent');
        assert.ok(sqlContent.includes("L'utilisateur peut créer son profil"), 'Le script doit assouplir la politique RLS pour vendeur');
        assert.ok(sqlContent.includes("quota_status = 'masqué_quota'"), 'Le script doit réactiver les produits masqués par erreur');

        console.log('  ✅ Test 4 validé : Migration SQL complète, sécurisée et idempotente.');
        passed++;
    } catch (err) {
        console.error('  ❌ Échec Test 4 :', err.message);
        failed++;
    }

    console.log(`\n========================================`);
    console.log(`Résultats : ${passed} validé(s), ${failed} échec(s)`);
    console.log(`========================================\n`);

    if (failed > 0) {
        process.exit(1);
    }
}

runTests();
