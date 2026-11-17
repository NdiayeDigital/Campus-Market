-- ====================================================================================
-- CAMPUS MARKET — MIGRATION ADDITIVE : ANNONCES (250 FCFA), PACK DÉCOUVERTE & QUOTAS
-- Fichier : database/migration_annonces_and_quotas_v1.sql
-- Plateforme : Campus Market UIDT (Université Iba Der Thiam de Thiès)
-- ====================================================================================
-- RÈGLE D'OR : STRICTEMENT ADDITIF, IDEMPOTENT (relançable sans erreur) ET SANS PERTE DE DONNÉES.
-- ====================================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. COLONNES ADDITIVES SUR public.profiles (Pour la gestion fine des packs et bascule)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pack_actuel TEXT DEFAULT 'essai_7j';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pack_fin TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_bascule TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ancien_pack TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS motif_bascule TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS produit_conserve_choisi UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_extended_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_extension_reason TEXT;

COMMENT ON COLUMN public.profiles.pack_actuel IS 'Formule effective du vendeur : essai_7j, decouverte, starter, pro';
COMMENT ON COLUMN public.profiles.pack_fin IS 'Date d échéance du pack si applicable';
COMMENT ON COLUMN public.profiles.date_bascule IS 'Date exacte de transition vers le pack Découverte';
COMMENT ON COLUMN public.profiles.ancien_pack IS 'Historique du pack précédent avant bascule';
COMMENT ON COLUMN public.profiles.motif_bascule IS 'Raison de la bascule (ex: expiration_essai_7j, fin_abonnement_payant)';
COMMENT ON COLUMN public.profiles.produit_conserve_choisi IS 'UUID du produit choisi manuellement par le vendeur pour rester actif';
COMMENT ON COLUMN public.profiles.trial_extended_ends_at IS 'Date de prolongation manuelle de l essai par le SuperAdmin';
COMMENT ON COLUMN public.profiles.trial_extension_reason IS 'Motif de prolongation de l essai accordée par le SuperAdmin';

-- 3. COLONNES ADDITIVES SUR public.products (Pour le masquage sans suppression)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quota_status TEXT DEFAULT 'actif';

COMMENT ON COLUMN public.products.is_active IS 'Indicateur de visibilité publique : TRUE = actif, FALSE = masqué';
COMMENT ON COLUMN public.products.quota_status IS 'Statut de quota : actif, masqué_quota, désactivé_vendeur';

-- Index d optimisation pour le filtrage rapide des produits actifs
CREATE INDEX IF NOT EXISTS idx_products_seller_active ON public.products (seller_id, is_active);

-- 4. COLONNES ADDITIVES SUR public.orders (Pour la double confirmation et même chambre)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_confirmed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_same_room BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.orders.buyer_confirmed_at IS 'Horodatage de confirmation de bonne réception par l acheteur (Double confirmation FR-06)';
COMMENT ON COLUMN public.orders.is_same_room IS 'TRUE si la commande provient de la même chambre que le vendeur (FR-05)';

CREATE INDEX IF NOT EXISTS idx_orders_seller_created ON public.orders (seller_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON public.orders (seller_id, status);

-- 5. TABLE JOURNAL D AUDIT IMMUABLE : public.audit_logs (FR-15)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.audit_logs IS 'Journal d audit sécurisé immuable (FR-15) pour les quotas, annonces et bascules';

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Politique RLS : Lecture réservée au SuperAdmin
DROP POLICY IF EXISTS "SuperAdmin peut lire le journal d audit" ON public.audit_logs;
CREATE POLICY "SuperAdmin peut lire le journal d audit"
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (public.is_super_admin(auth.uid()));

-- Politique RLS : Insertion autorisée via fonctions système / RPC
DROP POLICY IF EXISTS "Insertion dans le journal d audit" ON public.audit_logs;
CREATE POLICY "Insertion dans le journal d audit"
    ON public.audit_logs
    FOR INSERT
    TO authenticated, anon
    WITH CHECK (true);

-- 6. TABLE DES ANNONCES PAYANTES : public.advertisements (250 FCFA - FR-19)
CREATE TABLE IF NOT EXISTS public.advertisements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title VARCHAR(60) NOT NULL,
    content VARCHAR(300) NOT NULL,
    image_url TEXT,
    link_url TEXT,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) DEFAULT 250.00 NOT NULL CHECK (amount = 250.00),
    operator TEXT DEFAULT 'wave' CHECK (operator IN ('wave', 'om')),
    transaction_ref TEXT,
    status TEXT DEFAULT 'a_valider' CHECK (status IN ('brouillon', 'paiement_en_attente', 'a_valider', 'publiee', 'refusee', 'expiree')),
    rejection_reason TEXT,
    validated_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_advertisement_txn_ref UNIQUE (transaction_ref)
);

