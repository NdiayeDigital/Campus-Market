// SUPERADMIN LOGIC
const { supabase, escapeHTML } = window;

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
                    
                    // Baseline: 250 active students
                    const activeStudents = Math.max(250, users.length);
                    const elUsers = document.getElementById('stat-users');
                    if (elUsers) elUsers.innerText = activeStudents.toString();

                    // Baseline: 20 certified sellers
                    const certifiedSellers = Math.max(20, sellers.length);
                    const elSellers = document.getElementById('stat-sellers');
                    if (elSellers) elSellers.innerText = certifiedSellers.toString();
                    
                    let totalRevenue = 0;
                    let baseDeliveredOrders = 0;
                    
                    if(orders) {
                        const deliveredOrders = orders.filter(o => o.status === 'delivered');
                        baseDeliveredOrders = Math.max(150, deliveredOrders.length);
                        
                        const elOrders = document.getElementById('stat-orders');
                        if (elOrders) elOrders.innerText = baseDeliveredOrders + "+";
                        
                        // Calculate total revenue: 150 baseline orders * 1200 FCFA base + actual prices of delivered orders
                        let baselineRevenue = 180000;
                        totalRevenue = baselineRevenue;
                        deliveredOrders.forEach(o => { totalRevenue += parseFloat(o.price || 0); });
                    } else {
                        baseDeliveredOrders = 150;
                        const elOrders = document.getElementById('stat-orders');
                        if (elOrders) elOrders.innerText = "150+";
                        totalRevenue = 180000;
                    }
                    
                    const statRev = document.getElementById('stat-revenue');
                    if(statRev) statRev.innerText = totalRevenue.toLocaleString('fr-FR') + ' FCFA';

                    // Baseline: 4.5 average rating
                    const elRating = document.getElementById('stat-rating');
                    if (elRating) elRating.innerHTML = `4.5 <i class="fa-solid fa-star" style="color: #FCD34D; font-size: 1rem;"></i>`;
                    
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
        
        const adminProfileNameEl = document.getElementById('admin-profile-name');
        if (adminProfileNameEl) adminProfileNameEl.innerText = escapeHTML(profile.prenom) + " " + escapeHTML(profile.nom);
        const adminProfilePhoneEl = document.getElementById('admin-profile-phone');
        if (adminProfilePhoneEl) adminProfilePhoneEl.innerText = escapeHTML(profile.telephone);

        const toggleInput = document.getElementById('seller-status-toggle');
        const toggleInputProfil = document.getElementById('seller-status-toggle-profil');
        const textSpan = document.getElementById('seller-status-text');
        const bgDiv = document.getElementById('seller-status-bg');
        const circleDiv = document.getElementById('seller-status-circle');
        const bgDivProfil = document.getElementById('seller-status-bg-profil');
        const circleDivProfil = document.getElementById('seller-status-circle-profil');
        
        const openVal = profile.is_open !== false;
        if (toggleInput) toggleInput.checked = openVal;
        if (toggleInputProfil) toggleInputProfil.checked = openVal;
        
        if (toggleInput) {
            if (openVal) {
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

        if (toggleInputProfil) {
            if (openVal) {
                bgDivProfil.style.background = "#10B981";
                circleDivProfil.style.left = "18px";
            } else {
                bgDivProfil.style.background = "#EF4444";
                circleDivProfil.style.left = "2px";
            }
        }
    }

    // Fetch Orders
    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, status, created_at, price, quantity, delivery_address, buyer_name, buyer_phone, buyer:buyer_id(nom, prenom, telephone), product:product_id(title, category)')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

    if(!error && orders) {
        // Save to global cache
        (window as any).lastFetchedOrders = orders;

        // Gérer la répétition de l'alerte sonore pour les commandes en attente
        const hasPending = orders.some(o => o.status === 'pending');
        if (hasPending) {
            if (typeof (window as any).startPendingOrdersSoundLoop === 'function') {
                (window as any).startPendingOrdersSoundLoop();
            }
        } else {
            if (typeof (window as any).stopPendingOrdersSoundLoop === 'function') {
                (window as any).stopPendingOrdersSoundLoop();
            }
        }
        
        let totalRevenue = 0;
        const delivered = orders.filter(o => o.status === 'delivered');
        delivered.forEach(o => totalRevenue += o.price);
        
        // Mettre à jour les indicateurs du dashboard
        document.getElementById('stat-revenue').innerText = totalRevenue.toLocaleString('fr-FR') + " F";
        document.getElementById('stat-sales').innerText = delivered.length.toString();

        const avgOrder = delivered.length > 0 ? Math.round(totalRevenue / delivered.length) : 0;
        const avgEl = document.getElementById('stat-avg-order');
        if (avgEl) avgEl.innerText = avgOrder.toLocaleString('fr-FR') + " F";

        const nonCancelled = orders.filter(o => o.status !== 'cancelled').length;
        const conversionRate = nonCancelled > 0 ? Math.round((delivered.length / nonCancelled) * 100) : 0;
        const convEl = document.getElementById('stat-conversion');
        if (convEl) convEl.innerText = conversionRate + "%";

        // Power BI style target variance
        const targetRevenue = 100000;
        const variance = totalRevenue - targetRevenue;
        const varEl = document.getElementById('stat-variance');
        if (varEl) {
            if (variance >= 0) {
                varEl.innerText = "+" + variance.toLocaleString('fr-FR') + " F";
                varEl.style.color = "#10B981";
            } else {
                varEl.innerText = variance.toLocaleString('fr-FR') + " F";
                varEl.style.color = "#EF4444";
            }
        }

        // --- RENDU DU DASHBOARD VENDEUR ---

        // 1. Panel 1 : Ventes par Catégorie (Horizontal bar chart)
        const catRevenue: { [key: string]: number } = { food: 0, tech: 0, fashion: 0, services: 0 };
        const catLabels: { [key: string]: string } = { food: 'Restauration', tech: 'Technologie', fashion: 'Mode', services: 'Services' };
        const catColors: { [key: string]: string } = { food: '#10B981', tech: '#3B82F6', fashion: '#F59E0B', services: '#8B5CF6' };
        
        delivered.forEach(o => {
            const cat = o.product?.category || 'services';
            if (catRevenue[cat] !== undefined) {
                catRevenue[cat] += o.price;
            }
        });

        const maxCatRev = Math.max(...Object.values(catRevenue), 1);
        const categoriesChartEl = document.getElementById('seller-categories-chart');
        if (categoriesChartEl) {
            categoriesChartEl.innerHTML = Object.entries(catRevenue).map(([cat, rev]) => {
                const pct = Math.round((rev / maxCatRev) * 100);
                const color = catColors[cat] || '#8B5CF6';
                const label = catLabels[cat] || cat;
                return `
                    <div style="font-size: 0.75rem; text-align: left; margin-bottom: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-weight: 600; color: #94A3B8;">
                            <span>${label}</span>
                            <span style="font-weight: 700; color: #F8FAFC;">${rev.toLocaleString('fr-FR')} F</span>
                        </div>
                        <div style="width: 100%; height: 6px; background: #0F172A; border-radius: 99px; overflow: hidden; border: 1px solid #334155;">
                            <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 99px;"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // 2. Panel 2 : Répartition Donut
        const totalCount = orders.length;
        const deliveredCount = delivered.length;
        const pendingCount = orders.filter(o => o.status === 'pending').length;
        const processingCount = orders.filter(o => o.status === 'processing' || o.status === 'shipped').length;
        const cancelledCount = orders.filter(o => o.status === 'cancelled').length;

        const delPct = totalCount > 0 ? Math.round((deliveredCount / totalCount) * 100) : 0;
        const penPct = totalCount > 0 ? Math.round(((pendingCount + processingCount) / totalCount) * 100) : 0;
        const canPct = totalCount > 0 ? Math.round((cancelledCount / totalCount) * 100) : 0;

        const totalCountEl = document.getElementById('seller-total-orders-count');
        if (totalCountEl) totalCountEl.innerText = totalCount.toString();
        
        const pctDelEl = document.getElementById('donut-pct-delivered');
        if (pctDelEl) pctDelEl.innerText = delPct + "%";
        
        const pctPenEl = document.getElementById('donut-pct-pending');
        if (pctPenEl) pctPenEl.innerText = penPct + "%";
        
        const pctCanEl = document.getElementById('donut-pct-cancelled');
        if (pctCanEl) pctCanEl.innerText = canPct + "%";

        const donutChart = document.getElementById('seller-donut-chart');
        if (donutChart) {
            const c1 = delPct;
            const c2 = delPct + penPct;
            donutChart.style.background = `conic-gradient(#10B981 0% ${c1}%, #F59E0B ${c1}% ${c2}%, #EF4444 ${c2}% 100%)`;
        }

        // 3. Panel 3 : Objectifs & Performances (Produits, notes et objectifs financiers)
        const { data: products } = await supabase.from('products').select('id, stock').eq('seller_id', user.id);
        let stockPct = 100;
        let inStockCount = 0;
        if (products && products.length > 0) {
            inStockCount = products.filter(p => p.stock > 0 || p.stock === -1).length;
            stockPct = Math.round((inStockCount / products.length) * 100);
        }

        const { data: reviews } = await supabase.from('reviews').select('rating').eq('seller_id', user.id);
        let avgRating = 5.0;
        let ratingPct = 100;
        if (reviews && reviews.length > 0) {
            const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
            avgRating = Math.round((sum / reviews.length) * 10) / 10;
            ratingPct = Math.round((avgRating / 5) * 100);
        }

        const goalsContainer = document.getElementById('seller-goals-container');
        if (goalsContainer) {
            const targetRev = 100000;
            const revGoalPct = Math.min(Math.round((totalRevenue / targetRev) * 100), 100);
            goalsContainer.innerHTML = `
                <div style="font-size: 0.75rem; text-align: left; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; font-weight: 600; color: #94A3B8; margin-bottom: 3px;">
                        <span>Revenu (Objectif: 100k F)</span>
                        <span style="color: #F8FAFC; font-weight: 700;">${revGoalPct}%</span>
                    </div>
                    <div style="width: 100%; height: 5px; background: #0F172A; border-radius: 99px; overflow: hidden; margin-bottom: 2px; border: 1px solid #334155;">
                        <div style="width: ${revGoalPct}%; height: 100%; background: #F59E0B; border-radius: 99px;"></div>
                    </div>
                    <div style="font-size: 0.6rem; color: #94A3B8;">${totalRevenue.toLocaleString('fr-FR')} F / ${targetRev.toLocaleString('fr-FR')} F</div>
                </div>

                <div style="font-size: 0.75rem; text-align: left; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; font-weight: 600; color: #94A3B8; margin-bottom: 3px;">
                        <span>Livraison (Objectif: 90%)</span>
                        <span style="color: #F8FAFC; font-weight: 700;">${conversionRate}%</span>
                    </div>
                    <div style="width: 100%; height: 5px; background: #0F172A; border-radius: 99px; overflow: hidden; margin-bottom: 2px; border: 1px solid #334155;">
                        <div style="width: ${conversionRate}%; height: 100%; background: #10B981; border-radius: 99px;"></div>
                    </div>
                    <div style="font-size: 0.6rem; color: #94A3B8;">${deliveredCount} livrées / ${nonCancelled} actives</div>
                </div>

                <div style="font-size: 0.75rem; text-align: left; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; font-weight: 600; color: #94A3B8; margin-bottom: 3px;">
                        <span>Disponibilité du Stock</span>
                        <span style="color: #F8FAFC; font-weight: 700;">${stockPct}%</span>
                    </div>
                    <div style="width: 100%; height: 5px; background: #0F172A; border-radius: 99px; overflow: hidden; margin-bottom: 2px; border: 1px solid #334155;">
                        <div style="width: ${stockPct}%; height: 100%; background: #3B82F6; border-radius: 99px;"></div>
                    </div>
                    <div style="font-size: 0.6rem; color: #94A3B8;">${inStockCount} en stock / ${products ? products.length : 0} articles</div>
                </div>

                <div style="font-size: 0.75rem; text-align: left;">
                    <div style="display: flex; justify-content: space-between; font-weight: 600; color: #94A3B8; margin-bottom: 3px;">
                        <span>Note Moyenne (${avgRating}/5 ★)</span>
                        <span style="color: #F8FAFC; font-weight: 700;">${ratingPct}%</span>
                    </div>
                    <div style="width: 100%; height: 5px; background: #0F172A; border-radius: 99px; overflow: hidden; margin-bottom: 2px; border: 1px solid #334155;">
                        <div style="width: ${ratingPct}%; height: 100%; background: #8B5CF6; border-radius: 99px;"></div>
                    </div>
                    <div style="font-size: 0.6rem; color: #94A3B8;">Basé sur ${reviews ? reviews.length : 0} retours</div>
                </div>
            `;
        }

        // Render current tab orders
        if (window.renderSellerOrdersList) {
            window.renderSellerOrdersList(orders);
        }
    }

    // Fetch and render Products
    const { data: products } = await supabase.from('products').select('*').eq('seller_id', user.id);
    (window as any).lastFetchedProducts = products;
    const prodContainer = document.getElementById('seller-products-list');
    if (prodContainer) {
        if(products && products.length > 0) {
            prodContainer.innerHTML = products.map(p => {
                let stockBadgeHtml = '';
                if (p.stock === -1 || p.stock === undefined) {
                    stockBadgeHtml = `<span class="stock-badge-pro in-stock">Illimité</span>`;
                } else if (p.stock === 0) {
                    stockBadgeHtml = `<span class="stock-badge-pro out-of-stock">Épuisé</span>`;
                } else if (p.stock <= 5) {
                    stockBadgeHtml = `<span class="stock-badge-pro low-stock">Faible (${p.stock})</span>`;
                } else {
                    stockBadgeHtml = `<span class="stock-badge-pro in-stock">Disponible (${p.stock})</span>`;
                }

                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border: 1px solid #334155; border-radius: 12px; margin-bottom: 10px; background: #1E293B;">
                        <div>
                            <strong style="display: block; font-size: 0.9rem; color: #F8FAFC;">${escapeHTML(p.title)}</strong>
                            <div style="font-size: 0.8rem; color: #94A3B8; margin-top: 4px; display: flex; align-items: center; gap: 8px;">
                                <span>${p.price.toLocaleString('fr-FR')} F</span>
                                <span>•</span>
                                ${stockBadgeHtml}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <!-- Stock Controller -->
                            <div class="quick-stock-control">
                                <button onclick="updateProductStock('${p.id}', -1)" class="quick-stock-btn">-</button>
                                <span class="quick-stock-value">${p.stock === -1 ? '∞' : p.stock}</span>
                                <button onclick="updateProductStock('${p.id}', 1)" class="quick-stock-btn">+</button>
                            </div>
                            <!-- Delete button -->
                            <button onclick="deleteSellerProduct('${p.id}')" style="background: rgba(239,68,68,0.15); color: #EF4444; border: 1px solid rgba(239,68,68,0.25); border-radius: 8px; padding: 6px 10px; cursor: pointer; transition: all 0.2s;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            prodContainer.innerHTML = '<p style="color: #94A3B8; text-align: center; padding: 40px;">Vous n\'avez pas encore de produit.</p>';
        }
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
    const toggleInputProfil = document.getElementById('seller-status-toggle-profil');
    const textSpan = document.getElementById('seller-status-text');
    const bgDiv = document.getElementById('seller-status-bg');
    const circleDiv = document.getElementById('seller-status-circle');
    const bgDivProfil = document.getElementById('seller-status-bg-profil');
    const circleDivProfil = document.getElementById('seller-status-circle-profil');
    
    if(!toggleInput) return;
    const isOpen = toggleInput.checked;

    if (toggleInputProfil) toggleInputProfil.checked = isOpen;
    
    if (isOpen) {
        textSpan.innerText = "Ouvert";
        textSpan.style.color = "#10B981";
        bgDiv.style.background = "#10B981";
        circleDiv.style.left = "18px";
        if (bgDivProfil) bgDivProfil.style.background = "#10B981";
        if (circleDivProfil) circleDivProfil.style.left = "18px";
    } else {
        textSpan.innerText = "Fermé";
        textSpan.style.color = "#EF4444";
        bgDiv.style.background = "#EF4444";
        circleDiv.style.left = "2px";
        if (bgDivProfil) bgDivProfil.style.background = "#EF4444";
        if (circleDivProfil) circleDivProfil.style.left = "2px";
    }

    try {
        const { error } = await supabase.from('profiles').update({ is_open: isOpen }).eq('id', user.id);
        if(error) throw error;
        if(window.showToast) showToast(isOpen ? "Votre boutique est maintenant ouverte" : "Votre boutique est fermée", "success");
    } catch(e) {
        alert('Erreur lors de la mise à jour du statut.');
        toggleInput.checked = !isOpen;
        if (toggleInputProfil) toggleInputProfil.checked = !isOpen;
        loadSellerDashboard();
    }
};

window.toggleSellerStatusProfil = async function() {
    const toggleInput = document.getElementById('seller-status-toggle');
    const toggleInputProfil = document.getElementById('seller-status-toggle-profil');
    if (toggleInputProfil && toggleInput) {
        toggleInput.checked = toggleInputProfil.checked;
        window.toggleSellerStatus();
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
    // Product Image Preview Setup
    const imgInput = document.getElementById('new_prod_image') as HTMLInputElement;
    const previewContainer = document.getElementById('new_prod_image_preview_container');
    const previewImg = document.getElementById('new_prod_image_preview') as HTMLImageElement;
    
    if (imgInput && previewContainer && previewImg) {
        imgInput.addEventListener('change', () => {
            const file = imgInput.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (e.target?.result) {
                        previewImg.src = e.target.result as string;
                        previewContainer.style.display = 'block';
                    }
                };
                reader.readAsDataURL(file);
            } else {
                previewContainer.style.display = 'none';
            }
        });
    }

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
                const imageInput = document.getElementById('new_prod_image') as HTMLInputElement;
                if (imageInput && imageInput.files && imageInput.files.length > 0) {
                    const file = imageInput.files[0];
                    const maxSize = 8 * 1024 * 1024; // 8 MB
                    if (file.size > maxSize) {
                        alert("Le fichier est trop volumineux (max 8 Mo). Veuillez réduire la taille de l'image.");
                        return;
                    }
                    document.querySelector('#add-product-form button[type="submit"]').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Compression...';
                    const compressedBase64 = await window.compressImage(file);
                    
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
                if ((window as any).clearProductImagePreview) {
                    (window as any).clearProductImagePreview();
                }
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

let pendingOrdersInterval: any = null;

(window as any).startPendingOrdersSoundLoop = function() {
    if (pendingOrdersInterval) return;
    pendingOrdersInterval = setInterval(() => {
        const orders = (window as any).lastFetchedOrders;
        const hasPending = orders && orders.some((o: any) => o.status === 'pending');
        if (hasPending) {
            playNotificationSound();
            if (window.showToast) window.showToast("Vous avez des commandes en attente à traiter ! 🔔", "info");
        } else {
            (window as any).stopPendingOrdersSoundLoop();
        }
    }, 30000); // Répéter toutes les 30 secondes
};

(window as any).stopPendingOrdersSoundLoop = function() {
    if (pendingOrdersInterval) {
        clearInterval(pendingOrdersInterval);
        pendingOrdersInterval = null;
    }
};

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

    // Récupérer le rôle pour configurer l'abonnement
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile) return;

    // 2. Abonnement personnalisé selon le rôle
    if (profile.role === 'vendeur') {
        supabase
            .channel('public:orders')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `seller_id=eq.${user.id}`
                },
                (payload) => {
                    handleOrderChange(payload, user.id);
                }
            )
            .subscribe();
    } else if (profile.role === 'acheteur') {
        supabase
            .channel('public:orders')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'orders',
                    filter: `buyer_id=eq.${user.id}`
                },
                (payload) => {
                    handleOrderChange(payload, user.id);
                }
            )
            .subscribe();
    } else if (profile.role === 'superadmin') {
        // Notification pour le superadmin en cas de demande vendeur en attente
        supabase
            .channel('public:profiles')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'profiles'
                },
                (payload) => {
                    const newProfile = payload.new;
                    if (newProfile && newProfile.role === 'vendeur_pending') {
                        playNotificationSound();
                        showBrowserNotification("Nouvelle demande vendeur !", `L'étudiant ${newProfile.prenom} ${newProfile.nom} souhaite devenir vendeur.`);
                        if (window.showToast) showToast(`Nouvelle demande vendeur de ${newProfile.prenom} ${newProfile.nom} !`, "info");
                        if (typeof (window as any).loadAdminData === 'function') {
                            (window as any).loadAdminData();
                        }
                    }
                }
            )
            .subscribe();

        // Rafraîchir les données globales de l'admin en temps réel
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
                    if (typeof (window as any).loadAdminData === 'function') {
                        (window as any).loadAdminData();
                    }
                }
            )
            .subscribe();
    }
}

