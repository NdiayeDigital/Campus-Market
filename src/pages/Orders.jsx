import React, { useState } from 'react';

export default function Orders({ orders, onTrackOrder }) {
  const [activeFilter, setActiveFilter] = useState('all');

  const filteredOrders = orders.filter((o) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'encours') return o.status === 'pending' || o.status === 'processing' || o.status === 'shipped';
    if (activeFilter === 'terminee') return o.status === 'delivered';
    if (activeFilter === 'annulee') return o.status === 'cancelled';
    return true;
  });

  return (
    <div id="view-commandes" className="spa-view active" style={{ display: 'block', paddingBottom: '90px' }}>
      
      {/* Title */}
      <div style={{ padding: '20px 20px 10px', background: 'white' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0, color: '#0F172A' }}>Mes commandes</h1>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', padding: '12px 20px', overflowX: 'auto', background: 'white', borderBottom: '1px solid #F1F5F9' }}>
        <button
          className={`category-chip ${activeFilter === 'all' ? 'active' : ''}`}
          onClick={() => setActiveFilter('all')}
        >
          Toutes
        </button>
        <button
          className={`category-chip ${activeFilter === 'encours' ? 'active' : ''}`}
          onClick={() => setActiveFilter('encours')}
        >
          En cours
        </button>
        <button
          className={`category-chip ${activeFilter === 'terminee' ? 'active' : ''}`}
          onClick={() => setActiveFilter('terminee')}
        >
          Terminées
        </button>
        <button
          className={`category-chip ${activeFilter === 'annulee' ? 'active' : ''}`}
          onClick={() => setActiveFilter('annulee')}
        >
          Annulées
        </button>
      </div>

      {/* Orders List */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {filteredOrders.map((order) => (
          <div
            key={order.id}
            onClick={() => onTrackOrder(order)}
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '16px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0F172A' }}>#{order.id}</span>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: '99px',
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  background: order.status === 'shipped' ? '#EFF6FF' : order.status === 'delivered' ? '#ECFDF5' : order.status === 'cancelled' ? '#FEF2F2' : '#FEF3C7',
                  color: order.status === 'shipped' ? '#1D4ED8' : order.status === 'delivered' ? '#10B981' : order.status === 'cancelled' ? '#EF4444' : '#D97706'
                }}
              >
                {order.statusText}
              </span>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '12px' }}>{order.date}</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px dashed #F1F5F9' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748B' }}>{order.itemsCount} article(s)</span>
              <span style={{ fontWeight: '800', color: 'var(--color-primary)', fontSize: '1rem' }}>
                {order.total.toLocaleString('fr-FR')} FCFA
              </span>
            </div>
          </div>
        ))}

        {filteredOrders.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94A3B8' }}>
            <i className="fa-solid fa-box-open" style={{ fontSize: '42px', marginBottom: '12px', opacity: 0.5 }}></i>
            <p>Aucune commande dans cette rubrique.</p>
          </div>
        )}
      </div>

    </div>
  );
}
