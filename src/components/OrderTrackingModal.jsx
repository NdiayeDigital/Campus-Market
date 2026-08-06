import React from 'react';

export default function OrderTrackingModal({ order, onClose }) {
  if (!order) return null;

  const courier = order.courier || {
    name: 'Mamadou Diallo',
    rating: 4.9,
    phone: '77 987 65 43',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop'
  };

  const steps = [
    { key: 'confirmed', title: 'Commande confirmée', time: '10:30 - 12 Mai 2024', status: 'completed' },
    { key: 'processing', title: 'En préparation', time: '10:45 - 12 Mai 2024', status: 'completed' },
    { key: 'shipped', title: 'En cours de livraison', time: '11:20 - 12 Mai 2024', status: 'active' },
    { key: 'delivered', title: 'Livrée', time: 'En attente', status: 'pending' }
  ];

  return (
    <div className="campus-modal-overlay" style={{ display: 'flex', zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="campus-modal" style={{ width: '100%', maxWidth: '480px', background: 'white', borderRadius: '24px', padding: '24px', overflowY: 'auto', maxHeight: '90vh' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' }}>Suivi en direct</span>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: '2px 0 0', color: '#0F172A' }}>Ma commande #{order.id}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ background: '#F1F5F9', border: 'none', width: '36px', height: '36px', borderRadius: '50%' }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Status Banner */}
        <div style={{ background: '#ECFDF5', border: '1px solid #10B981', borderRadius: '16px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '36px', height: '36px', background: '#10B981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', color: 'white', fontSize: '18px' }}>
            <i className="fa-solid fa-truck-fast"></i>
          </div>
          <div>
            <div style={{ fontWeight: '800', fontSize: '0.9rem', color: '#065F46' }}>En cours de livraison</div>
            <div style={{ fontSize: '0.78rem', color: '#047857' }}>Votre commande est en route 🚀</div>
          </div>
        </div>

        {/* Tracking Stepper */}
        <div className="tracking-stepper">
          {steps.map((step, idx) => (
            <div key={step.key} className={`tracking-step ${step.status}`}>
              <div className="tracking-step-node">
                {step.status === 'completed' && <i className="fa-solid fa-check"></i>}
                {step.status === 'active' && <i className="fa-solid fa-motorcycle"></i>}
                {step.status === 'pending' && (idx + 1)}
              </div>
              <div className="tracking-step-title" style={{ color: step.status === 'pending' ? '#94A3B8' : '#0F172A' }}>
                {step.title}
              </div>
              <div className="tracking-step-time">{step.time}</div>
            </div>
          ))}
        </div>

        {/* Courier Info Card */}
        <div className="delivery-agent-card">
          <div className="delivery-agent-info">
            <img src={courier.avatar} alt={courier.name} className="delivery-agent-avatar" />
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: '600' }}>Livreur</div>
              <div className="delivery-agent-name">{courier.name}</div>
              <div className="delivery-agent-rating">★ {courier.rating}</div>
            </div>
          </div>
          <a
            href={`tel:${courier.phone}`}
            className="icon-btn"
            style={{ background: '#EFF6FF', color: 'var(--color-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '50%' }}
          >
            <i className="fa-solid fa-phone"></i>
          </a>
        </div>

        {/* Articles List */}
        <div style={{ margin: '20px 0' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: '700', margin: '0 0 12px', color: '#0F172A' }}>Articles ({order.items?.length || 2})</h4>
          {order.items?.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #F1F5F9', fontSize: '0.85rem' }}>
              <span>{item.qty}x {item.title}</span>
              <span style={{ fontWeight: '700' }}>{(item.price * item.qty).toLocaleString('fr-FR')} FCFA</span>
            </div>
          ))}
        </div>

        {/* Contact Courier Button */}
        <a
          href={`https://wa.me/221${courier.phone.replace(/\s+/g, '')}`}
          target="_blank"
          rel="noreferrer"
          className="btn btn-primary"
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: '99px',
            textAlign: 'center',
            textDecoration: 'none',
            fontWeight: '700',
            fontSize: '0.92rem',
            background: '#25D366',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
        >
          <i className="fa-brands fa-whatsapp"></i> Contacter le livreur
        </a>

      </div>
    </div>
  );
}
