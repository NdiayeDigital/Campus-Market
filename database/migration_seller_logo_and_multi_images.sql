-- ====================================================================================
-- Campus Market — Migration Additive : Logo Vendeur & Galerie Multi-Photos Produit (3 photos)
-- Fichier : database/migration_seller_logo_and_multi_images.sql
-- ====================================================================================
-- 1. Permet aux marchands de configurer et modifier le logo / avatar de leur boutique.
-- 2. Permet aux marchands d'ajouter jusqu'à 3 photos par produit (angles, détails).
-- Script purement additif, idempotent et rétrocompatible avec les installations existantes.
-- ====================================================================================

-- 1. Ajout de la colonne avatar_url dans public.profiles (Logo de la boutique)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
COMMENT ON COLUMN public.profiles.avatar_url IS 'URL du logo ou photo de profil de la boutique marchande (Supabase Storage product-images)';

-- 2. Ajout de la colonne images dans public.products (Galerie multi-photos jusqu''à 3 photos)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN public.products.images IS 'Tableau JSONB des URLs des photos du produit (jusqu''à 3 photos). images[0] = photo principale identique à image_url';

-- 3. Rétro-remplissage sécurisé (Backfill) pour les produits existants ayant déjà une image_url
UPDATE public.products 
SET images = jsonb_build_array(image_url)
WHERE image_url IS NOT NULL 
  AND (images IS NULL OR images = '[]'::jsonb);

-- 4. Index GIN pour les recherches et filtres éventuels sur le tableau images
CREATE INDEX IF NOT EXISTS idx_products_images ON public.products USING GIN (images);
