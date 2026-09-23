# Plan d'implémentation - Modernisation des Dashboards (Vendeur & Admin), Ergonomie Mobile & Responsivité Globale

> **Pour agents & développeurs :** Ce plan détaille les étapes précises pour moderniser l'expérience mobile (Header & Footer), refondre les tableaux de bord Vendeur et SuperAdmin avec des principes UI/UX modernes (Bento grids, micro-interactions, responsive table-to-card) et garantir une fluidité totale sur tous les formats d'écrans.

**Objectif :** Résoudre les conflits d'ergonomie mobile (Footer redondant avec la BottomNav, bouton Espace Vendeur dans le Header), moderniser les dashboards Vendeur (`SellerDashboard.js`, `ProductManager.js`) et SuperAdmin (`SuperAdminDashboard.js`), et perfectionner la responsivité globale du site Campus Market.

**Architecture :** 
- Architecture Vanilla JS modulaire avec Tailwind CSS, Web Audio API, et Supabase Realtime.
- Déduplication de la navigation mobile : BottomNav devient le contrôleur primaire tactile sur mobile, tandis que le footer mobile s'allège en une carte support/copyright compacte.
- Header adaptatif : bouton Vendeur dynamique avec pill/avatar de boutique selon le statut d'authentification marchand.
- Dashboards réinventés en Bento Grid avec micro-interactions et transformation responsive Table -> Cartes empilées sur mobile.

**Tech Stack :** JavaScript ES Modules, Tailwind CSS 3, FontAwesome 6, Supabase JS v2, Web Audio API, Vite.

---

## Contraintes Globales

1. **Intégrité Supabase** : Respect strict du schéma de données (`orders` à 10 colonnes, `profiles`, `products`, `delivery_locations`).
2. **Accessibilité & Ergonomie Tactile** : Cibles tactiles minimum $\ge 44\times 44\text{px}$, contraste texte/fond conforme WCAG AA ($\ge 4.5:1$), support de `prefers-reduced-motion`.
3. **Zéro Régression** : Les 10 tests unitaires de la suite Jest/Vitest (`npm test`) et le build de production Vite (`npm run build`) doivent rester à 100% verts.
4. **Pas de défilement horizontal parasite** : Aucun élément ne doit dépasser de l'écran sur mobile ($320\text{px} - 430\text{px}$).

---

## Points d'Attention & Cas Limites (Review Focus)

1. **Écrans ultra-compacts (320px - 360px, ex. Galaxy Fold externe / iPhone SE)** : La ligne supérieure du Header (Logo + Espace Vendeur + Panier) ne doit pas déborder ou tronquer le logo.
2. **Double barre de navigation sur mobile** : Le footer ne doit pas présenter de liens redondants qui entrent en concurrence avec la `BottomNav` fixe en bas d'écran.
3. **Tableaux volumineux sur smartphone** : Les tableaux de suivi des commandes et des pavillons dans `SuperAdminDashboard.js` doivent se convertir automatiquement en cartes empilées sur les écrans $< 768\text{px}$.
4. **Synchronisation d'état Vendeur** : Lorsque le vendeur se connecte ou se déconnecte, le bouton/pill du Header et l'onglet de la `BottomNav` doivent refléter immédiatement son statut sans nécessiter de rechargement complet de la page.
5. **Gestion du clavier virtuel mobile dans les modals** : Les formulaires d'ajout/édition de produits et de commande doivent rester entièrement défilables avec `max-h-[90vh]` et `overflow-y-auto`.

---

## Tâches Détaillées

### Tâche 1 : Optimisation Mobile du Header & du Footer

**Fichiers :**
- Modifier : `src/components/Header.js`
- Modifier : `src/main.js`

**Interfaces :**
- `createHeader({ onSearch, onOpenCart, onOpenOrders, onOpenSeller, onLogoClick })` :
  - Expose une nouvelle méthode `headerEl.updateSellerState(sellerProfile)` permettant d'afficher l'identité de la boutique si connecté.
- Mobile Footer dans `src/main.js` :
  - Masque les boutons de navigation redondants sur `< sm`.
  - Affiche une carte compacte élégante avec bouton direct WhatsApp UIDT, statut de livraison pavillon et copyright.

- [ ] **Étape 1 : Mettre à jour `src/components/Header.js`**
  - Ajouter un bouton d'accès vendeur mobile compact à côté du panier (`min-h-[44px] min-w-[44px]`) avec icône de boutique et indicateur visuel.
  - Implémenter la méthode `updateSellerState(seller)` pour adapter le libellé du bouton desktop ("Espace Vendeur" ou "Boutique [Nom]") et afficher un badge vert en direct.
  - S'assurer que le champ de recherche et les boutons restent parfaitement calibrés sur les petits écrans ($320\text{px}$).

- [ ] **Étape 2 : Mettre à jour le Footer dans `src/main.js`**
  - Sur mobile (`< sm`), masquer les liens de navigation textuels (`Offres`, `Mes commandes`, `Espace Vendeur`) qui dupliquent la `BottomNav`.
  - Conserver un footer mobile aéré et compact :
    - Badge officiel "Campus Market • UIDT Thiès"
    - Bouton WhatsApp d'assistance rapide aux étudiants
    - Mention "Livraison Pavillon-à-Pavillon"
  - Conserver les liens complets sur grand écran (`sm:flex`).
  - Ajuster le padding inférieur (`pb-28 sm:pb-8`) pour un dégagement total par rapport à la barre de navigation flottante.

- [ ] **Étape 3 : Tester les interactions Header & Footer**
  - Vérifier sur écran mobile ($375\text{px}$) et desktop ($1200\text{px}$).
  - Vérifier l'absence de chevauchement avec la `BottomNav`.

---

