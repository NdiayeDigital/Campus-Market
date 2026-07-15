-- ====================================================================================
-- SCRIPT DE CRÉATION DIRECTE ET SÉCURISÉE DU COMPTE SUPERADMIN
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase.
-- ====================================================================================

-- 1. ASSURER QUE L'EXTENSION PGCRYPTO EST DISPONIBLE
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. INSÉRER LE COMPTE DANS auth.users (AUTHENTIFICATION) S'IL N'EXISTE PAS
-- Si l'e-mail existe déjà, cela mettra à jour son mot de passe pour 'Mouhamadou2005'
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    role,
    aud,
    created_at,
    updated_at
)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', -- UUID unique prédéfini pour l'admin
    'maamin.ndiaye@univ-thies.sn',
    extensions.crypt('Mouhamadou2005', extensions.gen_salt('bf', 10)),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    'authenticated',
    'authenticated',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE 
SET encrypted_password = extensions.crypt('Mouhamadou2005', extensions.gen_salt('bf', 10)),
    email_confirmed_at = NOW();

-- 3. INSÉRER LE PROFIL DANS public.profiles (DONNÉES UTILISATEUR)
-- Si le profil existe déjà pour cet ID, il sera mis à jour avec le rôle 'superadmin'
INSERT INTO public.profiles (id, prenom, nom, telephone, role)
VALUES (
    'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    'Super',
    'Admin',
    '770000000',
    'superadmin'
)
ON CONFLICT (id) DO UPDATE 
SET role = 'superadmin';
