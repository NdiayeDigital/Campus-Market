/**
 * API Serverless Endpoint : /api/create-subscription-checkout
 * Crée une session de paiement pour l'abonnement d'un vendeur (Pack Starter ou Pro)
 * via SasPay (Wave ou Orange Money) ou génère les informations de paiement par lien direct.
 */

const PLAN_PRICES = {
    starter: { 
        amount: '1500.00', 
        maxProducts: 5, 
        label: 'Pack Starter', 
        period: 'mois', 
        durationDays: 30,
        paymentLink: 'https://link.saspay.me/hgc4jifsarq',
    },
    pro: { 
        amount: '2500.00', 
        maxProducts: 10, 
        label: 'Pack Pro', 
        period: 'mois', 
        durationDays: 30,
        paymentLink: 'https://link.saspay.me/gxky6adwejc',
    },
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

        const { sellerId, plan = 'starter', operator = 'wave', sellerEmail, sellerName, origin } = body || {};

        if (!sellerId) {
            return res.status(400).json({ error: 'Identifiant du vendeur manquant.' });
        }

        const planConfig = PLAN_PRICES[plan] || PLAN_PRICES.starter;
        const validOperator = operator === 'om' ? 'om' : 'wave';
        const saspaySecretKey = process.env.SASPAY_SECRET_KEY;

        function getSafeOrigin(reqOrigin, bodyOrigin) {
            const candidate = bodyOrigin || reqOrigin;
            if (candidate) {
                try {
                    const parsed = new URL(candidate);
                    const host = parsed.hostname;
                    if (
                        host === 'campusmarket-uidt.com' ||
                        host.endsWith('.campusmarket-uidt.com') ||
                        host.endsWith('.vercel.app') ||
                        host === 'localhost' ||
                        host === '127.0.0.1'
                    ) {
                        return parsed.origin;
                    }
                } catch {
                    // Ignorer les formats d'URL invalides
                }
            }
            return 'https://campusmarket-uidt.com';
        }

        const effectiveOrigin = getSafeOrigin(req.headers?.origin, origin);

        // 1. Mode API SasPay (si clé secrète configurée dans l'environnement)
        if (saspaySecretKey && saspaySecretKey.startsWith('sk_')) {
            try {
                const saspayRes = await fetch('https://api.saspay.me/api/v1/checkout-sessions/', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${saspaySecretKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        amount: planConfig.amount,
                        currency: 'XOF',
                        description: `Campus Market UIDT - Abonnement ${planConfig.label}`,
                        customer_email: sellerEmail || 'etudiant@univ-thies.sn',
                        customer_name: sellerName || 'Vendeur Campus',
                        payment_method: validOperator === 'wave' ? 'wave_sn' : 'orange_money_sn',
                        return_url: `${effectiveOrigin}/#seller?payment=success&plan=${plan}&op=${validOperator}&session_id={CHECKOUT_SESSION_ID}`,
                        cancel_url: `${effectiveOrigin}/#seller?payment=cancelled`,
                        metadata: {
                            seller_id: sellerId,
                            plan,
                            operator: validOperator,
                        },
                    }),
                });

                if (saspayRes.ok) {
                    const saspayData = await saspayRes.json();
                    const liveSessionId = saspayData.id || saspayData.session_id;

                    // Trace d'intention de paiement en attente
                    try {
                        const { createClient } = await import('@supabase/supabase-js');
                        const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fqulqgdjusfzhcjpvyay.supabase.co';
                        const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_QiS6HTBjjJo423rgUxdQ5A_A5NySDl7';
                        const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
                        await sb.from('seller_payments').insert({
                            seller_id: sellerId,
                            amount: Number(planConfig.amount),
                            currency: 'XOF',
                            plan,
                            operator: validOperator,
                            provider: 'saspay',
                            provider_session_id: liveSessionId,
                            status: 'pending',
                            metadata: {
                                initiated_at: new Date().toISOString(),
                                mode: 'checkout_session',
                            },
                        });
                    } catch {}

                    return res.status(200).json({
                        mode: 'live',
                        checkoutUrl: saspayData.checkout_url || saspayData.url,
                        sessionId: liveSessionId,
                        plan,
                        operator: validOperator,
                        amount: planConfig.amount,
                    });
                } else {
                    const errorText = await saspayRes.text();
                    console.warn('[SasPay API] Erreur retournée:', errorText);
                }
            } catch (apiErr) {
                console.warn('[SasPay API] Exception réseau:', apiErr.message);
            }
        }

        // 2. Mode Lien Direct SasPay (fallback lorsque l'API directe n'est pas encore activée)
        const directSessionId = `saspay_link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return res.status(200).json({
            mode: 'direct_link',
            sessionId: directSessionId,
            plan,
            operator: validOperator,
            amount: planConfig.amount,
            planLabel: planConfig.label,
            maxProducts: planConfig.maxProducts,
            priceFormatted: `${Number(planConfig.amount).toLocaleString('fr-FR')} FCFA / ${planConfig.period || 'mois'}`,
            period: planConfig.period || 'mois',
            durationDays: planConfig.durationDays || 30,
            operatorLabel: validOperator === 'wave' ? 'Wave Sénégal' : 'Orange Money Sénégal',
            checkoutUrl: planConfig.paymentLink,
            paymentLink: planConfig.paymentLink,
        });
    } catch (err) {
        console.error('[CreateCheckout] Erreur:', err);
        return res.status(500).json({ error: err.message || 'Erreur interne du serveur.' });
    }
}
