/**
 * Service de gestion du catalogue pour les marchands.
 * Gère la compression d'image côté client, l'upload vers Supabase Storage,
 * et les opérations CRUD sur la table `products`.
 */

import { supabase } from './supabase.js';
import { compressImage, dataURLtoBlob } from '../utils/image-compressor.js';
import {
    computeSubscriptionStatus,
    getMaxProductsForPlan,
    SUBSCRIPTION_PLANS,
    FREE_TRIAL_CONFIG,
} from '../config/subscription.js';

const STORAGE_BUCKET = 'product-images';

/**
 * Compresse et téléverse une photo produit vers Supabase Storage.
 * Si l'élément est déjà une URL distante existante, il est conservé tel quel.
 * @param {File|Blob|string} item
 * @param {string} sellerId
 * @param {number} index
 * @returns {Promise<string|null>} URL publique
 */
async function processAndUploadProductPhoto(item, sellerId, index = 0) {
    if (!item) return null;
    if (typeof item === 'string' && (item.startsWith('http://') || item.startsWith('https://'))) {
        return item;
    }

    try {
        let blob = null;
        if (item instanceof Blob && (item._isCompressed || item.type === 'image/jpeg')) {
            blob = item;
        } else if (item?.compressedBlob instanceof Blob) {
            blob = item.compressedBlob;
        } else if (typeof item === 'string' && item.startsWith('data:image/')) {
            blob = dataURLtoBlob(item);
        } else {
            const compressedDataUrl = await compressImage(item, {
                maxWidth: 800,
                maxHeight: 800,
                quality: 0.75,
            });
            blob = dataURLtoBlob(compressedDataUrl);
        }

        const fileName = `${sellerId || 'seller'}/${Date.now()}_prod_${index}.jpg`;

        let { data: uploadData, error: uploadErr } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(fileName, blob, {
                contentType: 'image/jpeg',
                upsert: true,
            });

        if (uploadErr) {
            console.warn(`[ProductManagement] Erreur upload photo ${index}, tentative rafraîchissement...`, uploadErr);
            try {
                await supabase.auth.refreshSession();
                const retry = await supabase.storage
                    .from(STORAGE_BUCKET)
                    .upload(fileName, blob, {
                        contentType: 'image/jpeg',
                        upsert: true,
                    });
                uploadData = retry.data;
                uploadErr = retry.error;
            } catch {}
        }

        if (uploadErr) {
            console.error(`[ProductManagement] Échec upload photo ${index}:`, uploadErr);
            throw new Error(`Échec du téléversement de la photo ${index + 1} (${uploadErr.message || 'Erreur stockage'}).`);
        }

        if (uploadData) {
            const { data: publicUrlData } = supabase.storage
                .from(STORAGE_BUCKET)
                .getPublicUrl(fileName);
            return publicUrlData?.publicUrl || null;
        }
    } catch (err) {
        console.error(`[ProductManagement] Erreur traitement photo ${index}:`, err);
        throw err;
    }
    return null;
}

/**
 * Crée un nouveau produit avec jusqu'à 3 photos compressées et uploadées.
 *
 * @param {Object} data
 * @param {string} data.sellerId - Identifiant UUID du vendeur
 * @param {string} data.title - Titre du produit
 * @param {number|string} data.price - Prix unitaire en FCFA
 * @param {string} data.category - Catégorie du produit
 * @param {number|string} [data.stock=-1] - Quantité en stock (-1 = illimité)
 * @param {File|Blob|string} [data.imageFile] - Photo unique historique (rétrocompatibilité)
 * @param {Array<File|Blob|string>} [data.imageFiles] - Tableau de photos (jusqu'à 3)
 * @param {string} [data.icon='fa-box'] - Icône de secours
 * @param {string} [data.color='#1D4ED8'] - Couleur de fond de secours
 * @returns {Promise<Object>} Produit créé
 */
