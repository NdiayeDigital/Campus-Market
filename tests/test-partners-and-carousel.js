/**
 * Suite de tests unitaires et d'intégration :
 * Carrousel 16:9 dynamique & Écosystème Partenaires Campus Market.
 */

import assert from 'node:assert/strict';
import { CAROUSEL_TYPES, DEFAULT_CAROUSEL_SLIDES } from '../src/config/announcements.js';
import { PARTNER_CATEGORIES, DEFAULT_PARTNERS, getBecomePartnerWhatsappUrl } from '../src/config/partners.js';
import {
    fetchCarouselSlides,
    addCarouselSlide,
    fetchPartners,
    addPartner,
    deleteCarouselSlide,
    deletePartner,
} from '../src/services/admin-service.js';
import { createAnnouncementCarousel } from '../src/components/AnnouncementCarousel.js';
import { createPartnersSection, createPartnersTicker } from '../src/components/PartnersSection.js';

console.log('🧪 Démarrage des tests du Carrousel 16:9 et de la Section Partenaires...');

// =========================================================================
// 1. Tests de Configuration & Typologie du Carrousel
// =========================================================================

// Test 1.1: Couverture des types de panneau
assert.ok(CAROUSEL_TYPES.annonce, 'Le type annonce doit être défini');
assert.ok(CAROUSEL_TYPES.pub, 'Le type pub doit être défini');
assert.ok(CAROUSEL_TYPES.partenaire, 'Le type partenaire doit être défini');
console.log('✅ [Carousel Config] Typologie (annonce, pub, partenaire) validée !');

// Test 1.2: Intégrité des slides par défaut (sans partenaires factices)
assert.ok(DEFAULT_CAROUSEL_SLIDES.length >= 2, 'Le carrousel doit comporter au moins 2 slides par défaut');
assert.ok(!JSON.stringify(DEFAULT_CAROUSEL_SLIDES).includes('Wave Sénégal'), 'Wave ne doit pas être inclus comme partenaire');
DEFAULT_CAROUSEL_SLIDES.forEach((slide, idx) => {
    assert.ok(slide.id, `La slide #${idx} doit avoir un id`);
    assert.ok(slide.title, `La slide #${idx} doit avoir un titre`);
    assert.ok(['annonce', 'pub', 'partenaire'].includes(slide.slide_type), `Slide #${idx} slide_type invalide : ${slide.slide_type}`);
    assert.ok(typeof slide.is_active === 'boolean', `Slide #${idx} doit avoir is_active booléen`);
    assert.ok(typeof slide.display_order === 'number', `Slide #${idx} doit avoir un ordre numérique`);
});
console.log('✅ [Carousel Config] Intégrité structurelle des diapositives par défaut validée !');

// =========================================================================
// 2. Tests de Configuration des Partenaires & Alliances
// =========================================================================

// Test 2.1: Catégories partenaires
assert.ok(PARTNER_CATEGORIES.amicale, 'Catégorie amicale requise');
assert.ok(PARTNER_CATEGORIES.payment, 'Catégorie payment requise');
assert.ok(PARTNER_CATEGORIES.local_business, 'Catégorie local_business requise');
assert.ok(PARTNER_CATEGORIES.sponsor, 'Catégorie sponsor requise');
console.log('✅ [Partners Config] Catégories partenaires (amicales, paiements, commerces) validées !');

// Test 2.2: Partenaires initiaux : liste vide pour saisie exclusive par l'admin
assert.equal(DEFAULT_PARTNERS.length, 0, 'La liste par défaut des partenaires doit être vide pour laisser l’admin renseigner les vrais partenaires');
console.log('✅ [Partners Config] Liste initiale vide conforme (gestion manuelle SuperAdmin) !');

// Test 2.3: Lien WhatsApp "Devenir Partenaire"
const partnerWhatsappUrl = getBecomePartnerWhatsappUrl();
assert.ok(partnerWhatsappUrl.includes('wa.me'), 'Lien WhatsApp invalide');
assert.ok(partnerWhatsappUrl.includes('partenaire'), 'Le message pré-rempli doit mentionner le partenariat');
console.log('✅ [Partners WhatsApp] Lien pré-rempli de candidature validé !');

// =========================================================================
// 3. Tests des Services d'Administration (Fallbacks & Validations)
// =========================================================================

