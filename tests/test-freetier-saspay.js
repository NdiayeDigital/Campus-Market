/**
 * Test Suite Automatisée : Free Tier 7 Jours, SasPay Checkout & Multi-Opérateurs (Wave / OM)
 * Campus Market - UIDT Thiès
 */

import {
    SUBSCRIPTION_PLANS,
    PAYMENT_OPERATORS,
    FREE_TRIAL_CONFIG,
    getPlanDetails,
    getMaxProductsForPlan,
    computeSubscriptionStatus,
} from '../src/config/subscription.js';

import createCheckoutHandler from '../api/create-subscription-checkout.js';
import verifyPaymentHandler from '../api/verify-payment.js';
import webhookHandler from '../api/webhook-saspay.js';

console.log('🚀 Démarrage de la suite de tests Free Tier & SasPay...\n');

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
    totalTests++;
    if (!condition) {
        console.error(`❌ ÉCHEC : ${message}`);
        throw new Error(message);
    } else {
        passedTests++;
        console.log(`  ✅ ${message}`);
    }
}

// -------------------------------------------------------------
// 1. Configuration des Formules d'Abonnement (3 Plans)
// -------------------------------------------------------------
console.log('📦 1. Vérification des Plans & Quotas...');

assert(SUBSCRIPTION_PLANS.starter.price === 1500, 'Pack Starter = 1 500 FCFA/mois');
assert(SUBSCRIPTION_PLANS.starter.maxProducts === 5, 'Pack Starter = 5 articles max');
assert(SUBSCRIPTION_PLANS.starter.paymentLink === 'https://link.saspay.me/hgc4jifsarq', 'Lien direct SasPay configuré pour Starter');

assert(SUBSCRIPTION_PLANS.pro.price === 2500, 'Pack Pro = 2 500 FCFA/mois');
assert(SUBSCRIPTION_PLANS.pro.maxProducts === 10, 'Pack Pro = 10 articles max');
assert(SUBSCRIPTION_PLANS.pro.paymentLink === 'https://link.saspay.me/gxky6adwejc', 'Lien direct SasPay configuré pour Pro');

assert(SUBSCRIPTION_PLANS.premium === undefined, 'Pack Annuel VIP retiré du catalogue');

assert(getMaxProductsForPlan('pro') === 10, 'getMaxProductsForPlan("pro") renvoie 10');
assert(getMaxProductsForPlan('starter') === 5, 'getMaxProductsForPlan("starter") renvoie 5');
assert(getMaxProductsForPlan('inconnu') === 5, 'Fallback vers Starter (5 articles) pour plan inconnu');

assert(FREE_TRIAL_CONFIG.durationDays === 7, 'Essai gratuit configuré à 7 jours');
assert(FREE_TRIAL_CONFIG.maxProducts === 3, 'Essai gratuit donne 3 articles max');

// -------------------------------------------------------------
// 2. Opérateurs de Paiement Disponibles
// -------------------------------------------------------------
console.log('\n💳 2. Vérification des Opérateurs de Paiement...');

assert(Array.isArray(PAYMENT_OPERATORS), 'PAYMENT_OPERATORS est un tableau');
const waveOp = PAYMENT_OPERATORS.find(op => op.id === 'wave');
const omOp = PAYMENT_OPERATORS.find(op => op.id === 'om');

assert(Boolean(waveOp), 'Opérateur Wave présent dans la liste');
assert(Boolean(omOp), 'Opérateur Orange Money présent dans la liste');
assert(waveOp.name === 'Wave', 'Nom Wave lisible');
assert(omOp.name === 'Orange Money', 'Nom Orange Money lisible');

// -------------------------------------------------------------
// 3. Cycle de Vie de l'Essai Gratuit & Calcul de Statut
// -------------------------------------------------------------
console.log('\n⏱️ 3. Vérification du Cycle de Vie (computeSubscriptionStatus)...');

const now = Date.now();
const oneDayMs = 24 * 60 * 60 * 1000;

