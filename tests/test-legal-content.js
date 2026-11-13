/**
 * Suite de tests unitaires :
 * Pages institutionnelles et légales (À Propos, CGU, Confidentialité).
 */

import assert from 'node:assert/strict';
import { ABOUT_DATA, TERMS_DATA, PRIVACY_DATA } from '../src/content/legal-content.js';
import { createLegalView } from '../src/components/LegalView.js';

console.log('🧪 Démarrage des tests des Pages Institutionnelles et Légales...');

// =========================================================================
// 1. Tests des Données de Présentation (ABOUT_DATA)
// =========================================================================

assert.ok(ABOUT_DATA.badge.includes('UIDT'), 'Badge UIDT obligatoire');
assert.ok(ABOUT_DATA.title.includes('Marketplace'), 'Titre de la marketplace requis');
assert.equal(ABOUT_DATA.pillars.length, 4, '4 piliers fondateurs requis');
assert.equal(ABOUT_DATA.steps.length, 4, '4 étapes de commande requises');
assert.ok(ABOUT_DATA.zones.some((z) => z.name.includes('Pavillon A')), 'Zone Pavillon A requise');
assert.ok(ABOUT_DATA.zones.some((z) => z.name.includes('1000 Lits')), 'Zone 1000 Lits requise');
assert.ok(ABOUT_DATA.contact.supportEmail.includes('@campusmarket-uidt.com'), 'Email de contact officiel requis');
console.log('✅ [About Data] Piliers, 4 étapes, pavillons et coordonnées UIDT validés !');

// =========================================================================
// 2. Tests des Conditions d\'Utilisation (TERMS_DATA)
// =========================================================================

assert.ok(TERMS_DATA.version.includes('novembre 2026') || TERMS_DATA.version.includes('Novembre 2026'), 'Version novembre 2026 requise');
assert.equal(TERMS_DATA.charterPoints.length, 8, 'La charte étudiante officielle doit comporter 8 points');
assert.ok(TERMS_DATA.charterPoints[0].includes('un seul compte'), 'Point 1: compte unique requis');
assert.ok(TERMS_DATA.charterPoints[6].includes('directement le vendeur'), 'Point 7: paiement direct vendeur requis');

const intermediationSec = TERMS_DATA.sections.find((s) => s.id === 'role');
assert.ok(intermediationSec, 'Section rôle d\'intermédiation requise');
assert.ok(((intermediationSec.highlight || '') + ' ' + intermediationSec.content).includes('intermédiaire technique'), 'Mention intermédiaire technique requise');
assert.ok(intermediationSec.content.includes('pas vendeur des produits') || intermediationSec.content.includes("n'est ni propriétaire ni revendeur"), 'Mention non-propriétaire requise');

const prohibitedSec = TERMS_DATA.sections.find((s) => s.id === 'produits-interdits');
assert.ok(prohibitedSec, 'Section produits interdits requise');
assert.ok(prohibitedSec.content.includes('Alcool'), 'Interdiction de l\'alcool');
assert.ok(prohibitedSec.content.includes('drogues') || prohibitedSec.content.includes('stupéfiantes'), 'Interdiction des drogues');
assert.ok(prohibitedSec.content.includes('Armes'), 'Interdiction des armes');

const lawSec = TERMS_DATA.sections.find((s) => s.id === 'droit');
assert.ok(lawSec.content.includes('droit sénégalais'), 'Droit sénégalais requis');
console.log('✅ [Terms Data] Charte 8 points, intermédiation, produits interdits et droit sénégalais validés !');

// =========================================================================
// 3. Tests de la Politique de Confidentialité (PRIVACY_DATA)
// =========================================================================

assert.ok(PRIVACY_DATA.badge.includes('CDP Sénégal') && PRIVACY_DATA.badge.includes('2008-12'), 'Conformité Loi CDP 2008-12 requise');
assert.ok(PRIVACY_DATA.keyPrinciples.some((k) => k.title.includes('Zéro Revente')), 'Principe de Zéro Revente requis');
assert.ok(PRIVACY_DATA.keyPrinciples.some((k) => k.title.includes('RLS')), 'Principe de sécurité RLS requis');

const sharedSec = PRIVACY_DATA.sections.find((s) => s.id === 'partage');
assert.ok(sharedSec.content.includes('Aucun tiers publicitaire'), 'Interdiction de tiers publicitaires requise');

const rightsSec = PRIVACY_DATA.sections.find((s) => s.id === 'droits');
assert.ok(rightsSec.content.includes('support@campusmarket-uidt.com'), 'Email de contact DPO / droits requis');
console.log('✅ [Privacy Data] Conformité CDP Sénégal, Zéro Revente et droits d\'accès validés !');

// =========================================================================
// 4. Tests d\'Intégration du Composant createLegalView
// =========================================================================

// Polyfill DOM minimal pour environnement Node.js
if (typeof document === 'undefined') {
    globalThis.document = {
        createElement: (tag) => {
            const el = {
                tagName: tag.toUpperCase(),
                className: '',
                innerHTML: '',
                children: [],
                listeners: {},
                querySelector: (sel) => {
                    return {
                        addEventListener: (evt, fn) => {
                            if (!el.listeners[evt]) el.listeners[evt] = [];
                            el.listeners[evt].push(fn);
                        },
                        classList: { add: () => {}, remove: () => {}, toggle: () => {} },
                    };
                },
                querySelectorAll: (sel) => [],
                appendChild: (child) => el.children.push(child),
                addEventListener: (evt, fn) => {
                    if (!el.listeners[evt]) el.listeners[evt] = [];
                    el.listeners[evt].push(fn);
                },
            };
            return el;
        },
    };
    globalThis.window = {
        scrollTo: () => {},
        location: { hash: '' },
    };
}

const legalViewEl = createLegalView({
    initialTab: 'about',
});

assert.ok(legalViewEl, 'Le composant createLegalView doit être instancié');
assert.equal(typeof legalViewEl.setActiveTab, 'function', 'La méthode setActiveTab doit être exposée');
assert.ok(legalViewEl.innerHTML.includes('La 1ère Marketplace'), 'Le titre À Propos doit être présent initialement');

legalViewEl.setActiveTab('terms');
assert.ok(legalViewEl.innerHTML.includes('Conditions Générales'), 'Le titre CGU doit apparaître après bascule sur terms');
assert.ok(legalViewEl.innerHTML.includes('Charte'), 'La charte étudiante doit être affichée dans l\'onglet terms');

legalViewEl.setActiveTab('privacy');
assert.ok(legalViewEl.innerHTML.includes('Protection de Votre Vie Privée'), 'Le titre Confidentialité doit apparaître après bascule sur privacy');
assert.ok(legalViewEl.innerHTML.includes('Zéro Revente'), 'Le principe de zéro revente doit être affiché dans privacy');

console.log('✅ [LegalView Component] Instanciation et basculement dynamique d\'onglets validés !');

console.log('🎉 TOUS LES TESTS DES PAGES INSTITUTIONNELLES ET LÉGALES SONT PASSÉS AVEC SUCCÈS !');
process.exit(0);