async function testServices() {
    // Test 3.1: Récupération sécurisée du carrousel avec fallback
    const activeSlides = await fetchCarouselSlides(false);
    assert.ok(Array.isArray(activeSlides), 'fetchCarouselSlides doit retourner un tableau');
    assert.ok(activeSlides.length > 0, 'Les slides par défaut doivent être servies en repli');
    activeSlides.forEach((s) => assert.equal(s.is_active, true, 'Seules les slides actives doivent être renvoyées'));

    const allSlides = await fetchCarouselSlides(true);
    assert.ok(allSlides.length >= activeSlides.length, 'includeInactive doit inclure tous les éléments');
    console.log('✅ [AdminService Carousel] fetchCarouselSlides & fallback local validés !');

    // Test 3.2: Validation ajout de slide
    await assert.rejects(
        async () => {
            await addCarouselSlide({ title: '' });
        },
        /titre/i,
        'addCarouselSlide sans titre doit échouer'
    );
    console.log('✅ [AdminService Carousel] Contrôle de champ obligatoire validé !');

    // Test 3.3: Récupération sécurisée des partenaires avec fallback (tableau vide par défaut)
    const activePartners = await fetchPartners(false);
    assert.ok(Array.isArray(activePartners), 'fetchPartners doit retourner un tableau');

    const allPartners = await fetchPartners(true);
    assert.ok(Array.isArray(allPartners), 'includeInactive doit retourner un tableau');
    console.log('✅ [AdminService Partners] fetchPartners & gestion liste vide validées !');

    // Test 3.4: Validation ajout de partenaire
    await assert.rejects(
        async () => {
            await addPartner({ name: '' });
        },
        /nom/i,
        'addPartner sans nom doit échouer'
    );
    console.log('✅ [AdminService Partners] Contrôle de nom obligatoire validé !');

    // Test 3.5: Validation ID manquant pour suppression
    await assert.rejects(
        async () => {
            await deleteCarouselSlide('');
        },
        /ID/i,
        'deleteCarouselSlide sans ID doit échouer'
    );
    await assert.rejects(
        async () => {
            await deletePartner('');
        },
        /ID/i,
        'deletePartner sans ID doit échouer'
    );
    console.log('✅ [AdminService Guards] Contrôles d\'intégrité des suppressions validés !');
}

// =========================================================================
// 4. Tests des Composants UI (Environnement Mock DOM)
// =========================================================================