// Cas A : SuperAdmin (Illimité)
const adminStatus = computeSubscriptionStatus({ role: 'superadmin' });
assert(adminStatus.status === 'superadmin' && adminStatus.canSell === true, 'SuperAdmin a un accès illimité');

// Cas B : Essai Actif (5 jours restants)
const trialActiveSeller = {
    role: 'vendeur',
    subscription_status: 'trial',
    trial_ends_at: new Date(now + 5 * oneDayMs).toISOString(),
    subscription_plan: 'starter',
};
const trialActiveStatus = computeSubscriptionStatus(trialActiveSeller);
assert(trialActiveStatus.status === 'trial_active', 'Statut = trial_active pour 5j restants');
assert(trialActiveStatus.canSell === true, 'Vendeur en essai peut publier des articles');
assert(trialActiveStatus.daysRemaining >= 4 && trialActiveStatus.daysRemaining <= 5, 'Calcul correct des jours restants (~5j)');

// Cas C : Essai Expirant sous peu (1 jour restant)
const trialExpiringSeller = {
    role: 'vendeur',
    subscription_status: 'trial',
    trial_ends_at: new Date(now + 1 * oneDayMs).toISOString(),
    subscription_plan: 'starter',
};
const trialExpiringStatus = computeSubscriptionStatus(trialExpiringSeller);
assert(trialExpiringStatus.status === 'trial_expiring', 'Statut = trial_expiring pour J<=2');
assert(trialExpiringStatus.canSell === true, 'Vendeur peut encore publier');

// Cas D : Essai Expiré (terminé il y a 2 jours)
const trialExpiredSeller = {
    role: 'vendeur',
    subscription_status: 'trial',
    trial_ends_at: new Date(now - 2 * oneDayMs).toISOString(),
    subscription_plan: 'starter',
};
const trialExpiredStatus = computeSubscriptionStatus(trialExpiredSeller);
assert(trialExpiredStatus.status === 'trial_expired', 'Statut = trial_expired après 7j');
assert(trialExpiredStatus.canSell === false, 'Vendeur avec essai expiré est bloqué');
assert(trialExpiredStatus.isExpired === true, 'Drapeau isExpired = true');

// Cas E : Abonnement Payé Actif (25 jours restants)
const paidActiveSeller = {
    role: 'vendeur',
    subscription_status: 'active',
    subscription_expires_at: new Date(now + 25 * oneDayMs).toISOString(),
    subscription_plan: 'pro',
};
const paidActiveStatus = computeSubscriptionStatus(paidActiveSeller);
assert(paidActiveStatus.status === 'active', 'Statut = active pour abonnement payé');
assert(paidActiveStatus.canSell === true, 'Vendeur avec abonnement actif peut publier');
assert(paidActiveStatus.isPaid === true, 'Drapeau isPaid = true');

// Cas F : Abonnement Payé Expiré (terminé hier)
const paidExpiredSeller = {
    role: 'vendeur',
    subscription_status: 'active',
    subscription_expires_at: new Date(now - 1 * oneDayMs).toISOString(),
    subscription_plan: 'starter',
};
const paidExpiredStatus = computeSubscriptionStatus(paidExpiredSeller);
assert(paidExpiredStatus.status === 'expired', 'Statut = expired après fin des 30j');
assert(paidExpiredStatus.canSell === false, 'Vendeur abonné expiré bloqué');

// -------------------------------------------------------------
// 4. API Checkout SasPay (Lien Direct)
// -------------------------------------------------------------
console.log('\n🌐 4. Vérification de l\'API /api/create-subscription-checkout...');

function createMockReqRes(body, method = 'POST') {
    let statusCode = 200;
    let responseData = null;
    const res = {
        status(code) {
            statusCode = code;
            return this;
        },
        json(data) {
            responseData = data;
            return this;
        },
        setHeader() {},
        end(data) {
            if (data && !responseData) {
                try {
                    responseData = JSON.parse(data);
                } catch {
                    responseData = data;
                }
            }
        },
    };
    const req = {
        method,
        body,
        headers: {},
    };
    return { req, res, getStatusCode: () => statusCode, getResponse: () => responseData };
}

