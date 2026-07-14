# Campus Market - Documentation Officielle

## Introduction
**Campus Market** est une application web (Single Page Application) conçue spécifiquement pour les étudiants de l'Université Iba Der Thiam (UIDT). Elle permet aux étudiants de devenir acheteurs ou vendeurs au sein même du campus, facilitant ainsi les transactions de proximité (plats, fournitures, services) avec une livraison rapide "pavillon-à-pavillon".

Le projet est désormais unifié dans un seul fichier `index.html` pour une performance optimale et une transition fluide entre les différentes vues.

---

## 🚀 Architecture Technique

*   **Frontend** : HTML5, CSS3 (Vanilla avec variables CSS pour le mode sombre/clair), JavaScript (Vanilla).
*   **Architecture** : Single Page Application (SPA). Toutes les vues (Accueil, Panier, Profil, Admin, Super Admin) sont préchargées et affichées/masquées dynamiquement via JavaScript (`navigateTo()`), sans jamais recharger la page.
*   **Backend & Base de données** : Supabase (PostgreSQL).
    *   Authentification (Email/Mot de passe).
    *   Tables : `profiles`, `products`, `orders`.

---

## 👥 Les Rôles Utilisateurs

La plateforme gère 3 types d'utilisateurs distincts :

1.  **L'Acheteur (Étudiant Standard)**
    *   Peut naviguer dans le catalogue de produits (avec recherche tolérante aux fautes).
    *   Peut ajouter des produits à son panier.
    *   Peut passer une commande (en précisant son Pavillon, Chambre, Moyen de paiement).
    *   Peut suivre l'état de ses commandes depuis l'onglet "Commandes".

2.  **Le Vendeur (Étudiant Commerçant)**
    *   Accède à un tableau de bord spécifique (`view-admin`).
    *   Peut ajouter, modifier ou supprimer ses propres produits.
    *   Reçoit en temps réel les commandes de ses clients.
    *   Peut modifier le statut des commandes (`En préparation`, `Livrée`, `Annulée`).

3.  **Le Super Admin (L'Administration)**
    *   Accède à un panneau de contrôle sécurisé (`view-superadmin`).
    *   Identifiants par défaut : `maamin.ndiaye@univ-thies.sn` / `Mouhamadou2005`.
    *   Visualise les statistiques globales (100 étudiants actifs par défaut + les nouveaux, 25 commandes par défaut + les vraies commandes, etc.).
    *   Reçoit et valide les "Demandes Vendeurs". Un acheteur ne devient vendeur que si le Super Admin clique sur "Valider".

---

## 🛠️ Fonctionnalités Principales

### 1. Navigation Dynamique (SPA)
Le système de navigation repose sur la fonction `navigateTo(viewId)`. 
Lorsqu'une vue sensible est appelée (comme le Panier ou les Commandes), le système interroge Supabase (`supabase.auth.getUser()`). Si l'utilisateur n'est pas connecté, l'affichage montre des messages explicites d'absence de données ("Panier vide", ou deux boutons d'action dans le Profil).

### 2. Le Tunnel d'Achat
1.  **Ajout au panier** : Les produits sont stockés localement (`localStorage`) pour ne pas perdre le panier si l'utilisateur ferme l'onglet par erreur.
2.  **Validation** : Lors du clic sur "Commander", le formulaire se pré-remplit avec le Prénom, Nom et Téléphone récupérés depuis Supabase.
3.  **Création en base** : Une requête asynchrone insère la commande dans la table `orders`.

### 3. Recherche Intelligente (Distance de Levenshtein)
L'algorithme de recherche implémenté tolère les fautes de frappe. Par exemple, si un étudiant cherche "Thieb" au lieu de "Thiéboudienne", l'algorithme calcule la distance entre les deux chaînes de caractères et affiche le plat correspondant.

---

## 📈 Les Empty States (États Vides)

Pour garantir une expérience utilisateur (UX) professionnelle, la plateforme n'affiche jamais de pages cassées. Si une donnée est manquante, des messages clairs sont affichés :
*   **Catalogue** : "Aucun produit disponible."
*   **Panier** : "Panier vide."
*   **Commandes** : "Aucune commande passée."
*   **Profil (Non connecté)** : Propose "Créer votre profil" ou "Connectez-vous à votre profil vendeur".

---

## 🛡️ Structure de la Base de Données (Supabase)

### Table `profiles`
*   `id` (UUID, Primary Key) - Lié à l'Auth Supabase.
*   `prenom` (Text)
*   `nom` (Text)
*   `telephone` (Text)
*   `role` (Text) - Valeurs : `acheteur`, `vendeur_pending`, `vendeur`, `superadmin`.

### Table `products`
*   `id` (UUID, Primary Key)
*   `seller_id` (UUID) - Le vendeur propriétaire.
*   `title` (Text)
*   `price` (Numeric)
*   `category` (Text)
*   `icon` (Text) - Classe FontAwesome.

### Table `orders`
*   `id` (UUID, Primary Key)
*   `buyer_id` (UUID)
*   `seller_id` (UUID)
*   `product_id` (UUID)
*   `price` (Numeric)
*   `delivery_address` (Text) - Contient Pavillon, Chambre et Paiement.
*   `status` (Text) - Valeurs : `pending`, `processing`, `delivered`, `cancelled`.
