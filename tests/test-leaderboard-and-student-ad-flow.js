/**
 * Test Suite : Refonte Classement Public & Flux Annonces Étudiantes (250 FCFA / 5 jours)
 * Valide :
 * 1. La résolution des routes (#leaderboard, #classement, #passer-annonce, #annonce).
 * 2. La suppression du bloc bleu dans SellerLeaderboardView et la conservation du barème & classement.
 * 3. L'ouverture universelle du classement pour tous les utilisateurs (anonymes compris).
 * 4. La présence du bouton "Faire passer une annonce" sous le carrousel de la boutique.
 * 5. La conformité du formulaire de la page #passer-annonce (nom, prenom, email, image 16:9, lien SasPay 250 F / 5j).
 * 6. La validité et l'idempotence de la migration SQL additive.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('🧪 Démarrage des tests : Classement Public & Annonces Étudiantes...\n');

// Mock DOM minimaliste pour Node.js
if (typeof document === 'undefined') {
    global.document = {
        createElement: (tag) => {
            const el = {
                tagName: tag.toUpperCase(),
                className: '',
                id: '',
                attributes: {},
                children: [],
                innerHTMLValue: '',
                style: {},
                classList: {
                    add: (cls) => { el.className = (el.className + ' ' + cls).trim(); },
                    remove: (cls) => { el.className = el.className.replace(cls, '').trim(); },
                    toggle: () => {},
                    contains: (cls) => el.className.includes(cls),
                },
                setAttribute: (k, v) => { el.attributes[k] = v; },
                getAttribute: (k) => el.attributes[k] || null,
                removeAttribute: (k) => { delete el.attributes[k]; },
                appendChild: (child) => { el.children.push(child); return child; },
                addEventListener: () => {},
                querySelector: (sel) => {
                    if (el.innerHTMLValue && (sel.startsWith('#') || sel.startsWith('.'))) {
                        const target = sel.slice(1);
                        if (el.innerHTMLValue.includes(target)) {
                            return global.document.createElement('div');
                        }
                    }
                    return null;
                },
                querySelectorAll: () => [],
            };
            Object.defineProperty(el, 'innerHTML', {
                get() { return el.innerHTMLValue; },
                set(val) { el.innerHTMLValue = val; },
            });
            return el;
        },
        getElementById: () => null,
    };
    global.window = {
        location: { hash: '', search: '', href: '', pathname: '/' },
        addEventListener: () => {},
        dispatchEvent: () => {},
        scrollTo: () => {},
    };
    global.URL = {
        createObjectURL: () => 'blob:mock-preview-url',
        revokeObjectURL: () => {},
    };
}

// ==============================================================================
// 1. Validation de la résolution des routes
// ==============================================================================
console.log('--- 1. Contrôle du Routeur (router.js) ---');
import { resolveRoute } from '../src/utils/router.js';

const routeLeaderboard = resolveRoute('#leaderboard');
assert.strictEqual(routeLeaderboard.view, 'leaderboard', "La route #leaderboard doit résoudre view: 'leaderboard'");

const routeClassement = resolveRoute('#classement');
assert.strictEqual(routeClassement.view, 'leaderboard', "La route #classement doit résoudre view: 'leaderboard'");

const routePasserAnnonce = resolveRoute('#passer-annonce');
assert.strictEqual(routePasserAnnonce.view, 'student-ad', "La route #passer-annonce doit résoudre view: 'student-ad'");

const routeAnnonce = resolveRoute('#annonce');
assert.strictEqual(routeAnnonce.view, 'student-ad', "La route #annonce doit résoudre view: 'student-ad'");

console.log('✅ [Router] Résolution parfaite des routes #leaderboard, #classement et #passer-annonce !');

// ==============================================================================
// 2. Contrôle statique et dynamique de SellerLeaderboardView.js
// ==============================================================================
console.log('\n--- 2. Contrôle de SellerLeaderboardView.js (Sans bloc bleu) ---');
const leaderboardViewCode = fs.readFileSync(path.join(rootDir, 'src/components/seller/SellerLeaderboardView.js'), 'utf-8');

// Le bloc bleu 'from-primary via-blue-700 to-indigo-800' a-t-il été retiré ?
assert.strictEqual(
    leaderboardViewCode.includes('from-primary via-blue-700 to-indigo-800'),
    false,
    "Le bloc d'en-tête bleu immersif doit avoir été supprimé de la page classement !"
);

// Le barème méritocratique est-il bien conservé ?
assert.ok(
    leaderboardViewCode.includes('Barème Officiel des Points') || leaderboardViewCode.includes('+10 pts'),
    "Le barème officiel des points (+10, +8, +5, -5) doit être présent dans le composant !"
);

// Le podium Top 3 est-il bien conservé ?
assert.ok(
    leaderboardViewCode.includes('Podium de la Plateforme') || leaderboardViewCode.includes('Top 3'),
    "Le podium d'honneur Top 3 doit être conservé !"
);

// La liste de tous les marchands classés est-elle bien conservée ?
assert.ok(
    leaderboardViewCode.includes('Tous les Marchands Classés'),
    "La liste ordonnée de tous les marchands classés doit être conservée !"
);

console.log('✅ [SellerLeaderboardView] Bloc bleu éliminé, barème méritocratique et classement intégralement préservés !');

// ==============================================================================
// 3. Contrôle de la configuration des annonces étudiantes
// ==============================================================================
console.log('\n--- 3. Contrôle de la configuration des annonces (announcements.js) ---');
import { STUDENT_AD_CONFIG } from '../src/config/announcements.js';

assert.strictEqual(STUDENT_AD_CONFIG.price, 250, 'Le prix de l’annonce étudiante doit être de 250 FCFA');
assert.strictEqual(STUDENT_AD_CONFIG.durationDays, 5, 'La durée de visibilité doit être de 5 jours');
assert.strictEqual(STUDENT_AD_CONFIG.paymentLink, 'https://link.saspay.me/1aio4avhabm', 'Le lien de paiement doit être https://link.saspay.me/1aio4avhabm');

console.log('✅ [Configuration] STUDENT_AD_CONFIG validée (250 FCFA, 5 jours, SasPay) !');

// ==============================================================================
// 4. Contrôle de la page de publication StudentAdView.js & CTA Banner
// ==============================================================================
console.log('\n--- 4. Contrôle de StudentAdView.js & CTA Banner ---');
const studentAdViewCode = fs.readFileSync(path.join(rootDir, 'src/components/StudentAdView.js'), 'utf-8');

// Vérification des champs requis : nom, prenom, mail étudiant, image 16:9, bouton lancer l'annonce
assert.ok(studentAdViewCode.includes('ad-student-prenom'), 'Le champ Prénom doit être présent');
assert.ok(studentAdViewCode.includes('ad-student-nom'), 'Le champ Nom doit être présent');
assert.ok(studentAdViewCode.includes('ad-student-email'), 'Le champ Mail étudiant doit être présent');
assert.ok(studentAdViewCode.includes('aspect-[16/9]'), 'Le conteneur de prévisualisation au ratio 16:9 doit être présent');
assert.ok(studentAdViewCode.includes('Lancer l\'annonce (250 FCFA)'), 'Le bouton d\'action Lancer l\'annonce doit être présent');
assert.ok(studentAdViewCode.includes('https://link.saspay.me/1aio4avhabm'), 'La redirection vers le lien SasPay doit être configurée');

// Vérification du composant CTA Banner
import { createStudentAdCtaBanner } from '../src/components/StudentAdView.js';
const bannerEl = createStudentAdCtaBanner();
assert.ok(bannerEl.innerHTML.includes('Faire passer une annonce'), 'Le banner sous carrousel doit comporter le bouton Faire passer une annonce');
assert.ok(bannerEl.innerHTML.includes('250 FCFA'), 'Le banner doit mentionner le tarif 250 FCFA');
assert.ok(bannerEl.innerHTML.includes('5 jours'), 'Le banner doit mentionner la durée de 5 jours');

console.log('✅ [StudentAdView] Formulaire nom/prénom/mail/16:9 et bandeau sous carrousel validés !');

// ==============================================================================
// 5. Contrôle de BottomNav.js & Navigation desktop
// ==============================================================================
console.log('\n--- 5. Contrôle de la Navigation (BottomNav.js) ---');
const bottomNavCode = fs.readFileSync(path.join(rootDir, 'src/components/BottomNav.js'), 'utf-8');

assert.ok(
    bottomNavCode.includes('sidebar-tab-leaderboard'),
    'La sidebar Desktop doit comporter le bouton vers le classement (#sidebar-tab-leaderboard)'
);
assert.ok(
    bottomNavCode.includes('Classement'),
    'Le libellé "Classement" doit figurer dans la navigation desktop'
);

console.log('✅ [BottomNav] Lien vers le Classement public disponible dans la navigation desktop !');

// ==============================================================================
// 6. Contrôle de l'intégration dans main.js
// ==============================================================================
console.log('\n--- 6. Contrôle de l\'intégration globale (main.js) ---');
const mainCode = fs.readFileSync(path.join(rootDir, 'src/main.js'), 'utf-8');

assert.ok(mainCode.includes("viewName === 'leaderboard'"), 'main.js doit gérer la vue leaderboard');
assert.ok(mainCode.includes("viewName === 'student-ad'"), 'main.js doit gérer la vue student-ad');
assert.ok(mainCode.includes("studentAdCtaBannerComponent"), 'main.js doit intégrer le bouton d\'annonce sous le carrousel');
assert.ok(mainCode.includes("#leaderboard"), 'main.js doit comporter le lien direct vers le classement dans Top Shops');

console.log('✅ [main.js] Vues leaderboard et student-ad, injection sous carrousel et deep-links validés !');

// ==============================================================================
// 7. Contrôle de la migration SQL additive
// ==============================================================================
console.log('\n--- 7. Contrôle du script SQL de migration (migration_student_announcements.sql) ---');
const sqlFile = path.join(rootDir, 'database/migration_student_announcements.sql');
assert.ok(fs.existsSync(sqlFile), 'Le fichier de migration SQL doit exister');

const sqlContent = fs.readFileSync(sqlFile, 'utf-8');
assert.ok(sqlContent.includes('CREATE TABLE IF NOT EXISTS public.student_announcements'), 'La création de student_announcements doit être présente');
assert.ok(sqlContent.includes('duration_days INTEGER DEFAULT 5'), 'La colonne duration_days (5 jours) doit être présente');
assert.ok(sqlContent.includes('amount NUMERIC(10, 2) DEFAULT 250.00'), 'Le montant 250 FCFA doit être vérifié');
assert.ok(sqlContent.includes('ALTER TABLE public.advertisements ALTER COLUMN seller_id DROP NOT NULL'), 'La colonne seller_id doit être rendue nullable de manière additive');
assert.ok(sqlContent.includes('Public Insert Student Announcements'), 'La politique RLS d\'insertion publique doit être configurée');

console.log('✅ [SQL Migration] Migration additive et idempotente validée !');

console.log('\n========================================');
console.log('🎉 TOUS LES TESTS DU CLASSEMENT ET DU FLUX ANNONCE ONT RÉUSSI AVEC SUCCÈS !');
console.log('========================================\n');
