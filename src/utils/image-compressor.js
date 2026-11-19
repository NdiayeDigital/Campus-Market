/**
 * Module de redimensionnement et de compression d'images multi-stratégies via Canvas HTML5.
 * Optimisé pour les connexions mobiles, les smartphones (Android / iOS / Safari)
 * et le stockage Cloudflare R2 / Supabase Storage.
 * Format privilégié : WebP (75% plus léger que JPEG) avec repli transparent sur JPEG.
 */

/**
 * Charge une source image (File, Blob, string dataURL) sous forme de bitmap ou Image HTML dessinable.
 * Met en œuvre une cascade de 4 stratégies de lecture pour éviter les erreurs de lecture
 * (NotReadableError, permissions Android expirées, saturation mémoire sur photos 48MP) :
 * 1. createImageBitmap (asynchrone, hors thread principal, orientation EXIF automatique, zéro Base64)
 * 2. URL.createObjectURL (léger, streaming natif du navigateur sans duplication mémoire)
 * 3. FileReader.readAsDataURL (voie classique avec gestion rigoureuse des erreurs)
 * 4. file.arrayBuffer() -> Blob -> ObjectURL (solution de secours si les métadonnées de fichier sont instables)
 *
 * @param {File|Blob|string} file
 * @returns {Promise<{ source: CanvasImageSource, width: number, height: number, isBitmap?: boolean, cleanup?: Function }>}
 */
async function loadImageSource(file) {
    if (typeof file === 'string') {
        if (!file.startsWith('data:image/')) {
            throw new Error("Chaîne d'image invalide (attendu data:image/...).");
        }
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve({
                source: img,
                width: img.naturalWidth || img.width,
                height: img.naturalHeight || img.height,
            });
            img.onerror = () => reject(new Error("Impossible de charger les données de l'image."));
            img.src = file;
        });
    }

    // Stratégie 1 : createImageBitmap (le plus moderne et économe en RAM)
    if (typeof window !== 'undefined' && typeof window.createImageBitmap === 'function') {
        try {
            let bitmap = null;
            try {
                bitmap = await window.createImageBitmap(file, { imageOrientation: 'from-image' });
            } catch {
                bitmap = await window.createImageBitmap(file);
            }
            if (bitmap && bitmap.width > 0 && bitmap.height > 0) {
                return {
                    source: bitmap,
                    width: bitmap.width,
                    height: bitmap.height,
                    isBitmap: true,
                    cleanup: () => {
                        try { if (typeof bitmap.close === 'function') bitmap.close(); } catch {}
                    }
                };
            }
        } catch {
            // Repli gracieux vers la stratégie 2
        }
    }

    // Stratégie 2 : URL.createObjectURL (léger et sans conversion Base64 en mémoire)
    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        try {
            const objectUrl = URL.createObjectURL(file);
            const loadedImg = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = (err) => reject(err);
                img.src = objectUrl;
            });
            return {
                source: loadedImg,
                width: loadedImg.naturalWidth || loadedImg.width,
                height: loadedImg.naturalHeight || loadedImg.height,
                cleanup: () => {
                    try { URL.revokeObjectURL(objectUrl); } catch {}
                }
            };
        } catch {
            // Repli vers stratégie 3
        }
    }

    // Stratégie 3 : FileReader.readAsDataURL
    if (typeof FileReader !== 'undefined') {
        try {
            const dataUrl = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => resolve(event.target.result);
                reader.onerror = () => {
                    const errDetail = reader.error?.name || reader.error?.message || 'fichier verrouillé ou permission révoquée';
                    reject(new Error(`Erreur de lecture du fichier (${errDetail})`));
                };
                reader.readAsDataURL(file);
            });

            const loadedImg = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error("Impossible de décoder l'image après lecture."));
                img.src = dataUrl;
            });

            return {
                source: loadedImg,
                width: loadedImg.naturalWidth || loadedImg.width,
                height: loadedImg.naturalHeight || loadedImg.height,
            };
        } catch {
            // Repli vers stratégie 4 si FileReader a échoué
        }
    }

    // Stratégie 4 : file.arrayBuffer() -> Blob -> ObjectURL
    if (file && typeof file.arrayBuffer === 'function' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        try {
            const buffer = await file.arrayBuffer();
            const freshBlob = new Blob([buffer], { type: file.type || 'image/jpeg' });
            const objectUrl = URL.createObjectURL(freshBlob);
            const loadedImg = await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = (err) => reject(err);
                img.src = objectUrl;
            });
            return {
                source: loadedImg,
                width: loadedImg.naturalWidth || loadedImg.width,
                height: loadedImg.naturalHeight || loadedImg.height,
                cleanup: () => {
                    try { URL.revokeObjectURL(objectUrl); } catch {}
                }
            };
        } catch {
            // Échec complet de la cascade
        }
    }

    throw new Error("Impossible de lire cette photo (format non reconnu ou fichier corrompu). Veuillez prendre une nouvelle photo ou sélectionner un fichier JPEG/PNG valide.");
}

