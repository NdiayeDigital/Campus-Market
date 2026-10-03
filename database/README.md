# Scripts de Base de Données Supabase (PostgreSQL) — Campus Market

Ce dossier contient les scripts officiels de base de données pour la production de Campus Market (UIDT).

---

## 1. Scripts Officiels de Production

Pour configurer ou réinitialiser la base de données Supabase, exécutez ces scripts dans l'ordre suivant via le **SQL Editor** de votre console Supabase :

1. **`schema_final.sql`** :
   - Crée l'ensemble des tables (`profiles`, `products`, `orders`, `reviews`, `delivery_locations`).
   - Active Row Level Security (RLS) et configure les index de performance.

2. **`apply_all_security_fixes_v3.sql`** :
   - Applique les politiques de sécurité RLS consolidées.
   - Restreint la table `orders` (lecture uniquement pour le vendeur et via RPC sécurisé `track_order_secure` pour les acheteurs anonymes).
   - Installe le trigger `tr_force_order_price` pour empêcher la manipulation des prix côté client.
   - Configure les permissions sur les avis clients et les lieux de livraison.

3. **`bootstrap_superadmin.sql`** :
   - Attribue le rôle `superadmin` au compte administrateur UIDT désigné.

---

## 2. Dossier `archive/`

Le sous-dossier `archive/` contient les anciens patches incrémentaux et migrations intermédiaires exécutés lors des phases de développement antérieures. Ils sont conservés à des fins d'historique mais ne doivent pas être réexécutés sur une nouvelle base de données.
