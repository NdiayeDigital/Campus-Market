/**
 * Service de gestion du catalogue pour les marchands.
 * Gère la compression d'image côté client, l'upload vers Supabase Storage,
 * et les opérations CRUD sur la table `products`.
 */

import { supabase } from './supabase.js';
import { compressImage, dataURLtoBlob } from '../utils/image-compressor.js';

const STORAGE_BUCKET = 'product-images';

/**
 * Crée un nouveau produit avec photo compressée et uploadée.
 *
 * @param {Object} data
 * @param {string} data.sellerId - Identifiant UUID du vendeur
 * @param {string} data.title - Titre du produit
 * @param {number|string} data.price - Prix unitaire en FCFA
 * @param {string} data.category - Catégorie du produit
 * @param {number|string} [data.stock=-1] - Quantité en stock (-1 = illimité)
 * @param {File|Blob} [data.imageFile] - Fichier image sélectionné par l'étudiant
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
    icon = 'fa-box',
    color = '#1D4ED8',
}) {
    if (!sellerId) throw new Error('Identifiant vendeur requis.');
    if (!title || !price) throw new Error('Veuillez renseigner le titre et le prix.');

    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
        throw new Error('Le prix doit être un nombre positif supérieur à zéro.');
    }

    const parsedStock = stock === '' || stock === undefined ? -1 : parseInt(stock, 10);

    let imageUrl = null;

    // 1. Compression et Téléversement de l'image si fournie
    if (imageFile) {
        try {
            // Compression Canvas (max 800x800, qualité 0.75)
            const compressedDataUrl = await compressImage(imageFile, {
                maxWidth: 800,
                maxHeight: 800,
                quality: 0.75,
            });

            const blob = dataURLtoBlob(compressedDataUrl);
            const fileName = `${sellerId}/${Date.now()}_prod.jpg`;

            const { data: uploadData, error: uploadErr } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(fileName, blob, {
                    contentType: 'image/jpeg',
                    upsert: true,
                });

            if (uploadErr) {
                console.warn('[ProductManagement] Erreur upload image, fallback sans image:', uploadErr);
            } else if (uploadData) {
                const { data: publicUrlData } = supabase.storage
                    .from(STORAGE_BUCKET)
                    .getPublicUrl(fileName);

                imageUrl = publicUrlData?.publicUrl || null;
            }
        } catch (imgError) {
            console.warn('[ProductManagement] Échec de compression image:', imgError);
        }
    }

    // 2. Insertion dans la table `products`
    const productPayload = {
        seller_id: sellerId,
        title: title.trim(),
        price: parsedPrice,
        category,
        stock: parsedStock,
        image_url: imageUrl,
        icon,
        color,
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
            // Repli gracieux si la colonne description n'a pas encore été créée en base
            if (error.message && error.message.includes('description')) {
                delete productPayload.description;
                const { data: fbData, error: fbErr } = await supabase
                    .from('products')
                    .insert([productPayload])
                    .select()
                    .single();
                if (fbErr) throw fbErr;
                return fbData;
            }
            throw error;
        }

        return data;
    } catch (err) {
        throw new Error(`Erreur lors de la création du produit: ${err.message}`);
    }
}

/**
 * Modifie un produit existant (titre, prix, stock, catégorie, description, image).
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
}) {
    if (!productId) throw new Error('Identifiant produit requis pour la modification.');
    if (!title || !price) throw new Error('Veuillez renseigner le titre et le prix.');

    const parsedPrice = parseFloat(price);
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

    if (imageFile) {
        try {
            const compressedDataUrl = await compressImage(imageFile, {
                maxWidth: 800,
                maxHeight: 800,
                quality: 0.75,
            });

            const blob = dataURLtoBlob(compressedDataUrl);
            const fileName = `${sellerId || 'seller'}/${Date.now()}_prod.jpg`;

            const { data: uploadData, error: uploadErr } = await supabase.storage
                .from(STORAGE_BUCKET)
                .upload(fileName, blob, {
                    contentType: 'image/jpeg',
                    upsert: true,
                });

            if (!uploadErr && uploadData) {
                const { data: publicUrlData } = supabase.storage
                    .from(STORAGE_BUCKET)
                    .getPublicUrl(fileName);

                updates.image_url = publicUrlData?.publicUrl || null;
            }
        } catch (imgError) {
            console.warn('[ProductManagement] Erreur upload image modification:', imgError);
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
            if (error.message && error.message.includes('description')) {
                delete updates.description;
                const { data: fbData, error: fbErr } = await supabase
                    .from('products')
                    .update(updates)
                    .eq('id', productId)
                    .select()
                    .single();
                if (fbErr) throw fbErr;
                return fbData;
            }
            throw error;
        }

        return data;
    } catch (err) {
        throw new Error(`Erreur lors de la mise à jour du produit: ${err.message}`);
    }
}

/**
 * Récupère tous les produits appartenant à un vendeur.
 * @param {string} sellerId
 * @returns {Promise<Array>}
 */
export async function getSellerProducts(sellerId) {
    if (!sellerId) return [];

    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', sellerId)
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
