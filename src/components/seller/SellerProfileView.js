/**
 * Composant SellerProfileView : Page Profil Vendeur de Campus Market.
 * Permet aux marchands de consulter et modifier leurs coordonnées personnelles,
 * leur pavillon et chambre de résidence UIDT, et les paramètres de leur boutique.
 * RÈGLE DE SÉCURITÉ ABSOLUE (FR-01) : L'email étudiant et le téléphone sont strictement verrouillés.
 */

import { escapeHTML } from '../../utils/security.js';
import { updateSellerProfile, changeSellerPassword } from '../../services/seller-service.js';
import { computeSubscriptionStatus } from '../../config/subscription.js';
import { SUPPORT_CONFIG } from '../../config/support.js';

export const PAVILLONS_UIDT = [
    { id: 'Pavillon A', label: 'Pavillon A' },
    { id: 'Pavillon B', label: 'Pavillon B' },
    { id: 'Pavillon C', label: 'Pavillon C' },
    { id: 'Pavillon D', label: 'Pavillon D' },
    { id: '1000 lits', label: 'Cité 1000 Lits' },
    { id: 'Campus VDN', label: 'Campus VDN' },
    { id: 'Autre', label: 'Autre / Résidence externe' },
];

export const CATEGORIES_BOUTIQUE = [
    { id: 'restauration', label: '🍔 Restauration & Fast-Food' },
    { id: 'mode', label: '👕 Mode & Friperie' },
    { id: 'fournitures', label: '📚 Fournitures & Polycopies' },
    { id: 'hightech', label: '🔌 High-Tech & Accessoires' },
    { id: 'beaute', label: '✨ Beauté & Soins' },
    { id: 'epicerie', label: '🛒 Épicerie & Boissons' },
    { id: 'services', label: '🛠️ Services & Dépannage' },
    { id: 'autres', label: '📦 Autres articles' },
];

/**
 * Crée la vue Page Profil Vendeur.
 *
 * @param {Object} props
 * @param {Object} props.seller - Profil vendeur actuel
 * @param {Function} [props.onBackToCatalog] - Callback pour retourner au catalogue
 * @param {Function} props.onProfileUpdated - Callback appelé avec le profil mis à jour
 * @param {Function} props.onOpenDashboard - Callback pour basculer vers le tableau de bord vendeur
 * @param {Function} props.onOpenShop - Callback pour voir la vitrine publique
 * @param {Function} props.onOpenSubscription - Callback pour ouvrir la modale d'abonnement
 * @param {Function} props.onLogout - Callback de déconnexion
 * @param {Function} props.onShowToast - Callback pour afficher les notifications toast
 * @returns {HTMLElement}
 */
