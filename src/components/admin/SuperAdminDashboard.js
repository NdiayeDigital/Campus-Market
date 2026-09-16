/**
 * Composant SuperAdminDashboard (Panneau d'administration de l'UIDT)
 * Supervision globale, modération des demandes d'adhésion et suspension des boutiques.
 */

import {
    fetchGlobalMetrics,
    fetchPendingSellers,
    fetchActiveSellers,
    approveSeller,
    rejectSeller,
    suspendSeller,
    loginAdmin,
} from '../../services/admin-service.js';
import { supabase } from '../../services/supabase.js';
import { escapeHTML } from '../../utils/security.js';

/**
 * Crée le tableau de bord SuperAdmin.
 * @param {Object} props
 * @param {Function} props.onExit - Callback lors de la fermeture ou déconnexion
 * @param {Function} props.onShowToast - Callback pour afficher les toasts
 * @returns {HTMLElement}
 */
export function createSuperAdminDashboard({ onExit, onShowToast } = {}) {
    const containerEl = document.createElement('div');
    containerEl.className = 'w-full max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6';

    let currentAdmin = null;
    let metrics = null;
    let pendingSellers = [];
    let activeSellers = [];
    let isLoading = true;
    let isAuthenticated = false;

    async function checkExistingAuth() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .maybeSingle();

                if (profile && profile.role === 'superadmin') {
                    currentAdmin = profile;
                    isAuthenticated = true;
                    await loadAdminData();
                    return;
                }
            }
        } catch {
            // Ignorer
        }
        isAuthenticated = false;
        isLoading = false;
        render();
    }

    async function loadAdminData() {
        isLoading = true;
        render();

        try {
            const [m, p, a] = await Promise.all([
                fetchGlobalMetrics(),
                fetchPendingSellers(),
                fetchActiveSellers(),
            ]);
            metrics = m;
            pendingSellers = p;
            activeSellers = a;
        } catch (err) {
            console.error('[SuperAdmin] Erreur chargement données:', err);
            if (typeof onShowToast === 'function') {
                onShowToast(err.message, 'warning');
            }
        } finally {
            isLoading = false;
            render();
        }
    }

    function render() {
        if (!isAuthenticated) {
            renderLoginModal();
            return;
        }

        if (isLoading) {
            containerEl.innerHTML = `
                <div class="flex flex-col gap-4 animate-pulse py-8">
                    <div class="h-10 bg-slate-200 rounded-xl w-1/4"></div>
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        ${Array(4).fill(0).map(() => `<div class="h-24 bg-slate-200 rounded-2xl"></div>`).join('')}
                    </div>
                </div>
            `;
            return;
        }

        const m = metrics || {
            activeSellersCount: 0,
            pendingSellersCount: 0,
            totalOrdersCount: 0,
            totalDeliveredRevenue: 0,
        };

        containerEl.innerHTML = `
            <!-- En-tête SuperAdmin -->
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-5 rounded-2xl shadow-md">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-xl bg-accent text-slate-950 font-extrabold flex items-center justify-center text-lg shadow-sm">
                        <i class="fa-solid fa-shield-halved"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h1 class="font-heading font-extrabold text-lg text-white">Administration Centrale</h1>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-accent/20 text-accent border border-accent/40">
                                UIDT
                            </span>
                        </div>
                        <p class="text-xs text-slate-400 mt-0.5">Superviseur : ${escapeHTML(currentAdmin?.prenom || '')} ${escapeHTML(currentAdmin?.nom || 'Admin')}</p>
                    </div>
                </div>

                <div class="flex items-center gap-2.5">
                    <button id="btn-refresh-admin" class="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-colors min-h-[44px]">
                        <i class="fa-solid fa-arrows-rotate"></i>
                        <span>Actualiser</span>
                    </button>
                    <button id="btn-exit-admin" class="flex items-center gap-1.5 px-3.5 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 rounded-xl text-xs font-bold transition-all min-h-[44px]">
                        <i class="fa-solid fa-arrow-right-from-bracket"></i>
                        <span>Quitter</span>
                    </button>
                </div>
            </div>

            <!-- Cartes KPI (MÉTRIQUES RÉELLES SANS AUCUN PLANCHER) -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <!-- Vendeurs Actifs -->
                <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div class="flex items-center justify-between text-slate-500 mb-2">
                        <span class="text-xs font-semibold">Marchands certifiés</span>
                        <i class="fa-solid fa-store text-emerald-600 text-sm"></i>
                    </div>
                    <span class="font-heading font-extrabold text-2xl text-slate-900">${m.activeSellersCount}</span>
                    <span class="text-[10px] text-slate-400 mt-1">Boutiques actives</span>
                </div>

                <!-- Demandes en attente -->
                <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between relative overflow-hidden">
                    ${m.pendingSellersCount > 0 ? `<div class="absolute -top-6 -right-6 w-12 h-12 bg-accent/20 rounded-full animate-ping"></div>` : ''}
                    <div class="flex items-center justify-between text-slate-500 mb-2">
                        <span class="text-xs font-semibold">Demandes en attente</span>
                        <i class="fa-solid fa-hourglass-half text-amber-500 text-sm"></i>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="font-heading font-extrabold text-2xl text-slate-900">${m.pendingSellersCount}</span>
                        ${m.pendingSellersCount > 0 ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-accent text-slate-950">Action requise</span>` : ''}
                    </div>
                    <span class="text-[10px] text-slate-400 mt-1">Candidatures étudiantes</span>
                </div>

                <!-- Commandes Globales -->
                <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div class="flex items-center justify-between text-slate-500 mb-2">
                        <span class="text-xs font-semibold">Total Commandes</span>
                        <i class="fa-solid fa-boxes-packing text-primary text-sm"></i>
                    </div>
                    <span class="font-heading font-extrabold text-2xl text-slate-900">${m.totalOrdersCount}</span>
                    <span class="text-[10px] text-slate-400 mt-1">Historique complet</span>
                </div>

                <!-- Volume Financier Réel -->
                <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
                    <div class="flex items-center justify-between text-slate-500 mb-2">
                        <span class="text-xs font-semibold">Volume d'affaires réel</span>
                        <i class="fa-solid fa-coins text-emerald-600 text-sm"></i>
                    </div>
                    <span class="font-heading font-extrabold text-xl text-emerald-600 leading-tight">
                        ${Number(m.totalDeliveredRevenue).toLocaleString('fr-FR')} <span class="text-xs font-bold text-slate-500">FCFA</span>
                    </span>
                    <span class="text-[10px] text-slate-400 mt-1">Commandes livrées uniquement</span>
                </div>
            </div>

            <!-- SECTION : Demandes d'adhésion en attente -->
            <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-4">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                        <h2 class="font-heading font-bold text-base text-slate-900">Demandes de validation de Vendeur</h2>
                        <span class="px-2 py-0.5 rounded-full text-[11px] font-extrabold ${pendingSellers.length > 0 ? 'bg-accent text-slate-900' : 'bg-slate-100 text-slate-600'}">
                            ${pendingSellers.length}
                        </span>
                    </div>
                </div>

                ${renderPendingSellersList()}
            </div>

            <!-- SECTION : Gestion des marchands certifiés -->
            <div class="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-4">
                <div class="flex items-center justify-between">
                    <h2 class="font-heading font-bold text-base text-slate-900">Marchands enregistrés</h2>
                    <span class="text-xs text-slate-500">${activeSellers.length} inscrit${activeSellers.length > 1 ? 's' : ''}</span>
                </div>

                ${renderActiveSellersList()}
            </div>
        `;

        bindEvents();
    }

    function renderPendingSellersList() {
        if (pendingSellers.length === 0) {
            return `
                <div class="text-center py-8 text-slate-400">
                    <i class="fa-solid fa-circle-check text-emerald-500 text-2xl mb-2"></i>
                    <p class="text-xs font-medium">Toutes les demandes de vendeurs sont à jour. Aucune action requise.</p>
                </div>
            `;
        }

        return `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${pendingSellers.map((s) => `
                    <div class="p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col justify-between gap-3">
                        <div>
                            <div class="flex items-center justify-between">
                                <h3 class="font-heading font-bold text-slate-900 text-sm">
                                    ${escapeHTML(s.prenom)} ${escapeHTML(s.nom)}
                                </h3>
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-800">En attente</span>
                            </div>
                            <p class="text-xs text-slate-600 mt-1">
                                <i class="fa-solid fa-phone text-slate-400 mr-1 text-[10px]"></i> ${escapeHTML(s.telephone || 'Non renseigné')}
                            </p>
                            <p class="text-xs text-slate-400 mt-0.5">
                                Candidature du ${s.created_at ? new Date(s.created_at).toLocaleDateString('fr-FR') : 'Récemment'}
                            </p>
                        </div>

                        <div class="flex items-center gap-2 pt-2 border-t border-amber-200/60">
                            <button 
                                data-action="approve" 
                                data-id="${s.id}" 
                                class="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 min-h-[40px]"
                            >
                                <i class="fa-solid fa-check text-xs"></i>
                                <span>Approuver</span>
                            </button>
                            <button 
                                data-action="reject" 
                                data-id="${s.id}" 
                                class="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold text-xs rounded-xl transition-all min-h-[40px]"
                            >
                                Rejeter
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderActiveSellersList() {
        if (activeSellers.length === 0) {
            return `
                <div class="text-center py-8 text-slate-400 text-xs">
                    Aucun marchand enregistré pour l'instant.
                </div>
            `;
        }

        return `
            <div class="flex flex-col divide-y divide-slate-100">
                ${activeSellers.map((s) => {
                    const isSuspended = s.role === 'vendeur_desactive';

                    return `
                        <div class="py-3 flex items-center justify-between gap-3">
                            <div class="flex items-center gap-3">
                                <div class="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                                    isSuspended ? 'bg-slate-100 text-slate-400' : 'bg-primary-light text-primary'
                                }">
                                    ${((s.prenom?.[0] || '') + (s.nom?.[0] || '')).toUpperCase() || 'V'}
                                </div>
                                <div>
                                    <div class="flex items-center gap-2">
                                        <span class="font-heading font-bold text-slate-900 text-xs sm:text-sm">
                                            ${escapeHTML(s.prenom)} ${escapeHTML(s.nom)}
                                        </span>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            isSuspended ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                                        }">
                                            ${isSuspended ? 'Suspendu' : 'Actif'}
                                        </span>
                                    </div>
                                    <p class="text-[11px] text-slate-400">${escapeHTML(s.telephone || '')}</p>
                                </div>
                            </div>

                            <button 
                                data-action="toggle-suspend" 
                                data-id="${s.id}" 
                                data-suspended="${isSuspended ? 'true' : 'false'}"
                                class="px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors min-h-[36px] ${
                                    isSuspended 
                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                                        : 'border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
                                }"
                            >
                                ${isSuspended ? 'Réactiver' : 'Suspendre'}
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderLoginModal() {
        containerEl.innerHTML = `
            <div class="w-full max-w-md mx-auto my-12 bg-white rounded-2xl shadow-xl border border-slate-200 p-6 flex flex-col gap-5">
                <div class="flex items-center gap-3">
                    <img src="/assets/logo.webp" alt="Campus Market" class="h-10 w-auto object-contain">
                    <div>
                        <h2 class="font-heading font-extrabold text-base text-slate-900 leading-tight">Super Administrateur</h2>
                        <p class="text-[11px] text-slate-500">Accès sécurisé réservé à l'UIDT</p>
                    </div>
                </div>

                <div id="admin-login-error" class="hidden p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium"></div>

                <form id="superadmin-login-form" class="flex flex-col gap-4">
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1" for="admin-login-email">Email SuperAdmin</label>
                        <input type="email" id="admin-login-email" required placeholder="admin@univ-thies.sn" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-xs font-semibold text-slate-700 mb-1" for="admin-login-password">Mot de passe</label>
                        <input type="password" id="admin-login-password" required placeholder="••••••••" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none">
                    </div>

                    <div class="flex items-center gap-2 pt-2">
                        <button type="submit" id="btn-admin-submit" class="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-heading font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 min-h-[44px]">
                            <i class="fa-solid fa-key text-xs"></i>
                            <span>Connexion sécurisée</span>
                        </button>
                        <button type="button" id="btn-admin-cancel" class="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors min-h-[44px]">
                            Retour
                        </button>
                    </div>
                </form>
            </div>
        `;

        const form = containerEl.querySelector('#superadmin-login-form');
        const errEl = containerEl.querySelector('#admin-login-error');
        const submitBtn = containerEl.querySelector('#btn-admin-submit');

        containerEl.querySelector('#btn-admin-cancel')?.addEventListener('click', () => {
            if (typeof onExit === 'function') onExit();
        });

        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = containerEl.querySelector('#admin-login-email').value;
            const password = containerEl.querySelector('#admin-login-password').value;

            submitBtn.disabled = true;
            submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Vérification...`;
            if (errEl) errEl.classList.add('hidden');

            try {
                const { user, profile } = await loginAdmin({ email, password });
                currentAdmin = profile;
                isAuthenticated = true;
                if (typeof onShowToast === 'function') {
                    onShowToast(`Session administrateur ouverte : ${profile.prenom}`, 'success');
                }
                await loadAdminData();
            } catch (err) {
                if (errEl) {
                    errEl.textContent = err.message || 'Identifiants administrateur incorrects.';
                    errEl.classList.remove('hidden');
                }
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = `<i class="fa-solid fa-key text-xs"></i><span>Connexion sécurisée</span>`;
            }
        });
    }

    function bindEvents() {
        containerEl.querySelector('#btn-refresh-admin')?.addEventListener('click', loadAdminData);

        containerEl.querySelector('#btn-exit-admin')?.addEventListener('click', async () => {
            await supabase.auth.signOut();
            isAuthenticated = false;
            currentAdmin = null;
            if (typeof onExit === 'function') onExit();
        });

        // Actions Approuver / Rejeter / Suspendre
        containerEl.querySelectorAll('button[data-action]').forEach((btn) => {
            btn.addEventListener('click', async () => {
                const action = btn.getAttribute('data-action');
                const id = btn.getAttribute('data-id');

                btn.disabled = true;
                try {
                    if (action === 'approve') {
                        await approveSeller(id);
                        if (typeof onShowToast === 'function') {
                            onShowToast('Vendeur approuvé avec succès ! 🟢', 'success');
                        }
                    } else if (action === 'reject') {
                        if (confirm('Rejeter la demande de ce vendeur ?')) {
                            await rejectSeller(id);
                            if (typeof onShowToast === 'function') {
                                onShowToast('Candidature rejetée.', 'info');
                            }
                        }
                    } else if (action === 'toggle-suspend') {
                        const isSuspended = btn.getAttribute('data-suspended') === 'true';
                        await suspendSeller(id, !isSuspended);
                        if (typeof onShowToast === 'function') {
                            onShowToast(!isSuspended ? 'Boutique suspendue.' : 'Boutique réactivée.', 'info');
                        }
                    }
                    await loadAdminData();
                } catch (err) {
                    alert(err.message);
                } finally {
                    btn.disabled = false;
                }
            });
        });
    }

    checkExistingAuth();
    return containerEl;
}

export default createSuperAdminDashboard;
