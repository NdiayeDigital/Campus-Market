
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
// SPA Navigation Logic (Hash Routing)
window.navigateTo = function(viewId) {
    if (viewId === 'admin') {
        viewId = 'admin-dashboard';
    }

    // 1. Mettre à jour l'ancre (hash) si elle diffère pour supporter l'historique et le rechargement
    if (window.location.hash !== '#' + viewId) {
        window.location.hash = viewId;
    }

    // 2. Manipulation DOM classique d'affichage
    document.querySelectorAll('.spa-view').forEach(view => { 
        view.style.display = 'none'; 
        view.classList.remove('active'); 
    });
    
    // Check if it's a seller subview
    if (viewId.startsWith('admin-')) {
        document.body.classList.add('seller-pro-theme');
        const targetView = document.getElementById('view-admin');
        if (targetView) {
            targetView.style.display = 'block';
            targetView.classList.add('active');
        }

        // Hide all admin subviews
        document.querySelectorAll('.admin-subview').forEach(sub => {
            (sub as HTMLElement).style.display = 'none';
        });

        // Show the active subview
        const subviewId = viewId.replace('admin-', '');
        const targetSubview = document.getElementById('admin-subview-' + subviewId);
        if (targetSubview) {
            targetSubview.style.display = 'block';
        }
    } else {
        document.body.classList.remove('seller-pro-theme');
        const targetView = document.getElementById('view-' + viewId);
        if (targetView) { 
            targetView.style.display = 'block'; 
            targetView.classList.add('active'); 
        }
    }
    
    // Update active state on seller tabs
    document.querySelectorAll('.seller-nav-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-target') === viewId) {
            tab.classList.add('active');
        }
    });

    document.querySelectorAll('.bottom-nav-item').forEach(btn => { 
        btn.classList.remove('active'); 
        if (btn.getAttribute('data-target') === viewId) { 
            btn.classList.add('active'); 
        } 
    });
    
    const bottomNav = document.getElementById('bottom-nav');
    if(bottomNav) {
        if(viewId === 'superadmin') {
            bottomNav.style.display = 'none';
        } else {
            bottomNav.style.display = 'flex';
        }
    }
    window.scrollTo(0, 0);
};

// Écouter le changement d'ancre dans l'URL pour la navigation historique (précédent/suivant)
window.addEventListener('hashchange', () => {
    let route = window.location.hash.substring(1) || 'accueil';
    if (route === 'admin') route = 'admin-dashboard';
    const isSubview = route.startsWith('admin-');
    const checkId = isSubview ? 'view-admin' : ('view-' + route);
    const targetView = document.getElementById(checkId);
    if (targetView && !targetView.classList.contains('active')) {
        window.navigateTo(route);
    }
});

// Restaurer la bonne vue au rechargement de la page
window.addEventListener('DOMContentLoaded', () => {
    let route = window.location.hash.substring(1) || 'accueil';
    if (route === 'admin') route = 'admin-dashboard';
    const isSubview = route.startsWith('admin-');
    const checkId = isSubview ? 'view-admin' : ('view-' + route);
    const targetView = document.getElementById(checkId);
    if (targetView) {
        // Laisser les wrappers asynchrones (auth, cart) se charger et configurer le statut
        setTimeout(() => {
            window.navigateTo(route);
        }, 100);
    }
});

window.updateBottomNavigation = function(role) {
    const bottomNav = document.getElementById('bottom-nav');
    if (!bottomNav) return;

    if (role === 'vendeur') {
        bottomNav.innerHTML = `
            <button class="bottom-nav-item" onclick="navigateTo('admin-dashboard')" data-target="admin-dashboard">
                <i class="fa-solid fa-chart-line"></i>
                <span>Dashboard</span>
            </button>
            <button class="bottom-nav-item" onclick="navigateTo('admin-orders')" data-target="admin-orders">
                <i class="fa-solid fa-clipboard-list"></i>
                <span>Mes Commandes</span>
            </button>
            <button class="bottom-nav-item" onclick="navigateTo('admin-products')" data-target="admin-products">
                <i class="fa-solid fa-boxes-stacked"></i>
                <span>Mes Produits</span>
            </button>
            <button class="bottom-nav-item" onclick="navigateTo('admin-profil')" data-target="admin-profil">
                <i class="fa-solid fa-user-gear"></i>
                <span>Profil</span>
            </button>
        `;
    } else {
        bottomNav.innerHTML = `
            <button class="bottom-nav-item" onclick="navigateTo('accueil')" data-target="accueil">
                <i class="fa-solid fa-house"></i>
                <span>Accueil</span>
            </button>
            <button class="bottom-nav-item" onclick="navigateTo('categories')" data-target="categories">
                <i class="fa-solid fa-grid-2"></i>
                <span>Catégories</span>
            </button>
            <button class="bottom-nav-item" onclick="navigateTo('panier')" data-target="panier">
                <i class="fa-solid fa-bag-shopping"></i>
                <span>Panier</span>
            </button>
            <button class="bottom-nav-item" onclick="navigateTo('commandes')" data-target="commandes">
                <i class="fa-solid fa-box"></i>
                <span>Commandes</span>
            </button>
            <button class="bottom-nav-item" onclick="navigateTo('profil')" data-target="profil">
                <i class="fa-solid fa-user"></i>
                <span>Profil</span>
            </button>
        `;
    }
};
function toggleSearch() {
    const searchContainer = document.getElementById('global-search-container');
    if (searchContainer.style.display === 'none') {
        searchContainer.style.display = 'block';
        document.getElementById('global-search-input').focus();
    } else {
        searchContainer.style.display = 'none';
    }
}

window.toggleSearch = toggleSearch;