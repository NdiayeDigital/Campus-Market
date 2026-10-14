/**
 * API Serverless Endpoint : /api/webhook-saspay
 * Reçoit les webhooks asynchrones de SasPay pour mettre à jour la base Supabase.
 */

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

        console.log('[SasPay Webhook] Notification reçue:', body);

        // Répondre 200 immédiatement à SasPay pour acquitter la réception
        return res.status(200).json({ received: true, status: 'processed' });
    } catch (err) {
        console.error('[SasPay Webhook] Exception:', err);
        return res.status(500).json({ error: err.message });
    }
}
