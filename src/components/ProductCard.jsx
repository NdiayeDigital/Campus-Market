import React from 'react';

export default function ProductCard({ product, onSelect, onAddToCart }) {
  const { title, price, oldPrice, discount, image, icon, color } = product;

  return (
    <article
      className="product-card product-card-custom"
      style={{ position: 'relative', cursor: 'pointer', background: 'white', borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden' }}
      onClick={() => onSelect(product)}
    >
      {discount && <div className="product-discount-badge">{discount}</div>}

      <div className="product-card-img-container" style={{ height: '140px', overflow: 'hidden', background: '#F8FAFC' }}>
        {image ? (
          <img src={image} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div className="product-card-icon-container" style={{ backgroundColor: color || 'var(--color-primary)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '32px' }}>
            <i className={`fa-solid ${icon || 'fa-box'}`}></i>
          </div>
        )}
      </div>

      <div className="product-info" style={{ padding: '12px' }}>
        <h4 className="product-card-title" style={{ fontSize: '0.9rem', fontWeight: '700', margin: '0 0 6px', color: '#0F172A', lineClamp: 1, display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {title}
        </h4>

        <div className="product-card-price-row" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
          <span className="product-card-price" style={{ fontWeight: '800', color: 'var(--color-primary)', fontSize: '0.95rem' }}>
            {price.toLocaleString('fr-FR')} FCFA
          </span>
          {oldPrice && (
            <span className="product-old-price" style={{ textDecoration: 'line-through', color: '#94A3B8', fontSize: '0.78rem' }}>
              {oldPrice.toLocaleString('fr-FR')}
            </span>
          )}
        </div>

        <button
          className="btn-add btn-add-to-cart"
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart(product);
          }}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '99px',
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            fontWeight: '600',
            fontSize: '0.82rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <i className="fa-solid fa-plus"></i> Ajouter
        </button>
      </div>
    </article>
  );
}
