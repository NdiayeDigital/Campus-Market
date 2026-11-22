-- ====================================================================================
-- Campus Market — Migration : Classement Universel pour Tous les Vendeurs
-- Fichier : database/migration_universal_seller_ranking.sql
-- ====================================================================================
-- Cette migration met à jour get_seller_ranking_stats() pour que TOUS les vendeurs
-- (qu'ils soient en Pack Découverte gratuit, Pro, Business ou SuperAdmin) figurent
-- dans les statistiques de classement méritocratique du campus.
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.get_seller_ranking_stats()
RETURNS TABLE (
    seller_id UUID,
    delivered_orders_count BIGINT,
    cancelled_by_seller_count BIGINT,
    active_products_count BIGINT
) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT 
        p.id AS seller_id,
        COALESCE(COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'delivered'), 0) AS delivered_orders_count,
        COALESCE(COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'cancelled' AND o.cancelled_by = 'seller'), 0) AS cancelled_by_seller_count,
        COALESCE(COUNT(DISTINCT prod.id) FILTER (WHERE prod.is_active = true), 0) AS active_products_count
    FROM public.profiles p
    LEFT JOIN public.orders o ON o.seller_id = p.id
    LEFT JOIN public.products prod ON prod.seller_id = p.id
    WHERE (
        p.role = 'vendeur' OR p.role = 'superadmin'
    )
    GROUP BY p.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_seller_ranking_stats() TO anon, authenticated;

COMMENT ON FUNCTION public.get_seller_ranking_stats() IS 'Fournit les statistiques agrégées pour le classement officiel de tous les vendeurs de la plateforme (gratuit et payant).';
