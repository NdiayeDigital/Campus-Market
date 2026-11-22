-- ====================================================================================
-- Campus Market — Migration : Classement Réservé Exclusivement aux Vendeurs
-- Fichier : database/migration_seller_only_ranking.sql
-- ====================================================================================
-- RÈGLE DE SÉCURITÉ :
-- 1. Le classement est strictement réservé aux utilisateurs ayant le rôle 'vendeur'
--    ou 'superadmin'.
-- 2. Tout utilisateur non vendeur (anonyme ou simple acheteur) se verra refuser
--    l'exécution ou obtiendra une exception d'autorisation côté base de données.
-- 3. Accessible à TOUS les vendeurs sans distinction d'abonnement (y compris Pack Découverte).
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.get_seller_ranking_stats()
RETURNS TABLE (
    seller_id UUID,
    delivered_orders_count BIGINT,
    cancelled_by_seller_count BIGINT,
    active_products_count BIGINT
) LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public AS $$
DECLARE
    v_caller_role TEXT;
BEGIN
    -- Vérification de l'identité de l'appelant connecté
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Accès refusé : Authentification requise pour consulter le classement des vendeurs.'
            USING ERRCODE = '42501';
    END IF;

    -- Vérification du rôle de l'appelant (seuls 'vendeur' et 'superadmin' sont autorisés)
    SELECT role INTO v_caller_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_caller_role IS NULL OR (v_caller_role <> 'vendeur' AND v_caller_role <> 'superadmin') THEN
        RAISE EXCEPTION 'Accès refusé : Cette fonctionnalité est strictement réservée aux vendeurs certifiés.'
            USING ERRCODE = '42501';
    END IF;

    -- Retourne les statistiques de tous les vendeurs de la plateforme sans distinction de pack
    RETURN QUERY
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
END;
$$;

-- Révocation de l'accès public / anonyme :
REVOKE EXECUTE ON FUNCTION public.get_seller_ranking_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_seller_ranking_stats() FROM anon;

-- Autorisation d'exécution uniquement pour les comptes connectés (la fonction valide elle-même le rôle vendeur)
GRANT EXECUTE ON FUNCTION public.get_seller_ranking_stats() TO authenticated;

COMMENT ON FUNCTION public.get_seller_ranking_stats() IS 'Fournit les statistiques de classement méritocratique de manière strictement réservée aux vendeurs authentifiés.';
