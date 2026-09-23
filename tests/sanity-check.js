/**
 * Script de validation des modules de base pour Campus Market
 */
import { levenshteinDistance, isFuzzyMatch } from '../src/utils/levenshtein.js';
import { escapeHTML, isUniversityEmail, formatSenegalPhone } from '../src/utils/security.js';
import { cartStore } from '../src/services/cart-store.js';

console.log('🧪 Exécution des vérifications unitaires des modules purs...');

// 1. Test Levenshtein
const d1 = levenshteinDistance('thieb', 'thiéboudienne');
const d2 = levenshteinDistance('casque', 'casqu');
console.assert(d2 === 1, `Levenshtein erreur: attendu 1, obtenu ${d2}`);
console.assert(isFuzzyMatch('casque', 'casqu', 1) === true, 'Fuzzy match échoué');
console.log('✅ [Levenshtein] Test validé !');

// 2. Test Security & Sanitation
const unsafe = '<script>alert("xss")</script>';
const safe = escapeHTML(unsafe);
console.assert(!safe.includes('<script>'), 'Échappement XSS échoué');
console.assert(isUniversityEmail('etudiant@univ-thies.sn') === true, 'Email univ-thies.sn refusé');
console.assert(isUniversityEmail('etudiant@gmail.com') === false, 'Email externe accepté par erreur');
console.assert(formatSenegalPhone('771234567') === '221771234567', 'Formatage téléphone échoué');
console.log('✅ [Security] Test validé !');

// 3. Test Cart Store
cartStore.clearCart();
console.assert(cartStore.getCartCount() === 0, 'Panier non vide au départ');
cartStore.addToCart({ id: 'p-1', title: 'Thieb', price: 1500, seller_id: 's-1' }, 2);
console.assert(cartStore.getCartCount() === 2, 'Quantité panier incorrecte');
console.assert(cartStore.getCartTotal() === 3000, 'Total panier incorrect');
cartStore.updateQuantity('p-1', 5);
console.assert(cartStore.getCartTotal() === 7500, 'Total mis à jour incorrect');
cartStore.removeFromCart('p-1');
console.assert(cartStore.getCartCount() === 0, 'Suppression panier échouée');
// 4. Test Seller Service Validations
import { registerSeller, updateOrderStatus } from '../src/services/seller-service.js';
import { createProduct } from '../src/services/product-management.js';

let rejectedExternalEmail = false;
try {
    await registerSeller({
        email: 'fraudeur@gmail.com',
        password: 'password123',
        prenom: 'Test',
        nom: 'User',
        telephone: '771234567'
    });
} catch (e) {
    rejectedExternalEmail = e.message.includes('@univ-thies.sn');
}
console.assert(rejectedExternalEmail, 'Échec de rejet email externe pour vendeur');
console.log('✅ [SellerService] Règle stricte email institutionnel validée !');

let rejectedInvalidStatus = false;
try {
    await updateOrderStatus('fake-id', 'invalid_status_xyz');
} catch (e) {
    rejectedInvalidStatus = e.message.includes('invalide');
}
console.assert(rejectedInvalidStatus, 'Échec de rejet statut de commande invalide');
console.log('✅ [SellerService] Validation des statuts de commande validée !');

let rejectedNegativePrice = false;
try {
    await createProduct({
        sellerId: 's-1',
        title: 'Produit',
        price: -500
    });
} catch (e) {
    rejectedNegativePrice = e.message.includes('positif');
}
console.assert(rejectedNegativePrice, 'Échec de rejet prix négatif pour produit');

let descriptionError = null;
try {
    // Appel avec prix valide pour tester le chemin avec description
    await createProduct({
        sellerId: 's-1',
        title: 'Produit Test',
        price: 1500,
        description: 'Excellente qualité',
    });
} catch (e) {
    // Si échec réseau / DB Supabase, c'est normal en environnement mock/test,
    // mais cela ne DOIT PAS être un ReferenceError (description is not defined)
    if (e.message?.includes('description is not defined')) {
        descriptionError = e.message;
    }
}
console.assert(!descriptionError, `Bug ReferenceError sur description: ${descriptionError}`);
console.log('✅ [ProductManagement] Validation prix et gestion description validées !');

// 5. Test SuperAdmin Service Validations
import {
    loginAdmin,
    approveSeller,
    rejectSeller,
    suspendSeller,
    deleteProductAdmin,
    verifyAdminRole,
} from '../src/services/admin-service.js';

let rejectedMissingCredentials = false;
try {
    await loginAdmin({});
} catch (e) {
    rejectedMissingCredentials = e.message.includes('Email et mot de passe requis');
}
console.assert(rejectedMissingCredentials, 'Échec de rejet de login admin sans identifiants');

