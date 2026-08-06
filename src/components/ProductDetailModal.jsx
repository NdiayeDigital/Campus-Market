import React, { useState } from 'react';

export default function ProductDetailModal({ product, onClose, onAddToCart }) {
  const [quantity, setQuantity] = useState(1);
  const [selectedPavillon, setSelectedPavillon] = useState('A1');

  if (!product) return null;

  const { title, price, oldPrice, discount, seller, isTopSeller, rating, reviewsCount, description, prepTime, deliveryFee, pavillons, image } = product;
  const pavillonList = pavillons || ['A1', 'A2', 'A3', 'A4', 'B1'];

  const handleAdd = () => {
    onAddToCart(product, quantity, selectedPavillon);
    onClose();
  };

  return (
    <div className="campus-modal-overlay" style={{ display: 'flex', zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="campus-modal product-detail-modal-content" style={{ padding: 0, overflow: 'hidden', position: 'relative', width: '100%', maxWidth: '480px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header Image Gallery */}
        <div style={{ position: 'relative', height: '240px', background: '#F1F5F9' }}>
          <img src={image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop'} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          
          <div style={{ position: 'absolute', top: '16px', left: '16px', right: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button className="icon-btn" onClick={onClose} style={{ background: 'white', border: 'none', width: '36px', height: '36px', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
              <i className="fa-solid fa-chevron-left" style={{ color: '#0F172A' }}></i>
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="icon-btn" style={{ background: 'white', border: 'none', width: '36px', height: '36px', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                <i className="fa-regular fa-heart" style={{ color: '#0F172A' }}></i>
              </button>
              <button className="icon-btn" style={{ background: 'white', border: 'none', width: '36px', height: '36px', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
                <i className="fa-solid fa-share-nodes" style={{ color: '#0F172A' }}></i>
              </button>
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: '12px', right: '16px', background: 'rgba(0,0,0,0.6)', color: 'white', padding: '2px 8px', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 'bold' }}>
            1/4
          </div>
        </div>

        {/* Scrollable Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '800', margin: '0 0 6px', color: '#0F172A' }}>{title}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                <span style={{ color: '#64748B', fontWeight: '500' }}>Par {seller || "Fatou's Kitchen"}</span>
                {isTopSeller !== false && (
                  <span style={{ background: '#FEF3C7', color: '#D97706', padding: '2px 8px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: '700' }}>
                    Top vendeur
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Rating */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '12px 0 16px' }}>
            <span style={{ color: '#F59E0B', fontWeight: '700', fontSize: '0.9rem' }}>★ {rating || 4.8}</span>
            <span style={{ color: '#94A3B8', fontSize: '0.82rem' }}>({reviewsCount || 124} avis)</span>
          </div>

          {/* Price */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '16px' }}>
            <span style={{ fontSize: '1.4rem', fontWeight: '800', color: 'var(--color-primary)' }}>
              {price.toLocaleString('fr-FR')} FCFA
            </span>
            {oldPrice && (
              <span style={{ textDecoration: 'line-through', color: '#94A3B8', fontSize: '0.95rem' }}>
                {oldPrice.toLocaleString('fr-FR')} FCFA
              </span>
            )}
            {discount && (
              <span style={{ background: '#EF4444', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                {discount}
              </span>
            )}
          </div>

          {/* Description */}
          <p style={{ color: '#475569', fontSize: '0.9rem', lineHeight: '1.6', marginBottom: '20px' }}>
            {description || 'Délicieux thiéboudienne sénégalaise préparé avec amour ❤️'}
          </p>

          {/* Badges info */}
          <div style={{ display: 'flex', gap: '12px', background: '#F8FAFC', padding: '12px 16px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #E2E8F0' }}>
            <div style={{ fontSize: '0.82rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-regular fa-clock" style={{ color: 'var(--color-primary)' }}></i>
              <span>Préparation: <strong>{prepTime || '30-45 min'}</strong></span>
            </div>
            <div style={{ fontSize: '0.82rem', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-motorcycle" style={{ color: '#10B981' }}></i>
              <span>Livraison: <strong>{deliveryFee || 500} FCFA</strong></span>
            </div>
          </div>

          {/* Pavillons selection */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0F172A' }}>Pavillons disponibles</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-primary)', fontWeight: '600' }}>Voir tout</span>
            </div>
            <div className="pavillon-chips-container">
              {pavillonList.map((p) => (
                <button
                  key={p}
                  className={`pavillon-chip ${selectedPavillon === p ? 'active' : ''}`}
                  onClick={() => setSelectedPavillon(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Action Footer */}
        <div className="sticky-bottom-action-bar">
          <div className="qty-selector-pill">
            <button className="qty-btn" onClick={() => setQuantity(Math.max(1, quantity - 1))}>-</button>
            <span className="qty-value">{quantity}</span>
            <button className="qty-btn" onClick={() => setQuantity(quantity + 1)}>+</button>
          </div>

          <button
            className="btn btn-primary"
            onClick={handleAdd}
            style={{
              flex: 1,
              padding: '14px 20px',
              borderRadius: '99px',
              fontWeight: '700',
              fontSize: '0.95rem',
              boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)'
            }}
          >
            Ajouter au panier {(price * quantity).toLocaleString('fr-FR')} FCFA
          </button>
        </div>

      </div>
    </div>
  );
}
