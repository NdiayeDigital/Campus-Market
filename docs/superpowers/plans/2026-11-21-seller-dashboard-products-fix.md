# Plan d'Implémentation : Résolution de l'Affichage des Produits dans le Dashboard Vendeur

> **Pour les agents / exécutants :** SOUS-COMPÉTENCE REQUISE : Utiliser `superpowers:executing-plans` pour exécuter ce plan tâche par tâche. Les étapes utilisent la syntaxe de case à cocher (`- [ ]`).

**Objectif :** Permettre à tout vendeur (y compris les comptes orphelins ou avec profil désynchronisé) d'accéder sans blocage à son espace marchand et de voir immédiatement ses produits tant sur l'accueil du Dashboard que dans l'onglet "Mes Articles".

**Architecture :**
1. **Niveau Base de Données (Supabase / PostgreSQL)** :
   - Migration additive idempotente pour insérer/restaurer automatiquement les profils manquants pour tout compte `auth.users` ayant des produits dans la table `products` (notamment le compte orphelin `03b1656d-4156-4674-a4c6-6392fe330c56`).
   - Assouplir de façon sécurisée la politique RLS `L'utilisateur peut créer son profil` sur `public.profiles` pour autoriser `role = 'vendeur'` ou créer un profil par défaut si l'utilisateur est authentifié (`auth.uid() = id`).
   - Réactiver les produits marqués `masqué_quota` pour les vendeurs actifs.
2. **Niveau Service (`src/services/seller-service.js` & `src/services/product-management.js`)** :
   - Remplacer `.single()` par `.maybeSingle()` dans `getSellerDashboardData(sellerId)` avec génération d'un profil par défaut sécurisé en mémoire pour éviter tout crash si un profil est absent.
   - Dans `getCurrentSeller()`, si l'utilisateur est authentifié dans Supabase Auth et possède des produits dans `products`, auto-créer ou initialiser son profil vendeur en base/mémoire au lieu de le renvoyer vers la page d'accueil avec déconnexion.
3. **Niveau Interface Utilisateur (`src/components/seller/SellerDashboard.js`)** :
   - Ajouter une section dédiée **"Mes Articles Récents"** sur l'onglet d'accueil du Dashboard (`renderDashboardHomeTab`), en miroir de la section "Commandes récentes", avec bouton d'action rapide vers le catalogue complet "Mes Articles" (`activeSubTab = 'products'`).
   - Assurer que le compteur d'articles sur les badges et les cartes Bento reflète toujours fidèlement le total de produits réels.

**Tech Stack :** JavaScript (ES Modules, Vanilla JS, Tailwind CSS), Supabase (PostgreSQL, RLS, Auth), Vite.

---

## Global Constraints

- **Zéro Secret en Dur** : Aucune clé privée (`VAPID_PRIVATE_KEY`, service role keys) dans le code source.
- **Préservation de la Production** : Migrations SQL strictement additives et rétrocompatibles sans suppression destructrice de colonnes ni de tables.
- **Immunité SuperAdmin** : Préservation des règles de gouvernance SuperAdmin.
- **Tests & Build Verts** : Exécution de la suite de tests (`npm test`) et du build (`npm run build`) sans régression.

---

## Review Focus

1. **Cas du vendeur sans profil `public.profiles`** : Doit pouvoir charger son tableau de bord sans exception `PGRST116: The result contains 0 rows`.
2. **Cas du vendeur sur l'onglet par défaut `dashboard`** : Doit voir ses produits immédiatement dans un aperçu dédié avec photos, prix et stock sans devoir chercher le sous-onglet.
3. **Cas des produits marqués `masqué_quota`** : Doivent être réactivés et comptabilisés dans le catalogue vendeur.
4. **Cas de session expirée ou visiteur anonyme** : `getCurrentSeller()` doit renvoyer `null` proprement sans erreur console 400.
5. **Rétrocompatibilité mobile et desktop** : La nouvelle section d'articles sur le dashboard doit être 100% responsive et fluide (Tailwind CSS).

---

## Tâches d'Exécution

### Tâche 1 : Migration SQL pour Profils Orphelins et Politique RLS

**Fichiers :**
- Créer : `database/migration_fix_orphan_seller_profiles.sql`

**Interfaces :**
- Produit : Script SQL idempotent à exécuter dans le SQL Editor de Supabase pour réparer les profils vendeurs orphelins (dont `03b1656d-4156-4674-a4c6-6392fe330c56`) et adapter la politique RLS d'insertion de profil.

