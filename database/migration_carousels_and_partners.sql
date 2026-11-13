-- ====================================================================================
-- MIGRATION: CARROUSEL 16:9 DYNAMIQUE & SECTION PARTENAIRES (Campus Market UIDT)
-- Script idempotent : à copier-coller dans le "SQL Editor" du Dashboard Supabase
-- ====================================================================================

-- 0. SÉCURITÉ : Vérification de la fonction is_super_admin (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_super_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND role = 'superadmin'
  );
$$;

-- 1. TABLE DES DIAPOSITIVES DU CARROUSEL (Panneau d'Annonces, Pubs & Partenaires)
CREATE TABLE IF NOT EXISTS public.carousel_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    slide_type TEXT DEFAULT 'annonce' CHECK (slide_type IN ('annonce', 'pub', 'partenaire')),
    badge TEXT,
    image_url TEXT,
    link_url TEXT,
    link_text TEXT DEFAULT 'Découvrir',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABLE DES PARTENAIRES OFFICIELS (Gérés directement par le SuperAdmin)
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT DEFAULT 'autre' CHECK (category IN ('amicale', 'payment', 'local_business', 'sponsor', 'autre')),
    category_label TEXT,
    logo_url TEXT,
    description TEXT,
    perk TEXT,
    badge TEXT DEFAULT 'Partenaire Officiel',
    website_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ACTIVATION DU ROW LEVEL SECURITY (RLS)
ALTER TABLE public.carousel_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- 4. POLITIQUES RLS LECTURE PUBLIQUE (Accessible à tous les visiteurs, connectés ou non)
DROP POLICY IF EXISTS "Public Read Active Carousel Slides" ON public.carousel_slides;
CREATE POLICY "Public Read Active Carousel Slides"
ON public.carousel_slides FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public Read Active Partners" ON public.partners;
CREATE POLICY "Public Read Active Partners"
ON public.partners FOR SELECT
USING (true);

-- 5. POLITIQUES RLS GESTION SUPERADMIN (Écriture, modification et suppression)
DROP POLICY IF EXISTS "SuperAdmin Manage Carousel Slides" ON public.carousel_slides;
CREATE POLICY "SuperAdmin Manage Carousel Slides"
ON public.carousel_slides FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "SuperAdmin Manage Partners" ON public.partners;
CREATE POLICY "SuperAdmin Manage Partners"
ON public.partners FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- 6. STOCKAGE (Bucket Storage 'products' pour bannières et logos)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Politiques Storage pour permettre au SuperAdmin de téléverser et modifier les médias
DROP POLICY IF EXISTS "SuperAdmin Uploads Media" ON storage.objects;
CREATE POLICY "SuperAdmin Uploads Media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'products' AND public.is_super_admin(auth.uid())
);

DROP POLICY IF EXISTS "SuperAdmin Update Media" ON storage.objects;
CREATE POLICY "SuperAdmin Update Media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'products' AND public.is_super_admin(auth.uid())
);

-- 7. DIAPOSITIVES INITIALES DU CARROUSEL 16:9
INSERT INTO public.carousel_slides (title, subtitle, slide_type, badge, image_url, link_url, link_text, display_order, is_active)
VALUES
(
    'Vos repas et fournitures livrés à votre porte',
    'Commandez directement auprès des étudiants-marchands de l''UIDT. Livraison pavillon-à-pavillon.',
    'annonce',
    '📢 Info Campus',
    '',
    '#catalog',
    'Explorer les offres',
    1,
    TRUE
),
(
    'Bons plans & Réductions spéciales examens',
    'Menus chauds, polycopiés et clés USB à prix étudiants négociés avec les commerçants du campus.',
    'pub',
    '🔥 Bons Plans',
    '',
    '#category/restauration',
    'Profiter des promos',
    2,
    TRUE
),
(
    'Amicales, Commerces & Sponsors : Devenez Partenaire',
    'Valorisez vos activités ou services auprès de la communauté estudiantine de Thiès.',
    'annonce',
    '🤝 Partenariat',
    '',
    'https://wa.me/221776064596?text=Bonjour%20Campus%20Market%2C%20je%20souhaite%20devenir%20partenaire',
    'Devenir Partenaire',
    3,
    TRUE
)
ON CONFLICT DO NOTHING;

-- Note : La table public.partners est laissée vide intentionnellement.
-- L'administrateur renseigne lui-même ses partenaires officiels depuis l'Espace SuperAdmin.
