-- ====================================================================================
-- MIGRATION : NOUVELLES OFFRES MARCHANDES (PRO 1 000 F & BUSINESS 2 000 F) & PROMOTIONS
-- Campus Market - Université Iba Der Thiam de Thiès (UIDT)
-- Migration additive, réversible, avec contrôles stricts 100% côté serveur.
-- ====================================================================================

-- 1. COLONNES DE PROMOTION SUR public.products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_promoted BOOLEAN DEFAULT FALSE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS promoted_until TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.products.is_promoted IS 'Indique si l article est actuellement en mise en avant sponsorisée (7 jours)';
COMMENT ON COLUMN public.products.promoted_until IS 'Horodatage d expiration de la mise en avant sponsorisée (7 jours)';

CREATE INDEX IF NOT EXISTS idx_products_promoted 
ON public.products (is_promoted, promoted_until) 
WHERE is_promoted IS TRUE;

-- 2. COLONNES DE COMPTEURS DE PROMOTION SUR public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS promotions_used_this_period INT DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS promotions_period_start TIMESTAMPTZ DEFAULT NOW();

COMMENT ON COLUMN public.profiles.promotions_used_this_period IS 'Nombre de promotions consommées dans la période courante (Pro: 1/mois, Business: 1/semaine)';
COMMENT ON COLUMN public.profiles.promotions_period_start IS 'Horodatage de début de période (Dakar) pour remise à zéro des promotions';

-- 3. TRIGGER SERVEUR : CONTRÔLE STRICT DU PLAFOND DE PRODUITS PUBLIÉS (DÉCOUVERTE: 1, PRO: 5, BUSINESS: 10)
CREATE OR REPLACE FUNCTION public.check_product_quota_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seller RECORD;
    v_max_products INT := 1;
    v_current_count INT := 0;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    SELECT id, role, subscription_plan, subscription_status, subscription_expires_at,
           trial_ends_at, pack_actuel, max_products
    INTO v_seller
    FROM public.profiles
    WHERE id = NEW.seller_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Vendeur introuvable pour la création de produit.';
    END IF;

    -- SuperAdmin bypass
    IF v_seller.role = 'superadmin' THEN
        RETURN NEW;
    END IF;

    -- Détermination du quota selon le pack actif (Découverte permanent 1 art. par défaut)
    IF v_seller.subscription_expires_at IS NOT NULL AND v_seller.subscription_expires_at > v_now THEN
        IF v_seller.subscription_plan = 'pro' OR v_seller.pack_actuel = 'pro' OR v_seller.subscription_plan = 'business' THEN
            v_max_products := 10; -- Pack Business (2 000 FCFA) : 10 produits max
        ELSE
            v_max_products := 5;  -- Pack Pro (1 000 FCFA) : 5 produits max
        END IF;
    ELSE
        v_max_products := 1;      -- Pack Découverte permanent (0 FCFA) : 1 produit max
    END IF;

    -- Comptage des produits actifs déjà existants du vendeur
    SELECT COUNT(*) INTO v_current_count
    FROM public.products
    WHERE seller_id = NEW.seller_id
      AND is_active IS NOT FALSE
      AND stock != 0;

    IF v_current_count >= v_max_products THEN
        RAISE EXCEPTION 'Limite atteinte : Votre formule autorise un maximum de % produit(s) actif(s). Veuillez masquer ou supprimer un produit existant pour en ajouter un nouveau.', v_max_products;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_product_quota_before_insert ON public.products;
CREATE TRIGGER trg_check_product_quota_before_insert
BEFORE INSERT ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.check_product_quota_before_insert();

COMMENT ON FUNCTION public.check_product_quota_before_insert IS 'Bloque côté serveur l ajout d articles au-delà du quota du pack actif (Découverte: 1, Pro: 5, Business: 10).';

