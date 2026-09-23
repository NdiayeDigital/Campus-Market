# Politique de Sécurité — Campus Market (UIDT)

## 1. Périmètre & Versions Supportées

Campus Market est déployé en production pour la communauté universitaire de l'Université Iba Der Thiam de Thiès (UIDT).

| Version | Statut |
| :--- | :--- |
| **1.x (Main / Production)** | :white_check_mark: Maintenu et supporté activement avec correctifs de sécurité |
| **< 1.0 (Legacy Archive)** | :x: Obsolète (archivé dans `_legacy_archive/`) |

---

## 2. Principes Fondamentaux de Sécurité du Projet

1. **Row Level Security (RLS)** : 
   - Toutes les tables PostgreSQL (`profiles`, `products`, `orders`, `reviews`, `delivery_locations`) ont le RLS activé par défaut.
   - Les commandes anonymes (`buyer_id: null`) ne peuvent être consultées que via la fonction RPC sécurisée `track_order_secure` et non via des requêtes ouvertes sur la table `orders`.
2. **Cloisonnement des Rôles** :
   - `acheteur` : Accès aux offres, passage de commande direct sans obligation de compte.
   - `vendeur_pending` : Candidature étudiante soumise à validation par le SuperAdmin.
   - `vendeur` : Accès exclusif à la publication d'articles et gestion de ses commandes.
   - `superadmin` : Supervision globale, arbitrage des litiges et modération.
3. **Protection XSS & Injection DOM** :
   - Assainissement obligatoire avec la fonction `escapeHTML()` de toutes les données dynamiques provenant des utilisateurs ou du `localStorage`.
4. **Intégrité Financière & Anti-Tampering** :
   - Trigger PostgreSQL `tr_force_order_price` recalculant obligatoirement le prix réel des articles et les frais de livraison côté serveur pour empêcher la manipulation des prix via les outils de développement navigateur.

---

## 3. Signalement d'une Vulnérabilité

Si vous identifiez une faille de sécurité ou une faiblesse dans l'infrastructure de Campus Market :
- **Ne publiez pas publiquement d'issue GitHub** avant que la vulnérabilité ne soit corrigée.
- Contactez directement l'équipe de développement et le SuperAdmin UIDT :
  - **Email** : `admin@univ-thies.sn`
  - **Support technique** : Via WhatsApp officiel de support étudiant.

Nous nous engageons à accuser réception sous 24h et à déployer les correctifs dans les plus brefs délais.
