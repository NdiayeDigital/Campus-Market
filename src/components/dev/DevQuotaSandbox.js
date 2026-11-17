/**
 * Composant DevQuotaSandbox (Bac à Sable de Test & Visualisation Interactive)
 * Permet aux développeurs et testeurs de simuler et visualiser instantanément
 * l'ensemble des scénarios marchands dans le navigateur sans toucher à la base Supabase :
 * - Scénario 1 : Essai Gratuit Actif (J-5, 3 articles)
 * - Scénario 2 : Essai Gratuit Fin Proche (J-1, alerte ambre préventive)
 * - Scénario 3 : Pack Découverte Nominal (0 FCFA, 1 article, 3/15 cmd, 1/5 vente)
 * - Scénario 4 : Pack Découverte Alerte 80% (12/15 cmd, 4/5 ventes)
 * - Scénario 5 : Pack Découverte Saturation 100% (15/15 cmd, 5/5 ventes)
 * - Scénario 6 : Pack Découverte Multi-produits (Test du modal de choix du produit conservé)
 * - Bouton direct : Ouverture du modal d'abonnement (Vérification 0 FCFA sans bouton SasPay)
 */

import { createSubscriptionModal } from '../seller/SubscriptionModal.js';
import { createSellerProductQuotaModal } from '../seller/SellerProductQuotaModal.js';
import { showToast } from '../../utils/notifications.js';

/**
 * Crée le bac à sable de prévisualisation interactive.
 * @param {Object} props
 * @param {Function} props.onApplyMockScenario - Callback appliquée au SellerDashboard pour injecter les mocks
 * @param {Function} props.onResetRealData - Callback pour rétablir les données réelles
 * @param {Object} props.realSeller - Profil réel du vendeur connecté
 * @returns {HTMLElement}
 */
