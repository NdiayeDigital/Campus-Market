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
    containerEl.className = 'w-full py-3 px-4 bg-background border-b border-slate-100 overflow-hidden';

    let currentActive = activeCategory;

    function render() {
        containerEl.innerHTML = `
            <div class="flex items-center gap-2 overflow-x-auto scrollbar-none py-1 max-w-7xl mx-auto" style="scrollbar-width: none; -ms-overflow-style: none;">
                ${CATEGORIES.map((cat) => {
                    const isActive = cat.id === currentActive;
                    const activeClasses = 'bg-primary text-white shadow-md shadow-primary/20 scale-105';
                    const inactiveClasses = 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200';

                    return `
                        <button 
                            type="button" 
                            data-category-id="${cat.id}"
                            class="category-chip flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-semibold transition-all duration-200 min-h-[44px] cursor-pointer ${isActive ? activeClasses : inactiveClasses}"
                        >
                            <i class="fa-solid ${cat.icon} text-xs"></i>
                            <span>${cat.label}</span>
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
    return containerEl;
}

export default createCategoryChips;
