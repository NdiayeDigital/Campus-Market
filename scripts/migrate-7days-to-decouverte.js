/**
 * Script de migration sécurisé : Bascule de l'essai 7 jours vers le Pack Découverte (0 FCFA).
 *
 * MODES D'EXÉCUTION :
 * 1. Simulation (Dry-Run) :
 *    node scripts/migrate-7days-to-decouverte.js --dry-run
 *    -> Analyse chaque vendeur, détermine son cas (1 à 10), affiche les actions sans rien modifier.
 *
 * 2. Exécution Réelle :
 *    node scripts/migrate-7days-to-decouverte.js --execute
 *    -> Applique la migration de façon strictement additive et idempotente.
 */

import fs from 'fs';
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

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL') || 'https://fqulqgdjusfzhcjpvyay.supabase.co';
const supabaseKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY') || getEnvVar('VITE_SUPABASE_ANON_KEY') || 'sb_publishable_QiS6HTBjjJo423rgUxdQ5A_A5NySDl7';

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erreur : Variables Supabase manquantes.');
    process.exit(1);
}

if (typeof WebSocket === 'undefined') {
    try {
        globalThis.WebSocket = class MockWebSocket {
            constructor() {}
            addEventListener() {}
            removeEventListener() {}
            send() {}
            close() {}
        };
    } catch (_) {}
}

const supabase = createClient(supabaseUrl, supabaseKey);

const isExecute = process.argv.includes('--execute');
const isDryRun = process.argv.includes('--dry-run') || !isExecute;