function testComponents() {
    // Mock minimal pour document createElement si exécuté dans Node.js
    if (typeof document === 'undefined') {
        global.document = {
            createElement: (tag) => {
                const el = {
                    tagName: tag.toUpperCase(),
                    className: '',
                    attributes: {},
                    children: [],
                    innerHTML: '',
                    style: {},
                    setAttribute: (k, v) => { el.attributes[k] = v; },
                    getAttribute: (k) => el.attributes[k] || null,
                    appendChild: (c) => el.children.push(c),
                    querySelector: () => null,
                    querySelectorAll: () => [],
                    addEventListener: () => {},
                };
                return el;
            },
            body: {
                appendChild: () => {},
            },
        };
    }

    // Instanciation AnnouncementCarousel (Mode Image Pure 16:9 sans texte ni lien)
    const carouselEl = createAnnouncementCarousel({
        slides: DEFAULT_CAROUSEL_SLIDES,
    });
    assert.ok(carouselEl, 'Le composant AnnouncementCarousel doit être instancié');
    assert.equal(typeof carouselEl.setSlides, 'function', 'setSlides doit être exposé');
    assert.equal(typeof carouselEl.destroy, 'function', 'destroy doit être exposé');
    assert.ok(carouselEl.innerHTML.includes('aspect-[16/9]'), 'Le carrousel doit respecter le ratio 16:9');
    assert.ok(!carouselEl.innerHTML.includes('max-h-[360px]'), 'Le carrousel ne doit pas avoir de max-h qui tronque le ratio 16:9');
    assert.ok(carouselEl.innerHTML.includes('max-w-3xl'), 'Le carrousel doit être compact (max-w-3xl) pour ne pas occuper tout l’écran');
    assert.ok(carouselEl.innerHTML.includes('mx-auto'), 'Le carrousel doit être centré horizontalement');
    assert.ok(carouselEl.innerHTML.includes('<img'), 'Le carrousel doit intégrer les images bannières');
    assert.ok(!carouselEl.innerHTML.includes('data-action="slide-cta"'), 'Le carrousel ne doit pas comporter de bouton CTA (pas de lien ni de texte superposé)');
    assert.ok(!carouselEl.innerHTML.includes('bg-gradient-to-t from-slate-950'), 'Le carrousel ne doit pas avoir de filtre sombre dégradé masquant les affiches');
    assert.ok(carouselEl.innerHTML.includes('carousel-dot'), 'Les puces de navigation discrètes doivent être présentes');
    console.log('✅ [AnnouncementCarousel] Ratio 16:9, affichage exclusif d\'images (sans texte ni lien) et cycle de vie validés !');

    // Instanciation PartnersSection (avec liste vide)
    const partnersEl = createPartnersSection({
        partners: [],
    });
    assert.ok(partnersEl, 'Le composant PartnersSection doit être instancié');
    assert.equal(partnersEl.id, 'partners-section', 'ID partners-section requis');
    assert.equal(typeof partnersEl.setPartners, 'function', 'setPartners doit être exposé');
    assert.ok(partnersEl.innerHTML.includes('Devenir Partenaire'), 'Le bouton de candidature doit être présent');
    assert.ok(partnersEl.innerHTML.includes('Nos partenariats officiels arrivent très prochainement'), 'Message d’attente requis quand la liste est vide');

    // Test mise à jour dynamique avec un partenaire réel ajouté par l'admin (petits blocs côte à côte)
    partnersEl.setPartners([
        {
            id: 'real-partner-1',
            name: 'Amicale UFR SES',
            category: 'amicale',
            badge: 'Partenaire Officiel',
            perk: 'Soutien aux étudiants de SES',
            is_active: true,
        },
    ]);
    assert.ok(partnersEl.innerHTML.includes('Amicale UFR SES'), 'Le partenaire ajouté par l’admin doit apparaître dynamiquement');
    assert.ok(partnersEl.innerHTML.includes('partner-tile'), 'Les petits blocs compacts doivent être présents');
    assert.ok(!partnersEl.innerHTML.includes('w-13'), 'Aucune classe CSS w-13 invalide ne doit exister');
    assert.ok(partnersEl.innerHTML.includes('w-14') || partnersEl.innerHTML.includes('w-16'), 'Le conteneur logo doit avoir une taille bornée (w-14 / w-16)');
    assert.ok(!partnersEl.innerHTML.includes('Rejoindre'), 'La tuile + Rejoindre doit être absente de la grille pour afficher uniquement les partenaires réels');
    assert.ok(!partnersEl.innerHTML.includes('partner-filter-btn'), 'La barre de filtres par catégories doit être absente');
    console.log('✅ [PartnersSection] Petits blocs compacts côte à côte épurés (sans filtres ni tuile +) validés !');

    // Test variante ticker pure ("seule la bande en haut")
    const tickerEl = createPartnersTicker({ partners: [] });
    assert.ok(tickerEl, 'Le ticker partenaires doit être instancié');
    assert.equal(tickerEl.id, 'partners-ticker-section', 'ID partners-ticker-section requis');
    assert.equal(typeof tickerEl.setPartners, 'function', 'setPartners doit être exposé sur le ticker');
    
    // À vide, le ticker reste masqué
    assert.equal(tickerEl.style.display, 'none', 'Le ticker vide doit être masqué');
    
    // Avec des partenaires, il s'affiche sans en-tête ni bandeau d'appel
    tickerEl.setPartners([
        {
            id: 'real-partner-1',
            name: 'Amicale UFR SES',
            category: 'amicale',
            badge: 'Partenaire Officiel',
            perk: 'Soutien aux étudiants de SES',
            is_active: true,
        },
    ]);
    assert.equal(tickerEl.style.display, '', 'Le ticker avec partenaires doit être visible');
    assert.ok(tickerEl.innerHTML.includes('animate-marquee'), 'Le ticker doit contenir la classe animate-marquee');
    assert.ok(tickerEl.innerHTML.includes('Amicale UFR SES'), 'Le ticker doit contenir le partenaire');
    assert.ok(!tickerEl.innerHTML.includes('Nos Partenaires Campus'), 'Le ticker pur ne doit pas comporter le grand titre');
    assert.ok(!tickerEl.innerHTML.includes('Rejoignez l\'écosystème'), 'Le ticker pur ne doit pas comporter le bandeau appel');
    console.log('✅ [PartnersSection Ticker] Variante bande défilante pure (seule la bande en haut) validée !');
}

await testServices();
testComponents();

console.log('🎉 TOUS LES TESTS DU CARROUSEL 16:9 ET DES PARTENAIRES SONT PASSÉS AVEC SUCCÈS !');
process.exit(0);
