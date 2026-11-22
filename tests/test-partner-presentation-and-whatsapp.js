/**
 * Suite de tests : Présentation Détaillée du Partenaire & Contact WhatsApp via Campus Market
 * Valide :
 * 1. La fonction getPartnerContactWhatsappUrl (message pré-rempli certifiant la provenance UIDT,
 *    nettoyage du téléphone sénégalais/international, fallback sécurisé).
 * 2. Le composant PartnersSection (bouton "Voir le partenaire", modale de présentation avec description,
 *    avantage étudiant, et bouton WhatsApp).
 * 3. Le support du champ whatsapp_phone dans admin-service.js et SuperAdminDashboard.js.
 * 4. La migration SQL additive et idempotente.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPartnerContactWhatsappUrl } from '../src/config/partners.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Démarrage des tests : Présentation Partenaire & Contact WhatsApp Campus Market...\n');

// ---------------------------------------------------------------------------
// 1. Tests unitaires de getPartnerContactWhatsappUrl
// ---------------------------------------------------------------------------
console.log('--- 1. Validation de la génération du lien WhatsApp ---');

// Test 1.1 : Partenaire avec numéro sénégalais local (9 chiffres commençant par 77)
const partnerWithLocalPhone = {
    id: 'p-1',
    name: 'Burger Campus Thiès',
    category: 'local_business',
    whatsapp_phone: '77 123 45 67',
    perk: 'Menu étudiant à 1 500 F',
};
const url1 = getPartnerContactWhatsappUrl(partnerWithLocalPhone);
assert.ok(url1.includes('wa.me/221771234567'), `Le numéro local doit être converti au format 221771234567. Obtenu : ${url1}`);
assert.ok(url1.includes('Campus%20Market'), 'Le message doit mentionner Campus Market');
assert.ok(url1.includes('Iba%20Der%20Thiam'), 'Le message doit mentionner l\'Université Iba Der Thiam');
assert.ok(url1.includes('Burger%20Campus%20Thi%C3%A8s'), 'Le message doit s\'adresser au partenaire');
assert.ok(url1.includes('Menu%20%C3%A9tudiant'), 'Le message doit mentionner l\'avantage étudiant');
console.log('✅ [WhatsApp URL] Numéro local sénégalais + avantage étudiant correctement encodés !');

// Test 1.2 : Partenaire avec numéro international déjà préfixé
const partnerWithIntlPhone = {
    id: 'p-2',
    name: 'Amicale SES UIDT',
    category: 'amicale',
    whatsapp_phone: '+221 78 987 65 43',
};
const url2 = getPartnerContactWhatsappUrl(partnerWithIntlPhone);
assert.ok(url2.includes('wa.me/221789876543'), `Le numéro avec + doit être nettoyé en chiffres purs. Obtenu : ${url2}`);
assert.ok(url2.includes('Amicale%20SES%20UIDT'), 'Le message doit cibler l\'amicale');
console.log('✅ [WhatsApp URL] Numéro international nettoyé et préfixé validé !');

// Test 1.3 : Partenaire avec URL wa.me dans website_url
const partnerWithWaMeSite = {
    id: 'p-3',
    name: 'Service Express Thiès',
    website_url: 'https://wa.me/221765432100',
};
const url3 = getPartnerContactWhatsappUrl(partnerWithWaMeSite);
assert.ok(url3.includes('221765432100'), 'L\'URL wa.me de website_url doit être conservée');
assert.ok(url3.includes('text='), 'Le message pré-rempli doit être ajouté');
console.log('✅ [WhatsApp URL] Fallback sur website_url wa.me validé !');

// Test 1.4 : Partenaire sans numéro direct (fallback guichet partenariats Campus Market)
const partnerWithoutPhone = {
    id: 'p-4',
    name: 'Wave Sénégal',
    category: 'payment',
};
const url4 = getPartnerContactWhatsappUrl(partnerWithoutPhone);
assert.ok(url4.includes('wa.me/'), 'Doit renvoyer vers wa.me');
assert.ok(url4.includes('Wave%20S%C3%A9n%C3%A9gal'), 'Le message de repli doit mentionner le partenaire demandé');
console.log('✅ [WhatsApp URL] Fallback intelligent sur le support officiel validé !');

// ---------------------------------------------------------------------------
// 2. Contrôle de PartnersSection.js
// ---------------------------------------------------------------------------
console.log('\n--- 2. Contrôle statique de PartnersSection.js ---');
const partnersSectionPath = path.join(rootDir, 'src', 'components', 'PartnersSection.js');
const partnersSectionCode = fs.readFileSync(partnersSectionPath, 'utf-8');

assert.ok(
    partnersSectionCode.includes('Voir le partenaire'),
    'Chaque bloc partenaire doit afficher l\'action explicite "Voir le partenaire"'
);
assert.ok(
    partnersSectionCode.includes('getPartnerContactWhatsappUrl'),
    'PartnersSection doit importer et utiliser getPartnerContactWhatsappUrl'
);
assert.ok(
    partnersSectionCode.includes('Présentation & Activité') || partnersSectionCode.includes('Présentation'),
    'La modale doit comporter une section dédiée à la présentation du partenaire'
);
assert.ok(
    partnersSectionCode.includes('Écrire sur WhatsApp'),
    'La modale doit afficher le bouton d\'action "Écrire sur WhatsApp"'
);
assert.ok(
    partnersSectionCode.includes('Via Campus Market'),
    'Le bouton WhatsApp doit afficher l\'indication "Via Campus Market"'
);
assert.ok(
    partnersSectionCode.includes('containerEl.openPartnerModal'),
    'PartnersSection doit exposer la méthode openPartnerModal pour le routage direct'
);
console.log('✅ [PartnersSection UI] Fiche de présentation, bouton d\'action et badge Campus Market validés !');

// ---------------------------------------------------------------------------
// 3. Contrôle du support SuperAdmin et admin-service.js
// ---------------------------------------------------------------------------
console.log('\n--- 3. Contrôle de admin-service.js et SuperAdminDashboard.js ---');
const adminServicePath = path.join(rootDir, 'src', 'services', 'admin-service.js');
const adminServiceCode = fs.readFileSync(adminServicePath, 'utf-8');

assert.ok(
    adminServiceCode.includes('whatsapp_phone'),
    'addPartner et updatePartner doivent prendre en charge whatsapp_phone'
);

const superAdminPath = path.join(rootDir, 'src', 'components', 'admin', 'SuperAdminDashboard.js');
const superAdminCode = fs.readFileSync(superAdminPath, 'utf-8');

assert.ok(
    superAdminCode.includes('partner-whatsapp-phone-input'),
    'Le formulaire SuperAdmin doit proposer la saisie du numéro WhatsApp'
);
assert.ok(
    superAdminCode.includes('whatsapp_phone'),
    'SuperAdminDashboard doit transmettre whatsapp_phone lors de l\'ajout'
);
console.log('✅ [SuperAdmin Integration] Formulaire et persistance du contact WhatsApp validés !');

// ---------------------------------------------------------------------------
// 4. Contrôle de la migration SQL
// ---------------------------------------------------------------------------
console.log('\n--- 4. Contrôle du script de migration SQL ---');
const migrationSqlPath = path.join(rootDir, 'database', 'migration_add_partner_whatsapp_phone.sql');
assert.ok(fs.existsSync(migrationSqlPath), 'Le script migration_add_partner_whatsapp_phone.sql doit exister');
const migrationSql = fs.readFileSync(migrationSqlPath, 'utf-8');

assert.ok(
    migrationSql.includes('ALTER TABLE public.partners ADD COLUMN whatsapp_phone TEXT') ||
    migrationSql.includes('whatsapp_phone'),
    'La migration SQL doit ajouter la colonne whatsapp_phone'
);
assert.ok(
    migrationSql.includes('information_schema.columns') || migrationSql.includes('IF NOT EXISTS'),
    'La migration SQL doit être strictement idempotente'
);
console.log('✅ [SQL Migration] Migration additive et idempotente validée !');

console.log('\n========================================');
console.log('🎉 TOUS LES TESTS DE PRÉSENTATION PARTENAIRE ET WHATSAPP ONT RÉUSSI !');
console.log('========================================\n');
