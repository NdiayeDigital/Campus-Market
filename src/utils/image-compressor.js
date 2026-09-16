/**
 * Module de redimensionnement et de compression d'images via Canvas HTML5.
 * Optimisé pour les connexions mobiles et le stockage Supabase Storage.
 */

/**
 * Compresse et redimensionne une image côté client au format JPEG.
 * @param {File|Blob} file - Fichier image à compresser
 * @param {Object} [options] - Options de compression
 * @param {number} [options.maxWidth=600] - Largeur maximale en pixels
 * @param {number} [options.maxHeight=600] - Hauteur maximale en pixels
 * @param {number} [options.quality=0.7] - Qualité JPEG (0.1 à 1.0)
 * @returns {Promise<string>} Data URL de l'image compressée au format image/jpeg
 */
export function compressImage(file, { maxWidth = 600, maxHeight = 600, quality = 0.7 } = {}) {
    return new Promise((resolve, reject) => {
        if (!file) {
            return reject(new Error("Aucun fichier image fourni."));
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);

        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;

            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Conservation du ratio d'aspect
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error("Impossible d'obtenir le contexte Canvas 2D."));
                }

                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedDataUrl);
            };

            img.onerror = (error) => reject(new Error("Erreur lors du chargement de l'image: " + error));
        };

        reader.onerror = (error) => reject(new Error("Erreur de lecture du fichier: " + error));
    });
}

/**
 * Convertit une chaîne Data URL (base64) en objet Blob (binaire prêt pour upload Supabase Storage).
 * @param {string} dataUrl - URL base64 sous la forme data:[<mediatype>][;base64],<data>
 * @returns {Blob}
 */
export function dataURLtoBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string') {
        throw new TypeError("dataUrl invalide fourni à dataURLtoBlob.");
    }

    const parts = dataUrl.split(',');
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
    dataURLtoBlob
};
