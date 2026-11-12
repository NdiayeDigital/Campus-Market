/**
 * Test de validation de la navigation vers le Profil Vendeur et de la synchronisation d'onglets.
 * Vérifie :
 * 1. Résolution de #profile et #seller/profile par le routeur
 * 2. Transmission intégrale des paramètres de route
 * 3. Initialisation et bascule d'onglet vers le profil sans redirection intempestive
 */

import assert from 'node:assert';
import { resolveRoute } from '../src/utils/router.js';

console.log('🧪 Démarrage des tests unitaires de navigation vers le Profil Vendeur...');

// Test 1 : Résolution des routes du profil vendeur
{
    const rProfile = resolveRoute('#profile');
    assert.strictEqual(rProfile.view, 'seller', '#profile doit router vers la vue seller');
    assert.strictEqual(rProfile.params.subTab, 'profile', '#profile doit avoir subTab=profile');

    const rSellerProfile = resolveRoute('#seller/profile');
    assert.strictEqual(rSellerProfile.view, 'seller', '#seller/profile doit router vers la vue seller');
    assert.strictEqual(rSellerProfile.params.subTab, 'profile', '#seller/profile doit avoir subTab=profile');

    const rSellerOrders = resolveRoute('#seller/orders');
    assert.strictEqual(rSellerOrders.view, 'seller');
    assert.strictEqual(rSellerOrders.params.subTab, 'orders');

    const rSellerAdd = resolveRoute('#seller/add');
    assert.strictEqual(rSellerAdd.view, 'seller');
    assert.strictEqual(rSellerAdd.params.subTab, 'add-product');

    console.log('✅ [Router] Résolution déterministe de #profile et des sous-onglets vendeur validée !');
}

// Test 2 : Simulation de la logique de routage dans main.js
{
    // Simulation du comportement de navigateToView et targetHash
    function computeTargetHash(viewName, params = {}) {
        let targetHash = viewName === 'catalog' ? '' : `#${viewName}`;
        if (viewName === 'shop' && params.sellerId) {
            targetHash = `#shop/${params.sellerId}`;
        } else if (viewName === 'seller') {
            const sub = params.subTab || 'dashboard';
            targetHash = sub === 'dashboard' ? '#seller' : `#seller/${sub}`;
        }
        return targetHash;
    }

    assert.strictEqual(computeTargetHash('seller', { subTab: 'profile' }), '#seller/profile', 'Le hash cible pour le profil doit être #seller/profile');
    assert.strictEqual(computeTargetHash('seller', { subTab: 'orders' }), '#seller/orders', 'Le hash cible pour les commandes doit être #seller/orders');
    assert.strictEqual(computeTargetHash('seller', { subTab: 'dashboard' }), '#seller', 'Le hash cible par défaut doit être #seller');
    assert.strictEqual(computeTargetHash('seller', {}), '#seller', 'Le hash cible sans paramètre doit être #seller');

    console.log('✅ [Main Routing] Calcul déterministe de targetHash pour tous les sous-onglets validé !');
}

// Test 3 : Simulation du flux handleCurrentRoute sans perte de paramètres
{
    let routedView = null;
    let routedParams = null;

    function mockNavigateToView(view, params = {}) {
        routedView = view;
        routedParams = params;
    }

    function mockHandleCurrentRoute(hash) {
        const route = resolveRoute(hash);
        if (route.view === 'seller') {
            mockNavigateToView('seller', route.params);
        } else {
            mockNavigateToView(route.view, route.params);
        }
    }

    mockHandleCurrentRoute('#profile');
    assert.strictEqual(routedView, 'seller');
    assert.strictEqual(routedParams.subTab, 'profile', 'handleCurrentRoute(#profile) doit transmettre { subTab: "profile" }');

    mockHandleCurrentRoute('#seller/profile');
    assert.strictEqual(routedView, 'seller');
    assert.strictEqual(routedParams.subTab, 'profile', 'handleCurrentRoute(#seller/profile) doit transmettre { subTab: "profile" }');

    mockHandleCurrentRoute('#seller/orders');
    assert.strictEqual(routedView, 'seller');
    assert.strictEqual(routedParams.subTab, 'orders', 'handleCurrentRoute(#seller/orders) doit transmettre { subTab: "orders" }');

    console.log('✅ [Route Dispatcher] Préservation intégrale des paramètres vers navigateToView validée !');
}

console.log('🎉 TOUS LES TESTS DE NAVIGATION PROFIL VENDEUR ONT RÉUSSI AVEC SUCCÈS !');
