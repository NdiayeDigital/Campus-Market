import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import BottomNav from './components/BottomNav';
import ProductDetailModal from './components/ProductDetailModal';
import OrderTrackingModal from './components/OrderTrackingModal';
import AuthModal from './components/AuthModal';

import Home from './pages/Home';
import Categories from './pages/Categories';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import SellerDashboard from './pages/SellerDashboard';
import AddProduct from './pages/AddProduct';
import SellerProducts from './pages/SellerProducts';
import Profile from './pages/Profile';

import { INITIAL_PRODUCTS, MOCK_ORDERS } from './data/mockData';
import { fetchProducts, insertProduct } from './services/supabase';

export default function App() {
  const [activeTab, setActiveTab] = useState('accueil');
  const [products, setProducts] = useState(INITIAL_PRODUCTS);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('login');

  const [cartItems, setCartItems] = useState([
    {
      id: 'cm-1',
      title: 'Thiéboudienne au poisson',
      price: 2500,
      quantity: 1,
      seller: "Fatou's Kitchen",
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop'
    },
    {
      id: 'cm-2',
      title: 'Polo Uidt Bleu marine',
      price: 4500,
      quantity: 1,
      seller: 'Uidt Shop',
      image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=400&fit=crop'
    }
  ]);
  const [orders, setOrders] = useState(MOCK_ORDERS);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedOrderTracking, setSelectedOrderTracking] = useState(null);

  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  // Charger les produits réels si disponibles
  useEffect(() => {
    async function loadProducts() {
      const dbProducts = await fetchProducts();
      if (dbProducts && dbProducts.length > 0) {
        setProducts(dbProducts.map(p => ({
          ...p,
          seller: p.seller ? `${p.seller.prenom} ${p.seller.nom}` : "Vendeur Campus",
          image: p.image_url || p.image
        })));
      }
    }
    loadProducts();
  }, []);

  const handleNavigate = (tab) => {
    if ((tab === 'seller-dashboard' || tab === 'add-product' || tab === 'seller-products') && !currentUser) {
      setAuthModalMode('login');
      setIsAuthModalOpen(true);
      return;
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddToCart = (product, quantity = 1) => {
    const existing = cartItems.find((item) => item.id === product.id);
    if (existing) {
      setCartItems(
        cartItems.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
        )
      );
    } else {
      setCartItems([...cartItems, { ...product, quantity }]);
    }
  };

  const handleUpdateCartQuantity = (id, newQty) => {
    if (newQty <= 0) {
      setCartItems(cartItems.filter((item) => item.id !== id));
    } else {
      setCartItems(
        cartItems.map((item) => (item.id === id ? { ...item, quantity: newQty } : item))
      );
    }
  };

  const handleRemoveCartItem = (id) => {
    setCartItems(cartItems.filter((item) => item.id !== id));
  };

  const handleConfirmOrder = (orderData) => {
    const newOrder = {
      id: `CM-2024-${Math.floor(1000 + Math.random() * 9000)}`,
      date: 'Aujourd\'hui • En cours',
      status: 'shipped',
      statusText: 'En cours de livraison',
      badgeClass: 'en-livraison',
      itemsCount: cartItems.length,
      total: orderData.total,
      deliveryAddress: `${orderData.pavillon}, ${orderData.chambre} (UIDT, Thiès)`,
      contactPhone: orderData.phone,
      paymentMethod: orderData.paymentMethod === 'wave' ? 'Wave' : orderData.paymentMethod === 'om' ? 'Orange Money' : 'Espèces à la livraison',
      courier: {
        name: 'Mamadou Diallo',
        rating: 4.9,
        phone: '77 987 65 43',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop'
      },
      items: cartItems.map(item => ({ title: item.title, qty: item.quantity, price: item.price, seller: item.seller }))
    };

    setOrders([newOrder, ...orders]);
    setCartItems([]);
    setSelectedOrderTracking(newOrder);
    handleNavigate('commandes');
  };

  const handleAddProduct = async (newProduct) => {
    try {
      if (currentUser?.id) {
        await insertProduct(newProduct, currentUser.id);
      }
    } catch (err) {
      console.warn("Supabase insert error fallback to state:", err.message);
    }
    setProducts([newProduct, ...products]);
  };

  const handleToggleProductStatus = (id) => {
    setProducts(
      products.map((p) =>
        p.id === id
          ? { ...p, status: p.status === 'en_ligne' ? 'hors_ligne' : 'en_ligne' }
          : p
      )
    );
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    handleNavigate('seller-dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    handleNavigate('accueil');
  };

  return (
    <div className="app-container" style={{ maxWidth: '480px', margin: '0 auto', background: '#F8FAFC', minHeight: '100vh', position: 'relative' }}>
      
      {/* Header */}
      <Header
        onNavigate={handleNavigate}
        onToggleSearch={() => handleNavigate('accueil')}
        cartCount={cartCount}
      />

      {/* Pages Routing */}
      <main className="main-content">
        {activeTab === 'accueil' && (
          <Home
            products={products}
            onSelectProduct={setSelectedProduct}
            onAddToCart={handleAddToCart}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'categories' && (
          <Categories
            onNavigate={handleNavigate}
            onSelectCategory={() => handleNavigate('accueil')}
          />
        )}

        {activeTab === 'panier' && (
          <Cart
            cartItems={cartItems}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveItem={handleRemoveCartItem}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'checkout' && (
          <Checkout
            cartItems={cartItems}
            onConfirmOrder={handleConfirmOrder}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'commandes' && (
          <Orders
            orders={orders}
            onTrackOrder={setSelectedOrderTracking}
          />
        )}

        {activeTab === 'seller-dashboard' && (
          <SellerDashboard
            onNavigate={handleNavigate}
            orders={orders}
            user={currentUser}
          />
        )}

        {activeTab === 'add-product' && (
          <AddProduct
            onAddProduct={handleAddProduct}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'seller-products' && (
          <SellerProducts
            products={products}
            onNavigate={handleNavigate}
            onToggleProductStatus={handleToggleProductStatus}
          />
        )}

        {activeTab === 'profil' && (
          <Profile
            user={currentUser}
            onNavigate={handleNavigate}
            onOpenAuth={(mode) => {
              setAuthModalMode(mode);
              setIsAuthModalOpen(true);
            }}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Modals */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {selectedOrderTracking && (
        <OrderTrackingModal
          order={selectedOrderTracking}
          onClose={() => setSelectedOrderTracking(null)}
        />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        initialMode={authModalMode}
        onClose={() => setIsAuthModalOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* Bottom Sticky Navigation */}
      <BottomNav
        activeTab={activeTab}
        onNavigate={handleNavigate}
        cartCount={cartCount}
      />

    </div>
  );
}
