/**
 * Tests unitaires pour l'utilitaire d'installation PWA
 */

import assert from 'node:assert';
import { isAppInstalled, initPwaInstallPrompt } from '../src/utils/pwa-install.js';

console.log('🧪 Démarrage des tests du module PWA Install...');

// Test 1 : isAppInstalled dans un environnement Node (sans window / document)
try {
    const installed = isAppInstalled();
    assert.strictEqual(typeof installed, 'boolean', 'isAppInstalled doit retourner un booléen');
    console.log('✅ [isAppInstalled] Comportement sécurisé en environnement non-navigateur validé !');
} catch (err) {
    console.error('❌ [isAppInstalled] Échec du test :', err);
    process.exit(1);
}

// Test 2 : initPwaInstallPrompt ne doit pas lever d'erreur sans window
try {
    assert.doesNotThrow(() => {
        initPwaInstallPrompt();
    }, 'initPwaInstallPrompt ne doit pas lever d\'exception');
    console.log('✅ [initPwaInstallPrompt] Garde d\'exécution sécurisée validée !');
} catch (err) {
    console.error('❌ [initPwaInstallPrompt] Échec du test :', err);
    process.exit(1);
}

console.log('🎉 TOUS LES TESTS PWA INSTALL SONT PASSÉS AVEC SUCCÈS !');
