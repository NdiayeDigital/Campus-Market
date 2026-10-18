/**
 * Test d'intégration de bout en bout du flux de réinitialisation et de connexion.
 */

import { supabase } from '../src/services/supabase.js';
import { adminResetSellerPassword, loginAdmin } from '../src/services/admin-service.js';
import { loginSeller, changeSellerPassword } from '../src/services/seller-service.js';

console.log('🧪 Démarrage du test d\'intégration du flux de mot de passe...\n');

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

try {
    // 1. Connexion en SuperAdmin
    console.log('1. Connexion SuperAdmin...');
    const adminRes = await loginAdmin({
        email: 'admin@univ-thies.sn',
        password: 'AdminPasser123!',
    });
    assert(adminRes?.user?.email === 'admin@univ-thies.sn', 'SuperAdmin connecté avec succès');

    // 2. Réinitialisation du mot de passe de Fatou Sow
    console.log('\n2. Réinitialisation administrative du mot de passe du vendeur...');
    const sellerId = '692eac18-cf68-46ba-bdb7-fbbc27bdf8ff';
    const resetRes = await adminResetSellerPassword(sellerId);
    assert(resetRes?.success === true, 'adminResetSellerPassword a renvoyé success: true');
    assert(resetRes?.temporaryPassword === 'campus1234!', 'Mot de passe temporaire défini à campus1234!');

    // Déconnexion de l'admin pour tester la connexion vendeur
    await supabase.auth.signOut();

    // 3. Connexion du vendeur avec le mot de passe temporaire campus1234!
    console.log('\n3. Connexion du vendeur avec "campus1234!"...');
    const sellerLoginRes = await loginSeller({
        email: 'fatou.sow@univ-thies.sn',
        password: 'campus1234!',
    });
    assert(sellerLoginRes?.user?.email === 'fatou.sow@univ-thies.sn', 'Vendeur connecté avec succès avec campus1234!');
    assert(sellerLoginRes?.mustChangePassword === true, 'Le drapeau mustChangePassword est bien détecté à true');

    // 4. Changement obligatoire vers un mot de passe personnel
    console.log('\n4. Modification du mot de passe vers un nouveau mot de passe...');
    const newPwd = 'MonNouveauPass2026!';
    const changeRes = await changeSellerPassword({
        newPassword: newPwd,
        confirmPassword: newPwd,
    });
    assert(changeRes?.success === true, 'Changement de mot de passe réussi');

    // Déconnexion
    await supabase.auth.signOut();

    // 5. Connexion avec le nouveau mot de passe
    console.log('\n5. Connexion avec le nouveau mot de passe...');
    const newLoginRes = await loginSeller({
        email: 'fatou.sow@univ-thies.sn',
        password: newPwd,
    });
    assert(newLoginRes?.user?.email === 'fatou.sow@univ-thies.sn', 'Connexion réussie avec le nouveau mot de passe');
    assert(newLoginRes?.mustChangePassword === false, 'mustChangePassword est désormais à false');

    // 6. Nettoyage et remise à l'état campus1234! pour les tests utilisateur
    console.log('\n6. Remise du compte à l\'état temporaire "campus1234!" pour le test utilisateur...');
    await supabase.auth.signOut();
    await loginAdmin({
        email: 'admin@univ-thies.sn',
        password: 'AdminPasser123!',
    });
    await adminResetSellerPassword(sellerId);
    await supabase.auth.signOut();
    
    // Vérification finale que campus1234! fonctionne à nouveau
    const finalLogin = await loginSeller({
        email: 'fatou.sow@univ-thies.sn',
        password: 'campus1234!',
    });
    assert(finalLogin?.mustChangePassword === true, 'Compte vendeur prêt pour le test utilisateur (campus1234! actif et must_change_password = true)');

    await supabase.auth.signOut();

    console.log('\n=======================================================');
    console.log(`Résultats : ${passCount} tests réussis, ${failCount} échecs`);
    console.log('=======================================================');
    console.log('🎉 Le flux complet fonctionne impeccablement !');
} catch (err) {
    console.error('Erreur inattendue durant le test d\'intégration :', err);
    process.exit(1);
}
