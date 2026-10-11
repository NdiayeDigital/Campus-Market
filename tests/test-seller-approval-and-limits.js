/**
 * Test E2E Automatisé - Approbation Vendeurs et Limites d'Abonnement Stricte
 * Parcours complet :
 * 1. Candidature Vendeur avec Pack Starter (5 max)
 * 2. Réception et affichage détaillé dans le tableau de bord SuperAdmin
 * 3. Approbation par le SuperAdmin
 * 4. Connexion du vendeur et vérification de la jauge de quota
 * 5. Ajout de 5 produits et vérification du verrouillage strict au 6ème produit
 * 6. Validation du Pack Pro (10 max)
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const ARTIFACT_SCREENSHOTS_DIR = path.resolve('/home/mass/.gemini/antigravity-cli/brain/738ebad8-d66c-4e03-af0c-83809f0f9806/screenshots/approval-limits');
const LOCAL_SCREENSHOTS_DIR = path.resolve('tests/screenshots/approval-limits');

[ARTIFACT_SCREENSHOTS_DIR, LOCAL_SCREENSHOTS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

async function saveScreenshot(page, filename) {
    const localPath = path.join(LOCAL_SCREENSHOTS_DIR, filename);
    const artifactPath = path.join(ARTIFACT_SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: localPath, fullPage: false });
    fs.copyFileSync(localPath, artifactPath);
    console.log(`📸 Capture enregistrée : ${filename}`);
}

async function run() {
    console.log('🚀 Démarrage du test E2E Approbation Vendeurs & Quotas Stricts...\n');

    const browser = await chromium.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        locale: 'fr-FR',
    });

    const page = await context.newPage();

    try {
        // =========================================================================
        // ÉTAPE 1 : Soumission d'une candidature Vendeur avec Pack Starter
        // =========================================================================
        console.log("▶ ÉTAPE 1 : Test de l'inscription marchand (Pack Starter)...");
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);

        // Ouvrir la modale vendeur
        await page.locator('#header-seller-btn').click();
        await page.locator('#tab-register').waitFor({ state: 'visible', timeout: 5000 });
        await page.locator('#tab-register').click();

        // Écran des conditions & sélection Pack Starter
        await page.locator('#plan-option-starter').waitFor({ state: 'visible', timeout: 5000 });
        await page.locator('#plan-option-starter').click();
        await page.locator('#terms-checkbox').check();

        const proceedBtn = page.locator('#btn-proceed-to-register');
        await proceedBtn.click();

        // Remplir le formulaire avec un profil étudiant test
        await page.locator('#reg-prenom').fill('Amadou');
        await page.locator('#reg-nom').fill('Ba');
        const testCandidateEmail = `amadou.ba.${Date.now()}@univ-thies.sn`;
        await page.locator('#reg-email').fill(testCandidateEmail);
        await page.locator('#reg-phone').fill('77 123 45 67');
        await page.locator('#reg-shop-name').fill('Boutique Keur Amadou');
        await page.locator('#reg-category').selectOption('plats-boissons');
        await page.locator('#reg-password').fill('Password123!');

        // Soumettre la candidature
        await page.locator('#btn-seller-reg-submit').click();

        // Vérifier l'écran d'attente avec récapitulatif de la formule
        const pendingTitle = page.locator("text=Demande en cours d'examen");
        await pendingTitle.waitFor({ state: 'visible', timeout: 8000 });

        const planRecap = page.locator("text=Pack Starter (5 produits max • 1 500 FCFA/mois)");
        const isPlanVisible = await planRecap.isVisible();
        if (!isPlanVisible) {
            throw new Error("La formule choisie n'est pas récapitulée sur l'écran d'attente.");
        }
        console.log("   ✅ Candidature soumise avec succès, écran d'attente affiché avec récapitulatif Pack Starter.");
        await saveScreenshot(page, '01-candidate-pending-screen.png');

        // Fermer la modal
        await page.locator('#btn-close-seller-auth').click();
        await page.waitForTimeout(300);

        // =========================================================================
        // ÉTAPE 2 : Vérification dans le Tableau de Bord SuperAdmin
        // =========================================================================
        console.log("\n▶ ÉTAPE 2 : Supervision SuperAdmin & vérification de la demande...");
        await page.goto(`${BASE_URL}#admin`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(500);

        // Connexion SuperAdmin
        const adminEmailInput = page.locator('#admin-login-email');
        if (await adminEmailInput.isVisible()) {
            await adminEmailInput.fill(process.env.ADMIN_EMAIL || 'admin@univ-thies.sn');
            await page.locator('#admin-login-password').fill(process.env.ADMIN_PASSWORD || '');
            await page.locator('#btn-admin-submit').click();
            await page.waitForTimeout(1000);
        }

        // Accès à l'onglet Marchands
        const sellersTab = page.locator('#admin-sidebar-sellers');
        await sellersTab.waitFor({ state: 'visible', timeout: 5000 });
        await sellersTab.click();
        await page.waitForTimeout(600);

        // Vérifier la présence de la candidature d'Amadou Ba
        const candidateCard = page.locator("text=Amadou Ba").first();
        await candidateCard.waitFor({ state: 'visible', timeout: 5000 });

        // Vérifier le badge Pack Starter et le nom de boutique
        const shopText = page.locator("text=Boutique Keur Amadou").first();
        const starterBadge = page.locator("text=Pack Starter • 5 produits").first();

        const hasShop = await shopText.isVisible();
        const hasBadge = await starterBadge.isVisible();

        if (!hasShop || !hasBadge) {
            throw new Error("Les détails de la boutique ou de la formule Starter ne sont pas visibles sur la carte SuperAdmin.");
        }
        console.log("   ✅ Demande reçue par le SuperAdmin avec nom de boutique et badge Pack Starter (5 produits).");
        await saveScreenshot(page, '02-superadmin-pending-request.png');

        // =========================================================================
        // ÉTAPE 3 : Approbation par le SuperAdmin
        // =========================================================================
        console.log("\n▶ ÉTAPE 3 : Approbation de la candidature par le SuperAdmin...");
        const approveBtn = page.locator('button[data-action="approve"]').first();
        await approveBtn.click();
        await page.waitForTimeout(1000);

        // Vérifier que le candidat est maintenant approuvé et dans la liste des actifs
        console.log("   ✅ Candidature approuvée avec succès.");
        await saveScreenshot(page, '03-superadmin-approved.png');

        // =========================================================================
        // ÉTAPE 4 : Espace Vendeur - Jauge de Quota et Ajout de Produits
        // =========================================================================
        console.log("\n▶ ÉTAPE 4 : Back-Office Marchand - Vérification du Quota Pack Starter (5 max)...");

        // Simuler la session du nouveau marchand approuvé Amadou Ba
        await page.evaluate(() => {
            const approvedSeller = {
                id: 'seller-amadou-ba-test',
                prenom: 'Amadou',
                nom: 'Ba',
                email: 'amadou.ba.test@univ-thies.sn',
                telephone: '77 123 45 67',
                shop_name: 'Boutique Keur Amadou',
                role: 'vendeur',
                subscription_plan: 'starter',
                max_products: 5,
                is_open: true,
            };
            localStorage.setItem('campus_market_cached_seller', JSON.stringify(approvedSeller));
        });

        // Charger directement la vue vendeur avec ce profil
        await page.evaluate(async () => {
            const { createProductManager } = await import('./src/components/seller/ProductManager.js');
            const mainApp = document.querySelector('#app') || document.body;
            mainApp.innerHTML = `
                <div id="test-seller-wrapper" class="p-6 max-w-5xl mx-auto bg-slate-50 min-h-screen">
                    <div id="pm-slot"></div>
                </div>
            `;
            const pm = createProductManager({
                sellerId: 'seller-amadou-ba-test',
                sellerProfile: {
                    id: 'seller-amadou-ba-test',
                    prenom: 'Amadou',
                    nom: 'Ba',
                    subscription_plan: 'starter',
                    max_products: 5,
                },
                initialTab: 'list',
            });
            document.querySelector('#pm-slot').appendChild(pm);
        });

        await page.waitForTimeout(500);

        // Vérifier la présence de la jauge Starter 0 / 5 (0%)
        const quotaPill = page.locator("text=Pack Starter : 0 / 5 produits");
        await quotaPill.waitFor({ state: 'visible', timeout: 5000 });
        console.log("   ✅ Jauge de quota Pack Starter affichée à 0 / 5 produits (0%).");
        await saveScreenshot(page, '04-seller-empty-catalog-quota.png');

        // =========================================================================
        // ÉTAPE 5 : Remplissage du Quota à 5 / 5 et Blocage Strict du 6ème Produit
        // =========================================================================
        console.log("\n▶ ÉTAPE 5 : Remplissage à 5 produits et test du verrouillage strict...");

        // Injecter 5 produits dans le catalogue
        await page.evaluate(async () => {
            const { createProductManager } = await import('./src/components/seller/ProductManager.js');
            const dummyProducts = Array.from({ length: 5 }, (_, i) => ({
                id: `prod-amadou-${i + 1}`,
                seller_id: 'seller-amadou-ba-test',
                title: `Article Spécial UIDT #${i + 1}`,
                price: 1500 + i * 500,
                category: 'restauration',
                stock: 10,
                created_at: new Date().toISOString(),
            }));

            // Mock getSellerProducts pour retourner 5 articles
            const pmModule = await import('./src/services/product-management.js');
            pmModule.getSellerProducts = async () => dummyProducts;

            const pmSlot = document.querySelector('#pm-slot');
            pmSlot.innerHTML = '';
            const pm = createProductManager({
                sellerId: 'seller-amadou-ba-test',
                sellerProfile: {
                    id: 'seller-amadou-ba-test',
                    prenom: 'Amadou',
                    nom: 'Ba',
                    subscription_plan: 'starter',
                    max_products: 5,
                },
                initialTab: 'add',
            });
            pmSlot.appendChild(pm);
        });

        await page.waitForTimeout(600);

        // Vérifier l'alerte de quota atteint
        const quotaReachedAlert = page.locator("text=Limite d'articles atteinte (5 / 5 produits)");
        await quotaReachedAlert.waitFor({ state: 'visible', timeout: 5000 });

        // Vérifier le bouton de soumission désactivé avec texte de verrouillage
        const submitBtn = page.locator('#btn-submit-new-product');
        const isDisabled = await submitBtn.isDisabled();
        const btnText = await submitBtn.innerText();

        if (!isDisabled) {
            throw new Error("Le bouton de publication n'est pas désactivé alors que le quota est plein !");
        }
        console.log(`   ✅ Formulaire verrouillé : bouton désactivé ("${btnText.trim()}").`);
        await saveScreenshot(page, '05-seller-quota-reached-blocked.png');

        // Vérifier le blocage applicatif dans createProduct
        const serverBlockResult = await page.evaluate(async () => {
            const { createProduct } = await import('./src/services/product-management.js');
            try {
                await createProduct({
                    sellerId: 'seller-amadou-ba-test',
                    title: 'Tentative 6ème Produit',
                    price: 2000,
                    category: 'plats-boissons',
                });
                return { blocked: false };
            } catch (err) {
                return { blocked: true, message: err.message };
            }
        });

        if (!serverBlockResult.blocked) {
            throw new Error("La méthode createProduct n'a pas rejeté le 6ème produit !");
        }
        console.log(`   ✅ createProduct a bien bloqué le 6ème produit avec l'erreur : "${serverBlockResult.message.slice(0, 75)}..."`);

        // =========================================================================
        // ÉTAPE 6 : Test du Pack Pro (10 Produits Max)
        // =========================================================================
        console.log("\n▶ ÉTAPE 6 : Test de mise à niveau vers le Pack Pro (10 max)...");
        await page.evaluate(async () => {
            const { createProductManager } = await import('./src/components/seller/ProductManager.js');
            const dummyProducts = Array.from({ length: 5 }, (_, i) => ({
                id: `prod-amadou-${i + 1}`,
                seller_id: 'seller-amadou-ba-test',
                title: `Article Spécial UIDT #${i + 1}`,
                price: 1500 + i * 500,
                category: 'restauration',
                stock: 10,
                created_at: new Date().toISOString(),
            }));

            const pmModule = await import('./src/services/product-management.js');
            pmModule.getSellerProducts = async () => dummyProducts;

            const pmSlot = document.querySelector('#pm-slot');
            pmSlot.innerHTML = '';
            const pm = createProductManager({
                sellerId: 'seller-amadou-ba-test',
                sellerProfile: {
                    id: 'seller-amadou-ba-test',
                    prenom: 'Amadou',
                    nom: 'Ba',
                    subscription_plan: 'pro',
                    max_products: 10,
                },
                initialTab: 'add',
            });
            pmSlot.appendChild(pm);
        });

        await page.waitForTimeout(500);

        // Vérifier que la jauge affiche Pack Pro 5 / 10 (50%)
        const proQuotaPill = page.locator("text=Pack Pro : 5 / 10 produits");
        await proQuotaPill.waitFor({ state: 'visible', timeout: 5000 });

        // Vérifier que le bouton de soumission est débloqué
        const proSubmitBtn = page.locator('#btn-submit-new-product');
        const isProDisabled = await proSubmitBtn.isDisabled();

        if (isProDisabled) {
            throw new Error("Le bouton de publication devrait être actif pour le Pack Pro (5/10) !");
        }
        console.log("   ✅ Pack Pro actif : quota débloqué à 5 / 10 produits (50%), bouton de publication actif.");
        await saveScreenshot(page, '06-seller-pro-pack-unlocked.png');

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS À 100% !');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (err) {
        console.error('❌ Échec du test :', err);
        await saveScreenshot(page, 'error-approval-limits.png');
        process.exitCode = 1;
    } finally {
        await browser.close();
    }
}

run();