export async function createProduct({
    sellerId,
    title,
    price,
    category = 'autres',
    stock = -1,
    imageFile = null,
    imageFiles = null,
    icon = 'fa-box',
    color = '#1D4ED8',
    description = '',
}) {
    if (!title || !price) throw new Error('Veuillez renseigner le titre et le prix.');

    // Assainissement robuste du prix (supporte les espaces "1 500" et mentions "FCFA")
    const cleanPriceStr = String(price).replace(/\s+/g, '').replace(/fcfa/gi, '').replace(/f$/i, '');
    const parsedPrice = parseFloat(cleanPriceStr);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
        throw new Error('Le prix doit être un nombre positif supérieur à zéro.');
    }

    const parsedStock = stock === '' || stock === undefined ? -1 : parseInt(stock, 10);

    // 1. Résolution et synchronisation stricte de la session d'authentification Supabase
    let activeSellerId = sellerId;
    try {
        let { data: sessionData } = await supabase.auth.getSession();
        let session = sessionData?.session;

        if (!session?.user) {
            try {
                const { data: refreshData } = await supabase.auth.refreshSession();
                if (refreshData?.session) session = refreshData.session;
            } catch {}
        }

        if (session?.user) {
            // L'ID du créateur doit TOUJOURS correspondre à l'UID authentifié Supabase
            // pour satisfaire la condition RLS : auth.uid() = seller_id
            activeSellerId = session.user.id;

            // Contrôle préventif du rôle, du statut et du quota d'articles
            try {
                let profile = null;
                try {
                    const { data } = await supabase
                        .from('profiles')
                        .select('role, is_open, subscription_plan, max_products, subscription_status, subscription_expires_at, trial_ends_at, created_at')
                        .eq('id', session.user.id)
                        .maybeSingle();
                    profile = data;
                } catch {
                    const { data } = await supabase
                        .from('profiles')
                        .select('role, is_open')
                        .eq('id', session.user.id)
                        .maybeSingle();
                    profile = data;
                }

                if (profile) {
                    if (profile.role === 'vendeur_pending') {
                        throw new Error("Votre candidature vendeur est en cours de validation par l'administration UIDT. Vous pourrez publier vos produits dès son approbation.");
                    }
                    if (profile.role === 'vendeur_desactive' || profile.role === 'suspendu') {
                        throw new Error("Votre compte marchand a été suspendu par l'administration UIDT. Veuillez contacter le support.");
                    }
                    if (profile.role !== 'vendeur' && profile.role !== 'superadmin') {
                        throw new Error("Seuls les comptes marchands validés et administrateurs peuvent publier des articles.");
                    }

                    // VÉRIFICATION DE LA PÉRIODE D'ESSAI OU DE L'ABONNEMENT
                    if (profile.role !== 'superadmin') {
                        const subStatus = computeSubscriptionStatus(profile);
                        if (subStatus.isExpired) {
                            throw new Error("Votre période d'essai de 7 jours est terminée. Veuillez activer votre abonnement pour publier de nouveaux articles.");
                        }

                        // CONTRÔLE DU NOMBRE DE PRODUITS SELON LE STATUT (Essai 3 articles, ou Pack 5, 10, 50)
                        const plan = profile.subscription_plan || session.user.user_metadata?.subscription_plan || 'starter';
                        const maxAllowed = subStatus.isTrial
                            ? FREE_TRIAL_CONFIG.maxProducts
                            : (Number(profile.max_products || session.user.user_metadata?.max_products) || getMaxProductsForPlan(plan));

                        let currentCount = 0;
                        try {
                            const { count, error: countErr } = await supabase
                                .from('products')
                                .select('id', { count: 'exact', head: true })
                                .eq('seller_id', activeSellerId);

                            if (!countErr && typeof count === 'number') {
                                currentCount = count;
                            } else {
                                const prods = await getSellerProducts(activeSellerId);
                                currentCount = prods.length;
                            }
                        } catch {
                            const prods = await getSellerProducts(activeSellerId);
                            currentCount = prods.length;
                        }

                        if (currentCount >= maxAllowed) {
                            const planObj = SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.starter;
                            let upgradeMsg = "Veuillez supprimer des articles existants pour en publier de nouveaux.";
                            if (subStatus.isTrial) {
                                upgradeMsg = "L'essai gratuit permet de publier jusqu'à 3 articles. Activez une formule Starter (5 arts), Pro (10 arts) ou Annuelle VIP (50 arts) pour débloquer votre catalogue.";
                            } else if (plan === 'starter') {
                                upgradeMsg = "Passez au Pack Pro (10 articles à 2 500 F) ou Annuel VIP (50 articles à 25 000 F/an) pour continuer.";
                            } else if (plan === 'pro') {
                                upgradeMsg = "Passez au Pack Annuel VIP (50 articles à 25 000 FCFA/an) pour maximiser votre catalogue toute l'année.";
                            }
                            throw new Error(
                                `Limite de votre formule atteinte (${currentCount}/${maxAllowed} produits). ` +
                                (subStatus.isTrial 
                                    ? `L'essai gratuit est plafonné à 3 articles. ` 
                                    : `Votre formule actuelle (${planObj.name} - ${maxAllowed} articles) a atteint son plafond. `) +
                                upgradeMsg
                            );
                        }
                    }
                }
            } catch (roleErr) {
                if (roleErr.message && (
                    roleErr.message.includes('en cours de validation') || 
                    roleErr.message.includes('suspendu') || 
                    roleErr.message.includes('Seuls les comptes') ||
                    roleErr.message.includes('Limite de votre formule atteinte')
                )) {
                    throw roleErr;
                }
            }
        }
    } catch (authCheckErr) {
        if (authCheckErr.message && (
            authCheckErr.message.includes('en cours de validation') || 
            authCheckErr.message.includes('suspendu') || 
            authCheckErr.message.includes('Seuls les comptes') ||
            authCheckErr.message.includes('Limite de votre formule atteinte')
        )) {
            throw authCheckErr;
        }
        console.warn('[ProductManagement] Avertissement session vendeur:', authCheckErr);
    }

    if (!activeSellerId) throw new Error('Identifiant vendeur requis.');

    // 2. Traitement et téléversement des photos (jusqu'à 3)
    let photosToProcess = [];
    if (Array.isArray(imageFiles) && imageFiles.length > 0) {
        photosToProcess = imageFiles.slice(0, 3);
    } else if (imageFile) {
        photosToProcess = [imageFile];
    }

    const uploadedUrls = [];
    for (let i = 0; i < photosToProcess.length; i++) {
        const photoItem = photosToProcess[i];
        if (photoItem) {
            const url = await processAndUploadProductPhoto(photoItem, activeSellerId, i);
            if (url) uploadedUrls.push(url);
        }
    }

    const primaryImageUrl = uploadedUrls[0] || null;

    // 3. Insertion dans la table `products`
    const productPayload = {
        seller_id: activeSellerId,
        title: title.trim(),
        price: parsedPrice,
        category,
        stock: parsedStock,
        image_url: primaryImageUrl,
        images: uploadedUrls,
        icon,
    };

    if (description) {
        productPayload.description = description.trim();
    }

    try {
        const { data, error } = await supabase
            .from('products')
            .insert([productPayload])
            .select()
            .single();

        if (error) {
            // Repli gracieux si la colonne images ou description n'a pas encore été créée en base
            if (error.message && (error.message.includes('images') || error.message.includes('description'))) {
                console.warn('[ProductManagement] Colonnes optionnelles absentes en base, repli gracieux:', error.message);
                const fallbackPayload = { ...productPayload };
                if (error.message.includes('images')) delete fallbackPayload.images;
                if (error.message.includes('description')) delete fallbackPayload.description;

                const { data: fbData, error: fbErr } = await supabase
                    .from('products')
                    .insert([fallbackPayload])
                    .select()
                    .single();
                if (fbErr) throw fbErr;
                return {
                    ...fbData,
                    images: uploadedUrls,
                };
            }
            throw error;
        }

        return data;
    } catch (err) {
        if (err.message && err.message.includes('row-level security policy')) {
            throw new Error("Publication non autorisée : votre compte n'a pas les droits nécessaires ou votre session a expiré. Veuillez vous reconnecter avec un compte vendeur validé ou administrateur.");
        }
        throw new Error(`Erreur lors de la création du produit: ${err.message}`);
    }
}

