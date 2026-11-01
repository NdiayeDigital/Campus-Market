/**
 * Test unitaire de l'Approche B (Round-Robin par boutique et diversification aléatoire).
 * Vérifie que les produits sont équitablement distribués entre les différentes boutiques
 * pour garantir que chaque vendeur dispose d'une visibilité sur la vitrine d'accueil.
 */

import assert from 'node:assert/strict';
import { interleaveProductsBySeller } from '../src/services/catalog-service.js';

console.log('🧪 Démarrage des tests unitaires de l\'Approche B (Round-Robin par boutique)...');

// 1. Cas limites : listes vides, nulles ou à 1 élément
assert.deepEqual(interleaveProductsBySeller(null), []);
assert.deepEqual(interleaveProductsBySeller(undefined), []);
assert.deepEqual(interleaveProductsBySeller([]), []);
const singleProd = [{ id: 'p1', title: 'Chemise', seller_id: 's1' }];
assert.deepEqual(interleaveProductsBySeller(singleProd), singleProd);
console.log('✅ [Edge Cases] Gestion sécurisée des listes vides ou unitaires validée !');

// 2. Un seul vendeur avec plusieurs produits (doit rester inchangé)
const singleSellerProds = [
    { id: 'p1', title: 'Article 1', seller_id: 's1' },
    { id: 'p2', title: 'Article 2', seller_id: 's1' },
    { id: 'p3', title: 'Article 3', seller_id: 's1' },
];
const resSingle = interleaveProductsBySeller(singleSellerProds);
assert.equal(resSingle.length, 3);
assert.equal(resSingle[0].id, 'p1');
assert.equal(resSingle[1].id, 'p2');
assert.equal(resSingle[2].id, 'p3');
console.log('✅ [Single Seller] Conservation stricte des produits d\'un vendeur unique validée !');

// 3. Plusieurs vendeurs avec distribution inégale (A: 4, B: 2, C: 1) sans shuffle
const prodsMulti = [
    { id: 'a1', seller_id: 'seller_a', title: 'A1' },
    { id: 'a2', seller_id: 'seller_a', title: 'A2' },
    { id: 'a3', seller_id: 'seller_a', title: 'A3' },
    { id: 'a4', seller_id: 'seller_a', title: 'A4' },
    { id: 'b1', seller_id: 'seller_b', title: 'B1' },
    { id: 'b2', seller_id: 'seller_b', title: 'B2' },
    { id: 'c1', seller_id: 'seller_c', title: 'C1' },
];

const resDeterministic = interleaveProductsBySeller(prodsMulti, { shuffle: false });
assert.equal(resDeterministic.length, 7, 'Le nombre total de produits doit rester identique');

// Tour 1 : 1 produit de chaque boutique (a1, b1, c1)
assert.equal(resDeterministic[0].id, 'a1');
assert.equal(resDeterministic[1].id, 'b1');
assert.equal(resDeterministic[2].id, 'c1');

// Tour 2 : 2e produit des boutiques ayant encore des articles (a2, b2)
assert.equal(resDeterministic[3].id, 'a2');
assert.equal(resDeterministic[4].id, 'b2');

// Tour 3 & 4 : articles restants de la boutique A (a3, a4)
assert.equal(resDeterministic[5].id, 'a3');
assert.equal(resDeterministic[6].id, 'a4');
console.log('✅ [Round-Robin Déterministe] Alternance équitable Tour 1 (A1, B1, C1), Tour 2 (A2, B2), Tour 3+ validée !');

// 4. Test avec permutation aléatoire (shuffle: true)
const resShuffled = interleaveProductsBySeller(prodsMulti, { shuffle: true });
assert.equal(resShuffled.length, 7, 'Aucun produit ne doit être perdu lors du shuffle');

// Vérifier que tous les identifiants d'origine sont présents (zéro perte, zéro doublon)
const originalIds = new Set(prodsMulti.map((p) => p.id));
const shuffledIds = new Set(resShuffled.map((p) => p.id));
assert.deepEqual(originalIds, shuffledIds, 'Tous les produits d\'origine doivent être conservés');

// Vérifier que les 3 premiers articles proviennent obligatoirement de 3 vendeurs distincts !
const firstThreeSellers = new Set(resShuffled.slice(0, 3).map((p) => p.seller_id));
assert.equal(firstThreeSellers.size, 3, 'Les 3 premiers articles doivent provenir des 3 boutiques différentes');

// Vérifier que pour un même vendeur, l'ordre chronologique individuel est strictement respecté
const sellerAOrder = resShuffled.filter((p) => p.seller_id === 'seller_a').map((p) => p.id);
assert.deepEqual(sellerAOrder, ['a1', 'a2', 'a3', 'a4'], 'L\'ordre de récence interne à chaque vendeur doit être conservé');

console.log('✅ [Shuffle Aléatoire & Diversification] Vitrine équitable avec vendeurs distincts au 1er écran validée !');
console.log('🎉 TOUS LES TESTS UNITAIRES DE L\'APPROCHE B SONT PASSÉS AVEC SUCCÈS !');
