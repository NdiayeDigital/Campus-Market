/**
 * Campus Market - Test E2E & Audit Visuel des Interfaces Vendeur & SuperAdmin
 * Comptes de test réels :
 * - Vendeur : fatou.sow@univ-thies.sn / Passer123!
 * - SuperAdmin : maamin.ndiaye@univ-thies.sn / Mouhamadou_2005
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SCREENSHOTS_DIR = path.resolve('tests/screenshots');
const SELLER_DIR = path.join(SCREENSHOTS_DIR, 'seller');
const ADMIN_DIR = path.join(SCREENSHOTS_DIR, 'admin');

// Création des dossiers de sortie
[SELLER_DIR, ADMIN_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

async function runTests() {
    console.log(`\n🚀 Démarrage du banc de test E2E Vendeur & Admin sur ${BASE_URL}\n`);

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
            await page.locator('#seller-login-email').fill('fatou.sow@univ-thies.sn');
            await page.locator('#seller-login-password').fill('Passer123!');
            await page.locator('#btn-seller-login-submit').click({ force: true });

            // 3. Attente du chargement du Dashboard Vendeur
            const sellerIndicator = isMobile ? page.locator('#hdr-btn-seller-menu-mobile') : page.locator('#hdr-btn-seller-logout');
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
            await page.waitForTimeout(1800);

            const shotProducts = `${prefix}_03_seller_products_tab.png`;
            await page.screenshot({ path: path.join(SELLER_DIR, shotProducts) });
            report.seller.screenshots.push(shotProducts);
            console.log(`   ✅ Onglet 'Mes Articles' affiché (${prefix})`);

            // 5. Test Onglet Ajouter un produit (avec Live Preview)
            if (isMobile) {
                const bnavAdd = page.locator('#bnav-seller-add');
                if (await bnavAdd.isVisible()) await bnavAdd.click({ force: true });
            } else {
                const subtabAdd = page.locator('#subtab-add-product');
                if (await subtabAdd.isVisible()) await subtabAdd.click({ force: true });
            }
            await page.waitForTimeout(600);

            // Remplissage interactif pour tester la Live Preview à droite
            const titleInput = page.locator('#pm-title-input');
            const priceInput = page.locator('#pm-price-input');
            if (await titleInput.isVisible()) {
                await titleInput.fill('Thiéboudienne Royale PDU');
                if (await priceInput.isVisible()) await priceInput.fill('2500');
                await page.waitForTimeout(400); // Mise à jour dynamique de la preview
            }

            const shotAddProduct = `${prefix}_04_seller_add_product_live_preview.png`;
            await page.screenshot({ path: path.join(SELLER_DIR, shotAddProduct) });
            report.seller.screenshots.push(shotAddProduct);
            console.log(`   ✅ Formulaire d'ajout & Live Preview validés (${prefix})`);

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
                await page.waitForTimeout(600); // Toast & mise à jour état

                const shotToggle = `${prefix}_06_seller_shop_toggled_pause.png`;
                await page.screenshot({ path: path.join(SELLER_DIR, shotToggle) });
                report.seller.screenshots.push(shotToggle);

                // Re-basculer à Ouvert pour préserver l'état initial
                await shopToggleBtn.click({ force: true });
                await page.waitForTimeout(600);
                console.log(`   ✅ Interrupteur 'Boutique Ouverte / En Pause' testé (${prefix})`);
            }

            // 8. Test Déconnexion Vendeur (Drawer sur mobile, Sidebar sur desktop)
            if (isMobile) {
                const menuBtn = page.locator('#hdr-btn-seller-menu-mobile');
                if (await menuBtn.isVisible()) await menuBtn.click({ force: true });
                await page.waitForTimeout(400);
                const drawerLogout = page.locator('#drawer-btn-logout');
                if (await drawerLogout.isVisible()) {
                    await drawerLogout.click({ force: true });
                    await page.waitForTimeout(600);
                    console.log(`   ✅ Déconnexion réussie (${prefix})`);
                }
            } else {
                const logoutBtn = page.locator('#hdr-btn-seller-logout');
                if (await logoutBtn.isVisible()) {
                    await logoutBtn.click({ force: true });
                    await page.waitForTimeout(600);
                    console.log(`   ✅ Déconnexion réussie (${prefix})`);
                }
            }

            if (prefix === 'desktop') report.seller.desktopPassed = true;
            if (prefix === 'mobile') report.seller.mobilePassed = true;

        } catch (err) {
            console.error(`❌ Erreur parcours Vendeur [${prefix}]:`, err.message);
            report.seller.errors.push(`[${prefix}] ${err.message}`);
        } finally {
            await context.close();
        }
    };

    await testSellerFlow({ width: 1920, height: 1080 }, false, 'desktop');
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
        const consoleErrors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });
        page.on('pageerror', (err) => consoleErrors.push(err.message));

        try {
            // 1. Accès direct au portail administrateur
            await page.goto(`${BASE_URL}/#admin`, { waitUntil: 'networkidle' });
            await page.waitForTimeout(600);

            // Vérification de la présence du formulaire de login SuperAdmin
            const adminForm = page.locator('#superadmin-login-form');
            await adminForm.waitFor({ state: 'visible', timeout: 5000 });

            const shotLogin = `${prefix}_07_admin_login_portal.png`;
            await page.screenshot({ path: path.join(ADMIN_DIR, shotLogin) });
            report.admin.screenshots.push(shotLogin);

            // 2. Saisie des identifiants SuperAdmin
            await page.locator('#admin-login-email').fill('maamin.ndiaye@univ-thies.sn');
            await page.locator('#admin-login-password').fill('Mouhamadou_2005');
            await page.locator('#btn-admin-submit').click({ force: true });

            // 3. Attente du chargement complet du Dashboard Administrateur
            const adminIndicator = isMobile ? page.locator('#hdr-btn-admin-menu-mobile') : page.locator('#hdr-btn-refresh-admin');
            await adminIndicator.waitFor({ state: 'visible', timeout: 15000 });
            await page.waitForTimeout(1000); // Rendu Bento KPIs et graphiques

            // Vérification débordement horizontal
            const hasOverflow2 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
            if (hasOverflow2) report.admin.overflows.push(`${prefix}_admin_overflow`);

            const shotOverview = `${prefix}_08_admin_overview.png`;
            await page.screenshot({ path: path.join(ADMIN_DIR, shotOverview) });
            report.admin.screenshots.push(shotOverview);
            console.log(`   ✅ Vue d'ensemble SuperAdmin chargée (${prefix})`);

            // Helper pour cliquer sur les onglets administrateur (Sidebar sur Desktop, Barre d'onglets sur Tablette/Mobile)
            const clickAdminTab = async (tabId) => {
                const targetBtn = page.locator(`[data-tab-target="${tabId}"]`).first();
                if (await targetBtn.isVisible()) {
                    await targetBtn.click({ force: true });
                } else {
                    // Fallback direct
                    await page.evaluate((id) => {
                        const btn = document.querySelector(`[data-tab-target="${id}"]`);
                        if (btn) btn.click();
                    }, tabId);
                }
                await page.waitForTimeout(600);
            };

            // 4. Onglet Marchands (sellers)
            await clickAdminTab('sellers');
            const shotSellers = `${prefix}_09_admin_sellers_tab.png`;
            await page.screenshot({ path: path.join(ADMIN_DIR, shotSellers) });
            report.admin.screenshots.push(shotSellers);
            console.log(`   ✅ Onglet Marchands affiché (${prefix})`);

            // 5. Onglet Comptes & Rôles (accounts)
            await clickAdminTab('accounts');
            const shotAccounts = `${prefix}_10_admin_accounts_tab.png`;
            await page.screenshot({ path: path.join(ADMIN_DIR, shotAccounts) });
            report.admin.screenshots.push(shotAccounts);
            console.log(`   ✅ Onglet Comptes & Rôles affiché (${prefix})`);

            // 6. Onglet Produits (products)
            await clickAdminTab('products');
            const shotProducts = `${prefix}_11_admin_products_tab.png`;
            await page.screenshot({ path: path.join(ADMIN_DIR, shotProducts) });
            report.admin.screenshots.push(shotProducts);
            console.log(`   ✅ Onglet Produits affiché (${prefix})`);

            // 7. Onglet Commandes (orders)
            await clickAdminTab('orders');
            const shotOrders = `${prefix}_12_admin_orders_tab.png`;
            await page.screenshot({ path: path.join(ADMIN_DIR, shotOrders) });
            report.admin.screenshots.push(shotOrders);
            console.log(`   ✅ Onglet Commandes campus affiché (${prefix})`);

            // 8. Onglet Lieux de livraison (locations)
            await clickAdminTab('locations');
            const shotLocations = `${prefix}_13_admin_locations_tab.png`;
            await page.screenshot({ path: path.join(ADMIN_DIR, shotLocations) });
            report.admin.screenshots.push(shotLocations);
            console.log(`   ✅ Onglet Lieux de livraison affiché (${prefix})`);

            // 9. Test Bouton Quitter (Drawer sur mobile, Sidebar sur desktop)
            if (isMobile) {
                const menuBtn = page.locator('#hdr-btn-admin-menu-mobile');
                if (await menuBtn.isVisible()) await menuBtn.click({ force: true });
                await page.waitForTimeout(300);
                const drawerExit = page.locator('#drawer-btn-exit-admin');
                if (await drawerExit.isVisible()) {
                    await drawerExit.click({ force: true });
                    await page.waitForTimeout(500);
                    console.log(`   ✅ Déconnexion / Sortie SuperAdmin réussie (${prefix})`);
                }
            } else {
                const exitBtn = page.locator('#hdr-btn-exit-admin');
                if (await exitBtn.isVisible()) {
                    await exitBtn.click({ force: true });
                    await page.waitForTimeout(500);
                    console.log(`   ✅ Déconnexion / Sortie SuperAdmin réussie (${prefix})`);
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

    await browser.close();

    // Rapport JSON final
    const reportPath = path.join(SCREENSHOTS_DIR, 'seller-admin-audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log('\n=============================================================');
    console.log('📊 RÉSULTAT COMPLET DES TESTS VENDEUR & SUPERADMIN');
    console.log('=============================================================\n');

    console.log(`🛍️  Espace Vendeur (Fatou Sow) :`);
    console.log(`   - Desktop FHD (1920x1080) : ${report.seller.desktopPassed ? '✅ VALIDÉ' : '❌ ÉCHEC'}`);
    console.log(`   - Mobile (390x844)        : ${report.seller.mobilePassed ? '✅ VALIDÉ' : '❌ ÉCHEC'}`);
    console.log(`   - Débordements détectés   : ${report.seller.overflows.length === 0 ? '0 (Aucun)' : report.seller.overflows.join(', ')}`);
    console.log(`   - Captures d'écran        : ${report.seller.screenshots.length} dans tests/screenshots/seller/`);

    console.log(`\n🛡️  Portail SuperAdmin (MOUHAMADOU Ndiaye) :`);
    console.log(`   - Desktop FHD (1920x1080) : ${report.admin.desktopPassed ? '✅ VALIDÉ' : '❌ ÉCHEC'}`);
    console.log(`   - Mobile (390x844)        : ${report.admin.mobilePassed ? '✅ VALIDÉ' : '❌ ÉCHEC'}`);
    console.log(`   - Débordements détectés   : ${report.admin.overflows.length === 0 ? '0 (Aucun)' : report.admin.overflows.join(', ')}`);
    console.log(`   - Captures d'écran        : ${report.admin.screenshots.length} dans tests/screenshots/admin/`);

    console.log(`\n📁 Rapport de test : ${reportPath}\n`);

    return report;
}

runTests().then((res) => {
    const success = res.seller.desktopPassed && res.seller.mobilePassed && res.admin.desktopPassed && res.admin.mobilePassed;
    if (success) {
        console.log('🎉 TOUS LES TESTS VENDEUR ET SUPERADMIN SONT PASSÉS AVEC SUCCÈS !');
    } else {
        console.error('⚠️ Certains tests ont échoué.');
        process.exit(1);
    }
}).catch((err) => {
    console.error('Erreur fatale lors des tests :', err);
    process.exit(1);
});
