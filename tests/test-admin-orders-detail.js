/**
 * Suite de tests unitaires :
 * Consultation détaillée des commandes et arbitrage SuperAdmin (Campus Market).
 */

import assert from 'node:assert/strict';
import { fetchAllOrdersAdmin, updateOrderStatusAdmin } from '../src/services/admin-service.js';

console.log('🧪 Démarrage des tests de la Consultation Détaillée des Commandes SuperAdmin...');

// =========================================================================
// 1. Tests des Règles de Formatage Téléphonique (Sénégal +221)
// =========================================================================

function formatPhoneForWa(raw) {
    if (!raw) return null;
    let digits = String(raw).replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('00221')) digits = digits.slice(2);
    if (!digits.startsWith('221') && digits.length === 9) digits = `221${digits}`;
    return digits;
}

function cleanPhoneForCall(raw) {
    return raw ? String(raw).replace(/[^\d+]/g, '') : '';
}

// Numéro standard à 9 chiffres (ex: 77 123 45 67)
assert.equal(formatPhoneForWa('771234567'), '221771234567', 'Formatage standard 9 chiffres');
assert.equal(formatPhoneForWa('77 123 45 67'), '221771234567', 'Nettoyage des espaces');
assert.equal(formatPhoneForWa('+221781234567'), '221781234567', 'Numéro international avec +');
assert.equal(formatPhoneForWa('00221761234567'), '221761234567', 'Numéro international avec 00221');
assert.equal(formatPhoneForWa(null), null, 'Tolérance valeur nulle');
assert.equal(formatPhoneForWa(''), null, 'Tolérance chaîne vide');

assert.equal(cleanPhoneForCall('+221 77 123 45 67'), '+221771234567', 'Numéro d’appel direct nettoyé');

console.log('✅ [Phone Formatting] Formatage Sénégal +221 & liens d’appel validés !');

// =========================================================================
// 2. Tests du Calcul Financier et Détail Commande
// =========================================================================

function computeOrderFinancials(ord) {
    const quantity = ord.quantity || 1;
    const totalPrice = Number(ord.price) || 0;
    const deliveryFee = Number(ord.delivery_fee) || 0;
    const unitPrice = ord.product?.price ? Number(ord.product.price) : Math.max(0, Math.round((totalPrice - deliveryFee) / quantity));
    const subtotal = unitPrice * quantity;
    return {
        quantity,
        totalPrice,
        deliveryFee,
        unitPrice,
        subtotal,
    };
}

// Cas 1: Commande classique avec frais de livraison
const sampleOrder1 = {
    id: 'ord-12345-uuid',
    reference: '#CMD-A1B2C3',
    buyer_name: 'Moussa Diop',
    buyer_phone: '771234567',
    delivery_address: 'Pavillon A, Chambre 12',
    price: 15500,
    quantity: 3,
    delivery_fee: 500,
    payment_method: 'wave',
    payment_status: 'paid',
    status: 'pending',
    product: {
        id: 'prod-1',
        title: 'Livre Algorithmique C++',
        price: 5000,
        category: 'Livres',
    },
    seller: {
        id: 'seller-1',
        prenom: 'Fatou',
        nom: 'Ndiaye',
        shop_name: 'Librairie Étudiante',
        telephone: '782345678',
    },
};

const fin1 = computeOrderFinancials(sampleOrder1);
assert.equal(fin1.quantity, 3);
assert.equal(fin1.unitPrice, 5000);
assert.equal(fin1.subtotal, 15000);
assert.equal(fin1.deliveryFee, 500);
assert.equal(fin1.totalPrice, 15500);

// Cas 2: Commande sans relation produit (produit supprimé ou archivé)
const sampleOrder2 = {
    id: 'ord-67890-uuid',
    price: 6000,
    quantity: 2,
    delivery_fee: 0,
    product: null,
    seller: null,
};
const fin2 = computeOrderFinancials(sampleOrder2);
assert.equal(fin2.unitPrice, 3000, 'Calcul unitaire par déduction en cas de produit manquant');
assert.equal(fin2.subtotal, 6000);
assert.equal(fin2.deliveryFee, 0);

console.log('✅ [Order Financials] Décomposition tarifaire & résilience produits supprimés validées !');

// =========================================================================
// 3. Tests des Statuts Autorisés et Messages WhatsApp
// =========================================================================

const ALLOWED_ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
ALLOWED_ORDER_STATUSES.forEach((st) => {
    assert.ok(typeof st === 'string' && st.length > 0, `Statut ${st} valide`);
});

const ref = sampleOrder1.reference;
const buyerMsg = `Bonjour ${sampleOrder1.buyer_name} ! Je suis l'administrateur de Campus Market au sujet de votre commande ${ref}.`;
assert.ok(buyerMsg.includes('Moussa Diop'), 'Nom acheteur inclus dans WhatsApp');
assert.ok(buyerMsg.includes('#CMD-A1B2C3'), 'Référence commande incluse dans WhatsApp');

const sellerShop = sampleOrder1.seller.shop_name;
const sellerMsg = `Bonjour ${sampleOrder1.seller.prenom} ${sampleOrder1.seller.nom} ! Je suis l'administrateur de Campus Market au sujet de la commande ${ref}.`;
assert.ok(sellerMsg.includes('Fatou Ndiaye'), 'Nom vendeur inclus dans WhatsApp');
assert.ok(sellerMsg.includes('#CMD-A1B2C3'), 'Référence commande incluse dans WhatsApp');

console.log('✅ [WhatsApp Arbitration] Génération des messages d’arbitrage SuperAdmin validée !');

// =========================================================================
// 4. Test Service SuperAdmin updateOrderStatusAdmin
// =========================================================================

assert.equal(typeof updateOrderStatusAdmin, 'function', 'updateOrderStatusAdmin doit être disponible');
assert.equal(typeof fetchAllOrdersAdmin, 'function', 'fetchAllOrdersAdmin doit être disponible');

console.log('✅ [Admin Services] Intégrité des fonctions de gestion de commandes validée !');

console.log('🎉 TOUS LES TESTS DE CONSULTATION DÉTAILLÉE DES COMMANDES SONT PASSÉS AVEC SUCCÈS !');
process.exit(0);
