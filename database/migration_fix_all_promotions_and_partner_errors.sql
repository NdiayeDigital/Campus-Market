-- ==============================================================================
-- Migration SQL : Corrections Schéma Produits (updated_at), Partenaires (whatsapp_phone)
-- & Synchronisation Temps Réel Annonces Étudiantes (250 FCFA / 5 jours)
-- Additif, Idempotent et Rétrocompatible - Campus Market UIDT
-- ==============================================================================

-- 1. Ajout de la colonne updated_at sur la table products si elle n'existe pas
-- Corrige l'erreur "Could not find the 'updated_at' column of 'products' in the schema cache"
ALTER TABLE IF EXISTS public.products 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Ajout des colonnes sur la table partners si elles n'existent pas
-- Corrige les erreurs lors de l'ajout/mise à jour d'un partenaire
ALTER TABLE IF EXISTS public.partners 
ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT DEFAULT '';

ALTER TABLE IF EXISTS public.partners 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

ALTER TABLE IF EXISTS public.partners 
ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

-- 3. Structure de la table student_announcements
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
    status TEXT DEFAULT 'a_valider',
    rejection_reason TEXT,
    validated_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Assouplissement de la contrainte CHECK sur status pour supporter tous les états
ALTER TABLE IF EXISTS public.student_announcements 
DROP CONSTRAINT IF EXISTS student_announcements_status_check;

ALTER TABLE IF EXISTS public.student_announcements 
ADD CONSTRAINT student_announcements_status_check 
CHECK (status IN ('paiement_en_attente', 'a_valider', 'validee', 'publiee', 'rejetee', 'refusee', 'expiree'));

-- 4. Colonnes additives sur advertisements
ALTER TABLE IF EXISTS public.advertisements ALTER COLUMN seller_id DROP NOT NULL;
ALTER TABLE IF EXISTS public.advertisements ADD COLUMN IF NOT EXISTS student_nom TEXT;
ALTER TABLE IF EXISTS public.advertisements ADD COLUMN IF NOT EXISTS student_prenom TEXT;
ALTER TABLE IF EXISTS public.advertisements ADD COLUMN IF NOT EXISTS student_email TEXT;
ALTER TABLE IF EXISTS public.advertisements ADD COLUMN IF NOT EXISTS duration_days INTEGER DEFAULT 5;
ALTER TABLE IF EXISTS public.advertisements ADD COLUMN IF NOT EXISTS payment_link TEXT DEFAULT 'https://link.saspay.me/1aio4avhabm';

-- 5. RLS pour student_announcements
ALTER TABLE public.student_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Validated Student Announcements" ON public.student_announcements;
CREATE POLICY "Public Read Validated Student Announcements"
    ON public.student_announcements
    FOR SELECT
    TO anon, authenticated
    USING (
        (status IN ('validee', 'publiee') AND expires_at > NOW())
        OR (auth.uid() IS NOT NULL AND public.is_super_admin(auth.uid()))
    );

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

DROP POLICY IF EXISTS "SuperAdmin Manage Student Announcements" ON public.student_announcements;
CREATE POLICY "SuperAdmin Manage Student Announcements"
    ON public.student_announcements
    FOR ALL
    TO authenticated
    USING (public.is_super_admin(auth.uid()))
    WITH CHECK (public.is_super_admin(auth.uid()));

-- 6. Publication Realtime pour notification directe du SuperAdmin
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

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
          AND schemaname = 'public' 
          AND tablename = 'advertisements'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.advertisements;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- 7. Fonction RPC de modération unifiée SuperAdmin
CREATE OR REPLACE FUNCTION public.admin_moderate_advertisement(
    p_ad_id UUID,
    p_action TEXT DEFAULT 'valider',
    p_reason TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_uid UUID;
    ad_rec RECORD;
    is_student BOOLEAN := FALSE;
    target_duration INTERVAL := INTERVAL '7 days';
BEGIN
    caller_uid := auth.uid();
    IF caller_uid IS NULL OR NOT public.is_super_admin(caller_uid) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Action réservée aux Super Administrateurs.');
    END IF;

    -- Vérification advertisements
    SELECT * INTO ad_rec FROM public.advertisements WHERE id = p_ad_id FOR UPDATE;
    IF FOUND THEN
        IF ad_rec.student_nom IS NOT NULL OR ad_rec.duration_days = 5 THEN
            target_duration := INTERVAL '5 days';
        END IF;

        IF LOWER(p_action) IN ('valider', 'approuver') THEN
            UPDATE public.advertisements
            SET status = 'publiee',
                validated_at = NOW(),
                expires_at = NOW() + target_duration,
                rejection_reason = NULL,
                updated_at = NOW()
            WHERE id = p_ad_id;

            RETURN jsonb_build_object('success', true, 'message', 'Annonce publiée avec succès.');
        ELSE
            UPDATE public.advertisements
            SET status = 'refusee',
                rejection_reason = TRIM(COALESCE(p_reason, 'Non conforme aux règles de publication')),
                updated_at = NOW()
            WHERE id = p_ad_id;

            RETURN jsonb_build_object('success', true, 'message', 'Annonce refusée.');
        END IF;
    END IF;

    -- Vérification student_announcements
    SELECT * INTO ad_rec FROM public.student_announcements WHERE id = p_ad_id FOR UPDATE;
    IF FOUND THEN
        IF LOWER(p_action) IN ('valider', 'approuver') THEN
            UPDATE public.student_announcements
            SET status = 'publiee',
                validated_at = NOW(),
                expires_at = NOW() + INTERVAL '5 days',
                rejection_reason = NULL,
                updated_at = NOW()
            WHERE id = p_ad_id;

            RETURN jsonb_build_object('success', true, 'message', 'Annonce étudiante publiée pour 5 jours.');
        ELSE
            UPDATE public.student_announcements
            SET status = 'refusee',
                rejection_reason = TRIM(COALESCE(p_reason, 'Non conforme aux règles de publication')),
                updated_at = NOW()
            WHERE id = p_ad_id;

            RETURN jsonb_build_object('success', true, 'message', 'Annonce étudiante refusée.');
        END IF;
    END IF;

    RETURN jsonb_build_object('success', false, 'message', 'Annonce introuvable.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_moderate_advertisement(UUID, TEXT, TEXT) TO authenticated;
