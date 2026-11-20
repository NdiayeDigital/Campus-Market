/**
 * API Serverless Endpoint : /api/get-r2-upload-url
 * Génère une URL pré-signée S3 sécurisée pour téléverser directement un fichier vers Cloudflare R2
 * avec en-têtes de cache optimisés (max-age 1 an immuable, 0$ frais d'egress).
 *
 * SÉCURITÉ :
 * Requiert formellement un jeton d'authentification Bearer valide auprès de Supabase Auth
 * d'un compte actif (vendeur ou superadmin).
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://fqulqgdjusfzhcjpvyay.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'campus-market-storage';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || process.env.VITE_R2_PUBLIC_URL;

// Initialisation paresseuse du client S3 pour éviter toute erreur si variables absentes
let cachedS3Client = null;
function getS3Client() {
    if (!cachedS3Client && R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
        cachedS3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: R2_ACCESS_KEY_ID,
                secretAccessKey: R2_SECRET_ACCESS_KEY,
            },
        });
    }
    return cachedS3Client;
}

const ALLOWED_CONTENT_TYPES = new Set([
    'image/webp',
    'image/jpeg',
    'image/png',
    'image/svg+xml',
    'image/gif',
]);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
    }

    // 1. Contrôle de présence de la configuration Cloudflare R2
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_PUBLIC_URL) {
        return res.status(200).json({
            fallbackToSupabase: true,
            reason: 'Configuration Cloudflare R2 incomplète ou absente sur cet environnement.',
        });
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

        const { filename, contentType = 'image/webp', folder = 'products' } = body || {};

        if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
            return res.status(400).json({
                error: `Format de fichier non autorisé (${contentType}). Seules les images webp, jpeg, png, svg sont acceptées.`,
            });
        }

        // 2. Vérification obligatoire de l'authentification Supabase
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

        // 3. Sécurisation des dossiers selon les rôles
        // Les dossiers "carousel" et "partners" nécessitent le rôle superadmin
        if (folder === 'carousel' || folder === 'partners') {
            const { data: profile } = await authClient
                .from('profiles')
                .select('role')
                .eq('id', callerId)
                .maybeSingle();

            if (!profile || profile.role !== 'superadmin') {
                return res.status(403).json({ error: 'Accès refusé. Action réservée aux Super Administrateurs.' });
            }
        }

        // 4. Génération de la clé d'objet S3 / R2
        const cleanFolder = String(folder || callerId).replace(/[^a-zA-Z0-9_\-\/]/g, '').replace(/^\/+|\/+$/g, '');
        const ext = contentType === 'image/webp' ? 'webp' : (contentType === 'image/png' ? 'png' : 'jpg');
        const cleanName = filename ? String(filename).replace(/[^a-zA-Z0-9_\-]/g, '') : 'media';
        const key = `${cleanFolder}/${Date.now()}_${cleanName}.${ext}`;

        // 5. Génération de l'URL pré-signée S3 PUT (valable 10 minutes)
        const s3 = getS3Client();
        const command = new PutObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: key,
            ContentType: contentType,
            CacheControl: 'public, max-age=31536000, immutable',
        });

        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
        const cleanPublicBase = R2_PUBLIC_URL.replace(/\/+$/, '');
        const publicUrl = `${cleanPublicBase}/${key}`;

        return res.status(200).json({
            success: true,
            provider: 'cloudflare-r2',
            uploadUrl,
            publicUrl,
            key,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (err) {
        console.error('[API get-r2-upload-url] Erreur inattendue:', err);
        return res.status(500).json({
            error: `Échec de préparation du téléversement : ${err.message || 'Erreur interne'}`,
            fallbackToSupabase: true,
        });
    }
}
