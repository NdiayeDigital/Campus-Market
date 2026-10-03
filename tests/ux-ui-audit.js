/**
 * Campus Market - Suite d'audit automatisée UX/UI Multi-Formats
 * Exécute des tests d'affichage, d'ergonomie, de débordement et de fluidité
 * sur 5 viewports clés avec captures d'écran et métriques WCAG.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SCREENSHOTS_DIR = path.resolve('tests/screenshots');

const FORMATS = [
    {
        key: 'mobile-compact',
        name: 'Mobile Compact (iPhone SE)',
        viewport: { width: 375, height: 667 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
    },
    {
        key: 'mobile-standard',
        name: 'Mobile Standard (iPhone 14/15)',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
    },
    {
        key: 'tablet-portrait',
        name: 'Tablette Portrait (iPad 768px)',
        viewport: { width: 768, height: 1024 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 1,
    },
    {
        key: 'laptop-standard',
        name: 'Laptop Standard (1280x800)',
        viewport: { width: 1280, height: 800 },
        isMobile: false,
        hasTouch: false,
        deviceScaleFactor: 1,
    },
    {
        key: 'desktop-fhd',
        name: 'Grand Écran Desktop FHD (1920x1080)',
        viewport: { width: 1920, height: 1080 },
        isMobile: false,
        hasTouch: false,
        deviceScaleFactor: 1,
    },
];

// Nettoyage ou création du dossier des captures
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

async function runAudit() {
    console.log(`\n🚀 Lancement de l'audit UX/UI Multi-Formats sur Campus Market : ${BASE_URL}\n`);

    const browser = await chromium.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const auditResults = [];

    for (const fmt of FORMATS) {
        console.log(`📱 Format en cours : ${fmt.name} (${fmt.viewport.width}x${fmt.viewport.height})`);
        const fmtDir = path.join(SCREENSHOTS_DIR, fmt.key);
        if (!fs.existsSync(fmtDir)) fs.mkdirSync(fmtDir, { recursive: true });

        const context = await browser.newContext({
            viewport: fmt.viewport,
            isMobile: fmt.isMobile,
            hasTouch: fmt.hasTouch,
            deviceScaleFactor: fmt.deviceScaleFactor,
            locale: 'fr-FR',
        });

        const page = await context.newPage();
        const consoleErrors = [];
        const consoleWarns = [];

        page.on('console', (msg) => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
            if (msg.type() === 'warning') consoleWarns.push(msg.text());
        });

        page.on('pageerror', (err) => {
            consoleErrors.push(`[PageError] ${err.message}`);
        });

        const fmtResult = {
            format: fmt.key,
            name: fmt.name,
            viewport: fmt.viewport,
            overflowIssues: [],
            smallTouchTargets: [],
            flowsTested: 0,
            consoleErrors: [],
            screenshots: [],
        };

        try {
            // Helper pour vérifier le débordement horizontal
            const checkOverflow = async (stepName) => {
                const overflows = await page.evaluate(() => {
                    const docWidth = document.documentElement.clientWidth;
                    const badElements = [];
                    const all = document.querySelectorAll('*');
                    for (const el of all) {
                        const rect = el.getBoundingClientRect();
                        if (rect.right > docWidth + 2) {
                            badElements.push({
                                tag: el.tagName.toLowerCase(),
                                id: el.id,
                                className: (el.className || '').toString().slice(0, 50),
                                right: Math.round(rect.right),
                                docWidth: docWidth,
                            });
                            if (badElements.length >= 3) break;
                        }
                    }
                    return {
                        hasDocOverflow: document.documentElement.scrollWidth > docWidth + 1,
                        scrollWidth: document.documentElement.scrollWidth,
                        docWidth,
                        badElements,
                    };
                });

                if (overflows.hasDocOverflow) {
                    fmtResult.overflowIssues.push({
                        step: stepName,
                        details: overflows,
                    });
                }
            };

            // Helper pour vérifier les cibles tactiles
            const checkTouchTargets = async (stepName) => {
                if (!fmt.isMobile) return;
                const smalls = await page.evaluate(() => {
                    const targets = document.querySelectorAll('button, a, input, select');
                    const issues = [];
                    for (const t of targets) {
                        if (t.offsetParent === null) continue; // Masqué
                        const rect = t.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            if (rect.width < 40 || rect.height < 40) {
                                issues.push({
                                    tag: t.tagName.toLowerCase(),
                                    id: t.id,
                                    text: (t.innerText || t.getAttribute('aria-label') || '').trim().slice(0, 30),
                                    w: Math.round(rect.width),
                                    h: Math.round(rect.height),
                                });
                                if (issues.length >= 5) break;
                            }
                        }
                    }
                    return issues;
                });
                if (smalls.length > 0) {
                    fmtResult.smallTouchTargets.push({ step: stepName, elements: smalls });
                }
            };

            // 1. Vue Catalogue / Accueil
            await page.goto(BASE_URL, { waitUntil: 'networkidle' });
            await page.waitForTimeout(600); // Rendu et animations
            await checkOverflow('01_catalogue_home');
            await checkTouchTargets('01_catalogue_home');
            const p1 = path.join(fmtDir, '01_catalogue_home.png');
            await page.screenshot({ path: p1, fullPage: false });
            fmtResult.screenshots.push('01_catalogue_home.png');
            fmtResult.flowsTested++;

            // 2. Filtre de Catégories
            const secondChip = page.locator('.category-chip').nth(1);
            if (await secondChip.isVisible()) {
                await secondChip.click({ force: true });
                await page.waitForTimeout(400);
                await checkOverflow('02_category_filtered');
                const p2 = path.join(fmtDir, '02_category_filtered.png');
                await page.screenshot({ path: p2 });
                fmtResult.screenshots.push('02_category_filtered.png');
                fmtResult.flowsTested++;
                
                // Revenir à "Tous"
                await page.locator('.category-chip').first().click({ force: true });
                await page.waitForTimeout(300);
            }

            // 3. Recherche instantanée
            const searchInput = page.locator('#header-search-input');
            if (await searchInput.isVisible()) {
                await searchInput.fill('café');
                await page.waitForTimeout(500);
                await checkOverflow('03_search_results');
                const p3 = path.join(fmtDir, '03_search_results.png');
                await page.screenshot({ path: p3 });
                fmtResult.screenshots.push('03_search_results.png');
                fmtResult.flowsTested++;

                // Effacer la recherche et attendre le rechargement complet du catalogue
                const clearBtn = page.locator('#header-search-clear');
                if (await clearBtn.isVisible()) {
                    await clearBtn.click({ force: true });
                } else {
                    await searchInput.fill('');
                }
                await page.waitForTimeout(600);
            }

            // 4. Modale Détail Produit & Ajout au panier
            const productCard = page.locator('article.group').first();
            try {
                await productCard.waitFor({ state: 'visible', timeout: 4000 });
                await productCard.click({ force: true });
                await page.waitForTimeout(500);

                const detailOverlay = page.locator('#product-detail-modal-overlay');
                await detailOverlay.waitFor({ state: 'visible', timeout: 3000 });
                await checkOverflow('04_product_detail_modal');
                const p4 = path.join(fmtDir, '04_product_detail_modal.png');
                await page.screenshot({ path: p4 });
                fmtResult.screenshots.push('04_product_detail_modal.png');
                fmtResult.flowsTested++;

                // Ajouter au panier directement depuis la fiche détail
                const addDetailBtn = page.locator('#btn-detail-add-cart');
                if (await addDetailBtn.isVisible()) {
                    await addDetailBtn.click({ force: true });
                    await page.waitForTimeout(400);
                }

                // Fermer la modale détail
                const closeDetailBtn = page.locator('#btn-close-detail');
                if (await closeDetailBtn.isVisible()) {
                    await closeDetailBtn.click({ force: true });
                    await page.waitForTimeout(350);
                }
            } catch (err) {
                console.warn(`[${fmt.key}] Détail produit non ouvert:`, err.message);
            }

            const isMobileNav = await page.evaluate(() => window.innerWidth < 640);

            // 5. Modale Panier d'achat (contenant désormais un article)
            if (isMobileNav) {
                const bnavCart = page.locator('#bnav-tab-cart');
                if (await bnavCart.isVisible()) await bnavCart.click({ force: true });
            } else {
                const headerCart = page.locator('#header-cart-btn');
                if (await headerCart.isVisible()) await headerCart.click({ force: true });
            }
            await page.waitForTimeout(600); // Fin de transition du tiroir
            await checkOverflow('05_cart_modal');
            const p5 = path.join(fmtDir, '05_cart_modal.png');
            await page.screenshot({ path: p5 });
            fmtResult.screenshots.push('05_cart_modal.png');
            fmtResult.flowsTested++;

            // 6. Passer à la commande (CheckoutModal avec formulaire pavillon)
            const hasCheckoutBtn = await page.evaluate(() => {
                const btn = document.getElementById('btn-checkout');
                if (btn && btn.offsetParent !== null) {
                    btn.click();
                    return true;
                }
                return false;
            });

            if (hasCheckoutBtn) {
                await page.waitForTimeout(600);
                await checkOverflow('06_checkout_modal');
                const p6 = path.join(fmtDir, '06_checkout_modal.png');
                await page.screenshot({ path: p6 });
                fmtResult.screenshots.push('06_checkout_modal.png');
                fmtResult.flowsTested++;

                // Fermer checkout
                await page.evaluate(() => {
                    document.getElementById('btn-close-checkout')?.click();
                });
                await page.waitForTimeout(400);
            }

            // Fermer la modale panier si encore ouverte
            await page.evaluate(() => {
                const overlay = document.getElementById('cart-modal-overlay');
                if (overlay && overlay.classList.contains('opacity-100')) {
                    document.getElementById('btn-close-cart')?.click();
                }
            });
            await page.waitForTimeout(400);

            // 7. Vue Suivi de commandes
            if (isMobileNav) {
                const bnavOrders = page.locator('#bnav-tab-orders');
                if (await bnavOrders.isVisible()) await bnavOrders.click({ force: true });
            } else {
                const headerOrders = page.locator('#header-orders-btn');
                if (await headerOrders.isVisible()) await headerOrders.click({ force: true });
            }
            await page.waitForTimeout(500);
            await checkOverflow('07_orders_view');
            const p7 = path.join(fmtDir, '07_orders_view.png');
            await page.screenshot({ path: p7 });
            fmtResult.screenshots.push('07_orders_view.png');
            fmtResult.flowsTested++;

            // Revenir au catalogue
            if (isMobileNav) {
                const bnavCatalog = page.locator('#bnav-tab-catalog');
                if (await bnavCatalog.isVisible()) await bnavCatalog.click({ force: true });
            } else {
                const headerCatalog = page.locator('#header-catalog-btn');
                if (await headerCatalog.isVisible()) await headerCatalog.click({ force: true });
            }
            await page.waitForTimeout(400);

            // 8. Vue / Modale Espace Vendeur
            if (isMobileNav) {
                const bnavSeller = page.locator('#bnav-tab-seller');
                if (await bnavSeller.isVisible()) await bnavSeller.click({ force: true });
            } else {
                const headerSeller = page.locator('#header-seller-btn');
                if (await headerSeller.isVisible()) await headerSeller.click({ force: true });
            }
            await page.waitForTimeout(500);
            await checkOverflow('08_seller_auth_view');
            const p8 = path.join(fmtDir, '08_seller_auth_view.png');
            await page.screenshot({ path: p8 });
            fmtResult.screenshots.push('08_seller_auth_view.png');
            fmtResult.flowsTested++;

            // Fermer modale vendeur si ouverte
            await page.evaluate(() => {
                document.getElementById('btn-close-seller-auth')?.click();
            });
            await page.waitForTimeout(300);

            // 9. Vue SuperAdmin (#admin)
            await page.goto(`${BASE_URL}/#admin`, { waitUntil: 'networkidle' });
            await page.waitForTimeout(600);
            await checkOverflow('09_admin_view');
            const p9 = path.join(fmtDir, '09_admin_view.png');
            await page.screenshot({ path: p9 });
            fmtResult.screenshots.push('09_admin_view.png');
            fmtResult.flowsTested++;

        } catch (err) {
            console.error(`❌ Erreur pendant l'audit sur ${fmt.name}:`, err.message);
            fmtResult.error = err.message;
        } finally {
            fmtResult.consoleErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('404 (Not Found)'));
            auditResults.push(fmtResult);
            await context.close();
        }
    }

    await browser.close();

    // Enregistrement du rapport JSON complet
    const reportPath = path.join(SCREENSHOTS_DIR, 'audit-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(auditResults, null, 2), 'utf-8');

    console.log('\n=============================================================');
    console.log('📊 SYNTHÈSE DE L\'AUDIT UX/UI MULTI-FORMATS');
    console.log('=============================================================\n');

    let totalOverflows = 0;
    let totalSmallTargets = 0;
    let totalConsoleErrors = 0;

    auditResults.forEach((res) => {
        const overflowCount = res.overflowIssues.length;
        const smallCount = res.smallTouchTargets.length;
        const errCount = res.consoleErrors.length;
        totalOverflows += overflowCount;
        totalSmallTargets += smallCount;
        totalConsoleErrors += errCount;

        const statusIcon = overflowCount === 0 && errCount === 0 ? '✅' : '⚠️';
        console.log(`${statusIcon} [${res.name}]`);
        console.log(`   - Parcours testés : ${res.flowsTested} / 8`);
        console.log(`   - Débordements horizontaux : ${overflowCount === 0 ? 'Aucun (Parfait)' : overflowCount + ' détecté(s)'}`);
        console.log(`   - Cibles tactiles signalées (<40px) : ${smallCount}`);
        console.log(`   - Erreurs console : ${errCount}`);
        console.log(`   - Captures d'écran : ${res.screenshots.length} enregistrées dans tests/screenshots/${res.format}/`);
        if (overflowCount > 0) {
            console.log(`     ⚠️ Débordement sur : ${res.overflowIssues.map(o => o.step).join(', ')}`);
        }
        if (smallCount > 0) {
            console.log(`     💡 Éléments tactiles :`, res.smallTouchTargets.flatMap(s => s.elements.map(e => `${e.tag}#${e.id || e.text} (${e.w}x${e.h})`)).slice(0, 3));
        }
        console.log('');
    });

    console.log(`📁 Captures disponibles dans : ${SCREENSHOTS_DIR}`);
    console.log(`📄 Rapport JSON généré dans : ${reportPath}\n`);

    return { totalOverflows, totalSmallTargets, totalConsoleErrors, results: auditResults };
}

runAudit().then((summary) => {
    if (summary.totalOverflows > 0) {
        console.warn(`⚠️ Attention : ${summary.totalOverflows} débordement(s) horizontal(aux) à corriger.`);
    } else {
        console.log('🎉 Félicitations : Aucun débordement horizontal détecté sur l\'ensemble des 5 formats !');
    }
}).catch((e) => {
    console.error('Erreur fatale audit :', e);
    process.exit(1);
});
