/**
 * Script de sauvegarde préalable des données de souscription, vendeurs et produits.
 * À exécuter avant toute migration sur la base de production.
 *
 * Usage :
 * node scripts/backup-subscription-data.js
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function getEnvVar(key) {
    if (process.env[key]) return process.env[key];
    const envPaths = ['.env.local', '.env'];
    for (const p of envPaths) {
        if (fs.existsSync(p)) {
            const content = fs.readFileSync(p, 'utf8');
            const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
            if (match) return match[1].trim();
        }
    }
    return null;
}

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
const supabaseKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY') || getEnvVar('VITE_SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erreur : Variables Supabase manquantes (VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runBackup() {
    console.log('📦 Démarrage de la sauvegarde préalable des données de production...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.resolve(process.cwd(), 'backups');
    
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const backupFile = path.join(backupDir, `backup_subscriptions_${timestamp}.json`);

    try {
        // 1. Sauvegarde des profils vendeurs
        const { data: profiles, error: profErr } = await supabase
            .from('profiles')
            .select('*');
        if (profErr) throw new Error(`Échec lecture profiles: ${profErr.message}`);

        // 2. Sauvegarde des produits
        const { data: products, error: prodErr } = await supabase
            .from('products')
            .select('*');
        if (prodErr) throw new Error(`Échec lecture products: ${prodErr.message}`);

        // 3. Sauvegarde des commandes récentes (derniers 90 jours pour historique)
        const { data: orders, error: ordErr } = await supabase
            .from('orders')
            .select('id, reference, seller_id, buyer_phone, price, quantity, status, created_at');
        if (ordErr) throw new Error(`Échec lecture orders: ${ordErr.message}`);

        const payload = {
            metadata: {
                createdAt: new Date().toISOString(),
                environment: 'production',
                profilesCount: profiles.length,
                productsCount: products.length,
                ordersCount: orders.length,
            },
            profiles,
            products,
            orders,
        };

        fs.writeFileSync(backupFile, JSON.stringify(payload, null, 2), 'utf8');

        console.log(`✅ Sauvegarde réussie avec succès !`);
        console.log(`📁 Fichier : ${backupFile}`);
        console.log(`📊 Statistiques :`);
        console.log(`   - Profils : ${profiles.length}`);
        console.log(`   - Produits : ${products.length}`);
        console.log(`   - Commandes : ${orders.length}`);

        return backupFile;
    } catch (err) {
        console.error('❌ Échec de la sauvegarde :', err.message);
        process.exit(1);
    }
}

runBackup();