function handleOrderChange(payload, currentUserId) {
    const eventType = payload.eventType;
    const newOrder = payload.new;
    const oldOrder = payload.old;

    // A. Notification pour le vendeur (Nouvelle commande insérée)
    if (eventType === 'INSERT' && newOrder.seller_id === currentUserId) {
        playNotificationSound();
        showBrowserNotification("Nouvelle Commande !", "Vous avez reçu une nouvelle commande à préparer.");
        if (window.showToast) showToast("Nouvelle commande reçue !", "success");
        if (typeof loadSellerDashboard === 'function') loadSellerDashboard();
    }

    // B. Notification pour l'acheteur (Statut mis à jour)
    if (eventType === 'UPDATE' && newOrder.buyer_id === currentUserId) {
        if (!oldOrder || newOrder.status !== oldOrder.status) {
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

let audioEnabled = false;
let audioCtx: AudioContext | null = null;

(window as any).enableAudioAlerts = async function() {
    const btn = document.getElementById('btn-audio-enable');
    const icon = document.getElementById('audio-enable-icon');
    const text = document.getElementById('audio-enable-text');
    if (!btn || !icon) return;

    if (!audioEnabled) {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (audioCtx.state === 'suspended') {
                await audioCtx.resume();
            }
            audioEnabled = true;
            
            // Jouer un son de test pour confirmer
            playNotificationSound();

            // Mettre à jour l'interface
            icon.className = 'fa-solid fa-volume-high';
            icon.style.color = '#10B981';
            btn.style.background = 'rgba(16, 185, 129, 0.15)';
            if (text) text.innerText = 'Alertes actives';
            if (window.showToast) window.showToast("Alertes sonores activées ! 🔊");
        } catch (e) {
            console.error("Failed to enable AudioContext:", e);
            alert("Erreur d'activation audio. Veuillez interagir avec la page.");
        }
    } else {
        audioEnabled = false;
        icon.className = 'fa-solid fa-volume-xmark';
        icon.style.color = '#EF4444';
        btn.style.background = 'rgba(255,255,255,0.15)';
        if (text) text.innerText = 'Alertes muettes';
        if (window.showToast) window.showToast("Alertes sonores désactivées. 🔇");
    }
};

function playNotificationSound() {
    if (!audioEnabled || !audioCtx) return;
    try {
        const ctx = audioCtx;
        if (ctx.state === 'suspended') {
            ctx.resume();
        }
        
        // Premier bip (A5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gain1.gain.setValueAtTime(0, ctx.currentTime);
        gain1.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start();
        osc1.stop(ctx.currentTime + 0.3);

        // Deuxième bip plus aigu (C6) après 150ms
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1046.50, ctx.currentTime + 0.15); // C6
        gain2.gain.setValueAtTime(0, ctx.currentTime + 0.15);
        gain2.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.2);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start();
        osc2.stop(ctx.currentTime + 0.45);
    } catch (e) {
        console.log("Audio not supported or blocked", e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Initialiser les notifications après un court délai pour s'assurer que l'auth est chargée
    setTimeout(setupRealtimeNotifications, 1500);
});


window.loadAdminData = loadAdminData;

// ==========================================
// SELLER PRO INTERACTION HELPERS
// ==========================================
(window as any).currentOrderTab = 'pending';
(window as any).lastFetchedOrders = null;
(window as any).lastFetchedProducts = null;

(window as any).switchOrderTab = function(tab: string) {
    (window as any).currentOrderTab = tab;
    document.querySelectorAll('.order-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeTabBtn = document.getElementById('tab-orders-' + tab);
    if (activeTabBtn) activeTabBtn.classList.add('active');
    
    // Update subview title
    const titleEl = document.getElementById('orders-current-title');
    if (titleEl) {
        if (tab === 'pending') {
            titleEl.innerHTML = `<i class="fa-solid fa-bell" style="margin-right: 8px; color: #10B981;"></i> Nouvelles Commandes (À Traiter)`;
        } else if (tab === 'processing') {
            titleEl.innerHTML = `<i class="fa-solid fa-clock" style="margin-right: 8px; color: #F59E0B;"></i> Commandes en Cours`;
        } else {
            titleEl.innerHTML = `<i class="fa-solid fa-folder-open" style="margin-right: 8px; color: #94A3B8;"></i> Historique des Commandes`;
        }
    }
    
    if ((window as any).lastFetchedOrders) {
        (window as any).renderSellerOrdersList((window as any).lastFetchedOrders);
    }
};

(window as any).renderSellerOrdersList = function(orders: any[]) {
    const listContainer = document.getElementById('seller-orders-list');
    if (!listContainer) return;

    // Filter based on active tab
    let filteredOrders = [];
    const currentTab = (window as any).currentOrderTab;
    if (currentTab === 'pending') {
        filteredOrders = orders.filter(o => o.status === 'pending');
    } else if (currentTab === 'processing') {
        filteredOrders = orders.filter(o => o.status === 'processing' || o.status === 'shipped');
    } else {
        filteredOrders = orders.filter(o => o.status === 'delivered' || o.status === 'cancelled');
    }

    // Render badge counts
    const pendingCount = orders.filter(o => o.status === 'pending').length;
    const processingCount = orders.filter(o => o.status === 'processing' || o.status === 'shipped').length;

    const pendingBadge = document.getElementById('badge-orders-pending');
    if (pendingBadge) {
        if (pendingCount > 0) {
            pendingBadge.innerText = pendingCount.toString();
            pendingBadge.style.display = 'inline-block';
        } else {
            pendingBadge.style.display = 'none';
        }
    }

    const processingBadge = document.getElementById('badge-orders-processing');
    if (processingBadge) {
        if (processingCount > 0) {
            processingBadge.innerText = processingCount.toString();
            processingBadge.style.display = 'inline-block';
        } else {
            processingBadge.style.display = 'none';
        }
    }

    if (filteredOrders.length === 0) {
        let emptyMsg = "Aucune commande à traiter.";
        if (currentTab === 'processing') emptyMsg = "Aucune commande en cours.";
        if (currentTab === 'completed') emptyMsg = "Aucun historique disponible.";
        listContainer.innerHTML = `<p style="color: #94A3B8; text-align: center; padding: 40px; font-size: 0.85rem;">${emptyMsg}</p>`;
        return;
    }

    listContainer.innerHTML = filteredOrders.map(o => {
        const buyerName = o.buyer ? `${o.buyer.prenom} ${o.buyer.nom}` : (o.buyer_name || 'Client Invité');
        const buyerPhone = o.buyer ? o.buyer.telephone : (o.buyer_phone || '');
        const cleanPhone = buyerPhone.replace(/[^0-9]/g, '');
        const whatsappPhone = cleanPhone.startsWith('221') ? cleanPhone : '221' + cleanPhone;

        let actionButtonsHtml = '';
        if (o.status === 'pending') {
            actionButtonsHtml = `
                <button onclick="updateOrderStatus('${o.id}', 'processing')" style="flex: 1; padding: 10px; border-radius: 8px; border: none; font-weight: 700; cursor: pointer; background: #10B981; color: white;">
                    <i class="fa-solid fa-play"></i> Préparer
                </button>
                <button onclick="updateOrderStatus('${o.id}', 'cancelled')" style="padding: 10px; border-radius: 8px; border: 1px solid #EF4444; font-weight: 700; cursor: pointer; background: transparent; color: #EF4444;">
                    Rejeter
                </button>
            `;
        } else if (o.status === 'processing') {
            actionButtonsHtml = `
                <button onclick="updateOrderStatus('${o.id}', 'shipped')" style="flex: 1; padding: 10px; border-radius: 8px; border: none; font-weight: 700; cursor: pointer; background: #3B82F6; color: white;">
                    <i class="fa-solid fa-truck"></i> Expédier (En route)
                </button>
            `;
        } else if (o.status === 'shipped') {
            actionButtonsHtml = `
                <button onclick="updateOrderStatus('${o.id}', 'delivered')" style="flex: 1; padding: 10px; border-radius: 8px; border: none; font-weight: 700; cursor: pointer; background: #10B981; color: white;">
                    <i class="fa-solid fa-circle-check"></i> Livré
                </button>
            `;
        } else {
            let statusText = o.status === 'delivered' ? 'Livré' : 'Annulé';
            let statusColor = o.status === 'delivered' ? '#10B981' : '#EF4444';
            let statusBg = o.status === 'delivered' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)';
            actionButtonsHtml = `
                <div style="flex: 1; text-align: center; color: ${statusColor}; font-size: 0.85rem; font-weight: 800; padding: 8px; background: ${statusBg}; border-radius: 8px; text-transform: uppercase;">
                    ${statusText}
                </div>
            `;
        }

        return `
            <div style="border: 1px solid #334155; border-radius: 12px; padding: 16px; margin-bottom: 12px; background: #1E293B;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span style="font-weight: 800; color: #10B981; font-size: 0.85rem;">CMD-${o.id.substring(0,6).toUpperCase()}</span>
                    <span style="font-size: 0.75rem; color: #94A3B8;">${new Date(o.created_at).toLocaleDateString('fr-FR')} ${new Date(o.created_at).toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div style="font-size: 0.85rem; margin-bottom: 8px; color: #F8FAFC; line-height: 1.4;">
                    <strong>👤 ${escapeHTML(buyerName)}</strong><br>
                    📍 Pavillon / Chambre : ${escapeHTML(o.delivery_address)}<br>
                    📞 ${escapeHTML(buyerPhone)}
                    ${buyerPhone ? `<a href="https://wa.me/${whatsappPhone}?text=${encodeURIComponent(`Bonjour ${buyerName}, je suis le vendeur sur Campus Market concernant votre commande CMD-${o.id.substring(0,6).toUpperCase()}.`)}" target="_blank" style="color: #25D366; text-decoration: none; margin-left: 8px; font-weight: bold;"><i class="fa-brands fa-whatsapp"></i> Contacter</a>` : ''}
                </div>
                <div style="font-size: 0.85rem; color: #94A3B8; margin-bottom: 12px; border-top: 1px dashed #334155; padding-top: 8px;">
                    🛒 ${o.quantity || 1}x <strong>${escapeHTML(o.product?.title || 'Produit inconnu')}</strong> (${o.price} F)
                </div>
                <div style="display: flex; gap: 8px; margin-top: 12px;">
                    ${actionButtonsHtml}
                </div>
            </div>
        `;
    }).join('');
};

(window as any).updateProductStock = async function(productId: string, delta: number) {
    const products = (window as any).lastFetchedProducts;
    if (!products) return;
    
    const product = products.find((p: any) => p.id === productId);
    if (!product) return;

    if (product.stock === -1) {
        product.stock = 10; // Valeur initiale par défaut si on modifie un stock illimité
    } else {
        product.stock = Math.max(0, product.stock + delta);
    }
    
    try {
        const { error } = await supabase.from('products').update({ stock: product.stock }).eq('id', productId);
        if (error) throw error;
        
        // Recharger le tableau de bord vendeur
        window.loadSellerDashboard();
    } catch (e) {
        console.error("Error updating stock:", e);
        alert("Erreur de mise à jour du stock.");
    }
};

(window as any).clearProductImagePreview = function() {
    const imgInput = document.getElementById('new_prod_image') as HTMLInputElement;
    const previewContainer = document.getElementById('new_prod_image_preview_container');
    const previewImg = document.getElementById('new_prod_image_preview') as HTMLImageElement;
    
    if (imgInput) imgInput.value = '';
    if (previewImg) previewImg.src = '';
    if (previewContainer) previewContainer.style.display = 'none';
};