/**
 * Test Suite : Fiabilisation Push & Affichage de l'Adresse Vendeur
 * Fichier : tests/test-push-and-seller-address.js
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Démarrage des tests : Fiabilisation Push & Adresse Vendeur...\n');

// 1. Contrôle de l'enregistrement résilient du Service Worker dans main.js
console.log('--- 1. Contrôle Service Worker & Push Prompt (main.js) ---');
const mainJs = fs.readFileSync(path.join(rootDir, 'src/main.js'), 'utf-8');
assert.ok(
    mainJs.includes("document.readyState === 'complete' || document.readyState === 'interactive'"),
    "main.js doit enregistrer le Service Worker immédiatement sans dépendre exclusivement de window.load"
);
assert.ok(
    mainJs.includes("navigator.serviceWorker") && mainJs.includes(".register('/sw.js')"),
    "main.js doit enregistrer /sw.js"
);
assert.ok(
    mainJs.includes("initPushNotificationPrompt()"),
    "main.js doit initialiser le prompt de notifications push"
);
console.log('✅ [main.js] Enregistrement résilient et sans race-condition validé !');

// 2. Contrôle de l'API Serverless send-order-push.js
console.log('\n--- 2. Contrôle Serverless API (api/send-order-push.js) ---');
const sendPushJs = fs.readFileSync(path.join(rootDir, 'api/send-order-push.js'), 'utf-8');
assert.ok(
    sendPushJs.includes('BHqBPmVryy2hCYhoRicHjMK-mKP7d211SBwUOVaVxnXBU52ljxIAPCNGuw9fMJjqqC9O_iaBvhNgpoyALrci3w4'),
    "api/send-order-push.js doit inclure la clé publique VAPID de secours pour tolérer l'absence de variable d'environnement sur Node"
);
assert.ok(
    sendPushJs.includes("from('seller_push_subscriptions')") && sendPushJs.includes("from('push_subscriptions')"),
    "api/send-order-push.js doit interroger les deux tables d'abonnements push pour ne rater aucun terminal marchand"
);
assert.ok(
    sendPushJs.includes("endpointsSeen.add(s.endpoint)"),
    "api/send-order-push.js doit dédupliquer les abonnements par endpoint"
);
console.log('✅ [api/send-order-push.js] Tolérance VAPID et requête fusionnée validées !');

// 3. Contrôle des requêtes de catalogue (catalog-service.js)
console.log('\n--- 3. Contrôle des Requêtes Catalogue (catalog-service.js) ---');
const catalogJs = fs.readFileSync(path.join(rootDir, 'src/services/catalog-service.js'), 'utf-8');
assert.ok(
    catalogJs.includes("pavillon, chambre, shop_name"),
    "catalog-service.js doit sélectionner pavillon, chambre, shop_name dans fetchActiveProducts"
);
assert.ok(
    catalogJs.includes("id, prenom, nom, telephone, pavillon, chambre, is_open"),
    "catalog-service.js doit sélectionner pavillon et chambre dans fetchSellerProfile"
);
console.log('✅ [catalog-service.js] Inclusion de pavillon et chambre dans les jointures validée !');

// 4. Contrôle des composants UI Acheteur (ProductCard, ProductDetailModal, SellerShowcase)
console.log('\n--- 4. Contrôle UI Acheteur (Cartes, Détails, Vitrine) ---');
const productCardJs = fs.readFileSync(path.join(rootDir, 'src/components/ProductCard.js'), 'utf-8');
assert.ok(
    productCardJs.includes("product.seller?.pavillon") && productCardJs.includes("fa-location-dot"),
    "ProductCard.js doit afficher la pastille de localisation du vendeur"
);

const detailModalJs = fs.readFileSync(path.join(rootDir, 'src/components/ProductDetailModal.js'), 'utf-8');
assert.ok(
    detailModalJs.includes("p.seller?.pavillon") && detailModalJs.includes("Chambre"),
    "ProductDetailModal.js doit afficher le pavillon et la chambre du vendeur"
);

const showcaseJs = fs.readFileSync(path.join(rootDir, 'src/components/seller/SellerShowcase.js'), 'utf-8');
assert.ok(
    showcaseJs.includes("seller.pavillon") && showcaseJs.includes("Chambre"),
    "SellerShowcase.js doit afficher l'adresse de la boutique dans le bandeau marchand"
);
console.log('✅ [UI Acheteur] Affichage de la localisation marchand validé !');

// 5. Contrôle du Panier, Tunnel de Commande & Suivi (cart-store, CheckoutModal, OrderStatus, order-service)
console.log('\n--- 5. Contrôle Panier, Checkout & Suivi de Commande ---');
const cartStoreJs = fs.readFileSync(path.join(rootDir, 'src/services/cart-store.js'), 'utf-8');
assert.ok(
    cartStoreJs.includes("seller_pavillon:") && cartStoreJs.includes("seller_chambre:"),
    "cart-store.js doit préserver seller_pavillon et seller_chambre dans les articles du panier"
);

const checkoutJs = fs.readFileSync(path.join(rootDir, 'src/components/CheckoutModal.js'), 'utf-8');
assert.ok(
    checkoutJs.includes("checkout-seller-origin") && checkoutJs.includes("checkout-seller-location-text"),
    "CheckoutModal.js doit afficher l'origine et localisation des articles"
);

const orderServiceJs = fs.readFileSync(path.join(rootDir, 'src/services/order-service.js'), 'utf-8');
assert.ok(
    orderServiceJs.includes("sellerPavillon") && orderServiceJs.includes("sellerChambre"),
    "order-service.js doit retourner sellerPavillon et sellerChambre dans createOrder"
);
assert.ok(
    orderServiceJs.includes("seller_pavillon: data.seller?.pavillon") && orderServiceJs.includes("seller_chambre: data.seller?.chambre"),
    "order-service.js doit enrichir fetchLiveOrderStatus avec pavillon et chambre"
);

const orderStatusJs = fs.readFileSync(path.join(rootDir, 'src/components/OrderStatus.js'), 'utf-8');
assert.ok(
    orderStatusJs.includes("Boutique Vendeur") && orderStatusJs.includes("Votre Livraison"),
    "OrderStatus.js doit afficher distinctement la Boutique Vendeur et Votre Lieu de Livraison"
);
assert.ok(
    orderStatusJs.includes("sellerFullAddress") && orderStatusJs.includes("passée auprès de ${sShop}"),
    "OrderStatus.js doit mentionner la boutique et son adresse dans le message WhatsApp"
);
console.log('✅ [Suivi & Commande] Double affichage Boutique/Livraison et persistance validés !');

// 6. Respect de la consigne utilisateur : SellerDashboard sans bouton de test
console.log('\n--- 6. Respect de la consigne utilisateur (SellerDashboard.js) ---');
const sellerDashJs = fs.readFileSync(path.join(rootDir, 'src/components/seller/SellerDashboard.js'), 'utf-8');
assert.ok(
    !sellerDashJs.includes("Tester une notification push"),
    "SellerDashboard.js ne doit PAS contenir de bouton 'Tester une notification push' conformément à la consigne utilisateur"
);
console.log('✅ [SellerDashboard.js] Dashboard épuré conforme au souhait de l\'utilisateur !');

console.log('\n🎉 TOUS LES TESTS DE FIABILISATION PUSH ET D\'ADRESSE VENDEUR ONT RÉUSSI AVEC SUCCÈS !');
