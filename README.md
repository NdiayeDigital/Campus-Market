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

## 🏗️ Architecture Technique

```
Campus-Market/
├── index.html              # Point d'entrée SPA (Single Page Application)
├── css/                    # Feuilles de styles CSS & thèmes
├── js/                     # Logique applicative découpée en modules
│   ├── supabase-config.js  # Configuration et initialisation du client Supabase
│   ├── api.js              # Requêtes API (Produits, Profils, Filtres)
│   ├── auth.js             # Gestion Auth (Inscription, Connexion, Rôles)
│   ├── cart.js             # Gestion Panier, Commandes et Avis
│   ├── admin.js            # Espace Vendeur & Tableau de bord SuperAdmin
│   └── ui.js               # Interactions UI, Toasts, Modales & Navigation
├── database/               # Scripts SQL & Schéma complet Supabase
│   └── schema_final.sql    # Schéma consolidé avec sécurité RLS & Triggers
├── docs/                   # Documentation & Captures d'écran
└── package.json            # Dépendances Vite & TypeScript
```

- **Frontend** : HTML5, CSS3 Moderne (Mode sombre/clair natif), JavaScript ES6+ / TypeScript.
- **Backend & Données** : [Supabase](https://supabase.com) (PostgreSQL 15+, Authentification sécurisée, Row Level Security RLS).
- **PWA & Offline First** : Service Worker et Manifest intégrés pour installation mobile/desktop.

---

## 🚀 Démarrage Rapide

### 1. Prérequis
- [Node.js](https://nodejs.org/) (version 18 ou supérieure recommandée)

### 2. Installation & Lancement local
```bash
# Cloner le dépôt
git clone https://github.com/votre-compte/campus-market.git
cd campus-market

# Installer les dépendances (optionnel si utilisation de Vite)
npm install

# Démarrer le serveur de développement local
npm run dev
```

> **Note :** L'application étant une Single Page Application vanilla, elle peut également être exécutée directement via une extension comme **Live Server** (VS Code) ou n'importe quel serveur HTTP statique.

---

## 🔒 Configuration & Base de Données

Le schéma complet de la base de données (tables `profiles`, `products`, `orders`, `reviews`, politiques RLS et triggers) se trouve dans :
👉 [`database/schema_final.sql`](database/schema_final.sql)

Pour répliquer l'environnement sur votre propre projet Supabase :
1. Créez un projet sur [Supabase](https://supabase.com).
2. Rendez-vous dans l'éditeur SQL et exécutez le script [`database/schema_final.sql`](database/schema_final.sql).
3. Mettez à jour vos identifiants dans [`js/supabase-config.js`](js/supabase-config.js).

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
