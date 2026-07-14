
// SECURITY: Helper function to prevent XSS (Cross-Site Scripting)
window.escapeHTML = function(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};
document.addEventListener('DOMContentLoaded', () => {
    // 1. Toggle Search Bar
    const searchToggleBtn = document.querySelector('.search-toggle');
    const searchBarContainer = document.querySelector('.search-bar-container');
    const searchInput = document.getElementById('global-search');

    if (searchToggleBtn && searchBarContainer) {
        searchToggleBtn.addEventListener('click', () => {
            searchBarContainer.classList.toggle('active');
            if (searchBarContainer.classList.contains('active')) {
                searchInput.focus();
                searchToggleBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            } else {
                searchToggleBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
            }
        });
    }

    // 2. Category Chips Selection & Filtering
    const categoryChips = document.querySelectorAll('.category-chip');
    const productCards = document.querySelectorAll('.product-card');
    
    // Fonction de filtrage
    window.filterProducts = function() {
        const searchInput = document.getElementById('global-search');
        const searchTerm = (searchInput ? searchInput.value.toLowerCase() : '');
        const activeChip = document.querySelector('.category-chip.active');
        const activeCategory = activeChip ? activeChip.dataset.category : 'all';
        let visibleCount = 0;

        const dynamicProductCards = document.querySelectorAll('.product-card');

        dynamicProductCards.forEach(card => {
            const titleEl = card.querySelector('.product-title');
            const descEl = card.querySelector('.product-weight') || card.querySelector('.product-category');
            
            const title = titleEl ? titleEl.innerText.toLowerCase() : '';
            const desc = descEl ? descEl.innerText.toLowerCase() : '';
            
            // Pour la démo, on simule des catégories (ex: Tech Student -> tech, Bijoux -> jewelry)
            let cardCategory = 'all';
            if(desc.includes('tech') || title.includes('casque')) cardCategory = 'tech';
            if(desc.includes('bijoux') || title.includes('collier')) cardCategory = 'jewelry';
            if(desc.includes('librairie') || title.includes('cahier')) cardCategory = 'school';
            if(desc.includes('couture') || title.includes('blouse')) cardCategory = 'fashion';

            const matchesSearch = title.includes(searchTerm) || desc.includes(searchTerm);
            const matchesCategory = (activeCategory === 'all' || activeCategory === cardCategory);

            if (matchesSearch && matchesCategory) {
                card.style.display = 'block';
                visibleCount++;
            } else {
                card.style.display = 'none';
            }
        });

        // Afficher message si vide
        const emptyState = document.getElementById('empty-state');
        if(emptyState) {
            emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
        }
    }

    if (searchInput) {
        searchInput.addEventListener('input', filterProducts);
    }
    
    categoryChips.forEach(chip => {
        chip.addEventListener('click', () => {
            categoryChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            filterProducts();
        });
    });

    // 3. Modale de Commande (Boutons +)
    const orderModal = document.getElementById('order-modal');
    const orderForm = document.getElementById('order-form');
    const addButtons = document.querySelectorAll('.btn-add');

    addButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Évite de déclencher le clic sur la carte si besoin
            if(orderModal) {
                orderModal.style.display = 'flex';
            }
        });
    });

    // (Mock order form submission removed in favor of the real DB one below)

    // 4. Redirection des Shop Cards (Démo)
    const shopCards = document.querySelectorAll('.product-card'); // On utilise product-card maintenant
    shopCards.forEach(card => {
        // Optionnel : on peut garder un comportement de clic sur la carte entière si on veut voir le détail
        /*
        card.addEventListener('click', () => {
            window.location.href = 'store.html';
        });
        */
    });
});


// 5. Toasts (Notifications)
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<i class="fa-solid fa-circle-check"></i><span>' + message + '</span>';
    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('hide'); setTimeout(() => toast.remove(), 300); }, 3000);
};

// 6. Product Detail Modal
window.openProductDetail = function(title, price, desc, img) {
    const modal = document.getElementById('product-detail-modal');
    if(!modal) return;
    document.getElementById('detail-title').innerText = title;
    document.getElementById('detail-price').innerText = price;
    document.getElementById('detail-desc').innerText = desc;
    document.getElementById('detail-img').src = img;
    modal.style.display = 'flex';
};

// 7. Animated Counters (Social Proof Section)
(function() {
    function animateCounter(el) {
        const target = parseFloat(el.dataset.target);
        const isDecimal = el.dataset.decimal === 'true';
        const duration = 2000;
        const startTime = performance.now();

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = target * eased;

            if (isDecimal) {
                el.textContent = current.toFixed(1);
            } else {
                el.textContent = Math.floor(current).toLocaleString('fr-FR');
            }

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                if (isDecimal) {
                    el.textContent = target.toFixed(1);
                } else {
                    el.textContent = target.toLocaleString('fr-FR');
                }
            }
        }
        requestAnimationFrame(update);
    }

    const counterEls = document.querySelectorAll('.proof-number[data-target]');
    if (counterEls.length > 0 && 'IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        counterEls.forEach(el => observer.observe(el));
    }
})();

// 8. PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('ServiceWorker enregistré avec succès: ', registration.scope);
            })
            .catch((error) => {
                console.log('Échec de l\'enregistrement du ServiceWorker: ', error);
            });
    });
}

// 9. WhatsApp Notification Helper
window.notifyBuyerWhatsApp = function(phone, orderId, status) {
    let message = "";
    if (status === 'ready') {
        message = `Bonjour ! Votre commande ${orderId} sur Campus Market est prête. Le livreur est en bas de votre pavillon. 🚀`;
    } else if (status === 'confirmed') {
        message = `Bonjour ! Votre commande ${orderId} a bien été confirmée. Elle est en cours de préparation. ⏳`;
    }
    
    // Format number for Senegal if needed (assuming 77... format)
    let formattedPhone = phone.startsWith('221') ? phone : `221${phone}`;
    
    // Open WhatsApp Web/App
    const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
};
// SPA Navigation Logic
window.navigateTo = function(viewId) {
    document.querySelectorAll('.spa-view').forEach(view => { view.style.display = 'none'; view.classList.remove('active'); });
    const targetView = document.getElementById('view-' + viewId);
    if (targetView) { targetView.style.display = 'block'; targetView.classList.add('active'); }
    document.querySelectorAll('.bottom-nav-item').forEach(btn => { btn.classList.remove('active'); if (btn.dataset.target === viewId) { btn.classList.add('active'); } });
    
    const bottomNav = document.getElementById('bottom-nav');
    if(bottomNav) {
        if(viewId === 'superadmin') {
            bottomNav.style.display = 'none';
        } else {
            bottomNav.style.display = 'flex';
        }
    }
    window.scrollTo(0, 0);
}
function toggleSearch() {
    const searchContainer = document.getElementById('global-search-container');
    if (searchContainer.style.display === 'none') {
        searchContainer.style.display = 'block';
        document.getElementById('global-search-input').focus();
    } else {
        searchContainer.style.display = 'none';
    }
}
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
// SUPABASE AUTHENTICATION & STATE MANAGEMENT
// ==========================================

