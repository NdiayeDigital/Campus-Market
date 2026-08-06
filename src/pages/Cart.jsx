import React from 'react';

export default function Cart({ cartItems, onUpdateQuantity, onRemoveItem, onNavigate }) {
  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const deliveryFee = cartItems.length > 0 ? 500 : 0;
  const total = subtotal + deliveryFee;

  return (
    <div id="view-panier" className="spa-view active" style={{ display: 'block', paddingBottom: '90px' }}>
      
      {/* Title Header */}
      <div style={{ padding: '20px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: '#0F172A' }}>Mon panier</h1>
          <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: '600' }}>
            {cartItems.reduce((acc, item) => acc + item.quantity, 0)} article(s)
          </span>
        </div>

        {cartItems.length > 0 && (
          <button
            onClick={() => cartItems.forEach(i => onRemoveItem(i.id))}
            style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '1.1rem', cursor: 'pointer' }}
          >
            <i className="fa-regular fa-trash-can"></i>
          </button>
        )}
      </div>

      {cartItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94A3B8' }}>
          <i className="fa-solid fa-cart-shopping" style={{ fontSize: '54px', marginBottom: '16px', opacity: 0.4 }}></i>
          <h3 style={{ fontSize: '1.2rem', color: '#0F172A', marginBottom: '8px' }}>Votre panier est vide</h3>
          <p style={{ fontSize: '0.9rem', marginBottom: '24px' }}>Découvrez nos délicieux plats et articles campus.</p>
          <button
            onClick={() => onNavigate('accueil')}
            className="btn btn-primary"
            style={{ padding: '12px 28px', borderRadius: '99px', fontWeight: '700' }}
          >
            Découvrir les offres
          </button>
        </div>
      ) : (
        <div style={{ padding: '20px' }}>
          
          {/* Cart Items List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
            {cartItems.map((item) => (
              <div
                key={item.id}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                }}
              >
                <div style={{ width: '64px', height: '64px', borderRadius: '12px', overflow: 'hidden', background: '#F8FAFC', flexShrink: 0 }}>
                  {item.image ? (
                    <img src={item.image} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: item.color || 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'white', fontSize: '24px' }}>
                      <i className={`fa-solid ${item.icon || 'fa-box'}`}></i>
                    </div>
                  )}
                </div>

                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: '700', margin: '0 0 4px', color: '#0F172A' }}>{item.title}</h4>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>Par {item.seller || "Fatou's Kitchen"}</div>
                  <div style={{ fontWeight: '800', color: 'var(--color-primary)', fontSize: '0.95rem' }}>
                    {item.price.toLocaleString('fr-FR')} FCFA
                  </div>
                </div>

                <div className="qty-selector-pill" style={{ background: '#F1F5F9', padding: '4px 8px' }}>
                  <button className="qty-btn" onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}>-</button>
                  <span className="qty-value">{item.quantity}</span>
                  <button className="qty-btn" onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}>+</button>
                </div>
              </div>
            ))}
          </div>

          {/* Delivery Info Banner */}
          <div
            style={{
              padding: '14px 16px',
              background: '#EFF6FF',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              border: '1px solid rgba(29,78,216,0.1)',
              marginBottom: '24px'
            }}
          >
            <div style={{ width: '38px', height: '38px', background: 'var(--color-primary)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'white', fontSize: '18px' }}>
              <i className="fa-solid fa-lightbulb"></i>
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.88rem', color: '#0F172A' }}>Livraison pavillon-à-pavillon</div>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>Rapide et sécurisée</div>
            </div>
          </div>

          {/* Summary Breakdown */}
          <div className="cart-summary" style={{ background: 'white', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
            <div className="cart-summary-row" style={{ display: 'flex', justifyBetween: 'space-between', marginBottom: '10px', fontSize: '0.9rem', color: '#64748B' }}>
              <span>Sous-total</span>
              <span style={{ fontWeight: '600', color: '#0F172A' }}>{subtotal.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="cart-summary-row" style={{ display: 'flex', justifyBetween: 'space-between', marginBottom: '12px', fontSize: '0.9rem', color: '#64748B' }}>
              <span>Livraison</span>
              <span style={{ fontWeight: '600', color: '#0F172A' }}>{deliveryFee.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="cart-summary-row total" style={{ display: 'flex', justifyBetween: 'space-between', paddingTop: '12px', borderTop: '1px dashed #E2E8F0', fontSize: '1.1rem', fontWeight: '800', color: '#0F172A' }}>
              <span>Total</span>
              <span style={{ color: 'var(--color-primary)' }}>{total.toLocaleString('fr-FR')} FCFA</span>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            onClick={() => onNavigate('checkout')}
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '16px',
              borderRadius: '99px',
              fontWeight: '800',
              fontSize: '1rem',
              boxShadow: '0 6px 16px rgba(29, 78, 216, 0.3)'
            }}
          >
            Passer la commande
          </button>

        </div>
      )}

    </div>
  );
}
