import React, { useState } from 'react';

export default function AuthModal({ isOpen, onClose, onLoginSuccess, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' or 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [boutique, setBoutique] = useState('');
  const [categorie, setCategorie] = useState('plats');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (mode === 'register') {
      if (!email.toLowerCase().endsWith('@univ-thies.sn')) {
        setErrorMsg("L'adresse email doit se terminer par @univ-thies.sn");
        return;
      }
      if (password.length < 6) {
        setErrorMsg("Le mot de passe doit contenir au moins 6 caractères.");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const fakeUser = {
          id: 'user-' + Date.now(),
          email,
          role: email.includes('admin') ? 'superadmin' : 'vendeur',
          user_metadata: { prenom: 'Fatou', nom: 'Diop', boutique: "Fatou's Kitchen" }
        };
        onLoginSuccess(fakeUser);
        onClose();
      } else {
        const newSeller = {
          id: 'vendeur-' + Date.now(),
          email,
          role: 'vendeur',
          user_metadata: { prenom, nom, telephone, boutique: boutique || `${prenom}'s Shop`, categorie }
        };
        onLoginSuccess(newSeller);
        alert("🎉 Votre compte vendeur a été créé avec succès ! Bienvenue sur votre Tableau de Bord.");
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message || "Une erreur est survenue lors de l'authentification.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="campus-modal-overlay" style={{ display: 'flex', zIndex: 1100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <div className="campus-modal" style={{ width: '100%', maxWidth: '440px', background: 'white', borderRadius: '24px', padding: '24px', overflowY: 'auto', maxHeight: '90vh' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--color-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Espace Vendeur UIDT
            </span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', margin: '2px 0 0', color: '#0F172A' }}>
              {mode === 'login' ? 'Connexion' : 'Créer ma boutique'}
            </h2>
          </div>
          <button className="icon-btn" onClick={onClose} style={{ background: '#F1F5F9', border: 'none', width: '36px', height: '36px', borderRadius: '50%' }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: '#FEF2F2', border: '1px solid #EF4444', color: '#B91C1C', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', marginBottom: '16px' }}>
            <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '6px' }}></i>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          
          {mode === 'register' && (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: '700', fontSize: '0.82rem', color: '#0F172A', marginBottom: '4px' }}>Prénom</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Fatou"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', background: '#F8FAFC', fontSize: '0.9rem' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontWeight: '700', fontSize: '0.82rem', color: '#0F172A', marginBottom: '4px' }}>Nom</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Diop"
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', background: '#F8FAFC', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.82rem', color: '#0F172A', marginBottom: '4px' }}>Nom de la boutique</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Fatou's Kitchen"
                  value={boutique}
                  onChange={(e) => setBoutique(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', background: '#F8FAFC', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.82rem', color: '#0F172A', marginBottom: '4px' }}>Numéro de téléphone</label>
                <input
                  type="tel"
                  required
                  placeholder="77 000 00 00"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', background: '#F8FAFC', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontWeight: '700', fontSize: '0.82rem', color: '#0F172A', marginBottom: '4px' }}>Catégorie d'activité</label>
                <select
                  value={categorie}
                  onChange={(e) => setCategorie(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', background: '#F8FAFC', fontSize: '0.9rem' }}
                >
                  <option value="plats">Restauration & Plats</option>
                  <option value="fashion">Vêtements & Mode</option>
                  <option value="jewelry">Bijoux & Accessoires</option>
                  <option value="school">Fournitures Scolaires</option>
                  <option value="services">Services & Réparation</option>
                </select>
              </div>
            </>
          )}

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.82rem', color: '#0F172A', marginBottom: '4px' }}>
              Email universitaire (@univ-thies.sn)
            </label>
            <input
              type="email"
              required
              placeholder="prenom.nom@univ-thies.sn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', background: '#F8FAFC', fontSize: '0.9rem' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontWeight: '700', fontSize: '0.82rem', color: '#0F172A', marginBottom: '4px' }}>
              Mot de passe
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #CBD5E1', outline: 'none', background: '#F8FAFC', fontSize: '0.9rem' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', borderRadius: '99px', fontWeight: '800', fontSize: '0.95rem', boxShadow: '0 4px 12px rgba(29, 78, 216, 0.25)' }}
          >
            {loading ? (
              <span><i className="fa-solid fa-spinner fa-spin"></i> Traitement...</span>
            ) : mode === 'login' ? (
              'Se connecter'
            ) : (
              'Créer ma boutique'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem' }}>
          {mode === 'login' ? (
            <p style={{ margin: 0, color: '#64748B' }}>
              Pas encore de boutique ?{' '}
              <button
                onClick={() => { setMode('register'); setErrorMsg(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: '700', cursor: 'pointer' }}
              >
                Créer ma boutique
              </button>
            </p>
          ) : (
            <p style={{ margin: 0, color: '#64748B' }}>
              Déjà inscrit ?{' '}
              <button
                onClick={() => { setMode('login'); setErrorMsg(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: '700', cursor: 'pointer' }}
              >
                Se connecter
              </button>
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
