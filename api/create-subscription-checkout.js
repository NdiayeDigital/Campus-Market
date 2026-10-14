/**
 * API Serverless Endpoint : /api/create-subscription-checkout
 * Crée une session de paiement pour l'abonnement d'un vendeur (Pack Starter, Pro ou Premium)
 * via SasPay (Wave ou Orange Money) ou bascule sur le simulateur Sandbox si aucune clé n'est configurée.
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
        paymentLink: 'https://link.saspay.me/hgc4jifsarq',
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

        const effectiveOrigin = origin || req.headers?.origin || 'http://localhost:5173';

        // 1. Mode Production / Test avec clé API SasPay
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
                        return_url: `${effectiveOrigin}/#seller?payment=success&plan=${plan}&op=${validOperator}`,
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
                    return res.status(200).json({
                        mode: 'live',
                        checkoutUrl: saspayData.checkout_url || saspayData.url,
                        sessionId: saspayData.id || saspayData.session_id,
                        plan,
                        operator: validOperator,
                        amount: planConfig.amount,
                    });
                } else {
                    const errorText = await saspayRes.text();
                    console.warn('[SasPay API] Erreur retournée:', errorText);
                    // Repli transparent sur le simulateur si la clé de test a expiré
                }
            } catch (apiErr) {
                console.warn('[SasPay API] Exception réseau:', apiErr.message);
            }
        }

        // 2. Mode Sandbox / Simulateur Réaliste (Actif par défaut tant que les clés ne sont pas configurées)
        const sandboxSessionId = `sandbox_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        return res.status(200).json({
            mode: 'sandbox',
            sessionId: sandboxSessionId,
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
            message: 'Session de simulation créée avec succès. Vous pouvez tester le paiement sans clé API.',
        });
    } catch (err) {
        console.error('[CreateCheckout] Erreur:', err);
        return res.status(500).json({ error: err.message || 'Erreur interne du serveur.' });
    }
}
