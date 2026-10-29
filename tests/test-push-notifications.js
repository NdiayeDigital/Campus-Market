/**
 * Tests unitaires : Configuration et utilitaires Web Push
 */

import { VAPID_CONFIG, urlBase64ToUint8Array } from '../src/config/push.js';
import { isNotificationSupported, getNotificationPermission } from '../src/utils/background-notifications.js';

console.log('🧪 Démarrage des tests unitaires Web Push...');

// 1. Contrôle de la clé VAPID publique
if (!VAPID_CONFIG.publicKey || typeof VAPID_CONFIG.publicKey !== 'string') {
    console.error('❌ [WebPush] Clé publique VAPID absente ou invalide.');
    process.exit(1);
}
console.log('✅ [VAPID_CONFIG] Clé publique VAPID présente et valide !');

// 2. Conversion Base64 -> Uint8Array
const uint8Key = urlBase64ToUint8Array(VAPID_CONFIG.publicKey);
if (!(uint8Key instanceof Uint8Array) || uint8Key.length !== 65) {
    console.error(`❌ [urlBase64ToUint8Array] Format inattendu pour la clé P-256 (longueur attendue: 65, reçue: ${uint8Key.length}).`);
    process.exit(1);
}
console.log('✅ [urlBase64ToUint8Array] Décodage de la clé VAPID 65-bytes P-256 validé !');

// 3. Robustesse en environnement Node/SSR
if (isNotificationSupported() !== false) {
    console.error('❌ [isNotificationSupported] Doit retourner false sous environnement Node.js.');
    process.exit(1);
}
if (getNotificationPermission() !== 'unsupported') {
    console.error('❌ [getNotificationPermission] Doit retourner unsupported sous environnement Node.js.');
    process.exit(1);
}
console.log('✅ [EnvironmentSafeguards] Tolérance sécurisée hors-navigateur validée !');

console.log('🎉 TOUS LES TESTS WEB PUSH SONT PASSÉS AVEC SUCCÈS !');
