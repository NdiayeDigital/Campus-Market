/**
 * Service de gestion du catalogue pour les marchands.
 * Gère la compression d'image côté client, l'upload vers Supabase Storage,
 * et les opérations CRUD sur la table `products`.
 */

import { supabase } from './supabase.js';
import { compressImage, dataURLtoBlob } from '../utils/image-compressor.js';
import { uploadMediaFile } from './storage-service.js';
import {
    computeSubscriptionStatus,
    getMaxProductsForPlan,
    SUBSCRIPTION_PLANS,
    FREE_TRIAL_CONFIG,
} from '../config/subscription.js';

const STORAGE_BUCKET = 'product-images';

/**
 * Compresse et téléverse une photo produit vers Cloudflare R2 (avec repli Supabase Storage).
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
        const publicUrl = await uploadMediaFile(item, {
            folder: sellerId || 'seller',
            filename: `prod_${index}`,
            maxWidth: 600,
            maxHeight: 600,
            quality: 0.72,
            context: 'product',
        });
        return publicUrl;
    } catch (err) {
        console.error(`[ProductManagement] Erreur traitement photo ${index}:`, err);
        throw err;
    }
}

/**
 * Crée un nouveau produit avec jusqu'à 3 photos compressées et uploadées.
 *
 * @param {Object} data
 * @param {string} data.sellerId - Identifiant UUID du vendeur
 * @param {string} data.title - Titre du produit
 * @param {number|string} data.price - Prix unitaire en FCFA
 * @param {number|string} [data.old_price] - Ancien prix barré en FCFA (pour promotion avec sale tag)
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
    old_price = null,
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

    let parsedOldPrice = null;
    if (old_price !== null && old_price !== undefined && String(old_price).trim() !== '') {
        const cleanOld = String(old_price).replace(/\s+/g, '').replace(/fcfa/gi, '').replace(/f$/i, '');
        const val = parseFloat(cleanOld);
        if (!isNaN(val) && val > 0) {
            parsedOldPrice = val;
        }
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

                    // VÉRIFICATION DE LA FORMULE ET DU QUOTA D'ARTICLES
                    if (profile.role !== 'superadmin') {
                        const subStatus = computeSubscriptionStatus(profile);

                        // CONTRÔLE DU NOMBRE DE PRODUITS SELON LE STATUT (Découverte 1 article, Pro 5, Business 10)
                        const plan = profile.subscription_plan || session.user.user_metadata?.subscription_plan || 'decouverte';
                        let maxAllowed = subStatus.maxProducts || 1;
                        if (subStatus.status === 'decouverte') {
                            maxAllowed = 1;
                        } else {
                            maxAllowed = Number(profile.max_products || session.user.user_metadata?.max_products) || getMaxProductsForPlan(plan);
                        }

                        let currentCount = 0;
                        try {
                            const { count, error: countErr } = await supabase
                                .from('products')
                                .select('id', { count: 'exact', head: true })
                                .eq('seller_id', activeSellerId)
                                .neq('stock', 0);

                            if (!countErr && typeof count === 'number') {
                                currentCount = count;
                            } else {
                                const prods = await getSellerProducts(activeSellerId);
                                currentCount = prods.filter((p) => p.stock !== 0 && p.is_active !== false).length;
                            }
                        } catch {
                            const prods = await getSellerProducts(activeSellerId);
                            currentCount = prods.filter((p) => p.stock !== 0 && p.is_active !== false).length;
                        }

                        if (currentCount >= maxAllowed) {
                            let upgradeMsg = "Veuillez supprimer ou désactiver des articles existants pour en publier de nouveaux.";
                            if (subStatus.status === 'decouverte') {
                                upgradeMsg = `Limite de catalogue atteinte (1 produit max en Pack Découverte). Passez au ${SUBSCRIPTION_PLANS.starter.name} (${SUBSCRIPTION_PLANS.starter.max_produits} produits • ${SUBSCRIPTION_PLANS.starter.priceDisplay}) ou ${SUBSCRIPTION_PLANS.pro.name} (${SUBSCRIPTION_PLANS.pro.max_produits} produits • ${SUBSCRIPTION_PLANS.pro.priceDisplay}) pour ajouter plus d'articles.`;
                            } else if (plan === 'starter' || plan === 'pro_legacy') {
                                upgradeMsg = `Passez au ${SUBSCRIPTION_PLANS.pro.name} (${SUBSCRIPTION_PLANS.pro.max_produits} produits • ${SUBSCRIPTION_PLANS.pro.priceDisplay}) pour élargir votre catalogue jusqu'à 10 produits.`;
                            }
                            throw new Error(
                                `Limite de votre formule atteinte (${currentCount}/${maxAllowed} produit${maxAllowed > 1 ? 's' : ''} actif${maxAllowed > 1 ? 's' : ''}). ` +
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

    if (parsedOldPrice !== null) {
        productPayload.old_price = parsedOldPrice;
    }

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
    old_price = null,
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

    if (old_price !== undefined) {
        if (old_price === null || String(old_price).trim() === '') {
            updates.old_price = null;
        } else {
            const cleanOld = String(old_price).replace(/\s+/g, '').replace(/fcfa/gi, '').replace(/f$/i, '');
            const val = parseFloat(cleanOld);
            updates.old_price = (!isNaN(val) && val > 0) ? val : null;
        }
    }

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
