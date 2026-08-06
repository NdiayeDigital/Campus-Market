import React from 'react';
import { CATEGORIES } from '../data/mockData';

export default function Categories({ onNavigate, onSelectCategory }) {
  return (
    <div id="view-categories" className="spa-view active" style={{ display: 'block', paddingBottom: '90px' }}>
      
      {/* Title */}
      <div style={{ padding: '20px 20px 10px', background: 'white' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '800', margin: 0, color: '#0F172A' }}>Catégories</h1>
      </div>

      {/* Grid of Categories */}
      <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
        {CATEGORIES.map((cat) => (
          <div
            key={cat.id}
            onClick={() => {
              onSelectCategory(cat.id);
              onNavigate('accueil');
            }}
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '20px 16px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '20px',
                background: cat.bg,
                color: cat.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                marginBottom: '14px'
              }}
            >
              <i className={`fa-solid ${cat.icon}`}></i>
            </div>

            <h3 style={{ fontSize: '0.95rem', fontWeight: '700', margin: '0 0 4px', color: '#0F172A' }}>
              {cat.name}
            </h3>

            <span style={{ fontSize: '0.78rem', color: '#94A3B8', fontWeight: '500' }}>
              {cat.count}
            </span>
          </div>
        ))}
      </div>

      {/* Blue Vendor Callout Card */}
      <div style={{ padding: '0 20px' }}>
        <div
          style={{
            background: '#1D4ED8',
            borderRadius: '24px',
            padding: '24px',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxShadow: '0 8px 20px rgba(29, 78, 216, 0.25)'
          }}
        >
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '0 0 6px', color: 'white' }}>Vendez gratuitement</h3>
            <p style={{ fontSize: '0.82rem', opacity: 0.9, margin: '0 0 14px', lineHeight: '1.4' }}>
              Créez votre boutique et commencez à vendre en quelques minutes !
            </p>
            <button
              onClick={() => onNavigate('seller-dashboard')}
              style={{
                background: 'white',
                color: '#1D4ED8',
                border: 'none',
                padding: '8px 20px',
                borderRadius: '99px',
                fontWeight: '800',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Commencer
            </button>
          </div>

          <div style={{ fontSize: '48px', opacity: 0.9 }}>
            <i className="fa-solid fa-store"></i>
          </div>
        </div>
      </div>

    </div>
  );
}
