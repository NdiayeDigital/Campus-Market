# Plan d'Implémentation : Approbation des Vendeurs et Respect Strict des Limites d'Abonnement

> **Pour les agents d'exécution :** SOUS-COMPÉTENCE REQUISE : Utiliser `superpowers:subagent-driven-development` ou `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les étapes utilisent la syntaxe `- [ ]` pour le suivi.

**Goal:** Garantir que toute candidature vendeur parvient immédiatement au SuperAdmin pour approbation, et verrouiller strictement le nombre d'articles publiables selon la formule choisie (Pack Starter = 5 max, Pack Pro = 10 max).

**Architecture:** Mettre à niveau le schéma de base de données avec des colonnes dédiées (`shop_name`, `shop_category`, `subscription_plan`, `max_products`, `email`), sécuriser l'insertion des candidatures avec des politiques RLS permissives pour le rôle `vendeur_pending`, enrichir le tableau de bord SuperAdmin avec les détails de la formule souscrite, et instaurer une barrière stricte anti-dépassement à la fois visuelle (`ProductManager.js`) et applicative (`createProduct`).

**Tech Stack:** JavaScript (ES Modules), Supabase Auth & PostgreSQL Database, Tailwind CSS, Playwright.

**Spec:** Spécifications Campus Market UIDT relatives à l'adhésion des marchands et aux formules d'abonnement Starter (5 articles à 1 500 FCFA/mois) et Pro (10 articles à 2 500 FCFA/mois).

## Global Constraints