async function checkAuthState() {
    if (!window.supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    
    const profilView = document.getElementById('view-profil');
    if (profilView) {
        if (user) {
            // Logged in
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (profile) {
                let header = document.getElementById('profil-header');
                if (!header) {
                    header = document.createElement('div');
                    header.id = 'profil-header';
                    header.style = "padding: 24px 20px; background: white; border-bottom: 1px solid var(--color-border); text-align: center;";
                    profilView.insertBefore(header, profilView.firstChild);
                }
                header.innerHTML = `
                    <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--color-primary-light); color: var(--color-primary); font-size: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px;">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <h3 style="margin: 0; font-size: 1.2rem;">${escapeHTML(profile.prenom)} ${escapeHTML(profile.nom)}</h3>
                    <p style="color: var(--color-text-muted); font-size: 0.9rem; margin-top: 4px;">${escapeHTML(profile.telephone)}</p>
                    <div style="margin-top: 8px; font-size: 0.8rem; font-weight: 700; color: ${profile.role === 'vendeur' ? '#10B981' : '#818CF8'};">
                        Compte ${profile.role.toUpperCase()}
                    </div>
                `;
                
                const btnBecomeSeller = document.getElementById('btn-become-seller');
                const btnSellerDashboard = document.getElementById('btn-seller-dashboard');
                const logoutSection = document.getElementById('logout-section');
                
                if (btnBecomeSeller) {
                    btnBecomeSeller.style.display = 'block';
                    const icon = btnBecomeSeller.querySelector('i');
                    const span = btnBecomeSeller.querySelector('span');
                    if(profile.role === 'vendeur') {
                        icon.className = 'fa-solid fa-store-slash';
                        span.innerText = 'Mode client';
                        btnBecomeSeller.onclick = () => window.navigateTo('accueil');
                    } else if(profile.role === 'vendeur_pending') {
                        icon.className = 'fa-solid fa-hourglass-half';
                        span.innerText = 'En attente de confirmation';
                        btnBecomeSeller.onclick = () => {};
                    } else {
                        icon.className = 'fa-solid fa-store';
                        span.innerText = 'Devenir Vendeur';
                        btnBecomeSeller.onclick = () => window.navigateTo('seller-register');
                    }
                }
                if (btnSellerDashboard) btnSellerDashboard.style.display = profile.role === 'vendeur' ? 'block' : 'none';
                if (logoutSection) logoutSection.style.display = (profile.role === 'vendeur' || profile.role === 'superadmin') ? 'block' : 'none';
                
                document.getElementById('profil-unauth-state').style.display = 'none';
                document.getElementById('profil-auth-menu').style.display = 'block';
            }
        } else {
            // Not logged in
            const header = document.getElementById('profil-header');
            if(header) header.remove();
            
            let unauth = document.getElementById('profil-unauth-state');
            if(!unauth) {
                unauth = document.createElement('div');
                unauth.id = 'profil-unauth-state';
                unauth.style = "padding: 40px 20px; text-align: center;";
                unauth.innerHTML = `
                    <div style="width: 80px; height: 80px; border-radius: 50%; background: #F1F5F9; color: #94A3B8; font-size: 32px; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
                        <i class="fa-solid fa-user-lock"></i>
                    </div>
                    <h3 style="margin-bottom: 12px; font-size: 1.2rem;">Espace Profil</h3>
                    <p style="color: var(--color-text-muted); font-size: 0.95rem; margin-bottom: 32px;">Gérez vos commandes et vos préférences.</p>
                    <button onclick="navigateTo('register')" class="btn btn-primary" style="width: 100%; margin-bottom: 12px; padding: 14px; border-radius: 12px; font-weight: 600;">Créer votre profil Acheteur</button>
                    <button onclick="navigateTo('seller-register')" class="btn" style="width: 100%; margin-bottom: 12px; padding: 14px; border-radius: 12px; font-weight: 700; background: #FFFBEB; color: #D97706; border: 1px solid #FCD34D;"><i class="fa-solid fa-store" style="margin-right: 8px;"></i> Devenir Vendeur (Créer une boutique)</button>
                    <button onclick="navigateTo('login')" class="btn" style="width: 100%; padding: 14px; border-radius: 12px; font-weight: 600; background: white; color: var(--color-text-main); border: 1px solid var(--color-border);">Se connecter</button>
                `;
                profilView.insertBefore(unauth, profilView.firstChild);
            }
            unauth.style.display = 'block';
            
            let authMenu = document.getElementById('profil-auth-menu');
            if(authMenu) authMenu.style.display = 'none';
        }
    }
    return user;
}

// Intercept navigateTo to require login for profil, panier, commandes
const originalNavigateTo = window.navigateTo;
window.navigateTo = async function(viewId) {
    if (!window.supabase) {
        if(originalNavigateTo) originalNavigateTo(viewId);
        return;
    }

    if (viewId === 'seller-register') {
        const user = await checkAuthState();
        const authFields = document.getElementById('seller-auth-fields');
        if (authFields) {
            if (user) {
                authFields.style.display = 'none';
                authFields.querySelectorAll('input').forEach(i => i.removeAttribute('required'));
            } else {
                authFields.style.display = 'block';
                authFields.querySelectorAll('input').forEach(i => i.setAttribute('required', ''));
            }
        }
    }

    const mainBottomNav = document.getElementById('bottom-nav');
    if(mainBottomNav) {
        if(viewId === 'superadmin' || viewId === 'login' || viewId === 'register' || viewId === 'seller-register') {
            mainBottomNav.style.display = 'none';
        } else {
            mainBottomNav.style.display = 'flex';
            
            // Gérer le bouton central selon le mode (Panier / Ajouter)
            const panierBtn = mainBottomNav.querySelector('[data-target="panier"]');
            if (panierBtn) {
                if (viewId === 'admin') { // Mode Espace Vendeur
                    panierBtn.innerHTML = '<i class="fa-solid fa-plus-circle" style="font-size: 24px;"></i><span>Ajouter</span>';
                    panierBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        document.getElementById('add-product-form-container').style.display = 'block';
                        window.scrollTo(0, 0);
                    };
                } else { // Mode Client
                    panierBtn.innerHTML = '<i class="fa-solid fa-bag-shopping"></i><span>Panier</span>';
                    panierBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if(originalNavigateTo) originalNavigateTo('panier');
                    };
                }
            }
        }
    }
    
    if(originalNavigateTo) originalNavigateTo(viewId);
};

// Handle Registration
document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = registerForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Inscription...';
            btn.disabled = true;

            const prenom = document.getElementById('first_name').value;
            const nom = document.getElementById('last_name').value;
            const phone = document.getElementById('phone').value;
            const email = document.getElementById('register-email') ? document.getElementById('register-email').value : document.querySelector('#view-register #email').value;
            const password = document.querySelector('#view-register #password').value;

            // SECURITY: Enforce university email domain
            if (!email.toLowerCase().endsWith('@univ-thies.sn')) {
                alert("Erreur : L'adresse email doit se terminer par @univ-thies.sn");
                btn.innerHTML = originalText;
                btn.disabled = false;
                return;
            }

            try {
                // 1. Sign up Auth
                const { data, error } = await supabase.auth.signUp({
                    email: email,
                    password: password
                });

                if (error) throw error;

                // 2. Create Profile
                if (data.user) {
                    const { error: profileError } = await supabase.from('profiles').insert([
                        {
                            id: data.user.id,
                            prenom: prenom,
                            nom: nom,
                            telephone: phone,
                            role: 'acheteur'
                        }
                    ]);
                    if (profileError) {
                        // If it fails due to RLS, it means the user is not logged in (Email confirmation needed)
                        console.error("Profile creation error:", profileError);
                        throw new Error(profileError.message);
                    }
                }

                // Connexion automatique et redirection
                await checkAuthState();
                
                const checkoutPending = localStorage.getItem('checkout_pending');
                if (checkoutPending === 'true') {
                    localStorage.removeItem('checkout_pending');
                    window.navigateTo('panier');
                    setTimeout(() => {
                        if (window.openCheckoutModal) window.openCheckoutModal();
                    }, 500);
                } else {
                    window.navigateTo('accueil');
                }
                registerForm.reset();

            } catch (error) {
                console.error("Registration error:", error);
                
                // Messages d'erreurs en français plus clairs
                let errorMsg = error.message;
                if (errorMsg.includes("User already registered")) {
                    errorMsg = "Un compte existe déjà avec cette adresse email.";
                } else if (errorMsg.includes("row-level security policy")) {
                    errorMsg = "Vous devez désactiver la 'Confirmation d'email' dans les paramètres Supabase pour permettre la connexion directe.";
                }
                
                alert("Erreur lors de l'inscription : " + errorMsg);
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // Handle Login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = loginForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Connexion...';
            btn.disabled = true;

            const email = document.querySelector('#view-login #email').value;
            const password = document.querySelector('#view-login #password').value;

            try {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (error) throw error;
                
                await checkAuthState();
                window.navigateTo('accueil');
                
                // Fetch user orders if any
            } catch (error) {
                alert("Erreur de connexion : Identifiants incorrects.");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // Handle Logout
    window.logout = async function() {
        if(!window.supabase) return;
        await supabase.auth.signOut();
        const header = document.getElementById('profil-header');
        if(header) header.remove();
        window.navigateTo('login');
    };

    // Initial Auth Check
    checkAuthState();
    
    // Fix navigation links in login/register pages
    const authLinks = document.querySelectorAll('#view-login a, #view-register a');
    authLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href === 'login.html') {
                e.preventDefault();
                window.navigateTo('login');
            } else if (href === 'register.html') {
                e.preventDefault();
                window.navigateTo('register');
            }
        });
    });
});