-- 4. MISE À JOUR DE check_and_reserve_order_quota : VENTES ILLIMITÉES POUR PRO ET BUSINESS (SEULEMENT DÉCOUVERTE LIMITÉ À 5)
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
    -- 1. Existence et ouverture boutique
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

    -- 2. Anti-fraude FR-03 : Commande chez soi interdite
    IF (p_buyer_id IS NOT NULL AND p_buyer_id = p_seller_id) OR 
       (clean_buyer_phone <> '' AND clean_seller_phone <> '' AND clean_buyer_phone = clean_seller_phone) THEN
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (p_buyer_id, 'REJET_FR03_COMMANDE_CHEZ_SOI', 'orders', p_seller_id::text, jsonb_build_object('buyer_phone', clean_buyer_phone));

        RETURN jsonb_build_object('allowed', false, 'error_code', 'SELF_ORDER_FORBIDDEN', 'message', 'Vous ne pouvez pas commander dans votre propre boutique.');
    END IF;

    -- 3. Anti-fraude FR-04 : 2 commandes max par jour chez le même vendeur
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

    -- 4. Anti-fraude FR-05 : Même chambre
    IF TRIM(COALESCE(p_buyer_pavillon, '')) <> '' AND TRIM(COALESCE(p_buyer_chambre, '')) <> '' AND
       TRIM(COALESCE(seller_rec.pavillon, '')) <> '' AND TRIM(COALESCE(seller_rec.chambre, '')) <> '' THEN
        IF LOWER(TRIM(p_buyer_pavillon)) = LOWER(TRIM(seller_rec.pavillon)) AND
           LOWER(TRIM(p_buyer_chambre)) = LOWER(TRIM(seller_rec.chambre)) THEN
            is_same_room_order := TRUE;
        END IF;
    END IF;

    -- 5. DETERMINATION DES OFFRES & LIMITES DE VENTES
    -- Pack Payant actif (subscription_expires_at > NOW())
    IF seller_rec.subscription_expires_at IS NOT NULL AND seller_rec.subscription_expires_at > NOW() THEN
        IF seller_rec.subscription_plan = 'pro' OR seller_rec.pack_actuel = 'pro' OR seller_rec.subscription_plan = 'business' THEN
            seller_pack := 'pro';     -- Pack Business (2 000 FCFA)
            max_monthly_orders := 999999; -- Commandes illimitées
            max_validated_sales := 999999; -- Ventes illimitées
            max_active_products := 10;
        ELSE
            seller_pack := 'starter'; -- Pack Pro (1 000 FCFA)
            max_monthly_orders := 999999; -- NOUVEAU : Commandes illimitées
            max_validated_sales := 999999; -- NOUVEAU : Ventes illimitées
            max_active_products := 5;
        END IF;
    ELSIF seller_rec.trial_ends_at IS NOT NULL AND seller_rec.trial_ends_at > NOW() THEN
        seller_pack := 'essai_7j';
        max_monthly_orders := 999999;
        max_validated_sales := 999999;
        max_active_products := 3;
    ELSE
        -- Pack Découverte (0 FCFA) : 5 ventes validées max par mois
        seller_pack := 'decouverte';
        max_monthly_orders := 15;
        max_validated_sales := 5;
        max_active_products := 1;
    END IF;

    -- 6. CONTRÔLE DU PLAFOND DE VENTES (UNIQUEMENT POUR PACK DÉCOUVERTE)
    IF seller_pack = 'decouverte' THEN
        start_of_month := DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Dakar');
        IF seller_rec.date_bascule IS NOT NULL AND seller_rec.date_bascule > start_of_month THEN
            start_of_month := seller_rec.date_bascule;
        END IF;

        -- Vérification limite commandes reçues
        SELECT COUNT(*) INTO monthly_orders_count
        FROM public.orders
        WHERE seller_id = p_seller_id AND created_at >= start_of_month;

        IF monthly_orders_count >= max_monthly_orders THEN
            INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
            VALUES (p_buyer_id, 'REJET_QUOTA_COMMANDES_MOIS', 'orders', p_seller_id::text, 
                    jsonb_build_object('pack', seller_pack, 'orders_count', monthly_orders_count, 'limit', max_monthly_orders));

            RETURN jsonb_build_object(
                'allowed', false, 
                'error_code', 'QUOTA_ORDERS_EXCEEDED', 
                'message', 'Ce vendeur est momentanément indisponible.',
                'seller_message', 'Votre quota mensuel de 15 commandes en Pack Découverte est atteint. Passez au Pack Pro pour continuer à recevoir des commandes illimitées.'
            );
        END IF;

        -- Vérification limite ventes validées
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
                'seller_message', 'Votre quota mensuel de 5 ventes validées est engagé. Passez au Pack Pro pour débloquer les ventes illimitées.'
            );
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'allowed', true,
        'is_same_room', is_same_room_order,
        'pack', seller_pack,
        'max_orders', max_monthly_orders,
        'max_sales', max_validated_sales
    );
END;
$$;

