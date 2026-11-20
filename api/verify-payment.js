/**
 * API Serverless Endpoint : /api/verify-payment
 * Vérifie l'état réel d'un paiement SasPay (Wave / OM).
 * Sécurisé : Supprime toute auto-activation frauduleuse sans règlement prouvé.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fqulqgdjusfzhcjpvyay.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const SASPAY_SECRET_KEY = process.env.SASPAY_SECRET_KEY;

/**
 * Correspondances et alias commerciaux vers les clés techniques en base.
 * Clé technique 'starter' = Pack Pro (1 000 FCFA / 30 jours, ancien prix 1 500)
 * Clé technique 'pro'     = Pack Business (2 000 FCFA / 30 jours, ancien prix 2 500)
 * Alias : pro -> starter (1 000 F), business -> pro (2 000 F).
 */
const PLAN_ALIASES = {
    starter: 'starter',
    pro: 'starter',          // Alias commercial Pack Pro -> starter
    business: 'pro',         // Alias commercial Pack Business -> pro
    pack_pro: 'starter',
    pack_business: 'pro',
    pack_starter: 'starter',
};

function resolvePlanKey(rawPlan, amount) {
    if (amount !== undefined && amount !== null && !isNaN(Number(amount))) {
        const num = Number(amount);
        if (num >= 2000) return 'pro';      // Pack Business (2 000 FCFA, compatible ancien 2 500)
        if (num >= 1000) return 'starter';  // Pack Pro (1 000 FCFA, compatible ancien 1 500)
    }
    if (!rawPlan) return 'starter';
    const clean = String(rawPlan).trim().toLowerCase();
    if (clean === 'business' || clean === 'pack_business') return 'pro';
    if (clean === 'starter' || clean === 'pack_starter') return 'starter';
    if (clean === 'pro' || clean === 'pack_pro') return 'starter';
    return PLAN_ALIASES[clean] || 'starter';
}

const PLAN_QUOTAS = {
    starter: { maxProducts: 5, durationDays: 30, maxOrders: null, maxSales: null },
    pro: { maxProducts: 10, durationDays: 30, maxOrders: null, maxSales: null },
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

        const { sessionId, sellerId, plan = 'starter', operator = 'wave', type, adId, ad_id } = body || {};

        if (!sessionId || (!sellerId && !adId && !ad_id)) {
            return res.status(400).json({ error: 'Identifiant de session et référence vendeur/annonce obligatoires.' });
        }

        const isAdPayment = plan === 'annonce' || type === 'advertisement' || type === 'annonce' || Boolean(adId || ad_id);
        const targetAdId = adId || ad_id;

        const resolvedKey = isAdPayment ? 'annonce' : resolvePlanKey(plan, body?.amount);
        const validPlan = PLAN_QUOTAS[resolvedKey] ? resolvedKey : 'starter';
        const planDetails = PLAN_QUOTAS[validPlan] || PLAN_QUOTAS.starter;
        const maxProducts = planDetails.maxProducts;
        const durationDays = isAdPayment ? 7 : planDetails.durationDays;
        const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();
        const nowIso = new Date().toISOString();

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            console.error('[Verify Payment] Clé SUPABASE_SERVICE_ROLE_KEY manquante.');
            return res.status(500).json({ error: 'Configuration serveur incomplète (SUPABASE_SERVICE_ROLE_KEY manquant).' });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false },
        });

        // 1. Vérifier si le paiement a déjà été validé (par le Webhook SasPay ou une vérification antérieure)
        const { data: existingPayment } = await supabase
            .from('seller_payments')
            .select('*')
            .or(`provider_session_id.eq."${sessionId}",id.eq."${sessionId}"`)
            .maybeSingle();

        if (existingPayment && existingPayment.status === 'success') {
            if (isAdPayment) {
                // Publication automatique de l'annonce si ce n'est pas déjà fait
                let finalAdId = targetAdId;
                if (!finalAdId && sellerId) {
                    const { data: pendingAd } = await supabase
                        .from('advertisements')
                        .select('id')
                        .eq('seller_id', sellerId)
                        .eq('status', 'paiement_en_attente')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();
                    if (pendingAd) finalAdId = pendingAd.id;
                }

                if (finalAdId) {
                    await supabase
                        .from('advertisements')
                        .update({
                            status: 'publiee',
                            validated_at: nowIso,
                            expires_at: expiresAt,
                            transaction_ref: sessionId,
                            rejection_reason: null,
                            updated_at: nowIso,
                        })
                        .eq('id', finalAdId);

                    try {
                        await supabase.from('audit_logs').insert({
                            user_id: sellerId || null,
                            action: 'PUBLICATION_ANNONCE_SASPAY_AUTO',
                            entity_type: 'advertisements',
                            entity_id: String(finalAdId),
                            details: { amount: 250, provider: 'saspay', transaction_id: sessionId, auto_published: true, expires_at: expiresAt },
                        });
                    } catch {}
                }

                return res.status(200).json({
                    success: true,
                    verified: true,
                    mode: 'database_confirmed',
                    type: 'advertisement',
                    adId: finalAdId,
                    status: 'publiee',
                    expiresAt,
                    message: 'Paiement de l\'annonce confirmé avec succès. Annonce publiée pour 7 jours.',
                });
            }

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
                        if (isAdPayment) {
                            let finalAdId = targetAdId;
                            if (!finalAdId && sellerId) {
                                const { data: pendingAd } = await supabase
                                    .from('advertisements')
                                    .select('id')
                                    .eq('seller_id', sellerId)
                                    .eq('status', 'paiement_en_attente')
                                    .order('created_at', { ascending: false })
                                    .limit(1)
                                    .maybeSingle();
                                if (pendingAd) finalAdId = pendingAd.id;
                            }

                            if (finalAdId) {
                                await supabase
                                    .from('advertisements')
                                    .update({
                                        status: 'publiee',
                                        validated_at: nowIso,
                                        expires_at: expiresAt,
                                        transaction_ref: sessionId,
                                        rejection_reason: null,
                                        updated_at: nowIso,
                                    })
                                    .eq('id', finalAdId);

                                try {
                                    await supabase.from('audit_logs').insert({
                                        user_id: sellerId || null,
                                        action: 'PUBLICATION_ANNONCE_SASPAY_AUTO',
                                        entity_type: 'advertisements',
                                        entity_id: String(finalAdId),
                                        details: { amount: 250, provider: 'saspay', transaction_id: sessionId, auto_published: true, expires_at: expiresAt },
                                    });
                                } catch {}
                            }

                            try {
                                await supabase.from('seller_payments').upsert({
                                    seller_id: sellerId,
                                    amount: 250,
                                    currency: 'XOF',
                                    plan: 'starter',
                                    operator: operator === 'om' ? 'om' : 'wave',
                                    provider: 'saspay',
                                    provider_session_id: sessionId,
                                    status: 'success',
                                    metadata: { verified_at: nowIso, mode: 'api_realtime', type: 'advertisement', ad_id: finalAdId, saspay_response: data },
                                }, { onConflict: 'provider_session_id' });
                            } catch {}

                            return res.status(200).json({
                                success: true,
                                verified: true,
                                mode: 'live_api',
                                type: 'advertisement',
                                adId: finalAdId,
                                status: 'publiee',
                                expiresAt,
                                message: 'Paiement SasPay validé. Annonce publiée immédiatement pour 7 jours.',
                            });
                        }

                        // Activer le vendeur dans Supabase (Abonnement standard)
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