// ==========================================
// PANIER & COMMANDES (CART & ORDERS LOGIC)
// ==========================================

let cart = JSON.parse(localStorage.getItem('campus_cart')) || [];

function saveCart() {
    localStorage.setItem('campus_cart', JSON.stringify(cart));
    updateCartBadge();
    renderCart();
}

function updateCartBadge() {
    // Si on veut ajouter un petit badge rouge sur l'icône du panier plus tard
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    // document.getElementById('cart-badge').innerText = totalItems;
}

// Remplacer openOrderModal par addToCart sur les boutons "Ajouter"
window.addToCart = function(productId) {
    const product = globalProducts.find(p => p.id === productId);
    if (!product) return;
    
    const existing = cart.find(item => item.id === productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...product, quantity: 1 });
    }
    
    saveCart();
    
    if(window.showToast) {
        showToast("Ajouté au panier !");
    } else {
        alert("Ajouté au panier !");
    }
};

// Rendre le Panier
window.renderCart = function() {
    const cartContainer = document.querySelector('.cart-items');
    const summaryContainer = document.querySelector('.cart-summary');
    if (!cartContainer || !summaryContainer) return;
    
    if (cart.length === 0) {
        cartContainer.innerHTML = '<div style="text-align: center; padding: 40px 20px; color: #94A3B8;"><i class="fa-solid fa-cart-shopping" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i><p>Panier vide.</p><button onclick="navigateTo(\'accueil\')" class="btn btn-primary" style="margin-top: 16px;">Découvrir les offres</button></div>';
        summaryContainer.style.display = 'none';
        
        // Hide checkout button if exists
        const btnCheckout = document.getElementById('btn-checkout-panier');
        if(btnCheckout) btnCheckout.style.display = 'none';
        return;
    }
    
    summaryContainer.style.display = 'block';
    
    let html = '';
    let subtotal = 0;
    
    cart.forEach((item, index) => {
        subtotal += item.price * item.quantity;
        html += `
            <div class="cart-item">
                <div class="cart-item-img" style="background: #F8FAFC; color: ${item.color || '#1D4ED8'}; display:flex; align-items:center; justify-content:center; font-size: 24px;">
                    <i class="fa-solid ${escapeHTML(item.icon || 'fa-box')}"></i>
                </div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHTML(item.title)}</div>
                    <div class="cart-item-price">${item.price} FCFA</div>
                </div>
                <div class="cart-qty" style="display: flex; align-items: center; gap: 12px; background: #F8FAFC; padding: 4px 12px; border-radius: 99px;">
                    <button onclick="updateCartQty('${item.id}', -1)" style="border:none; background:transparent; font-size:16px; cursor:pointer; color: #64748B;"><i class="fa-solid fa-minus"></i></button>
                    <span style="font-weight: 700; font-size: 0.95rem;">${item.quantity}</span>
                    <button onclick="updateCartQty('${item.id}', 1)" style="border:none; background:transparent; font-size:16px; cursor:pointer; color: #10B981;"><i class="fa-solid fa-plus"></i></button>
                </div>
            </div>
        `;
    });
    
    cartContainer.innerHTML = html;
    
    // Update Summary
    const delivery = 0; // Livraison gratuite annoncée
    summaryContainer.innerHTML = `
        <div class="cart-summary-row">
            <span>Sous-total</span>
            <span>${subtotal} FCFA</span>
        </div>
        <div class="cart-summary-row">
            <span>Livraison (Campus)</span>
            <span style="color: #10B981; font-weight: 600;">Gratuite</span>
        </div>
        <div class="cart-summary-row total">
            <span>Total</span>
            <span>${subtotal + delivery} FCFA</span>
        </div>
    `;
    
    // Ensure checkout button exists
    let btnCheckout = document.getElementById('btn-checkout-panier');
    if(!btnCheckout) {
        btnCheckout = document.createElement('button');
        btnCheckout.id = 'btn-checkout-panier';
        btnCheckout.className = 'btn btn-primary';
        btnCheckout.style = "width: calc(100% - 40px); margin: 0 20px 20px; padding: 16px; border-radius: 12px; font-size: 1.05rem; font-weight: 700; position: sticky; bottom: 80px; z-index: 10;";
        btnCheckout.innerHTML = 'Commander maintenant';
        btnCheckout.onclick = openCheckoutModal;
        document.getElementById('view-panier').appendChild(btnCheckout);
    }
    btnCheckout.style.display = 'block';
};

window.updateCartQty = function(id, delta) {
    const item = cart.find(p => p.id === id);
    if (!item) return;
    
    const newQty = item.quantity + delta;
    if (newQty > 10) {
        alert("Vous ne pouvez pas commander plus de 10 fois le même article.");
        return;
    }
    
    item.quantity = newQty;
    if (item.quantity <= 0) {
        cart = cart.filter(p => p.id !== id);
    }
    saveCart();
};

window.openCheckoutModal = async function() {
    const orderModal = document.getElementById('order-modal');
    if (orderModal) {
        const user = await checkAuthState();
        if (!user) {
            alert("Pour commander, veuillez créer votre compte acheteur en 30 secondes.");
            localStorage.setItem('checkout_pending', 'true');
            window.navigateTo('register');
            return;
        }

        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if(profile) {
            document.getElementById('order_prenom').value = profile.prenom || '';
            document.getElementById('order_nom').value = profile.nom || '';
            document.getElementById('order_phone').value = profile.telephone || '';
        }
        orderModal.style.display = 'flex';
    }
};

