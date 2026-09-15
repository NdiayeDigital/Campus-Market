/**
 * Composant CheckoutModal
 * Tunnel de commande ultra-rapide en 3 étapes sans obligation de création de compte.
 */

import { createOrder } from '../services/order-service.js';
import { cartStore } from '../services/cart-store.js';

const PAVILLONS = [
    'Pavillon A1',
    'Pavillon A2',
    'Pavillon A3',
    'Pavillon A4',
    'Pavillon B1',
    'Pavillon B2',
    'Pavillon C',
    'Jardin Social',
    'Bibliothèque Universitaire (BU)',
    'Salles de cours / Espaces communs'
];

const LOCAL_BUYER_KEY = 'campus_market_last_buyer';

/**
 * Crée le formulaire modal de commande.
 * @param {Object} props
 * @param {Function} props.onOrderSuccess - Callback appelé lors d'une commande passée ({ reference, isOffline, ... })
 * @returns {Object} Contrôleur du modal ({ element, open, close })
 */
export function createCheckoutModal({ onOrderSuccess } = {}) {
    const modalEl = document.createElement('div');
    modalEl.id = 'checkout-modal-overlay';
    modalEl.className = 'fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 opacity-0 pointer-events-none transition-opacity duration-300';

    // Récupération des dernières coordonnées enregistrées pour commodité
    let savedBuyer = {};
    try {
        const raw = localStorage.getItem(LOCAL_BUYER_KEY);
        if (raw) savedBuyer = JSON.parse(raw);
    } catch {
        savedBuyer = {};
    }

    modalEl.innerHTML = `
        <div class="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
            <!-- Modal Header -->
            <div class="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div class="flex items-center gap-2">
                    <div class="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                        <i class="fa-solid fa-truck-fast"></i>
                    </div>
                    <h2 class="font-heading font-bold text-slate-900 text-lg">Finaliser ma commande</h2>
                </div>
                <button id="btn-close-checkout" class="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors min-h-[44px] min-w-[44px]">
                    <i class="fa-solid fa-xmark text-lg"></i>
                </button>
            </div>

            <!-- Corps du formulaire scrollable -->
            <form id="checkout-form" class="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                <div class="bg-blue-50/70 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5 text-xs text-blue-900">
                    <i class="fa-solid fa-circle-check text-primary text-sm mt-0.5"></i>
                    <span><strong>Achat direct sans compte requis :</strong> indiquez simplement votre localisation pour une livraison rapide pavillon-à-pavillon !</span>
                </div>

                <!-- SECTION 1 : Coordonnées -->
                <div class="flex flex-col gap-3">
                    <h3 class="font-heading font-bold text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-primary text-white text-[11px] flex items-center justify-center">1</span>
                        Vos coordonnées
                    </h3>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1" for="buyer-prenom">Prénom *</label>
                            <input 
                                type="text" 
                                id="buyer-prenom" 
                                required 
                                value="${savedBuyer.prenom || ''}"
                                placeholder="Ex: Moussa" 
                                class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                            >
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1" for="buyer-nom">Nom *</label>
                            <input 
                                type="text" 
                                id="buyer-nom" 
                                required 
                                value="${savedBuyer.nom || ''}"
                                placeholder="Ex: Diallo" 
                                class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                            >
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold text-slate-600 mb-1" for="buyer-phone">Numéro de téléphone (Wave / OM / Appel) *</label>
                        <input 
                            type="tel" 
                            id="buyer-phone" 
                            required 
                            value="${savedBuyer.telephone || ''}"
                            placeholder="Ex: 77 123 45 67" 
                            class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                        >
                    </div>
                </div>

                <!-- SECTION 2 : Livraison Pavillon-à-Pavillon -->
                <div class="flex flex-col gap-3 pt-2 border-t border-slate-100">
                    <h3 class="font-heading font-bold text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-primary text-white text-[11px] flex items-center justify-center">2</span>
                        Lieu de livraison (UIDT)
                    </h3>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1" for="delivery-pavillon">Pavillon ou Site *</label>
                            <select 
                                id="delivery-pavillon" 
                                required 
                                class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                            >
                                <option value="" disabled ${!savedBuyer.pavillon ? 'selected' : ''}>Sélectionnez...</option>
                                ${PAVILLONS.map((p) => `
                                    <option value="${p}" ${savedBuyer.pavillon === p ? 'selected' : ''}>${p}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-slate-600 mb-1" for="delivery-chambre">Numéro de chambre / Précision *</label>
                            <input 
                                type="text" 
                                id="delivery-chambre" 
                                required 
                                value="${savedBuyer.chambre || ''}"
                                placeholder="Ex: Chambre 14, 2e étage" 
                                class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-primary focus:outline-none transition-all"
                            >
                        </div>
                    </div>
                </div>

                <!-- SECTION 3 : Mode de paiement -->
                <div class="flex flex-col gap-3 pt-2 border-t border-slate-100">
                    <h3 class="font-heading font-bold text-sm text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <span class="w-5 h-5 rounded-full bg-primary text-white text-[11px] flex items-center justify-center">3</span>
                        Mode de règlement
                    </h3>

                    <div class="grid grid-cols-3 gap-2.5">
                        <!-- Wave -->
                        <label class="cursor-pointer">
                            <input type="radio" name="payment-method" value="wave" checked class="peer sr-only">
                            <div class="p-3 border-2 border-slate-200 rounded-xl text-center flex flex-col items-center gap-1.5 transition-all peer-checked:border-[#1DA1F2] peer-checked:bg-sky-50 min-h-[44px]">
                                <i class="fa-solid fa-water text-[#1DA1F2] text-lg"></i>
                                <span class="text-xs font-bold text-slate-800">Wave</span>
                            </div>
                        </label>

                        <!-- Orange Money -->
                        <label class="cursor-pointer">
                            <input type="radio" name="payment-method" value="om" class="peer sr-only">
                            <div class="p-3 border-2 border-slate-200 rounded-xl text-center flex flex-col items-center gap-1.5 transition-all peer-checked:border-[#FF7900] peer-checked:bg-orange-50 min-h-[44px]">
                                <i class="fa-solid fa-mobile-screen-button text-[#FF7900] text-lg"></i>
                                <span class="text-xs font-bold text-slate-800">OM</span>
                            </div>
                        </label>

                        <!-- Espèces -->
                        <label class="cursor-pointer">
                            <input type="radio" name="payment-method" value="cash" class="peer sr-only">
                            <div class="p-3 border-2 border-slate-200 rounded-xl text-center flex flex-col items-center gap-1.5 transition-all peer-checked:border-emerald-500 peer-checked:bg-emerald-50 min-h-[44px]">
                                <i class="fa-solid fa-money-bill-wave text-emerald-600 text-lg"></i>
                                <span class="text-xs font-bold text-slate-800">Espèces</span>
                            </div>
                        </label>
                    </div>
                </div>

                <!-- Message d'erreur -->
                <div id="checkout-error" class="hidden p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium"></div>

                <!-- Bouton de confirmation -->
                <div class="pt-3">
                    <button 
                        type="submit" 
                        id="btn-submit-order" 
                        class="w-full py-4 px-5 bg-primary hover:bg-primary-dark active:scale-[0.99] text-white font-heading font-extrabold text-base rounded-xl shadow-lg shadow-primary/30 flex items-center justify-center gap-2 transition-all min-h-[52px]"
                    >
                        <span>Confirmer ma commande</span>
                        <i class="fa-solid fa-check text-sm"></i>
                    </button>
                </div>
            </form>
        </div>
    `;

    const formEl = modalEl.querySelector('#checkout-form');
    const submitBtn = modalEl.querySelector('#btn-submit-order');
    const errorEl = modalEl.querySelector('#checkout-error');

    function open() {
        modalEl.classList.remove('opacity-0', 'pointer-events-none');
        modalEl.classList.add('opacity-100');
        document.body.style.overflow = 'hidden';
    }

    function close() {
        modalEl.classList.remove('opacity-100');
        modalEl.classList.add('opacity-0', 'pointer-events-none');
        document.body.style.overflow = '';
        if (errorEl) errorEl.classList.add('hidden');
    }

    modalEl.querySelector('#btn-close-checkout')?.addEventListener('click', close);
    modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) close();
    });

    formEl?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const items = cartStore.getCart();

        if (items.length === 0) {
            if (errorEl) {
                errorEl.textContent = 'Votre panier est vide.';
                errorEl.classList.remove('hidden');
            }
            return;
        }

        const prenom = modalEl.querySelector('#buyer-prenom').value.trim();
        const nom = modalEl.querySelector('#buyer-nom').value.trim();
        const telephone = modalEl.querySelector('#buyer-phone').value.trim();
        const pavillon = modalEl.querySelector('#delivery-pavillon').value;
        const chambre = modalEl.querySelector('#delivery-chambre').value.trim();
        const paymentMethod = modalEl.querySelector('input[name="payment-method"]:checked')?.value || 'cash';

        // Sauvegarde locale pour pré-remplir les prochaines commandes
        try {
            localStorage.setItem(
                LOCAL_BUYER_KEY,
                JSON.stringify({ prenom, nom, telephone, pavillon, chambre })
            );
        } catch {
            // Ignorer si storage désactivé
        }

        // État de chargement
        const originalBtnHtml = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Traitement de la commande...`;
        if (errorEl) errorEl.classList.add('hidden');

        try {
            const result = await createOrder({
                clientPrenom: prenom,
                clientNom: nom,
                clientTelephone: telephone,
                pavillon,
                chambre,
                paymentMethod,
                items,
            });

            close();

            if (typeof onOrderSuccess === 'function') {
                onOrderSuccess({
                    reference: result.reference,
                    isOffline: result.isOffline,
                    prenom,
                    nom,
                    telephone,
                    pavillon,
                    chambre,
                    items,
                });
            }
        } catch (err) {
            console.error('[CheckoutModal] Erreur soumission commande:', err);
            if (errorEl) {
                errorEl.textContent = err.message || 'Une erreur est survenue lors de la validation.';
                errorEl.classList.remove('hidden');
            }
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnHtml;
        }
    });

    return {
        element: modalEl,
        open,
        close,
    };
}

export default createCheckoutModal;
