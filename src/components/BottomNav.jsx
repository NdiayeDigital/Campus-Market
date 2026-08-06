import React from 'react';

export default function BottomNav({ activeTab, onNavigate, cartCount = 0 }) {
  const navItems = [
    { id: 'accueil', label: 'Accueil', icon: 'fa-house' },
    { id: 'categories', label: 'Catégories', icon: 'fa-grid-2' },
    { id: 'panier', label: 'Panier', icon: 'fa-bag-shopping', badge: cartCount },
    { id: 'commandes', label: 'Commandes', icon: 'fa-box' },
    { id: 'profil', label: 'Profil', icon: 'fa-user' }
  ];

  return (
    <nav className="bottom-nav" id="bottom-nav" style={{ display: 'flex' }}>
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
            style={{ position: 'relative' }}
          >
            <i className={`fa-solid ${item.icon}`}></i>
            <span>{item.label}</span>
            {item.badge > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: 'calc(50% - 16px)',
                  background: '#EF4444',
                  color: 'white',
                  borderRadius: '99px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  padding: '1px 5px',
                  minWidth: '16px',
                  textAlign: 'center'
                }}
              >
                {item.badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
