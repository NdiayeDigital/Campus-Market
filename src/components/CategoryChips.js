/**
 * Composant CategoryChips
 * Carrousel horizontal scrollable pour filtrer les articles par catégorie.
 */

import { CATEGORIES } from '../services/catalog-service.js';

/**
 * Crée le sélecteur horizontal de catégories.
 * @param {Object} props
 * @param {string} [props.activeCategory='all'] - Catégorie active au démarrage
 * @param {Function} props.onSelectCategory - Callback appelé lors de la sélection d'une catégorie
 * @returns {HTMLElement}
 */
export function createCategoryChips({ activeCategory = 'all', onSelectCategory } = {}) {
    const containerEl = document.createElement('div');
    containerEl.className = 'w-full py-2.5 px-4 bg-background/80 backdrop-blur-sm border-b border-slate-200/60 overflow-hidden';

    let currentActive = activeCategory;
    let countsMap = {};

    function render() {
        containerEl.innerHTML = `
            <div class="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 max-w-7xl mx-auto scroll-smooth" style="scrollbar-width: none; -ms-overflow-style: none;">
                ${CATEGORIES.map((cat) => {
                    const isActive = cat.id === currentActive;
                    const count = countsMap[cat.id];
                    const activeClasses = 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-md shadow-primary/25 border-transparent font-bold ring-2 ring-primary/20';
                    const inactiveClasses = 'bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 border-slate-200/80 font-medium hover:border-slate-300';

                    return `
                        <button 
                            type="button" 
                            data-category-id="${cat.id}"
                            class="category-chip flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs border transition-all duration-200 min-h-[44px] cursor-pointer active:scale-95 ${isActive ? activeClasses : inactiveClasses}"
                        >
                            <i class="fa-solid ${cat.icon} text-xs ${isActive ? 'text-accent' : 'text-slate-400'}"></i>
                            <span>${cat.label}</span>
                            ${typeof count === 'number' && count > 0 ? `
                                <span class="px-1.5 py-0.2 text-[10px] rounded-full font-bold ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}">
                                    ${count}
                                </span>
                            ` : ''}
                        </button>
                    `;
                }).join('')}
            </div>
        `;

        // Attachement des écouteurs
        containerEl.querySelectorAll('.category-chip').forEach((btn) => {
            btn.addEventListener('click', () => {
                const catId = btn.getAttribute('data-category-id');
                if (catId && catId !== currentActive) {
                    currentActive = catId;
                    render();
                    if (typeof onSelectCategory === 'function') {
                        onSelectCategory(catId);
                    }
                }
            });
        });
    }

    render();
    containerEl.setActiveCategory = (catId) => {
        currentActive = catId;
        render();
    };
    containerEl.setCategoryCounts = (counts) => {
        countsMap = counts || {};
        render();
    };
    return containerEl;
}

export default createCategoryChips;
