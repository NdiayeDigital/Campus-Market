-- ====================================================================================
-- MIGRATION : RÉPARATION DES PROFILS VENDEURS ORPHELINS ET RÉSILIENCE RLS
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase (campusmarket-uidt.com)
-- Script strictement rétrocompatible et idempotent.
-- ====================================================================================

-- 1. Réparation des profils manquants dans public.profiles pour tout compte auth.users ayant des produits
INSERT INTO public.profiles (
    id,
    prenom,
    nom,
    email,
    role,
    subscription_plan,
    max_products,
    is_open,
    created_at
)
SELECT 
    u.id,
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'prenom'), ''), 'Vendeur'),
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'nom'), ''), 'UIDT'),
    u.email,
    'vendeur',
    COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'subscription_plan'), ''), 'decouverte'),
    10,
    true,
    COALESCE(u.created_at, NOW())
FROM auth.users u
WHERE u.id IN (
    SELECT DISTINCT seller_id 
    FROM public.products 
    WHERE seller_id IS NOT NULL
)
AND NOT EXISTS (
    SELECT 1 
    FROM public.profiles p 
    WHERE p.id = u.id
)
ON CONFLICT (id) DO NOTHING;

-- 2. Mise à jour de la politique RLS INSERT sur public.profiles
-- Permet aux utilisateurs authentifiés de créer leur profil avec les rôles légitimes (vendeur après validation OTP, vendeur_pending ou acheteur)
DROP POLICY IF EXISTS "L'utilisateur peut créer son profil" ON public.profiles;

CREATE POLICY "L'utilisateur peut créer son profil" 
ON public.profiles FOR INSERT 
WITH CHECK (
    auth.uid() = id AND 
    role IN ('acheteur', 'vendeur_pending', 'vendeur')
);

-- 3. Réactivation des produits passés en masqué_quota pour les vendeurs actifs
UPDATE public.products
SET 
    is_active = true,
    quota_status = 'actif'
WHERE 
    quota_status = 'masqué_quota' 
    AND is_active = false
    AND seller_id IN (
        SELECT id FROM public.profiles 
        WHERE role = 'vendeur' OR role = 'superadmin' OR role = 'vendeur_pending'
    );

-- 4. Notification et vérification d'intégrité
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT p.seller_id)
    INTO orphan_count
    FROM public.products p
    LEFT JOIN public.profiles prof ON prof.id = p.seller_id
    WHERE prof.id IS NULL;

    IF orphan_count = 0 THEN
        RAISE NOTICE 'Migration réussie : tous les produits sont rattachés à un profil vendeur valide.';
    ELSE
        RAISE WARNING 'Attention : il subsiste % vendeurs avec des produits mais sans profil dans profiles.', orphan_count;
    END IF;
END $$;
