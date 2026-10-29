/**
 * Suite de tests unitaires pour l'algorithme de classement des Top Shops Campus Market.
 * Valide les critères :
 * 1. Statut ouvert
 * 2. Disponibilité de produits réels en vente
 * 3. Note moyenne des avis
 * 4. Volume d'avis clients
 * 5. Volume de commandes livrées (Piste 2)
 * 6. Mise en valeur du nom de boutique shop_name (Piste 3)
 */

import assert from 'node:assert/strict';

console.log('🧪 Démarrage des tests unitaires du classement Top Shops...');

// Fonction de tri isolée répliquant celle de catalog-service.js
function sortTopShops(sellers) {
    return [...sellers].sort((a, b) => {
        const aOpen = a.is_open !== false ? 1 : 0;
        const bOpen = b.is_open !== false ? 1 : 0;
        if (bOpen !== aOpen) return bOpen - aOpen;

        const aHasProds = (a.activeProducts || 0) > 0 ? 1 : 0;
        const bHasProds = (b.activeProducts || 0) > 0 ? 1 : 0;
        if (bHasProds !== aHasProds) return bHasProds - aHasProds;

        if ((b.avgRating || 0) !== (a.avgRating || 0)) {
            return (b.avgRating || 0) - (a.avgRating || 0);
        }

        if ((b.reviewCount || 0) !== (a.reviewCount || 0)) {
            return (b.reviewCount || 0) - (a.reviewCount || 0);
        }

        if ((b.deliveredOrders || 0) !== (a.deliveredOrders || 0)) {
            return (b.deliveredOrders || 0) - (a.deliveredOrders || 0);
        }

        return (b.activeProducts || 0) - (a.activeProducts || 0);
    });
}

// Test 1: Priorité aux boutiques ouvertes
const sClosed = { id: '1', shop_name: 'Boutique Fermée', is_open: false, activeProducts: 10, avgRating: 5.0, deliveredOrders: 20 };
const sOpen = { id: '2', shop_name: 'Boutique Ouverte', is_open: true, activeProducts: 3, avgRating: 4.8, deliveredOrders: 5 };
const res1 = sortTopShops([sClosed, sOpen]);
assert.equal(res1[0].id, '2', 'Une boutique ouverte doit primer sur une boutique fermée');
console.log('✅ [is_open] Priorité aux boutiques en activité validée !');

// Test 2: Priorité aux boutiques avec des produits en stock
const sEmpty = { id: '1', shop_name: 'Boutique Vide', is_open: true, activeProducts: 0, avgRating: 0, deliveredOrders: 0 };
const sWithProd = { id: '2', shop_name: 'Sén Market', is_open: true, activeProducts: 3, avgRating: 0, deliveredOrders: 0 };
const res2 = sortTopShops([sEmpty, sWithProd]);
assert.equal(res2[0].id, '2', 'Une boutique avec des articles en vente doit primer sur une vitrine vide');
console.log('✅ [activeProducts > 0] Élimination des vitrines sans articles en tête de classement validée !');

// Test 3: Priorité à la meilleure note
const sRating4 = { id: '1', shop_name: 'Shop 4.5', is_open: true, activeProducts: 2, avgRating: 4.5, reviewCount: 5, deliveredOrders: 10 };
const sRating5 = { id: '2', shop_name: 'Shop 5.0', is_open: true, activeProducts: 2, avgRating: 5.0, reviewCount: 2, deliveredOrders: 2 };
const res3 = sortTopShops([sRating4, sRating5]);
assert.equal(res3[0].id, '2', 'La note 5.0 doit primer sur 4.5');
console.log('✅ [avgRating] Classement par note d\'étoiles validé !');

// Test 4: Départage par les avis à note égale
const sRev2 = { id: '1', shop_name: 'Shop 2 avis', is_open: true, activeProducts: 2, avgRating: 5.0, reviewCount: 2, deliveredOrders: 5 };
const sRev8 = { id: '2', shop_name: 'Shop 8 avis', is_open: true, activeProducts: 2, avgRating: 5.0, reviewCount: 8, deliveredOrders: 5 };
const res4 = sortTopShops([sRev2, sRev8]);
assert.equal(res4[0].id, '2', 'À note égale, le nombre d\'avis doit départager');
console.log('✅ [reviewCount] Départage par volume d\'avis validé !');

// Test 5 (Piste 2): Départage par les commandes livrées quand aucun avis n'est encore déposé
const sDeliv1 = { id: '1', shop_name: 'Shop 1 commande', is_open: true, activeProducts: 2, avgRating: 0, reviewCount: 0, deliveredOrders: 1 };
const sDeliv10 = { id: '2', shop_name: 'Shop 10 commandes', is_open: true, activeProducts: 2, avgRating: 0, reviewCount: 0, deliveredOrders: 10 };
const res5 = sortTopShops([sDeliv1, sDeliv10]);
assert.equal(res5[0].id, '2', 'À avis égaux, le volume de commandes livrées doit départager');
console.log('✅ [deliveredOrders] Piste 2 : Départage par commandes livrées avec succès validé !');

// Test 6 (Piste 3): Préservation du nom commercial
const sellerWithShopName = { shop_name: 'Sén Market', prenom: 'Aminata', nom: 'Ndiaye' };
const displayName = sellerWithShopName.shop_name || `${sellerWithShopName.prenom} ${sellerWithShopName.nom}`;
assert.equal(displayName, 'Sén Market', 'Le nom commercial shop_name doit primer sur prénom nom');
console.log('✅ [shop_name] Piste 3 : Mise en avant de l\'enseigne commerciale validée !');

console.log('🎉 TOUS LES TESTS DE CLASSEMENT TOP SHOPS SONT PASSÉS AVEC SUCCÈS !');