async function migrate() {
    console.log('======================================================================');
    console.log(`🚀 MIGRATION ESSAI 7 JOURS -> PACK DÉCOUVERTE [MODE: ${isExecute ? 'EXÉCUTION RÉELLE' : 'SIMULATION (DRY-RUN)'}]`);
    console.log('======================================================================\n');

    const now = new Date();

    // 1. Récupération des vendeurs
    const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('*');
    if (profErr) throw profErr;

    const sellers = profiles.filter((p) =>
        ['vendeur', 'vendeur_pending', 'vendeur_desactive', 'suspendu'].includes(p.role)
    );

    // 2. Récupération des produits
    const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
    if (prodErr) throw prodErr;

    // 3. Récupération des commandes livrées pour identifier le produit le plus récemment vendu
    const { data: deliveredOrders } = await supabase
        .from('orders')
        .select('product_id, seller_id, created_at')
        .eq('status', 'delivered')
        .order('created_at', { ascending: false });

    const latestDeliveredBySeller = new Map();
    (deliveredOrders || []).forEach((o) => {
        if (o.seller_id && !latestDeliveredBySeller.has(o.seller_id)) {
            latestDeliveredBySeller.set(o.seller_id, o.product_id);
        }
    });

    const productsBySeller = new Map();
    products.forEach((pr) => {
        if (!productsBySeller.has(pr.seller_id)) productsBySeller.set(pr.seller_id, []);
        productsBySeller.get(pr.seller_id).push(pr);
    });

    const stats = {
        totalSellers: sellers.length,
        cas1_activeTrial: 0,
        cas2_expiredTrialToMigrate: 0,
        cas3_paidActive: 0,
        cas4_productsToMask: 0,
        skippedAlreadyMigrated: 0,
    };

    const actionsToPerform = [];

    for (const seller of sellers) {
        const isPaidActive = seller.subscription_expires_at && new Date(seller.subscription_expires_at) > now;
        const sellerProds = productsBySeller.get(seller.id) || [];

        // Date effective de fin d'essai
        let trialEnd = null;
        if (seller.trial_extended_ends_at) {
            trialEnd = new Date(seller.trial_extended_ends_at);
        } else if (seller.trial_ends_at) {
            trialEnd = new Date(seller.trial_ends_at);
        } else if (seller.trial_started_at) {
            trialEnd = new Date(new Date(seller.trial_started_at).getTime() + 7 * 24 * 3600 * 1000);
        } else if (seller.created_at) {
            trialEnd = new Date(new Date(seller.created_at).getTime() + 7 * 24 * 3600 * 1000);
        }

        const isTrialActive = trialEnd && trialEnd > now && !isPaidActive;
        const isTrialExpired = (!trialEnd || trialEnd <= now) && !isPaidActive;

        if (isPaidActive) {
            stats.cas3_paidActive++;
            actionsToPerform.push({
                seller,
                caseId: 3,
                caseLabel: 'Abonné payant actif (Starter / Pro)',
                action: 'MAINTIEN_PACK_PAYANT',
                details: `Plan: ${seller.subscription_plan}, Expire le: ${seller.subscription_expires_at}`,
            });
            continue;
        }

        if (isTrialActive) {
            stats.cas1_activeTrial++;
            actionsToPerform.push({
                seller,
                caseId: 1,
                caseLabel: 'Essai gratuit 7j en cours',
                action: 'MAINTIEN_ESSAI_JUSQU_A_ECHEANCE',
                details: `Fin exacte le : ${trialEnd.toISOString()} (Bascule dynamique à la lecture)`,
            });
            continue;
        }

        if (isTrialExpired) {
            // Déjà migré ?
            if (seller.pack_actuel === 'decouverte' && seller.date_bascule) {
                stats.skippedAlreadyMigrated++;
                continue;
            }

            stats.cas2_expiredTrialToMigrate++;

            // Analyse des produits à conserver vs masquer
            let keptProduct = null;
            const prodsToMask = [];

            if (sellerProds.length > 0) {
                // Règle : conserver le plus récemment vendu, ou à défaut le plus récent créé
                const lastSoldProdId = latestDeliveredBySeller.get(seller.id);
                const foundSold = lastSoldProdId ? sellerProds.find((p) => p.id === lastSoldProdId) : null;

                if (foundSold) {
                    keptProduct = foundSold;
                } else {
                    keptProduct = sellerProds[0]; // Le plus récent par ORDER BY created_at DESC
                }

                sellerProds.forEach((p) => {
                    if (p.id !== keptProduct.id) {
                        prodsToMask.push(p);
                    }
                });
            }

            stats.cas4_productsToMask += prodsToMask.length;

            actionsToPerform.push({
                seller,
                caseId: 2,
                caseLabel: 'Essai 7j expiré -> Bascule Découverte',
                action: 'BASCULE_EN_DECOUVERTE',
                keptProduct,
                prodsToMask,
                details: `Produits total: ${sellerProds.length} -> 1 conservé, ${prodsToMask.length} masqué(s)`,
            });
        }
    }

    console.log(`📋 RAPPORT DE DÉNOMBREMENT :`);
    console.log(`   - Vendeurs totaux analysés : ${stats.totalSellers}`);
    console.log(`   - CAS 1 (Essai en cours, maintenu jusqu'à l'échéance) : ${stats.cas1_activeTrial}`);
    console.log(`   - CAS 2 (Essai expiré à basculer en Découverte) : ${stats.cas2_expiredTrialToMigrate}`);
    console.log(`   - CAS 3 (Abonnés payants Starter/Pro protégés) : ${stats.cas3_paidActive}`);
    console.log(`   - CAS 4 (Produits surnuméraires à masquer sans suppression) : ${stats.cas4_productsToMask}`);
    console.log(`   - Vendeurs déjà basculés précédemment : ${stats.skippedAlreadyMigrated}\n`);

    console.log('----------------------------------------------------------------------');
    console.log('DÉTAIL PAR MARCHAND :');
    console.log('----------------------------------------------------------------------');
    actionsToPerform.forEach((item, idx) => {
        const s = item.seller;
        console.log(`[#${idx + 1}] CAS ${item.caseId} : ${s.prenom} ${s.nom} (${s.email})`);
        console.log(`    Statut : ${item.caseLabel}`);
        console.log(`    Action : ${item.action}`);
        console.log(`    Détail : ${item.details}`);
        if (item.keptProduct) {
            console.log(`    ⭐ Produit actif conservé : "${item.keptProduct.title}" (ID: ${item.keptProduct.id})`);
        }
        if (item.prodsToMask && item.prodsToMask.length > 0) {
            item.prodsToMask.forEach((p) => {
                console.log(`    🔒 Produit masqué (masqué_quota) : "${p.title}" (ID: ${p.id})`);
            });
        }
        console.log('');
    });

    if (isDryRun) {
        console.log('======================================================================');
        console.log('ℹ️ SIMULATION TERMINÉE (DRY-RUN) : Aucune modification effectuée en base.');
        console.log('Pour appliquer réellement cette migration, lancez :');
        console.log('node scripts/migrate-7days-to-decouverte.js --execute');
        console.log('======================================================================');
        return;
    }

    // EXÉCUTION RÉELLE
    console.log('⚡ APPLICATION DES MODIFICATIONS EN BASE SUPABASE...');
    let migratedCount = 0;
    let maskedProductsCount = 0;

    for (const item of actionsToPerform) {
        if (item.action !== 'BASCULE_EN_DECOUVERTE') continue;

        const s = item.seller;
        const basculeDate = new Date().toISOString();

        // 1. Mise à jour du profil vendeur
        const updatePayload = {
            pack_actuel: 'decouverte',
            date_bascule: basculeDate,
            ancien_pack: 'essai_7j',
            motif_bascule: 'expiration_essai_7j',
            max_products: 1,
        };

        if (item.keptProduct) {
            updatePayload.produit_conserve_choisi = item.keptProduct.id;
        }

        const { error: updErr } = await supabase
            .from('profiles')
            .update(updatePayload)
            .eq('id', s.id);

        if (updErr) {
            console.error(`❌ Erreur mise à jour profil vendeur ${s.id}:`, updErr.message);
            continue;
        }

        // 2. Masquage des produits en surplus (sans suppression)
        if (item.prodsToMask && item.prodsToMask.length > 0) {
            const idsToMask = item.prodsToMask.map((p) => p.id);
            const { error: maskErr } = await supabase
                .from('products')
                .update({
                    is_active: false,
                    quota_status: 'masqué_quota',
                })
                .in('id', idsToMask);

            if (maskErr) {
                console.error(`❌ Erreur masquage produits pour vendeur ${s.id}:`, maskErr.message);
            } else {
                maskedProductsCount += idsToMask.length;
            }
        }

        // 3. Journal d'audit (FR-15)
        try {
            await supabase.from('audit_logs').insert([{
                user_id: s.id,
                action: 'BASCULE_PACK_DECOUVERTE',
                entity_type: 'profiles',
                entity_id: s.id,
                details: {
                    ancien_pack: 'essai_7j',
                    nouveau_pack: 'decouverte',
                    produit_conserve: item.keptProduct ? item.keptProduct.id : null,
                    produits_masques_count: item.prodsToMask ? item.prodsToMask.length : 0,
                    date_bascule: basculeDate,
                },
            }]);
        } catch {}

        migratedCount++;
    }

    console.log('\n======================================================================');
    console.log(`🎉 MIGRATION RÉUSSIE AVEC SUCCÈS !`);
    console.log(`   - Vendeurs basculés en Découverte : ${migratedCount}`);
    console.log(`   - Produits masqués réversiblement : ${maskedProductsCount}`);
    console.log('======================================================================');
}

migrate().catch((e) => {
    console.error('❌ Erreur critique lors de la migration :', e);
    process.exit(1);
});