COMMENT ON TABLE public.advertisements IS 'Annonces promotionnelles des vendeurs (250 FCFA, 7 jours, FR-19)';

ALTER TABLE public.advertisements ENABLE ROW LEVEL SECURITY;

-- Politiques RLS advertisements :
-- Tout le monde peut voir les annonces publiées non expirées
DROP POLICY IF EXISTS "Tout le monde peut voir les annonces publiées" ON public.advertisements;
CREATE POLICY "Tout le monde peut voir les annonces publiées"
    ON public.advertisements
    FOR SELECT
    TO anon, authenticated
    USING (
        (status = 'publiee' AND expires_at > NOW())
        OR (auth.uid() IS NOT NULL AND seller_id = auth.uid())
        OR (auth.uid() IS NOT NULL AND public.is_super_admin(auth.uid()))
    );

-- Le vendeur authentifié peut insérer ses propres annonces
DROP POLICY IF EXISTS "Vendeur peut créer ses annonces" ON public.advertisements;
CREATE POLICY "Vendeur peut créer ses annonces"
    ON public.advertisements
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = seller_id);

-- Seul le SuperAdmin peut modifier le statut (valider / refuser)
DROP POLICY IF EXISTS "SuperAdmin peut modifier les annonces" ON public.advertisements;
CREATE POLICY "SuperAdmin peut modifier les annonces"
    ON public.advertisements
    FOR UPDATE
    TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

-- 7. FONCTIONS PROCÉDURES STOCKÉES ATOMIQUES ET SÉCURISÉES (CÔTÉ SERVEUR)

-- 7.1 Réservation atomique de quota de commande (avec SELECT FOR UPDATE pour éviter la concurrence critique)
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
SET search_path = public, auth
AS $$
DECLARE
    seller_rec RECORD;
    clean_buyer_phone TEXT;
    clean_seller_phone TEXT;
    is_same_room_order BOOLEAN := FALSE;
    start_of_month TIMESTAMP WITH TIME ZONE;
    daily_buyer_orders_count INTEGER;
    monthly_orders_count INTEGER;
    validated_sales_count INTEGER;
    ongoing_orders_count INTEGER;
    active_products_count INTEGER;
    seller_pack TEXT;
    max_monthly_orders INTEGER := 15;
    max_validated_sales INTEGER := 5;
    max_active_products INTEGER := 1;
