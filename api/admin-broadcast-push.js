/**
 * API Serverless Endpoint : /api/admin-broadcast-push
 * Permet au SuperAdmin de diffuser une notification Web Push native
 * à l'ensemble des appareils inscrits (étudiants, acheteurs, vendeurs)
 * ou à un segment d'audience ciblé.
 *
 * SÉCURITÉ :
 * Requiert formellement un jeton Bearer appartenant à un utilisateur avec le rôle 'superadmin'.
 * La clé privée VAPID_PRIVATE_KEY reste strictement confinée côté serveur.
 */

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://fqulqgdjusfzhcjpvyay.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_QiS6HTBjjJo423rgUxdQ5A_A5NySDl7';

// Configuration VAPID dynamique
let vapidConfigured = false;
function ensureVapidConfigured() {
    if (vapidConfigured) return true;
    const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || 'BHqBPmVryy2hCYhoRicHjMK-mKP7d211SBwUOVaVxnXBU52ljxIAPCNGuw9fMJjqqC9O_iaBvhNgpoyALrci3w4';
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:contact@campusmarket-uidt.com';

    if (!publicKey || !privateKey) {
        return false;
    }
    try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        vapidConfigured = true;
        return true;
    } catch (e) {
        console.error('[BroadcastPushAPI] Erreur configuration VAPID:', e);
        return false;
    }
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

        const { title, body: messageBody, url = '/', targetAudience = 'all' } = body || {};

        // 1. Validation des paramètres requis
        const cleanTitle = (title || '').trim();
        const cleanMessage = (messageBody || '').trim();
        const cleanUrl = (url || '/').trim();
        const audience = ['all', 'sellers', 'buyers'].includes(targetAudience) ? targetAudience : 'all';

        if (!cleanTitle || cleanTitle.length < 3 || cleanTitle.length > 80) {
            return res.status(400).json({ error: 'Le titre est obligatoire (entre 3 et 80 caractères).' });
        }

        if (!cleanMessage || cleanMessage.length < 5 || cleanMessage.length > 250) {
            return res.status(400).json({ error: 'Le corps du message est obligatoire (entre 5 et 250 caractères).' });
        }

        // 2. Contrôle de sécurité SuperAdmin
        const authHeader = req.headers.authorization || req.headers.Authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Authentification requise. Jeton Bearer manquant.' });
        }

        const token = authHeader.replace(/^Bearer\s+/i, '').trim();
        const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: { persistSession: false },
            global: {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            },
        });

        const { data: userData, error: userError } = await authClient.auth.getUser(token);
        if (userError || !userData?.user) {
            return res.status(401).json({ error: 'Jeton de session invalide ou expiré.' });
        }

        const callerId = userData.user.id;

        // Vérification stricte du rôle SuperAdmin dans la table profiles
        let callerProfile = null;
        const { data: profileData, error: profileError } = await authClient
            .from('profiles')
            .select('role')
            .eq('id', callerId)
            .maybeSingle();

        callerProfile = profileData;

        // Secours avec service_role si présent côté serveur
        if ((!callerProfile || profileError) && SUPABASE_SERVICE_ROLE_KEY) {
            const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
                auth: { persistSession: false },
            });
            const { data: sProfile } = await serviceClient
                .from('profiles')
                .select('role')
                .eq('id', callerId)
                .maybeSingle();
            if (sProfile) callerProfile = sProfile;
        }

        if (!callerProfile || callerProfile.role !== 'superadmin') {
            return res.status(403).json({ error: 'Accès refusé. Privilèges Super Administrateur requis.' });
        }

        // 3. Vérification de la configuration VAPID
        if (!ensureVapidConfigured()) {
            console.error('[BroadcastPushAPI] Configuration VAPID incomplète : VAPID_PRIVATE_KEY non configurée.');
            return res.status(500).json({
                error: 'Configuration Push serveur incomplète : VAPID_PRIVATE_KEY non renseignée dans les variables d’environnement.',
            });
        }

        // Client avec privilèges d'administration Supabase pour la lecture des souscriptions
        const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;
        const supabaseAdmin = createClient(SUPABASE_URL, supabaseKey, {
            auth: { persistSession: false },
            global: {
                headers: SUPABASE_SERVICE_ROLE_KEY ? {} : {
                    Authorization: `Bearer ${token}`,
                },
            },
        });

        // 4. Récupération & Déduplication des abonnements
        const subscriptionsMap = new Map(); // endpoint -> { endpoint, p256dh, auth, role, table, id }

        // 4.a. Lecture de la table globale push_subscriptions
        try {
            let query = supabaseAdmin.from('push_subscriptions').select('id, endpoint, p256dh, auth, role');
            if (audience === 'sellers') {
                query = query.eq('role', 'vendeur');
            } else if (audience === 'buyers') {
                query = query.in('role', ['acheteur', 'visitor']);
            }

            const { data: globalSubs, error: globalErr } = await query;
            if (!globalErr && Array.isArray(globalSubs)) {
                for (const sub of globalSubs) {
                    if (sub.endpoint && sub.p256dh && sub.auth) {
                        subscriptionsMap.set(sub.endpoint, {
                            ...sub,
                            sourceTable: 'push_subscriptions',
                        });
                    }
                }
            }
        } catch (e) {
            console.warn('[BroadcastPushAPI] Erreur lecture push_subscriptions (repli normal si non migré):', e.message);
        }

        // 4.b. Lecture de la table existante seller_push_subscriptions (rétrocompatibilité marchands)
        if (audience === 'all' || audience === 'sellers') {
            try {
                const { data: sellerSubs, error: sellerErr } = await supabaseAdmin
                    .from('seller_push_subscriptions')
                    .select('id, endpoint, p256dh, auth');

                if (!sellerErr && Array.isArray(sellerSubs)) {
                    for (const sub of sellerSubs) {
                        if (sub.endpoint && sub.p256dh && sub.auth && !subscriptionsMap.has(sub.endpoint)) {
                            subscriptionsMap.set(sub.endpoint, {
                                ...sub,
                                role: 'vendeur',
                                sourceTable: 'seller_push_subscriptions',
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn('[BroadcastPushAPI] Erreur lecture seller_push_subscriptions:', e.message);
            }
        }

        const activeSubscriptions = Array.from(subscriptionsMap.values());

        if (activeSubscriptions.length === 0) {
            return res.status(200).json({
                success: true,
                sentCount: 0,
                failureCount: 0,
                totalDevices: 0,
                message: 'Aucun appareil enregistré en veille pour cette audience.',
            });
        }

        // 5. Préparation du payload Web Push
        const payload = JSON.stringify({
            title: cleanTitle,
            body: cleanMessage,
            icon: '/assets/logo-192x192.png',
            badge: '/assets/logo-192x192.png',
            url: cleanUrl,
            tag: `broadcast-${Date.now()}`,
            timestamp: Date.now(),
        });

        let successCount = 0;
        let failureCount = 0;
        const staleEndpointsToDelete = []; // Array of { id, sourceTable }

        // 6. Envoi des notifications en parallèle
        const pushPromises = activeSubscriptions.map(async (sub) => {
            const pushConfig = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth,
                },
            };

            try {
                await webpush.sendNotification(pushConfig, payload, {
                    TTL: 60 * 60 * 24, // 24 heures
                    urgency: 'high',
                });
                successCount++;
            } catch (err) {
                failureCount++;
                console.warn('[BroadcastPushAPI] Échec envoi push:', sub.endpoint, err.statusCode);
                // Si l'endpoint a expiré (404 ou 410 GCM/Apple/Mozilla), nettoyer
                if (err.statusCode === 404 || err.statusCode === 410) {
                    staleEndpointsToDelete.push({ id: sub.id, sourceTable: sub.sourceTable });
                }
            }
        });

        await Promise.all(pushPromises);

        // 7. Nettoyage des endpoints expirés
        if (staleEndpointsToDelete.length > 0) {
            const globalIds = staleEndpointsToDelete.filter((s) => s.sourceTable === 'push_subscriptions').map((s) => s.id);
            const sellerIds = staleEndpointsToDelete.filter((s) => s.sourceTable === 'seller_push_subscriptions').map((s) => s.id);

            if (globalIds.length > 0) {
                await supabaseAdmin.from('push_subscriptions').delete().in('id', globalIds).catch(() => {});
            }
            if (sellerIds.length > 0) {
                await supabaseAdmin.from('seller_push_subscriptions').delete().in('id', sellerIds).catch(() => {});
            }
        }

        // 8. Enregistrement dans l'historique push_broadcasts
        try {
            await supabaseAdmin.from('push_broadcasts').insert({
                admin_id: callerId,
                title: cleanTitle,
                body: cleanMessage,
                url: cleanUrl,
                target_audience: audience,
                sent_count: successCount,
                failure_count: failureCount,
                cleaned_stale_count: staleEndpointsToDelete.length,
            });
        } catch (histErr) {
            console.warn('[BroadcastPushAPI] Impossible d\'enregistrer dans push_broadcasts (table non migrée):', histErr.message);
        }

        return res.status(200).json({
            success: true,
            totalDevices: activeSubscriptions.length,
            sentCount: successCount,
            failureCount: failureCount,
            cleanedStaleCount: staleEndpointsToDelete.length,
            audience,
        });
    } catch (err) {
        console.error('[BroadcastPushAPI] Exception globale:', err);
        return res.status(500).json({ error: err.message || 'Erreur serveur interne lors de la diffusion push.' });
    }
}
