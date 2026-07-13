/**
 * Campus Market - Backend Simulation & Logic
 * Ce fichier gère l'authentification, le panier, et les commandes via LocalStorage.
 * Dans une version de production finale, ce fichier se connectera directement à Supabase/Firebase.
 */

// --- BASE DE DONNÉES LOCALE (MOCK) ---
const DB = {
    users: JSON.parse(localStorage.getItem('cm_users')) || [
        { id: 999, name: 'Vendeur Test', phone: '770000001', password: 'test', role: 'seller', shopName: 'Tech Student' },
        { id: 1000, name: 'Super Admin', phone: '770000000', password: 'admin', role: 'superadmin' }
    ],
    currentUser: JSON.parse(localStorage.getItem('cm_currentUser')) || null,
    cart: JSON.parse(localStorage.getItem('cm_cart')) || [],
    orders: JSON.parse(localStorage.getItem('cm_orders')) || [],
    products: JSON.parse(localStorage.getItem('cm_products')) || [
        { id: 1, title: 'Casque Sans Fil Bluetooth', price: 15000, vendor: 'Tech Student', image: 'fa-headphones' },
        { id: 2, title: 'Collier perles africaines', price: 2000, vendor: 'Awa Bijoux', image: 'fa-gem' },
        { id: 3, title: 'Cahiers TP Grand Format', price: 1200, vendor: 'Librairie', image: 'fa-book' },
        { id: 4, title: 'Blouse Blanche TP Chimie', price: 3500, vendor: 'Modou Couture', image: 'fa-flask' }
    ]
};

function saveDB() {
    localStorage.setItem('cm_users', JSON.stringify(DB.users));
    localStorage.setItem('cm_currentUser', JSON.stringify(DB.currentUser));
    localStorage.setItem('cm_cart', JSON.stringify(DB.cart));
    localStorage.setItem('cm_orders', JSON.stringify(DB.orders));
    localStorage.setItem('cm_products', JSON.stringify(DB.products));
    updateCartBadge();
}

// --- AUTHENTIFICATION ---
const Auth = {
    register: (name, phone, password, role = 'buyer') => {
        const exists = DB.users.find(u => u.phone === phone);
        if (exists) throw new Error("Ce numéro est déjà inscrit.");
        const user = { id: Date.now(), name, phone, password, role };
        DB.users.push(user);
        DB.currentUser = user;
        saveDB();
        return user;
    },
    login: (phone, password) => {
        const user = DB.users.find(u => u.phone === phone && u.password === password);
        if (!user) throw new Error("Identifiants incorrects.");
        DB.currentUser = user;
        saveDB();
        return user;
    },
    logout: () => {
        DB.currentUser = null;
        saveDB();
        window.location.href = 'login.html';
    },
    requireAuth: (redirectUrl = 'login.html') => {
        if (!DB.currentUser) {
            window.location.href = redirectUrl;
        }
    }
};

// --- GESTION DU PANIER ---
const Cart = {
    add: (productId) => {
        const product = DB.products.find(p => p.id === productId);
        if (!product) return;
        const item = DB.cart.find(i => i.product.id === productId);
        if (item) {
            item.quantity++;
        } else {
            DB.cart.push({ product, quantity: 1 });
        }
        saveDB();
        if(window.showToast) showToast(product.title + " ajouté au panier !");
    },
    remove: (productId) => {
        DB.cart = DB.cart.filter(i => i.product.id !== productId);
        saveDB();
    },
    updateQuantity: (productId, qty) => {
        const item = DB.cart.find(i => i.product.id === productId);
        if (item) {
            item.quantity = qty;
            if (item.quantity <= 0) Cart.remove(productId);
        }
        saveDB();
    },
    clear: () => {
        DB.cart = [];
        saveDB();
    },
    getTotal: () => {
        return DB.cart.reduce((total, item) => total + (item.product.price * item.quantity), 0);
    }
};

// --- COMMANDES ET TUNNEL ---
const Order = {
    checkout: (address, notes) => {
        if (!DB.currentUser) throw new Error("Vous devez être connecté.");
        if (DB.cart.length === 0) throw new Error("Le panier est vide.");
        
        const newOrder = {
            id: 'CMD-' + Math.floor(Math.random() * 10000),
            buyerId: DB.currentUser ? DB.currentUser.id : 'guest',
            buyerName: DB.currentUser ? DB.currentUser.name : '�tudiant Anonyme',
            buyerPhone: DB.currentUser ? DB.currentUser.phone : 'Non sp�cifi�',
            items: [...DB.cart],
            total: Cart.getTotal(),
            address,
            notes,
            status: 'pending', // pending, confirmed, ready, delivered
            date: new Date().toISOString()
        };
        
        DB.orders.push(newOrder);
        Cart.clear();
        saveDB();
        return newOrder;
    },
    updateStatus: (orderId, newStatus) => {
        const order = DB.orders.find(o => o.id === orderId);
        if (order) {
            order.status = newStatus;
            saveDB();
            if(window.notifyBuyerWhatsApp && (newStatus === 'ready' || newStatus === 'confirmed')) {
                window.notifyBuyerWhatsApp(order.buyerPhone, order.id, newStatus);
            }
        }
    }
};

// --- UI UPDATES (Global) ---
function updateCartBadge() {
    const badges = document.querySelectorAll('.cart-badge');
    const totalItems = DB.cart.reduce((sum, item) => sum + item.quantity, 0);
    badges.forEach(badge => {
        badge.textContent = totalItems;
        badge.style.display = totalItems > 0 ? 'flex' : 'none';
    });
}

// Initialisation globale
document.addEventListener('DOMContentLoaded', () => {
    updateCartBadge();
    
    // Attacher les events "Ajouter au panier" dynamiquement
    const addBtns = document.querySelectorAll('.btn-add');
    addBtns.forEach((btn, index) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Simule l'ID du produit (1 à 4) basé sur l'index pour la démo
            Cart.add((index % 4) + 1); 
        });
    });
});

window.DB = DB;
window.Auth = Auth;
window.Cart = Cart;
window.Order = Order;


