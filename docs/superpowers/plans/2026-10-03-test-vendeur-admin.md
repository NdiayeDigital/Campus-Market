# Plan d'Implémentation & Test des Interfaces Vendeur et SuperAdmin

> **Contexte & Identifiants cibles :**
> - **Compte Vendeur** : `fatou.sow@univ-thies.sn` | `Passer123!` (Fatou Sow - Marchande UIDT certifiée)
> - **Compte SuperAdmin** : `maamin.ndiaye@univ-thies.sn` | `Mouhamadou_2005` (MOUHAMADOU Ndiaye - SuperAdmin UIDT)

**Goal :** Concevoir et exécuter une suite de tests automatisés de bout en bout (E2E) et de validation visuelle sur les interfaces **Espace Vendeur** et **Portail SuperAdmin**, en vérifiant l'authentification réelle auprès de Supabase, la navigation sur l'ensemble des onglets et fonctionnalités clés, la réactivité multi-formats (Mobile & Desktop), l'absence d'erreurs console et de débordement horizontal.

**Architecture :**
- Serveur Vite déjà actif sur `http://localhost:5173`.
- Script automatisé Playwright `tests/test-seller-admin.js` qui connecte chaque rôle, pilote les interfaces réelles et capture les preuves visuelles dans `tests/screenshots/seller/` et `tests/screenshots/admin/`.
- Session interactive dans le navigateur Chrome de l'utilisateur pour validation en direct.

---

## 1. Description des Objectifs & Périmètre de Test

### A. Interface Vendeur (`SellerDashboard`)
1. **Authentification & Session** :
   - Saisie dans `SellerAuthModal` (`#seller-login-email`, `#seller-login-password`, `#btn-seller-login-submit`).
   - Vérification de la persistance de session dans `localStorage` (`campus_market_cached_seller`).
   - Accès immédiat au tableau de bord sans écran bloquant.
2. **Dashboard & Pilotage Marchand** :
   - Vérification des cartes KPI Bento : *Revenus réalisés (FCFA)*, *Commandes en cours*, *Articles en ligne*, *Disponibilité*.
   - Test de l'interrupteur rapide de boutique (`#hdr-btn-toggle-shop`) : bascule en 1 clic entre "Boutique Ouverte" et "En Pause".
   - Test des alertes sonores Web Audio (`#hdr-btn-toggle-audio`).
3. **Onglets Métier** :
   - **Commandes (`orders`)** : affichage des commandes étudiantes, filtrage par statut (*Toutes*, *En attente*, *En cours*, *Livrées*).
   - **Mes Articles (`products`)** : affichage des produits de Fatou Sow, disponibilité en ligne, options d'édition.
   - **Ajout de produit (`add-product`)** : formulaire ergonomique avec sélecteur de catégorie, prix FCFA, upload/URL d'image et **Live Preview dynamique** de la carte produit.
4. **Ergonomie Multi-Formats** :
   - **Mobile (390x844)** : validation de la barre inférieure vendeur (`bnav-seller-dashboard`, `bnav-seller-orders`, etc.).
   - **Desktop (1920x1080)** : validation des sous-onglets (`subtab-orders`, `subtab-products`, `subtab-add-product`).

---

### B. Interface SuperAdmin (`SuperAdminDashboard`)
1. **Authentification & Contrôle d'Accès** :
   - Accès via `/#admin`.
   - Formulaire `#superadmin-login-form` (`#admin-login-email`, `#admin-login-password`, `#btn-admin-submit`).
   - Validation stricte du rôle `superadmin` et chargement des métriques globales.
2. **Supervision Centrale & 6 Onglets Clés** :
   - **1. Vue d'ensemble (`overview`)** : Chiffres clés (Marchands actifs, En attente, Commandes globales, Revenus abonnements/commissions, Graphiques de tendances).
   - **2. Marchands (`sellers`)** : Tableau / Cartes des marchands inscrits, filtres (En attente, Actifs, Suspendus), boutons d'action (Approuver, Suspendre, Réactiver).
   - **3. Comptes & Rôles (`accounts`)** : Gestion des utilisateurs UIDT, recherche, modification de rôle.
   - **4. Produits (`products`)** : Modération du catalogue complet, suppression ou signalement.
   - **5. Commandes (`orders`)** : Traçabilité campus de toutes les commandes passées, filtres par statut et pavillon.
   - **6. Lieux de livraison (`locations`)** : Gestion dynamique des pavillons UIDT (Pavillon A1, A2, Jardin Social, ajout d'un nouveau lieu).
3. **Ergonomie Multi-Formats** :
   - **Mobile (390x844)** : navigation tactile, transformation dynamique Table $\rightarrow$ Cartes empilées.
   - **Desktop (1920x1080)** : Sidebar fixe de 64px/256px avec badges d'alerte en temps réel.

---

## 2. Proposed Changes & Implementation Steps

### [NEW] `tests/test-seller-admin.js`
Création du script de test automatisé Playwright dédié :
- Authentification avec les identifiants réels validés.
- Parcours complet du rôle **Vendeur** sur Desktop et Mobile avec captures.
- Parcours complet du rôle **SuperAdmin** sur Desktop et Mobile avec captures.
- Vérification des débordements et de l'intégrité de l'affichage.

---

## 3. Verification Plan

### Automated Tests
```bash
node tests/test-seller-admin.js
npm test
```

### Manual Verification
- Interaction directe dans le navigateur Chrome :
  - Espace Vendeur : [http://localhost:5173/#seller](http://localhost:5173/#seller)
  - Portail Admin : [http://localhost:5173/#admin](http://localhost:5173/#admin)
