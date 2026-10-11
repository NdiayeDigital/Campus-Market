#!/usr/bin/env node

/**
 * Script de création et d'attribution de privilèges SuperAdmin pour Campus Market.
 * Permet de créer un nouveau compte administrateur complet avec tous les droits (UIDT).
 *
 * Utilisation :
 *   1. Mode interactif :
 *      npm run create-superadmin
 *
 *   2. Mode arguments en ligne de commande :
 *      npm run create-superadmin -- --email="prenom.nom@univ-thies.sn" --password="MonMotDePasse" --prenom="Prenom" --nom="Nom" --telephone="771234567"
 */

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fqulqgdjusfzhcjpvyay.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QiS6HTBjjJo423rgUxdQ5A_A5NySDl7';

// Compte de délégation (optionnel, configurable via variables d'environnement)
const ROOT_ADMIN_EMAIL = process.env.ROOT_ADMIN_EMAIL || '';
const ROOT_ADMIN_PASS = process.env.ROOT_ADMIN_PASS || '';

function parseArgs() {
    const args = process.argv.slice(2);
    const parsed = {};
    for (const arg of args) {
        if (arg.startsWith('--')) {
            const [key, val] = arg.slice(2).split('=');
            if (key && val) {
                parsed[key.toLowerCase()] = val.replace(/^["']|["']$/g, '').trim();
            }
        }
    }
    return parsed;
}

function generateSQLScript({ email, password, prenom, nom, telephone }) {
    const safeEmail = email.replace(/'/g, "''");
    const safePassword = password.replace(/'/g, "''");
    const safePrenom = prenom.replace(/'/g, "''");
    const safeNom = nom.replace(/'/g, "''");
    const safePhone = telephone.replace(/'/g, "''");

    return `-- ====================================================================================
-- ACTIVATION DIRECTE DU COMPTE SUPERADMIN (CAMPUS MARKET UIDT)
-- À coller dans l'onglet SQL Editor de votre projet Supabase :
-- https://supabase.com/dashboard/project/fqulqgdjusfzhcjpvyay/sql/new
-- ====================================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
  target_email TEXT := '${safeEmail}'; 
  target_password TEXT := '${safePassword}';
  admin_prenom TEXT := '${safePrenom}';
  admin_nom TEXT := '${safeNom}';
  admin_phone TEXT := '${safePhone}';
  admin_uid UUID;
BEGIN
  -- 1. Récupérer ou insérer dans auth.users avec confirmation automatique
  SELECT id INTO admin_uid FROM auth.users WHERE email = target_email;
  
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
    UPDATE auth.users 
    SET encrypted_password = extensions.crypt(target_password, extensions.gen_salt('bf', 10)),
        email_confirmed_at = NOW(),
        updated_at = NOW()
    WHERE id = admin_uid;
  END IF;

  -- 2. Créer ou promouvoir le profil dans public.profiles avec le rôle superadmin
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

  RAISE NOTICE 'Compte SuperAdmin configuré avec succès pour % (%)', admin_prenom || ' ' || admin_nom, target_email;
END $$;
`;
}

async function main() {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🛡️  ASSISTANT DE CRÉATION DE COMPTE SUPERADMIN (CAMPUS MARKET UIDT)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const cliArgs = parseArgs();
    const rl = readline.createInterface({ input, output });

    try {
        let prenom = cliArgs.prenom || (await rl.question('👉 Prénom du SuperAdmin : ')).trim();
        let nom = cliArgs.nom || (await rl.question('👉 Nom du SuperAdmin : ')).trim();
        let telephone = cliArgs.telephone || (await rl.question('👉 Numéro de téléphone (ex: 783989269) : ')).trim();
        let email = cliArgs.email || (await rl.question('👉 Email institutionnel (@univ-thies.sn) : ')).trim();
        let password = cliArgs.password || (await rl.question('👉 Mot de passe (min 6 caractères) : ')).trim();

        if (!prenom || !nom || !telephone || !email || !password) {
            console.error('\n❌ Erreur : Tous les champs sont obligatoires.');
            process.exit(1);
        }

        if (!email.endsWith('@univ-thies.sn')) {
            console.warn('\n⚠️ Attention : L\'adresse email doit idéalement se terminer par @univ-thies.sn');
            const confirm = (await rl.question('Continuer quand même ? (o/N) : ')).trim().toLowerCase();
            if (confirm !== 'o' && confirm !== 'oui') {
                console.log('Annulé.');
                process.exit(0);
            }
        }

        if (password.length < 6) {
            console.error('\n❌ Erreur : Le mot de passe doit comporter au moins 6 caractères.');
            process.exit(1);
        }

        console.log('\n⏳ Génération du script SQL personnalisé...');
        const sqlContent = generateSQLScript({ email, password, prenom, nom, telephone });

        const sqlFilePath = path.resolve('database/mon_compte_superadmin.sql');
        fs.writeFileSync(sqlFilePath, sqlContent, 'utf-8');
        console.log(`✅ Fichier SQL généré : ${sqlFilePath}`);

        // Tentative d'enregistrement automatique via l'API Supabase si possible
        console.log('\n⏳ Tentative d\'enregistrement direct via l\'API Supabase...');
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

        try {
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        prenom,
                        nom,
                        telephone,
                        role: 'superadmin',
                    },
                },
            });

            if (signUpError && !signUpError.message.includes('already registered')) {
                console.warn(`ℹ️ Note API auth : ${signUpError.message}`);
            } else {
                console.log('✅ Utilisateur inscrit dans Supabase Auth !');
            }

            // Si un administrateur racine est configuré, promouvoir directement
            if (ROOT_ADMIN_EMAIL && ROOT_ADMIN_PASS) {
                const { error: rootAuthError } = await supabase.auth.signInWithPassword({
                    email: ROOT_ADMIN_EMAIL,
                    password: ROOT_ADMIN_PASS,
                });

                if (!rootAuthError && signUpData?.user?.id) {
                    const { error: updateError } = await supabase
                        .from('profiles')
                        .upsert({
                            id: signUpData.user.id,
                            prenom,
                            nom,
                            telephone,
                            role: 'superadmin',
                            is_open: true,
                        });

                    if (!updateError) {
                        console.log('🎉 Privilèges SuperAdmin attribués immédiatement via l\'API !');
                    }
                }
            }
        } catch (apiErr) {
            console.warn('ℹ️ L\'inscription directe API nécessite l\'activation SQL ci-dessous.');
        }

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🚀 PROCÉDURE POUR ACTIVER VOTRE COMPTE SUPERADMIN :');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`1. Ouvrez l'éditeur SQL de votre projet Supabase :`);
        console.log(`   👉 https://supabase.com/dashboard/project/fqulqgdjusfzhcjpvyay/sql/new`);
        console.log(`2. Copiez le contenu du fichier généré : ${sqlFilePath}`);
        console.log(`3. Collez dans le SQL Editor et cliquez sur "Run".`);
        console.log(`4. Connectez-vous ensuite sur :`);
        console.log(`   👉 http://localhost:5173/#admin`);
        console.log(`   Avec : ${email} et votre mot de passe.`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } finally {
        rl.close();
    }
}

main();
