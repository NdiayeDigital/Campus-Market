import { ensureAdminSellerProfile, isSellerSuspended } from '../src/services/admin-service.js';
import { createSuperAdminDashboard } from '../src/components/admin/SuperAdminDashboard.js';
import { createSellerDashboard } from '../src/components/seller/SellerDashboard.js';

// Setup minimal DOM mocks if running directly under Node without browser window
if (typeof document === 'undefined') {
    const { JSDOM } = await import('jsdom').catch(() => ({ JSDOM: null }));
    if (!JSDOM) {
        console.warn('JSDOM not available, skipping full DOM mount test in raw Node');
    }
}

async function runTests() {
    console.log('🧪 DÉBUT DU TEST : PROFIL VENDEUR ADMIN & STATISTIQUES INTERACTIVES\n');
    let errors = 0;

    // =========================================================================
    // TEST 1 : ensureAdminSellerProfile
    // =========================================================================
    console.log('▶ [Test 1] Fonction ensureAdminSellerProfile()...');
    const dummyAdmin = {
        id: 'admin-uuid-1234',
        email: 'admin.uidt@univ-thies.sn',
        prenom: 'Moussa',
        nom: 'Diallo',
        role: 'superadmin'
    };

    const enriched = await ensureAdminSellerProfile(dummyAdmin);
    if (enriched.shop_name === 'Moussa UIDT Shop' &&
        enriched.subscription_plan === 'pro' &&
        enriched.max_products === 20 &&
        enriched.is_open === true &&
        enriched.shop_category === 'autres') {
        console.log('  ✅ Profil SuperAdmin correctement enrichi avec les attributs marchands :');
        console.log(`     - Boutique: "${enriched.shop_name}"`);
        console.log(`     - Plan: ${enriched.subscription_plan}`);
        console.log(`     - Max articles: ${enriched.max_products}`);
        console.log(`     - Statut ouvert: ${enriched.is_open}`);
    } else {
        console.error('  ❌ Attributs marchands incorrects:', enriched);
        errors++;
    }

    // Profil non-admin ne doit pas être altéré
    const studentUser = { id: 'stud-1', role: 'acheteur', prenom: 'Fatou' };
    const untouched = await ensureAdminSellerProfile(studentUser);
    if (untouched.role === 'acheteur' && !untouched.subscription_plan) {
        console.log('  ✅ Les profils non-superadmin restent inchangés.');
    } else {
        console.error('  ❌ Altération inattendue d\'un non-admin:', untouched);
        errors++;
    }

    // =========================================================================
    // TEST 2 : Structure DOM SuperAdminDashboard (Boutons Vendeur & Stats Cliquables)
    // =========================================================================
    console.log('\n▶ [Test 2] Vérification des boutons et stats cliquables dans SuperAdminDashboard...');
    try {
        let sellerDashboardOpened = false;
        let passedAdminProfile = null;

        const adminComp = createSuperAdminDashboard({
            onExit: () => {},
            onBackToCatalog: () => {},
            onOpenSellerDashboard: (profile) => {
                sellerDashboardOpened = true;
                passedAdminProfile = profile;
            },
            onShowToast: () => {},
        });

        // Simuler auth admin existant sur le composant
        // Injecter le template d'overview pour tester le DOM
        const html = adminComp.innerHTML;

        // Vérifier les 4 boutons "Mon Profil Vendeur"
        const hasSidebarBtn = html.includes('id="sidebar-btn-switch-to-seller"');
        const hasTopHdrBtn = html.includes('id="top-hdr-btn-switch-to-seller"');
        const hasMobileHdrBtn = html.includes('id="top-hdr-btn-switch-to-seller-mobile"');
        const hasDrawerBtn = html.includes('id="drawer-btn-switch-to-seller"');

        if (hasSidebarBtn && hasTopHdrBtn && hasMobileHdrBtn && hasDrawerBtn) {
            console.log('  ✅ Les 4 points d\'accès "Mon Profil Vendeur" sont présents dans SuperAdminDashboard :');
            console.log('     - Sidebar Desktop (#sidebar-btn-switch-to-seller)');
            console.log('     - Top Header Desktop (#top-hdr-btn-switch-to-seller)');
            console.log('     - Mobile Header (#top-hdr-btn-switch-to-seller-mobile)');
            console.log('     - Mobile Drawer (#drawer-btn-switch-to-seller)');
        } else {
            console.error('  ❌ Boutons Profil Vendeur manquants dans SuperAdminDashboard:', {
                hasSidebarBtn, hasTopHdrBtn, hasMobileHdrBtn, hasDrawerBtn
            });
            errors++;
        }

        // Vérifier les cartes cliquables avec data-stat-target
        const hasSellersActiveStat = html.includes('data-stat-target="sellers-active"');
        const hasSellersPendingStat = html.includes('data-stat-target="sellers-pending"');
        const hasOrdersAllStat = html.includes('data-stat-target="orders-all"');
        const hasOrdersDeliveredStat = html.includes('data-stat-target="orders-delivered"');

        if (hasSellersActiveStat && hasSellersPendingStat && hasOrdersAllStat && hasOrdersDeliveredStat) {
            console.log('  ✅ Toutes les cartes KPI SuperAdmin possèdent l\'attribut data-stat-target :');
            console.log('     - Marchands certifiés -> sellers-active');
            console.log('     - Demandes d\'adhésion -> sellers-pending');
            console.log('     - Total Commandes -> orders-all');
            console.log('     - Volume d\'affaires / GMV -> orders-delivered');
        } else {
            console.error('  ❌ Attributs data-stat-target manquants dans SuperAdminDashboard:', {
                hasSellersActiveStat, hasSellersPendingStat, hasOrdersAllStat, hasOrdersDeliveredStat
            });
            errors++;
        }
    } catch (err) {
        console.error('  ❌ Erreur test SuperAdminDashboard:', err.message);
        errors++;
    }

    // =========================================================================
    // TEST 3 : Structure DOM SellerDashboard (Boutons SuperAdmin & Bento KPI Cliquables)
    // =========================================================================
    console.log('\n▶ [Test 3] Vérification des boutons SuperAdmin et Bento KPI dans SellerDashboard...');
    try {
        let adminDashboardOpened = false;

        // Cas A : Vendeur SuperAdmin
        const adminSeller = {
            id: 'admin-uuid-1234',
            prenom: 'Moussa',
            nom: 'Diallo',
            role: 'superadmin',
            shop_name: 'Moussa UIDT Shop'
        };

        const sellerCompAdmin = createSellerDashboard({
            seller: adminSeller,
            onBackToCatalog: () => {},
            onOpenAdminDashboard: () => {
                adminDashboardOpened = true;
            },
            onLogout: () => {},
            onShowToast: () => {},
        });

        const htmlAdmin = sellerCompAdmin.innerHTML;

        const hasSidebarBackAdmin = htmlAdmin.includes('id="sidebar-btn-seller-back-admin"');
        const hasTopHdrBackAdmin = htmlAdmin.includes('id="top-hdr-btn-seller-back-admin"');
        const hasDrawerBackAdmin = htmlAdmin.includes('id="drawer-btn-seller-back-admin"');

        if (hasSidebarBackAdmin && hasTopHdrBackAdmin && hasDrawerBackAdmin) {
            console.log('  ✅ Boutons "Supervision SuperAdmin" présents pour un compte admin :');
            console.log('     - Sidebar Desktop (#sidebar-btn-seller-back-admin)');
            console.log('     - Top Header Desktop (#top-hdr-btn-seller-back-admin)');
            console.log('     - Mobile Drawer (#drawer-btn-seller-back-admin)');
        } else {
            console.error('  ❌ Boutons de retour SuperAdmin manquants:', {
                hasSidebarBackAdmin, hasTopHdrBackAdmin, hasDrawerBackAdmin
            });
            errors++;
        }

        // Cas B : Vendeur Étudiant ordinaire (NE DOIT PAS avoir accès aux boutons SuperAdmin)
        const regularSeller = {
            id: 'student-seller-99',
            prenom: 'Awa',
            nom: 'Ndiaye',
            role: 'vendeur',
            shop_name: 'Awa Délices'
        };

        const sellerCompRegular = createSellerDashboard({
            seller: regularSeller,
            onBackToCatalog: () => {},
            onLogout: () => {},
            onShowToast: () => {},
        });

        const htmlRegular = sellerCompRegular.innerHTML;
        const regularHasAdminBtn = htmlRegular.includes('id="sidebar-btn-seller-back-admin"') ||
                                   htmlRegular.includes('id="top-hdr-btn-seller-back-admin"');

        if (!regularHasAdminBtn) {
            console.log('  ✅ Sécurité vérifiée : Un vendeur standard n\'a PAS les boutons d\'administration SuperAdmin.');
        } else {
            console.error('  ❌ FAIL : Un vendeur standard a des boutons d\'administration !');
            errors++;
        }

        // Vérifier les 4 cartes Bento KPI cliquables
        const hasRevenueKpi = htmlAdmin.includes('data-seller-kpi="orders-delivered"');
        const hasPendingKpi = htmlAdmin.includes('data-seller-kpi="orders-pending"');
        const hasProductsKpi = htmlAdmin.includes('data-seller-kpi="products"');
        const hasToggleShopKpi = htmlAdmin.includes('data-seller-kpi="toggle-shop"');

        if (hasRevenueKpi && hasPendingKpi && hasProductsKpi && hasToggleShopKpi) {
            console.log('  ✅ Toutes les cartes Bento KPI SellerDashboard sont cliquables avec data-seller-kpi :');
            console.log('     - Revenus réalisés -> orders-delivered');
            console.log('     - Commandes actives -> orders-pending');
            console.log('     - Articles en ligne -> products');
            console.log('     - Statut boutique -> toggle-shop');
        } else {
            console.error('  ❌ Cartes Bento KPI cliquables manquantes:', {
                hasRevenueKpi, hasPendingKpi, hasProductsKpi, hasToggleShopKpi
            });
            errors++;
        }
    } catch (err) {
        console.error('  ❌ Erreur test SellerDashboard:', err.message);
        errors++;
    }

    console.log('\n======================================================');
    if (errors === 0) {
        console.log('🎉 TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS (100% OK) !');
        process.exit(0);
    } else {
        console.error(`💥 ${errors} ERREUR(S) DÉTECTÉE(S).`);
        process.exit(1);
    }
}

runTests();
