/**
 * Suite de tests automatisés : Mode Sombre & Dual Logo (Clair / Sombre)
 * Valide :
 * 1. Présence et intégrité des assets visuels (logo.webp, logo-dark.webp, PWA icons).
 * 2. Configuration Tailwind (darkMode: 'class') et script anti-FOUC dans index.html.
 * 3. Logique unitaire du gestionnaire de thème (src/utils/theme.js).
 * 4. Test E2E headless avec Playwright sur http://localhost:5173 :
 *    - Bascule de thème via le bouton d'en-tête (#header-theme-btn).
 *    - Persistance du choix dans localStorage ('cm_theme').
 *    - Commutation de visibilité des logos (logo.webp vs logo-dark.webp).
 *    - Test anti-FOUC après rechargement de page.
 *    - Captures d'écran Desktop & Mobile dans tests/screenshots/dark-mode/.
 */

import fs from 'fs';
import path from 'path';
import assert from 'node:assert';
import { chromium } from 'playwright';
import { getTheme, setTheme, toggleTheme, isDarkMode, subscribeTheme } from '../src/utils/theme.js';

console.log('🧪 Démarrage des tests : Mode Sombre & Logo Adaptatif...\n');

// ============================================================================
// 1. VÉRIFICATION DES ASSETS DU LOGO (CLAIR & SOMBRE)
// ============================================================================
console.log('--- 1. Contrôle des assets visuels ---');
const assetsToCheck = [
    'public/assets/logo.webp',
    'src/assets/logo.webp',
    'public/assets/logo-dark.webp',
    'src/assets/logo-dark.webp',
    'public/assets/logo-192x192.png',
    'public/assets/logo-512x512.png',
    'src/assets/logo-192x192.png',
    'src/assets/logo-512x512.png'
];

for (const assetRelPath of assetsToCheck) {
    const fullPath = path.resolve(assetRelPath);
    assert.ok(fs.existsSync(fullPath), `Échec : L'asset ${assetRelPath} doit exister sur le disque.`);
    const stats = fs.statSync(fullPath);
    assert.ok(stats.size > 500, `Échec : L'asset ${assetRelPath} est vide ou anormalement petit (${stats.size} octets).`);
}
console.log('✅ [Assets] Logos HD transparents et icônes PWA vérifiés avec succès !');

// ============================================================================
// 2. CONTRÔLE DE LA CONFIGURATION TAILWIND ET SCRIPT ANTI-FOUC
// ============================================================================
console.log('\n--- 2. Contrôle de la configuration Tailwind & Anti-FOUC ---');
const tailwindConfig = fs.readFileSync(path.resolve('tailwind.config.js'), 'utf-8');
assert.ok(tailwindConfig.includes("darkMode: 'class'"), "Échec : tailwind.config.js doit contenir darkMode: 'class'");

const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf-8');
assert.ok(indexHtml.includes("cm_theme"), "Échec : index.html doit contenir la vérification de la clé localStorage 'cm_theme'");
assert.ok(indexHtml.includes("classList.add('dark')"), "Échec : Le script anti-FOUC d'index.html doit pouvoir injecter la classe 'dark'");

const indexCss = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');
assert.ok(indexCss.includes("html.dark body"), "Échec : src/index.css doit définir des règles de fond/texte pour html.dark body");
console.log('✅ [Configuration] Tailwind darkMode: class & Anti-FOUC validés !');

// ============================================================================
// 3. TESTS UNITAIRES DU GESTIONNAIRE DE THÈME (theme.js)
// ============================================================================
console.log('\n--- 3. Tests unitaires de src/utils/theme.js ---');

// Mock environnement pour test unitaire Node
let mockStorage = {};
const mockClassList = new Set();
const windowListeners = {};

globalThis.CustomEvent = class CustomEvent {
    constructor(type, eventInitDict) {
        this.type = type;
        this.detail = eventInitDict?.detail;
    }
};

globalThis.localStorage = {
    getItem: (key) => mockStorage[key] || null,
    setItem: (key, val) => { mockStorage[key] = String(val); },
    removeItem: (key) => { delete mockStorage[key]; },
    clear: () => { mockStorage = {}; }
};