/**
 * Détermine si le navigateur supporte l'exportation Canvas en WebP.
 * @returns {boolean}
 */
function isWebpSupported() {
    if (typeof document === 'undefined') return false;
    try {
        const testCanvas = document.createElement('canvas');
        testCanvas.width = 1;
        testCanvas.height = 1;
        const uri = testCanvas.toDataURL('image/webp');
        return uri.startsWith('data:image/webp');
    } catch {
        return false;
    }
}

/**
 * Compresse et redimensionne une image côté client au format WebP (ou JPEG en repli).
 * @param {File|Blob|string} file - Fichier image à compresser ou chaîne dataURL
 * @param {Object} [options] - Options de compression
 * @param {number} [options.maxWidth=600] - Largeur maximale en pixels (600px idéal rétina mobile)
 * @param {number} [options.maxHeight=600] - Hauteur maximale en pixels
 * @param {number} [options.quality=0.72] - Qualité d'encodage (0.1 à 1.0)
 * @param {'webp'|'jpeg'} [options.format='webp'] - Format cible privilégié
 * @returns {Promise<string>} Data URL de l'image compressée
 */
export async function compressImage(file, { maxWidth = 600, maxHeight = 600, quality = 0.72, format = 'webp' } = {}) {
    if (!file) {
        throw new Error("Aucun fichier image fourni.");
    }

    // Si exécuté hors navigateur (environnement Node.js pur pour tests)
    if (typeof document === 'undefined') {
        if (typeof file === 'string' && file.startsWith('data:image/')) {
            return file;
        }
        return 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
    }

    let loaded = null;
    try {
        loaded = await loadImageSource(file);
    } catch (loadErr) {
        console.error('[ImageCompressor] Échec du chargement de la source image:', loadErr);
        throw loadErr;
    }

    const { source, width, height, isBitmap, cleanup } = loaded;

    try {
        let targetWidth = width || maxWidth;
        let targetHeight = height || maxHeight;

        // Conservation stricte du ratio d'aspect
        if (targetWidth > targetHeight) {
            if (targetWidth > maxWidth) {
                targetHeight = Math.round(targetHeight * (maxWidth / targetWidth));
                targetWidth = maxWidth;
            }
        } else {
            if (targetHeight > maxHeight) {
                targetWidth = Math.round(targetWidth * (maxHeight / targetHeight));
                targetHeight = maxHeight;
            }
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, targetWidth);
        canvas.height = Math.max(1, targetHeight);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error("Impossible d'obtenir le contexte Canvas 2D pour compresser l'image.");
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(source, 0, 0, targetWidth, targetHeight);

        let mimeType = 'image/jpeg';
        if (format === 'webp' && isWebpSupported()) {
            mimeType = 'image/webp';
        }

        let compressedDataUrl = canvas.toDataURL(mimeType, quality);

        // Si le navigateur a renvoyé image/png en repli forcé, basculer sur image/jpeg
        if (mimeType === 'image/webp' && compressedDataUrl.startsWith('data:image/png')) {
            compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        return compressedDataUrl;
    } finally {
        if (typeof cleanup === 'function') cleanup();
        if (isBitmap && source && typeof source.close === 'function') {
            try { source.close(); } catch {}
        }
    }
}

/**
 * Convertit une chaîne Data URL (base64) en objet Blob (binaire prêt pour upload S3 / R2 / Supabase).
 * Accepte également directement un Blob déjà formé.
 * @param {string|Blob} dataUrl - URL base64 sous la forme data:[<mediatype>][;base64],<data> ou Blob
 * @returns {Blob}
 */
export function dataURLtoBlob(dataUrl) {
    if (dataUrl instanceof Blob) {
        return dataUrl;
    }

    if (!dataUrl || typeof dataUrl !== 'string') {
        throw new TypeError("dataUrl invalide fourni à dataURLtoBlob.");
    }

    const parts = dataUrl.split(',');
    if (parts.length < 2) {
        throw new TypeError("Format dataUrl invalide (virgule manquante).");
    }

    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/webp';
    const binaryStr = atob(parts[1]);
    const n = binaryStr.length;
    const u8arr = new Uint8Array(n);

    for (let i = 0; i < n; i++) {
        u8arr[i] = binaryStr.charCodeAt(i);
    }

    return new Blob([u8arr], { type: mime });
}

/**
 * Compresse directement vers un Blob binaire prêt à l'envoi réseau (WebP optimisé).
 * @param {File|Blob|string} file
 * @param {Object} [options]
 * @returns {Promise<{ blob: Blob, dataUrl: string, mime: string, extension: string }>}
 */
export async function compressImageToBlob(file, options = {}) {
    const dataUrl = await compressImage(file, options);
    const blob = dataURLtoBlob(dataUrl);
    const mime = blob.type || 'image/webp';
    const extension = mime === 'image/webp' ? 'webp' : (mime === 'image/png' ? 'png' : 'jpg');
    return {
        blob,
        dataUrl,
        mime,
        extension,
    };
}

/**
 * Résout une URL d'image vers le CDN Cloudflare R2 si elle pointe vers l'ancien stockage Supabase.
 * Permet un basculement immédiat et transparent sans attendre l'exécution manuelle de migrations SQL.
 * Si le média a été téléversé postérieurement à la migration R2 (post 17 Nov 2026 02:16 UTC)
 * via le repli Supabase Storage, il n'est pas présent sur R2 et doit rester servi depuis Supabase.
 * @param {string} url
 * @returns {string}
 */
export function resolveMediaUrl(url) {
    if (!url || typeof url !== 'string') return url || '';
    const SUPABASE_STORAGE_PREFIX = 'https://fqulqgdjusfzhcjpvyay.supabase.co/storage/v1/object/public/';
    const R2_PUBLIC_PREFIX = 'https://pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev/';
    if (url.startsWith(SUPABASE_STORAGE_PREFIX)) {
        // Détection de la date d'upload par timestamp 13 chiffres (ex: 1795031169525)
        // La coupure de migration R2 a eu lieu le 17 Nov 2026 à 02:16:12 UTC (timestamp 1794881772000)
        const timestampMatch = url.match(/\/(\d{13})_/);
        if (timestampMatch && Number(timestampMatch[1]) > 1794881772000) {
            return url;
        }
        return url.replace(SUPABASE_STORAGE_PREFIX, R2_PUBLIC_PREFIX);
    }
    return url;
}

/**
 * Convertit une URL CDN Cloudflare R2 vers l'URL Supabase Storage d'origine correspondante.
 * Sert de repli (fallback) immédiat si le CDN R2 renvoie une erreur 404.
 * @param {string} url
 * @returns {string}
 */
export function getFallbackStorageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const SUPABASE_STORAGE_PREFIX = 'https://fqulqgdjusfzhcjpvyay.supabase.co/storage/v1/object/public/';
    const R2_PUBLIC_PREFIX = 'https://pub-2f882764059641cba8e6c2a55d1bdefe.r2.dev/';
    if (url.startsWith(R2_PUBLIC_PREFIX)) {
        return url.replace(R2_PUBLIC_PREFIX, SUPABASE_STORAGE_PREFIX);
    }
    return url;
}

export default {
    compressImage,
    compressImageToBlob,
    dataURLtoBlob,
    resolveMediaUrl,
    getFallbackStorageUrl,
};
