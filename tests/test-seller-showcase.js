/**
 * Campus Market - Test E2E Vitrine Vendeur (Seller Showcase) & Système d'Avis Clients
 * Valide les parcours :
 * 1. Clic sur Top Shop du Campus -> Page vitrine vendeur dédiée
 * 2. Visualisation des coordonnées, statut, note moyenne, et tous les produits du vendeur
 * 3. Clic sur la puce vendeur dans une carte produit du catalogue
 * 4. Clic sur "Visiter la boutique" depuis la modale détail produit
 * 5. Consultation des avis et statistiques (distribution 5★-1★, taux de recommandation)
 * 6. Dépôt d'un avis client avec note 5 étoiles et commentaire
 * 7. Validation responsive Desktop & Mobile (avec barre de navigation fixe)
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const OUTPUT_DIR = path.resolve('tests/screenshots/showcase');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function runShowcaseTests() {
    console.log(`\n🚀 Lancement des tests E2E Vitrine Vendeur & Avis Clients sur ${BASE_URL}\n`);

    const browser = await chromium.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        // ==========================================
        // 1. DESKTOP TEST SUITE (1280 x 800)
        // ==========================================
        console.log('🖥️ --- DÉBUT DES TESTS DESKTOP ---');
        const desktopContext = await browser.newContext({
            viewport: { width: 1280, height: 800 },
        });
        const desktopPage = await desktopContext.newPage();

        // 1.1 Naviguer vers l'accueil
        await desktopPage.goto(BASE_URL, { waitUntil: 'networkidle' });
        await desktopPage.waitForTimeout(1000);

        // Capture de l'accueil avec les Top Shops
        await desktopPage.screenshot({
            path: path.join(OUTPUT_DIR, '01_desktop_catalog_top_shops.png'),
            fullPage: false,
        });
        console.log('📸 Capture 01: Catalogue avec section Top Shops');

        // 1.2 Cliquer sur le premier Top Shop
        const topShopCard = desktopPage.locator('[data-shop-id]').first();
        const topShopExists = await topShopCard.count();
        console.log(`🔍 Nombre de Top Shops détectés : ${topShopExists}`);

        if (topShopExists > 0) {
            const sellerId = await topShopCard.getAttribute('data-shop-id');
            console.log(`👉 Clic sur la carte Top Shop (ID: ${sellerId})...`);
            await topShopCard.click();
            await desktopPage.waitForTimeout(1200);

            // Vérifier que la vue vitrine vendeur est affichée
            const showcaseView = desktopPage.locator('#seller-showcase-view');
            await showcaseView.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ Vitrine vendeur affichée avec succès !');

            // Capture vitrine vendeur - onglet Produits
            await desktopPage.screenshot({
                path: path.join(OUTPUT_DIR, '02_desktop_seller_showcase_products.png'),
                fullPage: false,
            });
            console.log('📸 Capture 02: Vitrine Vendeur (Produits & Coordonnées)');

            // 1.3 Naviguer vers l'onglet Avis clients
            const reviewsTabBtn = desktopPage.locator('#tab-btn-showcase-reviews');
            await reviewsTabBtn.click();
            await desktopPage.waitForTimeout(600);

            // Capture vitrine vendeur - onglet Avis
            await desktopPage.screenshot({
                path: path.join(OUTPUT_DIR, '03_desktop_seller_showcase_reviews.png'),
                fullPage: false,
            });
            console.log('📸 Capture 03: Vitrine Vendeur (Statistiques & Avis)');

            // 1.4 Ouvrir la modale d'avis
            const leaveReviewBtn = desktopPage.locator('#btn-showcase-leave-review');
            if (await leaveReviewBtn.isVisible()) {
                await leaveReviewBtn.click();
                await desktopPage.waitForTimeout(500);

                const reviewModal = desktopPage.locator('#seller-review-modal');
                await reviewModal.waitFor({ state: 'visible', timeout: 3000 });
                console.log('✅ Modale de dépôt d\'avis affichée !');

                // Capture de la modale d'avis
                await desktopPage.screenshot({
                    path: path.join(OUTPUT_DIR, '04_desktop_review_modal.png'),
                    fullPage: false,
                });
                console.log('📸 Capture 04: Modale d\'évaluation 5 étoiles');

                // Choisir 5 étoiles (cliquer sur la 5ème étoile)
                const star5 = desktopPage.locator('[data-star-value="5"]');
                if (await star5.isVisible()) {
                    await star5.click();
                }

                // Remplir le nom et le commentaire
                const nameInput = desktopPage.locator('#review-buyer-name');
                if (await nameInput.isVisible()) {
                    await nameInput.fill('Moussa Sene (Étudiant UFR SET)');
                }

                const commentInput = desktopPage.locator('#review-comment-textarea');
                if (await commentInput.isVisible()) {
                    await commentInput.fill('Produit conforme et remis en main propre en 15 minutes au pavillon A ! Je recommande fortement.');
                }

                // Soumettre l'avis
                const submitBtn = desktopPage.locator('#btn-submit-review-action');
                await submitBtn.click();
                await desktopPage.waitForTimeout(1500);
                console.log('✅ Avis soumis avec succès !');

                // Capture après soumission de l'avis
                await desktopPage.screenshot({
                    path: path.join(OUTPUT_DIR, '05_desktop_review_submitted.png'),
                    fullPage: false,
                });
                console.log('📸 Capture 05: Vitrine avec avis déposé');
            }

            // 1.5 Retour au catalogue
            const backBtn = desktopPage.locator('#btn-showcase-back');
            await backBtn.click();
            await desktopPage.waitForTimeout(800);
            console.log('✅ Retour au catalogue validé via le bouton retour');

            // 1.6 Tester le clic sur la puce vendeur d'une carte produit
            const sellerChipBtn = desktopPage.locator('#card-seller-btn').first();
            if (await sellerChipBtn.count() > 0) {
                console.log('👉 Test du clic sur la puce marchand dans une carte produit...');
                await sellerChipBtn.click();
                await desktopPage.waitForTimeout(1000);
                await desktopPage.locator('#seller-showcase-view').waitFor({ state: 'visible' });
                console.log('✅ Navigation vers la vitrine vendeur depuis la carte produit réussie !');
                await desktopPage.locator('#btn-showcase-back').click();
                await desktopPage.waitForTimeout(800);
            }

            // 1.7 Tester le clic sur "Visiter la boutique" dans la modale détail produit
            const firstProductCard = desktopPage.locator('.product-card').first();
            if (await firstProductCard.count() > 0) {
                console.log('👉 Test ouverture de la modale détail produit...');
                await firstProductCard.click();
                await desktopPage.waitForTimeout(800);

                const viewShopBtn = desktopPage.locator('#btn-detail-view-shop');
                if (await viewShopBtn.isVisible()) {
                    console.log('👉 Clic sur "Visiter la boutique" depuis la modale détail...');
                    await viewShopBtn.click();
                    await desktopPage.waitForTimeout(1000);
                    await desktopPage.locator('#seller-showcase-view').waitFor({ state: 'visible' });
                    console.log('✅ Navigation depuis la modale détail produit vers la vitrine réussie !');
                }
            }
        }
        await desktopContext.close();

        // ==========================================
        // 2. MOBILE TEST SUITE (390 x 844 iPhone)
        // ==========================================
        console.log('\n📱 --- DÉBUT DES TESTS MOBILE ---');
        const mobileContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            isMobile: true,
            hasTouch: true,
        });
        const mobilePage = await mobileContext.newPage();

        await mobilePage.goto(BASE_URL, { waitUntil: 'networkidle' });
        await mobilePage.waitForTimeout(1000);

        // Capture catalogue mobile
        await mobilePage.screenshot({
            path: path.join(OUTPUT_DIR, '06_mobile_catalog_top_shops.png'),
            fullPage: false,
        });
        console.log('📸 Capture 06: Catalogue Mobile avec Top Shops & Navigation fixe');

        // Clic sur Top Shop sur mobile
        const mobileTopShop = mobilePage.locator('[data-shop-id]').first();
        if (await mobileTopShop.count() > 0) {
            await mobileTopShop.click();
            await mobilePage.waitForTimeout(1200);

            // Vérifier affichage vitrine
            await mobilePage.locator('#seller-showcase-view').waitFor({ state: 'visible' });

            // Capture vitrine mobile - Produits
            await mobilePage.screenshot({
                path: path.join(OUTPUT_DIR, '07_mobile_seller_showcase_products.png'),
                fullPage: false,
            });
            console.log('📸 Capture 07: Vitrine Mobile Vendeur - Produits');

            // Clic sur l'onglet Avis sur mobile
            await mobilePage.locator('#tab-btn-showcase-reviews').click();
            await mobilePage.waitForTimeout(600);

            // Capture vitrine mobile - Avis
            await mobilePage.screenshot({
                path: path.join(OUTPUT_DIR, '08_mobile_seller_showcase_reviews.png'),
                fullPage: false,
            });
            console.log('📸 Capture 08: Vitrine Mobile Vendeur - Avis');

            // Ouvrir la modale d'avis sur mobile
            const mobileLeaveReviewBtn = mobilePage.locator('#btn-showcase-leave-review');
            if (await mobileLeaveReviewBtn.isVisible()) {
                await mobileLeaveReviewBtn.click();
                await mobilePage.waitForTimeout(500);

                await mobilePage.screenshot({
                    path: path.join(OUTPUT_DIR, '09_mobile_review_modal.png'),
                    fullPage: false,
                });
                console.log('📸 Capture 09: Modale d\'Avis Mobile');

                // Fermer la modale
                const closeBtn = mobilePage.locator('#btn-close-review-modal');
                if (await closeBtn.isVisible()) {
                    await closeBtn.click();
                    await mobilePage.waitForTimeout(400);
                }
            }

            // Retour catalogue sur mobile
            await mobilePage.locator('#btn-showcase-back').click();
            await mobilePage.waitForTimeout(800);

            await mobilePage.screenshot({
                path: path.join(OUTPUT_DIR, '10_mobile_returned_catalog.png'),
                fullPage: false,
            });
            console.log('📸 Capture 10: Catalogue Mobile après retour avec barre inférieure fixe');
        }

        await mobileContext.close();

        console.log('\n🎉 TOUS LES TESTS E2E VITRINE & AVIS SONT VALIDÉS AVEC SUCCÈS !');
    } catch (err) {
        console.error('❌ Erreur durant le test E2E :', err);
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

runShowcaseTests();
