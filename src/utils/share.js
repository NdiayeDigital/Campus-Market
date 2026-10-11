/**
 * Utilitaire de partage universel pour Campus Market.
 * Supporte la Web Share API native (mobile), le repli automatique sur le presse-papier,
 * et la génération d'URLs de partage direct (WhatsApp, etc.).
 */

import { showToast } from './notifications.js';

/**
 * Partage un lien ou du contenu textuel.
 * Si navigator.share est supporté (typiquement sur mobile ou navigateurs compatibles), ouvre la feuille de partage native.
 * Sinon, copie l'URL dans le presse-papier et affiche une notification toast.
 *
 * @param {Object} options
 * @param {string} options.title - Titre du partage
 * @param {string} [options.text] - Texte descriptif
 * @param {string} options.url - URL complète à partager
 * @param {Function} [options.onShowToast] - Callback toast optionnel
 * @returns {Promise<{ shared: boolean, method: 'native' | 'clipboard' }>}
 */
export async function shareLink({ title, text = '', url, onShowToast = showToast } = {}) {
    const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');
    const shareTitle = title || 'Campus Market';
    const shareText = text || '';

    // 1. Tente l'API native navigator.share (Mobile Chrome, Safari, etc.)
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
            await navigator.share({
                title: shareTitle,
                text: shareText,
                url: shareUrl,
            });
            return { shared: true, method: 'native' };
        } catch (err) {
            // Si l'utilisateur a simplement annulé ou fermé la feuille de partage, on ne fait rien
            if (err.name === 'AbortError') {
                return { shared: false, method: 'native' };
            }
            console.warn('[Share] navigator.share a échoué, repli sur le presse-papier:', err);
        }
    }

    // 2. Repli : Copie dans le presse-papier (Desktop ou navigateur sans Web Share API)
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(shareUrl);
        } else if (typeof document !== 'undefined') {
            // Repli legacy document.execCommand pour compatibilité maximale
            const textArea = document.createElement('textarea');
            textArea.value = shareUrl;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        }

        if (typeof onShowToast === 'function') {
            onShowToast('🔗 Lien copié dans le presse-papier !', 'success');
        }
        return { shared: true, method: 'clipboard' };
    } catch (err) {
        console.error('[Share] Impossible de copier le lien:', err);
        if (typeof onShowToast === 'function') {
            onShowToast('Impossible de copier le lien.', 'error');
        }
        return { shared: false, method: 'clipboard' };
    }
}

/**
 * Génère un lien de partage direct WhatsApp avec message pré-rempli.
 * @param {Object} options
 * @param {string} [options.text] - Message à partager
 * @param {string} options.url - Lien de la boutique ou du produit
 * @returns {string} URL WhatsApp
 */
export function getWhatsAppShareUrl({ text = '', url = '' } = {}) {
    const fullText = text ? `${text} ${url}`.trim() : url;
    return `https://wa.me/?text=${encodeURIComponent(fullText)}`;
}

/**
 * Partage la boutique d'un marchand.
 * @param {Object} seller - Profil du vendeur
 * @param {Function} [onShowToast] - Callback de notification
 */
export async function shareSellerShop(seller, onShowToast = showToast) {
    if (!seller || !seller.id) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shopUrl = `${origin}/#shop/${seller.id}`;
    const sellerName = seller.prenom ? `${seller.prenom} ${seller.nom || ''}`.trim() : 'notre boutique';

    return shareLink({
        title: `Boutique de ${sellerName} - Campus Market`,
        text: `Découvrez la boutique de ${sellerName} sur Campus Market UIDT ! Articles, plats et services disponibles :`,
        url: shopUrl,
        onShowToast,
    });
}

/**
 * Partage un produit ou un plat spécifique.
 * @param {Object} product - Détails du produit
 * @param {Function} [onShowToast] - Callback de notification
 */
export async function shareProduct(product, onShowToast = showToast) {
    if (!product || !product.id) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const productUrl = `${origin}/#product/${product.id}`;
    const priceText = product.price ? ` (${Number(product.price).toLocaleString('fr-FR')} FCFA)` : '';

    return shareLink({
        title: `${product.title} - Campus Market`,
        text: `Regardez "${product.title}"${priceText} sur Campus Market UIDT :`,
        url: productUrl,
        onShowToast,
    });
}

export default {
    shareLink,
    getWhatsAppShareUrl,
    shareSellerShop,
    shareProduct,
};