- Respect strict des limites d'articles : Pack Starter = 5 max, Pack Pro = 10 max.
- Seul le SuperAdmin a le pouvoir d'approuver (`vendeur_pending` -> `vendeur`) ou de rejeter une candidature.
- L'adresse email des marchands doit obligatoirement être institutionnelle (`@univ-thies.sn`).
- Résilience absolue : une candidature vendeur ne doit jamais disparaître ou être bloquée silencieusement par RLS ou par le taux limite d'emails de Supabase.
- Zéro régression sur les fonctionnalités existantes (partage catalogue/produit, modale d'édition, navigation mobile/desktop).

## Review Focus

1. **Candidat vendeur sans confirmation d'email active :** la candidature doit quand même être enregistrée dans `profiles` sous `vendeur_pending` et être visible instantanément par le SuperAdmin.
2. **Tentative d'ajout du 6ème produit avec Pack Starter :** le bouton d'ajout doit être bloqué dans l'UI avec une jauge `5 / 5 produits`, et la méthode `createProduct` doit lever une exception explicite si appelée directement.
3. **Mise à niveau Pack Pro :** lorsqu'un vendeur est en Pack Pro ou qu'un admin ajuste son forfait, le quota passe automatiquement à 10 produits.
4. **Approbation SuperAdmin :** lors du clic sur "Approuver", le marchand passe en `vendeur`, sa limite de produits est conservée, et il accède immédiatement à son back-office pour ajouter ses produits dans la limite de son pack.
5. **Rejet de candidature :** lors du clic sur "Rejeter", le statut repasse en `acheteur` et les éventuels privilèges marchands sont révoqués.

---

### Task 1: Migration SQL & Schéma Base de Données

**Files:**
- Create: `database/migration_approbation_vendeurs_et_abonnements.sql`
- Modify: `database/schema_final.sql:16-26, 216-258, 273-312`

**Interfaces:**
- Consumes: Tables `profiles` et `auth.users`.
- Produces: Nouvelles colonnes `shop_name TEXT`, `shop_category TEXT`, `subscription_plan TEXT DEFAULT 'starter'`, `max_products INTEGER DEFAULT 5`, `email TEXT` sur `profiles`. Nouvelle politique RLS permettant aux nouveaux inscrits d'insérer leur profil `vendeur_pending`. Trigger `handle_new_user` enrichi pour préserver la formule choisie.

- [ ] **Step 1: Écrire le script SQL de migration**

Créer `database/migration_approbation_vendeurs_et_abonnements.sql` contenant :
- L'ajout sécurisé (`ADD COLUMN IF NOT EXISTS`) des champs `shop_name`, `shop_category`, `subscription_plan`, `max_products`, `email` sur `public.profiles`.
- La mise à niveau de la politique RLS `L'utilisateur peut créer son profil` pour permettre l'insertion de lignes avec `role = 'vendeur_pending'`.
- La mise à jour de la fonction trigger `handle_new_user()` pour extraire `subscription_plan`, `max_products`, `shop_name` des métadonnées `raw_user_meta_data`.

- [ ] **Step 2: Mettre à jour `database/schema_final.sql`**

Synchroniser `database/schema_final.sql` avec ces définitions pour que la documentation globale de la base de données reste à jour et cohérente.

- [ ] **Step 3: Vérification statique de la syntaxe SQL**

Vérifier la validité syntaxique du script SQL via node/psql ou analyse statique.

---

### Task 2: Service d'Inscription Vendeur & Persistance de la Formule

**Files:**
- Modify: `src/services/seller-service.js:25-96, 146-203`
- Modify: `src/components/seller/SellerAuthModal.js:480-504`

**Interfaces:**
- Consumes: Données saisies dans `SellerAuthModal` (`prenom`, `nom`, `email`, `telephone`, `shopName`, `category`, `password`, `plan`).
- Produces: `registerSeller(data)` avec enregistrement de `subscription_plan` et `max_products` (5 ou 10), mise à jour immédiate du profil `vendeur_pending`, et synchronisation avec cache local de repli `campus_market_pending_sellers_cache`.

- [ ] **Step 1: Mettre à jour `registerSeller` dans `src/services/seller-service.js`**

- Ajouter le paramètre `plan = 'starter'` dans la signature de `registerSeller`.
- Définir `maxProducts = plan === 'pro' ? 10 : 5`.
- Inclure `subscription_plan: plan`, `max_products: maxProducts`, `shop_name: shopName`, `shop_category: category` dans les métadonnées de `supabase.auth.signUp()`.
- Construire le payload de profil complet avec ces informations :
  ```javascript
  const profilePayload = {
      id: user.id,
      prenom,
      nom,
      telephone,
      email: email.trim().toLowerCase(),
      shop_name: shopName || `${prenom} Shop`,
      shop_category: category || 'autres',
      subscription_plan: plan,
      max_products: maxProducts,
      role: 'vendeur_pending',
      is_open: true,
  };
  ```
- Gérer le cas où les nouvelles colonnes ne sont pas encore présentes en DB (fallback gracieux sans crash).
- Enregistrer la candidature dans `campus_market_pending_sellers_cache` pour garantir que même en cas de délai réseau ou de RLS stricte, l'administrateur reçoive la demande.

- [ ] **Step 2: Mettre à jour `getCurrentSeller` dans `src/services/seller-service.js`**

S'assurer que `getCurrentSeller` retourne `subscription_plan` et `max_products` dans le profil, avec valeur par défaut `starter` et `5`.

- [ ] **Step 3: Mettre à jour l'appel dans `src/components/seller/SellerAuthModal.js`**

Vérifier que `SellerAuthModal.js` transmet bien `plan: selectedPlan` lors de la soumission du formulaire d'inscription et affiche un récapitulatif clair sur l'écran d'attente (nom de boutique + formule choisie).

---

### Task 3: Tableau de Bord SuperAdmin : Réception & Supervision des Candidatures

**Files:**
- Modify: `src/services/admin-service.js:127-142, 237-279`
- Modify: `src/components/admin/SuperAdminDashboard.js:1065-1115, 1130-1160`

**Interfaces:**
- Consumes: Profils avec `role = 'vendeur_pending'` et cache de candidatures.
- Produces: Liste exhaustive des candidatures en attente avec badge de formule (`Pack Starter` 5 prods vs `Pack Pro` 10 prods), nom de boutique, téléphone, date. Boutons d'action "Approuver" et "Rejeter".

- [ ] **Step 1: Enrichir `fetchPendingSellers` dans `src/services/admin-service.js`**

- Récupérer les profils `role = 'vendeur_pending'`.
- Fusionner avec les candidatures enregistrées dans le cache partagé `campus_market_pending_sellers_cache` (déduplication par ID ou email).
- Retourner la liste ordonnée par date de création décroissante.

- [ ] **Step 2: Mettre à jour `approveSeller` et `rejectSeller` dans `src/services/admin-service.js`**

- Dans `approveSeller(sellerId)` : passer le rôle à `'vendeur'`, s'assurer que `is_open = true`, et nettoyer le cache des demandes en attente pour cet ID.
- Dans `rejectSeller(sellerId)` : passer le rôle à `'acheteur'`, et nettoyer le cache des demandes en attente.

- [ ] **Step 3: Mettre à jour le rendu des candidatures dans `SuperAdminDashboard.js`**

Dans `renderPendingSellersList` :
- Afficher le nom complet du candidat et son email.
- Afficher le nom de la boutique (`s.shop_name`) et sa catégorie (`s.shop_category`).
- Afficher un badge distinctif pour la formule d'abonnement :
  - `Pack Starter (1 500 F/mois • 5 articles)` (badge bleu/indigo)
  - `Pack Pro (2 500 F/mois • 10 articles)` (badge or/ambre avec icône couronne)
- Afficher le numéro de téléphone et la date de soumission.
- Boutons "Approuver" et "Rejeter" fonctionnels avec rechargement instantané.

---

### Task 4: Verrouillage Strict des Limites de Produits selon l'Abonnement

**Files:**
- Modify: `src/services/product-management.js:26-106`
- Modify: `src/components/seller/ProductManager.js:73-138, 161-260, 480-530`
- Modify: `src/components/seller/SellerDashboard.js:932-943`

**Interfaces:**
- Consumes: `sellerId`, formule d'abonnement (`subscription_plan`), nombre actuel de produits du vendeur.
- Produces: Jauge d'utilisation du quota (`X / 5` ou `X / 10`), désactivation du bouton d'ajout lorsque le quota est atteint, et blocage d'insertion au niveau de `createProduct`.

- [ ] **Step 1: Blocage applicatif strict dans `createProduct` (`src/services/product-management.js`)**

- Récupérer le nombre de produits actuels du vendeur :
  `SELECT count(*) FROM products WHERE seller_id = activeSellerId`.
- Récupérer le profil du vendeur pour déterminer sa limite autorisée :
  - Si profil administrateur (`superadmin`) : aucune restriction.
  - Si `subscription_plan === 'pro'` ou `max_products === 10` : limite = 10.
  - Sinon : limite = 5 (Pack Starter).
- Si `currentCount >= maxAllowed` :
  Lever immédiatement une erreur :
  `"Limite de votre formule atteinte (X/X produits). Mettez à niveau votre abonnement vers le Pack Pro pour publier plus d'articles."`

- [ ] **Step 2: Jauge visuelle et contrôle UI dans `ProductManager.js`**

- Calculer le quota : `currentCount = products.length`, `maxAllowed = sellerProfile.max_products || (sellerProfile.subscription_plan === 'pro' ? 10 : 5)`.
- Afficher une pilule d'état du quota dans la barre de navigation du catalogue :
  `Pack Starter : 3 / 5 produits (60%)` ou `Pack Pro : 8 / 10 produits (80%)`.
- Si `currentCount >= maxAllowed` :
  - Colorer la jauge en rouge/ambre (`Quota atteint (5/5)`).
  - Remplacer le bouton "Ajouter un produit" par un bouton grisé avec mention `Limite atteinte (5/5 produits)` et infobulle d'aide.
  - Si l'onglet "add" est quand même actif, afficher un bandeau d'alerte bien visible bloquant la soumission du formulaire :
    `"Vous avez atteint la limite de 5 produits autorisés par votre Pack Starter. Pour ajouter d'autres articles, supprimez un produit existant ou passez au Pack Pro (10 produits)."`
  - Désactiver le bouton de soumission `btn-add-product-submit`.

- [ ] **Step 3: Synchronisation des données dans `SellerDashboard.js`**

Passer l'objet `sellerProfile` ou les informations `subscription_plan` et `max_products` à `createProductManager`.

---

### Task 5: Tests Automatisés E2E & Vérification Complète

**Files:**
- Create: `tests/test-seller-approval-and-limits.js`
- Test: Playwright E2E sur Chrome en conditions réelles

**Interfaces:**
- Teste l'intégralité du cycle de vie :
  1. Inscription d'un nouveau vendeur avec Pack Starter (5 max) et nom de boutique.
  2. Vérification que la demande apparaît immédiatement dans le tableau de bord SuperAdmin.
  3. Approbation de la candidature par le SuperAdmin.
  4. Connexion du nouveau vendeur et publication de 5 produits successifs.
  5. Vérification du blocage au 6ème produit (jauge pleine, bouton désactivé, erreur de soumission).
  6. Vérification de la conservation des limites et du fonctionnement du Pack Pro (10 max).

- [ ] **Step 1: Écrire le script de test Playwright `tests/test-seller-approval-and-limits.js`**
- [ ] **Step 2: Exécuter le test automatisé et vérifier que toutes les étapes passent à 100%**
- [ ] **Step 3: Générer les captures d'écran de validation et le rapport de walkthrough**

---
