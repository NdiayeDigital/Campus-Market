-- ====================================================================================
-- CAMPUS MARKET — MIGRATION APPROBATION VENDEURS & LIMITES D'ABONNEMENT
-- À exécuter dans le "SQL Editor" de Supabase :
-- https://supabase.com/dashboard/project/fqulqgdjusfzhcjpvyay/sql/new
-- Script idempotent : peut être ré-exécuté sans risque
-- ====================================================================================

-- 1. AJOUT DES COLONNES POUR BOUTIQUE, FORMULE & QUOTA SUR PROFILES
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shop_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shop_category TEXT DEFAULT 'autres';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_plan TEXT DEFAULT 'starter';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_products INTEGER DEFAULT 5;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Mettre à jour les comptes existants sans formule
UPDATE public.profiles 
SET subscription_plan = 'starter', max_products = 5 
WHERE subscription_plan IS NULL;

-- 2. ASSOUPLISSEMENT RLS POUR L'INSERTION DES CANDIDATURES VENDEUR
-- Permet à l'API client d'enregistrer le profil 'vendeur_pending' même si la confirmation d'email Supabase n'est pas encore finalisée
DROP POLICY IF EXISTS "L'utilisateur peut créer son profil" ON public.profiles;
CREATE POLICY "L'utilisateur peut créer son profil" 
ON public.profiles FOR INSERT 
WITH CHECK (
    role IN ('acheteur', 'vendeur_pending')
);

-- 3. MISE À JOUR DU TRIGGER AUTOMATIQUE (auth.users -> profiles)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
    chosen_plan TEXT;
    prod_limit INTEGER;
    user_shop_name TEXT;
    user_shop_cat TEXT;
BEGIN
    -- Règle stricte anti-élévation de privilèges :
    IF NEW.raw_user_meta_data->>'role' = 'vendeur_pending' THEN
        assigned_role := 'vendeur_pending';
    ELSE
        assigned_role := 'acheteur';
    END IF;

    -- Formule et limite de produits
    chosen_plan := COALESCE(NEW.raw_user_meta_data->>'subscription_plan', 'starter');
    prod_limit := CASE WHEN chosen_plan = 'pro' THEN 10 ELSE 5 END;
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
        telephone = CASE WHEN EXCLUDED.telephone <> '' THEN EXCLUDED.telephone ELSE public.profiles.telephone END,
        role = CASE 
            WHEN public.profiles.role = 'superadmin' THEN 'superadmin'
            WHEN public.profiles.role = 'vendeur' THEN 'vendeur'
            ELSE assigned_role 
        END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- S'assurer que le trigger est attaché
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
