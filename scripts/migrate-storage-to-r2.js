/**
 * Script de migration additive des médias existants de Supabase Storage vers Cloudflare R2.
 * Zéro indisponibilité, 100% idempotent.
 *
 * Utilisation :
 * node scripts/migrate-storage-to-r2.js
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Chargement manuel des variables d'environnement depuis .env.local ou .env si dotenv non présent
function loadEnv() {
    const envPaths = ['.env.local', '.env'];
    for (const envFile of envPaths) {
        const fullPath = path.resolve(process.cwd(), envFile);
        if (fs.existsSync(fullPath)) {
            const lines = fs.readFileSync(fullPath, 'utf8').split('\n');
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) continue;
                const eqIdx = trimmed.indexOf('=');
                if (eqIdx !== -1) {
                    const key = trimmed.substring(0, eqIdx).trim();
                    const val = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
                    if (!process.env[key]) {
                        process.env[key] = val;
                    }
                }
            }
        }
    }
}

loadEnv();

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'campus-market-storage';
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL || '').replace(/\/+$/, '');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fqulqgdjusfzhcjpvyay.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL) {
    console.error('❌ Erreur: Paramètres Cloudflare R2 manquants dans .env / .env.local');
    process.exit(1);
}

if (!SUPABASE_KEY) {
    console.error('❌ Erreur: Clé Supabase manquante');
    process.exit(1);
}

const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
});

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getR2KeyFromSupabaseUrl(supabaseUrl) {
    try {
        const url = new URL(supabaseUrl);
        const marker = '/storage/v1/object/public/';
        const idx = url.pathname.indexOf(marker);
        if (idx !== -1) {
            let key = url.pathname.substring(idx + marker.length);
            // Si le chemin commence par un nom de bucket (ex: product-images/ ou products/), le conserver ou normaliser
            return key;
        }
    } catch {}
    return null;
}

async function migrateUrlToR2(supabaseUrl) {
    if (!supabaseUrl || typeof supabaseUrl !== 'string') return null;
    if (!supabaseUrl.includes('supabase.co')) {
        // Déjà sur R2 ou CDN externe
        return supabaseUrl;
    }

    const key = getR2KeyFromSupabaseUrl(supabaseUrl);
    if (!key) {
        console.warn(`  ⚠️ Impossible d'extraire la clé de : ${supabaseUrl}`);
        return supabaseUrl;
    }

    const newPublicUrl = `${R2_PUBLIC_URL}/${key}`;

    try {
        console.log(`  📥 Téléchargement : ${supabaseUrl}`);
        const res = await fetch(supabaseUrl);
        if (!res.ok) {
            console.warn(`  ⚠️ Échec téléchargement (HTTP ${res.status}): ${supabaseUrl}`);
            return supabaseUrl;
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        const contentType = res.headers.get('content-type') || 'image/jpeg';

        console.log(`  📤 Upload vers Cloudflare R2 [${R2_BUCKET_NAME}] -> ${key} (${Math.round(buffer.length / 1024)} Ko)...`);
        await s3.send(new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000, immutable',
        }));

        console.log(`  ✅ Migré avec succès -> ${newPublicUrl}`);
        return newPublicUrl;
    } catch (err) {
        console.error(`  ❌ Erreur migration ${supabaseUrl}:`, err.message);
        return supabaseUrl;
    }
}

async function main() {
    console.log('🚀 Démarrage de la migration vers Cloudflare R2...');
    console.log(`📍 Bucket cible : ${R2_BUCKET_NAME}`);
    console.log(`🌐 URL publique : ${R2_PUBLIC_URL}`);

    let totalMigrated = 0;

    // 1. Migration des produits
    console.log('\n--- 1. Migration des Produits ---');
    const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('id, title, image_url, images');

    if (prodErr) {
        console.error('Erreur lecture produits:', prodErr);
    } else {
        console.log(`Nombre total de produits : ${products.length}`);
        for (const prod of products) {
            let hasChanges = false;
            let updatedImageUrl = prod.image_url;
            let updatedImages = Array.isArray(prod.images) ? [...prod.images] : [];

            if (prod.image_url && prod.image_url.includes('supabase.co')) {
                const migrated = await migrateUrlToR2(prod.image_url);
                if (migrated !== prod.image_url) {
                    updatedImageUrl = migrated;
                    hasChanges = true;
                    totalMigrated++;
                }
            }

            if (Array.isArray(prod.images)) {
                for (let i = 0; i < prod.images.length; i++) {
                    const img = prod.images[i];
                    if (img && img.includes('supabase.co')) {
                        const migrated = await migrateUrlToR2(img);
                        if (migrated !== img) {
                            updatedImages[i] = migrated;
                            hasChanges = true;
                            totalMigrated++;
                        }
                    }
                }
            }

            if (hasChanges) {
                const { error: updateErr } = await supabase
                    .from('products')
                    .update({
                        image_url: updatedImageUrl,
                        images: updatedImages,
                    })
                    .eq('id', prod.id);

                if (updateErr) {
                    console.error(`  ❌ Erreur mise à jour produit ID ${prod.id}:`, updateErr.message);
                } else {
                    console.log(`  💾 Base de données mise à jour pour le produit "${prod.title}"`);
                }
            }
        }
    }

    // 2. Migration des diapositives du carrousel
    console.log('\n--- 2. Migration des Diapositives du Carrousel ---');
    const { data: slides, error: slideErr } = await supabase
        .from('carousel_slides')
        .select('id, title, image_url');

    if (slideErr) {
        console.error('Erreur lecture carrousel:', slideErr);
    } else if (slides) {
        for (const slide of slides) {
            if (slide.image_url && slide.image_url.includes('supabase.co')) {
                const migrated = await migrateUrlToR2(slide.image_url);
                if (migrated !== slide.image_url) {
                    await supabase
                        .from('carousel_slides')
                        .update({ image_url: migrated })
                        .eq('id', slide.id);
                    console.log(`  💾 Diapositive "${slide.title}" mise à jour avec l'URL R2`);
                    totalMigrated++;
                }
            }
        }
    }

    // 3. Migration des logos partenaires
    console.log('\n--- 3. Migration des Partenaires ---');
    const { data: partners, error: partErr } = await supabase
        .from('partners')
        .select('id, name, logo_url');

    if (partErr) {
        console.error('Erreur lecture partenaires:', partErr);
    } else if (partners) {
        for (const partner of partners) {
            if (partner.logo_url && partner.logo_url.includes('supabase.co')) {
                const migrated = await migrateUrlToR2(partner.logo_url);
                if (migrated !== partner.logo_url) {
                    await supabase
                        .from('partners')
                        .update({ logo_url: migrated })
                        .eq('id', partner.id);
                    console.log(`  💾 Partenaire "${partner.name}" mis à jour avec l'URL R2`);
                    totalMigrated++;
                }
            }
        }
    }

    // 4. Migration des avatars de profils marchands
    console.log('\n--- 4. Migration des Avatars Marchands ---');
    const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('id, prenom, nom, avatar_url');

    if (profErr) {
        console.error('Erreur lecture profils:', profErr);
    } else if (profiles) {
        for (const prof of profiles) {
            if (prof.avatar_url && prof.avatar_url.includes('supabase.co')) {
                const migrated = await migrateUrlToR2(prof.avatar_url);
                if (migrated !== prof.avatar_url) {
                    await supabase
                        .from('profiles')
                        .update({ avatar_url: migrated })
                        .eq('id', prof.id);
                    console.log(`  💾 Avatar vendeur "${prof.prenom} ${prof.nom}" mis à jour avec l'URL R2`);
                    totalMigrated++;
                }
            }
        }
    }

    console.log(`\n🎉 MIGRATION TERMINÉE ! ${totalMigrated} image(s) transférée(s) avec succès vers Cloudflare R2.`);
    console.log('⚡ Bande passante Supabase Egress sauvegardée : ~100%');
}

main().catch(err => {
    console.error('Erreur fatale:', err);
    process.exit(1);
});
