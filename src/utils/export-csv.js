/**
 * Module d'exportation de données en format CSV (Campus Market UIDT)
 * Génère des fichiers CSV côté client avec BOM UTF-8 pour un affichage
 * sans corruption d'accents sur Microsoft Excel, LibreOffice et Google Sheets.
 */

/**
 * Déclenche le téléchargement d'un fichier CSV dans le navigateur.
 * @param {string} filename - Nom du fichier de sortie (ex: 'commandes-vendeur-2026.csv')
 * @param {Array<Array<string|number>>} rows - Matrice de données
 * @param {Array<string>} headers - En-têtes de colonnes
 */
export function downloadCSV(filename, rows, headers) {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const sanitizeCell = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
    };

    const headerLine = headers.map(sanitizeCell).join(';');
    const bodyLines = rows.map((row) => row.map(sanitizeCell).join(';'));
    const csvContent = [headerLine, ...bodyLines].join('\r\n');

    // Ajout du BOM UTF-8 (\uFEFF) pour compatibilité totale avec Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Exporte une liste de commandes en CSV.
 * @param {Array<Object>} orders - Liste des commandes
 * @param {string} [filename='commandes-campus-market.csv']
 */
export function exportOrdersToCSV(orders = [], filename = 'commandes-campus-market.csv') {
    const headers = [
        'Référence',
        'Date & Heure',
        'Acheteur',
        'Téléphone',
        'Lieu de Livraison',
        'Article',
        'Quantité',
        'Montant (FCFA)',
        'Mode de Règlement',
        'Statut',
    ];

    const rows = orders.map((o) => {
        const dateStr = o.created_at ? new Date(o.created_at).toLocaleString('fr-FR') : '';
        const orderRef = o.reference || `#CMD-${o.id ? o.id.slice(0, 6).toUpperCase() : ''}`;
        const productTitle = o.product?.title || o.product_title || 'Article';
        const paymentLabel = o.payment_method === 'wave' ? 'Wave' : (o.payment_method === 'om' ? 'Orange Money' : 'Espèces (Cash)');
        
        let statusLabel = o.status;
        switch (o.status) {
            case 'pending': statusLabel = 'En attente'; break;
            case 'confirmed': statusLabel = 'Confirmée'; break;
            case 'processing': statusLabel = 'En préparation'; break;
            case 'shipped': statusLabel = 'En livraison'; break;
            case 'delivered': statusLabel = 'Livrée'; break;
            case 'cancelled': statusLabel = 'Annulée'; break;
        }

        return [
            orderRef,
            dateStr,
            o.buyer_name || 'Étudiant',
            o.buyer_phone || '',
            o.delivery_address || '',
            productTitle,
            o.quantity || 1,
            Number(o.price) || 0,
            paymentLabel,
            statusLabel,
        ];
    });

    downloadCSV(filename, rows, headers);
}

/**
 * Exporte la liste des marchands en CSV (pour administration et COUD).
 * @param {Array<Object>} sellers - Liste des marchands
 * @param {string} [filename='marchands-uidt.csv']
 */
export function exportSellersToCSV(sellers = [], filename = 'marchands-uidt.csv') {
    const headers = [
        'ID Vendeur',
        'Prénom & Nom',
        'Téléphone',
        'Rôle',
        'Formule',
        'Statut Abonnement',
        'Fin Essai / Expiration',
        'Statut Boutique',
        'Date Création',
    ];

    const rows = sellers.map((s) => [
        s.id || '',
        `${s.prenom || ''} ${s.nom || ''}`.trim(),
        s.telephone || '',
        s.role || '',
        s.subscription_plan || 'starter',
        s.subscription_status || 'trial',
        s.subscription_expires_at || s.trial_ends_at || '',
        s.is_open === false ? 'En pause' : 'Ouvert',
        s.created_at ? new Date(s.created_at).toLocaleDateString('fr-FR') : '',
    ]);

    downloadCSV(filename, rows, headers);
}

/**
 * Exporte la liste des comptes utilisateurs en CSV.
 * @param {Array<Object>} profiles - Liste des profils
 * @param {string} [filename='utilisateurs-campus.csv']
 */
export function exportAccountsToCSV(profiles = [], filename = 'utilisateurs-campus.csv') {
    const headers = [
        'ID Utilisateur',
        'Prénom & Nom',
        'Téléphone',
        'Rôle Actuel',
        'Date Inscription',
    ];

    const rows = profiles.map((p) => [
        p.id || '',
        `${p.prenom || ''} ${p.nom || ''}`.trim(),
        p.telephone || '',
        p.role || '',
        p.created_at ? new Date(p.created_at).toLocaleDateString('fr-FR') : '',
    ]);

    downloadCSV(filename, rows, headers);
}

export default {
    downloadCSV,
    exportOrdersToCSV,
    exportSellersToCSV,
    exportAccountsToCSV,
};