let rejectedMissingApproveId = false;
try {
    await approveSeller(null);
} catch (e) {
    rejectedMissingApproveId = e.message.includes('ID vendeur manquant');
}
console.assert(rejectedMissingApproveId, 'Échec de rejet approveSeller sans ID');

let rejectedMissingRejectId = false;
try {
    await rejectSeller(undefined);
} catch (e) {
    rejectedMissingRejectId = e.message.includes('ID vendeur manquant');
}
console.assert(rejectedMissingRejectId, 'Échec de rejet rejectSeller sans ID');

let rejectedMissingSuspendId = false;
try {
    await suspendSeller('');
} catch (e) {
    rejectedMissingSuspendId = e.message.includes('ID vendeur manquant');
}
console.assert(rejectedMissingSuspendId, 'Échec de rejet suspendSeller sans ID');

let rejectedMissingDeleteProductId = false;
try {
    await deleteProductAdmin(null);
} catch (e) {
    rejectedMissingDeleteProductId = e.message.includes('ID produit manquant');
}
console.assert(rejectedMissingDeleteProductId, 'Échec de rejet deleteProductAdmin sans ID');

const nullAdminRole = await verifyAdminRole(null);
console.assert(nullAdminRole === false, 'verifyAdminRole(null) devrait retourner false');

console.log('✅ [AdminService] Validation stricte des opérations SuperAdmin validée !');

// 6. Test Order Service Payload (Strict 10 real DB columns)
import { buildOrderPayload } from '../src/services/order-service.js';

const mockItems = [
    { id: 'prod-uuid-1', seller_id: 'seller-uuid-1', price: 2500, quantity: 2 },
    { id: 'prod-uuid-2', seller_id: 'seller-uuid-2', price: 1000, quantity: 1 },
];

const generatedOrders = buildOrderPayload({
    clientNom: 'Diallo',
    clientPrenom: 'Amadou',
    clientTelephone: ' 77 123 45 67 ',
    pavillon: 'Pavillon Jardin Social',
    chambre: 'hhdha',
    paymentMethod: 'WAVE',
    items: mockItems,
    buyerId: null,
});

console.assert(generatedOrders.length === 2, 'Nombre de commandes générées incorrect');

const expectedColumns = [
    'buyer_name',
    'buyer_phone',
    'delivery_address',
    'payment_method',
    'seller_id',
    'product_id',
    'price',
    'quantity',
    'status',
    'buyer_id',
].sort();

const firstOrder = generatedOrders[0];
const actualKeys = Object.keys(firstOrder).sort();

console.assert(
    JSON.stringify(actualKeys) === JSON.stringify(expectedColumns),
    `Colonnes incorrectes ! Attendu: ${expectedColumns.join(', ')} | Reçu: ${actualKeys.join(', ')}`
);

// Vérification de l'absence de colonnes fantômes
console.assert(!('reference' in firstOrder), 'Colonne fantôme "reference" détectée !');
console.assert(!('payment_status' in firstOrder), 'Colonne fantôme "payment_status" détectée !');
console.assert(!('pavillon' in firstOrder), 'Colonne fantôme "pavillon" détectée !');
console.assert(!('chambre' in firstOrder), 'Colonne fantôme "chambre" détectée !');

// Vérification des valeurs concaténées et normalisées
console.assert(firstOrder.buyer_name === 'Amadou Diallo', 'Concaténation buyer_name échouée');
console.assert(firstOrder.delivery_address === 'Pavillon Jardin Social, Chambre hhdha', 'Format delivery_address incorrect');
console.assert(firstOrder.payment_method === 'wave', 'Normalisation payment_method échouée');
console.assert(firstOrder.price === 5000, `Calcul prix total échoué (attendu 5000, obtenu ${firstOrder.price})`);
console.assert(firstOrder.quantity === 2, 'Quantité incorrecte');
console.assert(firstOrder.status === 'pending', 'Statut par défaut incorrect');
console.assert(firstOrder.buyer_id === null, 'buyer_id anonyme non respecté');

console.log('✅ [OrderService] Insertion strictement conforme aux 10 colonnes réelles validée !');

// 7. Test Nouveaux Modules & Fonctionnalités Production
import fs from 'fs';
import { updateProduct } from '../src/services/product-management.js';
import { submitOrderReview, cancelOrderByBuyer, fetchLiveOrderStatus } from '../src/services/order-service.js';
import { fetchAllProductsAdmin, fetchAllOrdersAdmin } from '../src/services/admin-service.js';

// Test validation modification produit
let rejectedMissingUpdateId = false;
try {
    await updateProduct({ productId: '', title: 'Test', price: 1000 });
} catch (e) {
    rejectedMissingUpdateId = e.message.includes('Identifiant produit requis');
}
console.assert(rejectedMissingUpdateId, 'Échec de rejet updateProduct sans ID');

