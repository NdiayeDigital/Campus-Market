-- ====================================================================================
-- CAMPUS MARKET — MIGRATION SÉCURISATION DES ABONNEMENTS ET PAIEMENTS SASPAY
-- Empêche formellement l'auto-activation frauduleuse d'abonnement côté client.
-- À exécuter dans le "SQL Editor" de Supabase :
-- https://supabase.com/dashboard/project/fqulqgdjusfzhcjpvyay/sql/new
-- ====================================================================================

-- 1. EXTENSIONS & FONCTIONS UTILITAIRES
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Vérifie si l'utilisateur est SuperAdmin
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = user_id AND role = 'superadmin'
    );
$$;

-- 2. DÉCLENCHEUR DE SÉCURITÉ CONTRE LA MANIPULATION DU STATUT D'ABONNEMENT
-- Empêche tout utilisateur régulier (non-superadmin) de modifier lui-même subscription_status,
-- subscription_expires_at ou max_products via la console DevTools ou des appels REST non autorisés.
CREATE OR REPLACE FUNCTION public.protect_profile_subscription_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_uid UUID;
    caller_is_admin BOOLEAN;
BEGIN
    caller_uid := auth.uid();
    
    -- Si la mise à jour est exécutée dans le contexte d'une session utilisateur connectée
    IF caller_uid IS NOT NULL THEN
        SELECT public.is_super_admin(caller_uid) INTO caller_is_admin;
        
        -- Si l'appelant n'est PAS un SuperAdmin, interdire la modification directe des privilèges d'abonnement
        IF caller_is_admin IS NOT TRUE THEN
            IF (NEW.subscription_status IS DISTINCT FROM OLD.subscription_status AND NEW.subscription_status = 'active') OR
               (NEW.subscription_expires_at IS DISTINCT FROM OLD.subscription_expires_at AND NEW.subscription_expires_at > COALESCE(OLD.subscription_expires_at, NOW())) OR
               (NEW.max_products IS DISTINCT FROM OLD.max_products AND NEW.max_products > COALESCE(OLD.max_products, 3)) THEN
                RAISE EXCEPTION 'Action interdite : Seule l''administration ou la passerelle de paiement certifiée peut activer un abonnement marchand.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_subscription ON public.profiles;
CREATE TRIGGER trg_protect_profile_subscription
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_subscription_fields();

-- 3. FONCTION DE SOUMISSION DE PREUVE DE PAIEMENT VENDEUR
-- Permet au vendeur de déclarer son paiement SasPay / Wave / OM en attente de vérification
CREATE OR REPLACE FUNCTION public.submit_subscription_payment(
    p_plan TEXT,
    p_operator TEXT,
    p_transaction_ref TEXT,
    p_phone TEXT DEFAULT ''
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    current_user_id UUID;
    payment_amount NUMERIC(10, 2);
    new_payment_id UUID;
    clean_plan TEXT;
    clean_operator TEXT;
BEGIN
    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Vous devez être connecté pour soumettre un paiement.';
    END IF;

    clean_plan := LOWER(TRIM(p_plan));
    IF clean_plan NOT IN ('starter', 'pro', 'premium') THEN
        clean_plan := 'starter';
    END IF;

    clean_operator := LOWER(TRIM(p_operator));
    IF clean_operator NOT IN ('wave', 'om', 'card', 'cash') THEN
        clean_operator := 'wave';
    END IF;

    IF clean_plan = 'pro' THEN
        payment_amount := 2500.00;
    ELSE
        payment_amount := 1500.00;
    END IF;

    IF TRIM(COALESCE(p_transaction_ref, '')) = '' THEN
        RAISE EXCEPTION 'La référence de transaction ou le numéro payeur est obligatoire.';
    END IF;

    INSERT INTO public.seller_payments (
        seller_id,
        amount,
        currency,
        plan,
        operator,
        provider,
        provider_session_id,
        status,
        metadata,
        created_at,
        updated_at
    )
    VALUES (
        current_user_id,
        payment_amount,
        'XOF',
        clean_plan,
        clean_operator,
        'saspay',
        TRIM(p_transaction_ref),
        'pending',
        jsonb_build_object(
            'transaction_ref', TRIM(p_transaction_ref),
            'payer_phone', TRIM(COALESCE(p_phone, '')),
            'submitted_at', NOW()
        ),
        NOW(),
        NOW()
    )
    RETURNING id INTO new_payment_id;

    RETURN new_payment_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_subscription_payment(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 4. FONCTION ADMINISTRATIVE D'APPROBATION D'UN PAIEMENT (SUPERADMIN)
CREATE OR REPLACE FUNCTION public.admin_approve_subscription_payment(
    target_payment_id UUID,
    duration_days INT DEFAULT 30
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_uid UUID;
    is_admin BOOLEAN;
    pay_record RECORD;
    quota INT;
    new_expiry TIMESTAMP WITH TIME ZONE;
BEGIN
    caller_uid := auth.uid();
    SELECT public.is_super_admin(caller_uid) INTO is_admin;
    
    IF is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Action réservée aux Super Administrateurs.';
    END IF;

    SELECT * INTO pay_record 
    FROM public.seller_payments 
    WHERE id = target_payment_id;

    IF pay_record IS NULL THEN
        RAISE EXCEPTION 'Paiement introuvable.';
    END IF;

    -- Quotas d'articles selon la formule
    IF pay_record.plan = 'pro' THEN
        quota := 10;
    ELSIF pay_record.plan = 'premium' THEN
        quota := 20;
    ELSE
        quota := 5;
    END IF;

    new_expiry := NOW() + (duration_days || ' days')::INTERVAL;

    -- 1. Mettre à jour le profil du vendeur en tant qu'abonné actif
    UPDATE public.profiles
    SET 
        subscription_status = 'active',
        subscription_plan = pay_record.plan,
        max_products = quota,
        subscription_expires_at = new_expiry,
        last_payment_date = NOW(),
        last_payment_id = pay_record.provider_session_id,
        is_open = true
    WHERE id = pay_record.seller_id;

    -- 2. Marquer le paiement comme validé avec succès
    UPDATE public.seller_payments
    SET 
        status = 'success',
        metadata = pay_record.metadata || jsonb_build_object('approved_at', NOW(), 'approved_by', caller_uid),
        updated_at = NOW()
    WHERE id = target_payment_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_approve_subscription_payment(UUID, INT) TO authenticated;

-- 5. FONCTION ADMINISTRATIVE DE REJET D'UN PAIEMENT (SUPERADMIN)
CREATE OR REPLACE FUNCTION public.admin_reject_subscription_payment(
    target_payment_id UUID,
    rejection_reason TEXT DEFAULT 'Paiement non constaté ou référence invalide.'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_uid UUID;
    is_admin BOOLEAN;
    pay_record RECORD;
BEGIN
    caller_uid := auth.uid();
    SELECT public.is_super_admin(caller_uid) INTO is_admin;
    
    IF is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Action réservée aux Super Administrateurs.';
    END IF;

    SELECT * INTO pay_record 
    FROM public.seller_payments 
    WHERE id = target_payment_id;

    IF pay_record IS NULL THEN
        RAISE EXCEPTION 'Paiement introuvable.';
    END IF;

    UPDATE public.seller_payments
    SET 
        status = 'failed',
        metadata = pay_record.metadata || jsonb_build_object('rejected_at', NOW(), 'rejection_reason', rejection_reason, 'rejected_by', caller_uid),
        updated_at = NOW()
    WHERE id = target_payment_id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_reject_subscription_payment(UUID, TEXT) TO authenticated;