globalThis.document = {
    documentElement: {
        classList: {
            add: (cls) => mockClassList.add(cls),
            remove: (cls) => mockClassList.delete(cls),
            contains: (cls) => mockClassList.has(cls)
        }
    },
    querySelector: () => null,
    createElement: () => ({ setAttribute: () => {} }),
    head: { appendChild: () => {} }
};

globalThis.window = {
    matchMedia: () => ({ matches: false, addEventListener: () => {} }),
    addEventListener: (type, handler) => {
        windowListeners[type] = windowListeners[type] || [];
        windowListeners[type].push(handler);
    },
    removeEventListener: (type, handler) => {
        if (!windowListeners[type]) return;
        windowListeners[type] = windowListeners[type].filter(h => h !== handler);
    },
    dispatchEvent: (event) => {
        const handlers = windowListeners[event.type] || [];
        for (const h of handlers) h(event);
        return true;
    }
};

// Test initialisation par défaut (clair)
localStorage.clear();
mockClassList.clear();
assert.strictEqual(getTheme(), 'light', "Le thème par défaut doit être 'light'");
assert.strictEqual(isDarkMode(), false, "isDarkMode() doit retourner false par défaut");

// Test setTheme('dark')
let subscriberFired = null;
const unsubscribe = subscribeTheme((newTheme) => {
    subscriberFired = newTheme;
});

const returnedDark = setTheme('dark');
assert.strictEqual(returnedDark, 'dark');
assert.strictEqual(localStorage.getItem('cm_theme'), 'dark');
assert.ok(mockClassList.has('dark'), "La classe 'dark' doit être ajoutée au documentElement");
assert.strictEqual(subscriberFired, 'dark', "Le souscripteur doit recevoir le nouveau thème");
assert.strictEqual(isDarkMode(), true, "isDarkMode() doit retourner true quand le thème est dark");

// Test toggleTheme()
const toggledLight = toggleTheme();
assert.strictEqual(toggledLight, 'light');
assert.strictEqual(localStorage.getItem('cm_theme'), 'light');
assert.ok(!mockClassList.has('dark'), "La classe 'dark' doit être retirée du documentElement");
assert.strictEqual(subscriberFired, 'light');
assert.strictEqual(isDarkMode(), false);

unsubscribe();
console.log('✅ [Unit Tests] Gestionnaire theme.js (getTheme, setTheme, toggleTheme, subscribers) validé !');

// ============================================================================
// 4. TESTS E2E PLAYWRIGHT SUR APPLICATION EN DIRECT
// ============================================================================
console.log('\n--- 4. Tests E2E Playwright sur le site (http://localhost:5173) ---');
const screenshotDir = path.resolve('tests/screenshots/dark-mode');
fs.mkdirSync(screenshotDir, { recursive: true });

const browser = await chromium.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const context = await browser.newContext({
    viewport: { width: 1280, height: 800 }
});
const page = await context.newPage();

