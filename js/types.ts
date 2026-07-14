export interface Profile {
  id: string;
  prenom: string;
  nom: string;
  telephone: string;
  role: 'acheteur' | 'vendeur_pending' | 'vendeur' | 'superadmin';
  is_open?: boolean;
}

export interface Product {
  id: string;
  seller_id: string;
  title: string;
  price: number;
  category: string;
  icon?: string;
  color?: string;
  stock?: number;
  image_url?: string;
  old_price?: number;
  oldPrice?: number;
  seller?: {
    is_open?: boolean;
    prenom?: string;
    nom?: string;
  };
}

export interface Review {
  seller_id: string;
  rating: number;
}

export interface Order {
  id: string;
  buyer_id: string;
  seller_id: string;
  product_id: string;
  price: number;
  delivery_address: string;
  status: 'pending' | 'processing' | 'delivered' | 'cancelled';
  created_at?: string;
  buyerPhone?: string;
  productTitle?: string;
  reviews?: Review[];
}

declare global {
  interface Window {
    supabase: any;
    globalProducts: Product[];
    cart: any[];
    currentProductPage: number;
    PRODUCTS_PER_PAGE: number;
    // Helper/Functions
    escapeHTML: (str: any) => string;
    filterProducts: () => void;
    toggleFiltersPanel: () => void;
    applyFilters: () => void;
    fetchTopShops: () => Promise<void>;
    addToCart: (productId: string) => void;
    renderCart: () => void;
    updateCartQty: (id: string, delta: number) => void;
    openReviewModal: (orderId: string, sellerId: string) => void;
    updateOrderStatus: (orderId: string, status: string) => void;
    navigateTo: (viewId: string) => void;
    showToast: (msg: string) => void;
    initSuperAdmin: () => Promise<void>;
    loginSuperAdmin: () => Promise<void>;
    logoutSuperAdmin: () => Promise<void>;
    loadAdminData: () => Promise<void>;
    login: () => Promise<void>;
    signUp: () => Promise<void>;
    logout: () => Promise<void>;
    enableAudioAlerts: () => Promise<void>;
    Store: any;
  }
}
