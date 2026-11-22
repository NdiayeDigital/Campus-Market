/**
 * Tests Unitaires & d'Intégration :
 * Onglet Classement Officiel dans le Dashboard SuperAdmin
 * Campus Market - Université Iba Der Thiam de Thiès (UIDT)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { exportLeaderboardToCSV } from '../src/utils/export-csv.js';
import { getSellerTier, SELLER_TIERS } from '../src/services/seller-ranking-service.js';

console.log('🧪 Démarrage des tests : Onglet Classement dans le Dashboard SuperAdmin...');

const dashboardPath = path.resolve('src/components/admin/SuperAdminDashboard.js');
const dashboardCode = fs.readFileSync(dashboardPath, 'utf-8');

// =========================================================================
// 1. Vérification de la présence de l'onglet 'classement' dans la navigation
// =========================================================================
assert.ok(
    dashboardCode.includes("id: 'classement'"),
    "L'onglet 'classement' doit être défini dans navTabs"
);
assert.ok(
    dashboardCode.includes("label: \"Classement\""),
    "L'onglet doit avoir pour libellé 'Classement'"
);
assert.ok(
    dashboardCode.includes("icon: 'fa-trophy'"),
    "L'onglet doit avoir l'icône fa-trophy"
);
console.log('✅ [1] Onglet classement bien présent dans la configuration navTabs !');

// =========================================================================
// 2. Vérification du rendu de l'onglet Classement (renderClassementTab)
// =========================================================================
assert.ok(
    dashboardCode.includes('function renderClassementTab()'),
    'renderClassementTab doit être défini dans SuperAdminDashboard'
);
assert.ok(
    dashboardCode.includes('id="btn-refresh-admin-ranking"'),
    'Bouton de rafraîchissement présent dans le header du classement'
);
assert.ok(
    dashboardCode.includes('id="btn-export-ranking-csv"'),
    'Bouton export CSV présent dans le header du classement'
);
assert.ok(
    dashboardCode.includes('id="btn-open-public-ranking"'),
    'Bouton vitrine publique présent dans le header du classement'
);
assert.ok(
    dashboardCode.includes('Podium d\'Honneur UIDT'),
    'Le podium d\'honneur visuel doit être rendu'
);
assert.ok(
    dashboardCode.includes('id="admin-ranking-search"'),
    'Barre de recherche rapide par vendeur / boutique présente'
);
assert.ok(
    dashboardCode.includes('data-ranking-tier="all"'),
    'Filtre de palier "Tous" présent'
);
assert.ok(
    dashboardCode.includes('data-ranking-tier="diamant"'),
    'Filtre de palier "Diamant" présent'
);
assert.ok(
    dashboardCode.includes('data-ranking-tier="or"'),
    'Filtre de palier "Or" présent'
);
assert.ok(
    dashboardCode.includes('data-ranking-tier="argent"'),
    'Filtre de palier "Argent" présent'
);
assert.ok(
    dashboardCode.includes('data-ranking-tier="bronze"'),
    'Filtre de palier "Bronze" présent'
);
assert.ok(
    dashboardCode.includes('Tableau d\'Honneur des Vendeurs'),
    'Tableau complet des marchands classés présent'
);
console.log('✅ [2] renderClassementTab complet (podium, filtres, recherche, tableau) validé !');

// =========================================================================
// 3. Vérification des événements de l'onglet Classement (bindClassementEvents)
// =========================================================================
assert.ok(
    dashboardCode.includes('function bindClassementEvents()'),
    'bindClassementEvents doit être défini pour brancher les interactions'
);
assert.ok(
    dashboardCode.includes("if (activeTab === 'classement') bindClassementEvents();"),
    'bindClassementEvents doit être appelé lorsque activeTab === classement'
);
assert.ok(
    dashboardCode.includes('data-ranking-tier'),
    'Écouteur sur les boutons de palier présent'
);
console.log('✅ [3] bindClassementEvents et cycle de vie des événements validés !');

// =========================================================================
// 4. Vérification de la carte Bento Top 3 et raccourci dans Overview
// =========================================================================
assert.ok(
    dashboardCode.includes('Podium & Classement Marchands'),
    'Carte Bento Podium Top 3 présente dans l\'onglet Vue d\'ensemble'
);
assert.ok(
    dashboardCode.includes('data-jump-tab="classement"'),
    'Raccourci 1-clic data-jump-tab="classement" présent dans Vue d\'ensemble'
);
console.log('✅ [4] Carte Bento Top 3 et raccourci de saut vers le classement validés !');

// =========================================================================
// 5. Test unitaire exportLeaderboardToCSV
// =========================================================================
assert.equal(typeof exportLeaderboardToCSV, 'function', 'exportLeaderboardToCSV doit être une fonction exportée');

// Simulation de données mock
const mockLeaderboard = [
    {
        rank: 1,
        shopName: 'Librairie Centrale',
        prenom: 'Fatou',
        nom: 'Diop',
        points: 320,
        tier: { name: 'Diamant' },
        deliveredCount: 30,
        cancelledBySellerCount: 0,
        activeProducts: 15,
        pavillon: 'Pavillon A',
        chambre: '12',
        is_open: true,
    },
    {
        rank: 2,
        shopName: 'Tech Campus',
        prenom: 'Modou',
        nom: 'Fall',
        points: 180,
        tier: { name: 'Or' },
        deliveredCount: 18,
        cancelledBySellerCount: 1,
        activeProducts: 8,
        pavillon: 'Pavillon B',
        chambre: '34',
        is_open: false,
    },
];

// Vérifier que la fonction s'exécute sans erreur même dans un environnement headless
let downloadTriggered = false;
globalThis.window = {};
globalThis.Blob = class MockBlob {
    constructor(parts, options) {
        this.parts = parts;
        this.options = options;
    }
};
globalThis.URL = {
    createObjectURL: (blob) => 'blob:mock-url',
    revokeObjectURL: (url) => {},
};
globalThis.document = {
    body: {
        appendChild: () => {},
        removeChild: () => {},
    },
    createElement: (tag) => ({
        setAttribute: (key, val) => {},
        click: () => { downloadTriggered = true; },
    }),
};

exportLeaderboardToCSV(mockLeaderboard, 'test-export-leaderboard.csv');
assert.ok(downloadTriggered, 'Le téléchargement CSV doit se déclencher avec les données de classement');
console.log('✅ [5] exportLeaderboardToCSV génère et télécharge le fichier CSV avec succès !');

// =========================================================================
// 6. Test de cohérence des Paliers
// =========================================================================
assert.equal(getSellerTier(400).id, 'diamant');
assert.equal(getSellerTier(200).id, 'or');
assert.equal(getSellerTier(80).id, 'argent');
assert.equal(getSellerTier(10).id, 'bronze');
console.log('✅ [6] Calcul des paliers vendeur conforme au barème officiel !');

console.log('\n🎉 TOUS LES TESTS CLASSEMENT SUPERADMIN SONT PASSÉS AVEC SUCCÈS !');