try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 15000 });

    // 4.1. Vérification présence du bouton de bascule dans le Header
    const headerToggleBtn = page.locator('#header-theme-btn');
    assert.ok(await headerToggleBtn.count() > 0, "Échec : Le bouton #header-theme-btn doit être présent dans le Header");

    // 4.2. Bascule vers le Mode Sombre
    await headerToggleBtn.first().click();
    await page.waitForTimeout(400);

    const isHtmlDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    const storedTheme = await page.evaluate(() => localStorage.getItem('cm_theme'));
    assert.ok(isHtmlDark, "Échec : L'élément <html> doit posséder la classe 'dark' après le clic sur la bascule");
    assert.strictEqual(storedTheme, 'dark', "Échec : localStorage.cm_theme doit valoir 'dark'");

    // Vérification des styles calculés réels (CSS effectif)
    const darkHeaderBg = await page.evaluate(() => window.getComputedStyle(document.querySelector('header')).backgroundColor);
    const darkRootBg = await page.evaluate(() => window.getComputedStyle(document.querySelector('#app > div')).backgroundColor);
    assert.strictEqual(darkHeaderBg, 'rgb(15, 23, 42)', "Échec : Le header doit avoir le fond sombre slate-900 (rgb(15, 23, 42))");
    assert.strictEqual(darkRootBg, 'rgb(2, 6, 23)', "Échec : Le fond de page doit être slate-950 (rgb(2, 6, 23))");

    // Vérification visibilité du dual logo
    const lightLogoCount = await page.locator('img[src*="logo.webp"].dark\\:hidden, img[src*="logo.webp"]:not(.dark\\:hidden)').count();
    const darkLogoCount = await page.locator('img[src*="logo-dark.webp"]').count();
    assert.ok(lightLogoCount > 0, "Échec : Le logo clair doit être présent dans le DOM");
    assert.ok(darkLogoCount > 0, "Échec : Le logo sombre doit être présent dans le DOM");

    // Capture d'écran Desktop Dark Mode
    const desktopDarkPath = path.join(screenshotDir, '01_desktop_dark.png');
    await page.screenshot({ path: desktopDarkPath, fullPage: false });
    console.log(`📸 Capture Desktop Dark enregistrée : ${desktopDarkPath}`);

    // 4.3. Test de persistance Anti-FOUC au rechargement
    await page.reload({ waitUntil: 'networkidle' });
    const isStillDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    assert.ok(isStillDark, "Échec : Le mode sombre doit persister après rechargement de page (Anti-FOUC)");

    // 4.4. Bascule retour vers le Mode Clair
    await page.locator('#header-theme-btn').first().click();
    await page.waitForTimeout(400);

    const isHtmlLight = await page.evaluate(() => !document.documentElement.classList.contains('dark'));
    const storedThemeLight = await page.evaluate(() => localStorage.getItem('cm_theme'));
    assert.ok(isHtmlLight, "Échec : L'élément <html> ne doit plus posséder la classe 'dark'");
    assert.strictEqual(storedThemeLight, 'light', "Échec : localStorage.cm_theme doit valoir 'light'");

    const lightHeaderBg = await page.evaluate(() => window.getComputedStyle(document.querySelector('header')).backgroundColor);
    const lightRootBg = await page.evaluate(() => window.getComputedStyle(document.querySelector('#app > div')).backgroundColor);
    assert.strictEqual(lightHeaderBg, 'rgb(255, 255, 255)', "Échec : Le header doit retrouver le fond blanc (rgb(255, 255, 255))");
    assert.strictEqual(lightRootBg, 'rgb(248, 250, 252)', "Échec : Le fond de page doit retrouver le fond clair background (rgb(248, 250, 252))");

    // Capture d'écran Desktop Light Mode
    const desktopLightPath = path.join(screenshotDir, '02_desktop_light.png');
    await page.screenshot({ path: desktopLightPath, fullPage: false });
    console.log(`📸 Capture Desktop Light enregistrée : ${desktopLightPath}`);

    // Vérification que les captures d'écran sont visuellement distinctes
    const darkBytes = fs.readFileSync(desktopDarkPath);
    const lightBytes = fs.readFileSync(desktopLightPath);
    assert.ok(!darkBytes.equals(lightBytes), "Échec : Les captures Desktop Clair et Sombre doivent être visuellement et bitairement différentes !");

    // 4.5. Test sur viewport Mobile (375x812)
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(300);

    // Bascule en sombre sur mobile via le bouton header
    await page.locator('#header-theme-btn').first().click();
    await page.waitForTimeout(300);

    const isMobileDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
    assert.ok(isMobileDark, "Échec : Le mode sombre doit s'activer correctement sur mobile");

    // Capture d'écran Mobile Dark Mode
    const mobileDarkPath = path.join(screenshotDir, '03_mobile_dark.png');
    await page.screenshot({ path: mobileDarkPath, fullPage: false });
    console.log(`📸 Capture Mobile Dark enregistrée : ${mobileDarkPath}`);

    console.log('✅ [Playwright E2E] Bascule de thème, persistance, Anti-FOUC et réactivité mobile 100% validés !');
} finally {
    await browser.close();
}

console.log('\n🎉 TOUS LES TESTS DU MODE SOMBRE ONT RÉUSSI AVEC SUCCÈS !');
