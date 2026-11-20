/**
 * Tests Unitaires & Intégration : Suppression de l'Essai Gratuit & Intégration Permanente du Pack Découverte
 * Campus Market - Université Iba Der Thiam de Thiès (UIDT)
 */

import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    SUBSCRIPTION_PLANS,
    computeSubscriptionStatus,
    getMaxProductsForPlan,
    FREE_TRIAL_CONFIG,
} from '../src/config/subscription.js';

console.log('🧪 Démarrage des tests : Onboarding Vendeur & Pack Découverte Permanent...');

// --- 1. Contrôle de la configuration subscription.js ---
console.log('\n--- 1. Contrôle de la configuration subscription.js ---');
assert.equal(FREE_TRIAL_CONFIG.durationDays, 0, 'La durée de l\'essai gratuit doit être de 0 jour (supprimé)');
assert.equal(FREE_TRIAL_CONFIG.planId, 'decouverte', 'Le planId par défaut doit être "decouverte"');

const decouvertePlan = SUBSCRIPTION_PLANS.decouverte;
assert.ok(decouvertePlan, 'Le pack Découverte doit exister dans SUBSCRIPTION_PLANS');
assert.equal(decouvertePlan.price, 0, 'Le pack Découverte est à 0 FCFA');
assert.equal(decouvertePlan.max_produits, 1, 'Le pack Découverte autorise 1 produit actif max');
assert.equal(decouvertePlan.max_ventes_mois, 5, 'Le pack Découverte autorise 5 ventes validées/mois max');
assert.equal(decouvertePlan.isPermanent, true, 'Le pack Découverte doit être permanent');
console.log('✅ [Config] SUBSCRIPTION_PLANS.decouverte et FREE_TRIAL_CONFIG validés.');

// --- 2. Contrôle de computeSubscriptionStatus (Découverte Permanent & Pas de Paywall d\'essai) ---
console.log('\n--- 2. Contrôle de computeSubscriptionStatus ---');

// Cas A : Nouveau vendeur sans abonnement payant
const newSeller = {
    id: 'seller-new-001',
    role: 'vendeur',
    subscription_plan: 'decouverte',
    subscription_status: 'decouverte',
    subscription_expires_at: null,
    trial_ends_at: null,
};
const newSellerStatus = computeSubscriptionStatus(newSeller);
assert.equal(newSellerStatus.status, 'decouverte', 'Le statut doit être "decouverte"');
assert.equal(newSellerStatus.isExpired, false, 'Le statut ne doit JAMAIS être expiré pour Découverte');
assert.equal(newSellerStatus.isTrial, false, 'Le vendeur n\'est pas en essai');
assert.equal(newSellerStatus.canPublish, true, 'Le vendeur Découverte peut publier (dans la limite de 1 article)');
assert.equal(newSellerStatus.canSell, true, 'Le vendeur Découverte peut vendre');
assert.equal(newSellerStatus.maxProducts, 1, '1 article max autorisé');
assert.equal(newSellerStatus.maxValidatedSalesPerMonth, 5, '5 ventes validées par mois max');
console.log('✅ [computeSubscriptionStatus] Nouveau vendeur Découverte permanent validé sans paywall.');

// Cas B : Ancien abonné Pro dont la période payée est expirée
const expiredProSeller = {
    id: 'seller-pro-expired',
    role: 'vendeur',
    subscription_plan: 'starter', // ou 'pro'
    subscription_status: 'active',
    subscription_expires_at: new Date(Date.now() - 3600 * 1000).toISOString(), // expiré il y a 1h
};
const expiredProStatus = computeSubscriptionStatus(expiredProSeller);
assert.equal(expiredProStatus.status, 'decouverte', 'Un abonné Pro expiré bascule automatiquement en Découverte');
assert.equal(expiredProStatus.isExpired, false, 'Il n\'est pas bloqué par un paywall d\'arrêt total');
assert.equal(expiredProStatus.canPublish, true, 'Peut continuer avec 1 article actif');
assert.equal(expiredProStatus.maxProducts, 1, 'Plafond ramené à 1 article');
assert.equal(expiredProStatus.maxValidatedSalesPerMonth, 5, 'Plafond ramené à 5 ventes/mois');
console.log('✅ [computeSubscriptionStatus] Rétrogradation automatique vers Découverte validée.');

