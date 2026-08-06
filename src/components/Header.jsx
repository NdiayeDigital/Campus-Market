import React from 'react';

export default function Header({ onNavigate, onToggleSearch, cartCount = 0 }) {
  return (
    <header className="navbar" style={{ background: 'white', borderBottom: 'none' }}>
      <div
        className="navbar-container"
        style={{
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div className="logo" style={{ cursor: 'pointer' }} onClick={() => onNavigate('accueil')}>
          <img
            src="assets/logo.png"
            alt="Campus Market Logo"
            style={{
              width: '190px',
              height: '50px',
              objectFit: 'contain',
              objectPosition: 'left center',
              display: 'block'
            }}
          />
        </div>
        <div className="nav-actions" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <button
            className="icon-btn"
            onClick={onToggleSearch}
            aria-label="Rechercher"
            style={{ boxShadow: 'none', border: 'none', background: 'transparent', fontSize: '20px', color: 'var(--color-text-main)' }}
          >
            <i className="fa-solid fa-search"></i>
          </button>
          <button
            className="icon-btn"
            onClick={() => onNavigate('commandes')}
            aria-label="Notifications"
            style={{ boxShadow: 'none', border: 'none', background: 'transparent', fontSize: '20px', color: 'var(--color-text-main)', position: 'relative' }}
          >
            <i className="fa-regular fa-bell"></i>
            {cartCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  background: '#EF4444',
                  color: 'white',
                  borderRadius: '50%',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  width: '16px',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {cartCount}
              </span>
            )}
          </button>
          <button
            className="icon-btn"
            onClick={() => onNavigate('profil')}
            aria-label="Profil"
            style={{ boxShadow: 'none', border: 'none', background: 'transparent', fontSize: '20px', color: 'var(--color-text-main)' }}
          >
            <i className="fa-regular fa-user"></i>
          </button>
        </div>
      </div>
    </header>
  );
}
