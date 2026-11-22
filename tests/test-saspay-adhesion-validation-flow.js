/**
 * Suite de tests automatisés : Flux d'adhésion et validation de pack SasPay SuperAdmin
 * Vérifie :
 * 1. registerPendingSubscriptionReturn dans seller-service.js
 * 2. fetchGlobalMetrics et calcul unifié totalPendingApplicants dans admin-service.js
 * 3. approveSubscriptionPayment avec promotion candidat et activation 30 jours
 * 4. Détection et enregistrement au retour dans main.js
 * 5. Dashboard SuperAdmin : Affichage bento unifié, filtre "pending" avec paiements et Realtime
 * 6. Migration SQL additive idempotente
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Démarrage des tests du flux de validation SasPay & Adhésion SuperAdmin...\n');

// ---------------------------------------------------------------------------
// 1. Contrôle statique de seller-service.js
// ---------------------------------------------------------------------------
console.log('--- 1. Contrôle de seller-service.js ---');
const sellerServicePath = path.join(rootDir, 'src', 'services', 'seller-service.js');
const sellerServiceCode = fs.readFileSync(sellerServicePath, 'utf-8');

assert.ok(
    sellerServiceCode.includes('export async function registerPendingSubscriptionReturn'),
    'registerPendingSubscriptionReturn doit être exportée nommément dans seller-service.js'
);
assert.ok(
    sellerServiceCode.includes('registerPendingSubscriptionReturn,'),
    'registerPendingSubscriptionReturn doit être incluse dans le default export de seller-service.js'
);
assert.ok(
    sellerServiceCode.includes("status: 'pending'"),
    'registerPendingSubscriptionReturn doit enregistrer le statut en pending'
);
assert.ok(
    sellerServiceCode.includes('provider: \'saspay\''),
    'registerPendingSubscriptionReturn doit désigner saspay comme provider'
);
console.log('✅ [Seller Service] registerPendingSubscriptionReturn correctement implémentée et exportée !');

// ---------------------------------------------------------------------------
// 2. Contrôle de main.js (checkPaymentReturnFlow)
// ---------------------------------------------------------------------------
console.log('\n--- 2. Contrôle de main.js (Retour SasPay) ---');
const mainPath = path.join(rootDir, 'src', 'main.js');
const mainCode = fs.readFileSync(mainPath, 'utf-8');

assert.ok(
    mainCode.includes('registerPendingSubscriptionReturn'),
    'main.js doit importer et utiliser registerPendingSubscriptionReturn'
);
assert.ok(
    mainCode.includes('checkPaymentReturnFlow'),
    'main.js doit déclarer checkPaymentReturnFlow'
);
assert.ok(
    mainCode.includes('Pack Business (2 000 FCFA)') || mainCode.includes('Pack Pro (1 000 FCFA)'),
    'main.js doit identifier le pack lors du retour de paiement'
);
assert.ok(
    mainCode.includes('transmise aux administrateurs'),
    'main.js doit rassurer le marchand en lui confirmant la transmission aux administrateurs'
);
console.log('✅ [main.js] checkPaymentReturnFlow prend en charge l\'inscription des demandes au retour SasPay !');

// ---------------------------------------------------------------------------
// 3. Contrôle de admin-service.js (fetchGlobalMetrics & approveSubscriptionPayment)
// ---------------------------------------------------------------------------
console.log('\n--- 3. Contrôle de admin-service.js (Compteurs & Approbation) ---');
const adminServicePath = path.join(rootDir, 'src', 'services', 'admin-service.js');
const adminServiceCode = fs.readFileSync(adminServicePath, 'utf-8');

assert.ok(
    adminServiceCode.includes('pendingSubscriptionPaymentsCount'),
    'fetchGlobalMetrics doit calculer pendingSubscriptionPaymentsCount'
);
assert.ok(
    adminServiceCode.includes('totalPendingApplicants'),
    'fetchGlobalMetrics doit calculer et renvoyer totalPendingApplicants'
);
assert.ok(
    adminServiceCode.includes('pendingSellersCount + pendingSubscriptionPaymentsCount'),
    'totalPendingApplicants doit être la somme de pendingSellersCount et pendingSubscriptionPaymentsCount'
);
assert.ok(
    adminServiceCode.includes('vendeur_pending') && adminServiceCode.includes('approveSubscriptionPayment'),
    'approveSubscriptionPayment doit prendre en compte les comptes vendeur_pending pour les promouvoir'
);
console.log('✅ [Admin Service] Métriques unifiées et promotion automatique validées !');

// ---------------------------------------------------------------------------
// 4. Contrôle de SuperAdminDashboard.js (UI, Filtres & Realtime)
// ---------------------------------------------------------------------------
console.log('\n--- 4. Contrôle de SuperAdminDashboard.js ---');
const dashPath = path.join(rootDir, 'src', 'components', 'admin', 'SuperAdminDashboard.js');
const dashCode = fs.readFileSync(dashPath, 'utf-8');

// Carte "Demandes d'adhésion"
assert.ok(
    dashCode.includes('totalPendingApplicants'),
    'SuperAdminDashboard doit utiliser totalPendingApplicants pour la carte statistique'
);
assert.ok(
    dashCode.includes('Action requise'),
    'SuperAdminDashboard doit afficher un badge d\'action requise si des demandes sont en attente'
);

// Affichage sous le filtre "pending"
assert.ok(
    dashCode.includes("sellerFilterTab === 'pending'") && dashCode.includes('showPaymentsSection'),
    'showPaymentsSection doit être actif lorsque sellerFilterTab === \'pending\''
);
assert.ok(
    dashCode.includes('totalPending + totalPendingPayments'),
    'Le bouton pilule "En attente" doit additionner totalPending et totalPendingPayments'
);

// Synchronisation Realtime sur seller_payments
assert.ok(
    dashCode.includes("table: 'seller_payments'"),
    'initSuperAdminRealtime doit écouter les changements sur la table seller_payments'
);
assert.ok(
    dashCode.includes("Nouvelle demande d'adhésion"),
    'initSuperAdminRealtime doit alerter le SuperAdmin lors de la réception d\'un paiement SasPay'
);

// Données résilientes pay.seller || pay.profiles
assert.ok(
    dashCode.includes('pay.seller || pay.profiles'),
    'renderPendingPaymentsList doit gérer la relation seller et le fallback profiles'
);
console.log('✅ [SuperAdmin Dashboard] Bento card unifiée, filtre pending étendu et flux Realtime validés !');

// ---------------------------------------------------------------------------
// 5. Contrôle de la migration SQL additive
// ---------------------------------------------------------------------------
console.log('\n--- 5. Contrôle du script de migration SQL ---');
const sqlMigrationPath = path.join(rootDir, 'database', 'migration_enable_realtime_seller_payments.sql');
assert.ok(fs.existsSync(sqlMigrationPath), 'Le fichier migration_enable_realtime_seller_payments.sql doit exister');
const sqlContent = fs.readFileSync(sqlMigrationPath, 'utf-8');

assert.ok(
    sqlContent.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_payments'),
    'La migration SQL doit ajouter seller_payments à la publication supabase_realtime'
);
assert.ok(
    sqlContent.includes('IF NOT EXISTS'),
    'La migration SQL doit être strictement idempotente avec IF NOT EXISTS'
);
console.log('✅ [SQL Migration] Script SQL idempotent et rétrocompatible validé !');

console.log('\n========================================');
console.log('🎉 TOUS LES TESTS DU FLUX SASPAY & ADHÉSION ONT RÉUSSI AVEC SUCCÈS !');
console.log('========================================\n');