export function createDevQuotaSandbox({ onApplyMockScenario, onResetRealData, realSeller } = {}) {
    const sandboxEl = document.createElement('div');
    sandboxEl.id = 'dev-quota-sandbox';
    sandboxEl.className = 'fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2 font-sans select-none';

    let isExpanded = false;
    let activeScenarioId = null;

    // Produits fictifs pour la simulation multi-produits
    const mockProducts = [
        {
            id: 'mock-prod-1',
            seller_id: realSeller?.id || 'mock-seller',
            title: 'Sac à dos étudiant imperméable',
            price: 7500,
            category: 'Mode & Accessoires',
            is_active: true,
            quota_status: null,
            image_url: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&auto=format&fit=crop&q=80',
        },
        {
            id: 'mock-prod-2',
            seller_id: realSeller?.id || 'mock-seller',
            title: 'Calculatrice scientifique Casio fx-991',
            price: 12000,
            category: 'Fournitures & Livres',
            is_active: false,
            quota_status: 'masqué_quota',
            image_url: 'https://images.unsplash.com/photo-1587145820266-a5951ee6f620?w=400&auto=format&fit=crop&q=80',
        },
        {
            id: 'mock-prod-3',
            seller_id: realSeller?.id || 'mock-seller',
            title: 'Écouteurs sans fil Bluetooth 5.3',
            price: 6000,
            category: 'Électronique & Tech',
            is_active: false,
            quota_status: 'masqué_quota',
            image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&auto=format&fit=crop&q=80',
        },
    ];

    function render() {
        if (!isExpanded) {
            sandboxEl.innerHTML = `
                <button 
                    id="btn-toggle-sandbox" 
                    title="Ouvrir le bac à sable interactif Quotas & Formules"
                    class="px-3.5 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-xl border border-slate-700 flex items-center gap-2 transition-all cursor-pointer hover:scale-105 active:scale-95"
                >
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>🛠️ Sandbox Quotas</span>
                </button>
            `;
        } else {
            sandboxEl.innerHTML = `
                <div class="w-80 sm:w-96 bg-slate-900/95 backdrop-blur-md text-white rounded-3xl p-4 shadow-2xl border border-slate-700 flex flex-col gap-3.5 animate-in slide-in-from-bottom-4 duration-200">
                    <!-- En-tête -->
                    <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div class="flex items-center gap-2">
                            <span class="text-base">🛠️</span>
                            <div>
                                <h4 class="font-heading font-extrabold text-xs text-white">Bac à Sable Quotas & Formules</h4>
                                <span class="text-[10px] text-slate-400 block">Simulateur en direct (In-Memory)</span>
                            </div>
                        </div>
                        <button id="btn-close-sandbox" class="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <!-- Liste des Scénarios Marchands -->
                    <div class="flex flex-col gap-2">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Choisissez un état à tester :</span>

                        <!-- Scénario 1 -->
                        <button 
                            type="button" 
                            data-scenario="trial_active" 
                            class="w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${activeScenarioId === 'trial_active' ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300' : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'}"
                        >
                            <div class="flex items-center gap-2">
                                <span class="text-emerald-400">🎁</span>
                                <div>
                                    <strong class="block text-xs font-bold">1. Essai Gratuit Actif (J-5)</strong>
                                    <span class="text-[10px] text-slate-400">3 articles autorisés, bannière verte</span>
                                </div>
                            </div>
                            <i class="fa-solid fa-play text-[10px] opacity-60"></i>
                        </button>

                        <!-- Scénario 2 -->
                        <button 
                            type="button" 
                            data-scenario="trial_expiring" 
                            class="w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${activeScenarioId === 'trial_expiring' ? 'bg-amber-950/80 border-amber-500 text-amber-300' : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'}"
                        >
                            <div class="flex items-center gap-2">
                                <span class="text-amber-400">⏰</span>
                                <div>
                                    <strong class="block text-xs font-bold">2. Essai Fin Proche (J-1)</strong>
                                    <span class="text-[10px] text-slate-400">Alerte préventive ambre bascule</span>
                                </div>
                            </div>
                            <i class="fa-solid fa-play text-[10px] opacity-60"></i>
                        </button>

                        <!-- Scénario 3 -->
                        <button 
                            type="button" 
                            data-scenario="decouverte_normal" 
                            class="w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${activeScenarioId === 'decouverte_normal' ? 'bg-blue-950/80 border-blue-500 text-blue-300' : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'}"
                        >
                            <div class="flex items-center gap-2">
                                <span class="text-blue-400">🧭</span>
                                <div>
                                    <strong class="block text-xs font-bold">3. Pack Découverte (0 FCFA)</strong>
                                    <span class="text-[10px] text-slate-400">1 article, 3/15 cmd, 1/5 vente (Jauges vertes)</span>
                                </div>
                            </div>
                            <i class="fa-solid fa-play text-[10px] opacity-60"></i>
                        </button>

                        <!-- Scénario 4 -->
                        <button 
                            type="button" 
                            data-scenario="decouverte_warning" 
                            class="w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${activeScenarioId === 'decouverte_warning' ? 'bg-amber-950/80 border-amber-500 text-amber-300' : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'}"
                        >
                            <div class="flex items-center gap-2">
                                <span class="text-amber-400">⚠️</span>
                                <div>
                                    <strong class="block text-xs font-bold">4. Découverte Alerte 80%</strong>
                                    <span class="text-[10px] text-slate-400">12/15 cmd, 4/5 ventes (Jauges ambres)</span>
                                </div>
                            </div>
                            <i class="fa-solid fa-play text-[10px] opacity-60"></i>
                        </button>

                        <!-- Scénario 5 -->
                        <button 
                            type="button" 
                            data-scenario="decouverte_saturated" 
                            class="w-full text-left p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer flex items-center justify-between ${activeScenarioId === 'decouverte_saturated' ? 'bg-rose-950/80 border-rose-500 text-rose-300' : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-200'}"
                        >
                            <div class="flex items-center gap-2">
                                <span class="text-rose-400">⛔</span>
                                <div>
                                    <strong class="block text-xs font-bold">5. Découverte Saturation 100%</strong>
                                    <span class="text-[10px] text-slate-400">15/15 cmd, 5/5 ventes (Jauges rouges)</span>
                                </div>
                            </div>
                            <i class="fa-solid fa-play text-[10px] opacity-60"></i>
                        </button>
                    </div>

                    <!-- Actions Directes de Test Visuel -->
                    <div class="pt-2 border-t border-slate-800 flex flex-col gap-2">
                        <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outils & Modales :</span>
                        
                        <div class="grid grid-cols-2 gap-2">
                            <button 
                                type="button" 
                                id="btn-test-product-quota-modal"
                                class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <i class="fa-solid fa-box text-primary text-[11px]"></i>
                                <span>Sélecteur Article</span>
                            </button>
                            <button 
                                type="button" 
                                id="btn-test-subscription-modal"
                                class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                                <i class="fa-solid fa-crown text-amber-400 text-[11px]"></i>
                                <span>Modal SasPay</span>
                            </button>
                        </div>

                        <button 
                            type="button" 
                            id="btn-reset-sandbox"
                            class="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-1"
                        >
                            <i class="fa-solid fa-rotate-left text-[10px]"></i>
                            <span>Rétablir Données Réelles</span>
                        </button>
                    </div>
                </div>
            `;
        }

        bindEvents();
    }

    function bindEvents() {
        sandboxEl.querySelector('#btn-toggle-sandbox')?.addEventListener('click', () => {
            isExpanded = true;
            render();
        });

        sandboxEl.querySelector('#btn-close-sandbox')?.addEventListener('click', () => {
            isExpanded = false;
            render();
        });

        // Clics sur les scénarios
        sandboxEl.querySelectorAll('[data-scenario]').forEach((btn) => {
            btn.addEventListener('click', () => {
                const scenario = btn.dataset.scenario;
                activeScenarioId = scenario;
                render();
                applyScenario(scenario);
            });
        });

        // Test Sélecteur d'article
        sandboxEl.querySelector('#btn-test-product-quota-modal')?.addEventListener('click', () => {
            const quotaModal = createSellerProductQuotaModal({
                seller: { ...realSeller, pack_actuel: 'decouverte' },
                products: mockProducts,
                onProductChosen: ({ activeProduct }) => {
                    showToast(`Article actif simulé : "${activeProduct.title}"`, 'success');
                },
                onShowToast: showToast,
            });
            document.body.appendChild(quotaModal.element);
            quotaModal.open();
        });

        // Test Modal d'Abonnement (Vérification Pack Découverte 0 F sans paiement)
        sandboxEl.querySelector('#btn-test-subscription-modal')?.addEventListener('click', () => {
            const subModal = createSubscriptionModal({
                seller: { ...realSeller, pack_actuel: 'decouverte', subscription_plan: 'decouverte' },
                onSubscribed: () => {},
                onShowToast: showToast,
            });
            document.body.appendChild(subModal.element);
            subModal.open();
        });

        // Réinitialisation
        sandboxEl.querySelector('#btn-reset-sandbox')?.addEventListener('click', () => {
            activeScenarioId = null;
            render();
            if (typeof onResetRealData === 'function') {
                onResetRealData();
            }
            showToast('Données réelles du vendeur restaurées.', 'info');
        });
    }

    function applyScenario(scenarioId) {
        if (typeof onApplyMockScenario !== 'function') return;

        switch (scenarioId) {
            case 'trial_active':
                onApplyMockScenario({
                    subCalc: {
                        status: 'trial_active',
                        daysLeft: 5,
                        daysRemaining: 5,
                        isExpired: false,
                        isPaid: false,
                        isTrial: true,
                        maxProducts: 3,
                    },
                    quotas: {
                        enabled: false,
                        packId: 'essai_7j',
                        packName: 'Essai Gratuit (7 jours)',
                        activeProducts: { current: 2, max: 3, percent: 66 },
                        monthlyOrders: { current: 5, max: 999999, percent: 0 },
                        validatedSales: { current: 2, max: 999999, percent: 0 },
                    },
                });
                showToast('Simulation activée : Vendeur en Essai Gratuit (J-5)', 'info');
                break;

            case 'trial_expiring':
                onApplyMockScenario({
                    subCalc: {
                        status: 'trial_expiring',
                        daysLeft: 1,
                        daysRemaining: 1,
                        isExpired: false,
                        isPaid: false,
                        isTrial: true,
                        maxProducts: 3,
                    },
                    quotas: {
                        enabled: false,
                        packId: 'essai_7j',
                        packName: 'Essai Gratuit (Dernier jour)',
                        activeProducts: { current: 3, max: 3, percent: 100 },
                        monthlyOrders: { current: 8, max: 999999, percent: 0 },
                        validatedSales: { current: 3, max: 999999, percent: 0 },
                    },
                });
                showToast('Simulation activée : Essai fin proche (J-1) — Bascule Découverte', 'warning');
                break;

            case 'decouverte_normal':
                onApplyMockScenario({
                    subCalc: {
                        status: 'decouverte',
                        daysLeft: 999,
                        daysRemaining: 999,
                        isExpired: false,
                        isPaid: false,
                        isTrial: false,
                        maxProducts: 1,
                    },
                    quotas: {
                        enabled: true,
                        packId: 'decouverte',
                        packName: 'Pack Découverte (0 FCFA)',
                        activeProducts: { current: 1, max: 1, percent: 100 },
                        monthlyOrders: { current: 3, max: 15, percent: 20 },
                        validatedSales: { current: 1, max: 5, percent: 20 },
                    },
                });
                showToast('Simulation activée : Pack Découverte Nominal (3/15 cmd, 1/5 vente)', 'success');
                break;

            case 'decouverte_warning':
                onApplyMockScenario({
                    subCalc: {
                        status: 'decouverte',
                        daysLeft: 999,
                        daysRemaining: 999,
                        isExpired: false,
                        isPaid: false,
                        isTrial: false,
                        maxProducts: 1,
                    },
                    quotas: {
                        enabled: true,
                        packId: 'decouverte',
                        packName: 'Pack Découverte (0 FCFA)',
                        activeProducts: { current: 1, max: 1, percent: 100 },
                        monthlyOrders: { current: 12, max: 15, percent: 80 },
                        validatedSales: { current: 4, max: 5, percent: 80 },
                    },
                });
                showToast('Simulation activée : Découverte Alerte 80% (12/15 cmd, 4/5 ventes)', 'warning');
                break;

            case 'decouverte_saturated':
                onApplyMockScenario({
                    subCalc: {
                        status: 'decouverte',
                        daysLeft: 999,
                        daysRemaining: 999,
                        isExpired: false,
                        isPaid: false,
                        isTrial: false,
                        maxProducts: 1,
                    },
                    quotas: {
                        enabled: true,
                        packId: 'decouverte',
                        packName: 'Pack Découverte (0 FCFA)',
                        activeProducts: { current: 1, max: 1, percent: 100 },
                        monthlyOrders: { current: 15, max: 15, percent: 100 },
                        validatedSales: { current: 5, max: 5, percent: 100 },
                    },
                });
                showToast('Simulation activée : Découverte Saturation 100% (15/15 cmd, 5/5 ventes)', 'error');
                break;
        }
    }

    render();

    return {
        element: sandboxEl,
        render,
    };
}

export default createDevQuotaSandbox;
