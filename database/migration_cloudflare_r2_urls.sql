-- ==============================================================================
-- CAMPUS MARKET - MIGRATION ADDITIVE DES URLS D'IMAGES VERS CLOUDFLARE R2
-- Élimine définitivement le trafic "Cached Egress" sur Supabase Storage.
-- À exécuter dans le SQL Editor de Supabase.
-- ==============================================================================

-- 1. Mise à jour des URLs principales et galeries multi-photos des produits
UPDATE public.products
SET 
    image_url = REPLACE(image_url, 'https://fqulqgdjusfzhcjpvyay.supabase.co/storage/v1/object/public/', 'https://pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev/')
WHERE image_url LIKE '%fqulqgdjusfzhcjpvyay.supabase.co%';

UPDATE public.products
SET 
    images = (
        SELECT jsonb_agg(
            to_jsonb(REPLACE(elem, 'https://fqulqgdjusfzhcjpvyay.supabase.co/storage/v1/object/public/', 'https://pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev/'))
        )
        FROM jsonb_array_elements_text(COALESCE(images, '[]'::jsonb)) AS elem
    )
WHERE images::text LIKE '%fqulqgdjusfzhcjpvyay.supabase.co%';

-- 2. Mise à jour des diapositives du carrousel d'accueil
UPDATE public.carousel_slides
SET image_url = REPLACE(image_url, 'https://fqulqgdjusfzhcjpvyay.supabase.co/storage/v1/object/public/', 'https://pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev/')
WHERE image_url LIKE '%fqulqgdjusfzhcjpvyay.supabase.co%';

-- 3. Mise à jour des logos des partenaires officiels
UPDATE public.partners
SET logo_url = REPLACE(logo_url, 'https://fqulqgdjusfzhcjpvyay.supabase.co/storage/v1/object/public/', 'https://pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev/')
WHERE logo_url LIKE '%fqulqgdjusfzhcjpvyay.supabase.co%';

-- 4. Mise à jour des avatars et logos des boutiques marchandes
UPDATE public.profiles
SET avatar_url = REPLACE(avatar_url, 'https://fqulqgdjusfzhcjpvyay.supabase.co/storage/v1/object/public/', 'https://pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev/')
WHERE avatar_url LIKE '%fqulqgdjusfzhcjpvyay.supabase.co%';
