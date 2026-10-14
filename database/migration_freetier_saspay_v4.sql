-- ====================================================================================
-- CAMPUS MARKET — MIGRATION FREE TIER 7J, 3 FORMULES & PAIEMENTS SASPAY (v4)
-- À exécuter dans le "SQL Editor" de Supabase :
-- https://supabase.com/dashboard/project/fqulqgdjusfzhcjpvyay/sql/new
-- Script idempotent : peut être ré-exécuté sans risque
-- ====================================================================================

-- 1. AJOUT DES COLONNES POUR L'ESSAI GRATUIT & LES DATES D'ABONNEMENT
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_payment_id TEXT;

-- 2. TABLE D'HISTORIQUE DES PAIEMENTS MARCHANDS (SASPAY / WAVE / OM)
CREATE TABLE IF NOT EXISTS public.seller_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'XOF',
    plan TEXT NOT NULL CHECK (plan IN ('starter', 'pro', 'premium')),
    operator TEXT NOT NULL CHECK (operator IN ('wave', 'om', 'card', 'cash')),
    provider TEXT DEFAULT 'saspay',
    provider_session_id TEXT,
    provider_payment_id TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'refunded')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index pour requêtes rapides par vendeur et par session
CREATE INDEX IF NOT EXISTS idx_seller_payments_seller_id ON public.seller_payments(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_payments_session ON public.seller_payments(provider_session_id);

-- RLS pour la table des paiements
ALTER TABLE public.seller_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Les vendeurs peuvent voir leurs propres paiements" ON public.seller_payments;
CREATE POLICY "Les vendeurs peuvent voir leurs propres paiements" 
ON public.seller_payments FOR SELECT 
TO authenticated 
USING (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Les vendeurs peuvent initier un paiement" ON public.seller_payments;
CREATE POLICY "Les vendeurs peuvent initier un paiement" 
ON public.seller_payments FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = seller_id);

DROP POLICY IF EXISTS "Le SuperAdmin a accès complet aux paiements" ON public.seller_payments;
CREATE POLICY "Le SuperAdmin a accès complet aux paiements" 
ON public.seller_payments FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'superadmin'
    )
);

-- 3. INITIALISATION GRÂCE POUR LES VENDEURS ACTIFS EXISTANTS
-- On accorde 30 jours de validité aux vendeurs déjà existants pour éviter toute interruption
UPDATE public.profiles
SET 
    subscription_status = 'active',
    subscription_expires_at = COALESCE(subscription_expires_at, NOW() + INTERVAL '30 days'),
    trial_started_at = COALESCE(trial_started_at, created_at),
    trial_ends_at = COALESCE(trial_ends_at, created_at + INTERVAL '7 days')
WHERE role = 'vendeur' AND subscription_status IS NULL;

-- Initialisation de l'essai 7j pour les candidatures en attente
UPDATE public.profiles
SET 
    subscription_status = 'trial',
    trial_started_at = COALESCE(trial_started_at, NOW()),
    trial_ends_at = COALESCE(trial_ends_at, NOW() + INTERVAL '7 days')
WHERE role = 'vendeur_pending' AND trial_ends_at IS NULL;

-- 4. MISE À JOUR DU TRIGGER AUTOMATIQUE DE NOUVEL UTILISATEUR
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
    chosen_plan TEXT;
    prod_limit INTEGER;
    user_shop_name TEXT;
    user_shop_cat TEXT;
BEGIN
    IF NEW.raw_user_meta_data->>'role' = 'vendeur_pending' THEN
        assigned_role := 'vendeur_pending';
    ELSE
        assigned_role := 'acheteur';
    END IF;

    chosen_plan := COALESCE(NEW.raw_user_meta_data->>'subscription_plan', 'starter');
    -- En période d'essai gratuit 7j, le quota initial est de 3 articles.
    -- Lors de l'abonnement payé : Starter (5), Pro (10), Annuel VIP (50).
    prod_limit := 3;

    user_shop_name := COALESCE(NEW.raw_user_meta_data->>'shop_name', (COALESCE(NEW.raw_user_meta_data->>'prenom', 'Étudiant') || ' Shop'));
    user_shop_cat := COALESCE(NEW.raw_user_meta_data->>'shop_category', 'autres');

    INSERT INTO public.profiles (
        id, 
        prenom, 
        nom, 
        telephone, 
        email,
        shop_name,
        shop_category,
        subscription_plan,
        max_products,
        subscription_status,
        trial_started_at,
        trial_ends_at,
        role, 
        is_open
    )
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'prenom', 'Étudiant'),
        COALESCE(NEW.raw_user_meta_data->>'nom', 'UIDT'),
        COALESCE(NEW.raw_user_meta_data->>'telephone', ''),
        NEW.email,
        user_shop_name,
        user_shop_cat,
        chosen_plan,
        prod_limit,
        'trial',
        NOW(),
        NOW() + INTERVAL '7 days',
        assigned_role,
        true
    )
    ON CONFLICT (id) DO UPDATE 
    SET 
        prenom = EXCLUDED.prenom,
        nom = EXCLUDED.nom,
        email = COALESCE(EXCLUDED.email, public.profiles.email),
        shop_name = COALESCE(EXCLUDED.shop_name, public.profiles.shop_name),
        shop_category = COALESCE(EXCLUDED.shop_category, public.profiles.shop_category),
        subscription_plan = COALESCE(EXCLUDED.subscription_plan, public.profiles.subscription_plan),
        max_products = COALESCE(EXCLUDED.max_products, public.profiles.max_products),
        subscription_status = COALESCE(public.profiles.subscription_status, 'trial'),
        trial_started_at = COALESCE(public.profiles.trial_started_at, NOW()),
        trial_ends_at = COALESCE(public.profiles.trial_ends_at, NOW() + INTERVAL '7 days'),
        telephone = CASE WHEN EXCLUDED.telephone <> '' THEN EXCLUDED.telephone ELSE public.profiles.telephone END,
        role = CASE 
            WHEN public.profiles.role = 'superadmin' THEN 'superadmin'
            WHEN public.profiles.role = 'vendeur' THEN 'vendeur'
            ELSE assigned_role 
        END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
