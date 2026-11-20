-- ====================================================================================
-- MIGRATION : PACKS PRO (1 500 FCFA) & BUSINESS (2 500 FCFA) - CAMPUS MARKET UIDT
-- Migration additive et rétrocompatible avec les données et abonnés existants.
-- ====================================================================================

-- 1. COLONNES ADDITIVES SUR public.profiles POUR COMPTEURS SERVEUR
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS promotions_used_this_period INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS promotions_period_start TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_ads_used_this_month INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS free_ads_period_start TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN public.profiles.promotions_used_this_period IS 'Nombre de promotions de produit consommées dans la période courante (Pro: 1/mois, Business: 1/semaine)';
COMMENT ON COLUMN public.profiles.promotions_period_start IS 'Horodatage du début de la période courante de promotion (Africa/Dakar)';
COMMENT ON COLUMN public.profiles.free_ads_used_this_month IS 'Nombre d annonces gratuites consommées ce mois-ci pour Pack Business (max 2/mois)';
COMMENT ON COLUMN public.profiles.free_ads_period_start IS 'Horodatage du début du mois courant pour les annonces offertes';

-- 2. STATISTIQUES VENDEURS PUBLIQUES (FR-18 : TOP VENDEURS AVEC 10 ACHETEURS DISTINCTS HORS MÊME CHAMBRE)
CREATE OR REPLACE FUNCTION public.get_seller_stats()
RETURNS TABLE (
    seller_id UUID,
    delivered_orders_count BIGINT,
    active_products_count BIGINT,
    distinct_buyers_count BIGINT
) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT 
        p.id AS seller_id,
        COALESCE(COUNT(DISTINCT o.id) FILTER (WHERE o.status = 'delivered'), 0) AS delivered_orders_count,
        COALESCE(COUNT(DISTINCT prod.id), 0) AS active_products_count,
        COALESCE(
            COUNT(DISTINCT COALESCE(o.buyer_id::text, REGEXP_REPLACE(o.buyer_phone, '[^0-9]', '', 'g'))) 
            FILTER (WHERE o.status = 'delivered' AND (o.is_same_room IS NOT TRUE OR o.is_same_room IS NULL)),
            0
        ) AS distinct_buyers_count
    FROM public.profiles p
    LEFT JOIN public.orders o ON o.seller_id = p.id
    LEFT JOIN public.products prod ON prod.seller_id = p.id
    WHERE p.role = 'vendeur'
    GROUP BY p.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_seller_stats() TO anon, authenticated;
COMMENT ON FUNCTION public.get_seller_stats() IS 'Fournit les statistiques agrégées (livraisons, articles, acheteurs distincts hors même chambre) pour Top Vendeurs FR-18.';

