/**
 * Configuration centralisée des formules d'abonnement et de la passerelle SasPay.
 * Campus Market - Université Iba Der Thiam de Thiès (UIDT).
 */

export const FREE_TRIAL_CONFIG = {
    durationDays: 7,
    maxProducts: 3,
    planId: 'starter',
    label: '7 Jours Gratuits (3 articles)',
};

export const SASPAY_PAYMENT_LINKS = {
    starter: 'https://link.saspay.me/hgc4jifsarq',
    pro: 'https://link.saspay.me/hgc4jifsarq', // Temporaire : en attente du lien dédié 2 500 F
};

export const SUBSCRIPTION_PLANS = {
    starter: {
        id: 'starter',
        name: 'Pack Starter',
        price: 1500,
        currency: 'XOF',
        priceDisplay: '1 500 FCFA',
        period: 'mois',
        durationDays: 30,
        maxProducts: 5,
        paymentLink: SASPAY_PAYMENT_LINKS.starter,
        badge: 'Essentiel',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        description: 'Idéal pour démarrer votre boutique étudiante à l\'UIDT',
        features: [
            'Catalogue jusqu\'à 5 articles',
            'Commandes & notifications en direct',
            'Paiement Wave & OM direct des acheteurs',
            'Support vendeur dédié',
        ],
    },
    pro: {
        id: 'pro',
        name: 'Pack Pro',
        price: 2500,
        currency: 'XOF',
        priceDisplay: '2 500 FCFA',
        period: 'mois',
        durationDays: 30,
        maxProducts: 10,
        paymentLink: SASPAY_PAYMENT_LINKS.pro,
        badge: 'Populaire',
        badgeColor: 'bg-amber-400 text-slate-950 border-amber-500',
        description: 'Pour les vendeurs réguliers avec un catalogue élargi',
        features: [
            'Catalogue jusqu\'à 10 articles',
            'Mise en avant sur la page d\'accueil',
            'Statistiques de vente avancées',
            'Badge Boutique Recommandée',
        ],
    },
};

export const PAYMENT_OPERATORS = [
    {
        id: 'wave',
        name: 'Wave',
        label: 'Wave Sénégal',
        tagline: 'Paiement instantané sans frais',
        icon: 'fa-solid fa-water',
        primaryColor: '#1dc4fe',
        borderColor: 'border-sky-400',
        activeClass: 'border-sky-500 bg-sky-50/60 ring-2 ring-sky-300 shadow-sm',
        badgeClass: 'bg-sky-500 text-white',
        instructions: 'Scannez le QR Code ou validez la notification push Wave sur votre mobile.',
    },
    {
        id: 'om',
        name: 'Orange Money',
        label: 'Orange Money',
        tagline: 'Direct depuis votre compte OM',
        icon: 'fa-solid fa-mobile-screen-button',
        primaryColor: '#ff7900',
        borderColor: 'border-orange-400',
        activeClass: 'border-orange-500 bg-orange-50/60 ring-2 ring-orange-300 shadow-sm',
        badgeClass: 'bg-orange-500 text-white',
        instructions: 'Confirmez le débit sur votre téléphone Orange Money.',
    },
];

/**
 * Récupère les détails d'un plan par son identifiant.
 * @param {string} planId
 * @returns {Object}
 */
export function getPlanDetails(planId) {
    if (planId && SUBSCRIPTION_PLANS[planId]) {
        return SUBSCRIPTION_PLANS[planId];
    }
    return SUBSCRIPTION_PLANS.starter;
}

/**
 * Récupère le quota maximal de produits pour un plan donné.
 * @param {string} planId
 * @returns {number}
 */
export function getMaxProductsForPlan(planId) {
    const plan = getPlanDetails(planId);
    return plan.maxProducts || 5;
}

