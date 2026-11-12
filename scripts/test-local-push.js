#!/usr/bin/env node
/**
 * Script de test en direct des Notifications Web Push (VAPID)
 * Campus Market - Université Iba Der Thiam de Thiès (UIDT)
 */

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// 1. Charger les variables d'environnement depuis .env ou .env.local
function loadLocalEnv() {
    ['.env', '.env.local'].forEach(file => {
        const fullPath = path.resolve(process.cwd(), file);
        if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            content.split('\n').forEach(line => {
                const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
                if (match) {
                    const key = match[1];
                    let val = match[2] || '';
                    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
                    process.env[key] = val.trim();
                }
            });
        }
    });
}

loadLocalEnv();

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@campusmarket-uidt.com';
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fqulqgdjusfzhcjpvyay.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QiS6HTBjjJo423rgUxdQ5A_A5NySDl7';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('\n🚀 ========================================================');
console.log('🧪 TEST DES NOTIFICATIONS WEB PUSH (VAPID) — CAMPUS MARKET');
console.log('========================================================\n');

// 2. Contrôle de configuration VAPID
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.error('❌ ERREUR : Clés VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY manquantes dans .env');
    process.exit(1);
}

try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('✅ Configuration VAPID initialisée avec succès :');
    console.log('   - Clé Publique (P-256) :', VAPID_PUBLIC_KEY.slice(0, 15) + '...');
    console.log('   - Sujet VAPID          :', VAPID_SUBJECT);
} catch (e) {
    console.error('❌ ERREUR : Paire de clés VAPID invalide :', e.message);
    process.exit(1);
}

// 3. Connexion Supabase et recherche des abonnements
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

async function runTest() {
    console.log('\n🔍 Recherche des appareils marchands enregistrés dans Supabase...');
    const { data: subs, error } = await supabase
        .from('seller_push_subscriptions')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('❌ ERREUR Supabase :', error.message);
        process.exit(1);
    }

    if (!subs || subs.length === 0) {
        console.log('⚠️  Aucun appareil enregistré dans la table seller_push_subscriptions.');
        console.log('👉 Pour enregistrer votre appareil de test :');
        console.log('   1. Lancez npm run dev');
        console.log('   2. Connectez-vous sur http://localhost:5173/#seller (fatou.sow@univ-thies.sn / Passer123!)');
        console.log('   3. Acceptez la permission des notifications du navigateur.');
        process.exit(0);
    }

    console.log(`✅ ${subs.length} appareil(s) récent(s) trouvé(s) !`);

    // Payload de test
    const payload = JSON.stringify({
        title: '🛍️ Nouvelle commande - Campus Market (UIDT)',
        body: 'Félicitations ! Vous venez de recevoir une commande de 3 500 FCFA au Pavillon A.',
        icon: '/assets/logo-192x192.png',
        badge: '/assets/logo-192x192.png',
        url: '/#seller',
        reference: 'CMD-TEST-' + Math.floor(1000 + Math.random() * 9000),
        timestamp: Date.now()
    });

    console.log('\n📨 Envoi de la notification push au terminal le plus récent :');
    const targetSub = subs[0];
    console.log('   - ID Souscription :', targetSub.id);
    console.log('   - Vendeur ID      :', targetSub.seller_id);
    console.log('   - Navigateur/OS   :', (targetSub.user_agent || 'Inconnu').slice(0, 70) + '...');
    console.log('   - Endpoint        :', targetSub.endpoint.slice(0, 45) + '...');

    const pushConfig = {
        endpoint: targetSub.endpoint,
        keys: {
            p256dh: targetSub.p256dh,
            auth: targetSub.auth,
        }
    };

    try {
        const response = await webpush.sendNotification(pushConfig, payload, {
            TTL: 60 * 60,
            urgency: 'high'
        });
        console.log('\n🎉 NOTIFICATION ENVOYÉE AVEC SUCCÈS !');
        console.log('   - Code HTTP retourné :', response.statusCode || 201);
        console.log('   - La notification est transmise au service push (Google FCM / Apple APNs).');
        console.log('   - Elle apparaît immédiatement sur l\'écran du terminal associé !\n');
    } catch (err) {
        console.error('\n⚠️ Échec lors de la distribution push :');
        console.error('   - Code HTTP :', err.statusCode);
        console.error('   - Message   :', err.message);
        if (err.statusCode === 410 || err.statusCode === 404) {
            console.log('   👉 Cet abonnement a expiré sur le serveur push (terminal désabonné ou session fermée).');
        }
    }
}

runTest();
