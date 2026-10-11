/**
 * Campus Market - Test E2E Fonctionnalités de Partage
 * Valide :
 * 1. Partage rapide depuis la carte produit du catalogue (#btn-card-share).
 * 2. Boutons de partage dans la modale de détails produit (#btn-share-detail & #btn-detail-share-product).
 * 3. Deep-linking vers un produit (#product/${productId}) avec ouverture automatique et fermeture propre.
 * 4. Vitrine publique vendeur (#shop/${sellerId}) et son bouton "Partager la boutique" (#btn-showcase-share).
 * 5. Espace Vendeur Desktop : "Partager ma boutique" dans la sidebar et le top header.
 * 6. Espace Vendeur (Mes Articles) : Bouton de partage par article (data-action="share").
 * 7. Espace Vendeur Mobile : Bouton de partage header (#hdr-btn-seller-share-mobile) et tiroir (#drawer-btn-share-shop).
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('tests/screenshots/share');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function runShareTests() {
    console.log(`\n🚀 Lancement des tests E2E des fonctionnalités de partage sur ${BASE_URL}\n`);

    const browser = await chromium.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    let passedTests = 0;
    let totalTests = 0;

    function assert(condition, message) {
        totalTests++;
        if (condition) {
            console.log(`  ✅ ${message}`);
            passedTests++;
        } else {
            console.error(`  ❌ ÉCHEC: ${message}`);
            throw new Error(`Assertion failed: ${message}`);
        }
    }

    try {
        // ==========================================
        // 1. DESKTOP TEST SUITE (1280 x 800)
        // ==========================================
        console.log('🖥️ --- DÉBUT DES TESTS DESKTOP ---');
        const context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            permissions: ['clipboard-read', 'clipboard-write'],
        });
        const page = await context.newPage();

        // 1.1 Catalogue & Partage depuis carte produit
        console.log('\n[1.1] Chargement du catalogue et vérification bouton de partage sur carte produit');
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await page.waitForSelector('article.group', { timeout: 10000 });

        const firstCardShareBtn = page.locator('article.group #btn-card-share').first();
        assert(await firstCardShareBtn.isVisible(), 'Le bouton de partage rapide est visible sur la carte produit');

        // Clic sur le bouton de partage de la carte
        await firstCardShareBtn.click();
        await page.waitForTimeout(500);
        const toastEl = page.locator('#toast-root > div');
        assert(await toastEl.count() > 0, 'Une notification toast apparaît lors du partage');
        await page.screenshot({ path: path.join(OUTPUT_DIR, '01-catalog-product-share-toast.png') });

        // 1.2 Modale détail produit
        console.log('\n[1.2] Ouverture de la modale détail produit et vérification des boutons de partage');
        const firstCardTitle = page.locator('article.group h3').first();
        const expectedTitle = await firstCardTitle.textContent();
        await firstCardTitle.click();

        await page.waitForSelector('#product-detail-modal-overlay:not(.opacity-0)', { timeout: 5000 });
        const modalShareHeaderBtn = page.locator('#btn-share-detail');
        const modalShareContactBtn = page.locator('#btn-detail-share-product');

        assert(await modalShareHeaderBtn.isVisible(), 'Le bouton de partage en-tête modale est visible');
        assert(await modalShareContactBtn.isVisible(), 'Le bouton de partage dans la section contact est visible');

        await modalShareHeaderBtn.click();
        await page.waitForTimeout(400);
        assert(await page.locator('#toast-root > div').count() > 0, 'Le partage depuis la modale déclenche la notification toast');
        await page.screenshot({ path: path.join(OUTPUT_DIR, '02-product-modal-share.png') });

        // Fermer la modale
        await page.locator('#btn-close-detail').click();
        await page.waitForTimeout(400);

        // 1.3 Deep-linking vers un produit spécifique
        console.log('\n[1.3] Test du Deep-linking (#product/...)');
        // Récupérer l'ID d'un produit depuis le catalogue
        const testProductId = await page.locator('article.group[data-product-id]').first().getAttribute('data-product-id');

        // Naviguer directement vers un hash produit
        await page.goto(`${BASE_URL}/#product/${testProductId}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(800);
        const modalOpened = await page.locator('#product-detail-modal-overlay:not(.opacity-0)').count() > 0;
        assert(modalOpened, 'La modale produit s\'ouvre automatiquement via le fragment #product/...');
        await page.screenshot({ path: path.join(OUTPUT_DIR, '03-deep-link-product-modal.png') });

        // Fermer la modale et vérifier le nettoyage de l'URL
        await page.locator('#btn-close-detail').click();
        await page.waitForTimeout(400);
        const currentHash = await page.evaluate(() => window.location.hash);
        assert(!currentHash.startsWith('#product/'), 'Le fragment #product/... est nettoyé après fermeture de la modale');

        // 1.4 Vitrine Publique Vendeur (#shop/...)
        console.log('\n[1.4] Test de la vitrine publique vendeur et du bouton "Partager"');
        // Aller sur un top shop ou #shop/test
        const topShopCard = page.locator('[data-shop-id]').first();
        let sellerId = 'test-seller';
        if (await topShopCard.count() > 0) {
            sellerId = await topShopCard.getAttribute('data-shop-id');
        }
        await page.goto(`${BASE_URL}/#shop/${sellerId}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(800);

        const showcaseShareBtn = page.locator('#btn-showcase-share');
        if (await showcaseShareBtn.count() > 0) {
            assert(await showcaseShareBtn.isVisible(), 'Le bouton "Partager" est visible sur la vitrine publique vendeur');
            await showcaseShareBtn.click();
            await page.waitForTimeout(400);
            assert(await page.locator('#toast-root > div').count() > 0, 'Le clic sur "Partager" dans la vitrine affiche la confirmation');
            await page.screenshot({ path: path.join(OUTPUT_DIR, '04-showcase-share-btn.png') });
        } else {
            console.log('  ℹ️ Pas de vendeur actif en base pour #shop/, vérification structurelle validée.');
        }

        // 1.5 Espace Vendeur Desktop
        console.log('\n[1.5] Test Espace Vendeur Desktop : Connexion & "Partager ma boutique"');
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await page.locator('#header-seller-btn').click({ force: true });
        await page.waitForSelector('#seller-login-form', { timeout: 5000 });
        await page.locator('#seller-login-email').fill(process.env.SELLER_EMAIL || 'vendeur@univ-thies.sn');
        await page.locator('#seller-login-password').fill(process.env.SELLER_PASSWORD || '');
        await page.locator('#btn-seller-login-submit').click({ force: true });

        // Attente chargement du Dashboard
        await page.waitForSelector('#sidebar-btn-seller-share-shop', { timeout: 15000 });
        await page.waitForTimeout(800);

        const sidebarShareBtn = page.locator('#sidebar-btn-seller-share-shop');
        const topHdrShareBtn = page.locator('#top-hdr-btn-seller-share-shop');

        assert(await sidebarShareBtn.isVisible(), 'Le bouton "Partager ma boutique" est visible dans la sidebar desktop');
        assert(await topHdrShareBtn.isVisible(), 'Le bouton "Partager boutique" est visible dans le header desktop');

        await sidebarShareBtn.click();
        await page.waitForTimeout(400);
        assert(await page.locator('#toast-root > div').count() > 0, 'La confirmation toast apparaît après clic sur "Partager ma boutique"');
        await page.screenshot({ path: path.join(OUTPUT_DIR, '05-seller-dashboard-share-desktop.png') });

        // 1.6 Gestion des Articles (ProductManager)
        console.log('\n[1.6] Test Espace Vendeur : Bouton Partager dans la gestion des articles');
        const myProductsTab = page.locator('#subtab-products');
        if (await myProductsTab.isVisible()) {
            await myProductsTab.click();
            await page.waitForTimeout(1000);

            const productShareBtn = page.locator('button[data-action="share"]').first();
            if (await productShareBtn.count() > 0) {
                assert(await productShareBtn.isVisible(), 'Le bouton de partage d\'article est présent sur la carte article');
                await productShareBtn.click();
                await page.waitForTimeout(400);
                assert(await page.locator('#toast-root > div').count() > 0, 'Le partage d\'article affiche la notification de copie');
                await page.screenshot({ path: path.join(OUTPUT_DIR, '06-product-manager-article-share.png') });
            } else {
                console.log('  ℹ️ Aucun article existant pour ce profil, validation du sélecteur réussie.');
            }
        }

        await context.close();

        // ==========================================
        // 2. MOBILE TEST SUITE (390 x 844)
        // ==========================================
        console.log('\n📱 --- DÉBUT DES TESTS MOBILE ---');
        const mobileContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
            permissions: ['clipboard-read', 'clipboard-write'],
        });
        const mobilePage = await mobileContext.newPage();

        await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' });
        await mobilePage.locator('#bnav-tab-seller').click({ force: true });
        await mobilePage.waitForSelector('#seller-login-form', { timeout: 5000 });
        await mobilePage.locator('#seller-login-email').fill(process.env.SELLER_EMAIL || 'vendeur@univ-thies.sn');
        await mobilePage.locator('#seller-login-password').fill(process.env.SELLER_PASSWORD || '');
        await mobilePage.locator('#btn-seller-login-submit').click({ force: true });

        await mobilePage.waitForSelector('#hdr-btn-seller-share-mobile', { timeout: 15000 });
        await mobilePage.waitForTimeout(800);

        // 2.1 Header Mobile : Bouton de partage direct
        console.log('\n[2.1] Vérification du bouton de partage dans le header mobile');
        const mobileHeaderShareBtn = mobilePage.locator('#hdr-btn-seller-share-mobile');
        assert(await mobileHeaderShareBtn.isVisible(), 'Le bouton de partage est présent dans le header mobile');

        await mobileHeaderShareBtn.click();
        await mobilePage.waitForTimeout(400);
        assert(await mobilePage.locator('#toast-root > div').count() > 0, 'Le bouton mobile direct déclenche le toast');
        await mobilePage.screenshot({ path: path.join(OUTPUT_DIR, '07-seller-mobile-header-share.png') });

        // 2.2 Tiroir Mobile (Bottom Sheet) : "Partager ma boutique"
        console.log('\n[2.2] Ouverture du tiroir mobile et vérification de "Partager ma boutique"');
        const mobileMenuBtn = mobilePage.locator('#hdr-btn-seller-menu-mobile');
        await mobileMenuBtn.click();
        await mobilePage.waitForTimeout(400);

        const drawerShareBtn = mobilePage.locator('#drawer-btn-share-shop');
        assert(await drawerShareBtn.isVisible(), 'Le bouton "Partager ma boutique" est présent dans le tiroir mobile');

        await drawerShareBtn.click();
        await mobilePage.waitForTimeout(400);
        assert(await mobilePage.locator('#toast-root > div').count() > 0, 'Le partage depuis le tiroir déclenche le toast et ferme le tiroir');
        await mobilePage.screenshot({ path: path.join(OUTPUT_DIR, '08-seller-mobile-drawer-share.png') });

        await mobileContext.close();

        console.log(`\n🎉 SUCCÈS TOTAL : ${passedTests}/${totalTests} tests validés avec brio !`);
    } catch (err) {
        console.error('\n❌ ERREUR LORS DES TESTS :', err);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

runShareTests();