/**
 * Modifie un produit existant (titre, prix, stock, catégorie, description, images).
 * @param {Object} data
 * @returns {Promise<Object>}
 */
export async function updateProduct({
    productId,
    sellerId,
    title,
    price,
    category,
    stock,
    description = '',
    imageFile = null,
    imageFiles = null,
}) {
    if (!productId) throw new Error('Identifiant produit requis pour la modification.');
    if (!title || !price) throw new Error('Veuillez renseigner le titre et le prix.');

    const cleanPriceStr = String(price).replace(/\s+/g, '').replace(/fcfa/gi, '').replace(/f$/i, '');
    const parsedPrice = parseFloat(cleanPriceStr);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
        throw new Error('Le prix doit être un nombre positif supérieur à zéro.');
    }

    const parsedStock = stock === '' || stock === undefined ? -1 : parseInt(stock, 10);
    const updates = {
        title: title.trim(),
        price: parsedPrice,
        category: category || 'autres',
        stock: parsedStock,
    };

    // Gestion multi-photos lors de la modification (jusqu'à 3)
    if (Array.isArray(imageFiles)) {
        const uploadedUrls = [];
        const photosToProcess = imageFiles.slice(0, 3);
        for (let i = 0; i < photosToProcess.length; i++) {
            const item = photosToProcess[i];
            if (item) {
                const url = await processAndUploadProductPhoto(item, sellerId, i);
                if (url) uploadedUrls.push(url);
            }
        }
        updates.images = uploadedUrls;
        updates.image_url = uploadedUrls[0] || null;
    } else if (imageFile) {
        const singleUrl = await processAndUploadProductPhoto(imageFile, sellerId, 0);
        if (singleUrl) {
            updates.image_url = singleUrl;
            updates.images = [singleUrl];
        }
    }

    if (description !== undefined) {
        updates.description = String(description).trim();
    }

    try {
        const { data, error } = await supabase
            .from('products')
            .update(updates)
            .eq('id', productId)
            .select()
            .single();

        if (error) {
            if (error.message && (error.message.includes('images') || error.message.includes('description'))) {
                console.warn('[ProductManagement] Colonnes optionnelles absentes lors de la mise à jour, repli:', error.message);
                const fallbackUpdates = { ...updates };
                if (error.message.includes('images')) delete fallbackUpdates.images;
                if (error.message.includes('description')) delete fallbackUpdates.description;

                const { data: fbData, error: fbErr } = await supabase
                    .from('products')
                    .update(fallbackUpdates)
                    .eq('id', productId)
                    .select()
                    .single();
                if (fbErr) throw fbErr;
                return {
                    ...fbData,
                    images: updates.images || fbData?.images || [],
                };
            }
            throw error;
        }

        return data;
    } catch (err) {
        if (err.message && err.message.includes('row-level security policy')) {
            throw new Error("Modification non autorisée : vous ne pouvez modifier que les produits de votre propre boutique.");
        }
        throw new Error(`Erreur lors de la mise à jour du produit: ${err.message}`);
    }
}

