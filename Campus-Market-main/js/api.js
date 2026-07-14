// --- SUPABASE INTEGRATION (PROFESSIONAL BACKEND) ---
let globalProducts = [];

window.fetchTopShops = async function() {
    const container = document.getElementById('top-shops-container');
    if(!container || !window.supabase) return;

    try {
        const { data: sellers, error: err1 } = await supabase.from('profiles').select('id, prenom, nom, telephone').eq('role', 'vendeur');
        if(err1 || !sellers) throw err1;

        const { data: reviews, error: err2 } = await supabase.from('reviews').select('seller_id, rating');
        if(err2 || !reviews) throw err2;

        const sellerRatings = sellers.map(seller => {
            const sellerReviews = reviews.filter(r => r.seller_id === seller.id);
            const avgRating = sellerReviews.length > 0 ? (sellerReviews.reduce((sum, r) => sum + r.rating, 0) / sellerReviews.length) : 0;
            return { ...seller, avgRating, reviewCount: sellerReviews.length };
        });

        sellerRatings.sort((a, b) => b.avgRating - a.avgRating || b.reviewCount - a.reviewCount);
        const topSellers = sellerRatings.filter(s => s.avgRating > 0).slice(0, 5);

        if(topSellers.length === 0) {
            container.innerHTML = '<div style="color: #94A3B8; font-size: 0.9rem; padding: 20px; text-align: center; width: 100%;">Aucun Top Shop pour le moment. Soyez le premier !</div>';
            return;
        }

        container.innerHTML = topSellers.map(s => {
            let initiales = ((s.prenom?.[0] || '') + (s.nom?.[0] || '')).toUpperCase() || 'V';
            return `
                <div style="min-width: 140px; scroll-snap-align: start; background: white; border-radius: 16px; padding: 16px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid var(--color-border); cursor: pointer;" onclick="document.getElementById('global-search').value = '${escapeHTML(s.prenom)}'; document.getElementById('global-search').dispatchEvent(new Event('input'));">
                    <div style="width: 64px; height: 64px; background: linear-gradient(135deg, var(--color-primary), var(--color-accent)); color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin: 0 auto 12px;">
                        ${initiales}
                    </div>
                    <h4 style="font-size: 0.9rem; font-weight: 700; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--color-text-main);">${escapeHTML(s.prenom)} ${escapeHTML(s.nom)}</h4>
                    <div style="color: #F59E0B; font-size: 0.8rem; font-weight: bold;">
                        <i class="fa-solid fa-star"></i> ${s.avgRating.toFixed(1)} <span style="color: #94A3B8; font-weight: normal;">(${s.reviewCount})</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch(e) {
        console.error("Top Shops Error:", e);
        container.innerHTML = '<div style="color: #EF4444; font-size: 0.9rem; padding: 20px;">Erreur de chargement des Top Shops.</div>';
    }
}

// Fonction professionnelle pour récupérer les produits depuis Supabase
let currentProductPage = 0;
const PRODUCTS_PER_PAGE = 20;

async function fetchProductsFromDB(page = 0) {
    if (!supabase) {
        // Fallback temporaire pour la maquette si Supabase n'est pas encore lié
        return []; 
    }
    
    try {
        const from = page * PRODUCTS_PER_PAGE;
        const to = from + PRODUCTS_PER_PAGE - 1;

        const { data, error } = await supabase
            .from('products')
            .select('*, seller:seller_id(is_open)')
            .order('created_at', { ascending: false })
            .range(from, to);
        if (error) throw error;
        if (!data || data.length === 0) {
            // Génération de 30 produits de simulation si la base est vide
            const categories = ['food', 'tech', 'fashion', 'services'];
            const icons = ['fa-burger', 'fa-laptop', 'fa-shirt', 'fa-broom', 'fa-headphones', 'fa-book', 'fa-plug', 'fa-mobile-screen', 'fa-pen'];
            const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
            const titles = ['Produit Campus', 'Article UIDT', 'Service Etudiant', 'Offre Spéciale', 'Matériel de cours', 'Snack Campus'];
            let mockData = [];
            for (let i = 1; i <= 30; i++) {
                mockData.push({
                    id: 'mock-' + i,
                    title: titles[Math.floor(Math.random() * titles.length)] + ' ' + i,
                    category: categories[Math.floor(Math.random() * categories.length)],
                    price: Math.floor(Math.random() * 90 + 10) * 100,
                    icon: icons[Math.floor(Math.random() * icons.length)],
                    color: colors[Math.floor(Math.random() * colors.length)]
                });
            }
            return mockData;
        }
        return data;
    } catch (error) {
        console.error("Erreur DB:", error.message);
        // Si la connexion échoue ou si la table n'existe pas, on charge les mocks pour ne pas bloquer l'interface
        return [
            { id: 'm1', title: 'Ordinateur Portable HP', price: 150000, category: 'tech', image_url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=300&h=200&fit=crop' },
            { id: 'm2', title: 'Clé USB 64Go', price: 5000, category: 'tech', image_url: 'https://images.unsplash.com/photo-1597872200969-2b65d56bd16b?w=300&h=200&fit=crop' },
            { id: 'm3', title: 'Sandwich Poulet', price: 1000, category: 'food', image_url: 'https://images.unsplash.com/photo-1619881589316-56c7f9e6b587?w=300&h=200&fit=crop' },
            { id: 'm4', title: 'T-shirt Campus', price: 3500, category: 'fashion', image_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=200&fit=crop' },
            { id: 'm5', title: 'Écouteurs Sans Fil', price: 12000, category: 'tech', image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=300&h=200&fit=crop' },
            { id: 'm6', title: 'Hamburger Complet', price: 1500, category: 'food', image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=300&h=200&fit=crop' }
        ];
    }
}

// Fonction de rendu dynamique des produits
function renderProducts(products) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const emptyState = document.getElementById('empty-state');
    if (products.length === 0) {
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    if (emptyState) emptyState.style.display = 'none';

    products.forEach(p => {
        const oldPriceVal = p.old_price ? p.old_price : p.oldPrice; // Handle both DB and mock cases
        const hasOldPrice = oldPriceVal ? `<span style="font-size: 0.75rem; color: #94A3B8; text-decoration: line-through;">${oldPriceVal} FCFA</span>` : '';
        
        const isOpen = p.seller ? p.seller.is_open !== false : true;
        const isOutOfStock = p.stock === 0;
        
        let buttonHtml = '';
        if (!isOpen) {
            buttonHtml = `<div style="text-align: center; color: #EF4444; font-size: 0.85rem; font-weight: bold; padding: 8px; background: #FEE2E2; border-radius: 8px;">Boutique fermée</div>`;
        } else if (isOutOfStock) {
            buttonHtml = `<div style="text-align: center; color: #EF4444; font-size: 0.85rem; font-weight: bold; padding: 8px; background: #FEE2E2; border-radius: 8px;">Rupture de stock</div>`;
        } else {
            buttonHtml = `<button class="btn-add" onclick="addToCart('${p.id}')" style="width: 100%; border-radius: 8px; background: var(--color-bg); color: var(--color-text-main); border: 1px solid var(--color-border); padding: 8px; font-size: 0.85rem; height: auto; cursor:pointer; font-weight: 600;">
                <i class="fa-solid fa-plus"></i> Ajouter
            </button>`;
        }
        
        const stockBadge = (p.stock !== undefined && p.stock !== -1) ? `<div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.6); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; z-index: 10;">Stock: ${p.stock}</div>` : '';

        let imageContent = '';
        if (p.image_url) {
            imageContent = `<img src="${p.image_url}" alt="${p.title}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else if (p.icon) {
            imageContent = `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background-color: ${p.color || 'var(--color-primary)'}; color: white; font-size: 3rem;"><i class="fa-solid ${p.icon}"></i></div>`;
        } else {
            imageContent = `<img src="https://via.placeholder.com/300x200?text=Produit" alt="${p.title}" style="width: 100%; height: 100%; object-fit: cover;">`;
        }

        const card = `
            <article class="product-card" style="border-radius: 16px; border: none; box-shadow: 0 4px 12px rgba(0,0,0,0.05); padding: 12px; background: white; position: relative; ${(!isOpen || isOutOfStock) ? 'opacity: 0.6;' : ''}">
                ${stockBadge}
                <div style="height: 120px; background: #F8FAFC; border-radius: 12px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 12px;">
                    ${imageContent}
                </div>
                <div class="product-info">
                    <h4 class="product-title" style="font-size: 0.85rem; margin-bottom: 4px;">${p.title}</h4>
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 12px;">
                        <span class="product-price" style="font-size: 0.95rem; font-weight: 700; color: var(--color-text-main);">${p.price} FCFA</span>
                        ${hasOldPrice}
                    </div>
                    ${buttonHtml}
                </div>
            </article>
        `;
        grid.innerHTML += card;
    });
}

