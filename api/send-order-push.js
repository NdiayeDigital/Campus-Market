/**
 * Endpoint Serverless : /api/send-order-push
 * Envoie une notification Web Push native aux téléphones des vendeurs
 * même lorsqu'ils sont verrouillés ou avec le navigateur fermé.
 * Campus Market - Université Iba Der Thiam de Thiès (UIDT).
 */

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://fqulqgdjusfzhcjpvyay.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QiS6HTBjjJo423rgUxdQ5A_A5NySDl7';

// Clés VAPID officielles Campus Market
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BHqBPmVryy2hCYhoRicHjMK-mKP7d211SBwUOVaVxnXBU52ljxIAPCNGuw9fMJjqqC9O_iaBvhNgpoyALrci3w4';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'AGZx2a4R2M0wFxEeCebhFeBPO4iI9Q6_y2UOpzywzm8';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contact@campusmarket-uidt.com';

try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (e) {
    console.warn('[PushAPI] Erreur configuration VAPID:', e);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
    }

    try {
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch {
                body = {};
            }
        }

        const { sellerId, buyerName, totalPrice, deliveryLocation, orderReference } = body || {};

        if (!sellerId) {
            return res.status(400).json({ error: 'sellerId requis pour notifier le marchand.' });
        }

        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        const supabase = createClient(SUPABASE_URL, supabaseKey, {
            auth: { persistSession: false },
        });

        // 1. Récupérer les abonnements push enregistrés pour ce marchand
        const { data: subs, error: subErr } = await supabase
            .from('seller_push_subscriptions')
            .select('id, endpoint, p256dh, auth')
            .eq('seller_id', sellerId);

        if (subErr) {
            console.error('[PushAPI] Erreur lecture abonnements:', subErr);
            return res.status(500).json({ error: 'Erreur lors de la lecture des abonnements marchands.' });
        }

        if (!subs || subs.length === 0) {
            return res.status(200).json({
                success: true,
                sentCount: 0,
                message: 'Aucun appareil enregistré en veille pour ce marchand.',
            });
        }

        const buyer = buyerName || 'Un étudiant';
        const priceStr = totalPrice ? `${Number(totalPrice).toLocaleString('fr-FR')} FCFA` : '';
        const loc = deliveryLocation || 'Campus UIDT';

        const payload = JSON.stringify({
            title: '🛍️ Nouvelle commande - Campus Market',
            body: `Commande de ${buyer} (${priceStr}) au ${loc}`,
            icon: '/assets/logo-192x192.png',
            badge: '/assets/logo-192x192.png',
            url: '/#seller',
            reference: orderReference || null,
            timestamp: Date.now(),
        });

        const staleSubscriptionIds = [];
        let successCount = 0;

        // 2. Envoyer la notification push à tous les terminaux enregistrés
        const sendPromises = subs.map(async (sub) => {
            const pushConfig = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                },
            };

            try {
                await webpush.sendNotification(pushConfig, payload, {
                    TTL: 60 * 60 * 24, // 24h
                    urgency: 'high',
                });
                successCount++;
            } catch (err) {
                console.warn('[PushAPI] Échec envoi push:', sub.endpoint, err.statusCode);
                // Si l'endpoint a expiré (404 ou 410 GCM/Apple), marquer pour suppression
                if (err.statusCode === 404 || err.statusCode === 410) {
                    staleSubscriptionIds.push(sub.id);
                }
            }
        });

        await Promise.all(sendPromises);

        // 3. Nettoyer les abonnements obsolètes en arrière-plan
        if (staleSubscriptionIds.length > 0) {
            await supabase
                .from('seller_push_subscriptions')
                .delete()
                .in('id', staleSubscriptionIds);
        }

        return res.status(200).json({
            success: true,
            totalDevices: subs.length,
            sentCount: successCount,
            cleanedStaleCount: staleSubscriptionIds.length,
        });
    } catch (err) {
        console.error('[PushAPI] Exception globale push:', err);
        return res.status(500).json({ error: err.message || 'Erreur serveur interne push.' });
    }
}
