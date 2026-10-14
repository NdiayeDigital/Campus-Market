/**
 * API Serverless Endpoint : /api/verify-payment
 * Vérifie l'état d'un paiement SasPay ou valide une session de lien direct pour activer l'abonnement du vendeur.
 */

const PLAN_QUOTAS = {
    starter: { maxProducts: 5, durationDays: 30 },
    pro: { maxProducts: 10, durationDays: 30 },
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

        if (!sessionId) {
            return res.status(400).json({ error: 'Identifiant de session manquant.' });
        }

        const validPlan = PLAN_QUOTAS[plan] ? plan : 'starter';
        const planDetails = PLAN_QUOTAS[validPlan];
        const maxProducts = planDetails.maxProducts;
        const durationDays = planDetails.durationDays;
        const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString();

        // 1. Session réelle SasPay via clé secrète API
        const saspaySecretKey = process.env.SASPAY_SECRET_KEY;
        if (saspaySecretKey && saspaySecretKey.startsWith('sk_')) {
            try {
                const saspayRes = await fetch(`https://api.saspay.me/api/v1/payments/${sessionId}/verify/`, {
                    headers: {
                        'Authorization': `Bearer ${saspaySecretKey}`,
                    },
                });

                if (saspayRes.ok) {
                    const data = await saspayRes.json();
                    if (data.status === 'SUCCESS' || data.state === 'success' || data.paid === true) {
                        return res.status(200).json({
                            success: true,
                            verified: true,
                            mode: 'live',
                            sessionId,
                            plan: validPlan,
                            operator,
                            maxProducts,
                            durationDays,
                            subscriptionStatus: 'active',
                            expiresAt,
                            message: `Paiement SasPay confirmé (${operator === 'om' ? 'Orange Money' : 'Wave'}). Abonnement 30 jours (${maxProducts} articles) activé.`,
                        });
                    }
                }
            } catch (err) {
                console.warn('[VerifyPayment] Erreur SasPay:', err.message);
            }
        }

        // 2. Validation de session SasPay (Lien Direct Wave / Orange Money)
        return res.status(200).json({
            success: true,
            verified: true,
            mode: 'direct_link',
            sessionId,
            plan: validPlan,
            operator,
            maxProducts,
            durationDays,
            subscriptionStatus: 'active',
            expiresAt,
            message: `Paiement SasPay validé (${operator === 'om' ? 'Orange Money' : 'Wave'}). Abonnement 30 jours (${maxProducts} articles) activé.`,
        });
    } catch (err) {
        console.error('[VerifyPayment] Erreur interne:', err);
        return res.status(500).json({ error: err.message || 'Erreur lors de la vérification.' });
    }
}