- [ ] **Étape 1 : Rédiger le script SQL idempotent**
  - Insérer les profils manquants depuis `auth.users` pour tous les `seller_id` présents dans `products` :
    ```sql
    INSERT INTO public.profiles (id, prenom, nom, email, role, subscription_plan, max_products, is_open)
    SELECT 
        u.id,
        COALESCE(u.raw_user_meta_data->>'prenom', 'Vendeur'),
        COALESCE(u.raw_user_meta_data->>'nom', 'UIDT'),
        u.email,
        'vendeur',
        COALESCE(u.raw_user_meta_data->>'subscription_plan', 'decouverte'),
        10,
        true
    FROM auth.users u
    WHERE u.id IN (SELECT DISTINCT seller_id FROM public.products WHERE seller_id IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
    ON CONFLICT (id) DO NOTHING;
    ```
  - Mettre à jour la politique RLS `L'utilisateur peut créer son profil` pour permettre à un utilisateur connecté de créer son profil avec le rôle `vendeur` si validé ou pending :
    ```sql
    DROP POLICY IF EXISTS "L'utilisateur peut créer son profil" ON public.profiles;
    CREATE POLICY "L'utilisateur peut créer son profil" 
    ON public.profiles FOR INSERT 
    WITH CHECK (
        auth.uid() = id AND role IN ('acheteur', 'vendeur_pending', 'vendeur')
    );
    ```
  - Réactiver les produits du vendeur orphelin passés en `masqué_quota`.

- [ ] **Étape 2 : Vérification syntaxique et idempotence du script SQL**

---

### Tâche 2 : Sécurisation et Résilience dans `src/services/seller-service.js`

**Fichiers :**
- Modifier : `src/services/seller-service.js`

**Interfaces :**
- Consomme : Supabase PostgREST client
- Produit : `getSellerDashboardData(sellerId)` résilient sans crash `.single()`, `getCurrentSeller()` avec auto-récupération pour les vendeurs ayant des produits.

- [ ] **Étape 1 : Sécuriser `getSellerDashboardData(sellerId)`**
  - Remplacer `.single()` par `.maybeSingle()` sur la requête `profiles`.
  - Si `profile` est `null`, créer un objet de profil virtuel par défaut `{ id: sellerId, role: 'vendeur', prenom: 'Vendeur', nom: 'UIDT', is_open: true, max_products: 10 }` afin que le tableau de bord continue de fonctionner sans lever d'exception.
  - Récupérer également la liste des 5 derniers produits du vendeur avec leurs photos, prix, titre et stock pour alimenter l'aperçu du Dashboard.

- [ ] **Étape 2 : Sécuriser `getCurrentSeller()`**
  - Si `profile` est `null` mais que `session.user` est authentifié et possède des produits dans `products`, créer ou auto-compléter le profil avec `role: 'vendeur'` pour ne pas bloquer l'accès à son dashboard.

---

### Tâche 3 : Aperçu des Articles sur le Tableau de Bord Vendeur (`src/components/seller/SellerDashboard.js`)

**Fichiers :**
- Modifier : `src/components/seller/SellerDashboard.js`

**Interfaces :**
- Consomme : `dashboardData.recentProducts` ou requête des produits récents
- Produit : Nouveau composant/section UI `Aperçu de mes articles` sur `renderDashboardHomeTab`.

- [ ] **Étape 1 : Ajouter les données des produits récents dans `getSellerDashboardData` et `SellerDashboard.js`**
  - Charger les 4-6 articles les plus récents du vendeur dans les données du dashboard (`recentProducts`).

- [ ] **Étape 2 : Intégrer la section UI dans `renderDashboardHomeTab`**
  - Afficher une carte élégante reprenant le style de "Commandes récentes" :
    - En-tête : Titre "Mes Articles Récents", badge du nombre d'articles en ligne, bouton rapide "Voir tout les articles" (`activeSubTab = 'products'`) et bouton "Ajouter un article" (`activeSubTab = 'add-product'`).
    - Grille d'articles compacte avec miniature, nom, prix en FCFA, badge de stock (En stock / Rupture / Pause), et bouton rapide d'édition.
    - État vide bienveillant avec incitation à publier si le catalogue est vide.

- [ ] **Étape 3 : Lier les événements de clic**
  - Les clics sur un article ou sur "Voir tout" basculent automatiquement vers l'onglet "Mes Articles" (`switchSubTab('products')`).

---

### Tâche 4 : Tests Automatisés & Vérification Complète

**Fichiers :**
- Créer : `tests/test-seller-dashboard-products.js`
- Exécuter : `npm test` & `npm run build`

**Interfaces :**
- Produit : Suite de tests automatisés validant :
  1. Résilience de `getSellerDashboardData` avec un `sellerId` sans profil en base (pas de crash, KPI valides).
  2. Présence et intégrité de la liste des produits récents retournée par le service.
  3. Comportement correct de `getCurrentSeller` pour un utilisateur sans profil distant.
  4. Réussite du build de production Vite.

- [ ] **Étape 1 : Rédiger le test unitaire / d'intégration**
- [ ] **Étape 2 : Exécuter la suite complète de tests (`npm test`)**
- [ ] **Étape 3 : Exécuter le build Vite (`npm run build`)**

---

### Tâche 5 : Documentation & Compte-rendu (`walkthrough.md`)

- [ ] **Étape 1 : Rédiger le walkthrough détaillé avec explications pédagogiques pour l'équipe étudiante**
