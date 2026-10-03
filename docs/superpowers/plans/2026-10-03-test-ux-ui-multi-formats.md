# Plan d'Audit UX/UI Multi-Formats & Test Navigateur Campus Market

> **Règle d'exécution** : Ce plan détaille le démarrage du serveur, l'ouverture du navigateur utilisateur sur son environnement graphique, l'exécution d'une suite automatisée de tests visuels et fonctionnels sur tous les formats d'écran, et la production d'un rapport d'expérience utilisateur (UX/UI).

**Goal :** Lancer le serveur local, ouvrir le navigateur Chrome de l'utilisateur sur l'application, et exécuter un banc de test automatisé multi-formats (Mobile 375px/390px, Tablette 768px, Desktop 1280px/1920px) pour tester et auditer l'ergonomie, la réactivité, le design et les flux utilisateurs clés de Campus Market.

**Architecture :**
- Serveur Vite lancé sur `http://localhost:5173`.
- Ouverture interactive du navigateur utilisateur sur le bureau (`google-chrome http://localhost:5173`).
- Script de test et capture automatisé en Node.js utilisant le Chrome système (`/usr/bin/google-chrome`) via Playwright, sans téléchargement lourd.
- Audit méthodique de 8 parcours et 5 formats d'écran avec vérification des critères WCAG/Mobile-First (cibles tactiles $\ge 44\times 44\text{ px}$, absence de débordement horizontal, lisibilité et navigation au pouce).

**Tech Stack :** Vite 5, Tailwind CSS 3, JavaScript ES Modules, Playwright / Chrome Headless, Supabase Client.

---

## 1. Description des Objectifs

1. **Démarrage & Affichage Navigateur Réel** :
   - Démarrer l'application Vite en arrière-plan.
   - Ouvrir directement l'application dans le navigateur Google Chrome sous la session graphique de l'utilisateur (`DISPLAY=:0`).
2. **Audit UX/UI Multi-Formats** :
   - Tester l'affichage, l'alignement, le contraste, les typographies et les espacements sur 5 résolutions représentatives :
     - **Mobile Compact** : 375 × 667 px (iPhone SE)
     - **Mobile Standard** : 390 × 844 px (iPhone 14/15, Pixel)
     - **Tablette Portrait** : 768 × 1024 px (iPad)
     - **Ordinateur Portable** : 1280 × 800 px (MacBook / Laptop)
     - **Grand Écran Desktop** : 1920 × 1080 px (FHD Desktop)
3. **Évaluation de l'Expérience Utilisateur (UX)** :
   - **Zone du pouce & Ergonomie mobile** : validation de la `BottomNav`, du bouton d'action rapide d'ajout au panier, de la zone de recherche.
   - **Fluidité des transitions** : passage du catalogue aux commandes, à l'Espace Vendeur et à l'Administration (`/#admin`).
   - **Formulaires & Modales** : saisie des coordonnées de livraison (pavillon, chambre) et choix des modes de règlement (Wave / Espèces).
   - **Feedback visuel & micro-interactions** : toasts animés, badges dynamiques de panier, badges d'état de boutique.
4. **Vérifications Techniques Automatisées** :
   - Vérification de l'absence de scroll horizontal non intentionnel (`scrollWidth > clientWidth`).
   - Vérification des tailles minimales des boutons tactiles ($\ge 44\text{ px}$).
   - Détection des erreurs JavaScript console lors du rendu de chaque composant.
   - Génération d'un dossier de captures d'écran haute définition classées par format.

---

## 2. User Review Required

- L'ouverture du navigateur utilise Google Chrome installé sur votre système (`/usr/bin/google-chrome`) sur votre session graphique active (`DISPLAY=:0`).
- Le serveur de développement s'exécutera sur le port `5173`.
- La suite de test automatisée s'appuiera sur `playwright` pour piloter le navigateur Chrome existant sans téléchargement additionnel de navigateur.

---

## 3. Proposed Changes & Implementation Steps

### Étape 1 : Préparation de l'environnement de test et du lanceur
- Installer `playwright` en `devDependencies` (`npm install -D playwright`).
- Créer le script de test automatisé dédié [tests/ux-ui-audit.js](file:///home/mass/Documents/docs/projets/Campus-Market/tests/ux-ui-audit.js).

### Étape 2 : Lancement du serveur local et ouverture du navigateur de l'utilisateur
- Démarrer le serveur de développement Vite (`npm run dev`).
- Ouvrir l'application dans votre navigateur Chrome (`google-chrome http://localhost:5173`).

### Étape 3 : Exécution du banc de test automatisé multi-formats
- Exécuter la suite complète de navigation et de capture multi-formats.
- Tester les vues Accueil, Recherche/Filtre, Fiche Produit, Panier, Commande, Suivi, Vendeur et Admin sur les 5 résolutions cibles.

### Étape 4 : Analyse des résultats et audit ergonomique
- Extraire les métriques de mise en page, cibles tactiles, et console logs.
- Produire le rapport complet avec captures d'écran et recommandations.

---

## 4. Verification Plan

### Automated Tests
```bash
node tests/ux-ui-audit.js
npm test
npm run build
```

### Manual Verification
- Interaction directe dans le navigateur Chrome ouvert sur `http://localhost:5173`.
- Test des modales, ajout au panier, changement de vue et redimensionnement responsive.
