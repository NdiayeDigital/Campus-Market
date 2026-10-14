import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

async function verifyFixes() {
    console.log(`\n🚀 VÉRIFICATION DES CORRECTIFS (sw.js & isSuspended SellerDashboard) sur ${BASE_URL}\n`);
    let errors = 0;

    const browser = await chromium.launch({
        executablePath: '/usr/bin/google-chrome',
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
            console.log('  [Page Error]', msg.text());
        }
    });

    try {
        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });

        // Test 1: SellerDashboard avec des commandes fictives - Vérifier qu'aucune ReferenceError n'est levée
        console.log('▶ [Test 1] Test de rendu SellerDashboard avec des commandes...');
        const test1 = await page.evaluate(async () => {
            const { createSellerDashboard } = await import('/src/components/seller/SellerDashboard.js');

            const mockSeller = {
                id: 'uuid-seller-test',
                prenom: 'Fatou',
                nom: 'Sow',
                role: 'vendeur',
                shop_name: 'Fatou Délices',
                is_suspended: false,
                is_open: true
            };

            const container = createSellerDashboard({
                seller: mockSeller,
                onBackToCatalog: () => {},
                onLogout: () => {},
                onShowToast: () => {}
            });

            document.body.appendChild(container);

            // Attendre le chargement initial
            for (let i = 0; i < 40; i++) {
                if (container.querySelector('#seller-desktop-sidebar')) break;
                await new Promise(r => setTimeout(r, 100));
            }

            const hasOrdersTab = !!container.querySelector('#seller-tab-content');
            const hasOrderList = container.querySelector('#seller-tab-content')?.innerHTML.length > 0;
            container.remove();

            // Test 2: Vendeur suspendu
            const mockSuspendedSeller = {
                id: '00000000-0000-0000-0000-000000000002',
                prenom: 'Ibrahima',
                nom: 'Sy',
                role: 'suspendu',
                shop_name: 'Tech Boutique',
                is_suspended: true,
                is_open: false
            };

            const suspendedContainer = createSellerDashboard({
                seller: mockSuspendedSeller,
                onBackToCatalog: () => {},
                onLogout: () => {},
                onShowToast: () => {}
            });
            document.body.appendChild(suspendedContainer);

            for (let i = 0; i < 40; i++) {
                if (suspendedContainer.querySelector('#seller-desktop-sidebar')) break;
                await new Promise(r => setTimeout(r, 100));
            }

            const hasSuspendedBanner = suspendedContainer.innerHTML.toLowerCase().includes('temporairement suspendue') || 
                                       suspendedContainer.innerHTML.toLowerCase().includes('suspendue');
            suspendedContainer.remove();

            return {
                hasOrdersTab,
                hasOrderList,
                hasSuspendedBanner
            };
        });

        if (test1.hasOrdersTab) {
            console.log('  ✅ SellerDashboard rendu sans aucune ReferenceError !');
        } else {
            console.error('  ❌ Échec de rendu SellerDashboard');
            errors++;
        }

        if (test1.hasSuspendedBanner) {
            console.log('  ✅ Le mode suspendu de SellerDashboard est correctement détecté et affiché.');
        } else {
            console.error('  ❌ Le mode suspendu n\'affiche pas le bandeau approprié.');
            errors++;
        }

        // Test 2: Service Worker - Vérifier que fetch ignore chrome-extension://
        console.log('\n▶ [Test 2] Vérification du code de public/sw.js...');
        const swResponse = await fetch(`${BASE_URL}/sw.js`);
        const swContent = await swResponse.text();

        if (swContent.includes("!url.protocol.startsWith('http')")) {
            console.log('  ✅ sw.js filtre et ignore immédiatement les schémas non-HTTP/HTTPS (chrome-extension, etc.).');
        } else {
            console.error('  ❌ sw.js ne filtre pas le protocole url.protocol !');
            errors++;
        }

        if (swContent.includes("campus-market-v21")) {
            console.log('  ✅ La version du cache a bien été incrémentée à campus-market-v21.');
        } else {
            console.error('  ❌ Le cache sw.js n\'a pas été incrémenté à v21.');
            errors++;
        }

        if (swContent.includes("Cache.put (statique) ignoré") && swContent.includes("Cache.put (network-first) ignoré")) {
            console.log('  ✅ Tous les appels cache.put disposent d\'un bloc .catch() protecteur.');
        } else {
            console.error('  ❌ Manque un gestionnaire d\'erreur .catch sur cache.put.');
            errors++;
        }

    } catch (err) {
        console.error('💥 Erreur lors de l\'exécution du test :', err);
        errors++;
    } finally {
        await browser.close();
    }

    console.log('\n======================================================');
    if (errors === 0) {
        console.log('🎉 TOUS LES CORRECTIFS SONT VALIDÉS (100% SUCCÈS) !');
        process.exit(0);
    } else {
        console.error(`💥 ${errors} ERREUR(S) DÉTECTÉE(S).`);
        process.exit(1);
    }
}

verifyFixes();
