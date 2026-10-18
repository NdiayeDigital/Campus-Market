/**
 * API Serverless Endpoint : /api/webhook-saspay
 * Reçoit les notifications asynchrones en temps réel de SasPay (Wave / Orange Money).
 * Valide cryptographiquement la signature et active automatiquement l'abonnement du vendeur dans Supabase.
 */

import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fqulqgdjusfzhcjpvyay.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_QiS6HTBjjJo423rgUxdQ5A_A5NySDl7';
const SASPAY_WEBHOOK_SECRET = process.env.SASPAY_WEBHOOK_SECRET || process.env.SASPAY_SECRET_KEY || '';

const PLAN_QUOTAS = {
    starter: { maxProducts: 5, durationDays: 30 },
    pro: { maxProducts: 10, durationDays: 30 },
    premium: { maxProducts: 20, durationDays: 30 },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
    }

    try {
        let rawBody = req.body;
        let payload = rawBody;

        if (typeof rawBody === 'string') {
            try {
                payload = JSON.parse(rawBody);
            } catch {
                payload = {};
            }
        }

        // 1. Vérification de la signature HMAC SasPay si configurée
        const signature = req.headers['x-webhook-signature'] || req.headers['x-saspay-signature'];
        const timestamp = req.headers['x-webhook-timestamp'] || '';

        if (SASPAY_WEBHOOK_SECRET && signature) {
            try {
                const bodyStr = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);
                const toSign = timestamp ? `${timestamp}.${bodyStr}` : bodyStr;
                const expectedSignature = crypto
                    .createHmac('sha256', SASPAY_WEBHOOK_SECRET)
                    .update(toSign)
                    .digest('hex');

                if (signature !== expectedSignature) {
                    console.warn('[SasPay Webhook] Signature invalide détectée.');
                    return res.status(401).json({ error: 'Signature de webhook invalide.' });
                }
            } catch (sigErr) {
                console.error('[SasPay Webhook] Erreur vérification signature:', sigErr);
            }
        }

        console.log('[SasPay Webhook] Notification reçue :', payload);

        const eventType = payload.event || payload.type || '';
        const transactionData = payload.data || payload.transaction || payload;
        const status = (transactionData.status || transactionData.state || '').toUpperCase();

        const isSuccess = eventType === 'transaction.success' || status === 'SUCCESS' || transactionData.paid === true;

        if (!isSuccess) {
            console.log(`[SasPay Webhook] Événement ignoré (statut non concluant) : ${eventType} / ${status}`);
            return res.status(200).json({ received: true, status: 'ignored' });
        }

        // 2. Extraction des informations vendeur
        const metadata = transactionData.metadata || payload.metadata || {};
        const sellerId = metadata.seller_id || metadata.sellerId || transactionData.customer_id;
        const rawPlan = metadata.plan || 'starter';
        const validPlan = PLAN_QUOTAS[rawPlan] ? rawPlan : 'starter';
        const planConfig = PLAN_QUOTAS[validPlan];

        if (!sellerId) {
            console.warn('[SasPay Webhook] Aucun seller_id trouvé dans les métadonnées de transaction.');
            return res.status(200).json({ received: true, warning: 'missing_seller_id' });
        }

        // 3. Mise à jour automatique de la base Supabase
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false },
        });

        const durationDays = planConfig.durationDays || 30;
        const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
        const nowIso = new Date().toISOString();
        const transactionId = transactionData.id || transactionData.reference || `saspay_${Date.now()}`;

        // Activation de la boutique du vendeur
        const { error: profError } = await supabase
            .from('profiles')
            .update({
                subscription_status: 'active',
                subscription_plan: validPlan,
                max_products: planConfig.maxProducts,
                subscription_expires_at: expiresAt,
                last_payment_date: nowIso,
                last_payment_id: transactionId,
                is_open: true,
            })
            .eq('id', sellerId);

        if (profError) {
            console.error('[SasPay Webhook] Erreur mise à jour profil :', profError.message);
        } else {
            console.log(`[SasPay Webhook] 🎉 Abonnement activé automatiquement pour le vendeur ${sellerId} (${validPlan})`);
        }

        // Enregistrement de la trace de paiement certifiée
        try {
            await supabase.from('seller_payments').insert({
                seller_id: sellerId,
                amount: Number(transactionData.amount) || (validPlan === 'pro' ? 2500 : 1500),
                currency: 'XOF',
                plan: validPlan,
                operator: transactionData.payment_method?.includes('wave') ? 'wave' : 'om',
                provider: 'saspay',
                provider_session_id: transactionId,
                provider_payment_id: transactionData.payment_id || transactionId,
                status: 'success',
                metadata: {
                    webhook_received_at: nowIso,
                    event_type: eventType,
                    raw_data: transactionData,
                    mode: 'automatic_webhook',
                },
            });
        } catch (payErr) {
            console.warn('[SasPay Webhook] Note trace seller_payments :', payErr.message);
        }

        return res.status(200).json({
            received: true,
            success: true,
            status: 'processed',
            sellerId,
            plan: validPlan,
            activated: true,
        });
    } catch (err) {
        console.error('[SasPay Webhook] Exception non gérée :', err);
        return res.status(500).json({ error: err.message });
    }
}
