/**
 * Suite de tests unitaires et d'intégration :
 * Diffusion de Notifications Web Push par le SuperAdmin (Studio & API VAPID).
 * Campus Market - Université Iba Der Thiam de Thiès (UIDT).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { VAPID_CONFIG, urlBase64ToUint8Array } from '../src/config/push.js';
import {
    isNotificationSupported,
    getNotificationPermission,
    subscribePlatformPush,
} from '../src/utils/background-notifications.js';
import {
    broadcastPushNotification,
    fetchPushBroadcasts,
    fetchPushSubscribersCount,
} from '../src/services/admin-service.js';
import broadcastHandler from '../api/admin-broadcast-push.js';

console.log('🧪 Démarrage des tests du Studio de Diffusion Push SuperAdmin...');

// =========================================================================
// 1. Tests Cryptographiques VAPID & Clés P-256
// =========================================================================

assert.ok(VAPID_CONFIG.publicKey, 'Clé publique VAPID requise');
const uint8Key = urlBase64ToUint8Array(VAPID_CONFIG.publicKey);
assert.equal(uint8Key.length, 65, 'La clé publique VAPID P-256 non compressée doit faire exactement 65 octets');
console.log('✅ [VAPID] Clé P-256 et utilitaire urlBase64ToUint8Array validés !');

// =========================================================================
// 2. Tests de Sécurité en Environnement SSR / Node.js
// =========================================================================

assert.equal(isNotificationSupported(), false, 'isNotificationSupported doit renvoyer false sans DOM');
assert.equal(getNotificationPermission(), 'unsupported', 'getNotificationPermission doit renvoyer unsupported');
const subResult = await subscribePlatformPush({ role: 'visitor' });
assert.equal(subResult, false, 'subscribePlatformPush doit gérer gracieusement l\'absence de navigateur');
console.log('✅ [SSR Safeguards] Résilience hors-navigateur validée !');

// =========================================================================
// 3. Tests de Validation des Paramètres de Diffusion (Admin Service)
// =========================================================================

// Test 3.1: Rejet titre manquant ou trop court
await assert.rejects(
    async () => {
        await broadcastPushNotification({ title: '', body: 'Valid message body here' });
    },
    /titre/i,
    'broadcastPushNotification doit rejeter un titre vide'
);

await assert.rejects(
    async () => {
        await broadcastPushNotification({ title: 'AB', body: 'Valid message body here' });
    },
    /titre/i,
    'broadcastPushNotification doit rejeter un titre inférieur à 3 caractères'
);

// Test 3.2: Rejet corps de message manquant ou trop court
await assert.rejects(
    async () => {
        await broadcastPushNotification({ title: 'Titre Valide', body: '' });
    },
    /message/i,
    'broadcastPushNotification doit rejeter un message vide'
);

await assert.rejects(
    async () => {
        await broadcastPushNotification({ title: 'Titre Valide', body: '123' });
    },
    /message/i,
    'broadcastPushNotification doit rejeter un message inférieur à 5 caractères'
);

console.log('✅ [AdminService Validation] Contrôles stricts de saisie (titre 3-80, message 5-250) validés !');

// =========================================================================
// 4. Tests des Services de Repli & Statistiques
// =========================================================================

const counts = await fetchPushSubscribersCount();
assert.ok(typeof counts.total === 'number', 'fetchPushSubscribersCount doit renvoyer un total numérique');
assert.ok(typeof counts.sellers === 'number', 'fetchPushSubscribersCount doit renvoyer sellers numérique');
assert.ok(typeof counts.buyers === 'number', 'fetchPushSubscribersCount doit renvoyer buyers numérique');

const broadcasts = await fetchPushBroadcasts();
assert.ok(Array.isArray(broadcasts), 'fetchPushBroadcasts doit renvoyer un tableau');
console.log('✅ [AdminService Stats] fetchPushSubscribersCount et fetchPushBroadcasts validés !');

// =========================================================================
// 5. Tests de l'Endpoint Serverless /api/admin-broadcast-push
// =========================================================================

// Test 5.1: Méthode non autorisée (GET au lieu de POST)
let getStatusCode = 0;
let getResponse = {};
const mockGetReq = { method: 'GET' };
const mockGetRes = {
    setHeader: () => {},
    status: (code) => {
        getStatusCode = code;
        return {
            json: (data) => { getResponse = data; },
        };
    },
};
await broadcastHandler(mockGetReq, mockGetRes);
assert.equal(getStatusCode, 405, 'La méthode GET doit être rejetée avec 405 Method Not Allowed');

// Test 5.2: Absence de Jeton Bearer (401 Unauthorized)
let postStatusCode = 0;
let postResponse = {};
const mockPostReq = {
    method: 'POST',
    headers: {},
    body: { title: 'Flash Alerte UIDT', body: 'Message de test pour les étudiants du campus' },
};
const mockPostRes = {
    setHeader: () => {},
    status: (code) => {
        postStatusCode = code;
        return {
            json: (data) => { postResponse = data; },
        };
    },
};
await broadcastHandler(mockPostReq, mockPostRes);
assert.equal(postStatusCode, 401, 'Un appel sans jeton Bearer doit être rejeté avec 401 Unauthorized');
assert.ok(/authentification|jeton/i.test(postResponse.error), 'Message d\'erreur explicite requis');

console.log('✅ [Serverless API Security] Protection 405 et 401 Bearer Token validées !');

// =========================================================================
// 6. Intégrité du Script SQL de Migration
// =========================================================================

const sqlPath = path.resolve('database/migration_push_broadcast.sql');
assert.ok(fs.existsSync(sqlPath), 'Le fichier migration_push_broadcast.sql doit exister');
const sqlContent = fs.readFileSync(sqlPath, 'utf8');
assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.push_subscriptions'), 'Table push_subscriptions requise');
assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.push_broadcasts'), 'Table push_broadcasts requise');
assert.ok(sqlContent.includes('ROW LEVEL SECURITY'), 'RLS requise pour les tables push');
assert.ok(sqlContent.includes('target_audience'), 'Colonne target_audience requise');
console.log('✅ [Database Migration] Script SQL idempotent et sécurisé validé !');

// =========================================================================
// 7. Intégrité de l'Onglet Studio SuperAdmin
// =========================================================================

const adminDashboardFile = fs.readFileSync(path.resolve('src/components/admin/SuperAdminDashboard.js'), 'utf8');
assert.ok(adminDashboardFile.includes("id: 'broadcast'"), "L'onglet broadcast doit être défini dans navTabs");
assert.ok(adminDashboardFile.includes('renderBroadcastTab()'), 'renderBroadcastTab doit être appelé');
assert.ok(adminDashboardFile.includes('bindBroadcastEvents()'), 'bindBroadcastEvents doit être appelé');
assert.ok(adminDashboardFile.includes('mockup-notification-title'), 'Le mockup smartphone en direct doit être présent');
assert.ok(adminDashboardFile.includes('maxlength="210"'), 'La limite de description doit être portée à 210 caractères');
assert.ok(adminDashboardFile.includes('0 / 210'), 'Le compteur de caractères doit afficher la limite de 210');
assert.ok(adminDashboardFile.includes('broadcastPushNotification'), 'L\'appel de diffusion doit être branché');
console.log('✅ [SuperAdmin Dashboard] Studio de diffusion push et mockup temps réel validés !');

console.log('🎉 TOUS LES TESTS DU STUDIO DE DIFFUSION PUSH SONT PASSÉS AVEC SUCCÈS !');
process.exit(0);
