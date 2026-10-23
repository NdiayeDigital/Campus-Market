/**
 * Test de validation des correctifs de sécurité (Audit Campus Market)
 * Vérifie formellement le blocage des failles VULN-01 (Account Takeover) et VULN-02 (SasPay Webhook).
 */

import crypto from 'node:crypto';
import adminResetHandler from '../api/admin-reset-password.js';
import webhookHandler from '../api/webhook-saspay.js';

console.log('🛡️ Lancement des tests de validation des correctifs de sécurité...\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✅ ${message}`);
        passCount++;
    } else {
        console.error(`  ❌ ÉCHEC: ${message}`);
        failCount++;
    }
}

function createMockReqRes({ body = {}, method = 'POST', headers = {} } = {}) {
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
    };
    const req = {
        method,
        body,
        headers,
    };
    return { req, res, getStatusCode: () => statusCode, getResponse: () => responseData };
}

// ---------------------------------------------------------------------------
// 1. TEST VULN-01 : Sécurisation de /api/admin-reset-password
// ---------------------------------------------------------------------------
console.log('🔒 1. Vérification du blocage d\'accès non authentifié sur /api/admin-reset-password...');

// Test 1.A : Requête sans en-tête Authorization
const unauthCtx = createMockReqRes({
    body: { sellerId: '00000000-0000-0000-0000-000000000001' },
    headers: {},
});
await adminResetHandler(unauthCtx.req, unauthCtx.res);
assert(unauthCtx.getStatusCode() === 401, 'Rejet 401 immédiat si aucun jeton Authorization n\'est fourni');
assert(unauthCtx.getResponse()?.error?.includes('Authentification requise'), 'Message explicite indiquant que l\'authentification est requise');

// Test 1.B : Requête avec jeton invalide
const invalidTokenCtx = createMockReqRes({
    body: { sellerId: '00000000-0000-0000-0000-000000000001' },
    headers: { authorization: 'Bearer jeton_invalide_ou_forgé' },
});
await adminResetHandler(invalidTokenCtx.req, invalidTokenCtx.res);
assert(invalidTokenCtx.getStatusCode() === 401, 'Rejet 401 si le jeton Bearer est invalide');

// ---------------------------------------------------------------------------
// 2. TEST VULN-02 : Vérification stricte de signature sur /api/webhook-saspay
// ---------------------------------------------------------------------------
console.log('\n🔐 2. Vérification de la signature HMAC sur /api/webhook-saspay...');

const testSecret = 'whsec_test_secret_key_12345';
process.env.SASPAY_WEBHOOK_SECRET = testSecret;

const testPayload = {
    event: 'transaction.success',
    data: {
        id: 'tx_sec_test_001',
        status: 'SUCCESS',
        metadata: {
            seller_id: '00000000-0000-0000-0000-000000000005',
            plan: 'pro',
        },
    },
};

// Test 2.A : Requête sans signature alors que le secret est configuré
const missingSigCtx = createMockReqRes({
    body: testPayload,
    headers: {},
});
await webhookHandler(missingSigCtx.req, missingSigCtx.res);
assert(missingSigCtx.getStatusCode() === 401, 'Rejet 401 si la signature est absente');

// Test 2.B : Requête avec signature falsifiée
const forgedSigCtx = createMockReqRes({
    body: testPayload,
    headers: {
        'x-webhook-signature': '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    },
});
await webhookHandler(forgedSigCtx.req, forgedSigCtx.res);
assert(forgedSigCtx.getStatusCode() === 401, 'Rejet 401 si la signature HMAC est incorrecte/falsifiée');

// Test 2.C : Requête avec signature HMAC valide et timing_safe
const bodyStr = JSON.stringify(testPayload);
const validHmac = crypto.createHmac('sha256', testSecret).update(bodyStr).digest('hex');

const validSigCtx = createMockReqRes({
    body: testPayload,
    headers: {
        'x-webhook-signature': validHmac,
    },
});
await webhookHandler(validSigCtx.req, validSigCtx.res);
assert(validSigCtx.getStatusCode() === 200, 'Acceptation 200 lorsque la signature HMAC est authentique');
assert(validSigCtx.getResponse()?.success === true, 'Abonnement activé suite à la signature validée');

// Nettoyage de la variable de test
delete process.env.SASPAY_WEBHOOK_SECRET;

console.log('\n=======================================================');
console.log(`Résultats : ${passCount} tests réussis, ${failCount} échecs`);
console.log('=======================================================');

if (failCount > 0) {
    process.exit(1);
} else {
    console.log('🎉 TOUS LES CORRECTIFS DE SÉCURITÉ SONT VALIDÉS ET PROUVÉS !\n');
}
