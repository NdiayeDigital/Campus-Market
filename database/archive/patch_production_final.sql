-- ====================================================================================
-- CAMPUS MARKET UIDT - PATCH FINAL PRODUCTION & POUVOIRS SUPERADMIN (CORRIGÉ & AUTONOME)
-- À exécuter dans le SQL Editor de Supabase (https://fqulqgdjusfzhcjpvyay.supabase.co)
-- ====================================================================================

-- 0. DÉFINITION EXPLICITE DES FONCTIONS DE SÉCURITÉ ET DE RÔLE (SECURITY DEFINER)
-- Évite l'erreur 42883 et prévient toute récursion infinie sur la table profiles
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

-- 1. Ajout de la colonne payment_status sur orders (requis par le RPC de suivi de commande)
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

-- 2. Création de la table des lieux et pavillons de livraison universitaires
CREATE TABLE IF NOT EXISTS public.delivery_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT DEFAULT 'pavillon', -- 'pavillon', 'site', 'bu', 'autre'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Activation de RLS sur delivery_locations
ALTER TABLE public.delivery_locations ENABLE ROW LEVEL SECURITY;

-- Lecture publique : accessible à tous (acheteurs invités & connectés)
DROP POLICY IF EXISTS "Public Read Active Locations" ON public.delivery_locations;
CREATE POLICY "Public Read Active Locations"
ON public.delivery_locations FOR SELECT
USING (true);

-- Écriture / Modification réservée au SuperAdmin
DROP POLICY IF EXISTS "SuperAdmin Manage Locations" ON public.delivery_locations;
CREATE POLICY "SuperAdmin Manage Locations"
ON public.delivery_locations FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- Données initiales des pavillons et sites de l'Université Iba Der Thiam de Thiès
INSERT INTO public.delivery_locations (name, category, is_active)
VALUES 
  ('Pavillon A1', 'pavillon', true),
  ('Pavillon A2', 'pavillon', true),
  ('Pavillon A3', 'pavillon', true),
  ('Pavillon A4', 'pavillon', true),
  ('Pavillon B1', 'pavillon', true),
  ('Pavillon B2', 'pavillon', true),
  ('Pavillon C', 'pavillon', true),
  ('Jardin Social', 'site', true),
  ('Bibliothèque Universitaire (BU)', 'bu', true),
  ('Salles de cours / Espaces communs', 'site', true)
ON CONFLICT (name) DO NOTHING;

-- 3. Autoriser le SuperAdmin à modifier le statut des commandes (arbitrage et litiges)
DROP POLICY IF EXISTS "SuperAdmin Update Orders" ON public.orders;
CREATE POLICY "SuperAdmin Update Orders"
ON public.orders FOR UPDATE
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. Création et configuration des buckets Supabase Storage pour les photos d'articles
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('product-images', 'product-images', true),
  ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Droits de lecture publique pour afficher les photos
DROP POLICY IF EXISTS "Public Read on Product Images" ON storage.objects;
CREATE POLICY "Public Read on Product Images"
ON storage.objects FOR SELECT
USING (bucket_id IN ('product-images', 'products'));

-- Droits d'upload strictement réservés aux vendeurs et superadmins
DROP POLICY IF EXISTS "Authenticated sellers upload to Products" ON storage.objects;
CREATE POLICY "Authenticated sellers upload to Products"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id IN ('product-images', 'products') AND 
    public.get_current_user_role(auth.uid()) IN ('vendeur', 'superadmin')
);

-- Droits de mise à jour/suppression pour le propriétaire de l'image
DROP POLICY IF EXISTS "Authenticated sellers update Products" ON storage.objects;
CREATE POLICY "Authenticated sellers update Products"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id IN ('product-images', 'products') AND auth.uid()::text = (storage.foldername(name))[1]);

-- 5. Rechargement immédiat de la configuration du cache de schéma Supabase
NOTIFY pgrst, 'reload config';