export function createSellerProfileView({
    seller,
    onBackToCatalog,
    onProfileUpdated,
    onOpenDashboard,
    onOpenShop,
    onOpenSubscription,
    onLogout,
    onShowToast,
} = {}) {
    const containerEl = document.createElement('div');
    containerEl.className = 'w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 flex flex-col gap-6 select-none';

    let currentSeller = { ...seller };
    let isSubmitting = false;

    function render() {
        const subStatus = computeSubscriptionStatus(currentSeller);
        const initials = `${(currentSeller.prenom || 'V')[0]}${(currentSeller.nom || 'M')[0]}`.toUpperCase();
        const shopUrl = `${window.location.origin}/#shop/${currentSeller.id}`;
        const whatsappShareText = encodeURIComponent(
            `Salam ! Découvrez ma boutique "${currentSeller.shop_name || currentSeller.prenom}" sur Campus Market UIDT. Commandez directement ici : ${shopUrl}`
        );

        containerEl.innerHTML = `
            <!-- Navigation de retour & Raccourci Dashboard -->
            <div class="flex items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                <div class="flex items-center gap-3">
                    <button 
                        type="button" 
                        id="btn-back-to-catalog" 
                        class="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer"
                        title="Retour au catalogue"
                    >
                        <i class="fa-solid fa-arrow-left text-sm"></i>
                    </button>
                    <div>
                        <h1 class="text-base sm:text-lg font-extrabold text-slate-900 leading-tight">Mon Profil Marchand</h1>
                        <p class="text-xs text-slate-500">Gérez vos coordonnées de livraison et les paramètres de votre boutique</p>
                    </div>
                </div>

                <button 
                    type="button" 
                    id="btn-goto-dashboard" 
                    class="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold shadow-xs hover:bg-primary-hover transition-colors cursor-pointer"
                >
                    <i class="fa-solid fa-chart-line text-xs"></i>
                    <span>Tableau de Bord</span>
                </button>
            </div>

            <!-- Grille Bento du Profil -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Colonne Gauche : Identité & Résumé Abonnement (1 col) -->
                <div class="flex flex-col gap-6">
                    <!-- Carte 1 : Identité & Statut -->
                    <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col items-center text-center gap-3">
                        <div class="relative">
                            <div class="w-20 h-20 rounded-full bg-linear-to-tr from-primary to-blue-600 text-white flex items-center justify-center text-2xl font-black shadow-md border-4 border-white">
                                ${initials}
                            </div>
                            <span class="absolute bottom-0 right-0 w-5 h-5 rounded-full ${currentSeller.is_open ? 'bg-emerald-500' : 'bg-rose-500'} border-2 border-white" title="${currentSeller.is_open ? 'Boutique ouverte' : 'Boutique fermée'}"></span>
                        </div>

                        <div>
                            <h2 class="text-base font-bold text-slate-900">${escapeHTML(currentSeller.prenom || '')} ${escapeHTML(currentSeller.nom || '')}</h2>
                            <p class="text-xs text-primary font-semibold mt-0.5">${escapeHTML(currentSeller.shop_name || 'Boutique Étudiante')}</p>
                            <span class="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[10px] font-bold ${currentSeller.role === 'superadmin' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'}">
                                <i class="fa-solid ${currentSeller.role === 'superadmin' ? 'fa-shield-halved' : 'fa-certificate'}"></i>
                                <span>${currentSeller.role === 'superadmin' ? 'Super Administrateur UIDT' : 'Marchand Certifié UIDT'}</span>
                            </span>
                        </div>

                        <!-- Interrupteur Ouvert / Fermé -->
                        <div class="w-full pt-3 mt-1 border-t border-slate-100 flex items-center justify-between">
                            <div class="text-left">
                                <span class="text-xs font-bold text-slate-800">Statut de la Boutique</span>
                                <p class="text-[10px] text-slate-500">${currentSeller.is_open ? 'Vous acceptez les commandes' : 'Boutique en pause'}</p>
                            </div>
                            <button 
                                type="button" 
                                id="btn-toggle-shop-status" 
                                class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${currentSeller.is_open ? 'bg-emerald-500' : 'bg-slate-300'}"
                                role="switch" 
                                aria-checked="${currentSeller.is_open ? 'true' : 'false'}"
                            >
                                <span class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${currentSeller.is_open ? 'translate-x-5' : 'translate-x-0'}"></span>
                            </button>
                        </div>
                    </div>

                    <!-- Carte 2 : Abonnement & Quotas -->
                    <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-3.5">
                        <div class="flex items-center justify-between">
                            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Formule & Quota</span>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${subStatus.isSuperAdmin ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-900'}">
                                ${subStatus.plan.name}
                            </span>
                        </div>

                        <div class="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div class="flex items-center justify-between text-xs">
                                <span class="text-slate-600">Limite articles catalogue :</span>
                                <span class="font-bold text-slate-900">${currentSeller.max_products || subStatus.maxProducts} articles</span>
                            </div>
                            <div class="flex items-center justify-between text-xs">
                                <span class="text-slate-600">Validité restante :</span>
                                <span class="font-bold ${subStatus.daysLeft <= 3 ? 'text-rose-600' : 'text-emerald-700'}">
                                    ${subStatus.isSuperAdmin ? 'Accès Permanent ♾️' : `${subStatus.daysLeft} jours restants`}
                                </span>
                            </div>
                        </div>

                        <button 
                            type="button" 
                            id="btn-manage-subscription" 
                            class="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                        >
                            <i class="fa-solid fa-crown text-xs"></i>
                            <span>${subStatus.isPaid ? 'Gérer / Renouveler' : 'Passer au Pack Pro'}</span>
                        </button>
                    </div>

                    <!-- Carte 3 : Partage de Vitrine Marchande -->
                    <div class="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-3">
                        <span class="text-xs font-bold uppercase tracking-wider text-slate-400">Partager Ma Vitrine</span>
                        <p class="text-xs text-slate-600 leading-relaxed">Partagez votre lien boutique à vos camarades et groupes de promotion :</p>
                        
                        <div class="flex gap-2">
                            <button 
                                type="button" 
                                id="btn-copy-shop-link" 
                                class="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <i class="fa-regular fa-copy text-xs"></i>
                                <span id="copy-btn-text">Copier le lien</span>
                            </button>
                            <a 
                                href="https://wa.me/?text=${whatsappShareText}" 
                                target="_blank" 
                                class="py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                                title="Partager sur WhatsApp"
                            >
                                <i class="fa-brands fa-whatsapp text-sm"></i>
                            </a>
                        </div>
                    </div>
                </div>

                <!-- Colonne Droite : Formulaire d'Édition des Coordonnées (2 cols) -->
                <div class="lg:col-span-2 flex flex-col gap-6">
                    <form id="form-seller-profile" class="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-5">
                        <div class="border-b border-slate-100 pb-3 flex items-center justify-between">
                            <div>
                                <h3 class="text-sm sm:text-base font-bold text-slate-900">Coordonnées & Paramètres</h3>
                                <p class="text-xs text-slate-500">Mettez à jour vos informations de livraison sur le campus</p>
                            </div>
                            <span class="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">ID: ${(currentSeller.id || '').slice(0, 8)}</span>
                        </div>

                        <!-- Ligne 1 : Prénom et Nom (Modifiables) -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label for="prof-prenom" class="block text-xs font-bold text-slate-700 mb-1.5">
                                    Prénom <span class="text-rose-500">*</span>
                                </label>
                                <input 
                                    type="text" 
                                    id="prof-prenom" 
                                    required 
                                    value="${escapeHTML(currentSeller.prenom || '')}" 
                                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden transition-all"
                                    placeholder="Votre prénom"
                                />
                            </div>

                            <div>
                                <label for="prof-nom" class="block text-xs font-bold text-slate-700 mb-1.5">
                                    Nom de famille <span class="text-rose-500">*</span>
                                </label>
                                <input 
                                    type="text" 
                                    id="prof-nom" 
                                    required 
                                    value="${escapeHTML(currentSeller.nom || '')}" 
                                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden transition-all"
                                    placeholder="Votre nom"
                                />
                            </div>
                        </div>

                        <!-- Ligne 2 : Email et Téléphone (STRICTEMENT VERROUILLÉS - RÈGLE FR-01) -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <div class="flex items-center justify-between mb-1.5">
                                    <label class="text-xs font-bold text-slate-700">Email Universitaire</label>
                                    <span class="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md" title="Pour des raisons de sécurité, l'email étudiant ne peut pas être modifié.">
                                        <i class="fa-solid fa-lock text-[9px] text-slate-400"></i>
                                        <span>Certifié 🔒</span>
                                    </span>
                                </div>
                                <input 
                                    type="email" 
                                    disabled 
                                    readonly 
                                    value="${escapeHTML(currentSeller.email || '')}" 
                                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-xs cursor-not-allowed select-all font-mono"
                                />
                                <p class="text-[10px] text-slate-400 mt-1">Identifiant universitaire UIDT non modifiable.</p>
                            </div>

                            <div>
                                <div class="flex items-center justify-between mb-1.5">
                                    <label class="text-xs font-bold text-slate-700">Numéro de Téléphone</label>
                                    <span class="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md" title="Pour changer de numéro, contactez le support administrateur.">
                                        <i class="fa-solid fa-lock text-[9px] text-slate-400"></i>
                                        <span>Vérifié 🔒</span>
                                    </span>
                                </div>
                                <input 
                                    type="tel" 
                                    disabled 
                                    readonly 
                                    value="${escapeHTML(currentSeller.telephone || '')}" 
                                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-500 text-xs cursor-not-allowed select-all font-mono"
                                />
                                <p class="text-[10px] text-slate-400 mt-1">Contact Wave / Orange Money certifié.</p>
                            </div>
                        </div>

                        <!-- Ligne 3 : Résidence Universitaire (Pavillon & Chambre) -->
                        <div class="bg-amber-50/60 p-4 rounded-xl border border-amber-200/80 flex flex-col gap-3">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid fa-hotel text-amber-700 text-sm"></i>
                                <span class="text-xs font-extrabold text-amber-950 uppercase tracking-wide">Résidence sur le Campus UIDT</span>
                            </div>
                            <p class="text-[11px] text-amber-900/80 leading-relaxed">
                                Renseignez votre pavillon et votre numéro de chambre. Ces coordonnées facilitent la livraison de proximité et sont indispensables aux vérifications du campus.
                            </p>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
                                <div>
                                    <label for="prof-pavillon" class="block text-xs font-bold text-slate-800 mb-1">
                                        Pavillon de Résidence <span class="text-rose-500">*</span>
                                    </label>
                                    <select 
                                        id="prof-pavillon" 
                                        class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden cursor-pointer"
                                    >
                                        <option value="">-- Choisir votre pavillon --</option>
                                        ${PAVILLONS_UIDT.map(p => `
                                            <option value="${p.id}" ${currentSeller.pavillon === p.id ? 'selected' : ''}>${p.label}</option>
                                        `).join('')}
                                    </select>
                                </div>

                                <div>
                                    <label for="prof-chambre" class="block text-xs font-bold text-slate-800 mb-1">
                                        Numéro de Chambre <span class="text-rose-500">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        id="prof-chambre" 
                                        value="${escapeHTML(currentSeller.chambre || '')}" 
                                        class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden"
                                        placeholder="Ex: Chambre 14, B-205, etc."
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Ligne 4 : Nom de la Boutique & Catégorie -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label for="prof-shop-name" class="block text-xs font-bold text-slate-700 mb-1.5">
                                    Enseigne / Nom de Boutique <span class="text-rose-500">*</span>
                                </label>
                                <input 
                                    type="text" 
                                    id="prof-shop-name" 
                                    required 
                                    value="${escapeHTML(currentSeller.shop_name || '')}" 
                                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden transition-all"
                                    placeholder="Ex: Chez Fatou Resto"
                                />
                            </div>

                            <div>
                                <label for="prof-shop-cat" class="block text-xs font-bold text-slate-700 mb-1.5">
                                    Catégorie Principale
                                </label>
                                <select 
                                    id="prof-shop-cat" 
                                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden cursor-pointer"
                                >
                                    ${CATEGORIES_BOUTIQUE.map(c => `
                                        <option value="${c.id}" ${currentSeller.shop_category === c.id ? 'selected' : ''}>${c.label}</option>
                                    `).join('')}
                                </select>
                            </div>
                        </div>

                        <!-- Bouton d'enregistrement du formulaire -->
                        <div class="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                            <button 
                                type="submit" 
                                id="btn-save-profile" 
                                class="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                ${isSubmitting ? 'disabled' : ''}
                            >
                                <i class="fa-solid ${isSubmitting ? 'fa-spinner fa-spin' : 'fa-check'} text-xs"></i>
                                <span>${isSubmitting ? 'Enregistrement en cours...' : 'Enregistrer mes Coordonnées'}</span>
                            </button>
                        </div>
                    </form>

                    <!-- Section Sécurité : Modification du Mot de Passe -->
                    <div class="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-4">
                        <div class="flex items-center justify-between">
                            <div>
                                <h4 class="text-sm font-bold text-slate-900">Sécurité du Compte</h4>
                                <p class="text-xs text-slate-500">Mettez à jour votre mot de passe pour protéger votre boutique</p>
                            </div>
                            <button 
                                type="button" 
                                id="btn-toggle-pwd-form" 
                                class="text-xs font-bold text-primary hover:underline cursor-pointer"
                            >
                                Modifier le mot de passe
                            </button>
                        </div>

                        <form id="form-change-password" class="hidden flex-col gap-3 pt-3 border-t border-slate-100">
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label for="pwd-new" class="block text-xs font-semibold text-slate-700 mb-1">Nouveau mot de passe</label>
                                    <input 
                                        type="password" 
                                        id="pwd-new" 
                                        required 
                                        minlength="6" 
                                        placeholder="Min. 6 caractères" 
                                        class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden"
                                    />
                                </div>
                                <div>
                                    <label for="pwd-confirm" class="block text-xs font-semibold text-slate-700 mb-1">Confirmer</label>
                                    <input 
                                        type="password" 
                                        id="pwd-confirm" 
                                        required 
                                        minlength="6" 
                                        placeholder="Retapez le mot de passe" 
                                        class="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-hidden"
                                    />
                                </div>
                            </div>
                            <div class="flex justify-end gap-2 mt-1">
                                <button 
                                    type="submit" 
                                    id="btn-submit-pwd" 
                                    class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-bold transition-all cursor-pointer"
                                >
                                    Valider le nouveau mot de passe
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- Zone Déconnexion & Raccourcis -->
                    <div class="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <button 
                            type="button" 
                            id="btn-profile-logout" 
                            class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                            <i class="fa-solid fa-arrow-right-from-bracket text-xs"></i>
                            <span>Se déconnecter</span>
                        </button>

                        <div class="flex items-center gap-3">
                            <a 
                                href="${SUPPORT_CONFIG.whatsappUrl}" 
                                target="_blank" 
                                class="text-xs text-slate-600 hover:text-emerald-700 font-semibold flex items-center gap-1.5 transition-colors"
                            >
                                <i class="fa-brands fa-whatsapp text-emerald-600"></i>
                                <span>Support UIDT</span>
                            </a>
                            <button 
                                type="button" 
                                id="btn-view-public-shop" 
                                class="text-xs text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                            >
                                <span>Voir ma vitrine</span>
                                <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        setupEvents();
    }

    function setupEvents() {
        // Retour au catalogue
        containerEl.querySelector('#btn-back-to-catalog')?.addEventListener('click', () => {
            if (typeof onBackToCatalog === 'function') {
                onBackToCatalog();
            } else {
                window.location.hash = '';
            }
        });

        // Aller au Dashboard
        containerEl.querySelector('#btn-goto-dashboard')?.addEventListener('click', () => {
            if (typeof onOpenDashboard === 'function') onOpenDashboard();
        });

        // Toggle ouvert / fermé
        containerEl.querySelector('#btn-toggle-shop-status')?.addEventListener('click', async () => {
            const newStatus = !currentSeller.is_open;
            try {
                const updated = await updateSellerProfile({
                    sellerId: currentSeller.id,
                    isOpen: newStatus,
                });
                currentSeller.is_open = updated.is_open;
                render();
                if (typeof onShowToast === 'function') {
                    onShowToast(newStatus ? '🟢 Votre boutique est maintenant ouverte !' : '🔴 Votre boutique est mise en pause.', 'info');
                }
                if (typeof onProfileUpdated === 'function') onProfileUpdated(currentSeller);
            } catch (err) {
                if (typeof onShowToast === 'function') {
                    onShowToast(`Erreur : ${err.message}`, 'error');
                }
            }
        });

        // Gérer abonnement
        containerEl.querySelector('#btn-manage-subscription')?.addEventListener('click', () => {
            if (typeof onOpenSubscription === 'function') onOpenSubscription();
        });

        // Copier lien boutique
        containerEl.querySelector('#btn-copy-shop-link')?.addEventListener('click', async () => {
            const shopUrl = `${window.location.origin}/#shop/${currentSeller.id}`;
            try {
                await navigator.clipboard.writeText(shopUrl);
                const copyText = containerEl.querySelector('#copy-btn-text');
                if (copyText) copyText.textContent = 'Copié ! ✅';
                setTimeout(() => {
                    if (copyText) copyText.textContent = 'Copier le lien';
                }, 2000);
                if (typeof onShowToast === 'function') onShowToast('Lien boutique copié dans le presse-papier !', 'success');
            } catch {
                if (typeof onShowToast === 'function') onShowToast(shopUrl, 'info');
            }
        });

        // Soumission du formulaire de coordonnées
        const formEl = containerEl.querySelector('#form-seller-profile');
        formEl?.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (isSubmitting) return;

            const prenom = containerEl.querySelector('#prof-prenom')?.value.trim();
            const nom = containerEl.querySelector('#prof-nom')?.value.trim();
            const pavillon = containerEl.querySelector('#prof-pavillon')?.value.trim();
            const chambre = containerEl.querySelector('#prof-chambre')?.value.trim();
            const shopName = containerEl.querySelector('#prof-shop-name')?.value.trim();
            const shopCategory = containerEl.querySelector('#prof-shop-cat')?.value.trim();

            if (!prenom || !nom || !shopName) {
                if (typeof onShowToast === 'function') {
                    onShowToast('Veuillez renseigner les champs obligatoires (Prénom, Nom, Boutique).', 'warning');
                }
                return;
            }

            isSubmitting = true;
            render();

            try {
                const updated = await updateSellerProfile({
                    sellerId: currentSeller.id,
                    prenom,
                    nom,
                    shopName,
                    shopCategory,
                    pavillon,
                    chambre,
                });

                currentSeller = { ...currentSeller, ...updated };
                if (typeof onShowToast === 'function') {
                    onShowToast('🎉 Coordonnées et profil mis à jour avec succès !', 'success');
                }
                if (typeof onProfileUpdated === 'function') {
                    onProfileUpdated(currentSeller);
                }
            } catch (err) {
                console.error('[SellerProfileView] Erreur sauvegarde:', err);
                if (typeof onShowToast === 'function') {
                    onShowToast(`Erreur : ${err.message}`, 'error');
                }
            } finally {
                isSubmitting = false;
                render();
            }
        });

        // Toggle formulaire mot de passe
        const togglePwdBtn = containerEl.querySelector('#btn-toggle-pwd-form');
        const pwdForm = containerEl.querySelector('#form-change-password');
        togglePwdBtn?.addEventListener('click', () => {
            if (pwdForm) {
                pwdForm.classList.toggle('hidden');
                pwdForm.classList.toggle('flex');
            }
        });

        // Soumission mot de passe
        pwdForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPassword = containerEl.querySelector('#pwd-new')?.value;
            const confirmPassword = containerEl.querySelector('#pwd-confirm')?.value;

            try {
                await changeSellerPassword({ newPassword, confirmPassword });
                if (typeof onShowToast === 'function') {
                    onShowToast('🔒 Mot de passe modifié avec succès !', 'success');
                }
                pwdForm.reset();
                pwdForm.classList.add('hidden');
                pwdForm.classList.remove('flex');
            } catch (pwdErr) {
                if (typeof onShowToast === 'function') {
                    onShowToast(`Erreur : ${pwdErr.message}`, 'error');
                }
            }
        });

        // Déconnexion
        containerEl.querySelector('#btn-profile-logout')?.addEventListener('click', () => {
            if (typeof onLogout === 'function') onLogout();
        });

        // Voir vitrine publique
        containerEl.querySelector('#btn-view-public-shop')?.addEventListener('click', () => {
            if (typeof onOpenShop === 'function') {
                onOpenShop(currentSeller.id);
            } else {
                window.location.hash = `#shop/${currentSeller.id}`;
            }
        });
    }

    render();

    containerEl.updateSeller = (newSeller) => {
        if (newSeller) {
            currentSeller = { ...newSeller };
            render();
        }
    };

    return containerEl;
}

export default createSellerProfileView;
