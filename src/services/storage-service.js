/**
 * Service de stockage unifié pour Campus Market.
 * Gère le téléversement d'images et bannières avec priorité Cloudflare R2 (Zéro frais d'egress)
 * et bascule transparente (fallback) sur Supabase Storage.
 */

import { supabase } from './supabase.js';
import { compressImageToBlob, dataURLtoBlob } from '../utils/image-compressor.js';

const STORAGE_BUCKET_PRODUCTS = 'product-images';
const STORAGE_BUCKET_ADMIN = 'products';

/**
 * Téléverse un fichier média (photo de produit, logo vendeur, slide carrousel, partenaire).
 * Tente d'abord le téléversement direct vers Cloudflare R2 via URL pré-signée.
 * En cas d'indisponibilité ou d'erreur, bascule automatiquement sur Supabase Storage avec cache 1 an.
 *
 * @param {File|Blob|string} fileOrBlob - Fichier ou dataURL source
 * @param {Object} options
 * @param {string} [options.folder='products'] - Dossier cible (ex: sellerId, 'carousel', 'partners')
 * @param {string} [options.filename='media'] - Nom de base du fichier
 * @param {number} [options.maxWidth=600] - Largeur maximale
 * @param {number} [options.maxHeight=600] - Hauteur maximale
 * @param {number} [options.quality=0.72] - Qualité d'encodage
 * @param {'product'|'avatar'|'carousel'|'partner'} [options.context='product']
 * @returns {Promise<string>} URL publique du fichier téléversé
 */
export async function uploadMediaFile(fileOrBlob, {
    folder = 'products',
    filename = 'media',
    maxWidth = 600,
    maxHeight = 600,
    quality = 0.72,
    context = 'product',
} = {}) {
    if (!fileOrBlob) {
        throw new Error("Aucun média fourni pour le téléversement.");
    }

    // 1. Compression optimisée côté client vers format WebP
    let blob = null;
    let mime = 'image/webp';
    let extension = 'webp';

    if (fileOrBlob instanceof Blob && fileOrBlob.type === 'image/webp') {
        blob = fileOrBlob;
    } else {
        try {
            const compressed = await compressImageToBlob(fileOrBlob, {
                maxWidth,
                maxHeight,
                quality,
                format: 'webp',
            });
            blob = compressed.blob;
            mime = compressed.mime;
            extension = compressed.extension;
        } catch (compErr) {
            console.warn('[StorageService] Échec compression WebP, repli binaire brut:', compErr);
            if (typeof fileOrBlob === 'string' && fileOrBlob.startsWith('data:image/')) {
                blob = dataURLtoBlob(fileOrBlob);
                mime = blob.type || 'image/jpeg';
            } else if (fileOrBlob instanceof Blob) {
                blob = fileOrBlob;
                mime = fileOrBlob.type || 'image/jpeg';
            } else {
                throw compErr;
            }
        }
    }

    // 2. Stratégie Prioritaire : Cloudflare R2 via URL pré-signée
    try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        if (token) {
            const presignRes = await fetch('/api/get-r2-upload-url', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    filename,
                    contentType: mime,
                    folder,
                }),
            });

            if (presignRes.ok) {
                const presignData = await presignRes.json();

                if (presignData.success && presignData.uploadUrl && presignData.publicUrl) {
                    const putRes = await fetch(presignData.uploadUrl, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': mime,
                            'Cache-Control': 'public, max-age=31536000, immutable',
                        },
                        body: blob,
                    });

                    if (putRes.ok) {
                        return presignData.publicUrl;
                    } else {
                        console.warn('[StorageService] Erreur PUT Cloudflare R2 (Statut ' + putRes.status + '), repli sur Supabase...');
                    }
                } else if (presignData.fallbackToSupabase) {
                    // Signal normal de fallback (ex: R2 non encore configuré en local)
                }
            }
        }
    } catch (r2Err) {
        console.warn('[StorageService] Échec tentative Cloudflare R2, bascule vers Supabase Storage:', r2Err);
    }

    // 3. Stratégie de Secours : Supabase Storage (avec cacheControl 1 an explicite)
    const targetBucket = (folder === 'carousel' || folder === 'partners')
        ? STORAGE_BUCKET_ADMIN
        : STORAGE_BUCKET_PRODUCTS;

    const s3FileName = `${folder}/${Date.now()}_${filename}.${extension}`;

    let { data: uploadData, error: uploadErr } = await supabase.storage
        .from(targetBucket)
        .upload(s3FileName, blob, {
            contentType: mime,
            cacheControl: '31536000', // 1 an (au lieu de 3600 par défaut)
            upsert: true,
        });

    if (uploadErr) {
        console.warn('[StorageService] Échec premier essai Supabase, rafraîchissement auth...', uploadErr);
        try {
            await supabase.auth.refreshSession();
            const retry = await supabase.storage
                .from(targetBucket)
                .upload(s3FileName, blob, {
                    contentType: mime,
                    cacheControl: '31536000',
                    upsert: true,
                });
            uploadData = retry.data;
            uploadErr = retry.error;
        } catch {}
    }

    if (uploadErr) {
        console.error('[StorageService] Échec complet du stockage:', uploadErr);
        throw new Error(`Échec du téléversement (${uploadErr.message || 'Erreur stockage'}). Veuillez réessayer.`);
    }

    const { data: publicUrlData } = supabase.storage
        .from(targetBucket)
        .getPublicUrl(s3FileName);

    return publicUrlData?.publicUrl || null;
}

export default {
    uploadMediaFile,
};