// Handle Checkout Submission (Insertion in DB)
document.addEventListener('DOMContentLoaded', () => {
    const orderForm = document.getElementById('order-form');
    if (orderForm) {
        orderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if(!window.supabase) {
                alert("Base de données non connectée.");
                return;
            }

            const btn = orderForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Traitement...';
            btn.disabled = true;

            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Vous devez être connecté.");

                const pavillon = document.getElementById('order_pavillon').value;
                const chambre = document.getElementById('order_chambre').value;
                const payment = document.getElementById('order_payment').value;
                const fullAddress = `${pavillon}, Chambre ${chambre} [Paiement: ${payment}]`;

                // Bloquer les commandes de produits de démonstration (id commençant par 'm' ou sans seller_id)
                const hasMockProducts = cart.some(item => !item.seller_id || String(item.id).startsWith('m'));
                if (hasMockProducts) {
                    throw new Error("Vous ne pouvez pas commander des produits de démonstration. Veuillez vider votre panier et ajouter de vrais produits.");
                }

                // Créer une commande par article dans le panier
                const ordersToInsert = cart.map(item => ({
                    buyer_id: user.id,
                    seller_id: item.seller_id,
                    product_id: item.id,
                    price: item.price * item.quantity,
                    quantity: item.quantity,
                    delivery_address: fullAddress,
                    status: 'pending'
                }));

                const { error } = await supabase.from('orders').insert(ordersToInsert);
                if (error) {
                    console.error("Supabase Error:", error);
                    throw new Error(error.message || "Erreur lors de l'insertion de la commande.");
                }

                // Succès
                cart = []; // Vider le panier
                saveCart();
                document.getElementById('order-modal').style.display = 'none';
                
                alert("🎉 Commande passée avec succès ! Le vendeur a été notifié.");
                navigateTo('commandes');
                fetchMyOrders(); // Rafraîchir la vue commandes

            } catch (error) {
                console.error("Catch Error:", error);
                alert("Erreur : " + error.message);
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    // Initialize cart render
    renderCart();
});

// Fetch Real Orders for Buyer (view-commandes)
window.fetchMyOrders = async function() {
    const commandesView = document.getElementById('view-commandes');
    if(!commandesView) return;
    
    let listContainer = commandesView.querySelector('.orders-list-container');
    if(!listContainer) {
        listContainer = commandesView.querySelector('div[style*="padding: 8px 20px;"]');
        if(!listContainer) return;
        listContainer.className = 'orders-list-container';
    }

    if (!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        listContainer.innerHTML = '<div style="text-align:center; padding: 40px; color:#94A3B8;"><i class="fa-solid fa-box-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i><p>Aucune commande passée.</p></div>';
        return;
    }

    try {
        const { data: orders, error } = await supabase
            .from('orders')
            .select('id, seller_id, status, created_at, price, product:product_id(title, icon, color), reviews(id, rating), seller:seller_id(telephone, prenom, nom)')
            .eq('buyer_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (orders.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; padding: 40px; color:#94A3B8;"><i class="fa-solid fa-box-open" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i><p>Aucune commande passée.</p></div>';
            return;
        }

        listContainer.innerHTML = orders.map(o => {
            const productTitle = o.product ? o.product.title : 'Produit inconnu';
            const date = new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
            
            let statusText, statusClass;
            let actionButton = '';
            switch(o.status) {
                case 'delivered': 
                    statusText = "Livrée"; 
                    statusClass = "confirmee"; 
                    if (o.reviews && o.reviews.length > 0) {
                        actionButton = `<div style="margin-top: 12px; font-size: 0.85rem; color: #F59E0B; font-weight: 600;"><i class="fa-solid fa-star"></i> Noté : ${o.reviews[0].rating}/5</div>`;
                    } else {
                        actionButton = `<button onclick="openReviewModal('${o.id}', '${o.seller_id}')" style="margin-top: 12px; width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #F59E0B; background: #FFFBEB; color: #D97706; font-weight: bold; cursor: pointer;"><i class="fa-regular fa-star"></i> Évaluer le vendeur</button>`;
                    }
                    break;
                case 'cancelled': statusText = "Annulée"; statusClass = "annulee"; break;
                case 'shipped': 
                    statusText = "En route"; 
                    statusClass = "en-livraison"; 
                    actionButton = `<button onclick="updateOrderStatus('${o.id}', 'delivered')" style="margin-top: 12px; width: 100%; padding: 8px; border-radius: 8px; border: none; font-weight: bold; background: #10B981; color: white; cursor: pointer;">J'ai reçu ma commande <i class="fa-solid fa-check"></i></button>`;
                    break;
                case 'processing': statusText = "En préparation"; statusClass = "en-preparation"; break;
                default: statusText = "En attente"; statusClass = "en-attente"; break;
            }

            let whatsappBtn = '';
            if (o.seller && o.seller.telephone) {
                let formattedPhone = o.seller.telephone.replace(/[^0-9]/g, '');
                if (!formattedPhone.startsWith('221') && formattedPhone.length === 9) formattedPhone = '221' + formattedPhone;
                const msg = `Bonjour ${o.seller.prenom}, je vous contacte concernant ma commande CMD-${o.id.substring(0,6).toUpperCase()} sur Campus Market.`;
                whatsappBtn = `<a href="https://wa.me/${formattedPhone}?text=${encodeURIComponent(msg)}" target="_blank" style="margin-top: 8px; display: block; text-align: center; width: 100%; padding: 8px; border-radius: 8px; border: none; font-weight: bold; background: #25D366; color: white; text-decoration: none; box-sizing: border-box;"><i class="fa-brands fa-whatsapp"></i> Contacter le vendeur</a>`;
            }

            return `
            <div class="order-item-card" data-status="${o.status}" style="display: block; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 16px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-weight: 700; font-size: 0.9rem;">#CMD-${o.id.substring(0,6).toUpperCase()}</span>
                    <span class="seller-order-status ${statusClass}">${statusText}</span>
                </div>
                <div style="font-size: 0.8rem; color: var(--color-text-muted); margin-bottom: 10px;">${date}</div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.85rem; color: var(--color-text-muted);">${escapeHTML(productTitle)}</span>

                    <span style="font-weight: 700;">${o.price} FCFA</span>
                </div>
                ${actionButton}
                ${whatsappBtn}
            </div>
            `;
        }).join('');
    } catch(err) {
        console.error(err);
    }
};

// ==========================================
// RATING & REVIEWS LOGIC
// ==========================================

window.openReviewModal = function(orderId, sellerId) {
    document.getElementById('review_order_id').value = orderId;
    document.getElementById('review_seller_id').value = sellerId;
    document.getElementById('review_rating').value = 0;
    document.getElementById('review_comment').value = '';
    
    // Reset stars
    document.querySelectorAll('.star-btn').forEach(s => {
        s.classList.remove('fa-solid');
        s.classList.add('fa-regular');
    });
    
    document.getElementById('review-modal').style.display = 'flex';
};

window.closeReviewModal = function() {
    document.getElementById('review-modal').style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    const starContainer = document.getElementById('star-rating');
    if (starContainer) {
        starContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('star-btn')) {
                const value = parseInt(e.target.dataset.value);
                document.getElementById('review_rating').value = value;
                
                document.querySelectorAll('.star-btn').forEach(s => {
                    if (parseInt(s.dataset.value) <= value) {
                        s.classList.remove('fa-regular');
                        s.classList.add('fa-solid');
                    } else {
                        s.classList.remove('fa-solid');
                        s.classList.add('fa-regular');
                    }
                });
            }
        });
    }

    const reviewForm = document.getElementById('review-form');
    if (reviewForm) {
        reviewForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rating = parseInt(document.getElementById('review_rating').value);
            if (rating === 0) {
                alert("Veuillez sélectionner au moins une étoile.");
                return;
            }
            
            const btn = reviewForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi...';
            btn.disabled = true;
            
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Non authentifié");

                const orderId = document.getElementById('review_order_id').value;
                const sellerId = document.getElementById('review_seller_id').value;
                const comment = document.getElementById('review_comment').value;

                const { error } = await supabase.from('reviews').insert([{
                    order_id: orderId,
                    seller_id: sellerId,
                    buyer_id: user.id,
                    rating: rating,
                    comment: comment
                }]);

                if (error) throw error;
                
                closeReviewModal();
                if(window.showToast) showToast("Merci pour votre avis !", "success");
                else alert("Merci pour votre avis !");
                fetchMyOrders();
                
            } catch (err) {
                console.error(err);
                alert("Erreur lors de l'envoi de l'avis.");
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
});

window.filterOrders = function(btn, filterStatus) {
    // Gérer l'état actif des boutons
    const chips = btn.parentElement.querySelectorAll('.category-chip');
    chips.forEach(c => c.classList.remove('active'));
    btn.classList.add('active');

    // Filtrer les commandes affichées
    const orders = document.querySelectorAll('.order-item-card');
    let hasVisible = false;

    orders.forEach(card => {
        const orderStatus = card.getAttribute('data-status');
        let show = false;

        if (filterStatus === 'all') {
            show = true;
        } else if (filterStatus === 'en-cours' && (orderStatus === 'pending' || orderStatus === 'processing')) {
            show = true;
        } else if (filterStatus === 'terminee' && orderStatus === 'delivered') {
            show = true;
        } else if (filterStatus === 'annulee' && orderStatus === 'cancelled') {
            show = true;
        }

        card.style.display = show ? 'block' : 'none';
        if (show) hasVisible = true;
    });

    // Afficher un message si aucune commande ne correspond
    let emptyMsg = document.getElementById('empty-order-msg');
    if (!hasVisible && orders.length > 0) {
        if (!emptyMsg) {
            emptyMsg = document.createElement('div');
            emptyMsg.id = 'empty-order-msg';
            emptyMsg.style = 'text-align:center; padding: 40px; color:var(--color-text-muted);';
            emptyMsg.innerHTML = '<p>Aucune commande dans cette catégorie.</p>';
            document.getElementById('buyer-orders-list').appendChild(emptyMsg);
        }
        emptyMsg.style.display = 'block';
    } else if (emptyMsg) {
        emptyMsg.style.display = 'none';
    }
};

// Lancer fetchMyOrders quand on navigue vers commandes
const supOriginalNavigateTo = window.navigateTo;
window.navigateTo = async function(viewId) {
    await supOriginalNavigateTo(viewId);
    if(viewId === 'commandes') {
        fetchMyOrders();
    }
    if(viewId === 'panier') {
        renderCart();
    }
};


