-- ====================================================================================
-- Campus Market — Migration Additive : Autorité SuperAdmin pour le Classement Vendeurs
-- Fichier : database/migration_superadmin_seller_ranking_rpc.sql
-- ====================================================================================
-- RÈGLE DE SÉCURITÉ & DE CONFIDENTIALITÉ :
-- Cette fonction SECURITY DEFINER exécute le calcul officiel du classement des vendeurs
-- avec les privilèges SuperAdmin. Elle agrège les métriques méritocratiques réelles
-- (commandes livrées, annulations vendeur, articles actifs, profil complet)
-- SANS jamais exposer les informations personnelles des acheteurs (téléphone, adresse, prix unitaire).
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.get_superadmin_seller_ranking()
RETURNS TABLE (
    id UUID,
    rank BIGINT,
    shop_name TEXT,
    prenom TEXT,
    nom TEXT,
    avatar_url TEXT,
    logo_url TEXT,
    pavillon TEXT,
    chambre TEXT,
    is_open BOOLEAN,
    role TEXT,
    subscription_plan TEXT,
    delivered_count BIGINT,
    cancelled_by_seller_count BIGINT,
    active_products_count BIGINT,
    points BIGINT,
    tier_id TEXT,
    tier_name TEXT,
    tier_icon TEXT,
    tier_color TEXT
) LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
BEGIN
    RETURN QUERY
    WITH seller_metrics AS (
        SELECT 
            p.id,
            COALESCE(NULLIF(p.shop_name, ''), 'Boutique ' || COALESCE(p.prenom, 'Marchand')) AS shop_name,
            p.prenom,
            p.nom,
            p.avatar_url,
            p.logo_url,
            p.pavillon,
            p.chambre,
            COALESCE(p.is_open, true) AS is_open,
            p.role,
            COALESCE(p.subscription_plan, 'starter') AS subscription_plan,
            COALESCE(COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'delivered'), 0) AS delivered_count,
            COALESCE(COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'cancelled' AND o.cancelled_by = 'seller'), 0) AS cancelled_by_seller_count,
            COALESCE(COUNT(DISTINCT prod.id) FILTER (WHERE prod.is_active = true), 0) AS active_products_count,
            -- Calcul méritocratique strict des points (règle 5-10 pts)
            GREATEST(0, (
                (COALESCE(COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'delivered'), 0) * 10) -
                (COALESCE(COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'cancelled' AND o.cancelled_by = 'seller'), 0) * 5) +
                (CASE WHEN p.shop_name IS NOT NULL AND p.pavillon IS NOT NULL AND p.chambre IS NOT NULL THEN 5 ELSE 0 END) +
                (CASE WHEN COALESCE(p.is_open, true) AND COUNT(DISTINCT prod.id) FILTER (WHERE prod.is_active = true) > 0 THEN 5 ELSE 0 END)
            )) AS points
        FROM public.profiles p
        LEFT JOIN public.orders o ON o.seller_id = p.id
        LEFT JOIN public.products prod ON prod.seller_id = p.id
        WHERE p.role IN ('vendeur', 'superadmin')
          AND COALESCE(p.is_suspended, false) = false
          AND p.role NOT IN ('vendeur_desactive', 'suspendu')
        GROUP BY p.id, p.shop_name, p.prenom, p.nom, p.avatar_url, p.logo_url, p.pavillon, p.chambre, p.is_open, p.role, p.subscription_plan
    )
    SELECT 
        sm.id,
        DENSE_RANK() OVER (ORDER BY sm.points DESC, sm.delivered_count DESC, sm.active_products_count DESC) AS rank,
        sm.shop_name,
        sm.prenom,
        sm.nom,
        sm.avatar_url,
        sm.logo_url,
        sm.pavillon,
        sm.chambre,
        sm.is_open,
        sm.role,
        sm.subscription_plan,
        sm.delivered_count,
        sm.cancelled_by_seller_count,
        sm.active_products_count,
        sm.points,
        CASE 
            WHEN sm.points >= 300 THEN 'diamant'
            WHEN sm.points >= 150 THEN 'or'
            WHEN sm.points >= 50 THEN 'argent'
            ELSE 'bronze'
        END AS tier_id,
        CASE 
            WHEN sm.points >= 300 THEN 'Diamant'
            WHEN sm.points >= 150 THEN 'Or'
            WHEN sm.points >= 50 THEN 'Argent'
            ELSE 'Bronze'
        END AS tier_name,
        CASE 
            WHEN sm.points >= 300 THEN '💎'
            WHEN sm.points >= 150 THEN '🥇'
            WHEN sm.points >= 50 THEN '🥈'
            ELSE '🥉'
        END AS tier_icon,
        CASE 
            WHEN sm.points >= 300 THEN '#06b6d4'
            WHEN sm.points >= 150 THEN '#f59e0b'
            WHEN sm.points >= 50 THEN '#64748b'
            ELSE '#c2410c'
        END AS tier_color
    FROM seller_metrics sm
    ORDER BY rank ASC;
END;
$$;

-- Autorisation d'accès universelle (visiteurs, étudiants, vendeurs, superadmin)
GRANT EXECUTE ON FUNCTION public.get_superadmin_seller_ranking() TO anon, authenticated;

COMMENT ON FUNCTION public.get_superadmin_seller_ranking() IS 'Autorité de calcul officielle du classement des vendeurs Campus Market UIDT (accessible publiquement en SECURITY DEFINER).';