// Test validation avis & annulation
let rejectedReviewNoSeller = false;
try {
    await submitOrderReview({ rating: 5 });
} catch (e) {
    rejectedReviewNoSeller = e.message.includes('marchand');
}
console.assert(rejectedReviewNoSeller, 'Échec de rejet submitOrderReview sans sellerId');

let rejectedCancelNoId = false;
try {
    await cancelOrderByBuyer('');
} catch (e) {
    rejectedCancelNoId = e.message.includes('Identifiant');
}
console.assert(rejectedCancelNoId, 'Échec de rejet cancelOrderByBuyer sans ID');

// Test présence PWA dans public/
console.assert(fs.existsSync('./public/sw.js'), 'Fichier public/sw.js manquant !');
console.assert(fs.existsSync('./public/manifest.json'), 'Fichier public/manifest.json manquant !');
console.assert(typeof fetchLiveOrderStatus === 'function', 'fetchLiveOrderStatus non exporté');
console.assert(typeof fetchAllProductsAdmin === 'function', 'fetchAllProductsAdmin non exporté');
console.assert(typeof fetchAllOrdersAdmin === 'function', 'fetchAllOrdersAdmin non exporté');

console.log('✅ [ProductionFeatures] Modules d\'édition, avis, PWA et modération validés !');

// 8. Test SuperAdmin Locations & Order Status Management
import {
    DEFAULT_DELIVERY_LOCATIONS,
    fetchDeliveryLocations,
    addDeliveryLocation,
    toggleDeliveryLocation,
    deleteDeliveryLocation,
    updateOrderStatusAdmin,
} from '../src/services/admin-service.js';

console.assert(Array.isArray(DEFAULT_DELIVERY_LOCATIONS) && DEFAULT_DELIVERY_LOCATIONS.length >= 8, 'DEFAULT_DELIVERY_LOCATIONS incomplet');
console.assert(DEFAULT_DELIVERY_LOCATIONS.some(l => l.name === 'Pavillon A1'), 'Pavillon A1 manquant dans DEFAULT_DELIVERY_LOCATIONS');

let rejectedAddLocNoName = false;
try {
    await addDeliveryLocation({ name: '' });
} catch (e) {
    rejectedAddLocNoName = e.message.includes('requis');
}
console.assert(rejectedAddLocNoName, 'addDeliveryLocation sans nom devrait échouer');

let rejectedToggleLocNoId = false;
try {
    await toggleDeliveryLocation(null, true);
} catch (e) {
    rejectedToggleLocNoId = e.message.includes('manquant');
}
console.assert(rejectedToggleLocNoId, 'toggleDeliveryLocation sans ID devrait échouer');

let rejectedDeleteLocNoId = false;
try {
    await deleteDeliveryLocation(undefined);
} catch (e) {
    rejectedDeleteLocNoId = e.message.includes('manquant');
}
console.assert(rejectedDeleteLocNoId, 'deleteDeliveryLocation sans ID devrait échouer');

let rejectedOrderStatusNoId = false;
try {
    await updateOrderStatusAdmin('', 'delivered');
} catch (e) {
    rejectedOrderStatusNoId = e.message.includes('requis');
}
console.assert(rejectedOrderStatusNoId, 'updateOrderStatusAdmin sans ID devrait échouer');

let rejectedOrderStatusInvalid = false;
try {
    await updateOrderStatusAdmin('uuid-123', 'fake_status');
} catch (e) {
    rejectedOrderStatusInvalid = e.message.includes('invalide');
}
console.assert(rejectedOrderStatusInvalid, 'updateOrderStatusAdmin avec statut invalide devrait échouer');

console.log('✅ [SuperAdminLocations] Gestion dynamique des lieux et statuts commandes validée !');

// 9. Test Modern Notifications & Confirm Dialogs
import { showToast, showConfirm } from '../src/utils/notifications.js';

let notificationsOk = true;
try {
    showToast('Test Toast Success', 'success');
    showToast('Test Toast Error', 'error');
    showToast('Test Toast Warning', 'warning');
    showToast('Test Toast Info', 'info');

    const confirmed = await showConfirm({
        title: 'Test Modal',
        message: 'Message test',
    });
    console.assert(confirmed === true, 'showConfirm devrait renvoyer true en environnement headless');
} catch (e) {
    notificationsOk = false;
    console.error('Erreur test notifications:', e);
}
console.assert(notificationsOk, 'Les notifications modernes ont échoué');
console.log('✅ [ModernNotifications] Module de toasts et confirmations modernes validé !');

console.log('🎉 Tous les tests unitaires des services de base sont passés avec succès !');


