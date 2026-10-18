-- ====================================================================================
-- CAMPUS MARKET — MIGRATION RÉINITIALISATION DE MOT DE PASSE VENDEUR
-- À exécuter dans le "SQL Editor" de Supabase :
-- https://supabase.com/dashboard/project/fqulqgdjusfzhcjpvyay/sql/new
-- Script idempotent : peut être ré-exécuté en toute sécurité
-- ====================================================================================

-- 1. Extension cryptographique requise pour le hachage Blowfish (Bcrypt)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Ajout de la colonne must_change_password à la table des profils
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- 3. Fonction SuperAdmin pour réinitialiser le mot de passe d'un vendeur à "campus1234!"
CREATE OR REPLACE FUNCTION public.admin_reset_seller_password(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
    caller_id UUID;
    is_admin BOOLEAN;
BEGIN
    caller_id := auth.uid();
    
    -- Vérification stricte des droits SuperAdmin
    SELECT (role = 'superadmin') INTO is_admin 
    FROM public.profiles 
    WHERE id = caller_id;

    IF is_admin IS NOT TRUE THEN
        RAISE EXCEPTION 'Action non autorisée. Seul un Super Administrateur peut réinitialiser ce mot de passe.';
    END IF;

    -- Vérification de l'existence de l'utilisateur cible
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
        RAISE EXCEPTION 'Compte utilisateur introuvable.';
    END IF;

    -- 1. Mise à jour automatique du mot de passe dans auth.users avec le hachage sécurisé de "campus1234!"
    UPDATE auth.users
    SET 
        encrypted_password = extensions.crypt('campus1234!', extensions.gen_salt('bf', 10)),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = target_user_id;

    -- 2. Marquer le profil avec l'obligation de changement de mot de passe
    UPDATE public.profiles
    SET must_change_password = TRUE
    WHERE id = target_user_id;

    RETURN TRUE;
END;
$$;

-- Accorder les droits d'exécution aux utilisateurs authentifiés (la fonction vérifie le rôle en interne)
GRANT EXECUTE ON FUNCTION public.admin_reset_seller_password(UUID) TO authenticated;

-- 4. Fonction permettant au vendeur connecté de lever l'obligation une fois son mot de passe changé
CREATE OR REPLACE FUNCTION public.complete_password_change()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    current_uid UUID;
BEGIN
    current_uid := auth.uid();
    IF current_uid IS NULL THEN
        RAISE EXCEPTION 'Utilisateur non authentifié.';
    END IF;

    UPDATE public.profiles
    SET must_change_password = FALSE
    WHERE id = current_uid;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_password_change() TO authenticated;