// Handle Seller Request
document.addEventListener('DOMContentLoaded', () => {
    const sellerForm = document.getElementById('seller-register-form');
    if (sellerForm) {
        sellerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(!window.supabase) return;
            let { data: { user } } = await supabase.auth.getUser();
        
            const btn = sellerForm.querySelector('button[type="submit"]');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Envoi...';
            btn.disabled = true;
        
            try {
                const sellerLastName = document.getElementById('seller_last_name').value;
                const sellerFirstName = document.getElementById('seller_first_name').value;
                const sellerPhone = document.getElementById('seller_phone').value;
        
                if (!user) {
                    const email = document.getElementById('seller_email').value;
                    const password = document.getElementById('seller_password').value;

                    if (!email || !password) {
                        throw new Error("Veuillez saisir votre email et votre mot de passe pour créer votre compte.");
                    }
                    if (!email.toLowerCase().endsWith('@univ-thies.sn')) {
                        throw new Error("L'adresse email doit se terminer par @univ-thies.sn");
                    }

                    // 1. Sign up Auth
                    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                        email: email,
                        password: password
                    });
                    if (signUpError) throw signUpError;
                    user = signUpData.user;

                    // 2. Create Profile row with role pending
                    const { error: profileError } = await supabase.from('profiles').insert([
                        {
                            id: user.id,
                            nom: sellerLastName,
                            prenom: sellerFirstName,
                            telephone: sellerPhone,
                            role: 'vendeur_pending'
                        }
                    ]);
                    if (profileError) throw profileError;
                } else {
                    // Update existing profile with form data and set role to pending
                    const { error } = await supabase.from('profiles').update({ 
                        role: 'vendeur_pending',
                        nom: sellerLastName,
                        prenom: sellerFirstName,
                        telephone: sellerPhone
                    }).eq('id', user.id);
                    if (error) throw error;
                }
                
                alert("Votre boutique a été pré-créée ! Votre compte vendeur sera activé après validation par le Super Admin.");
                await checkAuthState();
                window.navigateTo('profil');
            } catch(err) {
                alert("Erreur : " + err.message);
            } finally {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }
});

