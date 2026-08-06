import React, { useState } from 'react';

export default function SellerProducts({ products, onNavigate, onToggleProductStatus }) {
  const [activeTab, setActiveTab] = useState('tous');

  const filteredProducts = products.filter((p) => {
    if (activeTab === 'tous') return true;
    if (activeTab === 'enligne') return p.status === 'en_ligne' || !p.status;
    if (activeTab === 'horsligne') return p.status === 'hors_ligne';
    return true;
  });

  return (
    <div id="view-seller-products" className="spa-view active" style={{ display: 'block', paddingBottom: '90px' }}>
      
      {/* Header */}
      <div style={{ padding: '20px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: '#0F172A' }}>Mes produits</h1>
        <button
          onClick={() => onNavigate('add-product')}
          className="icon-btn"
          style={{ background: 'var(--color-primary)', color: 'white', border: 'none', width: '38px', height: '38px', borderRadius: '50%', fontSize: '18px' }}
        >
          <i className="fa-solid fa-plus"></i>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', padding: '12px 20px', overflowX: 'auto', background: 'white', borderBottom: '1px solid #F1F5F9' }}>
        <button className={`category-chip ${activeTab === 'tous' ? 'active' : ''}`} onClick={() => setActiveTab('tous')}>
          Tous
        </button>
        <button className={`category-chip ${activeTab === 'enligne' ? 'active' : ''}`} onClick={() => setActiveTab('enligne')}>
          En ligne
        </button>
        <button className={`category-chip ${activeTab === 'horsligne' ? 'active' : ''}`} onClick={() => setActiveTab('horsligne')}>
          Hors ligne
        </button>
      </div>

      {/* Product List */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredProducts.map((p) => {
          const isOnline = p.status === 'en_ligne' || !p.status;
          return (
            <div
              key={p.id}
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '12px 14px',
                border: '1px solid #E2E8F0',
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}
            >
              <div style={{ width: '60px', height: '60px', borderRadius: '12px', overflow: 'hidden', background: '#F8FAFC', flexShrink: 0 }}>
                {p.image ? (
                  <img src={p.image} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: p.color || 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'white', fontSize: '20px' }}>
                    <i className={`fa-solid ${p.icon || 'fa-box'}`}></i>
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: '700', margin: '0 0 4px', color: '#0F172A' }}>{p.title}</h4>
                <div style={{ fontWeight: '800', color: 'var(--color-primary)', fontSize: '0.9rem', marginBottom: '4px' }}>
                  {p.price.toLocaleString('fr-FR')} FCFA
                </div>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '99px',
                    fontSize: '0.72rem',
                    fontWeight: '700',
                    background: isOnline ? '#ECFDF5' : '#F1F5F9',
                    color: isOnline ? '#10B981' : '#64748B'
                  }}
                >
                  {isOnline ? 'En ligne' : 'Hors ligne'}
                </span>
              </div>

              <button
                onClick={() => onToggleProductStatus(p.id)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.2rem', cursor: 'pointer', padding: '8px' }}
              >
                <i className="fa-solid fa-ellipsis-vertical"></i>
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}
