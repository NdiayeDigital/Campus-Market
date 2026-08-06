import React from 'react';

export default function SellerDashboard({ onNavigate, orders }) {
  const sellerStats = {
    todaySales: 18750,
    growth: '+24% vs hier',
    pending: 12,
    onlineProducts: 24,
    todayViews: 156
  };

  return (
    <div id="view-admin" className="spa-view active" style={{ display: 'block', paddingBottom: '90px' }}>
      
      {/* Top Header */}
      <div style={{ padding: '20px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img
            src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop"
            alt="Avatar"
            style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover' }}
          />
          <div>
            <h1 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: '#0F172A' }}>Bonjour, Fatou! 👋</h1>
            <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: '600' }}>Fatou's Kitchen</span>
          </div>
        </div>

        <button className="icon-btn" style={{ background: '#F1F5F9', border: 'none', width: '40px', height: '40px', borderRadius: '50%', position: 'relative' }}>
          <i className="fa-regular fa-bell"></i>
          <span style={{ position: 'absolute', top: '4px', right: '4px', width: '10px', height: '10px', background: '#EF4444', borderRadius: '50%' }}></span>
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        
        {/* Sales Card with SVG line graph curve */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--color-primary) 0%, #1E3A8A 100%)',
            borderRadius: '24px',
            padding: '24px',
            color: 'white',
            marginBottom: '20px',
            boxShadow: '0 10px 25px rgba(29, 78, 216, 0.25)'
          }}
        >
          <div style={{ fontSize: '0.82rem', opacity: 0.85, marginBottom: '6px' }}>Ventes aujourd'hui</div>
          <div style={{ fontSize: '2rem', fontWeight: '800', marginBottom: '4px' }}>
            {sellerStats.todaySales.toLocaleString('fr-FR')} FCFA
          </div>
          <div style={{ fontSize: '0.8rem', color: '#6EE7B7', fontWeight: '700', marginBottom: '16px' }}>
            {sellerStats.growth}
          </div>

          {/* SVG Line Graph */}
          <div style={{ height: '60px', width: '100%' }}>
            <svg width="100%" height="100%" viewBox="0 0 300 60" style={{ overflow: 'visible' }}>
              <path
                d="M 0 50 Q 50 30, 100 40 T 200 15 T 300 10 L 300 60 L 0 60 Z"
                fill="rgba(255, 255, 255, 0.15)"
              />
              <path
                d="M 0 50 Q 50 30, 100 40 T 200 15 T 300 10"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="300" cy="10" r="4" fill="white" />
            </svg>
          </div>
        </div>

        {/* Metrics KPI Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
          <div style={{ background: 'white', padding: '16px 12px', borderRadius: '16px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '600', marginBottom: '4px' }}>Commandes</div>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#0F172A' }}>{sellerStats.pending}</div>
            <div style={{ fontSize: '0.7rem', color: '#F59E0B', fontWeight: '700' }}>en cours</div>
          </div>

          <div style={{ background: 'white', padding: '16px 12px', borderRadius: '16px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '600', marginBottom: '4px' }}>Produits</div>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#0F172A' }}>{sellerStats.onlineProducts}</div>
            <div style={{ fontSize: '0.7rem', color: '#10B981', fontWeight: '700' }}>en ligne</div>
          </div>

          <div style={{ background: 'white', padding: '16px 12px', borderRadius: '16px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
            <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '600', marginBottom: '4px' }}>Vues</div>
            <div style={{ fontSize: '1.3rem', fontWeight: '800', color: '#0F172A' }}>{sellerStats.todayViews}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-primary)', fontWeight: '700' }}>aujourd'hui</div>
          </div>
        </div>

        {/* Commandes récentes */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '800', margin: 0, color: '#0F172A' }}>Commandes récentes</h3>
            <button onClick={() => onNavigate('commandes')} style={{ background: 'none', border: 'none', color: '#64748B', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer' }}>
              Voir tout
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {orders.slice(0, 3).map((order) => (
              <div
                key={order.id}
                style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '14px',
                  border: '1px solid #E2E8F0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#0F172A' }}>#{order.id}</div>
                  <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>{order.deliveryAddress}</div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <span
                    style={{
                      padding: '3px 8px',
                      borderRadius: '99px',
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      background: order.status === 'shipped' ? '#EFF6FF' : order.status === 'delivered' ? '#ECFDF5' : '#FEF3C7',
                      color: order.status === 'shipped' ? '#1D4ED8' : order.status === 'delivered' ? '#10B981' : '#D97706',
                      display: 'inline-block',
                      marginBottom: '4px'
                    }}
                  >
                    {order.statusText}
                  </span>
                  <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#0F172A' }}>
                    {order.total.toLocaleString('fr-FR')} FCFA
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button: Publier un produit */}
        <button
          onClick={() => onNavigate('add-product')}
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
          + Publier le produit
        </button>

      </div>
    </div>
  );
}