BEGIN
    -- 1. Verrouillage exclusif de la ligne du vendeur pour empêcher toute race condition
    SELECT * INTO seller_rec 
    FROM public.profiles 
    WHERE id = p_seller_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('allowed', false, 'error_code', 'SELLER_NOT_FOUND', 'message', 'Ce vendeur est introuvable.');
    END IF;

    -- Contrôle vendeur suspendu / désactivé
    IF seller_rec.role IN ('vendeur_desactive', 'suspendu') OR seller_rec.is_suspended IS TRUE THEN
        RETURN jsonb_build_object('allowed', false, 'error_code', 'SELLER_SUSPENDED', 'message', 'Ce vendeur est momentanément indisponible.');
    END IF;

    -- Contrôle boutique fermée
    IF seller_rec.is_open IS FALSE THEN
        RETURN jsonb_build_object('allowed', false, 'error_code', 'SHOP_CLOSED', 'message', 'La boutique de ce vendeur est actuellement fermée.');
    END IF;

    -- Nettoyage des téléphones
    clean_buyer_phone := REGEXP_REPLACE(COALESCE(p_buyer_phone, ''), '[^0-9]', '', 'g');
    clean_seller_phone := REGEXP_REPLACE(COALESCE(seller_rec.telephone, ''), '[^0-9]', '', 'g');

    -- 2. RÈGLE FR-03 : Interdiction stricte de commander chez soi
    IF (p_buyer_id IS NOT NULL AND p_buyer_id = p_seller_id) OR 
       (clean_buyer_phone <> '' AND clean_seller_phone <> '' AND clean_buyer_phone = clean_seller_phone) THEN
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (p_buyer_id, 'REJET_FR03_COMMANDE_CHEZ_SOI', 'orders', p_seller_id::text, jsonb_build_object('buyer_phone', clean_buyer_phone));
        
        RETURN jsonb_build_object('allowed', false, 'error_code', 'FR03_SELF_ORDER', 'message', 'Action non autorisée : Vous ne pouvez pas commander vos propres articles.');
    END IF;

    -- 3. RÈGLE FR-04 : Maximum 2 commandes par jour chez un même vendeur pour un acheteur donné
    SELECT COUNT(*) INTO daily_buyer_orders_count
    FROM public.orders
    WHERE seller_id = p_seller_id
      AND (
          (p_buyer_id IS NOT NULL AND buyer_id = p_buyer_id)
          OR (clean_buyer_phone <> '' AND REGEXP_REPLACE(buyer_phone, '[^0-9]', '', 'g') = clean_buyer_phone)
      )
      AND created_at >= (NOW() AT TIME ZONE 'Africa/Dakar')::DATE
      AND status <> 'cancelled';

    IF daily_buyer_orders_count >= 2 THEN
        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (p_buyer_id, 'REJET_FR04_LIMITE_JOURNALIERE', 'orders', p_seller_id::text, jsonb_build_object('daily_count', daily_buyer_orders_count));

        RETURN jsonb_build_object('allowed', false, 'error_code', 'FR04_DAILY_LIMIT', 'message', 'Limite atteinte : Vous ne pouvez passer que 2 commandes par jour chez ce marchand.');
    END IF;

    -- 4. RÈGLE FR-05 : Détection même chambre
    IF TRIM(COALESCE(p_buyer_pavillon, '')) <> '' AND TRIM(COALESCE(p_buyer_chambre, '')) <> '' AND
       TRIM(COALESCE(seller_rec.pavillon, '')) <> '' AND TRIM(COALESCE(seller_rec.chambre, '')) <> '' THEN
        IF LOWER(TRIM(p_buyer_pavillon)) = LOWER(TRIM(seller_rec.pavillon)) AND
           LOWER(TRIM(p_buyer_chambre)) = LOWER(TRIM(seller_rec.chambre)) THEN
            is_same_room_order := TRUE;
        END IF;
    END IF;

    -- 5. DÉTERMINATION DU PACK ACTUEL DU VENDEUR
    -- Si pack payant actif
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
    -- Si essai en cours (trial_ends_at dans le futur)
    ELSIF seller_rec.trial_ends_at IS NOT NULL AND seller_rec.trial_ends_at > NOW() THEN
        seller_pack := 'essai_7j';
        max_monthly_orders := 999999; -- Pas de limite stricte sur commandes pendant l'essai
        max_validated_sales := 999999;
        max_active_products := 3;
    -- Sinon : Pack Découverte (0 FCFA)
    ELSE
        seller_pack := 'decouverte';
        max_monthly_orders := 15;
        max_validated_sales := 5;
        max_active_products := 1;
    END IF;

    -- 6. CONTRÔLE DES QUOTAS MENSUELS (SI EN PACK DÉCOUVERTE)
    IF seller_pack = 'decouverte' THEN
        -- Début du mois en fuseau Africa/Dakar
        start_of_month := DATE_TRUNC('month', NOW() AT TIME ZONE 'Africa/Dakar');
        
        -- Si COMPTEURS_DEPUIS_BASCULE est applicable et que le vendeur a une date de bascule récente dans le mois
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
            VALUES (p_buyer_id, 'REJET_QUOTA_COMMANDES_MOIS', 'orders', p_seller_id::text, jsonb_build_object('pack', seller_pack, 'orders_count', monthly_orders_count, 'limit', max_monthly_orders));

            RETURN jsonb_build_object(
                'allowed', false, 
                'error_code', 'QUOTA_ORDERS_EXCEEDED', 
                'message', 'Ce vendeur est momentanément indisponible.',
                'seller_message', 'Votre quota mensuel de 15 commandes en pack Découverte est atteint. Passez au pack Pro pour continuer à recevoir des commandes.'
            );
        END IF;

        -- B. Ventes validées (double confirmation) + Commandes en cours
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
            VALUES (p_buyer_id, 'REJET_QUOTA_VENTES_MOIS', 'orders', p_seller_id::text, jsonb_build_object('pack', seller_pack, 'validated', validated_sales_count, 'ongoing', ongoing_orders_count, 'limit', max_validated_sales));

            RETURN jsonb_build_object(
                'allowed', false, 
                'error_code', 'QUOTA_SALES_EXCEEDED', 
                'message', 'Ce vendeur est momentanément indisponible.',
                'seller_message', 'Votre quota mensuel de 5 ventes validées est engagé. Passez au pack Pro pour débloquer les ventes illimitées.'
            );
        END IF;
    END IF;

    -- Tout est conforme
    RETURN jsonb_build_object(
        'allowed', true,
        'seller_pack', seller_pack,
        'is_same_room', is_same_room_order,
        'monthly_orders_count', COALESCE(monthly_orders_count, 0),
        'max_monthly_orders', max_monthly_orders
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_reserve_order_quota(UUID, TEXT, TEXT, TEXT, UUID) TO anon, authenticated;

-- 7.2 Double confirmation de réception par l acheteur
CREATE OR REPLACE FUNCTION public.confirm_order_received_by_buyer(
    p_order_id UUID,
    p_phone TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    order_rec RECORD;
    clean_phone TEXT;
BEGIN
    SELECT * INTO order_rec FROM public.orders WHERE id = p_order_id FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Commande introuvable.');
    END IF;

    IF order_rec.status <> 'delivered' THEN
        RETURN jsonb_build_object('success', false, 'message', 'La commande doit être marquée comme livrée avant confirmation.');
    END IF;

    IF order_rec.buyer_confirmed_at IS NOT NULL THEN
        RETURN jsonb_build_object('success', true, 'message', 'Commande déjà confirmée.', 'already_confirmed', true);
    END IF;

    UPDATE public.orders
    SET buyer_confirmed_at = NOW()
    WHERE id = p_order_id;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (auth.uid(), 'CONFIRMATION_RECEPTION_ACHETEUR', 'orders', p_order_id::text, jsonb_build_object('seller_id', order_rec.seller_id));

    RETURN jsonb_build_object('success', true, 'message', 'Merci ! Votre réception est confirmée.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_order_received_by_buyer(UUID, TEXT) TO anon, authenticated;

-- 7.3 Soumission d une annonce payante (250 FCFA) avec contrôle de limite
CREATE OR REPLACE FUNCTION public.submit_advertisement(
    p_title TEXT,
    p_content TEXT,
    p_image_url TEXT DEFAULT NULL,
    p_link_url TEXT DEFAULT NULL,
    p_product_id UUID DEFAULT NULL,
    p_operator TEXT DEFAULT 'wave',
    p_transaction_ref TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_uid UUID;
    pending_ads_count INTEGER;
    clean_title TEXT;
    clean_content TEXT;
    clean_ref TEXT;
    new_ad_id UUID;
BEGIN
    caller_uid := auth.uid();
    IF caller_uid IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vous devez être connecté pour soumettre une annonce.');
    END IF;

    clean_title := TRIM(COALESCE(p_title, ''));
    clean_content := TRIM(COALESCE(p_content, ''));
    clean_ref := TRIM(COALESCE(p_transaction_ref, ''));

    IF LENGTH(clean_title) < 3 OR LENGTH(clean_title) > 60 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Le titre de l annonce doit comporter entre 3 et 60 caractères.');
    END IF;

    IF LENGTH(clean_content) < 10 OR LENGTH(clean_content) > 300 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Le texte de l annonce doit comporter entre 10 et 300 caractères.');
    END IF;

    IF clean_ref = '' THEN
        RETURN jsonb_build_object('success', false, 'message', 'La référence de transaction de paiement est obligatoire.');
    END IF;

    -- Contrôle d unicité de la référence de paiement (FR-19)
    IF EXISTS (SELECT 1 FROM public.advertisements WHERE transaction_ref = clean_ref) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Cette référence de paiement a déjà été utilisée sur la plateforme.');
    END IF;

    -- Contrôle limite de 3 annonces en attente par vendeur
    SELECT COUNT(*) INTO pending_ads_count
    FROM public.advertisements
    WHERE seller_id = caller_uid
      AND status IN ('a_valider', 'paiement_en_attente');

    IF pending_ads_count >= 3 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Vous avez déjà 3 annonces en attente de validation. Veuillez attendre leur traitement.');
    END IF;

    INSERT INTO public.advertisements (
        seller_id,
        title,
        content,
        image_url,
        link_url,
        product_id,
        amount,
        operator,
        transaction_ref,
        status,
        created_at,
        updated_at
    )
    VALUES (
        caller_uid,
        clean_title,
        clean_content,
        p_image_url,
        p_link_url,
        p_product_id,
        250.00,
        LOWER(TRIM(p_operator)),
        clean_ref,
        'a_valider',
        NOW(),
        NOW()
    )
    RETURNING id INTO new_ad_id;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (caller_uid, 'CREATION_ANNONCE_250F', 'advertisements', new_ad_id::text, jsonb_build_object('title', clean_title, 'transaction_ref', clean_ref));

    RETURN jsonb_build_object('success', true, 'ad_id', new_ad_id, 'message', 'Votre annonce a été transmise avec succès pour validation.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_advertisement(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated;

-- 7.4 Modération SuperAdmin des annonces (Valider / Refuser avec motif)
CREATE OR REPLACE FUNCTION public.admin_moderate_advertisement(
    p_ad_id UUID,
    p_action TEXT,
    p_reason TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_uid UUID;
    ad_rec RECORD;
BEGIN
    caller_uid := auth.uid();
    IF caller_uid IS NULL OR NOT public.is_super_admin(caller_uid) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Action réservée aux Super Administrateurs.');
    END IF;

    SELECT * INTO ad_rec FROM public.advertisements WHERE id = p_ad_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Annonce introuvable.');
    END IF;

    IF LOWER(p_action) = 'valider' THEN
        UPDATE public.advertisements
        SET status = 'publiee',
            validated_at = NOW(),
            expires_at = NOW() + INTERVAL '7 days',
            rejection_reason = NULL,
            updated_at = NOW()
        WHERE id = p_ad_id;

        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (caller_uid, 'VALIDATION_ANNONCE_SUPERADMIN', 'advertisements', p_ad_id::text, jsonb_build_object('seller_id', ad_rec.seller_id));

        RETURN jsonb_build_object('success', true, 'message', 'Annonce validée et publiée pour 7 jours.');
    ELSIF LOWER(p_action) = 'refuser' THEN
        UPDATE public.advertisements
        SET status = 'refusee',
            rejection_reason = TRIM(COALESCE(p_reason, 'Non conforme aux règles de publication')),
            updated_at = NOW()
        WHERE id = p_ad_id;

        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
        VALUES (caller_uid, 'REFUS_ANNONCE_SUPERADMIN', 'advertisements', p_ad_id::text, jsonb_build_object('seller_id', ad_rec.seller_id, 'reason', p_reason));

        RETURN jsonb_build_object('success', true, 'message', 'Annonce refusée.');
    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Action non reconnue (utiliser valider ou refuser).');
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_moderate_advertisement(UUID, TEXT, TEXT) TO authenticated;
