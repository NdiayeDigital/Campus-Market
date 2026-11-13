/**
 * Composant AnnouncementCarousel
 * Carrousel 16:9 auto-défilant servant de panneau d'annonces, publicités et mises en avant partenaires.
 * Remplace l'ancien bloc bleu statique pour offrir une visibilité immédiate des produits dès l'arrivée.
 */

import { escapeHTML } from '../utils/security.js';
import { CAROUSEL_TYPES, DEFAULT_CAROUSEL_SLIDES } from '../config/announcements.js';

/**
 * Crée le carrousel 16:9 interactif de la page d'accueil.
 * @param {Object} props
 * @param {Array} [props.slides] - Liste initiale des diapositives
 * @param {Function} [props.onNavigate] - Callback de navigation interne
 * @param {Function} [props.onSelectCategory] - Callback pour filtrer une catégorie
 * @param {Function} [props.onScrollToPartners] - Callback pour défiler vers la section partenaires
 * @returns {HTMLElement}
 */
export function createAnnouncementCarousel({
    slides = DEFAULT_CAROUSEL_SLIDES,
    onNavigate,
    onSelectCategory,
    onScrollToPartners,
} = {}) {
    const containerEl = document.createElement('section');
    containerEl.className = 'w-full relative';
    containerEl.setAttribute('aria-label', 'Panneau d’annonces, publicités et partenaires');

    let currentSlides = Array.isArray(slides) && slides.length > 0 
        ? slides.filter((s) => s.is_active !== false) 
        : DEFAULT_CAROUSEL_SLIDES;

    if (currentSlides.length === 0) {
        currentSlides = DEFAULT_CAROUSEL_SLIDES;
    }

    let currentIndex = 0;
    let autoplayTimer = null;
    let touchStartX = 0;
    let touchEndX = 0;

    function startAutoplay() {
        stopAutoplay();
        if (currentSlides.length <= 1) return;
        autoplayTimer = setInterval(() => {
            goToSlide((currentIndex + 1) % currentSlides.length);
        }, 5000);
    }

    function stopAutoplay() {
        if (autoplayTimer) {
            clearInterval(autoplayTimer);
            autoplayTimer = null;
        }
    }

    function goToSlide(index) {
        if (index < 0) {
            currentIndex = currentSlides.length - 1;
        } else if (index >= currentSlides.length) {
            currentIndex = 0;
        } else {
            currentIndex = index;
        }
        updateTrackPosition();
        updateDots();
    }

    function updateTrackPosition() {
        const track = containerEl.querySelector('#carousel-track');
        if (track) {
            track.style.transform = `translateX(-${currentIndex * 100}%)`;
        }
    }

    function updateDots() {
        const dots = containerEl.querySelectorAll('.carousel-dot');
        dots.forEach((dot, idx) => {
            if (idx === currentIndex) {
                dot.className = 'carousel-dot w-6 h-2 rounded-full bg-white transition-all duration-300 shadow-xs';
                dot.setAttribute('aria-current', 'true');
            } else {
                dot.className = 'carousel-dot w-2 h-2 rounded-full bg-white/40 hover:bg-white/70 transition-all duration-200';
                dot.removeAttribute('aria-current');
            }
        });
    }

    function handleActionClick(slide) {
        const link = (slide.link_url || '').trim();
        if (!link) return;

        if (link.startsWith('http://') || link.startsWith('https://')) {
            window.open(link, '_blank', 'noopener,noreferrer');
            return;
        }

        if (link === '#partners') {
            if (typeof onScrollToPartners === 'function') {
                onScrollToPartners();
            } else {
                const partnersEl = document.getElementById('partners-section');
                if (partnersEl) {
                    partnersEl.scrollIntoView({ behavior: 'smooth' });
                }
            }
            return;
        }

        if (link.startsWith('#category/')) {
            const cat = link.replace('#category/', '').trim();
            if (typeof onSelectCategory === 'function') {
                onSelectCategory(cat);
            }
            return;
        }

        if (typeof onNavigate === 'function') {
            onNavigate(link.replace('#', ''));
        } else {
            window.location.hash = link;
        }
    }

    function renderSlideHTML(slide, index) {
        const typeConfig = CAROUSEL_TYPES[slide.slide_type] || CAROUSEL_TYPES.annonce;
        const hasCustomImage = Boolean(slide.image_url && slide.image_url.trim());
        const gradientClass = typeConfig.gradient || 'from-blue-700 via-indigo-800 to-slate-950';

        return `
            <div 
                data-slide-index="${index}"
                class="carousel-slide flex-shrink-0 w-full h-full relative overflow-hidden flex items-center justify-center select-none ${!hasCustomImage ? `bg-gradient-to-br ${gradientClass}` : 'bg-slate-900'}"
            >
                ${hasCustomImage ? `
                    <img 
                        src="${escapeHTML(slide.image_url)}" 
                        alt="${escapeHTML(slide.title || 'Affiche Campus Market')}"
                        class="w-full h-full object-cover object-center select-none pointer-events-none transition-transform duration-700 hover:scale-[1.02]"
                        loading="${index === 0 ? 'eager' : 'lazy'}"
                        onerror="this.style.display='none'; const fb = this.parentElement.querySelector('.carousel-fallback'); if (fb) fb.classList.remove('hidden');"
                    />
                    <!-- Repli visuel épuré si erreur de chargement de l'image -->
                    <div class="carousel-fallback hidden absolute inset-0 bg-gradient-to-br ${gradientClass} flex flex-col items-center justify-center text-center p-6 text-white select-none">
                        <i class="fa-solid fa-image text-4xl mb-2 text-white/50"></i>
                        <span class="font-heading font-extrabold text-sm sm:text-base">${escapeHTML(slide.title || 'Campus Market')}</span>
                    </div>
                ` : `
                    <!-- Visuel de repli si aucune image n'est renseignée -->
                    <div class="flex flex-col items-center justify-center text-center p-6 text-white select-none">
                        <i class="fa-solid fa-image text-4xl mb-2 text-white/50"></i>
                        <span class="font-heading font-extrabold text-sm sm:text-base">${escapeHTML(slide.title || 'Campus Market')}</span>
                    </div>
                `}
            </div>
        `;
    }

    function render() {
        containerEl.innerHTML = `
            <!-- Conteneur 16:9 compact & centré : hauteur maîtrisée (~430px sur PC, ~200px sur mobile) sans rognage -->
            <div 
                id="carousel-viewport" 
                class="w-full max-w-3xl mx-auto aspect-[16/9] rounded-2xl sm:rounded-3xl overflow-hidden relative shadow-md bg-slate-950 group"
            >
                <!-- Piste coulissante des slides -->
                <div 
                    id="carousel-track" 
                    class="w-full h-full flex transition-transform duration-500 ease-out will-change-transform"
                    style="transform: translateX(-${currentIndex * 100}%);"
                >
                    ${currentSlides.map((slide, idx) => renderSlideHTML(slide, idx)).join('')}
                </div>

                <!-- Flèche précédente Desktop (masquée mobile) -->
                ${currentSlides.length > 1 ? `
                    <button 
                        type="button" 
                        id="btn-carousel-prev" 
                        aria-label="Diapositive précédente"
                        class="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer active:scale-90"
                    >
                        <i class="fa-solid fa-chevron-left text-xs"></i>
                    </button>

                    <!-- Flèche suivante Desktop (masquée mobile) -->
                    <button 
                        type="button" 
                        id="btn-carousel-next" 
                        aria-label="Diapositive suivante"
                        class="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer active:scale-90"
                    >
                        <i class="fa-solid fa-chevron-right text-xs"></i>
                    </button>

                    <!-- Puces de pagination (Dots) -->
                    <div class="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-xs">
                        ${currentSlides.map((_, idx) => `
                            <button 
                                type="button" 
                                data-dot-index="${idx}"
                                aria-label="Aller à la diapositive ${idx + 1}"
                                class="carousel-dot ${idx === currentIndex ? 'w-6 h-2 rounded-full bg-white transition-all duration-300 shadow-xs' : 'w-2 h-2 rounded-full bg-white/40 hover:bg-white/70 transition-all duration-200'}"
                            ></button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;

        bindEvents();
    }

    function bindEvents() {
        const viewport = containerEl.querySelector('#carousel-viewport');
        if (!viewport) return;

        // Pause au survol souris
        viewport.addEventListener('mouseenter', stopAutoplay);
        viewport.addEventListener('mouseleave', startAutoplay);

        // Détection tactile Swipe Mobile
        viewport.addEventListener('touchstart', (e) => {
            stopAutoplay();
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        viewport.addEventListener('touchend', (e) => {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipeGesture();
            startAutoplay();
        }, { passive: true });

        // Flèches
        containerEl.querySelector('#btn-carousel-prev')?.addEventListener('click', (e) => {
            e.stopPropagation();
            goToSlide(currentIndex - 1);
        });

        containerEl.querySelector('#btn-carousel-next')?.addEventListener('click', (e) => {
            e.stopPropagation();
            goToSlide(currentIndex + 1);
        });

        // Puces (Dots)
        containerEl.querySelectorAll('.carousel-dot').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const idx = parseInt(btn.getAttribute('data-dot-index'), 10);
                if (!isNaN(idx)) goToSlide(idx);
            });
        });
    }

    function handleSwipeGesture() {
        const diffX = touchEndX - touchStartX;
        const SWIPE_THRESHOLD = 40;
        if (diffX > SWIPE_THRESHOLD) {
            goToSlide(currentIndex - 1); // Swipe droit -> précédent
        } else if (diffX < -SWIPE_THRESHOLD) {
            goToSlide(currentIndex + 1); // Swipe gauche -> suivant
        }
    }

    // Initialisation
    render();
    startAutoplay();

    // Méthodes publiques sur le composant DOM
    containerEl.setSlides = function (newSlides) {
        if (Array.isArray(newSlides) && newSlides.length > 0) {
            currentSlides = newSlides.filter((s) => s.is_active !== false);
            currentIndex = 0;
            render();
            startAutoplay();
        }
    };

    containerEl.destroy = function () {
        stopAutoplay();
    };

    return containerEl;
}