function openOrderModal(productId) {
    const orderModal = document.getElementById('order-modal');
    if (orderModal) {
        // Enregistrer le produit en cours d'achat dans le DOM ou session
        orderModal.dataset.productId = productId;
        orderModal.style.display = 'flex';
    }
}

// --- RECHERCHE INTELLIGENTE ---
function levenshteinDistance(s, t) {
    if (!s.length) return t.length;
    if (!t.length) return s.length;
    const arr = [];
    for (let i = 0; i <= t.length; i++) {
        arr[i] = [i];
        for (let j = 1; j <= s.length; j++) {
            arr[i][j] =
                i === 0 ? j
                : Math.min(
                    arr[i - 1][j] + 1,
                    arr[i][j - 1] + 1,
                    arr[i - 1][j - 1] + (s[j - 1] === t[i - 1] ? 0 : 1)
                );
    }
    return arr[t.length][s.length];
}

window.toggleFiltersPanel = function() {
    const panel = document.getElementById('filters-panel');
    const chevron = document.getElementById('filters-chevron');
    if (panel) {
        const isOpen = panel.style.display === 'block';
        panel.style.display = isOpen ? 'none' : 'block';
        if (chevron) {
            chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    }
};

window.applyFilters = function() {
    filterAndRenderProducts();
};

function populateSellersFilter() {
    const filterSeller = document.getElementById('filter-seller');
    if (!filterSeller) return;
    
    // Clear except first option
    filterSeller.innerHTML = '<option value="">Tous les vendeurs</option>';
    
    const sellersMap = new Map();
    globalProducts.forEach(p => {
        if (p.seller_id && p.seller) {
            sellersMap.set(p.seller_id, `${p.seller.prenom} ${p.seller.nom}`);
        }
    });
    
    sellersMap.forEach((name, id) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.innerText = name;
        filterSeller.appendChild(opt);
    });
}

function filterAndRenderProducts() {
    const searchInput = document.getElementById('global-search') || document.getElementById('global-search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    const activeChip = document.querySelector('.category-chip.active');
    const activeCategory = activeChip ? activeChip.dataset.category : 'all';

    // Advanced filters
    const maxPriceVal = document.getElementById('filter-price-max')?.value;
    const maxPrice = maxPriceVal ? parseFloat(maxPriceVal) : null;
    
    const selectedSeller = document.getElementById('filter-seller')?.value;
    
    const openOnly = document.getElementById('filter-open-only')?.checked;

    const filtered = globalProducts.filter(p => {
        const matchesCategory = (activeCategory === 'all' || p.category === activeCategory);
        
        // Smart Search (Tolérance aux fautes de frappe)
        let matchesSearch = true;
        if (searchTerm.length > 0) {
            const words = p.title.toLowerCase().split(' ');
            matchesSearch = p.title.toLowerCase().includes(searchTerm) || 
                            (p.seller && `${p.seller.prenom} ${p.seller.nom}`.toLowerCase().includes(searchTerm)) ||
                            words.some(w => levenshteinDistance(w, searchTerm) <= 2);
        }

        // Price limit
        const matchesPrice = (maxPrice === null || p.price <= maxPrice);

        // Seller match
        const matchesSeller = (!selectedSeller || p.seller_id === selectedSeller);

        // Shop status
        const isOpen = p.seller ? p.seller.is_open !== false : true;
        const matchesOpen = (!openOnly || isOpen);

        return matchesCategory && matchesSearch && matchesPrice && matchesSeller && matchesOpen;
    });

    renderProducts(filtered);
}

// --- INITIALISATION AU CHARGEMENT ---
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Charger les vraies données
    currentProductPage = 0;
    globalProducts = await fetchProductsFromDB(currentProductPage);
    renderProducts(globalProducts);
    populateSellersFilter();
    
    // Ajouter bouton Voir plus
    const feedSection = document.getElementById('products-grid')?.parentElement;
    if(feedSection && !document.getElementById('load-more-btn')) {
        const btnContainer = document.createElement('div');
        btnContainer.style.textAlign = 'center';
        btnContainer.style.marginTop = '24px';
        btnContainer.innerHTML = `<button id="load-more-btn" style="padding: 10px 24px; background: transparent; border: 2px solid var(--color-primary); color: var(--color-primary); border-radius: 99px; font-weight: bold; cursor: pointer;">Voir plus de produits</button>`;
        feedSection.appendChild(btnContainer);

        document.getElementById('load-more-btn').addEventListener('click', async () => {
            const btn = document.getElementById('load-more-btn');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Chargement...';
            currentProductPage++;
            const newProducts = await fetchProductsFromDB(currentProductPage);
            if(newProducts.length > 0) {
                globalProducts = [...globalProducts, ...newProducts];
                renderProducts(globalProducts);
                populateSellersFilter();
                btn.innerHTML = 'Voir plus de produits';
                if(newProducts.length < PRODUCTS_PER_PAGE) btn.style.display = 'none';
            } else {
                btn.style.display = 'none';
            }
        });
    }

    // Charger les Top Shops
    fetchTopShops();

    // 2. Setup Recherche
    ['global-search', 'global-search-input'].forEach(id => {
        const input = document.getElementById(id);
        if (input) input.addEventListener('input', filterAndRenderProducts);
    });

    // 3. Setup Filtres de Catégories
    const categoryChips = document.querySelectorAll('.category-chip');
    categoryChips.forEach(chip => {
        chip.addEventListener('click', () => {
            categoryChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filterAndRenderProducts();
        });
    });
});


// ==========================================

window.fetchProductsFromDB = fetchProductsFromDB;
window.renderProducts = renderProducts;