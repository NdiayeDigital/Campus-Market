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
                    <button onclick="navigateTo('register')" class="btn btn-primary" style="width: 100%; margin-bottom: 12px; padding: 14px; border-radius: 12px; font-weight: 600;">Créer votre profil</button>
                    <button onclick="navigateTo('login')" class="btn" style="width: 100%; padding: 14px; border-radius: 12px; font-weight: 600; background: white; color: var(--color-text-main); border: 1px solid var(--color-border);">Connectez-vous à votre profil vendeur</button>
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

    const mainBottomNav = document.getElementById('bottom-nav');
    if(mainBottomNav) {
        if(viewId === 'superadmin' || viewId === 'login' || viewId === 'register') {
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

                // Connexion automatique et redirection vers l'accueil
                await checkAuthState();
                window.navigateTo('accueil');
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

window.checkAuthState = checkAuthState;