/**
 * Calcule l'état d'abonnement et de l'essai d'un profil vendeur.
 * @param {Object} profile
 * @returns {{
 *   status: 'superadmin'|'trial_active'|'trial_expiring'|'trial_expired'|'active'|'expired',
 *   daysLeft: number,
 *   isExpired: boolean,
 *   canPublish: boolean,
 *   plan: Object,
 *   expiresAt: Date|null
 * }}
 */
export function computeSubscriptionStatus(profile) {
    if (!profile) {
        return {
            status: 'trial_expired',
            daysLeft: 0,
            daysRemaining: 0,
            isExpired: true,
            isPaid: false,
            isTrial: false,
            isSuperAdmin: false,
            canPublish: false,
            canSell: false,
            maxProducts: 0,
            plan: SUBSCRIPTION_PLANS.starter,
            expiresAt: null,
        };
    }

    if (profile.role === 'superadmin') {
        return {
            status: 'superadmin',
            daysLeft: 999,
            daysRemaining: 999,
            isExpired: false,
            isPaid: true,
            isTrial: false,
            isSuperAdmin: true,
            canPublish: true,
            canSell: true,
            maxProducts: 999,
            plan: SUBSCRIPTION_PLANS.pro,
            expiresAt: null,
        };
    }

    const now = Date.now();
    const plan = getPlanDetails(profile.subscription_plan);

    // 1. Vérification de l'abonnement payant
    if (profile.subscription_expires_at) {
        const paidExpiry = new Date(profile.subscription_expires_at).getTime();
        if (paidExpiry > now) {
            const daysLeft = Math.max(0, Math.ceil((paidExpiry - now) / (1000 * 60 * 60 * 24)));
            return {
                status: 'active',
                daysLeft,
                daysRemaining: daysLeft,
                isExpired: false,
                isPaid: true,
                isTrial: false,
                isSuperAdmin: false,
                canPublish: true,
                canSell: true,
                maxProducts: plan.maxProducts || 5,
                plan,
                expiresAt: new Date(paidExpiry),
            };
        } else {
            // Abonnement payant arrivé à terme
            return {
                status: 'expired',
                daysLeft: 0,
                daysRemaining: 0,
                isExpired: true,
                isPaid: false,
                isTrial: false,
                isSuperAdmin: false,
                canPublish: false,
                canSell: false,
                maxProducts: 0,
                plan,
                expiresAt: new Date(paidExpiry),
            };
        }
    }

    // 2. Vérification de la période d'essai gratuite (7 jours)
    let trialEndMs = null;
    if (profile.trial_ends_at) {
        trialEndMs = new Date(profile.trial_ends_at).getTime();
    } else if (profile.created_at) {
        // Rétrocompatibilité : 7 jours après la date de création si trial_ends_at non renseigné
        trialEndMs = new Date(profile.created_at).getTime() + FREE_TRIAL_CONFIG.durationDays * 24 * 60 * 60 * 1000;
    }

    if (trialEndMs) {
        if (trialEndMs > now) {
            const daysLeft = Math.max(1, Math.ceil((trialEndMs - now) / (1000 * 60 * 60 * 24)));
            const status = daysLeft <= 2 ? 'trial_expiring' : 'trial_active';
            return {
                status,
                daysLeft,
                daysRemaining: daysLeft,
                isExpired: false,
                isPaid: false,
                isTrial: true,
                isSuperAdmin: false,
                canPublish: true,
                canSell: true,
                maxProducts: FREE_TRIAL_CONFIG.maxProducts, // 3 articles max pendant l'essai
                plan: SUBSCRIPTION_PLANS.starter,
                expiresAt: new Date(trialEndMs),
            };
        }
    }

    // 3. Période d'essai ou abonnement expiré
    return {
        status: 'trial_expired',
        daysLeft: 0,
        daysRemaining: 0,
        isExpired: true,
        isPaid: false,
        isTrial: false,
        isSuperAdmin: false,
        canPublish: false,
        canSell: false,
        maxProducts: 0,
        plan,
        expiresAt: trialEndMs ? new Date(trialEndMs) : null,
    };
}
