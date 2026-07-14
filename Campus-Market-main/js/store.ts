import { Product, Profile } from './types';

class CampusMarketStore {
  private state = {
    globalProducts: [] as Product[],
    cart: JSON.parse(localStorage.getItem('campus_cart') || '[]') as any[],
    currentProductPage: 0,
    userProfile: null as Profile | null,
  };

  private listeners: { [key: string]: Function[] } = {};

  constructor() {
    // Intercepter window.cart pour synchroniser avec localStorage et émettre des événements
    Object.defineProperty(window, 'cart', {
      get: () => this.state.cart,
      set: (newCart: any[]) => {
        this.state.cart = newCart;
        this.saveCartToStorage();
        this.emit('cartChange', newCart);
      },
      configurable: true
    });

    // Intercepter window.globalProducts pour émettre des événements sur les changements de catalogue
    Object.defineProperty(window, 'globalProducts', {
      get: () => this.state.globalProducts,
      set: (newProducts: Product[]) => {
        this.state.globalProducts = newProducts;
        this.emit('productsChange', newProducts);
      },
      configurable: true
    });
  }

  public subscribe(event: string, callback: Function) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  public emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error("Store event callback error:", e);
        }
      });
    }
  }

  private saveCartToStorage() {
    localStorage.setItem('campus_cart', JSON.stringify(this.state.cart));
  }

  // Accesseurs
  public getCart() {
    return this.state.cart;
  }

  public getProducts() {
    return this.state.globalProducts;
  }

  public getUserProfile() {
    return this.state.userProfile;
  }

  public setUserProfile(profile: Profile | null) {
    this.state.userProfile = profile;
    this.emit('userProfileChange', profile);
  }
}

// Enregistrer l'instance dans l'espace global
(window as any).Store = new CampusMarketStore();
