const { supabase, escapeHTML, globalProducts } = window;

window.cart = JSON.parse(localStorage.getItem('campus_cart')) || [];

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
    
        cartContainer.innerHTML = '<div class="cart-empty"><i class="fa-solid fa-cart-shopping cart-empty-icon"></i><p>Panier vide.</p><button onclick="navigateTo(\'accueil\')" class="btn btn-primary cart-empty-btn">Découvrir les offres</button></div>';
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
                <div class="cart-item-img cart-item-avatar" style="color: ${item.color || '#1D4ED8'};">
                    <i class="fa-solid ${escapeHTML(item.icon || 'fa-box')}"></i>
                </div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${escapeHTML(item.title)}</div>
                    <div class="cart-item-price">${item.price} FCFA</div>
                </div>
                <div class="cart-qty cart-qty-control">
                    <button onclick="updateCartQty('${item.id}', -1)" class="cart-qty-btn-minus"><i class="fa-solid fa-minus"></i></button>
                    <span class="cart-qty-value">${item.quantity}</span>
                    <button onclick="updateCartQty('${item.id}', 1)" class="cart-qty-btn-plus"><i class="fa-solid fa-plus"></i></button>
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
            <span class="cart-summary-free-shipping">Gratuite</span>
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
        btnCheckout.className = 'btn btn-primary btn-checkout-panier-custom';
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
        window.cart = window.cart.filter(p => p.id !== id);
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
                let detail = '';
                if (pavillon === 'Jardin social') {
                    detail = '';
                } else if (pavillon === 'Bibliothèque universitaire') {
                    detail = ', ' + document.getElementById('order_etage').value;
                } else if (pavillon === 'Salle de cours') {
                    detail = ', ' + document.getElementById('order_chambre').value;
                } else { // Pavillon A ou B
                    detail = ', Chambre ' + document.getElementById('order_chambre').value;
                }
                const payment = document.getElementById('order_payment').value;
                const fullAddress = `${pavillon}${detail} [Paiement: ${payment}]`;

                // Fetch buyer profile metadata
                const { data: profile } = await supabase.from('profiles').select('prenom, nom, telephone').eq('id', user.id).single();
                const buyerName = profile ? `${profile.prenom} ${profile.nom}` : '';
                const buyerPhone = profile ? profile.telephone : '';

                // Créer une commande par article dans le panier
                const ordersToInsert = cart.map(item => ({
                    buyer_id: user.id,
                    buyer_name: buyerName,
                    buyer_phone: buyerPhone,
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
                window.cart = []; // Vider le panier
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

