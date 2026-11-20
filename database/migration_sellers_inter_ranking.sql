-- ====================================================================================
-- Campus Market — Migration Additive : Statistiques et Classement Inter-Vendeurs
-- Fichier : database/migration_sellers_inter_ranking.sql
-- ====================================================================================
-- RÈGLE DE SÉCURITÉ & DE CONFIDENTIALITÉ :
-- Cette fonction SECURITY DEFINER agrège les métriques méritocratiques nécessaires
-- au calcul du classement inter-vendeurs (commandes livrées, annulations vendeur,
-- articles actifs) SANS jamais exposer les informations personnelles des acheteurs
-- (numéros de téléphone, coordonnées, adresses ou montants financiers individuels).
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
    WHERE p.role IN ('vendeur', 'superadmin')
    GROUP BY p.id;
$$;

-- Autorisation d'exécution pour les utilisateurs connectés et anonymes
GRANT EXECUTE ON FUNCTION public.get_seller_ranking_stats() TO anon, authenticated;

COMMENT ON FUNCTION public.get_seller_ranking_stats() IS 'Fournit les statistiques agrégées pour le classement officiel inter-vendeurs du campus sans divulguer de données personnelles.';
