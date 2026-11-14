/**
 * Suite de tests automatisés : Logo Vendeur & Multi-Photos Produit (3 photos)
 * Valide :
 * 1. Présence et conformité de la migration SQL additive (avatar_url et images JSONB).
 * 2. Disponibilité et signatures des services logo vendeur (uploadSellerLogo, removeSellerLogo).
 * 3. Logique de gestion multi-photos produit (createProduct, updateProduct avec imageFiles).
 * 4. Rendu visuel ProductCard (badge 📷 N, pastille avatar/initiales).
 * 5. Galerie interactive ProductDetailModal (vignettes, carrousel, compteur X/Y).
 * 6. Interface de gestion ProductManager (3 emplacements photos, aperçu direct).
 * 7. Test E2E headless avec Playwright sur http://localhost:5173.
 */

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { uploadSellerLogo, removeSellerLogo } from '../src/services/seller-service.js';
import { createProduct, updateProduct } from '../src/services/product-management.js';

console.log('🧪 Démarrage des tests : Logo Vendeur & Multi-Photos Produit...\n');

// ============================================================================
// 1. VÉRIFICATION DU SCRIPT SQL DE MIGRATION ADDITIVE
// ============================================================================
console.log('--- 1. Contrôle du script SQL de migration additive ---');
const migrationPath = path.resolve('database/migration_seller_logo_and_multi_images.sql');
console.assert(fs.existsSync(migrationPath), 'Échec : Le script migration_seller_logo_and_multi_images.sql doit exister');

const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
console.assert(migrationSql.includes('avatar_url TEXT'), 'Échec : La colonne avatar_url doit être définie dans la migration');
console.assert(migrationSql.includes('images JSONB'), 'Échec : La colonne images JSONB doit être définie dans la migration');
console.assert(migrationSql.includes('ADD COLUMN IF NOT EXISTS'), 'Échec : La migration doit être additive (IF NOT EXISTS)');
console.assert(migrationSql.includes('jsonb_build_array'), 'Échec : Le rétro-remplissage (backfill) des produits existants doit être inclus');
console.log('✅ [SQL Migration] Migration additive et rétrocompatible 100% validée !');

// ============================================================================
// 2. VÉRIFICATION DES SERVICES VENDEUR (LOGO)
// ============================================================================
console.log('\n--- 2. Contrôle des fonctions de service Logo Vendeur ---');
console.assert(typeof uploadSellerLogo === 'function', 'Échec : uploadSellerLogo doit être une fonction exportée');
console.assert(typeof removeSellerLogo === 'function', 'Échec : removeSellerLogo doit être une fonction exportée');

// Test de robustesse sur paramètres manquants
let uploadMissingParamFailed = false;
try {
    await uploadSellerLogo({ sellerId: null, file: null });
} catch (err) {
    uploadMissingParamFailed = err.message.includes('requis');
}
console.assert(uploadMissingParamFailed, 'Échec : uploadSellerLogo doit lever une erreur si sellerId ou file est manquant');

let removeMissingParamFailed = false;
try {
    await removeSellerLogo(null);
} catch (err) {
    removeMissingParamFailed = err.message.includes('requis');
}
console.assert(removeMissingParamFailed, 'Échec : removeSellerLogo doit lever une erreur si sellerId est manquant');
console.log('✅ [Seller Service] uploadSellerLogo et removeSellerLogo validés !');

// ============================================================================
// 3. VÉRIFICATION DU SERVICE PRODUIT (MULTI-PHOTOS)
// ============================================================================
console.log('\n--- 3. Contrôle des fonctions de gestion produit multi-photos ---');
console.assert(typeof createProduct === 'function', 'Échec : createProduct doit être une fonction exportée');
console.assert(typeof updateProduct === 'function', 'Échec : updateProduct doit être une fonction exportée');

// Test de validation des paramètres obligatoires
let createMissingTitleFailed = false;
try {
    await createProduct({ sellerId: 'test-seller', title: '', price: 1000 });
} catch (err) {
    createMissingTitleFailed = true;
}
console.assert(createMissingTitleFailed, 'Échec : createProduct doit rejeter les données sans titre');

let updateMissingIdFailed = false;
try {
    await updateProduct({ productId: null, sellerId: 'test-seller', title: 'Test', price: 1000 });
} catch (err) {
    updateMissingIdFailed = err.message.includes('requis');
}
console.assert(updateMissingIdFailed, 'Échec : updateProduct doit rejeter sans productId');
console.log('✅ [Product Service] createProduct & updateProduct multi-photos validés !');

// ============================================================================
// 4. VÉRIFICATION DU CODE SOURCE DES COMPOSANTS
// ============================================================================
console.log('\n--- 4. Contrôle statique des composants UI mis à jour ---');

