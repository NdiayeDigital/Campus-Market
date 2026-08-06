import React from 'react';

export default function Profile({ user, onNavigate, onOpenAuth, onLogout }) {
  const profileUser = user || {
    name: 'Étudiant Acheteur',
    email: 'Non connecté',
    phone: 'Aucun compte requis pour commander'
  };

  return (
    <div id="view-profil" className="spa-view active" style={{ display: 'block', paddingBottom: '90px' }}>
      
      {/* Header */}
      <div style={{ padding: '20px', background: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: '#0F172A' }}>Mon profil</h1>
        <button className="icon-btn" style={{ background: '#F1F5F9', border: 'none', width: '38px', height: '38px', borderRadius: '50%' }}>
          <i className="fa-solid fa-gear"></i>
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        
        {/* User Profile Card */}
        <div style={{ background: 'white', borderRadius: '24px', padding: '24px', textAlign: 'center', border: '1px solid #E2E8F0', marginBottom: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: '#E0E7FF',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              margin: '0 auto 12px',
              border: '3px solid var(--color-primary)'
            }}
          >
            <i className="fa-solid fa-user"></i>
          </div>

          <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: '0 0 4px', color: '#0F172A' }}>
            {user ? `${user.user_metadata?.prenom || ''} ${user.user_metadata?.nom || ''}` : profileUser.name}
          </h2>
          <div style={{ fontSize: '0.85rem', color: '#64748B', marginBottom: '2px' }}>
            {user ? (user.user_metadata?.boutique || user.user_metadata?.telephone) : profileUser.phone}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#94A3B8', marginBottom: '16px' }}>
            {user ? user.email : profileUser.email}
          </div>

          {user ? (
            <button
              onClick={() => onNavigate('seller-dashboard')}
              style={{
                padding: '8px 20px',
                borderRadius: '99px',
                border: 'none',
                background: 'var(--color-primary)',
                color: 'white',
                fontWeight: '700',
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Mon Tableau de Bord Vendeur
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={() => onOpenAuth('login')}
                style={{
                  padding: '8px 18px',
                  borderRadius: '99px',
                  border: '1.5px solid var(--color-primary)',
                  color: 'var(--color-primary)',
                  background: 'white',
                  fontWeight: '700',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Se connecter
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                style={{
                  padding: '8px 18px',
                  borderRadius: '99px',
                  border: 'none',
                  background: '#F59E0B',
                  color: '#0F172A',
                  fontWeight: '800',
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Créer boutique
              </button>
            </div>
          )}
        </div>

        {/* Menu Items Group */}
        <div className="profile-menu-group" style={{ background: 'white', borderRadius: '20px', border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: '16px' }}>
          <div onClick={() => onNavigate('commandes')} className="profile-menu-item" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}>
            <i className="fa-solid fa-box" style={{ width: '24px', color: 'var(--color-primary)' }}></i>
            <span style={{ flex: 1, fontWeight: '600', fontSize: '0.92rem', color: '#0F172A' }}>Mes commandes</span>
            <i className="fa-solid fa-chevron-right" style={{ color: '#CBD5E1', fontSize: '0.8rem' }}></i>
          </div>

          <div className="profile-menu-item" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}>
            <i className="fa-solid fa-location-dot" style={{ width: '24px', color: 'var(--color-primary)' }}></i>
            <span style={{ flex: 1, fontWeight: '600', fontSize: '0.92rem', color: '#0F172A' }}>Adresses de livraison</span>
            <i className="fa-solid fa-chevron-right" style={{ color: '#CBD5E1', fontSize: '0.8rem' }}></i>
          </div>

          <div className="profile-menu-item" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' }}>
            <i className="fa-solid fa-credit-card" style={{ width: '24px', color: 'var(--color-primary)' }}></i>
            <span style={{ flex: 1, fontWeight: '600', fontSize: '0.92rem', color: '#0F172A' }}>Modes de paiement</span>
            <i className="fa-solid fa-chevron-right" style={{ color: '#CBD5E1', fontSize: '0.8rem' }}></i>
          </div>
        </div>

        {/* Vendor Banner */}
        <div className="profile-menu-group" style={{ marginBottom: '16px' }}>
          <div
            onClick={() => {
              if (user) {
                onNavigate('seller-dashboard');
              } else {
                onOpenAuth('register');
              }
            }}
            style={{
              background: '#EFF6FF',
              border: '1px solid rgba(29,78,216,0.2)',
              borderRadius: '20px',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer'
            }}
          >
            <i className="fa-solid fa-store" style={{ width: '24px', color: 'var(--color-primary)', fontSize: '18px' }}></i>
            <span style={{ flex: 1, fontWeight: '700', fontSize: '0.92rem', color: 'var(--color-primary)' }}>
              {user ? 'Mon Espace Vendeur' : 'Vendre sur Campus Market'}
            </span>
            <i className="fa-solid fa-chevron-right" style={{ color: 'var(--color-primary)', fontSize: '0.8rem' }}></i>
          </div>
        </div>

        <div className="profile-menu-group" style={{ background: 'white', borderRadius: '20px', border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: '24px' }}>
          <div className="profile-menu-item" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: user ? '1px solid #F1F5F9' : 'none', cursor: 'pointer' }}>
            <i className="fa-solid fa-circle-question" style={{ width: '24px', color: '#64748B' }}></i>
            <span style={{ flex: 1, fontWeight: '600', fontSize: '0.92rem', color: '#0F172A' }}>Aide & Support</span>
            <i className="fa-solid fa-chevron-right" style={{ color: '#CBD5E1', fontSize: '0.8rem' }}></i>
          </div>

          {user && (
            <div onClick={onLogout} className="profile-menu-item danger" style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', color: '#EF4444', cursor: 'pointer' }}>
              <i className="fa-solid fa-right-from-bracket" style={{ width: '24px', color: '#EF4444' }}></i>
              <span style={{ flex: 1, fontWeight: '700', fontSize: '0.92rem' }}>Déconnexion</span>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
