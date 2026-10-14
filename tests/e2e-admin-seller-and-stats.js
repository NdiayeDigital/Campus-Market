import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';

async function runE2ETests() {
    console.log(`\n🚀 DÉBUT DES TESTS COMPLETS : PROFIL VENDEUR ADMIN & STATS INTERACTIVES sur ${BASE_URL}\n`);
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
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.text().includes('Admin')) {
            console.log('  [Console]', msg.text());
        }
    });

    try {
        await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });

        // =====================================================================
        // TEST 1 : ensureAdminSellerProfile()
        // =====================================================================
        console.log('▶ [Test 1] Test de ensureAdminSellerProfile()...');
        const test1Result = await page.evaluate(async () => {
            const adminService = await import('/src/services/admin-service.js');
            const adminUser = {
                id: 'uuid-admin-001',
                email: 'directeur@univ-thies.sn',
                prenom: 'Moussa',
                nom: 'Diallo',
                role: 'superadmin'
            };
            const enriched = await adminService.ensureAdminSellerProfile(adminUser);

            const buyerUser = {
                id: 'uuid-buyer-002',
                prenom: 'Fatou',
                role: 'acheteur'
            };
            const untouchedBuyer = await adminService.ensureAdminSellerProfile(buyerUser);

            return {
                enriched,
                untouchedBuyer
            };
        });

        if (test1Result.enriched.shop_name === 'Moussa UIDT Shop' &&
            test1Result.enriched.subscription_plan === 'pro' &&
            test1Result.enriched.max_products === 20 &&
            test1Result.enriched.is_open === true &&
            test1Result.untouchedBuyer.role === 'acheteur' &&
            !test1Result.untouchedBuyer.shop_name) {
            console.log('  ✅ ensureAdminSellerProfile() initialise les champs marchands des admins sans toucher aux autres rôles.');
        } else {
            console.error('  ❌ Erreur ensureAdminSellerProfile :', test1Result);
            errors++;
        }

        // =====================================================================
        // TEST 2 : SuperAdminDashboard - Boutons Vendeur & Stats Cliquables
        // =====================================================================
        console.log('\n▶ [Test 2] Test de SuperAdminDashboard (Boutons Vendeur & Cartes KPI Cliquables)...');
        const test2Result = await page.evaluate(async () => {
            const { createSuperAdminDashboard } = await import('/src/components/admin/SuperAdminDashboard.js');

            let sellerOpenedWith = null;
            const adminProfile = {
                id: 'uuid-admin-001',
                prenom: 'Moussa',
                nom: 'Diallo',
                role: 'superadmin',
                shop_name: 'Moussa UIDT Shop',
                subscription_plan: 'pro',
                max_products: 20,
                is_open: true
            };

            const container = createSuperAdminDashboard({
                admin: adminProfile,
                onExit: () => {},
                onBackToCatalog: () => {},
                onOpenSellerDashboard: (profile) => {
                    sellerOpenedWith = profile;
                },
                onShowToast: () => {}
            });

            document.body.appendChild(container);

            // Attendre la fin du chargement asynchrone des données
            let waited = 0;
            for (let i = 0; i < 80; i++) {
                if (container.querySelector('#admin-desktop-sidebar')) break;
                await new Promise(r => setTimeout(r, 100));
                waited += 100;
            }

            const currentHTML = container.innerHTML;

            // Vérifier les 4 boutons "Mon Profil Vendeur"
            const sidebarBtn = container.querySelector('#sidebar-btn-switch-to-seller');
            const topHdrBtn = container.querySelector('#top-hdr-btn-switch-to-seller');
            const mobileHdrBtn = container.querySelector('#top-hdr-btn-switch-to-seller-mobile');
            const drawerBtn = container.querySelector('#drawer-btn-switch-to-seller');

            // Vérifier les cartes KPI [data-stat-target]
            const statSellersActive = container.querySelector('[data-stat-target="sellers-active"]');
            const statSellersPending = container.querySelector('[data-stat-target="sellers-pending"]');
            const statOrdersAll = container.querySelector('[data-stat-target="orders-all"]');
            const statOrdersDelivered = container.querySelector('[data-stat-target="orders-delivered"]');

            // Tester le clic sur le bouton Profil Vendeur
            sidebarBtn?.click();
            await new Promise(r => setTimeout(r, 150));

            // Tester le clic sur "Demandes d'adhésion" (data-stat-target="sellers-pending")
            statSellersPending?.click();
            await new Promise(r => setTimeout(r, 100));
            const hasSellerSearchAfterPending = !!container.querySelector('#admin-seller-search');

            // Revenir à l'onglet Vue d'ensemble pour tester le clic sur "Total Commandes"
            container.querySelector('[data-tab-target="overview"]')?.click();
            await new Promise(r => setTimeout(r, 100));

            const statOrdersAllAfterOverview = container.querySelector('[data-stat-target="orders-all"]');
            statOrdersAllAfterOverview?.click();
            await new Promise(r => setTimeout(r, 100));
            const hasOrderSearchAfterOrders = !!container.querySelector('#admin-order-search');

            container.remove();

            return {
                waited,
                htmlPreview: currentHTML.slice(0, 300),
                hasSidebarBtn: !!sidebarBtn,
                hasTopHdrBtn: !!topHdrBtn,
                hasMobileHdrBtn: !!mobileHdrBtn,
                hasDrawerBtn: !!drawerBtn,
                hasStatSellersActive: !!statSellersActive,
                hasStatSellersPending: !!statSellersPending,
                hasStatOrdersAll: !!statOrdersAll,
                hasStatOrdersDelivered: !!statOrdersDelivered,
                sellerOpened: !!sellerOpenedWith,
                hasSellerSearchAfterPending,
                hasOrderSearchAfterOrders,
            };
        });

        if (test2Result.hasSidebarBtn && test2Result.hasTopHdrBtn && test2Result.hasMobileHdrBtn && test2Result.hasDrawerBtn) {
            console.log('  ✅ Les 4 boutons "Mon Profil Vendeur" sont présents dans SuperAdminDashboard (Sidebar, Header, Mobile, Drawer).');
        } else {
            console.error('  ❌ Boutons "Mon Profil Vendeur" manquants dans SuperAdminDashboard:', test2Result);
            errors++;
        }

        if (test2Result.sellerOpened) {
            console.log('  ✅ Le clic sur "Mon Profil Vendeur" a bien appelé onOpenSellerDashboard avec le profil enrichi.');
        } else {
            console.error('  ❌ Callback onOpenSellerDashboard non déclenché.');
            errors++;
        }

        if (test2Result.hasStatSellersActive && test2Result.hasStatSellersPending && test2Result.hasStatOrdersAll && test2Result.hasStatOrdersDelivered) {
            console.log('  ✅ Toutes les cartes KPI possèdent [data-stat-target] avec style interactif.');
        } else {
            console.error('  ❌ Cartes KPI data-stat-target manquantes:', test2Result);
            errors++;
        }

        if (test2Result.hasSellerSearchAfterPending) {
            console.log('  ✅ Le clic sur "Demandes d\'adhésion" bascule bien sur le panneau Marchands avec filtre.');
        } else {
            console.error('  ❌ Le clic sur "Demandes d\'adhésion" n\'a pas basculé l\'onglet.');
            errors++;
        }

        if (test2Result.hasOrderSearchAfterOrders) {
            console.log('  ✅ Le clic sur "Total Commandes" bascule bien sur le panneau Commandes.');
        } else {
            console.error('  ❌ Le clic sur "Total Commandes" n\'a pas basculé l\'onglet.');
            errors++;
        }

        // =====================================================================
        // TEST 3 : SellerDashboard - Boutons SuperAdmin & Bento KPI
        // =====================================================================
        console.log('\n▶ [Test 3] Test de SellerDashboard (Bouton SuperAdmin & Bento KPI cliquables)...');
        const test3Result = await page.evaluate(async () => {
            const { createSellerDashboard } = await import('/src/components/seller/SellerDashboard.js');

            let adminReturned = false;

            // 1. Profil Admin connecté dans l'espace vendeur
            const adminSeller = {
                id: 'uuid-admin-001',
                prenom: 'Moussa',
                nom: 'Diallo',
                role: 'superadmin',
                shop_name: 'Moussa UIDT Shop'
            };

            const containerAdmin = createSellerDashboard({
                seller: adminSeller,
                onBackToCatalog: () => {},
                onOpenAdminDashboard: () => {
                    adminReturned = true;
                },
                onLogout: () => {},
                onShowToast: () => {}
            });
            document.body.appendChild(containerAdmin);

            // Attendre la fin du chargement asynchrone des données vendeur
            for (let i = 0; i < 40; i++) {
                if (containerAdmin.querySelector('#seller-desktop-sidebar')) break;
                await new Promise(r => setTimeout(r, 100));
            }

            const sidebarAdminBtn = containerAdmin.querySelector('#sidebar-btn-seller-back-admin');
            const topHdrAdminBtn = containerAdmin.querySelector('#top-hdr-btn-seller-back-admin');
            const drawerAdminBtn = containerAdmin.querySelector('#drawer-btn-seller-back-admin');

            // Test des 4 Bento KPI
            const kpiDelivered = containerAdmin.querySelector('[data-seller-kpi="orders-delivered"]');
            const kpiPending = containerAdmin.querySelector('[data-seller-kpi="orders-pending"]');
            const kpiProducts = containerAdmin.querySelector('[data-seller-kpi="products"]');
            const kpiToggle = containerAdmin.querySelector('[data-seller-kpi="toggle-shop"]');

            // Clic sur le bouton de retour SuperAdmin
            sidebarAdminBtn?.click();

            // Clic sur le Bento KPI Articles
            kpiProducts?.click();
            await new Promise(r => setTimeout(r, 100));
            const tabAfterProductsKpi = containerAdmin.querySelector('#seller-tab-content')?.innerHTML.slice(0, 300) || '';

            containerAdmin.remove();

            // 2. Profil Vendeur normal (Awa Ndiaye)
            const normalSeller = {
                id: 'uuid-seller-002',
                prenom: 'Awa',
                nom: 'Ndiaye',
                role: 'vendeur',
                shop_name: 'Awa Cosmétiques'
            };

            const containerNormal = createSellerDashboard({
                seller: normalSeller,
                onBackToCatalog: () => {},
                onLogout: () => {},
                onShowToast: () => {}
            });
            document.body.appendChild(containerNormal);

            for (let i = 0; i < 40; i++) {
                if (containerNormal.querySelector('#seller-desktop-sidebar')) break;
                await new Promise(r => setTimeout(r, 100));
            }

            const normalHasAdminSidebar = !!containerNormal.querySelector('#sidebar-btn-seller-back-admin');
            const normalHasAdminHeader = !!containerNormal.querySelector('#top-hdr-btn-seller-back-admin');

            containerNormal.remove();

            return {
                hasSidebarAdminBtn: !!sidebarAdminBtn,
                hasTopHdrAdminBtn: !!topHdrAdminBtn,
                hasDrawerAdminBtn: !!drawerAdminBtn,
                hasKpiDelivered: !!kpiDelivered,
                hasKpiPending: !!kpiPending,
                hasKpiProducts: !!kpiProducts,
                hasKpiToggle: !!kpiToggle,
                adminReturned,
                tabAfterProductsKpi,
                normalHasAdminSidebar,
                normalHasAdminHeader
            };
        });

        if (test3Result.hasSidebarAdminBtn && test3Result.hasTopHdrAdminBtn && test3Result.hasDrawerAdminBtn) {
            console.log('  ✅ Boutons "Supervision SuperAdmin" présents dans la Sidebar, Header et Drawer pour un compte admin.');
        } else {
            console.error('  ❌ Boutons "Supervision SuperAdmin" manquants :', test3Result);
            errors++;
        }

        if (test3Result.adminReturned) {
            console.log('  ✅ Le clic sur "Supervision SuperAdmin" déclenche bien le retour vers l\'administration centrale.');
        } else {
            console.error('  ❌ Le callback onOpenAdminDashboard n\'a pas été appelé.');
            errors++;
        }

        if (!test3Result.normalHasAdminSidebar && !test3Result.normalHasAdminHeader) {
            console.log('  ✅ Sécurité vérifiée : Un marchand ordinaire ne voit pas les boutons SuperAdmin.');
        } else {
            console.error('  ❌ Fuite de privilège : Un vendeur normal voit les boutons SuperAdmin !');
            errors++;
        }

        if (test3Result.hasKpiDelivered && test3Result.hasKpiPending && test3Result.hasKpiProducts && test3Result.hasKpiToggle) {
            console.log('  ✅ Les 4 cartes Bento KPI SellerDashboard sont bien interactives avec [data-seller-kpi].');
        } else {
            console.error('  ❌ Bento KPI data-seller-kpi manquants :', test3Result);
            errors++;
        }

    } catch (err) {
        console.error('💥 Erreur test E2E :', err);
        errors++;
    } finally {
        await browser.close();
    }

    console.log('\n======================================================');
    if (errors === 0) {
        console.log('🎉 TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS (100% SUCCÈS) !');
        process.exit(0);
    } else {
        console.error(`💥 ${errors} ERREUR(S) DÉTECTÉE(S).`);
        process.exit(1);
    }
}

runE2ETests();
