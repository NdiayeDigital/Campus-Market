/**
 * Suite de tests de sécurité et vérification automatique des abonnements SasPay
 * Campus Market - UIDT Thiès
 */

import fs from 'node:fs';
import path from 'node:path';
import verifyPaymentHandler from '../api/verify-payment.js';
import webhookHandler from '../api/webhook-saspay.js';
import createCheckoutHandler from '../api/create-subscription-checkout.js';
import {
    submitSubscriptionPaymentProof,
    fetchSellerPendingPayments,
} from '../src/services/seller-service.js';
import {
    fetchPendingSubscriptionPayments,
    approveSubscriptionPayment,
    rejectSubscriptionPayment,
} from '../src/services/admin-service.js';

console.log('🔒 Démarrage de la suite de tests de sécurité des abonnements SasPay...\n');

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

function createMockReqRes(body, method = 'POST', headers = {}) {
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
        headers,
    };
    return { req, res, getStatusCode: () => statusCode, getResponse: () => responseData };
}

// -------------------------------------------------------------
// 1. SUPPRESSION DE LA FAILLE CLIENT-SIDE (Bouton d'activation fictive retiré)
// -------------------------------------------------------------
console.log('🛡️ 1. Vérification du modal d\'abonnement (Suppression du bouton non sécurisé)...');

const modalSource = fs.readFileSync(path.resolve('src/components/seller/SubscriptionModal.js'), 'utf-8');
assert(!modalSource.includes('btn-confirm-active-sub'), 'Le bouton "btn-confirm-active-sub" (activation sans payer) a été supprimé');
assert(!modalSource.includes("J'ai validé mon paiement"), 'Le texte trompeur "J\'ai validé mon paiement" a été retiré');
assert(modalSource.includes('startAutoPolling'), 'Système de radar auto-polling présent dans le modal');
assert(modalSource.includes('confirmSubscriptionPayment'), 'Vérification automatique connectée à confirmSubscriptionPayment');
assert(modalSource.includes('submitSubscriptionPaymentProof'), 'Soumission de preuve de secours manuelle présente');

// -------------------------------------------------------------
// 2. BLOCAGE DU CONTOURNEMENT D'API (/api/verify-payment)
// -------------------------------------------------------------
console.log('\n🚫 2. Test du blocage de contournement dans /api/verify-payment...');

// Test A : Session ID factice ou non réglé
const fakeVerifyCtx = createMockReqRes({
    sessionId: 'fake_unpaid_session_123',
    sellerId: '00000000-0000-0000-0000-000000000001',
    plan: 'starter',
    operator: 'wave',
});
await verifyPaymentHandler(fakeVerifyCtx.req, fakeVerifyCtx.res);
assert(fakeVerifyCtx.getStatusCode() === 400, 'Code 400 : Session non payée rejetée');
assert(fakeVerifyCtx.getResponse().success === false, 'success: false pour session non payée');
assert(Boolean(fakeVerifyCtx.getResponse().error), 'Message d\'erreur explicite retourné');

// Test B : Appel sans session ID
const emptyVerifyCtx = createMockReqRes({
    sellerId: '00000000-0000-0000-0000-000000000001',
});
await verifyPaymentHandler(emptyVerifyCtx.req, emptyVerifyCtx.res);
assert(emptyVerifyCtx.getStatusCode() === 400, 'Code 400 si sessionId est manquant');

// -------------------------------------------------------------
// 3. VÉRIFICATION DU WEBHOOK SASPAY EN TEMPS RÉEL (/api/webhook-saspay)
// -------------------------------------------------------------
console.log('\n🔔 3. Test du Webhook automatique SasPay...');

// Test A : Webhook avec statut SUCCESS
const validWebhookCtx = createMockReqRes({
    event: 'transaction.success',
    data: {
        id: 'sas_tx_auto_12345',
        status: 'SUCCESS',
        amount: '2500.00',
        metadata: {
            seller_id: '00000000-0000-0000-0000-000000000002',
            plan: 'pro',
            operator: 'om',
        },
    },
});
await webhookHandler(validWebhookCtx.req, validWebhookCtx.res);
assert(validWebhookCtx.getStatusCode() === 200, 'Code 200 pour transaction.success');
assert(validWebhookCtx.getResponse().received === true, 'Webhook accusé réception reçu');
assert(validWebhookCtx.getResponse().success === true, 'Activation automatique validée');
assert(validWebhookCtx.getResponse().plan === 'pro', 'Pack Pro détecté');

// Test B : Webhook avec événement non concluant (PENDING ou FAILED)
const pendingWebhookCtx = createMockReqRes({
    event: 'transaction.pending',
    data: {
        id: 'sas_tx_pending_1',
        status: 'PENDING',
        amount: '1500.00',
    },
});
await webhookHandler(pendingWebhookCtx.req, pendingWebhookCtx.res);
assert(pendingWebhookCtx.getStatusCode() === 200, 'Code 200 pour statut pending');
assert(pendingWebhookCtx.getResponse().status === 'ignored', 'Statut non concluant ignoré sans activation');

// -------------------------------------------------------------
// 4. PARCOURS DE SECOURS RÉSILIENT : PROUVE DE PAIEMENT & SUPERADMIN
// -------------------------------------------------------------
console.log('\n👨‍💼 4. Vérification du parcours de secours & modération SuperAdmin...');

assert(typeof submitSubscriptionPaymentProof === 'function', 'submitSubscriptionPaymentProof est exporté');
assert(typeof fetchSellerPendingPayments === 'function', 'fetchSellerPendingPayments est exporté');
assert(typeof fetchPendingSubscriptionPayments === 'function', 'fetchPendingSubscriptionPayments est exporté');
assert(typeof approveSubscriptionPayment === 'function', 'approveSubscriptionPayment est exporté');
assert(typeof rejectSubscriptionPayment === 'function', 'rejectSubscriptionPayment est exporté');

// Validation du rejet si référence vide
let emptyRefCaught = false;
try {
    await submitSubscriptionPaymentProof({
        sellerId: '00000000-0000-0000-0000-000000000001',
        plan: 'starter',
        operator: 'wave',
        transactionRef: '   ',
    });
} catch (err) {
    emptyRefCaught = err.message.includes('référence');
}
assert(emptyRefCaught === true, 'Soumission sans référence rejetée avec message clair');

console.log(`\n🎉 TOUS LES TESTS DE SÉCURITÉ SONT VALIDÉS AVEC SUCCÈS ! (${passedTests}/${totalTests} assertions réussies)\n`);
