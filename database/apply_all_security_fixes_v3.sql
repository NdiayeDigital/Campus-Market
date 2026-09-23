-- ====================================================================================
-- CAMPUS MARKET UIDT — CORRECTIF DE SÉCURITÉ CONSOLIDÉ CLÉ EN MAIN (v3)
-- À copier et exécuter dans le "SQL Editor" de votre projet Supabase
-- Script 100% idempotent (peut être ré-exécuté sans risque d'erreur)
-- ====================================================================================

-- 1. FONCTIONS DE RÔLE SÉCURISÉES (ANTI-RÉCURSION RLS)
CREATE OR REPLACE FUNCTION public.get_current_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE id = user_id;
    RETURN COALESCE(user_role, 'acheteur');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (public.get_current_user_role(user_id) = 'superadmin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. TRIGGER ANTI-ÉLÉVATION DE PRIVILÈGES SUR L'INSCRIPTION
-- Empêche formellement tout utilisateur de s'octroyer le rôle 'superadmin' ou 'vendeur'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
BEGIN
    IF NEW.raw_user_meta_data->>'role' = 'vendeur_pending' THEN
        assigned_role := 'vendeur_pending';
    ELSE
        assigned_role := 'acheteur';
    END IF;

    INSERT INTO public.profiles (id, prenom, nom, telephone, role, is_open)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'prenom', 'Étudiant'),
        COALESCE(NEW.raw_user_meta_data->>'nom', 'UIDT'),
        COALESCE(NEW.raw_user_meta_data->>'telephone', ''),
        assigned_role,
        true
    )
    ON CONFLICT (id) DO UPDATE 
    SET 
        prenom = EXCLUDED.prenom,
        nom = EXCLUDED.nom,
        telephone = CASE WHEN EXCLUDED.telephone <> '' THEN EXCLUDED.telephone ELSE public.profiles.telephone END,
        role = CASE 
            WHEN public.profiles.role = 'superadmin' THEN 'superadmin'
            WHEN public.profiles.role = 'vendeur' THEN 'vendeur'
            ELSE assigned_role 
        END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. POLITIQUES RLS SUR LES LIEUX DE LIVRAISON (PAVILLONS)
ALTER TABLE public.delivery_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Active Locations" ON public.delivery_locations;
CREATE POLICY "Public Read Active Locations"
ON public.delivery_locations FOR SELECT
USING (true);

DROP POLICY IF EXISTS "SuperAdmin Manage Locations" ON public.delivery_locations;
CREATE POLICY "SuperAdmin Manage Locations"
ON public.delivery_locations FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. POLITIQUES DE STOCKAGE DES PHOTOS (RESTRICTION AUX VENDEURS & ADMINS)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true), ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Images publiques" ON storage.objects;
DROP POLICY IF EXISTS "Public Read on Product Images" ON storage.objects;
CREATE POLICY "Images publiques" 
ON storage.objects FOR SELECT 
USING (bucket_id IN ('product-images', 'products'));

DROP POLICY IF EXISTS "Uploads réservés aux vendeurs" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated sellers upload to Products" ON storage.objects;
CREATE POLICY "Uploads réservés aux vendeurs" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (
    bucket_id IN ('product-images', 'products') AND 
    public.get_current_user_role(auth.uid()) IN ('vendeur', 'superadmin')
);

DROP POLICY IF EXISTS "Authenticated sellers update Products" ON storage.objects;
CREATE POLICY "Authenticated sellers update Products" 
ON storage.objects FOR UPDATE 
TO authenticated
USING (
    bucket_id IN ('product-images', 'products') AND 
    (auth.uid()::text = (storage.foldername(name))[1] OR public.is_super_admin(auth.uid()))
);

-- 5. POLITIQUES DE CONFIDENTIALITÉ DES COMMANDES (ZÉRO FUITE INVITÉ)
DROP POLICY IF EXISTS "Confidentialité des commandes" ON public.orders;
CREATE POLICY "Confidentialité des commandes" 
ON public.orders FOR SELECT 
USING (
    auth.uid() = seller_id OR 
    (auth.uid() IS NOT NULL AND auth.uid() = buyer_id) OR
    public.is_super_admin(auth.uid())
);

-- 6. RECHARGEMENT DU CACHE D'API SUPABASE
NOTIFY pgrst, 'reload config';
