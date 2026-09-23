-- ====================================================================================
-- SCRIPT DE CRÉATION SÉCURISÉE DU COMPTE SUPERADMIN (CAMPUS MARKET UIDT)
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase.
-- ====================================================================================

-- 1. ASSURER QUE L'EXTENSION PGCRYPTO EST DISPONIBLE
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. CRÉATION OU MISE À JOUR DU COMPTE SUPERADMIN
DO $$
DECLARE
  -- ⚠️ CONFIGUREZ VOS IDENTIFIANTS ADMINISTRATEUR ICI AVANT EXÉCUTION
  target_email TEXT := 'admin@univ-thies.sn'; 
  target_password TEXT := 'REMPLACEZ_PAR_UN_MOT_DE_PASSE_FORT_2026';
  admin_prenom TEXT := 'Super';
  admin_nom TEXT := 'Admin';
  admin_phone TEXT := '221770000000';
  
  admin_uid UUID;
BEGIN
  -- 1. Récupérer l'ID existant si l'e-mail est déjà enregistré
  SELECT id INTO admin_uid FROM auth.users WHERE email = target_email;
  
  -- 2. S'il n'existe pas, on l'insère proprement dans auth.users
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
      target_email,
      extensions.crypt(target_password, extensions.gen_salt('bf', 10)),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      json_build_object('prenom', admin_prenom, 'nom', admin_nom, 'role', 'superadmin'),
      'authenticated',
      'authenticated',
      NOW(),
      NOW()
    );
  ELSE
    -- 3. S'il existe déjà, on met à jour son mot de passe et confirmation
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt(target_password, extensions.gen_salt('bf', 10)),
        email_confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = admin_uid;
  END IF;

  -- 4. Créer ou mettre à jour le profil correspondant dans public.profiles avec le rôle superadmin
  INSERT INTO public.profiles (id, prenom, nom, telephone, role, is_open)
  VALUES (
      admin_uid,
      admin_prenom,
      admin_nom,
      admin_phone,
      'superadmin',
      true
  )
  ON CONFLICT (id) DO UPDATE 
  SET role = 'superadmin',
      prenom = EXCLUDED.prenom,
      nom = EXCLUDED.nom,
      telephone = EXCLUDED.telephone,
      is_open = true;
END $$;
