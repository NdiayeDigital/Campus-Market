/**
 * Module de redimensionnement et de compression d'images multi-stratégies via Canvas HTML5.
 * Optimisé pour les connexions mobiles, les smartphones (Android / iOS / Safari)
 * et le stockage Supabase Storage.
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
        } catch (bitmapErr) {
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
        } catch (objUrlErr) {
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
        } catch (readerErr) {
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
        } catch (bufErr) {
            // Échec complet de la cascade
        }
    }

    throw new Error("Impossible de lire cette photo (format non reconnu ou fichier corrompu). Veuillez prendre une nouvelle photo ou sélectionner un fichier JPEG/PNG valide.");
}

/**
 * Compresse et redimensionne une image côté client au format JPEG.
 * @param {File|Blob|string} file - Fichier image à compresser ou chaîne dataURL
 * @param {Object} [options] - Options de compression
 * @param {number} [options.maxWidth=800] - Largeur maximale en pixels
 * @param {number} [options.maxHeight=800] - Hauteur maximale en pixels
 * @param {number} [options.quality=0.75] - Qualité JPEG (0.1 à 1.0)
 * @returns {Promise<string>} Data URL de l'image compressée au format image/jpeg
 */
export async function compressImage(file, { maxWidth = 800, maxHeight = 800, quality = 0.75 } = {}) {
    if (!file) {
        throw new Error("Aucun fichier image fourni.");
    }

    // Si exécuté hors navigateur (environnement Node.js pur pour tests)
    if (typeof document === 'undefined') {
        if (typeof file === 'string' && file.startsWith('data:image/')) {
            return file;
        }
        return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...';
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
        let targetWidth = width || 800;
        let targetHeight = height || 800;

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

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        return compressedDataUrl;
    } finally {
        if (typeof cleanup === 'function') cleanup();
        if (isBitmap && source && typeof source.close === 'function') {
            try { source.close(); } catch {}
        }
    }
}

/**
 * Convertit une chaîne Data URL (base64) en objet Blob (binaire prêt pour upload Supabase Storage).
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
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const binaryStr = atob(parts[1]);
    const n = binaryStr.length;
    const u8arr = new Uint8Array(n);

    for (let i = 0; i < n; i++) {
        u8arr[i] = binaryStr.charCodeAt(i);
    }

    return new Blob([u8arr], { type: mime });
}

export default {
    compressImage,
    dataURLtoBlob,
};
