/**
 * Suite de tests unitaires pour le routeur d'URL Campus Market.
 * Valide la résolution des liens partagés de boutique (#shop, #seller, ?shop=) et backoffice.
 */

import assert from 'node:assert/strict';
import { resolveRoute } from '../src/utils/router.js';

console.log('🧪 Démarrage des tests unitaires du routeur d\'URL...');

// Test 1: Ancien lien partagé #seller/UUID (cas critique rapporté par l'utilisateur)
const r1 = resolveRoute('#seller/7c914185-e3ef-4c7f-8931-a660f7885b65');
assert.equal(r1.view, 'shop', 'Le lien #seller/UUID doit ouvrir la vitrine shop et NON le backoffice seller');
assert.equal(r1.params.sellerId, '7c914185-e3ef-4c7f-8931-a660f7885b65', 'Le sellerId doit être correctement extrait');
console.log('✅ [#seller/UUID] Résolution rétroactive vers la vitrine marchande validée !');

// Test 2: #seller/UUID avec slash terminal ou query param WhatsApp
const r2 = resolveRoute('#seller/7c914185-e3ef-4c7f-8931-a660f7885b65/?utm_source=whatsapp');
assert.equal(r2.view, 'shop');
assert.equal(r2.params.sellerId, '7c914185-e3ef-4c7f-8931-a660f7885b65', 'Le sellerId doit être nettoyé du slash et des query params');
console.log('✅ [#seller/UUID/?query] Nettoyage des trailing slashes et paramètres URL validé !');

// Test 3: Nouveau format standard #shop/UUID
const r3 = resolveRoute('#shop/7c914185-e3ef-4c7f-8931-a660f7885b65');
assert.equal(r3.view, 'shop');
assert.equal(r3.params.sellerId, '7c914185-e3ef-4c7f-8931-a660f7885b65');
console.log('✅ [#shop/UUID] Format standard de vitrine marchande validé !');

// Test 4: Tolérance #vendeur/UUID
const r4 = resolveRoute('#vendeur/7c914185-e3ef-4c7f-8931-a660f7885b65');
assert.equal(r4.view, 'shop');
assert.equal(r4.params.sellerId, '7c914185-e3ef-4c7f-8931-a660f7885b65');
console.log('✅ [#vendeur/UUID] Tolérance de l\'alias français validée !');

// Test 5: Query param direct (?shop=UUID)
const r5 = resolveRoute('', '?shop=7c914185-e3ef-4c7f-8931-a660f7885b65');
assert.equal(r5.view, 'shop');
assert.equal(r5.params.sellerId, '7c914185-e3ef-4c7f-8931-a660f7885b65');
console.log('✅ [?shop=UUID] Résolution par paramètre URL de recherche validée !');

// Test 6: Espace Vendeur Privé (#seller sans identifiant UUID)
const r6 = resolveRoute('#seller');
assert.equal(r6.view, 'seller', '#seller sans UUID doit ouvrir l\'espace de gestion privé');
assert.deepEqual(r6.params, {});

const r6b = resolveRoute('#seller?payment=success&session_id=123');
assert.equal(r6b.view, 'seller', '#seller avec query de retour paiement doit rester sur seller');
console.log('✅ [#seller] Préservation stricte du Backoffice Vendeur validée !');

// Test 7: SuperAdmin (#admin)
const r7 = resolveRoute('#admin');
assert.equal(r7.view, 'admin');
console.log('✅ [#admin] Accès SuperAdmin validé !');

// Test 8: Commandes (#orders)
const r8 = resolveRoute('#orders');
assert.equal(r8.view, 'orders');
console.log('✅ [#orders] Suivi des commandes validé !');

// Test 9: Fiche produit (#product/UUID)
const r9 = resolveRoute('#product/449ec51b-8bd5-4311-afb6-fdada19dbc0e');
assert.equal(r9.view, 'product');
assert.equal(r9.params.productId, '449ec51b-8bd5-4311-afb6-fdada19dbc0e');
console.log('✅ [#product/UUID] Fiche produit deep-link validée !');

// Test 10: Catalogue par défaut
const r10 = resolveRoute('');
assert.equal(r10.view, 'catalog');
const r10b = resolveRoute('#');
assert.equal(r10b.view, 'catalog');
console.log('✅ [Catalogue] Repli par défaut validé !');

console.log('🎉 TOUS LES TESTS DU ROUTEUR ONT RÉUSSI AVEC SUCCÈS !');