// Test Checkout pour Pack Starter
const starterCtx = createMockReqRes({
    sellerId: 'seller-uuid-1',
    plan: 'starter',
    sellerName: 'Moussa Diop',
    sellerPhone: '771234567',
});
await createCheckoutHandler(starterCtx.req, starterCtx.res);
assert(starterCtx.getStatusCode() === 200, 'Code 200 pour session Starter Checkout');
const starterResp = starterCtx.getResponse();
assert(starterResp.mode === 'direct_link', 'Mode direct_link activé pour lien SasPay');
assert(Number(starterResp.amount) === 1500, 'Montant de 1 500 F pour Pack Starter');
assert(starterResp.paymentLink === 'https://link.saspay.me/hgc4jifsarq', 'Lien SasPay 1500 F présent');
assert(starterResp.durationDays === 30, 'Durée de 30 jours pour Pack Starter');
assert(starterResp.sessionId && starterResp.sessionId.startsWith('saspay_link_'), 'Session ID direct SasPay généré');

// Test Checkout pour Pack Pro
const proCtx = createMockReqRes({
    sellerId: 'seller-uuid-2',
    plan: 'pro',
    sellerName: 'Awa Ndiaye',
    sellerPhone: '781234567',
});
await createCheckoutHandler(proCtx.req, proCtx.res);
assert(proCtx.getStatusCode() === 200, 'Code 200 pour session Pro Checkout');
const proResp = proCtx.getResponse();
assert(Number(proResp.amount) === 2500, 'Montant de 2 500 F pour Pro');
assert(proResp.paymentLink === 'https://link.saspay.me/gxky6adwejc', 'Lien SasPay 2500 F présent');
assert(proResp.durationDays === 30, 'Durée de 30 jours pour Pro');

// -------------------------------------------------------------
// 5. API Vérification de Paiement /api/verify-payment
// -------------------------------------------------------------
console.log('\n🔍 5. Vérification de l\'API /api/verify-payment...');

const verifyCtx = createMockReqRes({
    sessionId: proResp.sessionId,
    plan: 'pro',
    operator: 'wave',
    sellerId: 'seller-uuid-2',
});
await verifyPaymentHandler(verifyCtx.req, verifyCtx.res);
assert(verifyCtx.getStatusCode() === 200, 'Code 200 pour vérification de session');
const verifyResp = verifyCtx.getResponse();
assert(verifyResp.success === true, 'Vérification de session réussie');
assert(verifyResp.subscriptionStatus === 'active', 'Statut vendeur mis à "active"');
assert(verifyResp.maxProducts === 10, 'Quota de 10 produits débloqué pour Pack Pro');
assert(verifyResp.durationDays === 30, 'Durée d\'activation de 30 jours pour Pack Pro');
assert(Boolean(verifyResp.expiresAt), 'Date d\'expiration fournie');

// -------------------------------------------------------------
// 6. API Webhook SasPay /api/webhook-saspay
// -------------------------------------------------------------
console.log('\n🔔 6. Vérification du Webhook IPN SasPay...');

const webhookCtx = createMockReqRes({
    event: 'charge.success',
    data: {
        id: 'sas_tx_998877',
        status: 'successful',
        amount: '1500.00',
        metadata: {
            seller_id: 'seller-uuid-3',
            plan: 'starter',
            operator: 'wave',
        },
    },
});
await webhookHandler(webhookCtx.req, webhookCtx.res);
assert(webhookCtx.getStatusCode() === 200, 'Code 200 pour accusé réception webhook');
const webhookResp = webhookCtx.getResponse();
assert(webhookResp.received === true, 'Accusé réception webhook renvoyé à SasPay');

console.log(`\n🎉 TOUS LES TESTS SONT VALIDÉS AVEC SUCCÈS ! (${passedTests}/${totalTests} assertions réussies)\n`);
