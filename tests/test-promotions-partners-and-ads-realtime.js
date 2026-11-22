/**
 * Test Suite : Correction Promouvoir (7j, pas d'updated_at cassant),
 * Partenaires (fallback whatsapp_phone), et Validation Annonces Étudiantes Admin (Realtime, 5j, 16:9)
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Démarrage des tests : Promouvoir, Partenaires & Annonces Étudiantes...\n');

let passedTests = 0;

// Test 1 : Vérification de quota-service.js (Pas de updated_at sur products, maintien de 7 jours)
console.log('--- Test 1 : quota-service.js (Promotions Produits 7j sans updated_at cassant) ---');
const quotaServiceContent = fs.readFileSync(path.join(rootDir, 'src/services/quota-service.js'), 'utf-8');

// Doit maintenir 7 jours pour les produits
assert.ok(
    quotaServiceContent.includes('7 * 24 * 60 * 60 * 1000'),
    'La durée de promotion produit doit rester fixée à 7 jours (7 * 24 * 60 * 60 * 1000).'
);

// Ne doit pas contenir updated_at dans les updates de products
assert.ok(
    !quotaServiceContent.includes("updated_at: new Date().toISOString()"),
    'quota-service.js ne doit pas inclure updated_at dans les appels .update(...) sur products.'
);
console.log('✅ Test 1 réussi : Promotion produit configurée à 7 jours et exempte de colonne updated_at cassante.');
passedTests++;

// Test 2 : Vérification de admin-service.js (addPartner / updatePartner résilients avec repli whatsapp_phone)
console.log('\n--- Test 2 : admin-service.js (Ajout & Mise à jour Partenaires avec repli résilient) ---');
const adminServiceContent = fs.readFileSync(path.join(rootDir, 'src/services/admin-service.js'), 'utf-8');

assert.ok(
    adminServiceContent.includes('ALLOWED_CATEGORIES'),
    'addPartner doit valider les catégories autorisées.'
);

assert.ok(
    adminServiceContent.includes("error.message?.includes('whatsapp_phone')") &&
    adminServiceContent.includes("const { whatsapp_phone, ...fallbackPayload } = payload;"),
    'addPartner et updatePartner doivent posséder un repli résilient sans whatsapp_phone en cas d absence de colonne.'
);
console.log('✅ Test 2 réussi : addPartner et updatePartner protégés contre les erreurs de schéma colonne manquante.');
passedTests++;

// Test 3 : Vérification de StudentAdView.js (status: a_valider, 5 jours, 250 FCFA)
console.log('\n--- Test 3 : StudentAdView.js (Statut initial a_valider et détails conformes) ---');
const studentAdViewContent = fs.readFileSync(path.join(rootDir, 'src/components/StudentAdView.js'), 'utf-8');

assert.ok(
    studentAdViewContent.includes("status: 'a_valider'"),
    "La soumission d'une annonce étudiante doit définir status: 'a_valider' pour transmission immédiate au SuperAdmin."
);
assert.ok(
    studentAdViewContent.includes("aspect-[16/9]"),
    "StudentAdView doit contraindre et recommander le ratio 16:9 pour l'image."
);
console.log('✅ Test 3 réussi : Annonce étudiante transmise en statut a_valider avec format 16:9.');
passedTests++;

// Test 4 : Vérification de SuperAdminDashboard.js (Realtime, Filtres, Prévisualisation 16:9 et Validation 5j)
console.log('\n--- Test 4 : SuperAdminDashboard.js (Realtime, Modération et Affichage 16:9) ---');
const superAdminContent = fs.readFileSync(path.join(rootDir, 'src/components/admin/SuperAdminDashboard.js'), 'utf-8');

// Vérification Realtime
assert.ok(
    superAdminContent.includes("table: 'advertisements'") &&
    superAdminContent.includes("table: 'student_announcements'"),
    'SuperAdminDashboard doit souscrire en temps réel aux tables advertisements et student_announcements.'
);

// Vérification comptage en attente
assert.ok(
    superAdminContent.includes("a.status === 'a_valider' || a.status === 'paiement_en_attente'"),
    'Le badge et le filtre des annonces doivent prendre en compte a_valider et paiement_en_attente.'
);

// Vérification prévisualisation 16:9
assert.ok(
    superAdminContent.includes("aspect-[16/9]") &&
    superAdminContent.includes("16:9"),
    "L'onglet Annonces doit afficher une prévisualisation 16:9 de l'affiche publicitaire."
);

// Vérification affichage des détails étudiants
assert.ok(
    superAdminContent.includes("mailto:") &&
    superAdminContent.includes("Annonce Étudiante"),
    "L'onglet Annonces doit afficher le nom, prénom et email de l'étudiant avec lien mailto:."
);

// Vérification validation 5 jours pour les étudiants et insertion carrousel
assert.ok(
    superAdminContent.includes("carousel_slides") &&
    superAdminContent.includes("durationDays = isStudent ? 5 :"),
    "La validation d'une annonce étudiante doit appliquer 5 jours et l'insérer dans carousel_slides."
);
console.log('✅ Test 4 réussi : SuperAdminDashboard synchronisé en temps réel avec prévisualisation 16:9 et publication 5j.');
passedTests++;

// Test 5 : Vérification de la migration SQL additive
console.log('\n--- Test 5 : Migration SQL additive et idempotente ---');
const migrationPath = path.join(rootDir, 'database/migration_fix_all_promotions_and_partner_errors.sql');
assert.ok(fs.existsSync(migrationPath), 'Le fichier de migration SQL doit exister.');
const migrationContent = fs.readFileSync(migrationPath, 'utf-8');

assert.ok(
    migrationContent.includes('ALTER TABLE IF EXISTS public.products') &&
    migrationContent.includes('ADD COLUMN IF NOT EXISTS updated_at'),
    'La migration SQL doit ajouter la colonne updated_at sur products de manière idempotente.'
);

assert.ok(
    migrationContent.includes('ALTER TABLE IF EXISTS public.partners') &&
    migrationContent.includes('ADD COLUMN IF NOT EXISTS whatsapp_phone'),
    'La migration SQL doit ajouter whatsapp_phone sur partners de manière idempotente.'
);

assert.ok(
    migrationContent.includes('ALTER PUBLICATION supabase_realtime ADD TABLE public.student_announcements;') ||
    migrationContent.includes("pubname = 'supabase_realtime'"),
    'La migration SQL doit activer Realtime sur student_announcements et advertisements.'
);
console.log('✅ Test 5 réussi : Migration SQL validée et entièrement idempotente.');
passedTests++;

console.log(`\n🎉 Tous les tests ont réussi avec succès (${passedTests}/5) !`);
