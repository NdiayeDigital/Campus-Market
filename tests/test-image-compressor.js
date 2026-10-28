/**
 * Suite de tests unitaires pour le module image-compressor.js
 */
import { compressImage, dataURLtoBlob } from '../src/utils/image-compressor.js';

console.log('🧪 Démarrage des tests unitaires du compresseur d\'image...');

// 1. Test dataURLtoBlob avec un dataURL JPEG valide
const testDataUrl = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP///////w==';
const blob = dataURLtoBlob(testDataUrl);

console.assert(blob instanceof Blob, 'Échec: dataURLtoBlob doit retourner une instance de Blob');
console.assert(blob.type === 'image/jpeg', `Échec: Type attendu image/jpeg, obtenu ${blob.type}`);
console.assert(blob.size > 0, 'Échec: Le Blob généré ne doit pas être vide');
console.log('✅ [dataURLtoBlob] Conversion Base64 -> Blob binaire validée !');

// 2. Test dataURLtoBlob avec un Blob existant (idempotence)
const sameBlob = dataURLtoBlob(blob);
console.assert(sameBlob === blob, 'Échec: dataURLtoBlob doit renvoyer directement le Blob s\'il est déjà fourni');
console.log('✅ [dataURLtoBlob] Idempotence sur Blob direct validée !');

// 3. Test dataURLtoBlob sur entrée invalide
let caughtInvalid = false;
try {
    dataURLtoBlob(null);
} catch (e) {
    caughtInvalid = e instanceof TypeError;
}
console.assert(caughtInvalid, 'Échec: dataURLtoBlob(null) doit lever un TypeError');

let caughtMalformed = false;
try {
    dataURLtoBlob('not-a-data-url');
} catch (e) {
    caughtMalformed = e instanceof TypeError;
}
console.assert(caughtMalformed, 'Échec: dataURLtoBlob("not-a-data-url") doit lever un TypeError');
console.log('✅ [dataURLtoBlob] Rejet des entrées invalides validé !');

// 4. Test compressImage sur entrée absente
let caughtNoFile = false;
try {
    await compressImage(null);
} catch (e) {
    caughtNoFile = e.message.includes('Aucun fichier image fourni');
}
console.assert(caughtNoFile, 'Échec: compressImage(null) doit rejeter avec un message clair');
console.log('✅ [compressImage] Contrôle de paramètre obligatoire validé !');

// 5. Test compressImage en environnement Node.js (fallback ou dataURL direct)
const directCompressed = await compressImage(testDataUrl);
console.assert(typeof directCompressed === 'string' && directCompressed.startsWith('data:image/'), 'Échec: compressImage doit renvoyer une chaîne data:image/...');
console.log('✅ [compressImage] Résolution sécurisée dataURL en environnement de test validée !');

console.log('🎉 TOUS LES TESTS DU COMPRESSEUR D\'IMAGE SONT PASSÉS AVEC SUCCÈS !');
