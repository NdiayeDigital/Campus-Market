# 🎓 Campus Market - La Marketplace des Étudiants de l'UIDT

[![Status: MVP Stable](https://img.shields.io/badge/Status-Stable%20MVP-success.svg)](https://github.com/)
[![Built with Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E.svg)](https://supabase.com)
[![Frontend Vanilla TS/JS](https://img.shields.io/badge/Frontend-Vanilla%20TS%20%2F%20JS-F7DF1E.svg)](https://developer.mozilla.org/)

**Campus Market** est une application web (Single Page Application) dédiée à la communauté universitaire de l'**Université Iba Der Thiam (UIDT)** de Thiès. Elle facilite les échanges commerciaux et les services entre étudiants avec un système de livraison rapide de proximité (« Pavillon à Pavillon »).

---

## 🌟 Fonctionnalités Clés

### 🛍️ Pour les Acheteurs (Étudiants)
- **Catalogue dynamique & Recherche intelligente** : Recherche rapide avec tolérance aux fautes (distance de Levenshtein) et filtres par catégorie.
- **Panier & Commande fluide** : Persistance du panier (`localStorage`), formulaire pré-rempli (Pavillon, Chambre, Méthode de paiement : Wave, OM, Espèces).
- **Suivi de commande & Notations** : Suivi du statut des commandes en temps réel et attribution d'avis/étoiles aux vendeurs.
- **Support WhatsApp direct** : Contact en un clic avec le vendeur pour organiser la livraison.

### 💼 Pour les Vendeurs (Étudiants Commerçants)
- **Espace Vendeur dédié** : Gestion des articles (ajout, modification, suppression, disponibilité / rupture de stock).
- **Gestion des commandes entrantes** : Validation et mise à jour du statut des commandes (`En attente`, `En préparation`, `Livré`, `Annulé`).
- **Notification WhatsApp automatique** : Alerte pré-formatée prête à envoyer à l'acheteur dès l'expédition.

### 👑 Pour le Super-Administrateur
- **Tableau de bord de modération** : Statistiques globales d'activité (étudiants, vendeurs, commandes, chiffre d'affaires).
- **Validation des demandes de vendeur** : Validation ou refus sécurisé des candidatures d'étudiants souhaitant vendre.
- **Gestion des utilisateurs et signalements** : Contrôle qualité et conformité des offres sur le campus.

---

## 🏗️ Architecture Technique Modulaire (Vite + Tailwind CSS)

```
Campus-Market/
├── index.html              # Point d'entrée SPA & PWA
├── manifest.json           # Manifest PWA (thème #1D4ED8, icônes)
├── sw.js                   # Service Worker v19 (stratégie hybride Cache-First / Network-First)
├── tailwind.config.js      # Configuration Tailwind CSS (thème UIDT, Outfit & Inter)
├── src/
│   ├── index.css           # Directives Tailwind et polices Google Fonts
│   ├── main.js             # Orchestrateur SPA, routeur hash et gestion d'état
│   ├── services/
│   │   ├── supabase.js           # Client singleton Supabase avec fallback
│   │   ├── cart-store.js         # Gestionnaire réactif du panier (localStorage pub/sub)
│   │   ├── order-service.js      # Service commande invité & file hors ligne
│   │   ├── catalog-service.js    # Requêtes catalogue & recherche floue
│   │   ├── seller-service.js     # Authentification stricte vendeur & métriques
│   │   ├── product-management.js # Compression Canvas + upload Storage + CRUD
│   │   └── admin-service.js      # Supervision SuperAdmin UIDT (métriques réelles)
│   ├── components/
│   │   ├── Header.js             # Barre supérieure avec badge panier et recherche
│   │   ├── CategoryChips.js      # Sélecteur horizontal de 7 catégories campus
│   │   ├── ProductCard.js        # Carte produit mobile-first
│   │   ├── CartModal.js          # Tiroir panier réactif
│   │   ├── CheckoutModal.js      # Checkout 3 étapes sans obligation de compte
│   │   ├── OrderStatus.js        # Stepper de suivi de commande en 5 étapes
│   │   ├── seller/
│   │   │   ├── SellerAuthModal.js   # Modale inscription/connexion vendeur
│   │   │   ├── ProductManager.js    # Gestionnaire de catalogue marchand
│   │   │   └── SellerDashboard.js   # Dashboard vendeur temps réel (Realtime)
│   │   └── admin/
│   │       └── SuperAdminDashboard.js # Panneau d'administration centrale UIDT
│   └── utils/
│       ├── levenshtein.js        # Algorithme de distance d'édition
│       ├── image-compressor.js   # Compresseur d'images Canvas
│       ├── audio-alert.js        # Alertes sonores Web Audio API
│       └── security.js           # Échappement anti-XSS et validation institutionnelle
├── database/
│   └── schema_final.sql    # Schéma consolidé avec sécurité RLS et triggers
├── tests/
│   └── sanity-check.js     # Tests unitaires automatisés
├── .env.example            # Gabarit des variables d'environnement Supabase
└── package.json            # Configuration du projet & scripts Vite
```

- **Frontend** : JavaScript ES6+ modulaire, Tailwind CSS v3, Vite 5.
- **Backend & Données** : Supabase (PostgreSQL 15+, Authentification, Storage, Realtime, RLS).
- **PWA & Offline First** : Service Worker v19 (Bypass Supabase, Cache-First assets statiques, Network-First pages).

---

## 🚀 Démarrage Rapide

### 1. Prérequis
- [Node.js](https://nodejs.org/) (version 18 ou supérieure)
- npm (version 9+)

### 2. Configuration des secrets (.env)
Copiez le gabarit `.env.example` vers `.env` :
```bash
cp .env.example .env
```
Renseignez vos clés de projet Supabase :
```env
VITE_SUPABASE_URL=https://votre-projet.supabase.co
VITE_SUPABASE_ANON_KEY=votre-cle-anonyme
```

### 3. Installation & Lancement local
```bash
# Installer les dépendances
npm install

# Exécuter la suite de tests unitaires
npm test

# Démarrer le serveur de développement local
npm run dev

# Compiler pour la production
npm run build
```

---

## 🔒 Configuration & Base de Données

Le schéma complet de la base de données (tables `profiles`, `products`, `orders`, `reviews`, politiques RLS et triggers) se trouve dans :
👉 [`database/schema_final.sql`](database/schema_final.sql)

---

## 👥 Rôles & Comptes de Test pour Démonstration

| Rôle | Email de démo | Mot de passe | Accès & Fonctionnalités |
| :--- | :--- | :--- | :--- |
| **Super Admin** | `maamin.ndiaye@univ-thies.sn` | `Mouhamadou2005` | Dashboard SuperAdmin (`#view-superadmin`), validation vendeurs |
| **Vendeur** | *(Compte validé par l'admin)* | *(Défini à l'inscription)* | Espace Vendeur (`#view-admin`), gestion produits & commandes |
| **Étudiant / Acheteur** | *(Tout étudiant inscrit)* | *(Défini à l'inscription)* | Consultation, panier, passage de commande, avis |

---

## 📄 Licence
Ce projet est sous licence MIT - conçu pour valoriser l'écosystème étudiant de l'UIDT.
