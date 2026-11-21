-- ====================================================================================
-- CAMPUS MARKET — MIGRATION ADDITIVE : RÉACTIVATION DES PRODUITS MASQUÉS PAR QUOTA
-- Fichier : database/migration_reactivate_masked_quota_products.sql
-- Plateforme : Campus Market UIDT
-- ====================================================================================
-- SÉCURITÉ & RÉTROCOMPATIBILITÉ :
-- Ce script réactive les produits qui étaient restés avec le statut 'masqué_quota'
-- ou is_active = FALSE lors des tests de quotas antérieurs, conformément au
-- maintien de FEATURE_FLAGS.QUOTAS_ENABLED = false en production.
-- ====================================================================================

UPDATE public.products
SET is_active = TRUE,
    quota_status = 'actif'
WHERE quota_status = 'masqué_quota' OR is_active IS FALSE;

COMMENT ON COLUMN public.products.quota_status IS 'Statut de visibilité : actif par défaut lorsque les quotas sont désactivés';
