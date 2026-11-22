-- ==============================================================================
-- Migration SQL : Table public.student_announcements & Support Annonces Étudiantes
-- Rétrocompatible et Idempotente - Campus Market UIDT
-- ==============================================================================

-- 1. Table public.student_announcements
-- Permet à tout étudiant de l'UIDT de soumettre une annonce (250 FCFA / 5 jours)
CREATE TABLE IF NOT EXISTS public.student_announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    student_email TEXT NOT NULL,
    image_url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    duration_days INTEGER DEFAULT 5 NOT NULL,
    amount NUMERIC(10, 2) DEFAULT 250.00 NOT NULL,
    payment_link TEXT DEFAULT 'https://link.saspay.me/1aio4avhabm',
    status TEXT DEFAULT 'paiement_en_attente' CHECK (status IN ('paiement_en_attente', 'a_valider', 'validee', 'rejetee', 'expiree')),
    rejection_reason TEXT,
    validated_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE public.student_announcements IS 'Annonces promotionnelles déposées par les étudiants du campus (250 FCFA, 5 jours d affichage)';

-- 2. Colonnes additives sur public.advertisements (pour compatibilité ascendante)
ALTER TABLE public.advertisements ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS student_nom TEXT;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS student_prenom TEXT;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS student_email TEXT;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 5;
ALTER TABLE public.advertisements ADD COLUMN IF NOT EXISTS payment_link TEXT DEFAULT 'https://link.saspay.me/1aio4avhabm';

-- 3. Sécurité Row Level Security (RLS)
ALTER TABLE public.student_announcements ENABLE ROW LEVEL SECURITY;

-- Lecture : Les annonces validées sont visibles par tous les visiteurs non expirées
DROP POLICY IF EXISTS "Public Read Validated Student Announcements" ON public.student_announcements;
CREATE POLICY "Public Read Validated Student Announcements"
    ON public.student_announcements
    FOR SELECT
    TO anon, authenticated
    USING (
        (status = 'validee' AND expires_at > NOW())
        OR (auth.uid() IS NOT NULL AND public.is_super_admin(auth.uid()))
    );

-- Insertion : Tout étudiant (même non connecté) peut déposer sa demande d'annonce
DROP POLICY IF EXISTS "Public Insert Student Announcements" ON public.student_announcements;
CREATE POLICY "Public Insert Student Announcements"
    ON public.student_announcements
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
        amount = 250.00 
        AND nom IS NOT NULL 
        AND prenom IS NOT NULL 
        AND student_email IS NOT NULL 
        AND image_url IS NOT NULL
    );

-- Gestion : Seul le SuperAdmin peut valider, rejeter ou modifier les annonces
DROP POLICY IF EXISTS "SuperAdmin Manage Student Announcements" ON public.student_announcements;
CREATE POLICY "SuperAdmin Manage Student Announcements"
    ON public.student_announcements
    FOR ALL
    TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

-- 4. Politique de stockage pour les affiches d'annonces étudiantes (dans product-images)
DROP POLICY IF EXISTS "Public Upload Student Announcements Images" ON storage.objects;
CREATE POLICY "Public Upload Student Announcements Images"
    ON storage.objects
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (bucket_id = 'product-images');

-- 5. Publication Realtime pour notification instantanée du SuperAdmin
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'student_announcements'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.student_announcements;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;
