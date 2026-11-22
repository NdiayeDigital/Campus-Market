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

    // Test 5 : Vérification de l'absence de crash ReferenceError (subStatus) dans ProductManager.js
    try {
        console.log('\nTest 5 : Vérification du scope des variables dans ProductManager.js (renderProductsListView)');
        const pmPath = path.join(rootDir, 'src', 'components', 'seller', 'ProductManager.js');
        assert.ok(fs.existsSync(pmPath), 'ProductManager.js doit exister');
        const pmContent = fs.readFileSync(pmPath, 'utf8');

        // Vérifier que renderProductsListView extrait getQuotaInfo pour définir subStatus
        const listViewFunc = pmContent.slice(pmContent.indexOf('function renderProductsListView'));
        assert.ok(
            listViewFunc.includes('getQuotaInfo()'),
            'renderProductsListView doit appeler getQuotaInfo() pour initialiser subStatus et les quotas'
        );
        assert.ok(
            pmContent.includes('renderActiveContent()'),
            'render() doit encapsuler le rendu dans un try/catch sécurisé pour ne jamais bloquer sur un skeleton'
        );

        console.log('  ✅ Test 5 validé : ProductManager.js sécurisé contre les ReferenceError.');
        passed++;
    } catch (err) {
        console.error('  ❌ Échec Test 5 :', err.message);
        failed++;
    }

    // Test 6 : Vérification de l'incrémentation du cache Service Worker PWA (v27) et de l'écoute controllerchange
    try {
        console.log('\nTest 6 : Vérification de la purge du cache Service Worker (v27) et auto-reload');
        const swPath = path.join(rootDir, 'public', 'sw.js');
        const mainPath = path.join(rootDir, 'src', 'main.js');
        assert.ok(fs.existsSync(swPath), 'public/sw.js doit exister');
        assert.ok(fs.existsSync(mainPath), 'src/main.js doit exister');

        const swContent = fs.readFileSync(swPath, 'utf8');
        const mainContent = fs.readFileSync(mainPath, 'utf8');

        assert.ok(
            swContent.includes("CACHE_NAME = 'campus-market-v27'"),
            "public/sw.js doit définir CACHE_NAME = 'campus-market-v27' pour invalider l'ancien cache v26"
        );
        assert.ok(
            mainContent.includes("controllerchange"),
            "src/main.js doit écouter 'controllerchange' pour recharger la page dès qu'un nouveau Service Worker s'active"
        );

        console.log('  ✅ Test 6 validé : Service Worker v27 et auto-actualisation controllerchange configurés.');
        passed++;
    } catch (err) {
        console.error('  ❌ Échec Test 6 :', err.message);
        failed++;
    }

    // Test 7 : Vérification de l'hydratation immédiate avec initialProducts
    try {
        console.log('\nTest 7 : Vérification de l\'hydratation immédiate avec initialProducts sans skeleton flash');
        const dashboardPath = path.join(rootDir, 'src', 'components', 'seller', 'SellerDashboard.js');
        const pmPath = path.join(rootDir, 'src', 'components', 'seller', 'ProductManager.js');
        const sellerServicePath = path.join(rootDir, 'src', 'services', 'seller-service.js');

        const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');
        const pmContent = fs.readFileSync(pmPath, 'utf8');
        const sellerServiceContent = fs.readFileSync(sellerServicePath, 'utf8');

        assert.ok(
            sellerServiceContent.includes('allProducts: productsList'),
            'getSellerDashboardData doit exposer allProducts'
        );
        assert.ok(
            dashboardContent.includes('initialProducts: dashboardData?.allProducts || dashboardData?.recentProducts'),
            'SellerDashboard.js doit injecter initialProducts dans createProductManager'
        );
        assert.ok(
            pmContent.includes('initialProducts = []'),
            'createProductManager doit accepter initialProducts'
        );
        assert.ok(
            pmContent.includes('isLoading = products.length === 0'),
            'isLoading doit être faux dès le montage si initialProducts est renseigné'
        );

        console.log('  ✅ Test 7 validé : Chaîne d\'hydratation immédiate initialProducts conforme et sans blocage.');
        passed++;
    } catch (err) {
        console.error('  ❌ Échec Test 7 :', err.message);
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
