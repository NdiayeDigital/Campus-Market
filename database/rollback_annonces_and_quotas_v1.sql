-- ====================================================================================
-- CAMPUS MARKET — SCRIPT DE RETOUR ARRIÈRE (ROLLBACK) : MIGRATION QUOTAS & ANNONCES
-- Fichier : database/rollback_annonces_and_quotas_v1.sql
-- Plateforme : Campus Market UIDT
-- ====================================================================================
-- SÉCURITÉ : Ce script rétablit l'état de fonctionnement antérieur SANS JAMAIS
-- supprimer de données (produits, commandes, vendeurs, historiques restent intacts).
-- ====================================================================================

-- 1. Réactivation de tous les produits masqués par le quota
UPDATE public.products
SET is_active = TRUE,
    quota_status = 'actif'
WHERE quota_status = 'masqué_quota';

-- 2. Rétablissement de l'ancien pack pour les vendeurs basculés
UPDATE public.profiles
SET pack_actuel = COALESCE(ancien_pack, 'essai_7j'),
    date_bascule = NULL,
    motif_bascule = 'rollback_migration'
WHERE date_bascule IS NOT NULL;

-- 3. Inscription dans le journal d'audit
INSERT INTO public.audit_logs (action, entity_type, entity_id, details)
VALUES (
    'ROLLBACK_MIGRATION_QUOTAS_V1',
    'system',
    'migration',
    jsonb_build_object(
        'executed_at', NOW(),
        'description', 'Rétablissement des packs et réactivation de tous les produits masqués.'
    )
);

COMMENT ON COLUMN public.products.is_active IS 'Indicateur de visibilité restauré à TRUE par rollback';