-- 5. RPC PROMOTION DE PRODUIT : 1/MOIS (PRO, RESET 1ER DU MOIS) ET 1/SEMAINE (BUSINESS, RESET LUNDI 00H00 DAKAR)
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
    v_used_promotions INT;
    v_is_business BOOLEAN;
    v_promoted_until TIMESTAMPTZ;
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
        RETURN jsonb_build_object('success', false, 'message', 'La promotion de produit est réservée aux abonnés des formules Pro (1 000 F) et Business (2 000 F).');
    END IF;

    -- Vérification produit et propriété
    SELECT id, seller_id, title, is_active, stock INTO v_product
    FROM public.products
    WHERE id = p_product_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Produit introuvable.');
    END IF;

    IF v_product.seller_id <> v_user_id THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ce produit ne vous appartient pas.');
    END IF;

    v_is_business := (v_profile.subscription_plan = 'pro' OR v_profile.pack_actuel = 'pro' OR v_profile.subscription_plan = 'business');

    -- Détermination de la date de début de période (Africa/Dakar)
    IF v_is_business THEN
        -- Business : remise à zéro chaque lundi à 00h00 heure de Dakar
        v_period_start := DATE_TRUNC('week', NOW() AT TIME ZONE 'Africa/Dakar');
    ELSE
        -- Pro : remise à zéro le 1er de chaque mois heure de Dakar
        v_period_start := DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Dakar');
    END IF;

    -- Réinitialisation automatique du compteur si nouvelle période entamée
    IF v_profile.promotions_period_start IS NULL OR v_profile.promotions_period_start < v_period_start THEN
        v_used_promotions := 0;
    ELSE
        v_used_promotions := COALESCE(v_profile.promotions_used_this_period, 0);
    END IF;

    -- Contrôle du quota : 1 seule promotion autorisée par période
    IF v_used_promotions >= 1 THEN
        IF v_is_business THEN
            RETURN jsonb_build_object(
                'success', false,
                'message', 'Vous avez utilisé votre promotion de la semaine. Prochaine disponible lundi.'
            );
        ELSE
            RETURN jsonb_build_object(
                'success', false,
                'message', 'Vous avez utilisé votre promotion du mois. Prochaine disponible le 1er du mois.'
            );
        END IF;
    END IF;

    -- Activation de la mise en avant pour 7 jours
    v_promoted_until := NOW() + INTERVAL '7 days';

    UPDATE public.products
    SET is_promoted = TRUE,
        promoted_until = v_promoted_until,
        updated_at = NOW()
    WHERE id = p_product_id;

    -- Incrémentation du compteur profil
    UPDATE public.profiles
    SET promotions_used_this_period = v_used_promotions + 1,
        promotions_period_start = CASE 
            WHEN v_profile.promotions_period_start < v_period_start OR v_profile.promotions_period_start IS NULL 
            THEN v_period_start 
            ELSE v_profile.promotions_period_start 
        END
    WHERE id = v_user_id;

    -- Traçabilité dans audit_logs
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
        v_user_id,
        'PROMOTION_PRODUIT_ACTIVEE',
        'products',
        p_product_id::text,
        jsonb_build_object(
            'product_id', p_product_id,
            'product_title', v_product.title,
            'pack', CASE WHEN v_is_business THEN 'business' ELSE 'pro' END,
            'promoted_until', v_promoted_until,
            'duration_days', 7
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Votre produit est mis en avant avec succès pour 7 jours !',
        'promoted_until', v_promoted_until,
        'promotions_remaining', 0
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.use_product_promotion(UUID) TO authenticated;
COMMENT ON FUNCTION public.use_product_promotion IS 'Consomme 1 promotion de 7 jours (1/mois Pro, 1/semaine reset lundi Dakar Business) avec traçabilité.';

-- 6. PROCÉDURE RÉVERSIBLE : MASQUAGE DES PRODUITS EXCÉDENTAIRES SANS AUCUNE SUPPRESSION
CREATE OR REPLACE FUNCTION public.mask_excess_products_for_sellers()
RETURNS TABLE (
    seller_id UUID,
    masked_product_id UUID,
    product_title TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_seller RECORD;
    v_max_allowed INT;
    v_prod RECORD;
    v_count INT;
BEGIN
    FOR v_seller IN 
        SELECT id, subscription_plan, subscription_status, subscription_expires_at, pack_actuel, role
        FROM public.profiles
        WHERE role = 'vendeur'
    LOOP
        -- Déterminer la limite autorisée
        IF v_seller.subscription_expires_at IS NOT NULL AND v_seller.subscription_expires_at > NOW() THEN
            IF v_seller.subscription_plan = 'pro' OR v_seller.pack_actuel = 'pro' OR v_seller.subscription_plan = 'business' THEN
                v_max_allowed := 10;
            ELSE
                v_max_allowed := 5;
            END IF;
        ELSE
            v_max_allowed := 1; -- Découverte
        END IF;

        v_count := 0;
        -- Parcours des produits actifs ordonnés par dernière mise à jour/création décroissante
        FOR v_prod IN 
            SELECT id, title, is_active, stock
            FROM public.products
            WHERE products.seller_id = v_seller.id
              AND is_active IS NOT FALSE
              AND stock != 0
            ORDER BY created_at DESC
        LOOP
            v_count := v_count + 1;
            IF v_count > v_max_allowed THEN
                -- Masquer le produit excédentaire SANS le supprimer
                UPDATE public.products
                SET is_active = FALSE,
                    quota_status = 'masqué_quota'
                WHERE id = v_prod.id;

                INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
                VALUES (v_seller.id, 'MASQUAGE_PRODUIT_EXCEDENTAIRE_OFFRES', 'products', v_prod.id::text,
                        jsonb_build_object('max_allowed', v_max_allowed, 'title', v_prod.title));

                seller_id := v_seller.id;
                masked_product_id := v_prod.id;
                product_title := v_prod.title;
                RETURN NEXT;
            END IF;
        END LOOP;
    END LOOP;
END;
$$;
