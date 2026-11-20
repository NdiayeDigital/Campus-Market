-- ====================================================================================
-- CAMPUS MARKET — MIGRATION ADDITIVE : STATS ADMIN V2 (AGRÉGATION SERVEUR)
-- Fichier : database/migration_admin_stats_v2.sql
-- Plateforme : Campus Market UIDT (Université Iba Der Thiam de Thiès)
-- ====================================================================================
-- RÈGLE D'OR : STRICTEMENT ADDITIF, IDEMPOTENT (relançable sans erreur) ET SANS PERTE DE DONNÉES.
-- OBJECTIF : Calculer les métriques globales directement en SQL pour économiser l'egress Supabase.
-- ====================================================================================

-- 1. S'assurer de la présence de la colonne additive is_same_room sur public.orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_same_room BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.orders.is_same_room IS 'TRUE si la commande provient de la même chambre que le vendeur (FR-05)';

-- Index d'optimisation pour l'agrégation rapide sur status et is_same_room
CREATE INDEX IF NOT EXISTS idx_orders_status_price ON public.orders (status, price);
CREATE INDEX IF NOT EXISTS idx_orders_same_room ON public.orders (is_same_room);

-- 2. Fonction d'agrégation globale réservée aux SuperAdministrateurs
CREATE OR REPLACE FUNCTION public.get_admin_global_stats_v2()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_id UUID;
    is_admin BOOLEAN;
    stats_result JSONB;
BEGIN
    caller_id := auth.uid();

    -- Contrôle strict d'autorisation : réservé aux Super Administrateurs
    SELECT (role = 'superadmin') INTO is_admin
    FROM public.profiles
    WHERE id = caller_id;

    IF is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Action non autorisée. Réservé aux Super Administrateurs.';
    END IF;

    -- Agrégation en une passe sur TOUTES les commandes (sans filtre de statut de boutique)
    SELECT jsonb_build_object(
        'total_count', COUNT(*),
        'total_amount', COALESCE(SUM(price), 0),
        'delivered_count', COUNT(*) FILTER (WHERE status = 'delivered'),
        'delivered_amount', COALESCE(SUM(price) FILTER (WHERE status = 'delivered'), 0),
        'undelivered_count', COUNT(*) FILTER (WHERE status IN ('pending', 'confirmed', 'processing', 'shipped')),
        'undelivered_amount', COALESCE(SUM(price) FILTER (WHERE status IN ('pending', 'confirmed', 'processing', 'shipped')), 0),
        'pending_count', COUNT(*) FILTER (WHERE status = 'pending'),
        'pending_amount', COALESCE(SUM(price) FILTER (WHERE status = 'pending'), 0),
        'confirmed_count', COUNT(*) FILTER (WHERE status = 'confirmed'),
        'confirmed_amount', COALESCE(SUM(price) FILTER (WHERE status = 'confirmed'), 0),
        'processing_count', COUNT(*) FILTER (WHERE status = 'processing'),
        'processing_amount', COALESCE(SUM(price) FILTER (WHERE status = 'processing'), 0),
        'shipped_count', COUNT(*) FILTER (WHERE status = 'shipped'),
        'shipped_amount', COALESCE(SUM(price) FILTER (WHERE status = 'shipped'), 0),
        'cancelled_count', COUNT(*) FILTER (WHERE status = 'cancelled'),
        'cancelled_amount', COALESCE(SUM(price) FILTER (WHERE status = 'cancelled'), 0),
        'cancellation_rate', CASE 
            WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status = 'cancelled')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
            ELSE 0 
        END,
        'delivery_rate', CASE 
            WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE status = 'delivered')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2)
            ELSE 0 
        END,
        'same_room_count', COUNT(*) FILTER (WHERE is_same_room IS TRUE)
    ) INTO stats_result
    FROM public.orders;

    RETURN stats_result;
END;
$$;

-- 3. Droits d'exécution de la fonction
GRANT EXECUTE ON FUNCTION public.get_admin_global_stats_v2() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_global_stats_v2() TO service_role;