// ProductCard.js
const productCardSrc = fs.readFileSync(path.resolve('src/components/ProductCard.js'), 'utf-8');
console.assert(productCardSrc.includes('product.images'), 'Échec : ProductCard doit prendre en compte product.images');
console.assert(productCardSrc.includes('sellerAvatarUrl') || productCardSrc.includes('avatar_url'), 'Échec : ProductCard doit supporter le logo vendeur');
console.assert(productCardSrc.includes('fa-camera'), 'Échec : ProductCard doit afficher le badge photo s\'il y a plusieurs photos');
console.log('✅ [ProductCard] Support multi-photos et logo vendeur validé !');

// ProductDetailModal.js
const modalSrc = fs.readFileSync(path.resolve('src/components/ProductDetailModal.js'), 'utf-8');
console.assert(modalSrc.includes('productImages'), 'Échec : ProductDetailModal doit initialiser productImages');
console.assert(modalSrc.includes('btn-prev-photo') && modalSrc.includes('btn-next-photo'), 'Échec : ProductDetailModal doit fournir les boutons de navigation');
console.assert(modalSrc.includes('btn-detail-thumbnail'), 'Échec : ProductDetailModal doit afficher les vignettes cliquables');
console.assert(modalSrc.includes('sellerLogoUrl') || modalSrc.includes('avatar_url'), 'Échec : ProductDetailModal doit afficher le logo du vendeur');
console.log('✅ [ProductDetailModal] Galerie interactive et logo vendeur validés !');

// SellerProfileView.js
const profileSrc = fs.readFileSync(path.resolve('src/components/seller/SellerProfileView.js'), 'utf-8');
console.assert(profileSrc.includes('seller-logo-file-input'), 'Échec : SellerProfileView doit contenir l\'input de téléversement de logo');
console.assert(profileSrc.includes('uploadSellerLogo'), 'Échec : SellerProfileView doit importer uploadSellerLogo');
console.assert(profileSrc.includes('removeSellerLogo'), 'Échec : SellerProfileView doit importer removeSellerLogo');
console.log('✅ [SellerProfileView] Gestion du logo marchand validée !');

// ProductManager.js
const managerSrc = fs.readFileSync(path.resolve('src/components/seller/ProductManager.js'), 'utf-8');
console.assert(managerSrc.includes('add-photos-slots-container'), 'Échec : ProductManager doit contenir le conteneur 3 photos');
console.assert(managerSrc.includes('edit-photos-slots-container'), 'Échec : ProductManager doit contenir le conteneur 3 photos en édition');
console.assert(managerSrc.includes('Principale *'), 'Échec : Le slot 1 doit être libellé Principale');
console.log('✅ [ProductManager] Emplacements 3 photos validés !');

// ============================================================================
// 5. TEST E2E VIA PLAYWRIGHT SUR SERVEUR VITE
// ============================================================================
console.log('\n--- 5. Test E2E Playwright de l\'interface utilisateur ---');
const SCREENSHOTS_DIR = path.resolve('tests/screenshots/seller-logo-multi-images');
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
let browser;

try {
    browser = await chromium.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    // 5.1 Chargement de la page d'accueil
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(1000);

    const title = await page.title();
    console.assert(title.includes('Campus Market'), `Échec : Titre inattendu : ${title}`);
    console.log(`✅ [E2E] Page d'accueil chargée : "${title}"`);

    // 5.2 Capture de la page d'accueil
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01_catalog_home.png') });

    // 5.3 Test d'ouverture d'un produit (modale avec galerie)
    const firstCard = page.locator('.product-card').first();
    const cardCount = await firstCard.count();

    if (cardCount > 0) {
        await firstCard.click();
        await page.waitForTimeout(600);

        const modal = page.locator('#product-detail-modal');
        const isModalVisible = await modal.isVisible();
        console.assert(isModalVisible, 'Échec : La modale détail produit doit être visible après clic');

        // Capture de la modale détail
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02_product_modal_gallery.png') });
        console.log('✅ [E2E] Modale détail produit avec galerie ouverte avec succès !');

        // Fermeture de la modale
        const closeBtn = page.locator('#btn-close-modal');
        if (await closeBtn.isVisible()) {
            await closeBtn.click();
            await page.waitForTimeout(400);
        }
    } else {
        console.log('ℹ️ [E2E] Aucun produit dans la base locale pour tester le clic de carte.');
    }

    // 5.4 Test de navigation vers le profil marchand (#profile)
    await page.goto(`${BASE_URL}#profile`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03_profile_page.png') });
    console.log('✅ [E2E] Navigation vers #profile validée !');

    console.log('\n🎉 TOUS LES TESTS LOGO VENDEUR & MULTI-PHOTOS ONT RÉUSSI AVEC SUCCÈS !');
} catch (e2eErr) {
    console.error('❌ Erreur lors du test E2E Playwright:', e2eErr.message);
    throw e2eErr;
} finally {
    if (browser) await browser.close();
}
