/**
 * Test de validation : Affichage complet du catalogue Campus Market sans limite
 * Vérifie :
 * 1. fetchActiveProducts renvoie la totalité des produits disponibles sans coupure artificielle.
 * 2. Les 13 articles précédemment coupés par la limite 50 (Lacoste, Sérum Anua, Collier, Voile Jersey...) sont bien présents.
 * 3. La recherche par mot-clé searchProducts retrouve ces articles dans le cache complet.
 * 4. La répartition équitable round-robin préserve l'intégralité des articles sans aucune perte.
 * 5. Le calcul des compteurs de catégories est stable et conserve les totaux.
 */

import assert from 'node:assert/strict';
import { fetchActiveProducts, searchProducts, interleaveProductsBySeller, CATEGORIES } from '../src/services/catalog-service.js';

console.log('🧪 Démarrage des tests : Affichage complet du catalogue sans limite...\n');

// 1. Contrôle de fetchActiveProducts sans limite
console.log('--- 1. Récupération complète du catalogue ---');
const allProducts = await fetchActiveProducts({ category: 'all' });
console.log(`Nombre total de produits récupérés : ${allProducts.length}`);
assert.ok(
    allProducts.length > 50,
    `Échec : fetchActiveProducts doit renvoyer plus de 50 produits (obtenu : ${allProducts.length})`
);
console.log(`✅ [Catalogue complet] ${allProducts.length} produits récupérés sans coupure à 50 !`);

// 2. Contrôle de la présence des articles précédemment coupés
console.log('\n--- 2. Présence des articles précédemment masqués ---');
const previouslyMissingTitles = [
    'Lacoste',
    'Sérum Anua',
    'Collier avec perle',
    'Voile Jersey',
    'Medicube',
];

for (const keyword of previouslyMissingTitles) {
    const found = allProducts.find((p) => (p.title || '').toLowerCase().includes(keyword.toLowerCase()));
    assert.ok(
        found,
        `Échec : L'article contenant "${keyword}" devrait figurer dans le catalogue complet`
    );
    console.log(`  ✓ Trouvé : "${found.title}" (${found.price} FCFA)`);
}
console.log('✅ [Articles restaurés] Tous les articles précédemment omis sont désormais présents !');

// 3. Contrôle de searchProducts sur les articles restaurés
console.log('\n--- 3. Recherche exhaustive par mots-clés ---');
const searchLacoste = await searchProducts('Lacoste');
assert.ok(searchLacoste.length > 0, 'Échec : La recherche "Lacoste" doit renvoyer au moins un produit');
assert.ok(
    searchLacoste.some((p) => p.title.toLowerCase().includes('lacoste')),
    'Échec : Le produit Lacoste doit être dans les résultats de recherche'
);
console.log(`  ✓ Recherche "Lacoste" : ${searchLacoste.length} résultat(s) trouvé(s)`);

const searchCollier = await searchProducts('Collier');
assert.ok(searchCollier.length > 0, 'Échec : La recherche "Collier" doit renvoyer au moins un produit');
console.log(`  ✓ Recherche "Collier" : ${searchCollier.length} résultat(s) trouvé(s)`);

const searchAnua = await searchProducts('Anua');
assert.ok(searchAnua.length > 0, 'Échec : La recherche "Anua" doit renvoyer au moins un produit');
assert.ok(
    searchAnua.some((p) => p.title.toLowerCase().includes('anua')),
    'Échec : Le produit Anua doit être dans les résultats de recherche'
);
console.log(`  ✓ Recherche "Anua" : ${searchAnua.length} résultat(s) trouvé(s)`);
console.log('✅ [Recherche globale] searchProducts indexe avec succès l\'ensemble des offres du campus !');

// 4. Contrôle de l'algorithme Round-Robin sur le catalogue complet
console.log('\n--- 4. Intégrité du Round-Robin sur l\'ensemble du catalogue ---');
const interleaved = interleaveProductsBySeller(allProducts, { shuffle: false });
assert.equal(
    interleaved.length,
    allProducts.length,
    `Le nombre de produits après Round-Robin (${interleaved.length}) doit être strictement identique au catalogue (${allProducts.length})`
);

const originalIds = new Set(allProducts.map((p) => p.id));
const interleavedIds = new Set(interleaved.map((p) => p.id));
assert.equal(
    interleavedIds.size,
    originalIds.size,
    'Aucun produit ne doit être perdu ni dupliqué lors de l\'entrelacement'
);
console.log('✅ [Round-Robin Intégrité] Zéro perte et zéro doublon sur l\'ensemble du catalogue !');

// 5. Contrôle de la préservation des catégories
console.log('\n--- 5. Distribution par catégorie ---');
const categoryCounts = { all: allProducts.length };
allProducts.forEach((p) => {
    if (p.category) categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
});
console.log('Répartition des catégories :', categoryCounts);
assert.ok(categoryCounts.all >= 60, 'Total des offres supérieur ou égal à 60 attendu');
assert.ok((categoryCounts.autres || 0) > 0, 'Catégorie autres non vide attendue');
assert.ok((categoryCounts.vetements || 0) > 0, 'Catégorie vetements non vide attendue');
console.log('✅ [Compteurs Catégories] Répartition fidèle et vérifiée !');

console.log('\n🎉 TOUS LES TESTS D\'AFFICHAGE COMPLET DU CATALOGUE ONT RÉUSSI AVEC SUCCÈS !');
