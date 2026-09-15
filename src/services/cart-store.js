/**
 * Store de gestion du panier d'achats Campus Market.
 * Persiste l'état dans le LocalStorage (`campus_cart`) et notifie les abonnés en temps réel.
 */

const CART_STORAGE_KEY = 'campus_cart';
const MAX_ITEM_QUANTITY = 20;

class CartStore {
    constructor() {
        this.cart = this._loadCart();
        this.listeners = new Set();
    }

    /**
     * Charge le panier depuis le LocalStorage.
     * @private
     * @returns {Array}
     */
    _loadCart() {
        if (typeof localStorage === 'undefined') return [];
        try {
            const raw = localStorage.getItem(CART_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (error) {
            console.warn('[CartStore] Erreur de lecture du panier local:', error);
            return [];
        }
    }

    /**
     * Sauvegarde le panier dans le LocalStorage et notifie les écouteurs.
     * @private
     */
    _persistAndNotify() {
        if (typeof localStorage !== 'undefined') {
            try {
                localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.cart));
            } catch (error) {
                console.error('[CartStore] Erreur de sauvegarde du panier local:', error);
            }
        }
        this._notify();
    }

    /**
     * Déclenche tous les callbacks d'abonnés.
     * @private
     */
    _notify() {
        const cartState = this.getCart();
        const total = this.getCartTotal();
        const count = this.getCartCount();
        this.listeners.forEach((listener) => {
            try {
                listener({ cart: cartState, total, count });
            } catch (err) {
                console.error('[CartStore] Erreur dans un abonné du panier:', err);
            }
        });
    }

    /**
     * S'abonne aux modifications du panier.
     * @param {Function} listener - Fonction appelée lors de tout changement: ({ cart, total, count }) => void
     * @returns {Function} Fonction de désabonnement (unsubscribe)
     */
    subscribe(listener) {
        if (typeof listener === 'function') {
            this.listeners.add(listener);
            // Notification immédiate de l'état initial
            listener({
                cart: this.getCart(),
                total: this.getCartTotal(),
                count: this.getCartCount(),
            });
        }
        return () => this.listeners.delete(listener);
    }

    /**
     * Retourne une copie de la liste actuelle des articles dans le panier.
     * @returns {Array}
     */
    getCart() {
        return [...this.cart];
    }

    /**
     * Retourne le nombre total d'articles (somme des quantités).
     * @returns {number}
     */
    getCartCount() {
        return this.cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }

    /**
     * Calcule le montant total du panier en FCFA.
     * @returns {number}
     */
    getCartTotal() {
        return this.cart.reduce((sum, item) => {
            const price = Number(item.price) || 0;
            const quantity = Number(item.quantity) || 1;
            return sum + price * quantity;
        }, 0);
    }

    /**
     * Ajoute un produit au panier ou incrémente sa quantité s'il est déjà présent.
     * @param {Object} product - Données du produit ({ id, title, price, seller_id, image_url, etc. })
     * @param {number} [quantity=1] - Quantité à ajouter
     * @returns {Array} Nouveau panier
     */
    addToCart(product, quantity = 1) {
        if (!product || !product.id) {
            console.error('[CartStore] Produit invalide fourni à addToCart.');
            return this.getCart();
        }

        const qtyToAdd = Math.max(1, parseInt(quantity, 10) || 1);
        const existingIndex = this.cart.findIndex((item) => item.id === product.id);

        if (existingIndex > -1) {
            const currentQty = this.cart[existingIndex].quantity || 1;
            this.cart[existingIndex].quantity = Math.min(
                MAX_ITEM_QUANTITY,
                currentQty + qtyToAdd
            );
        } else {
            this.cart.push({
                id: product.id,
                title: product.title,
                price: Number(product.price) || 0,
                seller_id: product.seller_id,
                seller_name: product.seller ? `${product.seller.prenom} ${product.seller.nom}`.trim() : null,
                image_url: product.image_url || null,
                icon: product.icon || 'fa-box',
                color: product.color || '#1D4ED8',
                quantity: Math.min(MAX_ITEM_QUANTITY, qtyToAdd),
            });
        }

        this._persistAndNotify();
        return this.getCart();
    }

    /**
     * Met à jour la quantité d'un produit dans le panier.
     * Si la quantité est <= 0, l'article est retiré du panier.
     * @param {string} productId - ID du produit
     * @param {number} quantity - Nouvelle quantité
     * @returns {Array} Nouveau panier
     */
    updateQuantity(productId, quantity) {
        const targetQty = parseInt(quantity, 10);
        if (isNaN(targetQty) || targetQty <= 0) {
            return this.removeFromCart(productId);
        }

        const item = this.cart.find((p) => p.id === productId);
        if (item) {
            item.quantity = Math.min(MAX_ITEM_QUANTITY, targetQty);
            this._persistAndNotify();
        }
        return this.getCart();
    }

    /**
     * Supprime un article du panier par son ID.
     * @param {string} productId - ID du produit à retirer
     * @returns {Array} Nouveau panier
     */
    removeFromCart(productId) {
        this.cart = this.cart.filter((item) => item.id !== productId);
        this._persistAndNotify();
        return this.getCart();
    }

    /**
     * Vide intégralement le panier.
     */
    clearCart() {
        this.cart = [];
        this._persistAndNotify();
    }
}

// Instance singleton
export const cartStore = new CartStore();

// Exports des méthodes pour compatibilité et ergonomie
export const getCart = () => cartStore.getCart();
export const getCartCount = () => cartStore.getCartCount();
export const getCartTotal = () => cartStore.getCartTotal();
export const addToCart = (product, quantity) => cartStore.addToCart(product, quantity);
export const updateQuantity = (productId, quantity) => cartStore.updateQuantity(productId, quantity);
export const removeFromCart = (productId) => cartStore.removeFromCart(productId);
export const clearCart = () => cartStore.clearCart();
export const subscribeCart = (listener) => cartStore.subscribe(listener);

export default cartStore;
