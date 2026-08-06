import React, { useState } from 'react';
import ProductCard from '../components/ProductCard';
import { CATEGORIES } from '../data/mockData';

export default function Home({ products, onSelectProduct, onAddToCart, onNavigate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');

  const filteredProducts = products.filter((p) => {
    const matchesCategory = activeCategory === 'all' || p.category === activeCategory;
    const matchesSearch = p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          p.seller.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div id="view-accueil" className="spa-view active" style={{ display: 'block', paddingBottom: '90px' }}>
      
      {/* Hero Header */}
      <section className="hero-section" style={{ padding: '20px 24px 10px', background: 'white', textAlign: 'left' }}>
        <div
          style={{
            display: 'inline-block',
            padding: '4px 12px',
            backgroundColor: '#E0E7FF',
            color: '#4F46E5',
            borderRadius: '4px',
            fontSize: '0.7rem',
            fontWeight: '800',
            textTransform: 'uppercase',
            marginBottom: '14px',
            letterSpacing: '0.5px'
          }}
        >
          LA MARKETPLACE EXCLUSIVE
        </div>

        <h1 style={{ fontSize: '2.1rem', fontWeight: '800', lineHeight: '1.15', marginBottom: '14px', color: '#0F172A' }}>
          Des étudiants,<br />
          <span style={{ color: 'var(--color-primary)' }}>Pour les étudiants</span>
        </h1>

        <p style={{ fontSize: '0.92rem', color: '#64748B', marginBottom: '20px', lineHeight: '1.5' }}>
          Achetez, vendez et faites-vous livrer dans tout le campus de l'UIDT.
        </p>

        {/* Global Search Bar */}
        <div
          className="search-input-wrapper"
          style={{
            marginBottom: '24px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
            borderRadius: '99px',
            display: 'flex',
            alignItems: 'center',
            background: '#F8FAFC',
            padding: '0 16px',
            border: '1px solid #E2E8F0'
          }}
        >
          <i className="fa-solid fa-search search-icon" style={{ color: '#94A3B8', fontSize: '1rem' }}></i>
          <input
            type="text"
            id="global-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher un produit, un vendeur..."
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              padding: '14px 12px',
              width: '100%',
              outline: 'none',
              fontSize: '0.9rem'
            }}
          />
        </div>
      </section>

      {/* Main Container */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', background: 'var(--color-bg)', borderTopLeftRadius: '28px', borderTopRightRadius: '28px', paddingTop: '20px' }}>
        
        {/* Categories Row (Circular Icons) */}
        <section className="categories-section" style={{ padding: '0 24px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center', gap: '8px' }}>
            {CATEGORIES.slice(0, 5).map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <div
                  key={cat.id}
                  className={`category-chip ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveCategory(isActive ? 'all' : cat.id)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    padding: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      background: isActive ? cat.color : 'white',
                      color: isActive ? 'white' : cat.color,
                      borderRadius: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '22px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                      transition: 'all 0.2s'
                    }}
                  >
                    <i className={`fa-solid ${cat.icon}`}></i>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: isActive ? '700' : '600', color: isActive ? cat.color : '#334155' }}>
                    {cat.id === 'plats' ? 'Plats' : cat.id === 'fashion' ? 'Vêtements' : cat.id === 'jewelry' ? 'Bijoux' : cat.id === 'school' ? 'Fournitures' : 'Plus'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Meilleures Offres Grid */}
        <section className="feed-section" style={{ padding: '0 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: '#0F172A' }}>Meilleures offres 🔥</h3>
            <button
              onClick={() => onNavigate('categories')}
              style={{ color: '#64748B', fontSize: '0.85rem', fontWeight: '600', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Voir tout
            </button>
          </div>

          <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={onSelectProduct}
                onAddToCart={onAddToCart}
              />
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94A3B8' }}>
              <i className="fa-solid fa-box-open" style={{ fontSize: '42px', marginBottom: '12px', opacity: 0.5 }}></i>
              <p style={{ margin: 0 }}>Aucun produit ne correspond à votre recherche.</p>
            </div>
          )}
        </section>

        {/* Devenir Vendeur Callout */}
        <section
          style={{
            margin: '32px 20px 20px',
            background: 'linear-gradient(135deg, var(--color-primary) 0%, #1E3A8A 100%)',
            borderRadius: '24px',
            padding: '32px 20px',
            textAlign: 'center',
            color: 'white',
            boxShadow: '0 10px 25px rgba(29, 78, 216, 0.25)'
          }}
        >
          <div style={{ width: '64px', height: '64px', background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', margin: '0 auto 16px' }}>
            <i className="fa-solid fa-store"></i>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '10px' }}>Vendez gratuitement</h2>
          <p style={{ fontSize: '0.9rem', opacity: 0.9, marginBottom: '24px', lineHeight: '1.5' }}>
            Créez votre boutique et commencez à vendre vos produits à tous les étudiants en quelques minutes !
          </p>
          <button
            onClick={() => onNavigate('seller-dashboard')}
            className="btn"
            style={{
              backgroundColor: '#F59E0B',
              color: '#0F172A',
              padding: '14px 28px',
              fontSize: '0.95rem',
              fontWeight: '800',
              borderRadius: '99px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Commencer
          </button>
        </section>

      </div>
    </div>
  );
}
