-- ====================================================================================
-- ROLLBACK : PACKS PRO (1 500 FCFA) & BUSINESS (2 500 FCFA) - CAMPUS MARKET UIDT
-- Restaure les fonctions SQL et rétablit l'état antérieur.
-- ====================================================================================

-- 1. Suppression des fonctions ajoutées
DROP FUNCTION IF EXISTS public.consume_free_business_ad(UUID);
DROP FUNCTION IF EXISTS public.use_product_promotion(UUID);

-- 2. Restauration de public.get_seller_stats() (sans distinct_buyers_count)
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

GRANT EXECUTE ON FUNCTION public.get_seller_stats() TO anon, authenticated;

-- 3. Restauration de check_and_reserve_order_quota() (version starter/pro antérieure)
CREATE OR REPLACE FUNCTION public.check_and_reserve_order_quota(
    p_seller_id UUID,
    p_buyer_phone TEXT,
    p_buyer_pavillon TEXT DEFAULT '',
    p_buyer_chambre TEXT DEFAULT '',
    p_buyer_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    seller_rec RECORD;
    seller_pack TEXT;
    max_monthly_orders INTEGER;
    max_validated_sales INTEGER;
    max_active_products INTEGER;
    monthly_orders_count INTEGER;
    validated_sales_count INTEGER;
    ongoing_orders_count INTEGER;
    start_of_month TIMESTAMPTZ;
    clean_seller_phone TEXT;
    clean_buyer_phone TEXT;
    is_same_room_order BOOLEAN := FALSE;
    daily_buyer_orders_count INTEGER;
BEGIN
    SELECT id, telephone, pavillon, chambre, subscription_plan, subscription_status,
           subscription_expires_at, trial_ends_at, pack_actuel, date_bascule, is_open
    INTO seller_rec
    FROM public.profiles
    WHERE id = p_seller_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', false, 'error_code', 'SELLER_NOT_FOUND', 'message', 'Vendeur introuvable.');
    END IF;

    IF seller_rec.is_open = false THEN
        RETURN jsonb_build_object('allowed', false, 'error_code', 'SHOP_CLOSED', 'message', 'Cette boutique est actuellement fermée.');
    END IF;

    clean_seller_phone := REGEXP_REPLACE(COALESCE(seller_rec.telephone, ''), '[^0-9]', '', 'g');
    clean_buyer_phone := REGEXP_REPLACE(COALESCE(p_buyer_phone, ''), '[^0-9]', '', 'g');

    IF (p_buyer_id IS NOT NULL AND p_buyer_id = p_seller_id) OR 
       (clean_buyer_phone <> '' AND clean_seller_phone <> '' AND clean_buyer_phone = clean_seller_phone) THEN
        RETURN jsonb_build_object('allowed', false, 'error_code', 'SELF_ORDER_FORBIDDEN', 'message', 'Vous ne pouvez pas commander dans votre propre boutique.');
    END IF;

    SELECT COUNT(*) INTO daily_buyer_orders_count
    FROM public.orders
    WHERE seller_id = p_seller_id
      AND created_at >= (NOW() AT TIME ZONE 'Africa/Dakar' - INTERVAL '24 hours')
      AND (
          (p_buyer_id IS NOT NULL AND buyer_id = p_buyer_id)
          OR (clean_buyer_phone <> '' AND REGEXP_REPLACE(buyer_phone, '[^0-9]', '', 'g') = clean_buyer_phone)
      );

    IF daily_buyer_orders_count >= 2 THEN
        RETURN jsonb_build_object('allowed', false, 'error_code', 'DAILY_LIMIT_EXCEEDED', 'message', 'Limite quotidienne atteinte : 2 commandes max par 24h chez ce vendeur.');
    END IF;

    IF TRIM(COALESCE(p_buyer_pavillon, '')) <> '' AND TRIM(COALESCE(p_buyer_chambre, '')) <> '' AND
       TRIM(COALESCE(seller_rec.pavillon, '')) <> '' AND TRIM(COALESCE(seller_rec.chambre, '')) <> '' THEN
        IF LOWER(TRIM(p_buyer_pavillon)) = LOWER(TRIM(seller_rec.pavillon)) AND
           LOWER(TRIM(p_buyer_chambre)) = LOWER(TRIM(seller_rec.chambre)) THEN
            is_same_room_order := TRUE;
        END IF;
    END IF;

    IF seller_rec.subscription_expires_at IS NOT NULL AND seller_rec.subscription_expires_at > NOW() THEN
        seller_pack := COALESCE(seller_rec.subscription_plan, 'starter');
        IF seller_pack = 'pro' THEN
            max_monthly_orders := 999999;
            max_validated_sales := 999999;
            max_active_products := 10;
        ELSE
            max_monthly_orders := 999999;
            max_validated_sales := 999999;
            max_active_products := 5;
        END IF;
    ELSIF seller_rec.trial_ends_at IS NOT NULL AND seller_rec.trial_ends_at > NOW() THEN
        seller_pack := 'essai_7j';
        max_monthly_orders := 999999;
        max_validated_sales := 999999;
        max_active_products := 3;
    ELSE
        seller_pack := 'decouverte';
        max_monthly_orders := 15;
        max_validated_sales := 5;
        max_active_products := 1;
    END IF;

    IF seller_pack = 'decouverte' THEN
        start_of_month := DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Dakar');
        IF seller_rec.date_bascule IS NOT NULL AND seller_rec.date_bascule > start_of_month THEN
            start_of_month := seller_rec.date_bascule;
        END IF;

        SELECT COUNT(*) INTO monthly_orders_count
        FROM public.orders
        WHERE seller_id = p_seller_id AND created_at >= start_of_month;

        IF monthly_orders_count >= max_monthly_orders THEN
            RETURN jsonb_build_object('allowed', false, 'error_code', 'QUOTA_ORDERS_EXCEEDED', 'message', 'Ce vendeur est momentanément indisponible.');
        END IF;

        SELECT COUNT(*) INTO validated_sales_count
        FROM public.orders
        WHERE seller_id = p_seller_id AND created_at >= start_of_month AND status = 'delivered' AND buyer_confirmed_at IS NOT NULL AND is_same_room IS NOT TRUE;

        SELECT COUNT(*) INTO ongoing_orders_count
        FROM public.orders
        WHERE seller_id = p_seller_id AND created_at >= start_of_month AND status IN ('pending', 'confirmed', 'processing', 'shipped');

        IF (validated_sales_count + ongoing_orders_count) >= max_validated_sales THEN
            RETURN jsonb_build_object('allowed', false, 'error_code', 'QUOTA_SALES_EXCEEDED', 'message', 'Ce vendeur est momentanément indisponible.');
        END IF;
    END IF;

    RETURN jsonb_build_object('allowed', true, 'is_same_room', is_same_room_order);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_reserve_order_quota(UUID, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;

-- 4. Nettoyage des colonnes (optionnel en production pour éviter la perte de données)
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS promotions_used_this_period;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS promotions_period_start;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS free_ads_used_this_month;
-- ALTER TABLE public.profiles DROP COLUMN IF EXISTS free_ads_period_start;