### Tâche 2 : Modernisation du Dashboard Vendeur (`SellerDashboard.js`)

**Fichiers :**
- Modifier : `src/components/seller/SellerDashboard.js`

**Interfaces :**
- Conserve l'API existante : `createSellerDashboard({ seller, onBackToCatalog, onLogout, onShowToast })`.
- Utilise `audioAlert` et `playNotificationSound()` pour les bips sonores en temps réel.
- Maintient la souscription Supabase Realtime `postgres_changes`.

- [ ] **Étape 1 : Refonte du bandeau supérieur Vendeur & Bento Grid**
  - Créer un bandeau profil avec avatar marchand stylisé, badge "Vendeur Certifié UIDT", et interrupteur d'ouverture boutique doté d'un voyant animé (`animate-ping`).
  - Bouton son d'alerte Web Audio avec retour visuel d'état (bips actifs / muet).
  - Bouton rapide d'aperçu de la boutique étudiante.

- [ ] **Étape 2 : Cartes KPI modernes (Bento Grid)**
  - Carte 1 : Revenus cumulés (dégradé émeraude discret, devise FCFA en chiffres tabulaires).
  - Carte 2 : Commandes en attente (badge alerte orange/or si commandes non traitées).
  - Carte 3 : Articles en ligne (ratio stock actif / total avec icône de colis).

- [ ] **Étape 3 : Système de filtres de commandes & Cartes de commandes fluides**
  - Ajouter des filtres rapides par statut : *Toutes*, *À traiter (pending)*, *En cours (confirmed/processing/shipped)*, *Terminées (delivered)*.
  - Cartes de commandes optimisées pour mobile :
    - En-tête avec référence, heure et badge de statut coloré.
    - Informations de livraison : Nom client, numéro cliquable (`tel:`), pavillon/chambre, et bouton d'action directe WhatsApp avec message pré-rempli.
    - Boutons d'avancement d'état ergonomiques ($\ge 44\text{px}$) avec retours de chargement.

---

### Tâche 3 : Modernisation du Gestionnaire de Produits Vendeur (`ProductManager.js`)

**Fichiers :**
- Modifier : `src/components/seller/ProductManager.js`

**Interfaces :**
- Conserve l'API : `createProductManager({ sellerId, onProductChanged })`.
- Compression d'images JPEG intégrée et validation côté client.

- [ ] **Étape 1 : Amélioration de la liste des produits**
  - Cartes de produits avec image d'aperçu carrée arrondie, titre en gras, prix en FCFA bien lisible et badge de stock clair (*En stock* vert / *Rupture* rouge).
  - Bascule rapide de stock en 1 clic avec retour haptique/visuel instantané.
  - Boutons d'édition et de suppression sécurisés via `showConfirm`.

- [ ] **Étape 2 : Modals Ajout & Modification modernes**
  - Modal adaptatif : Bottom-sheet sur mobile ($< 640\text{px}$), boîte de dialogue centrée avec backdrop flou sur desktop.
  - Sélecteur d'image avec aperçu instantané, icône appareil photo, et indication de la compression automatique.
  - Champs de formulaire spacieux avec labels visibles, validation fluide, et états de focus avec l'accent `primary`.

---

### Tâche 4 : Modernisation & Redesign Responsive du Dashboard Admin (`SuperAdminDashboard.js`)

**Fichiers :**
- Modifier : `src/components/admin/SuperAdminDashboard.js`

**Interfaces :**
- Conserve l'API : `createSuperAdminDashboard({ onExit, onShowToast })`.
- 4 onglets : Marchands & Demandes, Modération Produits, Suivi Commandes, Lieux & Pavillons.

- [ ] **Étape 1 : Harmonisation de l'En-tête & Bento KPI Admin**
  - En-tête moderne aux couleurs de l'université avec bouclier SuperAdmin, informations de session de l'administrateur, bouton d'actualisation instantanée et bouton de déconnexion.
  - 4 cartes KPI Bento avec dégradés subtils, métriques en temps réel et badges "Action requise" si des candidatures sont en attente.

- [ ] **Étape 2 : Barre d'onglets responsive**
  - Onglets segmentés avec défilement horizontal sans coupure sur smartphone.
  - Badges de comptage dynamiques pour chaque section.

- [ ] **Étape 3 : Transformation responsive Table -> Cartes empilées sur mobile**
  - **Onglet Commandes** :
    - Sur Desktop ($\ge 768\text{px}$) : Tableau complet élégant avec survol et sélecteur de statut.
    - Sur Mobile ($< 768\text{px}$) : Cartes empilées affichant la référence, la date, le client, le pavillon, le montant en grand, le statut actuel et le menu de mise à jour rapide.
  - **Onglet Lieux & Pavillons** :
    - Sur Desktop : Tableau avec statut et bouton de suppression.
    - Sur Mobile : Cartes compactes avec interrupteur d'activation rapide en 1 tap et confirmation de suppression.
  - **Onglet Candidatures Vendeurs** :
    - Grille responsive de cartes de candidature avec coordonnées de l'étudiant, date, et boutons clairs "Approuver" / "Rejeter".

---

### Tâche 5 : Vérification Globale de Responsivité & Tests Automatisés

**Fichiers :**
- Exécution des tests : `tests/`
- Build : `npm run build`

- [ ] **Étape 1 : Exécuter la suite de tests automatisés**
  - Lancer `npm test` et s'assurer que tous les tests unitaires passent sans erreur.
- [ ] **Étape 2 : Compiler le projet avec Vite**
  - Lancer `npm run build` et valider qu'aucun warning bloquant ni erreur de syntaxe n'apparaît.
- [ ] **Étape 3 : Mettre à jour le walkthrough de validation**
  - Documenter les améliorations visuelles et fonctionnelles apportées.
