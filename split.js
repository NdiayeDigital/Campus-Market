const fs = require('fs');
const content = fs.readFileSync('js/app.js', 'utf8');

const sections = {
    ui: ['// 1. Toggle Search Bar', '// --- SUPABASE INTEGRATION'],
    api: ['// --- SUPABASE INTEGRATION', '// SUPABASE AUTHENTICATION & STATE MANAGEMENT'],
    auth: ['// SUPABASE AUTHENTICATION & STATE MANAGEMENT', '// PANIER & COMMANDES (CART & ORDERS LOGIC)'],
    cart: ['// PANIER & COMMANDES (CART & ORDERS LOGIC)', '// SUPERADMIN LOGIC'],
    admin: ['// SUPERADMIN LOGIC', null] // null means until the end
};

// Also we have top level utilities before ui
const topUtils = content.substring(0, content.indexOf(sections.ui[0]));

let uiContent = topUtils + content.substring(content.indexOf(sections.ui[0]), content.indexOf(sections.ui[1]));
let apiContent = content.substring(content.indexOf(sections.api[0]), content.indexOf(sections.api[1]));
let authContent = content.substring(content.indexOf(sections.auth[0]), content.indexOf(sections.auth[1]));
let cartContent = content.substring(content.indexOf(sections.cart[0]), content.indexOf(sections.cart[1]));
let adminContent = content.substring(content.indexOf(sections.admin[0]));

const htmlFunctions = [
    'toggleSearch', 'selectCampus', 'logout', 'login', 'signUp', 
    'addToCart', 'renderCart', 'updateQuantity', 'removeFromCart', 
    'placeOrder', 'filterOrders', 'updateOrderStatus', 'approveSeller', 
    'rejectSeller', 'filterProducts', 'openAuthModal', 'closeAuthModal',
    'switchAuthView', 'fetchProductsFromDB', 'renderProducts', 'mockProducts',
    'checkAuthState', 'updateAuthUI', 'fetchMyOrders', 'loadAdminData', 'loginSuperAdmin',
    'notifyBuyerWhatsApp', 'showToast', 'openProductDetail', 'navigateTo'
];

function makeSafe(text) {
    let newText = text;
    htmlFunctions.forEach(fn => {
        if (text.includes(`function ${fn}(`) || text.includes(`const ${fn} =`) || text.includes(`let ${fn} =`)) {
            newText += `\nwindow.${fn} = ${fn};`;
        }
    });
    return newText;
}

fs.writeFileSync('js/ui.js', makeSafe(uiContent));
fs.writeFileSync('js/api.js', makeSafe(apiContent));
fs.writeFileSync('js/auth.js', makeSafe(authContent));
fs.writeFileSync('js/cart.js', makeSafe(cartContent));
fs.writeFileSync('js/admin.js', makeSafe(adminContent));

// Create main.js
const mainJs = `
import './ui.js';
import './api.js';
import './auth.js';
import './cart.js';
import './admin.js';

console.log("Modules chargés avec succès.");
`;
fs.writeFileSync('js/main.js', mainJs);

console.log("Splitting done!");
