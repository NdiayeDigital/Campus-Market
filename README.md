# 🛒 Campus Market UIDT — La Marketplace des Étudiants

[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL_15-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
[![PWA](https://img.shields.io/badge/PWA-Installable_Offline-FF9800?style=for-the-badge&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Tests](https://img.shields.io/badge/Tests-100%25_Passing-brightgreen?style=for-the-badge&logo=node.js&logoColor=white)]()

Application web progressive (PWA) e-commerce conçue sur mesure pour la communauté de l'**Université Iba Der Thiam de Thiès (UIDT)**. 
**Campus Market** révolutionne le commerce étudiant en introduisant la **livraison Pavillon-à-Pavillon**, un tunnel d'achat instantané sans compte obligatoire, un récepteur de commandes vendeur en temps réel avec alertes sonores et une console d'administration sécurisée.

---

## 📑 Sommaire
1. [🔐 Comptes de Test & Démo](#-comptes-de-test--démo)
2. [✨ Fonctionnalités Clés](#-fonctionnalités-clés)
   - [🎓 Espace Étudiant (Acheteur)](#-espace-étudiant-acheteur)
   - [🏪 Espace Vendeur (Marchand UIDT)](#-espace-vendeur-marchand-uidt)
   - [🛡️ Espace SuperAdmin (Console Secrète `/#admin`)](#-espace-superadmin-console-secrète-admin)
3. [🏛️ Architecture & Organisation du Code](#-architecture--organisation-du-code)
4. [🛡️ Sécurité & Base de Données (PostgreSQL / Supabase)](#-sécurité--base-de-données-postgresql--supabase)
5. [🚀 Installation & Démarrage Local](#-installation--démarrage-local)
6. [📦 Déploiement en Production (Vercel & Supabase)](#-déploiement-en-production-vercel--supabase)

---

## 🔐 Comptes de Test & Démo

| Rôle | Identifiant / Email | Mot de passe | Accès Direct | Fonctionnalités Clés |
| :--- | :--- | :--- | :--- | :--- |
| 🛡️ **SuperAdmin** | `admin@univ-thies.sn` | `AdminPasser123!` | [/#admin](file:///home/mass/Documents/docs/projets/Campus-Market/#admin) *(Route secrète)* | KPI financiers réels, modération produits, arbitrage de litiges, gestion des lieux de livraison |
| 🏪 **Vendeur Actif** | `fatou.sow@univ-thies.sn` | `Passer123!` | Menu Header ou `/#seller` | Alertes sonores temps réel, gestion & édition de produits, statut de commande |
| ⏳ **Vendeur En Attente** | `moussa.fall@univ-thies.sn` | `Passer123!` | `/#seller` | Compte candidat en attente d'approbation par le SuperAdmin |
| 🎓 **Acheteur Étudiant** | *Aucun compte requis* | *Accès direct* | `/` | Achat direct sans compte, suivi `#CMD-XXXX`, WhatsApp vendeur, avis 1-5 étoiles |

---

## ✨ Fonctionnalités Clés

### 🎓 Espace Étudiant (Acheteur)
* **Zéro Friction (Sans Compte Obligatoire) :** Tout étudiant peut passer commande immédiatement sans mot de passe ni vérification d'email : son prénom, nom, téléphone, pavillon et numéro de chambre suffisent.
* **Fiche Produit Immersive ([ProductDetailModal.js](file:///home/mass/Documents/docs/projets/Campus-Market/src/components/ProductDetailModal.js)) :** Vue détaillée au clic sur un article (photo grand format, description complète, disponibilité de la boutique marchande, sélecteur de quantité).
* **Recherche Prédictive Tolérante aux Fautes :** Algorithme de distance de **Levenshtein** intégré pour trouver les articles même en cas de fautes de frappe (*ex : "thieb" trouve "Thiéboudienne"*).
* **Tunnel de Commande en 3 Étapes ([CheckoutModal.js](file:///home/mass/Documents/docs/projets/Campus-Market/src/components/CheckoutModal.js)) :**
  - Sélection dynamique des pavillons et sites UIDT alimentée par l'administration.
  - Avertissement automatique en cas de panier multi-vendeurs.
  - Consignes claires pour les règlements **Wave**, **Orange Money** et **Espèces à la livraison**.
* **Suivi de Commande Réactif & Sécurisé ([OrderStatus.js](file:///home/mass/Documents/docs/projets/Campus-Market/src/components/OrderStatus.js)) :**
  - Recherche sécurisée par référence unique (`#CMD-XXXXXX`) et numéro de téléphone via RPC PostgreSQL.
  - Boutons d'action immédiate : **Appel direct** et **Discussion WhatsApp** pré-remplie avec le vrai numéro du vendeur.
  - **Annulation autonome :** L'étudiant peut annuler sa commande tant qu'elle est en attente (`pending`).
  - **Avis & Notation Vendeur :** Dès livraison effectuée (`delivered`), un formulaire 1 à 5 étoiles (⭐) avec commentaire permet d'évaluer le vendeur et d'alimenter le classement *Top Shops*.
* **Mode Hors-Ligne & PWA :** Les commandes passées en zone blanche ou sans réseau sont enregistrées localement et synchronisées automatiquement dès le retour de la connexion.

---

### 🏪 Espace Vendeur (Marchand UIDT)
* **Contrôle d'Identité Strict :** Inscription réservée aux membres de l'université disposant d'un email institutionnel officiel (`@univ-thies.sn`). Statut initial : `vendeur_pending`.
* **Réception de Commandes en Temps Réel :** Abonnement WebSocket (Supabase Realtime) déclenchant une **alerte audio** et une mise à jour instantanée du tableau de bord sans rechargement.
* **Cycle de Vie de Commande Réaliste :** Statuts `pending` ➔ `confirmed` ➔ `shipped` ➔ `delivered` (ou `cancelled`).
* **Gestion Complète du Catalogue ([ProductManager.js](file:///home/mass/Documents/docs/projets/Campus-Market/src/components/seller/ProductManager.js)) :**
  - **Ajout d'article :** Titre, prix en FCFA, stock, catégorie, description et photo.
  - **Compression d'image côté client :** Canvas HTML5 automatique pour réduire les photos haute résolution en JPEG ultra-léger (< 150 Ko) avant upload.
  - **Édition d'article :** Modal complet pour modifier le prix, réapprovisionner le stock, changer la photo ou ajuster la description en un instant.
* **Bascule de Disponibilité :** Interrupteur instantané pour indiquer aux acheteurs si la boutique est *Ouverte* ou *Fermée*.

---

### 🛡️ Espace SuperAdmin (Console Secrète `/#admin`)
* **Accès Discret Exclusif :** L'interface d'administration est **invisible sur le site public** (aucun bouton dans le header ni le footer). L'accès se fait exclusivement en saisissant l'ancre `/#admin` dans l'URL.
* **Nettoyage Automatique d'URL :** Dès la déconnexion ou fermeture du panneau, le hash `#admin` est automatiquement retiré de la barre d'adresse (`history.replaceState`).
* **Métriques Financières Réelles :**
  - Chiffre d'affaires réel calculé uniquement sur les commandes livrées (`delivered`).
  - Nombre réel de boutiques certifiées, candidatures en attente et total des transactions.
* **Validation & Modération des Marchands :** Approbation (`vendeur`), rejet ou suspension temporaire de boutiques.
* **Gestion Dynamique des Lieux de Livraison :**
  - Ajout direct de pavillons et sites d'enseignement (ex : *Site ENSA*, *IUT*, *Pavillon D*).
  - Activation / désactivation en un clic (pour fermer un pavillon pendant les congés).
  - Répercussion immédiate dans le sélecteur de commande des étudiants.
* **Arbitrage des Litiges de Commandes :** Modification forcée du statut de n'importe quelle commande en cas de conflit acheteur / marchand.
* **Modération du Catalogue :** Moteur de recherche et suppression définitive de produits inappropriés.

---

## 🏛️ Architecture & Organisation du Code

```mermaid
graph TD
    Client["Client Web / Mobile (PWA)"]
    SW["Service Worker (Cache Offline)"]
    Vite["Vite Build SPA (ES Modules)"]
    
    subgraph Services Métier
        CS["catalog-service.js"]
        OS["order-service.js"]
        SS["seller-service.js"]
        AS["admin-service.js"]
        Cart["cart-store.js (Pub/Sub)"]
    end
    
    subgraph Backend Supabase
        Auth["Supabase Auth (@univ-thies.sn)"]
        PG["PostgreSQL 15 (RLS Stricte)"]
        RPC["RPC track_order_secure"]
        RT["Realtime Channel (Commandes)"]
        Storage["Storage Buckets (product-images)"]
    end

    Client --> SW
    Client --> Vite
    Vite --> Services Métier
    Services Métier --> Auth
    Services Métier --> PG
    Services Métier --> RPC
    Services Métier --> RT
    Services Métier --> Storage
```

### 📁 Arborescence du Projet

```
Campus-Market/
├── database/
│   ├── schema_final.sql              # Schéma complet de référence PostgreSQL
│   ├── migration_production_v2.sql   # Migration de consolidation production
│   └── patch_production_final.sql    # Patch autonome des fonctions & lieux
├── public/
│   ├── manifest.json                 # Manifest PWA installable
│   └── sw.js                         # Service Worker de mise en cache offline
├── src/
│   ├── assets/                       # Logo et ressources graphiques optimisées
│   ├── components/
│   │   ├── admin/
│   │   │   └── SuperAdminDashboard.js# Panneau de contrôle central UIDT
│   │   ├── seller/
│   │   │   ├── ProductManager.js     # Ajout & édition d'articles marchand
│   │   │   ├── SellerAuthModal.js    # Inscription & connexion vendeur
│   │   │   └── SellerDashboard.js    # Récepteur de commandes en direct
│   │   ├── CartModal.js              # Panier d'achat interactif
│   │   ├── CategoryChips.js          # Filtres par catégorie
│   │   ├── CheckoutModal.js          # Tunnel de commande Pavillon-à-Pavillon
│   │   ├── Header.js                 # Navigation supérieure fixe & recherche
│   │   ├── OrderStatus.js            # Suivi en direct, contact vendeur & avis
│   │   ├── ProductCard.js            # Carte produit du catalogue
│   │   └── ProductDetailModal.js     # Fiche produit détaillée agrandie
│   ├── services/
│   │   ├── admin-service.js          # Opérations SuperAdmin, KPI & Lieux
│   │   ├── cart-store.js             # Gestion d'état du panier (LocalStorage)
│   │   ├── catalog-service.js        # Recherche fuzzy & produits actifs
│   │   ├── order-service.js          # Commandes, RPC sécurisé, avis & repli
│   │   ├── product-management.js     # CRUD produits & compression photo
│   │   ├── seller-service.js         # Profils marchands & session
│   │   └── supabase.js               # Client Supabase initialisé
│   ├── utils/
│   │   ├── image-compressor.js       # Compression d'image via Canvas
│   │   ├── levenshtein.js            # Algorithme de distance textuelle
│   │   └── security.js               # Sanitization XSS & validation email
│   ├── index.css                     # Styles Tailwind CSS personnalisés
│   └── main.js                       # Contrôleur d'application & routage hash
├── tests/
│   └── sanity-check.js               # Suite de tests unitaires automatisés
├── vercel.json                       # En-têtes HTTP anti-cache PWA & routing
└── package.json                      # Dépendances et scripts npm
```

---

## 🛡️ Sécurité & Base de Données (PostgreSQL / Supabase)

1. **Isolation Row Level Security (RLS) :**
   - La table `orders` est strictement protégée : aucune requête anonyme ne peut lire l'ensemble des commandes.
   - Les acheteurs sans compte consultent leur commande uniquement via la fonction RPC sécurisée :
     ```sql
     public.track_order_secure(p_reference TEXT, p_phone TEXT)
     ```
2. **Fonctions de Rôle `SECURITY DEFINER` :**
   - `public.get_current_user_role(user_id UUID)` et `public.is_super_admin(user_id UUID)` s'exécutent avec des privilèges sécurisés pour prévenir toute récursion RLS infinie sur la table `profiles`.
3. **Protection contre l'altération des prix :**
   - Le trigger `force_order_price` vérifie et applique le prix réel du catalogue lors de l'insertion pour empêcher toute manipulation du montant côté client.
4. **Politiques de Stockage d'Images :**
   - Bucket public `product-images` : lecture autorisée pour tous, téléversement strictement restreint aux profils `vendeur` et `superadmin`.

---

## 🚀 Installation & Démarrage Local

### Prérequis
* [Node.js](https://nodejs.org/) version 18 ou supérieure
* Un projet [Supabase](https://supabase.com/) configuré

### 1. Cloner le projet
```bash
git clone https://github.com/NdiayeDigital/Campus-Market.git
cd Campus-Market
```

### 2. Installer les dépendances
```bash
npm install
```

### 3. Configurer l'environnement (`.env`)
Créez un fichier `.env` à la racine :
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre_cle_anon_publique
```

### 4. Exécuter la suite de tests unitaires
```bash
npm test
```
*Vérifie la sécurité, la validation d'email institutionnel, la conformité des colonnes de commandes, l'édition de produits, la gestion des lieux et les fonctions d'administration.*

### 5. Lancer le serveur de développement
```bash
npm run dev
```
Ouvrez l'adresse indiquée par Vite (généralement `http://localhost:5173`).

---

## 📦 Déploiement en Production (Vercel & Supabase)

### 1. Base de données Supabase
Dans votre console Supabase, ouvrez le **SQL Editor** et exécutez successivement :
1. [`database/migration_production_v2.sql`](file:///home/mass/Documents/docs/projets/Campus-Market/database/migration_production_v2.sql) *(schéma initial, tables, triggers et RLS)*
2. [`database/patch_production_final.sql`](file:///home/mass/Documents/docs/projets/Campus-Market/database/patch_production_final.sql) *(fonctions SuperAdmin, table des lieux UIDT, payment_status)*

Dans **Storage**, assurez-vous que le bucket **`product-images`** existe et est configuré en **Public**.

### 2. Déploiement Vercel
Le projet est préconfiguré pour Vercel via [`vercel.json`](file:///home/mass/Documents/docs/projets/Campus-Market/vercel.json) :
1. Liez votre dépôt GitHub à un projet Vercel.
2. Ajoutez les variables d'environnement `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.
3. Déployez en poussant sur la branche principale :
   ```bash
   git push origin main
   ```

---

## 🤝 Contribution & Équipe

Projet développé avec passion pour la communauté universitaire de l'**Université Iba Der Thiam de Thiès (UIDT)**.

* **Support & Contact :** [WhatsApp Support](https://wa.me/221784799882)
* **Licence :** MIT
