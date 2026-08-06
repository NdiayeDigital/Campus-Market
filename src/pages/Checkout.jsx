import React, { useState } from 'react';

export default function Checkout({ cartItems, onConfirmOrder, onNavigate }) {
  const [paymentMethod, setPaymentMethod] = useState('wave');
  const [pavillon, setPavillon] = useState('Pavillon A1');
  const [chambre, setChambre] = useState('Chambre 23');
  const [phone, setPhone] = useState('77 123 45 67');

  const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const deliveryFee = 500;
  const total = subtotal + deliveryFee;

  const handleSubmit = (e) => {
    e.preventDefault();
    onConfirmOrder({
      pavillon,
      chambre,
      phone,
      paymentMethod,
      total,
      items: cartItems
    });
  };

  return (
    <div id="view-checkout" className="spa-view active" style={{ display: 'block', paddingBottom: '90px' }}>
      
      {/* Title */}
      <div style={{ padding: '20px', background: 'white', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button className="icon-btn" onClick={() => onNavigate('panier')} style={{ background: '#F1F5F9', border: 'none', width: '36px', height: '36px', borderRadius: '50%' }}>
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: '#0F172A' }}>Passer la commande</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
        
        {/* Delivery Address Box */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '16px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>Livraison</span>
            <button type="button" style={{ color: 'var(--color-primary)', background: 'none', border: 'none', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}>Changer</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', background: '#EFF6FF', color: 'var(--color-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center' }}>
              <i className="fa-solid fa-location-dot"></i>
            </div>
            <div>
              <div style={{ fontWeight: '700', fontSize: '0.92rem', color: '#0F172A' }}>{pavillon}, {chambre}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748B' }}>UIDT, Thiès</div>
            </div>
          </div>
        </div>

        {/* Contact Phone Box */}
        <div style={{ background: 'white', borderRadius: '16px', padding: '16px', border: '1px solid #E2E8F0', marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' }}>Contact</span>
            <button type="button" style={{ color: 'var(--color-primary)', background: 'none', border: 'none', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}>Changer</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', background: '#EFF6FF', color: 'var(--color-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center' }}>
              <i className="fa-solid fa-phone"></i>
            </div>
            <div style={{ fontWeight: '700', fontSize: '0.92rem', color: '#0F172A' }}>{phone}</div>
          </div>
        </div>

        {/* Mode de paiement */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: '700', color: '#0F172A', marginBottom: '12px' }}>Mode de paiement</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* Wave */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                background: 'white',
                borderRadius: '14px',
                border: paymentMethod === 'wave' ? '2px solid var(--color-primary)' : '1px solid #E2E8F0',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#10B981', color: 'white', display: 'flex', alignItems: 'center', justifyCenter: 'center', fontWeight: 'bold' }}>
                  W
                </div>
                <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#0F172A' }}>Wave</span>
              </div>
              <input
                type="radio"
                name="payment"
                value="wave"
                checked={paymentMethod === 'wave'}
                onChange={() => setPaymentMethod('wave')}
              />
            </label>

            {/* Orange Money */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                background: 'white',
                borderRadius: '14px',
                border: paymentMethod === 'om' ? '2px solid var(--color-primary)' : '1px solid #E2E8F0',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F97316', color: 'white', display: 'flex', alignItems: 'center', justifyCenter: 'center', fontWeight: 'bold' }}>
                  OM
                </div>
                <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#0F172A' }}>Orange Money</span>
              </div>
              <input
                type="radio"
                name="payment"
                value="om"
                checked={paymentMethod === 'om'}
                onChange={() => setPaymentMethod('om')}
              />
            </label>

            {/* Cash */}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                background: 'white',
                borderRadius: '14px',
                border: paymentMethod === 'cash' ? '2px solid var(--color-primary)' : '1px solid #E2E8F0',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#64748B', color: 'white', display: 'flex', alignItems: 'center', justifyCenter: 'center' }}>
                  <i className="fa-solid fa-money-bill-wave"></i>
                </div>
                <span style={{ fontWeight: '700', fontSize: '0.9rem', color: '#0F172A' }}>Espèces à la livraison</span>
              </div>
              <input
                type="radio"
                name="payment"
                value="cash"
                checked={paymentMethod === 'cash'}
                onChange={() => setPaymentMethod('cash')}
              />
            </label>

          </div>
        </div>

        {/* Résumé de la commande */}
        <div style={{ background: 'white', padding: '16px', borderRadius: '16px', border: '1px solid #E2E8F0', marginBottom: '24px' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: '700', margin: '0 0 12px', color: '#0F172A' }}>Résumé de la commande</h4>
          <div style={{ display: 'flex', justifyBetween: 'space-between', marginBottom: '8px', fontSize: '0.88rem', color: '#64748B' }}>
            <span>Sous-total</span>
            <span>{subtotal.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <div style={{ display: 'flex', justifyBetween: 'space-between', marginBottom: '12px', fontSize: '0.88rem', color: '#64748B' }}>
            <span>Livraison</span>
            <span>{deliveryFee.toLocaleString('fr-FR')} FCFA</span>
          </div>
          <div style={{ display: 'flex', justifyBetween: 'space-between', paddingTop: '10px', borderTop: '1px dashed #E2E8F0', fontSize: '1.05rem', fontWeight: '800', color: '#0F172A' }}>
            <span>Total</span>
            <span style={{ color: 'var(--color-primary)' }}>{total.toLocaleString('fr-FR')} FCFA</span>
          </div>
        </div>

        {/* Primary Yellow/Orange Highlighted Button */}
        <button
          type="submit"
          className="btn"
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '99px',
            fontWeight: '800',
            fontSize: '1rem',
            background: '#F59E0B',
            color: '#0F172A',
            border: 'none',
            boxShadow: '0 6px 16px rgba(245, 158, 11, 0.35)',
            cursor: 'pointer'
          }}
        >
          Confirmer la commande ({total.toLocaleString('fr-FR')} FCFA)
        </button>

      </form>

    </div>
  );
}