/**
 * Récupère tous les produits appartenant à un vendeur.
 * @param {string} sellerId
 * @returns {Promise<Array>}
 */
export async function getSellerProducts(sellerId) {
    let targetId = sellerId;
    if (!targetId) {
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            targetId = sessionData?.session?.user?.id;
        } catch {}
    }
    if (!targetId) return [];

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', targetId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('[ProductManagement] Erreur getSellerProducts:', error);
        throw error;
    }

    return data || [];
}

/**
 * Met à jour le stock d'un produit (0 = rupture, > 0 = en stock).
 * @param {string} productId
 * @param {number} newStock
 * @returns {Promise<Object>}
 */
export async function updateProductStock(productId, newStock) {
    const { data, error } = await supabase
        .from('products')
        .update({ stock: parseInt(newStock, 10) })
        .eq('id', productId)
        .select()
        .single();

    if (error) {
        if (error.message && error.message.includes('row-level security policy')) {
            throw new Error("Mise à jour du stock non autorisée : vous ne pouvez modifier que les produits de votre propre boutique.");
        }
        throw new Error(`Impossible de mettre à jour le stock: ${error.message}`);
    }
    return data;
}

/**
 * Bascule rapidement l'état d'un produit entre 'En stock' et 'Rupture de stock'.
 * @param {string} productId
 * @param {number} currentStock
 * @returns {Promise<Object>}
 */
export async function toggleProductStock(productId, currentStock) {
    const nextStock = currentStock === 0 ? 10 : 0;
    return updateProductStock(productId, nextStock);
}

/**
 * Supprime un produit du catalogue.
 * @param {string} productId
 * @returns {Promise<boolean>}
 */
export async function deleteProduct(productId) {
    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

    if (error) {
        if (error.message && error.message.includes('row-level security policy')) {
            throw new Error("Suppression non autorisée : vous ne pouvez supprimer que les produits de votre propre boutique.");
        }
        throw new Error(`Impossible de supprimer le produit: ${error.message}`);
    }
    return true;
}

export default {
    createProduct,
    updateProduct,
    getSellerProducts,
    updateProductStock,
    toggleProductStock,
    deleteProduct,
};
