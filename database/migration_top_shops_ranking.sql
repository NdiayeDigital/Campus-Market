-- ====================================================================================
-- MIGRATION : STATISTIQUES PUBLIQUES POUR LE CLASSEMENT DES TOP SHOPS
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase.
-- ====================================================================================

-- Fonction SECURITY DEFINER retournant uniquement les compteurs agrégés publics
-- (commandes livrées et nombre de produits) SANS exposer les données sensibles
-- de la table orders (téléphone acheteur, adresse, nom, etc.).

CREATE OR REPLACE FUNCTION public.get_seller_stats()
RETURNS TABLE (
    seller_id UUID,
    delivered_orders_count BIGINT,
    active_products_count BIGINT
) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT 
        p.id AS seller_id,
        COALESCE(COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'delivered'), 0) AS delivered_orders_count,
        COALESCE(COUNT(DISTINCT prod.id), 0) AS active_products_count
    FROM public.profiles p
    LEFT JOIN public.orders o ON o.seller_id = p.id
    LEFT JOIN public.products prod ON prod.seller_id = p.id
    WHERE p.role = 'vendeur'
    GROUP BY p.id;
$$;

-- Autorisation d'exécution pour les visiteurs (anonymes et connectés)
GRANT EXECUTE ON FUNCTION public.get_seller_stats() TO anon, authenticated;

COMMENT ON FUNCTION public.get_seller_stats() IS 'Fournit les statistiques agrégées (commandes livrées, articles) pour le classement Top Shops sans fuite de données personnelles.';
