/**
 * Tests unitaires pour le composant de navigation multi-format (BottomNav & Sidebar Desktop).
 * Vérifie notamment le comportement des boutons de navigation profil/vendeur,
 * l'absence d'erreur de portée (ReferenceError) et la réactivité à la connexion/déconnexion.
 */

import assert from 'node:assert';
import { register } from 'node:module';

// Intercepteur Node pour les imports d'images (ex: .webp)
const loaderCode = `
export async function load(url, context, nextLoad) {
  if (url.endsWith('.webp') || url.endsWith('.jpg') || url.endsWith('.png') || url.endsWith('.svg')) {
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export default "/assets/mock-image.webp";',
    };
  }
  return nextLoad(url, context);
}
`;
const loaderUrl = 'data:text/javascript;base64,' + Buffer.from(loaderCode).toString('base64');
register(loaderUrl);

// Mock DOM minimal et robuste pour les tests de composants en environnement Node
class MockElement {
    constructor(tag) {
        this.tagName = tag;
        this.id = '';
        this.className = '';
        this._innerHTML = '';
        this.listeners = {};
        this._children = {};
        this.classList = {
            add: () => {},
            remove: () => {},
            toggle: () => {},
            replace: () => {},
        };
    }

    set innerHTML(html) {
        this._innerHTML = html;
        this._children = {};
    }

    get innerHTML() {
        return this._innerHTML;
    }

    addEventListener(event, handler) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(handler);
    }

    click() {
        const cbs = this.listeners['click'] || [];
        for (const cb of cbs) {
            cb({ currentTarget: this });
        }
    }

    querySelector(selector) {
        if (!this._children[selector]) {
            this._children[selector] = new MockElement('div');
            this._children[selector].id = selector.replace(/^[#.]/, '');
        }
        return this._children[selector];
    }
}

global.document = {
    createElement: (tag) => new MockElement(tag),
};

console.log('🧪 Démarrage des tests unitaires du composant BottomNav & Sidebar...');

const { createBottomNav } = await import('../src/components/BottomNav.js');

// Test 1 : Vendeur initialement connecté (Vendeur classique)
{
    let targetView = null;
    const nav = createBottomNav({
        activeTab: 'catalog',
        seller: { role: 'vendeur', prenom: 'Fatou', nom: 'Diop' },
        onNavigate: (view) => {
            targetView = view;
        },
    });

    assert.ok(nav.innerHTML.includes('Profil'), 'Le libellé mobile doit afficher Profil quand le vendeur est connecté');
    assert.ok(nav.innerHTML.includes('Profil Fatou'), 'La sidebar desktop doit afficher Profil Fatou');

    // Clic sur l'onglet mobile vendeur
    const mobileBtn = nav.querySelector('#bnav-tab-seller');
    assert.doesNotThrow(() => {
        mobileBtn.click();
    }, 'Le clic sur #bnav-tab-seller ne doit pas lever de ReferenceError');
    assert.strictEqual(targetView, 'profile', 'Le clic mobile doit naviguer vers la vue "profile"');

    // Clic sur le bouton de la sidebar desktop
    targetView = null;
    const desktopBtn = nav.querySelector('#sidebar-tab-seller');
    assert.doesNotThrow(() => {
        desktopBtn.click();
    }, 'Le clic sur #sidebar-tab-seller ne doit pas lever de ReferenceError');
    assert.strictEqual(targetView, 'profile', 'Le clic desktop doit naviguer vers la vue "profile"');

    console.log('✅ [BottomNav] Navigation vers "profile" pour un vendeur connecté validée !');
}

// Test 2 : Vendeur initialement déconnecté (Visiteur)
{
    let targetView = null;
    const nav = createBottomNav({
        activeTab: 'catalog',
        seller: null,
        onNavigate: (view) => {
            targetView = view;
        },
    });

    assert.ok(nav.innerHTML.includes('Vendeur'), 'Le libellé mobile doit afficher Vendeur quand déconnecté');
    assert.ok(nav.innerHTML.includes('Espace Vendeur'), 'La sidebar desktop doit afficher Espace Vendeur quand déconnecté');

    const mobileBtn = nav.querySelector('#bnav-tab-seller');
    mobileBtn.click();
    assert.strictEqual(targetView, 'seller', 'Le clic mobile déconnecté doit ouvrir l\'espace vendeur');

    targetView = null;
    const desktopBtn = nav.querySelector('#sidebar-tab-seller');
    desktopBtn.click();
    assert.strictEqual(targetView, 'seller', 'Le clic desktop déconnecté doit ouvrir l\'espace vendeur');

    console.log('✅ [BottomNav] Navigation vers "seller" pour un visiteur déconnecté validée !');
}

// Test 3 : Changement d'état dynamique via setSeller()
{
    let targetView = null;
    const nav = createBottomNav({
        activeTab: 'catalog',
        seller: null,
        onNavigate: (view) => {
            targetView = view;
        },
    });

    // Connexion après coup (SuperAdmin)
    nav.setSeller({ role: 'superadmin', prenom: 'Moussa' });
    assert.ok(nav.innerHTML.includes('Profil Moussa'), 'Doit basculer vers Profil Moussa après setSeller');

    const mobileBtn = nav.querySelector('#bnav-tab-seller');
    mobileBtn.click();
    assert.strictEqual(targetView, 'profile', 'Après setSeller, le clic mobile doit naviguer vers "profile"');

    targetView = null;
    const desktopBtn = nav.querySelector('#sidebar-tab-seller');
    desktopBtn.click();
    assert.strictEqual(targetView, 'profile', 'Après setSeller, le clic desktop doit naviguer vers "profile"');

    // Déconnexion via setSeller(null)
    targetView = null;
    nav.setSeller(null);
    assert.ok(nav.innerHTML.includes('Espace Vendeur'), 'Doit repasser en Espace Vendeur après déconnexion');

    mobileBtn.click();
    assert.strictEqual(targetView, 'seller', 'Après déconnexion, le clic mobile doit renvoyer vers "seller"');

    desktopBtn.click();
    assert.strictEqual(targetView, 'seller', 'Après déconnexion, le clic desktop doit renvoyer vers "seller"');

    console.log('✅ [BottomNav] Bascule dynamique de setSeller (connexion/déconnexion) validée !');
}

console.log('🎉 TOUS LES TESTS UNITAIRES DU COMPOSANT BOTTOMNAV SONT PASSÉS AVEC SUCCÈS !');
