import React, { useState } from 'react';

export default function AddProduct({ onAddProduct, onNavigate }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('plats');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [selectedPavillons, setSelectedPavillons] = useState(['A1', 'A2']);

  const allPavillons = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3'];

  const togglePavillon = (p) => {
    if (selectedPavillons.includes(p)) {
      setSelectedPavillons(selectedPavillons.filter(item => item !== p));
    } else {
      setSelectedPavillons([...selectedPavillons, p]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title || !price) {
      alert("Veuillez remplir le nom et le prix du produit.");
      return;
    }

    const newProd = {
      id: 'cm-' + Date.now(),
      title,
      category,
      price: parseFloat(price),
      description,
      pavillons: selectedPavillons,
      seller: "Fatou's Kitchen",
      isTopSeller: true,
      rating: 5.0,
      reviewsCount: 1,
      image: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&h=400&fit=crop',
      status: 'en_ligne'
    };

    onAddProduct(newProd);
    alert("🎉 Produit publié avec succès !");
    onNavigate('seller-dashboard');
  };

  return (
    <div id="view-add-product" className="spa-view active" style={{ display: 'block', paddingBottom: '90px' }}>
      
      {/* Title */}
      <div style={{ padding: '20px', background: 'white', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button className="icon-btn" onClick={() => onNavigate('seller-dashboard')} style={{ background: '#F1F5F9', border: 'none', width: '36px', height: '36px', borderRadius: '50%' }}>
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <h1 style={{ fontSize: '1.4rem', fontWeight: '800', margin: 0, color: '#0F172A' }}>Ajouter un produit</h1>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
        
        {/* Photos Picker Box */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: '700', fontSize: '0.88rem', color: '#0F172A', marginBottom: '8px' }}>
            Photos du produit
          </label>
          <div
            style={{
              border: '2px dashed #CBD5E1',
              borderRadius: '16px',
              padding: '30px 20px',
              textAlign: 'center',
              background: '#F8FAFC',
              cursor: 'pointer'
            }}
          >
            <div style={{ width: '48px', height: '48px', background: '#E0E7FF', color: 'var(--color-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', margin: '0 auto 12px', fontSize: '20px' }}>
              <i className="fa-solid fa-plus"></i>
            </div>
            <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#0F172A', marginBottom: '4px' }}>Ajouter photos</div>
            <div style={{ fontSize: '0.78rem', color: '#94A3B8' }}>Jusqu'à 5 photos (PNG, JPG)</div>
          </div>
        </div>

        {/* Nom du produit */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '700', fontSize: '0.88rem', color: '#0F172A', marginBottom: '6px' }}>
            Nom du produit
          </label>
          <input
            type="text"
            className="form-control"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Thiéboudienne au poisson"
            required
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', background: '#F8FAFC' }}
          />
        </div>

        {/* Catégorie */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '700', fontSize: '0.88rem', color: '#0F172A', marginBottom: '6px' }}>
            Catégorie
          </label>
          <select
            className="form-control"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', background: '#F8FAFC' }}
          >
            <option value="plats">Plats & Boissons</option>
            <option value="fashion">Vêtements</option>
            <option value="jewelry">Bijoux & Accessoires</option>
            <option value="school">Fournitures</option>
            <option value="services">Services</option>
            <option value="tech">Tech & Électronique</option>
          </select>
        </div>

        {/* Prix */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontWeight: '700', fontSize: '0.88rem', color: '#0F172A', marginBottom: '6px' }}>
            Prix (FCFA)
          </label>
          <input
            type="number"
            className="form-control"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Ex: 2500"
            required
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', background: '#F8FAFC' }}
          />
        </div>

        {/* Description */}
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: '700', fontSize: '0.88rem', color: '#0F172A', marginBottom: '6px' }}>
            Description
          </label>
          <textarea
            rows="3"
            className="form-control"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez votre produit..."
            style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #CBD5E1', outline: 'none', background: '#F8FAFC', fontFamily: 'inherit' }}
          ></textarea>
        </div>

        {/* Pavillons disponibles */}
        <div style={{ marginBottom: '28px' }}>
          <label style={{ display: 'block', fontWeight: '700', fontSize: '0.88rem', color: '#0F172A', marginBottom: '8px' }}>
            Pavillons disponibles
          </label>
          <div className="pavillon-chips-container">
            {allPavillons.map((p) => {
              const isSelected = selectedPavillons.includes(p);
              return (
                <button
                  type="button"
                  key={p}
                  className={`pavillon-chip ${isSelected ? 'active' : ''}`}
                  onClick={() => togglePavillon(p)}
                >
                  {p}
                </button>
              );
            })}
          </div>
        </div>

        {/* Primary Action Button */}
        <button
          type="submit"
          className="btn btn-primary"
          style={{
            width: '100%',
            padding: '16px',
            borderRadius: '99px',
            fontWeight: '800',
            fontSize: '1rem',
            boxShadow: '0 6px 16px rgba(29, 78, 216, 0.3)',
            cursor: 'pointer'
          }}
        >
          Publier le produit
        </button>

      </form>

    </div>
  );
}
