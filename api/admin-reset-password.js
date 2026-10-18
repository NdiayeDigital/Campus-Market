/**
 * API Serverless Endpoint : /api/admin-reset-password
 * Réinitialise le mot de passe d'un vendeur au mot de passe temporaire 'campus1234!'
 * et active le drapeau de changement obligatoire de mot de passe.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://fqulqgdjusfzhcjpvyay.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QiS6HTBjjJo423rgUxdQ5A_A5NySDl7';

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

        const { sellerId } = body || {};

        if (!sellerId) {
            return res.status(400).json({ error: 'Identifiant du vendeur manquant.' });
        }

        // 1. Si la clé de service (service_role) est disponible côté serveur
        if (SUPABASE_SERVICE_ROLE_KEY) {
            const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
                auth: { persistSession: false },
            });

            // Mise à jour du mot de passe dans Supabase Auth vers 'campus1234!'
            const { error: authError } = await adminClient.auth.admin.updateUserById(sellerId, {
                password: 'campus1234!',
            });

            if (authError) {
                return res.status(500).json({ error: `Erreur Supabase Auth: ${authError.message}` });
            }

            // Mise à jour du drapeau must_change_password dans profiles
            const { error: profError } = await adminClient
                .from('profiles')
                .update({ must_change_password: true })
                .eq('id', sellerId);

            if (profError) {
                console.warn('[AdminResetPassword] Avertissement profil:', profError.message);
            }

            return res.status(200).json({
                success: true,
                message: 'Mot de passe réinitialisé avec succès à campus1234!',
                sellerId,
            });
        }

        // 2. Sinon, tenter d'exécuter via la fonction RPC
        const authHeader = req.headers.authorization;
        const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false },
            global: {
                headers: authHeader ? { Authorization: authHeader } : {},
            },
        });

        const { data, error: rpcError } = await client.rpc('admin_reset_seller_password', {
            target_user_id: sellerId,
        });

        if (rpcError) {
            return res.status(500).json({ error: rpcError.message });
        }

        return res.status(200).json({
            success: true,
            message: 'Mot de passe réinitialisé avec succès à campus1234!',
            sellerId,
        });
    } catch (err) {
        console.error('[AdminResetPassword] Exception:', err);
        return res.status(500).json({ error: err.message || 'Erreur interne du serveur.' });
    }
}