// SUPERADMIN LOGIC

        // Check local login securely
        async function checkSuperAdminSession() {
            if(!window.supabase) return;
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
                if (profile && profile.role === 'superadmin') {
                    document.getElementById('superadmin-login').style.display = 'none';
                    document.getElementById('superadmin-content').style.display = 'block';
                    loadAdminData();
                    return;
                }
            }
        }
        checkSuperAdminSession();

        window.loginSuperAdmin = async function() {
            const email = document.getElementById('admin-email').value.trim().toLowerCase();
            const pass = document.getElementById('admin-password').value.trim();
            const errEl = document.getElementById('login-error');
            errEl.style.display = 'none';
            
            if(!window.supabase) return;
            
            // Hardcoded credentials for Super Admin (Test Mode)
            if (email === 'maamin.ndiaye@univ-thies.sn' && (pass === 'Mouhamadou2005' || pass === 'Mouhammadou2005')) {
                try {
                    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
                    if (error) {
                        errEl.innerText = "Erreur de connexion : le compte superadmin doit être créé d'abord dans Supabase !";
                        errEl.style.display = 'block';
                        return;
                    }
                    document.getElementById('superadmin-login').style.display = 'none';
                    document.getElementById('superadmin-content').style.display = 'block';
                    loadAdminData();
                } catch (e) {
                    errEl.innerText = "Erreur: " + e.message;
                    errEl.style.display = 'block';
                }
                return;
            }

            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
                if (error) throw error;
                
                // Check role
                const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
                if (profile && profile.role === 'superadmin') {
                    document.getElementById('superadmin-login').style.display = 'none';
                    document.getElementById('superadmin-content').style.display = 'block';
                    loadAdminData();
                } else {
                    errEl.innerText = "Accès refusé. Vous n'êtes pas Super Administrateur.";
                    errEl.style.display = 'block';
                    await supabase.auth.signOut();
                }
            } catch(e) {
                errEl.innerText = "Identifiants incorrects";
                errEl.style.display = 'block';
            }
        }

        window.logoutSuperAdmin = async function() {
            if(window.supabase) await supabase.auth.signOut();
            document.getElementById('superadmin-content').style.display = 'none';
            document.getElementById('superadmin-login').style.display = 'flex';
            document.getElementById('admin-password').value = '';
        }

        async function loadAdminData() {
            if(!window.supabase) return;
            try {
                // Fetch stats
                const { data: users, error: err1 } = await supabase.from('profiles').select('*');
                if (err1) throw err1;

                const { data: orders, error: err2 } = await supabase.from('orders').select('id, seller_id, status, price');
                if (err2) throw err2;
                
                const { data: products, error: err3 } = await supabase.from('products').select('id, title, price, seller_id, seller:seller_id(prenom, nom)');
                if (err3) console.error("Products fetch error:", err3);
                
                if(users) {
                    const sellers = users.filter(u => u.role === 'vendeur' || u.role === 'vendeur_desactive');
                    document.getElementById('stat-sellers').innerText = sellers.length;
                    
                    let totalRevenue = 0;
                    if(orders) {
                        const deliveredOrders = orders.filter(o => o.status === 'delivered');
                        document.getElementById('stat-orders').innerText = deliveredOrders.length;
                        deliveredOrders.forEach(o => { totalRevenue += parseFloat(o.price || 0); });
                    }
                    const statRev = document.getElementById('stat-revenue');
                    if(statRev) statRev.innerText = totalRevenue.toLocaleString('fr-FR') + ' FCFA';
                    
                    const pending = users.filter(u => u.role === 'vendeur_pending');
                    renderPendingSellers(pending, users);
                    renderActiveSellers(sellers, orders || []);
                    renderAdminUsers(users);
                    if(products) renderAdminProducts(products);
                }
            } catch(e) {
                console.error("SuperAdmin Data Error:", e);
                document.getElementById('pending-sellers-list').innerHTML = `<p style="color: #EF4444; padding: 20px;">Erreur de chargement: ${e.message || 'Vérifiez vos permissions RLS'}</p>`;
                document.getElementById('active-sellers-list').innerHTML = '';
            }
        }

        function renderPendingSellers(pendingList, allUsers) {
            const container = document.getElementById('pending-sellers-list');
            if(pendingList.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; background: #1E293B; border-radius: 16px;"><i class="fa-solid fa-check-circle" style="font-size: 32px; color: #10B981; margin-bottom: 12px;"></i><p style="color: #94A3B8;">Aucune demande en attente.</p></div>';
                return;
            }

            container.innerHTML = pendingList.map(p => `
                <div style="background: #1E293B; border-radius: 16px; padding: 16px; margin-bottom: 16px; border: 1px solid #334155;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                        <h3 style="font-size: 1.1rem; color: white; margin: 0;">${escapeHTML(p.prenom)} ${escapeHTML(p.nom)}</h3>
                        <span style="background: rgba(217, 119, 6, 0.2); color: #FCD34D; padding: 4px 8px; border-radius: 99px; font-size: 0.8rem; font-weight: 700;">En attente</span>
                    </div>
                    <p style="font-size: 0.9rem; color: #94A3B8; margin-bottom: 16px;"><i class="fa-solid fa-phone"></i> ${escapeHTML(p.telephone)}</p>
                    <div style="display: flex; gap: 12px;">
                        <button onclick="updateSellerRole('${p.id}', 'vendeur')" style="flex: 1; padding: 10px; background: #10B981; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;"><i class="fa-solid fa-check"></i> Valider</button>
                        <button onclick="updateSellerRole('${p.id}', 'acheteur')" style="flex: 1; padding: 10px; background: transparent; color: #EF4444; border: 1px solid #EF4444; border-radius: 8px; font-weight: 600; cursor: pointer;"><i class="fa-solid fa-xmark"></i> Refuser</button>
                    </div>
                </div>
            `).join('');
        }

        function renderActiveSellers(sellers, orders) {
            const container = document.getElementById('active-sellers-list');
            if(!container) return;
            if(sellers.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; background: #1E293B; border-radius: 16px;"><p style="color: #94A3B8;">Aucun vendeur sur la plateforme.</p></div>';
                return;
            }

            container.innerHTML = sellers.map(p => {
                const sellerOrders = orders.filter(o => o.seller_id === p.id && o.status === 'delivered');
                let revenue = 0;
                sellerOrders.forEach(o => revenue += parseFloat(o.price || 0));
                
                const isActive = p.role === 'vendeur';
                const statusBadge = isActive ? 
                    `<span style="background: rgba(16, 185, 129, 0.2); color: #10B981; padding: 4px 8px; border-radius: 99px; font-size: 0.8rem; font-weight: 700;">Actif</span>` : 
                    `<span style="background: rgba(239, 68, 68, 0.2); color: #EF4444; padding: 4px 8px; border-radius: 99px; font-size: 0.8rem; font-weight: 700;">Désactivé</span>`;
                
                const toggleBtn = isActive ? 
                    `<button onclick="updateSellerRole('${p.id}', 'vendeur_desactive')" style="padding: 6px 12px; background: transparent; color: #EF4444; border: 1px solid #EF4444; border-radius: 8px; font-size: 0.8rem; cursor: pointer;"><i class="fa-solid fa-ban"></i> Désactiver</button>` :
                    `<button onclick="updateSellerRole('${p.id}', 'vendeur')" style="padding: 6px 12px; background: transparent; color: #10B981; border: 1px solid #10B981; border-radius: 8px; font-size: 0.8rem; cursor: pointer;"><i class="fa-solid fa-check"></i> Activer</button>`;

                return `
                    <div style="background: #1E293B; border-radius: 16px; padding: 16px; margin-bottom: 16px; border: 1px solid #334155;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <h3 style="font-size: 1.1rem; color: white; margin: 0;">${escapeHTML(p.prenom)} ${escapeHTML(p.nom)}</h3>
                            ${statusBadge}
                        </div>
                        <p style="font-size: 0.9rem; color: #94A3B8; margin-bottom: 16px;"><i class="fa-solid fa-phone"></i> ${escapeHTML(p.telephone)}</p>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; background: #0F172A; padding: 12px; border-radius: 8px;">
                            <div>
                                <div style="font-size: 0.75rem; color: #94A3B8;">Livrées (Total)</div>
                                <div style="font-size: 1.1rem; color: white; font-weight: 700;">${sellerOrders.length}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: #94A3B8;">Chiffre d'affaires</div>
                                <div style="font-size: 1.1rem; color: #10B981; font-weight: 700;">${revenue.toLocaleString('fr-FR')} F</div>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: flex-end;">
                            ${toggleBtn}
                        </div>
                    </div>
                `;
            }).join('');
        }

        window.updateSellerRole = async function(userId, newRole) {
            try {
                const { data, error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId).select();
                if(error) throw error;
                if(!data || data.length === 0) {
                    throw new Error("Opération refusée par Supabase (RLS). Assurez-vous d'être bien connecté avec le compte administrateur.");
                }
                alert(newRole === 'vendeur' ? 'Compte vendeur activé avec succès !' : 'Mise à jour effectuée.');
                loadAdminData(); // Refresh list
            } catch(e) {
                alert("Erreur lors de la mise à jour : " + e.message);
            }
        };

        function renderAdminProducts(products) {
            const container = document.getElementById('admin-products-list');
            if(!container) return;
            if(products.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; background: #1E293B; border-radius: 16px;"><p style="color: #94A3B8;">Aucun produit sur la plateforme.</p></div>';
                return;
            }

            container.innerHTML = products.map(p => {
                const sellerName = p.seller ? `${escapeHTML(p.seller.prenom)} ${escapeHTML(p.seller.nom)}` : 'Inconnu';
                return `
                    <div style="background: #1E293B; border-radius: 16px; padding: 16px; margin-bottom: 16px; border: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="font-size: 1rem; color: white; margin: 0; margin-bottom: 4px;">${escapeHTML(p.title)}</h3>
                            <p style="font-size: 0.8rem; color: #94A3B8; margin: 0;">Vendeur : ${sellerName} | Prix: ${p.price} F</p>
                        </div>
                        <button onclick="deleteProductAdmin('${p.id}')" style="padding: 8px 12px; background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid #EF4444; border-radius: 8px; font-size: 0.8rem; cursor: pointer;">
                            <i class="fa-solid fa-trash"></i> Supprimer
                        </button>
                    </div>
                `;
            }).join('');
        }

        window.deleteProductAdmin = async function(productId) {
            if(!confirm("Voulez-vous vraiment supprimer ce produit de la plateforme ? Cette action est irréversible.")) return;
            try {
                const { error } = await supabase.from('products').delete().eq('id', productId);
                if(error) throw error;
                alert("Produit supprimé avec succès.");
                loadAdminData(); // Refresh list
            } catch(e) {
                alert("Erreur lors de la suppression. Vérifiez vos permissions RLS.");
            }
        };

        function renderAdminUsers(allUsers) {
            const container = document.getElementById('admin-users-list');
            if(!container) return;
            if(allUsers.length === 0) {
                container.innerHTML = '<div style="text-align: center; padding: 40px; background: #1E293B; border-radius: 16px;"><p style="color: #94A3B8;">Aucun utilisateur inscrit.</p></div>';
                return;
            }

            container.innerHTML = allUsers.map(u => {
                let roleColor = '#94A3B8';
                if(u.role === 'superadmin') roleColor = '#EF4444';
                if(u.role === 'vendeur') roleColor = '#10B981';
                if(u.role === 'vendeur_pending') roleColor = '#F59E0B';
                
                const roleBadge = `<span style="background: rgba(255,255,255,0.1); color: ${roleColor}; padding: 2px 8px; border-radius: 99px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">${u.role}</span>`;
                
                let actionButtons = '';
                if (u.role !== 'superadmin') {
                    if (u.role === 'acheteur') {
                        actionButtons = `<button onclick="updateSellerRole('${u.id}', 'vendeur')" style="padding: 6px 12px; background: #10B981; color: white; border: none; border-radius: 6px; font-size: 0.75rem; cursor: pointer; font-weight: 600; font-family: inherit;">Promouvoir Vendeur</button>`;
                    } else if (u.role === 'vendeur' || u.role === 'vendeur_desactive' || u.role === 'vendeur_pending') {
                        actionButtons = `<button onclick="updateSellerRole('${u.id}', 'acheteur')" style="padding: 6px 12px; background: #3B82F6; color: white; border: none; border-radius: 6px; font-size: 0.75rem; cursor: pointer; font-weight: 600; font-family: inherit;">Rendre Acheteur</button>`;
                    }
                }
                
                return `
                    <div style="background: #1E293B; border-radius: 16px; padding: 16px; margin-bottom: 16px; border: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="font-size: 1rem; color: white; margin: 0; margin-bottom: 4px;">${escapeHTML(u.prenom)} ${escapeHTML(u.nom)} ${roleBadge}</h3>
                            <p style="font-size: 0.8rem; color: #94A3B8; margin: 0;"><i class="fa-solid fa-phone"></i> ${escapeHTML(u.telephone || 'Non renseigné')}</p>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            ${actionButtons}
                            <button onclick="deleteUserAdmin('${u.id}')" style="padding: 6px 10px; background: rgba(239, 68, 68, 0.1); color: #EF4444; border: 1px solid #EF4444; border-radius: 6px; font-size: 0.75rem; cursor: pointer; font-family: inherit;">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        window.deleteUserAdmin = async function(userId) {
            if(!confirm("Voulez-vous vraiment supprimer cet étudiant ? Cette action est irréversible et supprimera son profil.")) return;
            try {
                const { error } = await supabase.from('profiles').delete().eq('id', userId);
                if (error) throw error;
                alert("Compte étudiant supprimé avec succès !");
                loadAdminData();
            } catch(e) {
                alert("Erreur lors de la suppression : " + e.message);
            }
        };

// ==========================================
// SELLER DASHBOARD LOGIC
// ==========================================

window.loadSellerDashboard = async function() {
    if(!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;

    // Fetch Seller info
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if(profile && profile.role === 'vendeur') {
        document.getElementById('admin-seller-name').innerText = escapeHTML(profile.prenom) + " " + escapeHTML(profile.nom);
        
        const toggleInput = document.getElementById('seller-status-toggle');
        const textSpan = document.getElementById('seller-status-text');
        const bgDiv = document.getElementById('seller-status-bg');
        const circleDiv = document.getElementById('seller-status-circle');
        
        if (toggleInput) {
            toggleInput.checked = profile.is_open !== false; // Default true
            if (toggleInput.checked) {
                textSpan.innerText = "Ouvert";
                textSpan.style.color = "#10B981";
                bgDiv.style.background = "#10B981";
                circleDiv.style.left = "18px";
            } else {
                textSpan.innerText = "Fermé";
                textSpan.style.color = "#EF4444";
                bgDiv.style.background = "#EF4444";
                circleDiv.style.left = "2px";
            }
        }
    }

    // Fetch Orders
    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, status, created_at, price, quantity, delivery_address, buyer_name, buyer_phone, buyer:buyer_id(nom, prenom, telephone), product:product_id(title)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

    if(!error && orders) {
        const pendingContainer = document.getElementById('seller-orders-pending');
        const pending = orders.filter(o => o.status === 'pending' || o.status === 'processing' || o.status === 'shipped');
        
        let totalRevenue = 0;
        const delivered = orders.filter(o => o.status === 'delivered');
        delivered.forEach(o => totalRevenue += o.price);
        
        document.getElementById('stat-revenue').innerText = totalRevenue.toLocaleString('fr-FR') + " F";
        document.getElementById('stat-sales').innerText = delivered.length;

        // Calculs Statistiques avancées
        const avgOrder = delivered.length > 0 ? Math.round(totalRevenue / delivered.length) : 0;
        const avgEl = document.getElementById('stat-avg-order');
        if (avgEl) avgEl.innerText = avgOrder.toLocaleString('fr-FR') + " F";

        const nonCancelled = orders.filter(o => o.status !== 'cancelled').length;
        const conversionRate = nonCancelled > 0 ? Math.round((delivered.length / nonCancelled) * 100) : 0;
        const convEl = document.getElementById('stat-conversion');
        if (convEl) convEl.innerText = conversionRate + "%";

        // Top Produits
        renderTopProducts(orders);

        // SVG sales chart
        renderSellerSalesChart(orders);

        if(pending.length > 0) {
            pendingContainer.innerHTML = pending.map(o => {
                const buyerName = o.buyer ? `${o.buyer.prenom} ${o.buyer.nom}` : (o.buyer_name || 'Client Invité');
                const buyerPhone = o.buyer ? o.buyer.telephone : (o.buyer_phone || '');
                const cleanPhone = buyerPhone.replace(/[^0-9]/g, '');
                const whatsappPhone = cleanPhone.startsWith('221') ? cleanPhone : '221' + cleanPhone;

                return `
                    <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <span style="font-weight: 700; color: #0f172a;">CMD-${o.id.substring(0,6).toUpperCase()}</span>
                            <span style="font-size: 0.8rem; color: #64748b;">${new Date(o.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                        <div style="font-size: 0.9rem; margin-bottom: 8px; color: #334155;">
                            <strong>${escapeHTML(buyerName)}</strong> - ${escapeHTML(o.delivery_address)}<br>
                            📞 ${escapeHTML(buyerPhone)}
                            ${buyerPhone ? `<a href="https://wa.me/${whatsappPhone}?text=${encodeURIComponent(`Bonjour ${buyerName}, je suis le vendeur sur Campus Market concernant votre commande CMD-${o.id.substring(0,6).toUpperCase()}.`)}" target="_blank" style="color: #25D366; text-decoration: none; margin-left: 8px; font-weight: bold;"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ''}
                        </div>
                        <div style="font-size: 0.9rem; color: #475569; margin-bottom: 8px;">
                            ${o.quantity || 1}x ${escapeHTML(o.product?.title || 'Produit inconnu')} (${o.price} F)
                        </div>
                        <div style="display: flex; gap: 8px; margin-top: 12px;">
                            ${o.status === 'pending' ? `<button onclick="updateOrderStatus('${o.id}', 'processing')" style="flex: 1; padding: 8px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; background: #D97706; color: white;">Préparer</button>` : ''}
                            ${(o.status === 'pending' || o.status === 'processing') ? `<button onclick="updateOrderStatus('${o.id}', 'shipped')" style="flex: 1; padding: 8px; border-radius: 8px; border: none; font-weight: 600; cursor: pointer; background: #3B82F6; color: white;">Envoyer (En route)</button>` : `<div style="flex: 1; text-align: center; color: #3B82F6; font-size: 0.85rem; font-weight: bold; padding: 8px; background: #DBEAFE; border-radius: 8px;">En attente de réception par l'acheteur</div>`}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            pendingContainer.innerHTML = '<p style="color: #64748B; text-align: center;">Aucune commande en attente.</p>';
        }
    }

    // Fetch Products
    const { data: products } = await supabase.from('products').select('*').eq('seller_id', user.id);
    const prodContainer = document.getElementById('seller-products-list');
    if(products && products.length > 0) {
        prodContainer.innerHTML = products.map(p => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px;">
                <div>
                    <strong style="display: block; font-size: 0.95rem;">${escapeHTML(p.title)}</strong>
                    <span style="font-size: 0.8rem; color: #64748b;">${p.price} FCFA - Stock: ${p.stock === -1 || p.stock === undefined ? 'Illimité' : p.stock}</span>
                </div>
                <button onclick="deleteSellerProduct('${p.id}')" style="background: transparent; color: #EF4444; border: 1px solid #EF4444; border-radius: 6px; padding: 4px 8px; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');
    } else {
        prodContainer.innerHTML = '<p style="color: #64748B; text-align: center;">Vous n\'avez pas encore de produit.</p>';
    }
};

function renderTopProducts(orders) {
    const container = document.getElementById('seller-top-products');
    if (!container) return;

    const delivered = orders.filter(o => o.status === 'delivered');
    if (delivered.length === 0) {
        container.innerHTML = '<div style="font-size: 0.85rem; color: #94A3B8; text-align: center;">Aucun produit vendu pour l\'instant.</div>';
        return;
    }

    const counts = {};
    delivered.forEach(o => {
        const title = o.product?.title || 'Produit inconnu';
        counts[title] = (counts[title] || 0) + (o.quantity || 1);
    });

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    container.innerHTML = sorted.map(([title, qty]) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: #F8FAFC; border-radius: 8px; padding: 10px 14px; border: 1px solid #E2E8F0; font-size: 0.85rem;">
            <span style="font-weight: 600; color: #1E293B;">${escapeHTML(title)}</span>
            <span style="background: #DBEAFE; color: #1D4ED8; padding: 2px 8px; border-radius: 99px; font-weight: 700; font-size: 0.75rem;">${qty} vendus</span>
        </div>
    `).join('');
}

function renderSellerSalesChart(orders) {
    const container = document.getElementById('seller-chart-container');
    if (!container) return;

    // Get sales for the last 7 days
    const days = [];
    const salesByDay = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        days.push(dateStr);
        salesByDay[dateStr] = 0;
    }

    // Filter delivered orders
    const delivered = orders.filter(o => o.status === 'delivered');
    delivered.forEach(o => {
        const dateStr = new Date(o.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
        if (salesByDay[dateStr] !== undefined) {
            salesByDay[dateStr] += o.price;
        }
    });

    const data = days.map(day => salesByDay[day]);
    const maxVal = Math.max(...data, 1000); // minimum scale

    // Build SVG
    const width = 320;
    const height = 120;
    const padding = 20;

    const points = data.map((val, index) => {
        const x = padding + (index * (width - 2 * padding) / (data.length - 1));
        const y = height - padding - (val * (height - 2 * padding) / maxVal);
        return { x, y, val, label: days[index] };
    });

    let pathD = `M ${points[0].x} ${points[0].y} `;
    for (let i = 1; i < points.length; i++) {
        pathD += `L ${points[i].x} ${points[i].y} `;
    }

    // Area under curve
    let areaD = pathD + `L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

    const dotsHtml = points.map(p => `
        <circle cx="${p.x}" cy="${p.y}" r="4" fill="#1D4ED8" stroke="white" stroke-width="1.5" />
        <text x="${p.x}" y="${p.y - 8}" font-size="8" font-weight="bold" fill="#1E293B" text-anchor="middle">${p.val > 0 ? p.val + 'F' : ''}</text>
        <text x="${p.x}" y="${height - 5}" font-size="8" fill="#94A3B8" text-anchor="middle">${p.label}</text>
    `).join('');

    container.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" style="overflow: visible;">
            <!-- Grid Lines -->
            <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#E2E8F0" stroke-width="1" />
            
            <!-- Fill Area -->
            <path d="${areaD}" fill="rgba(29, 78, 216, 0.08)" />
            
            <!-- Line Path -->
            <path d="${pathD}" fill="none" stroke="#1D4ED8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
            
            <!-- Interactive Dots & Labels -->
            ${dotsHtml}
        </svg>
    `;
}

window.toggleSellerStatus = async function() {
    if(!window.supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if(!user) return;
    
    const toggleInput = document.getElementById('seller-status-toggle');
    const textSpan = document.getElementById('seller-status-text');
    const bgDiv = document.getElementById('seller-status-bg');
    const circleDiv = document.getElementById('seller-status-circle');
    
    if(!toggleInput) return;
    const isOpen = toggleInput.checked;
    
    if (isOpen) {
        textSpan.innerText = "Ouvert";
        textSpan.style.color = "#10B981";
        bgDiv.style.background = "#10B981";
        circleDiv.style.left = "18px";
    } else {
        textSpan.innerText = "Fermé";
        textSpan.style.color = "#EF4444";
        bgDiv.style.background = "#EF4444";
        circleDiv.style.left = "2px";
    }

    try {
        const { error } = await supabase.from('profiles').update({ is_open: isOpen }).eq('id', user.id);
        if(error) throw error;
        if(window.showToast) showToast(isOpen ? "Votre boutique est maintenant ouverte" : "Votre boutique est fermée", "success");
    } catch(e) {
        alert('Erreur lors de la mise à jour du statut.');
        toggleInput.checked = !isOpen;
        loadSellerDashboard();
    }
};

window.updateOrderStatus = async function(orderId, newStatus) {
    if(!window.supabase) return;
    try {
        const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
        if(error) throw error;
        alert('Statut de la commande mis à jour !');
        loadSellerDashboard();
    } catch(e) {
        alert('Erreur lors de la mise à jour.');
    }
};

window.deleteSellerProduct = async function(productId) {
    if(!confirm("Êtes-vous sûr de vouloir supprimer ce produit ?")) return;
    if(!window.supabase) return;
    try {
        const { error } = await supabase.from('products').delete().eq('id', productId);
        if(error) throw error;
        alert('Produit supprimé.');
        loadSellerDashboard();
    } catch(e) {
        alert('Erreur lors de la suppression.');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const addProdForm = document.getElementById('add-product-form');
    if(addProdForm) {
        addProdForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(!window.supabase) return;
            const { data: { user } } = await supabase.auth.getUser();
            if(!user) return;

            const title = document.getElementById('new_prod_title').value;
            const price = document.getElementById('new_prod_price').value;
            const stockInput = document.getElementById('new_prod_stock');
            const stock = stockInput ? parseInt(stockInput.value) : -1;
            const category = document.getElementById('new_prod_category').value;
            
            // Map category to icon roughly
            let icon = 'fa-box';
            if(category === 'tech') icon = 'fa-laptop';
            if(category === 'fashion') icon = 'fa-shirt';
            if(category === 'food') icon = 'fa-burger';

            // Fonction de compression
            window.compressImage = function(file, maxWidth = 600, maxHeight = 600, quality = 0.7) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.readAsDataURL(file);
                    reader.onload = event => {
                        const img = new Image();
                        img.src = event.target.result;
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            let width = img.width;
                            let height = img.height;
                            if (width > height) {
                                if (width > maxWidth) { height = Math.round((height *= maxWidth / width)); width = maxWidth; }
                            } else {
                                if (height > maxHeight) { width = Math.round((width *= maxHeight / height)); height = maxHeight; }
                            }
                            canvas.width = width; canvas.height = height;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0, width, height);
                            resolve(canvas.toDataURL('image/jpeg', quality));
                        };
                        img.onerror = error => reject(error);
                    };
                    reader.onerror = error => reject(error);
                });
            };

            // Helper to convert base64 to Blob for storage upload
            const dataURLtoBlob = function(dataurl) {
                var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
                    bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
                while(n--){
                    u8arr[n] = bstr.charCodeAt(n);
                }
                return new Blob([u8arr], {type:mime});
            };

            try {
                // Gestion de l'image
                let image_url = null;
                const imageInput = document.getElementById('new_prod_image');
                if (imageInput && imageInput.files.length > 0) {
                    document.querySelector('#add-product-form button[type="submit"]').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Compression...';
                    const compressedBase64 = await window.compressImage(imageInput.files[0]);
                    
                    document.querySelector('#add-product-form button[type="submit"]').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Téléchargement...';
                    const blob = dataURLtoBlob(compressedBase64);
                    const fileExt = imageInput.files[0].name.split('.').pop() || 'jpg';
                    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                    
                    const { data: uploadData, error: uploadError } = await supabase.storage
                        .from('product-images')
                        .upload(fileName, blob, {
                            contentType: imageInput.files[0].type || 'image/jpeg'
                        });
                    
                    if (uploadError) throw uploadError;
                    
                    const { data: { publicUrl } } = supabase.storage
                        .from('product-images')
                        .getPublicUrl(fileName);
                    
                    image_url = publicUrl;
                }

                document.querySelector('#add-product-form button[type="submit"]').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...';
                
                const { error } = await supabase.from('products').insert([{
                    seller_id: user.id,
                    title: title,
                    price: price,
                    category: category,
                    icon: icon,
                    image_url: image_url,
                    stock: isNaN(stock) ? -1 : stock
                }]);
                if(error) throw error;
                
                if(window.showToast) showToast('Produit ajouté avec succès !', 'success');
                else alert('Produit ajouté avec succès !');
                addProdForm.reset();
                document.getElementById('add-product-form-container').style.display = 'none';
                document.querySelector('#add-product-form button[type="submit"]').innerHTML = 'Enregistrer';
                loadSellerDashboard(); // Refresh
            } catch(e) {
                document.querySelector('#add-product-form button[type="submit"]').innerHTML = 'Enregistrer';
                alert('Erreur lors de l\'ajout du produit.');
            }
        });
    }
});

// Update navigateTo to load seller dashboard
const sellerNavHook = window.navigateTo;
window.navigateTo = async function(viewId) {
    await sellerNavHook(viewId);
    if(viewId === 'admin') {
        loadSellerDashboard();
    }
};

// ==========================================
// REAL-TIME NOTIFICATIONS (PUSH & TOASTS)
// ==========================================

async function setupRealtimeNotifications() {
    if (!window.supabase) return;
    
    // 1. Demander la permission pour les notifications (Push du navigateur)
    if ("Notification" in window) {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission();
        }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 2. Abonnement aux changements sur la table orders via Supabase Realtime
    supabase
        .channel('public:orders')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'orders'
            },
            (payload) => {
                handleOrderChange(payload, user.id);
            }
        )
        .subscribe();
}

function handleOrderChange(payload, currentUserId) {
    const { eventType, new: newOrder, old: oldOrder } = payload;

    // A. Notification pour le vendeur (Nouvelle commande insérée)
    if (eventType === 'INSERT' && newOrder.seller_id === currentUserId) {
        playNotificationSound();
        showBrowserNotification("Nouvelle Commande !", "Vous avez reçu une nouvelle commande à préparer.");
        if (window.showToast) showToast("Nouvelle commande reçue !", "success");
        if (typeof loadSellerDashboard === 'function') loadSellerDashboard();
    }

    // B. Notification pour l'acheteur (Statut mis à jour)
    if (eventType === 'UPDATE' && newOrder.buyer_id === currentUserId) {
        if (newOrder.status !== oldOrder.status) {
            let msg = "";
            if (newOrder.status === 'processing') msg = "Votre commande est en cours de préparation.";
            if (newOrder.status === 'shipped') msg = "Le livreur est en route ! Préparez-vous.";
            if (newOrder.status === 'delivered') msg = "Commande livrée. Bon appétit !";
            if (newOrder.status === 'cancelled') msg = "Votre commande a été annulée.";
            
            if (msg) {
                playNotificationSound();
                showBrowserNotification("Mise à jour de votre commande", msg);
                if (window.showToast) showToast(msg, "success");
                if (typeof fetchMyOrders === 'function') fetchMyOrders();
            }
        }
    }
}

function showBrowserNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, {
                body: body,
                icon: '/images/icon-192x192.png',
                vibrate: [200, 100, 200]
            });
        }).catch(() => {
            new Notification(title, { body: body });
        });
    }
}

function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // Note La (A5)
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15); // Bip très court
    } catch (e) {
        console.log("Audio not supported or blocked", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialiser les notifications après un court délai pour s'assurer que l'auth est chargée
    setTimeout(setupRealtimeNotifications, 1500);
});

