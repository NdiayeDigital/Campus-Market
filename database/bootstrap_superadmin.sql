-- ====================================================================================
-- SCRIPT DE CRÉATION DIRECTE ET SÉCURISÉE DU COMPTE SUPERADMIN
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase.
-- ====================================================================================

-- 1. ASSURER QUE L'EXTENSION PGCRYPTO EST DISPONIBLE
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. INSÉRER LE COMPTE DANS auth.users (AUTHENTIFICATION) S'IL N'EXISTE PAS
-- Si l'e-mail existe déjà, cela mettra à jour son mot de passe pour 'Mouhamadou2005'
DO $$
DECLARE
  admin_uid UUID;
BEGIN
  -- 1. Récupérer l'ID existant si l'e-mail est déjà enregistré
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'maamin.ndiaye@univ-thies.sn';
  
  -- 2. S'il n'existe pas, on l'insère proprement
  IF admin_uid IS NULL THEN
    admin_uid := gen_random_uuid();
    
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
      admin_uid,
      'maamin.ndiaye@univ-thies.sn',
      extensions.crypt('Mouhamadou2005', extensions.gen_salt('bf', 10)),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      'authenticated',
      'authenticated',
      NOW(),
      NOW()
    );
  ELSE
    -- 3. S'il existe déjà, on met simplement à jour son mot de passe et sa confirmation
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt('Mouhamadou2005', extensions.gen_salt('bf', 10)),
        email_confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = admin_uid;
  END IF;

  -- 4. Créer ou mettre à jour le profil correspondant dans public.profiles
  INSERT INTO public.profiles (id, prenom, nom, telephone, role)
  VALUES (
      admin_uid,
      'Super',
      'Admin',
      '770000000',
      'superadmin'
  )
  ON CONFLICT (id) DO UPDATE 
  SET role = 'superadmin',
      prenom = 'Super',
      nom = 'Admin';
END $$;
