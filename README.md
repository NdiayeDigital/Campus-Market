# 🛒 Campus Market UIDT — PWA E-Commerce

Plateforme e-commerce PWA/SPA conçue pour les étudiants et commerçants de l'Université Iba Der Thiam de Thiès (UIDT). 
Le projet propose un tunnel de commande direct sans inscription forcée, un récepteur de commandes vendeur en temps réel avec notifications sonores et un panneau d'administration pour la modération.

---

## 🔐 Comptes de Test & Accès Démo

| Rôle | Identifiant / Email | Mot de passe | Accès Direct | Fonctionnalités clés |
| :--- | :--- | :--- | :--- | :--- |
| 🛡️ **SuperAdmin** | `admin@univ-thies.sn` | `AdminPasser123!` | `#admin` | Dashboard KPI, modération et validation des boutiques |
| 🏪 **Vendeur** | `fatou.sow@univ-thies.sn` | `Passer123!` | `#seller` | Gestion du catalogue, alertes de commande temps réel |
| 🎓 **Acheteur** | *Aucun compte requis* | *Accès direct* | `/` | Catalogue, recherche Levenshtein, paiement Wave/OM/Cash |

---

## 🚀 Parcours de Démonstration (Scénario de test)

1. **Achat Étudiant (Vitrine) :**
   - Accéder à la boutique, rechercher un produit (ex. Thiéboudienne, Polo).
   - Ouvrir le panier, cliquer sur « Finaliser ma commande ».
   - Renseigner le pavillon, la chambre et le numéro de téléphone, puis valider sans création de compte.

2. **Réception Temps Réel (Vendeur) :**
   - Ouvrir `#seller` dans un onglet privé et se connecter avec `fatou.sow@univ-thies.sn` / `Passer123!`.
   - Observer l'alerte sonore et la réception instantanée de la commande passée via Supabase Realtime.
   - Changer le statut en « Livrée ».

3. **Supervision Administrateur :**
   - Ouvrir `#admin` et se connecter avec `admin@univ-thies.sn` / `AdminPasser123!`.
   - Visualiser les métriques globales et l'état des boutiques actives.

---

## 🛠️ Stack Technique

* **Frontend :** SPA modulaire ES6 propulsée par Vite.
* **UI & Style :** Tailwind CSS (Palette `#1D4ED8` et `#F59E0B`), Font Awesome 6.5.2.
* **Backend & BDD :** Supabase (PostgreSQL 15, RLS, Realtime Subscriptions).
* **PWA :** Service Worker offline, assets WebP optimisés (< 35 Ko), manifest installable.

---

## 💻 Commandes Utiles

```bash
npm install     # Installation des dépendances
npm run dev     # Serveur de développement local
npm run build   # Compilation de production Vite
```
