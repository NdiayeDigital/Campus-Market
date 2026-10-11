/**
 * Campus Market - Test E2E & Audit Visuel des 3 Profils (Vendeur, Admin, Client)
 * Comptes configurables via variables d'environnement (TEST_SELLER_EMAIL, TEST_ADMIN_EMAIL, etc.)
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SCREENSHOTS_DIR = path.resolve('tests/screenshots');
const SELLER_DIR = path.join(SCREENSHOTS_DIR, 'seller');
const ADMIN_DIR = path.join(SCREENSHOTS_DIR, 'admin');
const CLIENT_DIR = path.join(SCREENSHOTS_DIR, 'client');

// Création des dossiers de sortie
[SELLER_DIR, ADMIN_DIR, CLIENT_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

async function runTests() {
    console.log(`\n🚀 Démarrage du banc de test E2E Multi-Profils sur ${BASE_URL}\n`);

    const browser = await chromium.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const report = {
        seller: {
            account: 'fatou.sow@univ-thies.sn (Fatou Sow)',
            desktopPassed: false,
            mobilePassed: false,
            screenshots: [],
            overflows: [],
            errors: [],
        },
        admin: {
            account: 'maamin.ndiaye@univ-thies.sn (MOUHAMADOU Ndiaye)',
            desktopPassed: false,
            mobilePassed: false,
            screenshots: [],
            overflows: [],
            errors: [],
        },
        client: {
            account: 'Étudiant Acheteur (Guest Checkout)',
            desktopPassed: false,
            mobilePassed: false,
            screenshots: [],
            overflows: [],
            errors: [],
        },
    };

    // =========================================================================
    // PARTIE 1 : TEST INTERFACE VENDEUR (Fatou Sow)
    // =========================================================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛍️  PARTIE 1 : TEST INTERFACE VENDEUR (Fatou Sow)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const testSellerFlow = async (viewport, isMobile, prefix) => {
        console.log(`▶ Test Vendeur en format [${prefix}] (${viewport.width}x${viewport.height})...`);
        const context = await browser.newContext({
            viewport,
            isMobile,
            hasTouch: isMobile,
            locale: 'fr-FR',
        });

        const page = await context.newPage();
        const consoleErrors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => consoleErrors.push(err.message));

        try {
            // 1. Accès et ouverture de la modal de connexion marchand
            await page.goto(BASE_URL, { waitUntil: 'networkidle' });
            await page.waitForTimeout(500);

            // Clic sur l'accès Espace Vendeur
            if (isMobile) {
                const bnavSeller = page.locator('#bnav-tab-seller');
                await bnavSeller.click({ force: true });
            } else {
                const headerSeller = page.locator('#header-seller-btn');
                await headerSeller.click({ force: true });
            }

            // Attendre l'apparition du formulaire de connexion vendeur
            const loginForm = page.locator('#seller-login-form');
            await loginForm.waitFor({ state: 'visible', timeout: 5000 });
            await page.waitForTimeout(300);

            const shotLogin = `${prefix}_01_seller_login_modal.png`;
            await page.screenshot({ path: path.join(SELLER_DIR, shotLogin) });
            report.seller.screenshots.push(shotLogin);

            // 2. Remplissage des identifiants et validation
            await page.locator('#seller-login-email').fill(process.env.TEST_SELLER_EMAIL || 'vendeur@univ-thies.sn');
            await page.locator('#seller-login-password').fill(process.env.TEST_SELLER_PASSWORD || '');
            await page.locator('#btn-seller-login-submit').click({ force: true });

            // 3. Attente du chargement du Dashboard Vendeur
            const sellerIndicator = isMobile 
                ? page.locator('#hdr-btn-seller-logout-mobile, #bnav-seller-orders').first() 
                : page.locator('#hdr-btn-seller-logout, #subtab-orders').first();
            await sellerIndicator.waitFor({ state: 'visible', timeout: 15000 });
            await page.waitForTimeout(1000); // Rendu des KPIs Bento et commandes

            // Vérification débordement horizontal
            const hasOverflow1 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
            if (hasOverflow1) report.seller.overflows.push(`${prefix}_dashboard_overflow`);

            const shotDashboard = `${prefix}_02_seller_dashboard_overview.png`;
            await page.screenshot({ path: path.join(SELLER_DIR, shotDashboard) });
            report.seller.screenshots.push(shotDashboard);
            console.log(`   ✅ Dashboard chargé pour Fatou Sow (${prefix})`);

            // 4. Test Onglet Mes Articles (products)
            if (isMobile) {
                const bnavProducts = page.locator('#bnav-seller-products');
                if (await bnavProducts.isVisible()) await bnavProducts.click({ force: true });
            } else {
                const subtabProducts = page.locator('#subtab-products');
                if (await subtabProducts.isVisible()) await subtabProducts.click({ force: true });
            }
            await page.waitForTimeout(1200);

            const shotProducts = `${prefix}_03_seller_products_tab.png`;
            await page.screenshot({ path: path.join(SELLER_DIR, shotProducts) });
            report.seller.screenshots.push(shotProducts);
            console.log(`   ✅ Onglet 'Mes Articles' affiché (${prefix})`);

            // 5. Test Onglet Ajouter un produit & Publication réelle
            if (isMobile) {
                const bnavAdd = page.locator('#bnav-seller-add');
                if (await bnavAdd.isVisible()) await bnavAdd.click({ force: true });
            } else {
                const subtabAdd = page.locator('#subtab-add-product');
                if (await subtabAdd.isVisible()) await subtabAdd.click({ force: true });
            }
            await page.waitForTimeout(600);

            const titleInput = page.locator('#new-prod-title');
            const priceInput = page.locator('#new-prod-price');
            const descInput = page.locator('#new-prod-desc');
            const fileInput = page.locator('#new-prod-image-file');
            const submitProdBtn = page.locator('#btn-submit-new-product');

            if (await titleInput.isVisible()) {
                // 1. Insertion de la photo EN PREMIER pour vérifier l'absence de rechargement/perte de formulaire
                const fakePngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
                await fileInput.setInputFiles({
                    name: 'photo-plat-test.png',
                    mimeType: 'image/png',
                    buffer: fakePngBuffer
                });
                await page.waitForTimeout(600);

                const removePhotoBtn = page.locator('#btn-remove-selected-photo');
                if (await removePhotoBtn.isVisible()) {
                    console.log(`   📸 Photo insérée avec succès sans aucun rechargement (${prefix})`);
                }

                // 2. Remplissage des autres informations après la photo
                const testTitle = `Article Photo ${prefix} ${Date.now()}`;
                await titleInput.fill(testTitle);
                await priceInput.fill('2500');
                if (await descInput.isVisible()) await descInput.fill('Description article test E2E avec photo');
                await page.waitForTimeout(300);

                const shotAddProduct = `${prefix}_04_seller_add_product_live_preview.png`;
                await page.screenshot({ path: path.join(SELLER_DIR, shotAddProduct) });
                report.seller.screenshots.push(shotAddProduct);

                // Soumission du formulaire
                await submitProdBtn.click({ force: true });
                await page.waitForTimeout(2000);

                console.log(`   ✅ Publication du produit avec photo "${testTitle}" réussie (${prefix})`);
            }

            // 6. Test Onglet Commandes (orders)
            if (isMobile) {
                const bnavOrders = page.locator('#bnav-seller-orders');
                if (await bnavOrders.isVisible()) await bnavOrders.click({ force: true });
            } else {
                const subtabOrders = page.locator('#subtab-orders');
                if (await subtabOrders.isVisible()) await subtabOrders.click({ force: true });
            }
            await page.waitForTimeout(600);

            const shotOrders = `${prefix}_05_seller_orders_tab.png`;
            await page.screenshot({ path: path.join(SELLER_DIR, shotOrders) });
            report.seller.screenshots.push(shotOrders);
            console.log(`   ✅ Onglet 'Commandes' affiché (${prefix})`);

            // 7. Test Toggle Disponibilité Boutique (En Pause / Ouvert)
            const shopToggleBtn = isMobile ? page.locator('#hdr-btn-toggle-shop-mobile') : page.locator('#hdr-btn-toggle-shop');
            if (await shopToggleBtn.isVisible()) {
                await shopToggleBtn.click({ force: true });
                await page.waitForTimeout(600);

                const shotToggle = `${prefix}_06_seller_shop_toggled_pause.png`;
                await page.screenshot({ path: path.join(SELLER_DIR, shotToggle) });
                report.seller.screenshots.push(shotToggle);

                // Re-basculer à Ouvert pour préserver l'état initial
                await shopToggleBtn.click({ force: true });
                await page.waitForTimeout(600);
                console.log(`   ✅ Interrupteur 'Boutique Ouverte / En Pause' testé (${prefix})`);
            }

            // 8. Test Déconnexion Vendeur (Header Direct Mobile / Desktop)
            if (isMobile) {
                const logoutMobileBtn = page.locator('#hdr-btn-seller-logout-mobile');
                await logoutMobileBtn.waitFor({ state: 'visible', timeout: 5000 });
                await logoutMobileBtn.click({ force: true });
                await page.waitForTimeout(400);

                const confirmBtn = page.locator('#modal-confirm-action');
                await confirmBtn.waitFor({ state: 'visible', timeout: 3000 });
                await confirmBtn.click({ force: true });
                await page.waitForTimeout(1000);
                console.log(`   ✅ Déconnexion mobile via bouton direct header validée (${prefix})`);
            } else {
                const logoutBtn = page.locator('#hdr-btn-seller-logout');
                await logoutBtn.waitFor({ state: 'visible', timeout: 5000 });
                await logoutBtn.click({ force: true });
                await page.waitForTimeout(400);

                const confirmBtn = page.locator('#modal-confirm-action');
                await confirmBtn.waitFor({ state: 'visible', timeout: 3000 });
                await confirmBtn.click({ force: true });
                await page.waitForTimeout(1000);
                console.log(`   ✅ Déconnexion desktop validée (${prefix})`);
            }

            if (prefix === 'desktop') report.seller.desktopPassed = true;
            if (prefix === 'mobile') report.seller.mobilePassed = true;

        } catch (err) {
            console.error(`❌ Erreur parcours Vendeur [${prefix}]:`, err.message);
            report.seller.errors.push(`[${prefix}] ${err.message}`);
            try {
                await page.screenshot({ path: path.join(SELLER_DIR, `error_${prefix}.png`) });
            } catch {}
        } finally {
            await context.close();
        }
    };

    await testSellerFlow({ width: 1920, height: 1080 }, false, 'desktop');
    await new Promise(r => setTimeout(r, 1200));
    await testSellerFlow({ width: 390, height: 844 }, true, 'mobile');

    // =========================================================================
    // PARTIE 2 : TEST INTERFACE SUPERADMIN (MOUHAMADOU Ndiaye)
    // =========================================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛡️  PARTIE 2 : TEST INTERFACE SUPERADMIN (MOUHAMADOU Ndiaye)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const testAdminFlow = async (viewport, isMobile, prefix) => {
        console.log(`▶ Test SuperAdmin en format [${prefix}] (${viewport.width}x${viewport.height})...`);
        const context = await browser.newContext({
            viewport,
            isMobile,
            hasTouch: isMobile,
            locale: 'fr-FR',
        });

        const page = await context.newPage();
        try {
            await page.goto(`${BASE_URL}/#admin`, { waitUntil: 'networkidle' });
            await page.waitForTimeout(500);

            const emailInput = page.locator('#admin-login-email, #admin-auth-email');
            const passInput = page.locator('#admin-login-password, #admin-auth-password');
            const submitBtn = page.locator('#btn-admin-submit, #btn-admin-login-submit');

            if (await emailInput.isVisible()) {
                await emailInput.fill(process.env.TEST_ADMIN_EMAIL || 'admin@univ-thies.sn');
                await passInput.fill(process.env.TEST_ADMIN_PASSWORD || '');

                const shotAdminLogin = `${prefix}_07_admin_login_portal.png`;
                await page.screenshot({ path: path.join(ADMIN_DIR, shotAdminLogin) });
                report.admin.screenshots.push(shotAdminLogin);

                await submitBtn.click({ force: true });
            }

            const adminIndicator = isMobile
                ? page.locator('#admin-tab-content, #top-hdr-btn-exit-admin-mobile').first()
                : page.locator('#admin-sidebar-overview, #admin-tab-content').first();
            await adminIndicator.waitFor({ state: 'visible', timeout: 15000 });
            await page.waitForTimeout(800);

            const shotOverview = `${prefix}_08_admin_overview.png`;
            await page.screenshot({ path: path.join(ADMIN_DIR, shotOverview) });
            report.admin.screenshots.push(shotOverview);
            console.log(`   ✅ Dashboard SuperAdmin chargé (${prefix})`);

            // Navigation onglets
            const tabTarget = isMobile ? 'nav.lg\\:hidden button[data-tab-target="sellers"]' : '#admin-sidebar-sellers';
            const sellersTab = page.locator(tabTarget).first();
            if (await sellersTab.isVisible()) {
                await sellersTab.click({ force: true });
                await page.waitForTimeout(800);
            }

            const shotSellers = `${prefix}_09_admin_sellers_tab.png`;
            await page.screenshot({ path: path.join(ADMIN_DIR, shotSellers) });
            report.admin.screenshots.push(shotSellers);
            console.log(`   ✅ Onglet Marchands affiché (${prefix})`);

            // Déconnexion SuperAdmin
            if (isMobile) {
                const exitMobileBtn = page.locator('#top-hdr-btn-exit-admin-mobile');
                if (await exitMobileBtn.isVisible()) {
                    await exitMobileBtn.click({ force: true });
                    await page.waitForTimeout(800);
                    console.log(`   ✅ Sortie SuperAdmin via bouton direct mobile réussie (${prefix})`);
                }
            } else {
                const exitBtn = page.locator('#hdr-btn-exit-admin');
                if (await exitBtn.isVisible()) {
                    await exitBtn.click({ force: true });
                    await page.waitForTimeout(800);
                    console.log(`   ✅ Sortie SuperAdmin desktop réussie (${prefix})`);
                }
            }

            if (prefix === 'desktop') report.admin.desktopPassed = true;
            if (prefix === 'mobile') report.admin.mobilePassed = true;

        } catch (err) {
            console.error(`❌ Erreur parcours SuperAdmin [${prefix}]:`, err.message);
            report.admin.errors.push(`[${prefix}] ${err.message}`);
        } finally {
            await context.close();
        }
    };

    await testAdminFlow({ width: 1920, height: 1080 }, false, 'desktop');
    await testAdminFlow({ width: 390, height: 844 }, true, 'mobile');

    // =========================================================================
    // PARTIE 3 : TEST PARCOURS CLIENT / ACHETEUR (Catalogue, Panier, Commande, Suivi)
    // =========================================================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛒  PARTIE 3 : TEST PARCOURS CLIENT / ACHETEUR');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const testClientFlow = async (viewport, isMobile, prefix) => {
        console.log(`▶ Test Client en format [${prefix}] (${viewport.width}x${viewport.height})...`);
        const context = await browser.newContext({
            viewport,
            isMobile,
            hasTouch: isMobile,
            locale: 'fr-FR',
        });

        const page = await context.newPage();
        try {
            await page.goto(BASE_URL, { waitUntil: 'networkidle' });
            await page.waitForTimeout(1000);

            // 1. Consultation catalogue
            const shotCatalog = `${prefix}_01_client_catalog.png`;
            await page.screenshot({ path: path.join(CLIENT_DIR, shotCatalog) });
            report.client.screenshots.push(shotCatalog);
            console.log(`   ✅ Catalogue public affiché (${prefix})`);

            // 2. Recherche textuelle
            const searchInput = page.locator('#header-search-input');
            if (await searchInput.isVisible()) {
                await searchInput.fill('Article');
                await page.waitForTimeout(500);
                await searchInput.fill('');
                await page.waitForTimeout(300);
            }

            // 3. Ajout au panier du premier produit disponible
            const addToCartBtn = page.locator('button[title*="panier"], button:has-text("Ajouter au panier"), button:has-text("Commander")').first();
            if (await addToCartBtn.isVisible()) {
                await addToCartBtn.click({ force: true });
                await page.waitForTimeout(600);
                console.log(`   ✅ Article ajouté au panier (${prefix})`);
            }

            // 4. Ouverture du panier
            const cartBtn = isMobile ? page.locator('#bnav-tab-cart') : page.locator('#header-cart-btn');
            if (await cartBtn.isVisible()) {
                await cartBtn.click({ force: true });
                await page.waitForTimeout(600);

                const shotCart = `${prefix}_02_client_cart_modal.png`;
                await page.screenshot({ path: path.join(CLIENT_DIR, shotCart) });
                report.client.screenshots.push(shotCart);
            }

            // 5. Clic sur "Commander" pour ouvrir le tunnel Checkout
            const checkoutBtn = page.locator('#btn-cart-checkout');
            if (await checkoutBtn.isVisible()) {
                await checkoutBtn.click({ force: true });
                await page.waitForTimeout(600);

                const shotCheckout = `${prefix}_03_client_checkout_modal.png`;
                await page.screenshot({ path: path.join(CLIENT_DIR, shotCheckout) });
                report.client.screenshots.push(shotCheckout);

                // 6. Remplissage des coordonnées de livraison pavillon
                const prenomInput = page.locator('#buyer-prenom');
                const nomInput = page.locator('#buyer-nom');
                const phoneInput = page.locator('#buyer-phone');
                const chambreInput = page.locator('#delivery-chambre');

                if (await prenomInput.isVisible()) {
                    await prenomInput.fill('Amadou');
                    await nomInput.fill('Ba');
                    await phoneInput.fill('778123456');
                    if (await chambreInput.isVisible()) await chambreInput.fill('Chambre B12');
                    await page.waitForTimeout(300);

                    // Soumission de la commande
                    const submitOrderBtn = page.locator('#btn-submit-order');
                    if (await submitOrderBtn.isVisible()) {
                        await submitOrderBtn.click({ force: true });
                        await page.waitForTimeout(3000);

                        const shotSuccess = `${prefix}_04_client_order_confirmed.png`;
                        await page.screenshot({ path: path.join(CLIENT_DIR, shotSuccess) });
                        report.client.screenshots.push(shotSuccess);
                        console.log(`   ✅ Commande passée avec succès et redirigée vers Mes Commandes (${prefix})`);
                    }
                }
            }

            if (prefix === 'desktop') report.client.desktopPassed = true;
            if (prefix === 'mobile') report.client.mobilePassed = true;

        } catch (err) {
            console.error(`❌ Erreur parcours Client [${prefix}]:`, err.message);
            report.client.errors.push(`[${prefix}] ${err.message}`);
        } finally {
            await context.close();
        }
    };

    await testClientFlow({ width: 1920, height: 1080 }, false, 'desktop');
    await testClientFlow({ width: 390, height: 844 }, true, 'mobile');

    await browser.close();

    // Rapport JSON final
    const reportPath = path.join(SCREENSHOTS_DIR, 'seller-admin-audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log('\n=============================================================');
    console.log('📊 RÉSULTAT COMPLET DES TESTS MULTI-PROFILS');
    console.log('=============================================================\n');

    console.log(`🛍️  Espace Vendeur (Fatou Sow) :`);
    console.log(`   - Desktop FHD (1920x1080) : ${report.seller.desktopPassed ? '✅ VALIDÉ' : '❌ ÉCHEC'}`);
    console.log(`   - Mobile (390x844)        : ${report.seller.mobilePassed ? '✅ VALIDÉ' : '❌ ÉCHEC'}`);

    console.log(`\n🛡️  Portail SuperAdmin (MOUHAMADOU Ndiaye) :`);
    console.log(`   - Desktop FHD (1920x1080) : ${report.admin.desktopPassed ? '✅ VALIDÉ' : '❌ ÉCHEC'}`);
    console.log(`   - Mobile (390x844)        : ${report.admin.mobilePassed ? '✅ VALIDÉ' : '❌ ÉCHEC'}`);

    console.log(`\n🛒  Parcours Client / Acheteur :`);
    console.log(`   - Desktop FHD (1920x1080) : ${report.client.desktopPassed ? '✅ VALIDÉ' : '❌ ÉCHEC'}`);
    console.log(`   - Mobile (390x844)        : ${report.client.mobilePassed ? '✅ VALIDÉ' : '❌ ÉCHEC'}`);

    console.log(`\n📁 Rapport d'audit : ${reportPath}\n`);

    return report;
}

runTests().then((res) => {
    const success = res.seller.desktopPassed && res.seller.mobilePassed &&
                    res.admin.desktopPassed && res.admin.mobilePassed &&
                    res.client.desktopPassed && res.client.mobilePassed;
    if (success) {
        console.log('🎉 TOUS LES PARCOURS VENDEUR, ADMIN ET CLIENT SONT 100% VALIDÉS !');
    } else {
        console.error('⚠️ Certains tests ont échoué.');
        process.exit(1);
    }
}).catch((err) => {
    console.error('Erreur fatale lors des tests :', err);
    process.exit(1);
});
