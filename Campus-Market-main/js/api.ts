// --- SUPABASE INTEGRATION (PROFESSIONAL BACKEND) ---
const { supabase, escapeHTML } = window;
window.globalProducts = [];

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
                <div class="top-shop-card" onclick="document.getElementById('global-search').value = '${escapeHTML(s.prenom)}'; document.getElementById('global-search').dispatchEvent(new Event('input'));">
                    <div class="top-shop-avatar">
                        ${initiales}
                    </div>
                    <h4 class="top-shop-name">${escapeHTML(s.prenom)} ${escapeHTML(s.nom)}</h4>
                    <div class="top-shop-rating">
                        <i class="fa-solid fa-star"></i> ${s.avgRating.toFixed(1)} <span class="top-shop-review-count">(${s.reviewCount})</span>
                    </div>
                </div>
            `;
        }).join('');
    } catch(e) {
        console.error("Top Shops Error:", e);
        container.innerHTML = '<div style="color: #EF4444; font-size: 0.9rem; padding: 20px;">Erreur de chargement des Top Shops.</div>';
    }
}

// --- INDEXEDDB CACHING FOR OFFLINE ---
function initIndexedDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('CampusMarketDB', 1);
        request.onupgradeneeded = (e: any) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('products')) {
                db.createObjectStore('products', { keyPath: 'id' });
            }
        };
        request.onsuccess = (e: any) => resolve(e.target.result);
        request.onerror = (e: any) => reject(e.target.error);
    });
}

async function saveProductsToIndexedDB(products: any[]) {
    try {
        const db = await initIndexedDB();
        const tx = db.transaction('products', 'readwrite');
        const store = tx.objectStore('products');
        products.forEach(p => {
            if (p.id) store.put(p);
        });
        return new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("Failed to save products to IndexedDB:", e);
    }
}

async function loadProductsFromIndexedDB(): Promise<any[]> {
    try {
        const db = await initIndexedDB();
        const tx = db.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const request = store.getAll();
        return new Promise<any[]>((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("Failed to load products from IndexedDB:", e);
        return [];
    }
}

// Fonction professionnelle pour récupérer les produits depuis Supabase
window.currentProductPage = 0;
const PRODUCTS_PER_PAGE = 20;

async function fetchProductsFromDB(page = 0) {
    if (!supabase) {
        return loadProductsFromIndexedDB(); 
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
            await saveProductsToIndexedDB(mockData);
            return mockData;
        }
        
        // Cache success data
        await saveProductsToIndexedDB(data);
        return data;
    } catch (error) {
        console.warn("Erreur Supabase, tentative de chargement hors-ligne depuis IndexedDB:", error.message);
        
        const cachedProducts = await loadProductsFromIndexedDB();
        if (cachedProducts && cachedProducts.length > 0) {
            return cachedProducts;
        }
        
        // Fallback ultime en cas de cache vide
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
        const hasOldPrice = oldPriceVal ? `<span class="product-card-old-price">${oldPriceVal} FCFA</span>` : '';
        
        const isOpen = p.seller ? p.seller.is_open !== false : true;
        const isOutOfStock = p.stock === 0;
        
        let buttonHtml = '';
        if (!isOpen) {
            buttonHtml = `<div class="badge-closed">Boutique fermée</div>`;
        } else if (isOutOfStock) {
            buttonHtml = `<div class="badge-outofstock">Rupture de stock</div>`;
        } else {
            buttonHtml = `<button class="btn-add btn-add-to-cart" onclick="addToCart('${p.id}')">
                <i class="fa-solid fa-plus"></i> Ajouter
            </button>`;
        }
        
        const stockBadge = (p.stock !== undefined && p.stock !== -1) ? `<div class="badge-stock">Stock: ${p.stock}</div>` : '';

        let imageContent = '';
        if (p.image_url) {
            imageContent = `<img src="${p.image_url}" alt="${p.title}" style="width: 100%; height: 100%; object-fit: cover;">`;
        } else if (p.icon) {
            imageContent = `<div class="product-card-icon-container" style="background-color: ${p.color || 'var(--color-primary)'};"><i class="fa-solid ${p.icon}"></i></div>`;
        } else {
            imageContent = `<img src="https://via.placeholder.com/300x200?text=Produit" alt="${p.title}" style="width: 100%; height: 100%; object-fit: cover;">`;
        }

        const card = `
            <article class="product-card product-card-custom ${(!isOpen || isOutOfStock) ? 'disabled' : ''}">
                ${stockBadge}
                <div class="product-card-img-container">
                    ${imageContent}
                </div>
                <div class="product-info">
                    <h4 class="product-card-title">${p.title}</h4>
                    <div class="product-card-price-row">
                        <span class="product-card-price">${p.price} FCFA</span>
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