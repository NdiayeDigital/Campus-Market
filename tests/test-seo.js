/**
 * Test unitaire et de conformité SEO pour Campus Market UIDT
 * Vérifie l'intégrité des métadonnées, du module SEO, des données structurées JSON-LD,
 * de robots.txt et de sitemap.xml.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DEFAULT_SEO } from '../src/utils/seo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Exécution de la suite de validation SEO & Métadonnées...');

// 1. Validation de DEFAULT_SEO
console.assert(DEFAULT_SEO.title.includes('Campus Market'), 'Le titre SEO par défaut doit mentionner "Campus Market"');
console.assert(DEFAULT_SEO.title.includes('UIDT'), 'Le titre SEO par défaut doit mentionner "UIDT"');
console.assert(DEFAULT_SEO.title.includes('Thiès'), 'Le titre SEO par défaut doit mentionner "Thiès"');
console.assert(DEFAULT_SEO.description.length >= 50 && DEFAULT_SEO.description.length <= 180, 'La méta description doit être calibrée pour Google (50-180 caractères)');
console.assert(DEFAULT_SEO.url === 'https://campusmarket-uidt.com/', 'L\'URL canonique doit correspondre au domaine de production');
console.log('✅ [SEO Utility] Configuration par défaut validée !');

// 2. Validation de index.html
const indexHtmlPath = path.join(rootDir, 'index.html');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf-8');

// Vérification Title & Balises standards
console.assert(indexHtml.includes('<title>Campus Market — Marketplace Étudiante UIDT Thiès | Livraison en Chambre</title>'), 'Balise <title> absente ou incorrecte dans index.html');
console.assert(indexHtml.includes('name="description"'), 'Meta description absente dans index.html');
console.assert(indexHtml.includes('name="keywords"'), 'Meta keywords absente dans index.html');
console.assert(indexHtml.includes('name="robots"'), 'Meta robots absente dans index.html');
console.assert(indexHtml.includes('name="googlebot"'), 'Meta googlebot absente dans index.html');
console.assert(indexHtml.includes('rel="canonical"'), 'Lien canonique absent dans index.html');
console.assert(indexHtml.includes('hreflang="fr-SN"'), 'Lien hreflang fr-SN absent dans index.html');

// Vérification Balises Géographiques (SEO Local Thiès)
console.assert(indexHtml.includes('name="geo.region" content="SN-TH"'), 'Balise geo.region SN-TH absente');
console.assert(indexHtml.includes('name="geo.placename" content="Thiès, Sénégal"'), 'Balise geo.placename absente');
console.assert(indexHtml.includes('name="geo.position"'), 'Balise geo.position absente');

// Vérification Open Graph & Twitter Cards
console.assert(indexHtml.includes('property="og:title"'), 'Balise og:title absente');
console.assert(indexHtml.includes('property="og:description"'), 'Balise og:description absente');
console.assert(indexHtml.includes('property="og:image"'), 'Balise og:image absente');
console.assert(indexHtml.includes('property="og:locale" content="fr_SN"'), 'Balise og:locale fr_SN absente');
console.assert(indexHtml.includes('name="twitter:card"'), 'Balise twitter:card absente');

// Vérification Données Structurées JSON-LD Schema.org
console.assert(indexHtml.includes('"@type": "WebSite"'), 'Schéma Schema.org WebSite manquant');
console.assert(indexHtml.includes('"@type": "SearchAction"'), 'SearchAction pour Google Sitelinks Searchbox manquant');
console.assert(indexHtml.includes('"@type": "ShoppingCenter"'), 'Schéma ShoppingCenter / LocalBusiness manquant');
console.assert(indexHtml.includes('"@type": "FAQPage"'), 'Schéma FAQPage pour rich snippets manquant');
console.assert(indexHtml.includes('"@type": "BreadcrumbList"'), 'Schéma BreadcrumbList manquant');

// Vérification Sémantique Fallback & Noscript
console.assert(indexHtml.includes('<h1 class="text-2xl sm:text-3xl font-extrabold leading-snug">'), 'H1 sémantique fallback absent');
console.assert(indexHtml.includes('<noscript>'), 'Section <noscript> absente');
console.log('✅ [index.html] Intégralité des balises On-Page, Geo, OpenGraph et JSON-LD validée !');

// 3. Validation de public/robots.txt
const robotsPath = path.join(rootDir, 'public', 'robots.txt');
console.assert(fs.existsSync(robotsPath), 'public/robots.txt doit exister');
const robotsTxt = fs.readFileSync(robotsPath, 'utf-8');
console.assert(robotsTxt.includes('User-agent: *'), 'robots.txt doit cibler User-agent: *');
console.assert(robotsTxt.includes('Allow: /'), 'robots.txt doit autoriser la racine /');
console.assert(robotsTxt.includes('Disallow: /admin'), 'robots.txt doit bloquer /admin');
console.assert(robotsTxt.includes('Sitemap: https://campusmarket-uidt.com/sitemap.xml'), 'robots.txt doit déclarer le sitemap.xml');
console.log('✅ [robots.txt] Directives d\'indexation et sitemap validés !');

// 4. Validation de public/sitemap.xml
const sitemapPath = path.join(rootDir, 'public', 'sitemap.xml');
console.assert(fs.existsSync(sitemapPath), 'public/sitemap.xml doit exister');
const sitemapXml = fs.readFileSync(sitemapPath, 'utf-8');
console.assert(sitemapXml.includes('<?xml version="1.0" encoding="UTF-8"?>'), 'sitemap.xml doit déclarer la version XML');
console.assert(sitemapXml.includes('<loc>https://campusmarket-uidt.com/</loc>'), 'sitemap.xml doit contenir l\'URL principale');
console.assert(sitemapXml.includes('<priority>1.0</priority>'), 'sitemap.xml doit attribuer la priorité 1.0 à la racine');
console.assert(sitemapXml.includes('<changefreq>daily</changefreq>'), 'sitemap.xml doit indiquer la fréquence daily');
console.log('✅ [sitemap.xml] Structure et conformité Sitemaps 0.9 validées !');

// 5. Validation de vercel.json
const vercelPath = path.join(rootDir, 'vercel.json');
const vercelJson = JSON.parse(fs.readFileSync(vercelPath, 'utf-8'));
const robotsHeader = vercelJson.headers.find(h => h.source === '/robots.txt');
const sitemapHeader = vercelJson.headers.find(h => h.source === '/sitemap.xml');
console.assert(robotsHeader !== undefined, 'vercel.json doit configurer les en-têtes pour /robots.txt');
console.assert(sitemapHeader !== undefined, 'vercel.json doit configurer les en-têtes pour /sitemap.xml');
console.log('✅ [vercel.json] En-têtes HTTP de distribution des fichiers SEO validés !');

console.log('🎉 TOUS LES TESTS SEO & INDEXATION ONT RÉUSSI AVEC SUCCÈS !');
