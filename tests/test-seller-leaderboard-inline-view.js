/**
 * Test Suite: Vue Classement en Liste Intégrée dans le Dashboard Vendeur
 * Vérifie que le classement des vendeurs est affiché en liste intégrée pleine page
 * (pas en popup flottante) et accessible à tous les vendeurs de la plateforme.
 */

import { strict as assert } from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Démarrage des tests: Vue Classement Intégrée en Liste dans le Dashboard...');

// 1. Vérification de l'existence de SellerLeaderboardView.js
const leaderboardViewPath = path.join(rootDir, 'src', 'components', 'seller', 'SellerLeaderboardView.js');
assert.ok(fs.existsSync(leaderboardViewPath), 'Le fichier SellerLeaderboardView.js doit exister');

const leaderboardViewContent = fs.readFileSync(leaderboardViewPath, 'utf8');
assert.ok(
    leaderboardViewContent.includes('export function createSellerLeaderboardView'),
    'SellerLeaderboardView.js doit exporter createSellerLeaderboardView'
);
assert.ok(
    leaderboardViewContent.includes('seller-leaderboard-view'),
    'SellerLeaderboardView.js doit définir l\'identifiant #seller-leaderboard-view'
);
assert.ok(
    leaderboardViewContent.includes('leaderboard-sellers-list'),
    'SellerLeaderboardView.js doit afficher la liste #leaderboard-sellers-list'
);
assert.ok(
    leaderboardViewContent.includes('btn-leaderboard-back-dashboard'),
    'SellerLeaderboardView.js doit contenir le bouton de retour #btn-leaderboard-back-dashboard'
);
assert.ok(
    leaderboardViewContent.includes('btn-refresh-leaderboard'),
    'SellerLeaderboardView.js doit contenir le bouton d\'actualisation #btn-refresh-leaderboard'
);
console.log('  ✅ SellerLeaderboardView.js est correctement structuré avec liste et actions.');

// 2. Vérification de l'intégration dans SellerDashboard.js
const dashboardPath = path.join(rootDir, 'src', 'components', 'seller', 'SellerDashboard.js');
const dashboardContent = fs.readFileSync(dashboardPath, 'utf8');

assert.ok(
    dashboardContent.includes("import { createSellerLeaderboardView } from './SellerLeaderboardView.js';"),
    'SellerDashboard.js doit importer createSellerLeaderboardView'
);
assert.ok(
    dashboardContent.includes("activeSubTab === 'leaderboard'"),
    'SellerDashboard.js doit gérer activeSubTab === "leaderboard"'
);
assert.ok(
    dashboardContent.includes("createSellerLeaderboardView({"),
    'SellerDashboard.js doit instancier createSellerLeaderboardView dans #seller-tab-content'
);
assert.ok(
    dashboardContent.includes("switchSubTab('leaderboard')"),
    'SellerDashboard.js doit basculer vers "leaderboard" via switchSubTab'
);
assert.ok(
    dashboardContent.includes('data-seller-tab="leaderboard"'),
    'SellerDashboard.js doit inclure un bouton tablette data-seller-tab="leaderboard"'
);
console.log('  ✅ SellerDashboard.js intègre le sous-onglet leaderboard en pleine page sans modale.');

// 3. Vérification de l'absence de déclenchement de la modale flottante lors du clic classement dans le dashboard
assert.ok(
    !dashboardContent.includes("openSellerLeaderboardModal({\n                    leaderboard,\n                    currentSellerId: seller.id"),
    'SellerDashboard.js ne doit plus ouvrir de modale flottante lors du clic classement'
);
console.log('  ✅ Zéro modale flottante déclenchée depuis le tableau de bord vendeur (affichage en liste directe).');

// 4. Vérification de la transmission depuis SellerProfileView.js
const profileViewPath = path.join(rootDir, 'src', 'components', 'seller', 'SellerProfileView.js');
const profileViewContent = fs.readFileSync(profileViewPath, 'utf8');

assert.ok(
    profileViewContent.includes('onOpenLeaderboard'),
    'SellerProfileView.js doit accepter le callback onOpenLeaderboard'
);
assert.ok(
    profileViewContent.includes("typeof onOpenLeaderboard === 'function'"),
    'SellerProfileView.js doit invoquer onOpenLeaderboard lors du clic sur #btn-open-leaderboard-from-profile'
);
console.log('  ✅ SellerProfileView.js redirige vers la vue liste intégrée.');

console.log('🎉 Tous les tests de la vue classement en liste intégrée sont validés avec succès !');