// Cas C : Vendeur Pro actif (1 000 FCFA)
const activeProSeller = {
    id: 'seller-pro-active',
    role: 'vendeur',
    subscription_plan: 'starter',
    subscription_status: 'active',
    subscription_expires_at: new Date(Date.now() + 15 * 86400 * 1000).toISOString(),
};
const activeProStatus = computeSubscriptionStatus(activeProSeller);
assert.equal(activeProStatus.status, 'active');
assert.equal(activeProStatus.plan.id, 'starter');
assert.equal(activeProStatus.maxProducts, 5, '5 articles pour Pro');
assert.equal(activeProStatus.maxValidatedSalesPerMonth, null, 'Ventes illimitées pour Pro');
console.log('✅ [computeSubscriptionStatus] Vendeur Pro actif validé.');

// --- 3. Contrôle statique du composant SellerAuthModal.js ---
console.log('\n--- 3. Contrôle statique de SellerAuthModal.js ---');
const sellerAuthModalSrc = readFileSync(
    resolve(process.cwd(), 'src/components/seller/SellerAuthModal.js'),
    'utf-8'
);

assert.ok(
    !sellerAuthModalSrc.includes('renderTermsScreen'),
    'renderTermsScreen ne doit plus exister dans SellerAuthModal.js'
);
assert.ok(
    !sellerAuthModalSrc.includes("selectedPlan === 'pro'"),
    'selectedPlan ne doit plus être utilisé pour choisir un plan à l\'inscription'
);
assert.ok(
    sellerAuthModalSrc.includes('Pack Découverte — Gratuit (0 FCFA)'),
    'Le formulaire d\'inscription doit présenter le Pack Découverte (0 FCFA)'
);
assert.ok(
    sellerAuthModalSrc.includes('id="reg-terms-checkbox"'),
    'Le formulaire d\'inscription doit contenir la case à cocher des CGU'
);
assert.ok(
    sellerAuthModalSrc.includes("plan: 'decouverte'"),
    'L\'inscription doit enregistrer le plan "decouverte" par défaut'
);
assert.ok(
    sellerAuthModalSrc.includes('id="reg-pavillon"'),
    'Le formulaire d\'inscription doit contenir le sélecteur de pavillon (#reg-pavillon)'
);
assert.ok(
    sellerAuthModalSrc.includes('id="reg-chambre"'),
    'Le formulaire d\'inscription doit contenir le champ numéro de chambre (#reg-chambre)'
);
assert.ok(
    sellerAuthModalSrc.includes('PAVILLONS_UIDT'),
    'Le formulaire doit utiliser la liste des pavillons de l\'UIDT'
);
console.log('✅ [SellerAuthModal] Suppression du choix de packs, accueil Découverte, Pavillon et Chambre validés.');

// --- 4. Contrôle statique de ProductManager.js & SellerDashboard.js ---
console.log('\n--- 4. Contrôle statique de ProductManager.js & SellerDashboard.js ---');
const productManagerSrc = readFileSync(
    resolve(process.cwd(), 'src/components/seller/ProductManager.js'),
    'utf-8'
);
assert.ok(
    !productManagerSrc.includes("Période d'essai terminée"),
    'ProductManager ne doit plus afficher d\'alerte "Période d\'essai terminée"'
);

const sellerDashboardSrc = readFileSync(
    resolve(process.cwd(), 'src/components/seller/SellerDashboard.js'),
    'utf-8'
);
assert.ok(
    !sellerDashboardSrc.includes("⛔ Période d'essai terminée — Boutique en pause"),
    'SellerDashboard ne doit plus afficher de paywall rouge "Période d\'essai terminée"'
);
assert.ok(
    sellerDashboardSrc.includes('🧭 Formule Découverte (0 FCFA/mois)'),
    'SellerDashboard doit afficher la bannière de la Formule Découverte'
);
console.log('✅ [UI Marchande] Écrans débarrassés des paywalls d\'essai et alignés Découverte.');

console.log('\n🎉 TOUS LES TESTS PACK DÉCOUVERTE & ONBOARDING SONT VALIDÉS AVEC SUCCÈS !');
