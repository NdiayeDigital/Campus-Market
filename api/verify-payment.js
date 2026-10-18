/**
 * API Serverless Endpoint : /api/verify-payment
 * Vérifie l'état réel d'un paiement SasPay (Wave / OM).
 * Sécurisé : Supprime toute auto-activation frauduleuse sans règlement prouvé.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fqulqgdjusfzhcjpvyay.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_QiS6HTBjjJo423rgUxdQ5A_A5NySDl7';
const SASPAY_SECRET_KEY = process.env.SASPAY_SECRET_KEY;

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
        let body = req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch {
                body = {};
            }
        }

        const { sessionId, sellerId, plan = 'starter', operator = 'wave' } = body || {};

        if (!sessionId || !sellerId) {
            return res.status(400).json({ error: 'Identifiant de session et vendeur obligatoires.' });
        }

        const validPlan = PLAN_QUOTAS[plan] ? plan : 'starter';
        const planDetails = PLAN_QUOTAS[validPlan];
        const maxProducts = planDetails.maxProducts;
        const durationDays = planDetails.durationDays;
        const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
        const nowIso = new Date().toISOString();

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false },
        });

        // 1. Vérifier si le paiement a déjà été validé (par le Webhook SasPay ou le SuperAdmin)
        const { data: existingPayment } = await supabase
            .from('seller_payments')
            .select('*')
            .or(`provider_session_id.eq."${sessionId}",id.eq."${sessionId}"`)
            .maybeSingle();

        if (existingPayment && existingPayment.status === 'success') {
            return res.status(200).json({
                success: true,
                verified: true,
                mode: 'database_confirmed',
                sessionId,
                plan: validPlan,
                operator,
                maxProducts,
                durationDays,
                subscriptionStatus: 'active',
                message: 'Paiement confirmé avec succès.',
            });
        }

        // 2. Interrogation directe de l'API SasPay en temps réel
        if (SASPAY_SECRET_KEY && SASPAY_SECRET_KEY.startsWith('sk_')) {
            try {
                // Tentative via l'endpoint de vérification de paiement SasPay
                const saspayRes = await fetch(`https://api.saspay.me/api/v1/payments/${sessionId}/verify/`, {
                    headers: {
                        'Authorization': `Bearer ${SASPAY_SECRET_KEY}`,
                    },
                });

                if (saspayRes.ok) {
                    const data = await saspayRes.json();
                    const status = (data.status || data.state || '').toUpperCase();
                    const isPaid = status === 'SUCCESS' || status === 'PAID' || data.paid === true;

                    if (isPaid) {
                        // Activer le vendeur dans Supabase
                        await supabase
                            .from('profiles')
                            .update({
                                subscription_status: 'active',
                                subscription_plan: validPlan,
                                max_products: maxProducts,
                                subscription_expires_at: expiresAt,
                                last_payment_date: nowIso,
                                last_payment_id: sessionId,
                                is_open: true,
                            })
                            .eq('id', sellerId);

                        // Marquer la transaction comme réussie
                        await supabase.from('seller_payments').upsert({
                            seller_id: sellerId,
                            amount: validPlan === 'pro' ? 2500 : 1500,
                            currency: 'XOF',
                            plan: validPlan,
                            operator: operator === 'om' ? 'om' : 'wave',
                            provider: 'saspay',
                            provider_session_id: sessionId,
                            status: 'success',
                            metadata: {
                                verified_at: nowIso,
                                mode: 'api_realtime',
                                saspay_response: data,
                            },
                        }, { onConflict: 'provider_session_id' });

                        return res.status(200).json({
                            success: true,
                            verified: true,
                            mode: 'live_api',
                            sessionId,
                            plan: validPlan,
                            operator,
                            maxProducts,
                            durationDays,
                            subscriptionStatus: 'active',
                            expiresAt,
                            message: `Paiement SasPay confirmé (${operator === 'om' ? 'Orange Money' : 'Wave'}). Abonnement activé pour 30 jours.`,
                        });
                    }
                }
            } catch (err) {
                console.warn('[VerifyPayment] Exception interrogation SasPay:', err.message);
            }
        }

        // 3. Si non confirmé par l'API SasPay et non validé en base, REFUS STRICT DE VALIDATION
        return res.status(400).json({
            success: false,
            verified: false,
            status: 'pending_or_unpaid',
            sessionId,
            error: 'Le paiement n\'a pas encore été confirmé par Wave / Orange Money. Veuillez finaliser la transaction sur votre téléphone.',
        });
    } catch (err) {
        console.error('[VerifyPayment] Erreur interne:', err);
        return res.status(500).json({ error: err.message || 'Erreur lors de la vérification.' });
    }
}
