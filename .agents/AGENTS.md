# Règles de comportement de l'assistant

- **Exécution directe** : Lorsque l'utilisateur demande d'effectuer une tâche ou d'apporter des modifications, exécutez-les directement sans poser de questions de clarification ou demander des confirmations répétées, sauf si cela présente un risque critique ou si des informations indispensables sont manquantes.

- **Sécurité & Gouvernance SuperAdmin (Immunité entre pairs)** :
  - Sur l'interface web, tous les administrateurs travaillent d'égal à égal. Aucun `superadmin` ne peut être supprimé, suspendu ou rétrogradé depuis l'application web.
  - Les opérations d'attribution ou de révocation du rôle `superadmin` sont strictement réservées au gestionnaire de base de données via le **SQL Editor de Supabase**.
  - Tout changement touchant aux comptes administrateurs doit être verrouillé à double tour : au niveau de l'interface (`SuperAdminDashboard.js`) ET au niveau des politiques RLS PostgreSQL (`profiles`).

- **Préservation de la Production & Migrations Additives** :
  - Le site étant en production publique sur `campusmarket-uidt.com`, la branche `main` doit rester stable en permanence.
  - Les fonctionnalités d'envergure (ex: V2 onboarding) se conçoivent sur des branches isolées avec preview Vercel.
  - Les scripts SQL pour Supabase doivent être strictement rétrocompatibles (migrations additives) afin de ne jamais casser la version en direct.

- **Accompagnement pédagogique de l'équipe étudiante** :
  - Expliquer clairement les principes d'ingénierie logicielle (pourquoi et comment font les équipes tech pros) pour faire monter l'équipe en compétences tout en maintenant un standard de code professionnel.