-- 3. CONTRÔLE DES QUOTAS ET RÉSERVATION SERVEUR (AVEC PRO, BUSINESS, ALIAS ET RÉTROGRADATION DÉCOUVERTE FR-20)
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
    -- 1. Vérification de l'existence et statut du vendeur
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

    -- 2. Nettoyage des téléphones
    clean_seller_phone := REGEXP_REPLACE(COALESCE(seller_rec.telephone, ''), '[^0-9]', '', 'g');
    clean_buyer_phone := REGEXP_REPLACE(COALESCE(p_buyer_phone, ''), '[^0-9]', '', 'g');

    -- 3. Anti-fraude FR-03 : Interdiction de commander chez soi-même
    IF (p_buyer_id IS NOT NULL AND p_buyer_id = p_seller_id) OR 
       (clean_buyer_phone <> '' AND clean_seller_phone <> '' AND clean_buyer_phone = clean_seller_phone) THEN
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (p_buyer_id, 'REJET_FR03_COMMANDE_CHEZ_SOI', 'orders', p_seller_id::text, jsonb_build_object('buyer_phone', clean_buyer_phone));

        RETURN jsonb_build_object('allowed', false, 'error_code', 'SELF_ORDER_FORBIDDEN', 'message', 'Vous ne pouvez pas commander dans votre propre boutique.');
    END IF;

    -- 4. Anti-fraude FR-04 : Maximum 2 commandes par jour par acheteur chez le même marchand
    SELECT COUNT(*) INTO daily_buyer_orders_count
    FROM public.orders
    WHERE seller_id = p_seller_id
      AND created_at >= (NOW() AT TIME ZONE 'Africa/Dakar' - INTERVAL '24 hours')
      AND (
          (p_buyer_id IS NOT NULL AND buyer_id = p_buyer_id)
          OR (clean_buyer_phone <> '' AND REGEXP_REPLACE(buyer_phone, '[^0-9]', '', 'g') = clean_buyer_phone)
      );

    IF daily_buyer_orders_count >= 2 THEN
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (p_buyer_id, 'REJET_FR04_LIMITE_JOURNALIERE', 'orders', p_seller_id::text, jsonb_build_object('daily_count', daily_buyer_orders_count));

        RETURN jsonb_build_object('allowed', false, 'error_code', 'DAILY_LIMIT_EXCEEDED', 'message', 'Limite quotidienne atteinte : 2 commandes max par 24h chez ce vendeur.');
    END IF;

    -- 5. Anti-fraude FR-05 : Détection de la même chambre (pavillon + chambre identiques)
    IF TRIM(COALESCE(p_buyer_pavillon, '')) <> '' AND TRIM(COALESCE(p_buyer_chambre, '')) <> '' AND
       TRIM(COALESCE(seller_rec.pavillon, '')) <> '' AND TRIM(COALESCE(seller_rec.chambre, '')) <> '' THEN
        IF LOWER(TRIM(p_buyer_pavillon)) = LOWER(TRIM(seller_rec.pavillon)) AND
           LOWER(TRIM(p_buyer_chambre)) = LOWER(TRIM(seller_rec.chambre)) THEN
            is_same_room_order := TRUE;
        END IF;
    END IF;

    -- 6. DÉTERMINATION DU PACK ACTIF (PRO, BUSINESS OU DÉCOUVERTE AVEC ALIAS ET RÉTROGRADATION FR-20)
    -- Si abonnement payant actif (subscription_expires_at > NOW())
    IF seller_rec.subscription_expires_at IS NOT NULL AND seller_rec.subscription_expires_at > NOW() THEN
        -- Rétrocompatibilité : starter = Pack Pro (1 500 F), pro = Pack Business (2 500 F)
        -- Alias : 'business' -> 'pro', 'starter'/'pro' (commercial)
        IF seller_rec.subscription_plan = 'pro' OR seller_rec.pack_actuel = 'pro' OR seller_rec.subscription_plan = 'business' THEN
            seller_pack := 'pro'; -- Pack Business (2 500 FCFA)
            max_monthly_orders := 999999; -- Commandes illimitées
            max_validated_sales := 999999; -- Ventes validées illimitées
            max_active_products := 10;
        ELSE
            seller_pack := 'starter'; -- Pack Pro (1 500 FCFA)
            max_monthly_orders := 75;  -- 75 commandes max/mois
            max_validated_sales := 50; -- 50 ventes validées max/mois
            max_active_products := 5;
        END IF;
    -- Si période d'essai active
    ELSIF seller_rec.trial_ends_at IS NOT NULL AND seller_rec.trial_ends_at > NOW() THEN
        seller_pack := 'essai_7j';
        max_monthly_orders := 999999;
        max_validated_sales := 999999;
        max_active_products := 3;
    -- Rétrogradation automatique vers Pack Découverte (FR-20)
    ELSE
        seller_pack := 'decouverte';
        max_monthly_orders := 15;
        max_validated_sales := 5;
        max_active_products := 1;
    END IF;

    -- 7. CONTRÔLE DES QUOTAS MENSUELS (SI QUOTA LIMITÉ : PRO OU DÉCOUVERTE)
    IF max_monthly_orders < 999999 OR max_validated_sales < 999999 THEN
        start_of_month := DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Dakar');
        
        IF seller_rec.date_bascule IS NOT NULL AND seller_rec.date_bascule > start_of_month THEN
            start_of_month := seller_rec.date_bascule;
        END IF;

        -- A. Nombre total de commandes reçues depuis le début de la période
        SELECT COUNT(*) INTO monthly_orders_count
        FROM public.orders
        WHERE seller_id = p_seller_id
          AND created_at >= start_of_month;

        IF monthly_orders_count >= max_monthly_orders THEN
            INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
            VALUES (p_buyer_id, 'REJET_QUOTA_COMMANDES_MOIS', 'orders', p_seller_id::text, 
                    jsonb_build_object('pack', seller_pack, 'orders_count', monthly_orders_count, 'limit', max_monthly_orders));

            RETURN jsonb_build_object(
                'allowed', false, 
                'error_code', 'QUOTA_ORDERS_EXCEEDED', 
                'message', 'Ce vendeur est momentanément indisponible.',
                'seller_message', 'Votre quota mensuel de ' || max_monthly_orders || ' commandes en ' || 
                    CASE WHEN seller_pack = 'starter' THEN 'Pack Pro' ELSE 'Pack Découverte' END || 
                    ' est atteint. Passez à la formule supérieure pour continuer à recevoir des commandes.'
            );
        END IF;

        -- B. Ventes validées (double confirmation hors même chambre) + Commandes en cours
        SELECT COUNT(*) INTO validated_sales_count
        FROM public.orders
        WHERE seller_id = p_seller_id
          AND created_at >= start_of_month
          AND status = 'delivered'
          AND buyer_confirmed_at IS NOT NULL
          AND is_same_room IS NOT TRUE;

        SELECT COUNT(*) INTO ongoing_orders_count
        FROM public.orders
        WHERE seller_id = p_seller_id
          AND created_at >= start_of_month
          AND status IN ('pending', 'confirmed', 'processing', 'shipped');

        IF (validated_sales_count + ongoing_orders_count) >= max_validated_sales THEN
            INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
            VALUES (p_buyer_id, 'REJET_QUOTA_VENTES_MOIS', 'orders', p_seller_id::text, 
                    jsonb_build_object('pack', seller_pack, 'validated', validated_sales_count, 'ongoing', ongoing_orders_count, 'limit', max_validated_sales));

            RETURN jsonb_build_object(
                'allowed', false, 
                'error_code', 'QUOTA_SALES_EXCEEDED', 
                'message', 'Ce vendeur est momentanément indisponible.',
                'seller_message', 'Votre quota mensuel de ' || max_validated_sales || ' ventes validées est engagé. Passez à la formule supérieure pour débloquer les ventes illimitées.'
            );
        END IF;
    END IF;

    -- Réservation accordée avec succès
    RETURN jsonb_build_object(
        'allowed', true,
        'is_same_room', is_same_room_order,
        'pack', seller_pack,
        'max_orders', max_monthly_orders,
        'max_sales', max_validated_sales
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_reserve_order_quota(UUID, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;
COMMENT ON FUNCTION public.check_and_reserve_order_quota IS 'Contrôle atomique et sécurisé des quotas commandes/ventes pour Découverte (15/5), Pro (75/50) et Business (illimité) avec rétrogradation FR-20.';

-- 4. RPC CONSOMMATION DES 2 ANNONCES OFFERTES DU PACK BUSINESS (SANS PAIEMENT SASPAY, TRACE AUDIT_LOGS)
CREATE OR REPLACE FUNCTION public.consume_free_business_ad(
    p_ad_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_profile RECORD;
    v_start_of_month TIMESTAMPTZ;
    v_used_count INT;
    v_ad_record RECORD;
    v_expires_at TIMESTAMPTZ;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Authentification requise.');
    END IF;

    SELECT id, subscription_plan, subscription_status, subscription_expires_at,
           pack_actuel, free_ads_used_this_month, free_ads_period_start
    INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Profil introuvable.');
    END IF;

    -- Vérification Pack Business actif
    IF (v_profile.subscription_plan <> 'pro' AND v_profile.pack_actuel <> 'pro' AND v_profile.subscription_plan <> 'business')
       OR v_profile.subscription_expires_at IS NULL OR v_profile.subscription_expires_at <= NOW() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Réservé aux marchands abonnés au Pack Business (2 500 FCFA).');
    END IF;

    -- Vérification et réinitialisation mensuelle (fuseau Dakar)
    v_start_of_month := DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Dakar');
    IF v_profile.free_ads_period_start IS NULL OR v_profile.free_ads_period_start < v_start_of_month THEN
        v_used_count := 0;
    ELSE
        v_used_count := COALESCE(v_profile.free_ads_used_this_month, 0);
    END IF;

    IF v_used_count >= 2 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Quota de 2 annonces offertes par mois déjà atteint pour ce cycle.');
    END IF;

    -- Vérification de l'annonce cible
    SELECT id, seller_id, status INTO v_ad_record
    FROM public.advertisements
    WHERE id = p_ad_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Annonce introuvable.');
    END IF;

    IF v_ad_record.seller_id <> v_user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cette annonce ne vous appartient pas.');
    END IF;

    -- Activation de l'annonce pour 7 jours
    v_expires_at := NOW() + INTERVAL '7 days';
    UPDATE public.advertisements
    SET status = 'publiee',
        validated_at = NOW(),
        expires_at = v_expires_at,
        transaction_ref = 'free_business_ad_' || p_ad_id::text,
        rejection_reason = null,
        updated_at = NOW()
    WHERE id = p_ad_id;

    -- Mise à jour du compteur vendeur
    UPDATE public.profiles
    SET free_ads_used_this_month = v_used_count + 1,
        free_ads_period_start = CASE WHEN v_profile.free_ads_period_start < v_start_of_month OR v_profile.free_ads_period_start IS NULL 
                                     THEN v_start_of_month ELSE v_profile.free_ads_period_start END
    WHERE id = v_user_id;

    -- Traçabilité dans audit_logs
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
        v_user_id,
        'CONSOMMATION_ANNONCE_OFFERTE_BUSINESS',
        'advertisements',
        p_ad_id::text,
        jsonb_build_object(
            'ad_id', p_ad_id,
            'used_count', v_used_count + 1,
            'remaining', 2 - (v_used_count + 1),
            'expires_at', v_expires_at,
            'pack', 'pro'
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Annonce offerte publiée avec succès pour 7 jours.',
        'free_ads_used', v_used_count + 1,
        'free_ads_remaining', 2 - (v_used_count + 1)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_free_business_ad(UUID) TO authenticated;
COMMENT ON FUNCTION public.consume_free_business_ad IS 'Active l une des 2 annonces offertes par mois pour le Pack Business sans paiement SasPay et trace dans audit_logs.';

-- 5. RPC UTILISATION DE PROMOTION PRODUIT (1/MOIS PRO, 1/SEMAINE RESET LUNDI DAKAR BUSINESS)
CREATE OR REPLACE FUNCTION public.use_product_promotion(
    p_product_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_profile RECORD;
    v_product RECORD;
    v_period_start TIMESTAMPTZ;
    v_max_promotions INT;
    v_used_promotions INT;
    v_pack_key TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Authentification requise.');
    END IF;

    SELECT id, subscription_plan, subscription_status, subscription_expires_at,
           pack_actuel, promotions_used_this_period, promotions_period_start
    INTO v_profile
    FROM public.profiles
    WHERE id = v_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Profil introuvable.');
    END IF;

    -- Vérification abonnement payant actif
    IF v_profile.subscription_expires_at IS NULL OR v_profile.subscription_expires_at <= NOW() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Abonnement payant (Pro ou Business) requis pour promouvoir un produit.');
    END IF;

    -- Vérification produit
    SELECT id, seller_id, title INTO v_product
    FROM public.products
    WHERE id = p_product_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Produit introuvable.');
    END IF;

    IF v_product.seller_id <> v_user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ce produit ne vous appartient pas.');
    END IF;

    -- Détermination des règles de promotion par pack
    IF v_profile.subscription_plan = 'pro' OR v_profile.pack_actuel = 'pro' OR v_profile.subscription_plan = 'business' THEN
        v_pack_key := 'pro'; -- Pack Business (2 500 F)
        v_max_promotions := 1;
        -- Remise à zéro chaque lundi à 00:00 fuseau Africa/Dakar
        v_period_start := DATE_TRUNC('week', NOW() AT TIME ZONE 'Africa/Dakar');
    ELSE
        v_pack_key := 'starter'; -- Pack Pro (1 500 F)
        v_max_promotions := 1;
        -- Remise à zéro mensuelle le 1er du mois Africa/Dakar
        v_period_start := DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Dakar');
    END IF;

    -- Vérification ou réinitialisation du compteur
    IF v_profile.promotions_period_start IS NULL OR v_profile.promotions_period_start < v_period_start THEN
        v_used_promotions := 0;
    ELSE
        v_used_promotions := COALESCE(v_profile.promotions_used_this_period, 0);
    END IF;

    IF v_used_promotions >= v_max_promotions THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Quota de promotion atteint pour cette ' || 
                CASE WHEN v_pack_key = 'pro' THEN 'semaine (reset lundi Dakar)' ELSE 'période mensuelle' END || '.'
        );
    END IF;

    -- Application de la promotion
    UPDATE public.profiles
    SET promotions_used_this_period = v_used_promotions + 1,
        promotions_period_start = CASE WHEN v_profile.promotions_period_start < v_period_start OR v_profile.promotions_period_start IS NULL 
                                       THEN v_period_start ELSE v_profile.promotions_period_start END
    WHERE id = v_user_id;

    -- Traçabilité dans audit_logs
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
        v_user_id,
        'PROMOTION_PRODUIT_UTILISEE',
        'products',
        p_product_id::text,
        jsonb_build_object(
            'product_id', p_product_id,
            'product_title', v_product.title,
            'pack', v_pack_key,
            'used_this_period', v_used_promotions + 1,
            'max', v_max_promotions
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Promotion appliquée avec succès.',
        'promotions_used', v_used_promotions + 1,
        'max_promotions', v_max_promotions
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.use_product_promotion(UUID) TO authenticated;
COMMENT ON FUNCTION public.use_product_promotion IS 'Consomme le quota serveur de promotion de produit (1/mois Pro, 1/semaine lundi Dakar Business).';
