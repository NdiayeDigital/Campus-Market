/**
 * Configuration centralisée des formules d'abonnement et de la passerelle SasPay.
 * Campus Market - Université Iba Der Thiam de Thiès (UIDT).
 */

export const FEATURE_FLAGS = {
    QUOTAS_ENABLED: false,   // Désactivé par défaut (sécurité production)
    ANNONCES_ENABLED: false, // Désactivé par défaut (sécurité production)
    ADMIN_STATS_V2: false,   // Stats Admin V2 avec agrégation serveur et taux d'annulation
};

export const COMPTEURS_DEPUIS_BASCULE = true; // Démarrage des compteurs Découverte à la date de bascule

export const FREE_TRIAL_CONFIG = {
    durationDays: 0,
    maxProducts: 1,
    planId: 'decouverte',
    label: 'Pack Découverte (0 FCFA)',
};

export const SASPAY_PAYMENT_LINKS = {
    starter: 'https://link.saspay.me/hgc4jifsarq',
    pro: 'https://link.saspay.me/gxky6adwejc',
};

/**
 * Correspondances et alias commerciaux vers les clés techniques historiques en base de données.
 * - Clé technique 'starter' = Pack Pro (1 000 FCFA / 30 jours, ancien prix 1 500)
 * - Clé technique 'pro'     = Pack Business (2 000 FCFA / 30 jours, ancien prix 2 500)
 * Alias : pro -> starter (1 000 F), business -> pro (2 000 F).
 */
export const PLAN_ALIASES = {
    starter: 'starter',
    pro: 'starter',          // Alias commercial Pack Pro -> clé technique starter
    business: 'pro',         // Alias commercial Pack Business -> clé technique pro
    pack_pro: 'starter',
    pack_business: 'pro',
    pack_starter: 'starter',
    decouverte: 'decouverte',
    free: 'decouverte',
};

/**
 * Résout la clé technique ('starter' pour Pack Pro, 'pro' pour Pack Business)
 * en tenant compte de l'alias textuel ou du montant réglé via SasPay.
 * Compatible avec les nouveaux tarifs (1 000 / 2 000 FCFA) et les anciens abonnements (1 500 / 2 500 FCFA).
 * @param {string} [planId]
 * @param {number|string} [amount]
 * @returns {'decouverte'|'starter'|'pro'}
 */
export function resolvePlanKey(planId, amount) {
    if (amount !== undefined && amount !== null && !isNaN(Number(amount))) {
        const numAmount = Number(amount);
        if (numAmount >= 2000) return 'pro';      // Pack Business (2 000 FCFA, compatible ancien 2 500)
        if (numAmount >= 1000) return 'starter';  // Pack Pro (1 000 FCFA, compatible ancien 1 500)
        if (numAmount === 0) return 'decouverte';
    }

    if (!planId) return 'starter';
    const clean = String(planId).trim().toLowerCase();

    if (clean === 'business' || clean === 'pack_business') {
        return 'pro';
    }
    if (clean === 'starter' || clean === 'pack_starter') {
        return 'starter';
    }
    if (clean === 'decouverte' || clean === 'free') {
        return 'decouverte';
    }
    if (clean === 'pro' || clean === 'pack_pro') {
        return 'starter'; // Commercial Pack Pro -> clé technique starter
    }

    return PLAN_ALIASES[clean] || 'starter';
}

/**
 * CONFIGURATION UNIQUE ET CENTRALISÉE DES OFFRES VENDEURS
 * Clés standardisées :
 * prix, max_produits, max_ventes_mois, promos_par_periode, periode_promo, top_vendeurs
 */
export const SUBSCRIPTION_PLANS = {
    decouverte: {
        id: 'decouverte',
        name: 'Pack Découverte',
        prix: 0,
        price: 0,
        currency: 'XOF',
        priceDisplay: 'Gratuit (0 FCFA)',
        period: 'mois',
        durationDays: 30,
        isPermanent: true,
        isFree: true,
        max_produits: 1,
        maxProducts: 1,
        max_ventes_mois: 5,
        maxValidatedSalesPerMonth: 5,
        maxOrdersPerMonth: 15,
        promos_par_periode: 0,
        periode_promo: 'none',
        allowPromotions: false,
        freeAdsPerMonth: 0,
        top_vendeurs: false,
        allowTopShops: false,
        paymentLink: null,
        badge: 'Découverte',
        badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        description: 'Formule permanente gratuite pour tester et vendre à l\'UIDT',
        features: [
            '1 article actif en vente',
            'Jusqu\'à 5 ventes validées par mois',
            'Notifications & encaissement direct Wave/OM',
        ],
    },
    starter: {
        id: 'starter',
        name: 'Pack Pro',
        prix: 1000,
        price: 1000,
        currency: 'XOF',
        priceDisplay: '1 000 FCFA',
        period: 'mois',
        durationDays: 30,
        max_produits: 5,
        maxProducts: 5,
        max_ventes_mois: null, // Ventes illimitées
        maxValidatedSalesPerMonth: null,
        maxOrdersPerMonth: null, // Commandes illimitées
        promos_par_periode: 1,
        periode_promo: 'month', // 1 promotion par mois (reset le 1er du mois)
        allowPromotions: true,
        maxPromotionsPerMonth: 1,
        freeAdsPerMonth: 0,
        top_vendeurs: false,
        allowTopShops: false,
        paymentLink: SASPAY_PAYMENT_LINKS.starter,
        badge: 'Pro',
        badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        description: 'Pour développer vos ventes régulières avec promotions mensuelles',
        features: [
            'Catalogue jusqu\'à 5 articles actifs',
            'Commandes & ventes validées illimitées',
            '1 promotion d\'article par mois (7 jours en tête de liste)',
            'Notifications & encaissement direct Wave/OM',
        ],
    },
    pro: {
        id: 'pro',
        name: 'Pack Business',
        prix: 2000,
        price: 2000,
        currency: 'XOF',
        priceDisplay: '2 000 FCFA',
        period: 'mois',
        durationDays: 30,
        max_produits: 10,
        maxProducts: 10,
        max_ventes_mois: null, // Ventes illimitées
        maxValidatedSalesPerMonth: null,
        maxOrdersPerMonth: null, // Commandes illimitées
        promos_par_periode: 1,
        periode_promo: 'week', // 1 promotion par semaine (reset chaque lundi 00h00 Dakar)
        maxPromotionsPerWeek: 1,
        promotionsFrequency: 'week',
        allowPromotions: true,
        freeAdsPerMonth: 0, // Suppression des 2 campagnes publicitaires au profit de la promo hebdo
        top_vendeurs: true,
        allowTopShops: true, // Accès exclusif Top Vendeurs (FR-18)
        paymentLink: SASPAY_PAYMENT_LINKS.pro,
        badge: 'Business',
        badgeColor: 'bg-amber-400 text-slate-950 border-amber-500',
        description: 'Pour les commerçants majeurs et les boutiques à fort volume',
        features: [
            'Catalogue jusqu\'à 10 articles actifs',
            'Commandes & ventes validées illimitées',
            '1 promotion par semaine (reset chaque lundi)',
            'Mise en avant exclusive dans « Top vendeurs » (FR-18)',
        ],
    },
};

// Alias commercial direct pour SUBSCRIPTION_PLANS.business
SUBSCRIPTION_PLANS.business = SUBSCRIPTION_PLANS.pro;

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
    const resolvedKey = resolvePlanKey(planId);
    if (resolvedKey && SUBSCRIPTION_PLANS[resolvedKey]) {
        return SUBSCRIPTION_PLANS[resolvedKey];
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
            maxProducts: 10,
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
                maxOrdersPerMonth: plan.maxOrdersPerMonth,
                maxValidatedSalesPerMonth: plan.maxValidatedSalesPerMonth,
                plan,
                expiresAt: new Date(paidExpiry),
            };
        } else {
            // Abonnement payant arrivé à terme
            // Rétrogradation automatique vers le pack Découverte permanent (0 FCFA)
            const decouvertePlan = SUBSCRIPTION_PLANS.decouverte;
            return {
                status: 'decouverte',
                daysLeft: 999,
                daysRemaining: 999,
                isExpired: false,
                isPaid: false,
                isTrial: false,
                isSuperAdmin: false,
                canPublish: true,
                canSell: true,
                maxProducts: 1,
                maxOrdersPerMonth: 15,
                ordersLimitPerMonth: 15,
                maxValidatedSalesPerMonth: 5,
                salesLimitPerMonth: 5,
                plan: decouvertePlan,
                expiresAt: null,
            };
        }
    }

    // 2. Absence d'abonnement payant actif : Attribution permanente du Pack Découverte (0 FCFA)
    const decouvertePlan = SUBSCRIPTION_PLANS.decouverte;
    return {
        status: 'decouverte',
        daysLeft: 999,
        daysRemaining: 999,
        isExpired: false,
        isPaid: false,
        isTrial: false,
        isSuperAdmin: false,
        canPublish: true,
        canSell: true,
        maxProducts: 1,
        maxOrdersPerMonth: 15,
        ordersLimitPerMonth: 15,
        maxValidatedSalesPerMonth: 5,
        salesLimitPerMonth: 5,
        plan: decouvertePlan,
        expiresAt: null,
    };
}

/**
 * Calcule le début de la semaine courante (lundi 00:00:00 UTC / Dakar).
 * @param {Date} [date]
 * @returns {Date}
 */
export function getDakarWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getUTCDay(); // 0 = dimanche, 1 = lundi...
    const diff = (day === 0 ? -6 : 1) - day;
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + diff, 0, 0, 0, 0));
}

/**
 * Calcule le début du mois courant (1er du mois à 00:00:00 UTC / Dakar).
 * @param {Date} [date]
 * @returns {Date}
 */
export function getDakarMonthStart(date = new Date()) {
    const d = new Date(date);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0, 0));
}

/**
 * Calcule l'état de consommation des promotions d'un vendeur en accord avec les règles serveur.
 * Pack Pro : 1 promo / mois (reset le 1er du mois à 00h00 Dakar).
 * Pack Business : 1 promo / semaine (reset chaque lundi à 00h00 Dakar).
 * @param {Object} profile - Profil vendeur
 * @returns {Object}
 */
export function computePromotionQuota(profile) {
    if (!profile) {
        return {
            allowed: false,
            used: 0,
            remaining: 0,
            max: 0,
            period: 'none',
            counterText: 'Mise en avant 7 jours réservée aux formules Pro (1/mois) et Business (1/semaine)',
            limitReachedMessage: '',
        };
    }

    const subStatus = computeSubscriptionStatus(profile);
    const planObj = subStatus?.plan || getPlanDetails(profile.subscription_plan || profile.pack_actuel);
    const planKey = planObj?.id || 'decouverte';

    const isPaidActive = subStatus.isPaid || subStatus.isSuperAdmin;
    if (!isPaidActive || !planObj.allowPromotions) {
        return {
            allowed: false,
            planKey,
            planName: planObj.name,
            used: 0,
            remaining: 0,
            max: 0,
            period: 'none',
            counterText: 'Mise en avant 7 jours réservée aux formules Pro (1/mois) et Business (1/semaine)',
            limitReachedMessage: '',
        };
    }

    const isBusiness = planKey === 'pro'; // 'pro' est la clé technique du Pack Business
    const now = new Date();
    const periodStart = isBusiness ? getDakarWeekStart(now) : getDakarMonthStart(now);
    const userPeriodStart = profile.promotions_period_start ? new Date(profile.promotions_period_start) : null;

    let used = Number(profile.promotions_used_this_period) || 0;
    if (!userPeriodStart || userPeriodStart < periodStart) {
        used = 0;
    }

    const max = planObj.promos_par_periode || 1;
    const remaining = Math.max(0, max - used);
    const period = isBusiness ? 'week' : 'month';

    const limitReachedMessage = isBusiness
        ? 'Vous avez utilisé votre promotion de la semaine. Prochaine disponible lundi.'
        : 'Vous avez utilisé votre promotion du mois. Prochaine disponible le 1er du mois.';

    const counterText = remaining > 0
        ? `Promotions restantes : ${remaining}/${max} ${isBusiness ? 'cette semaine' : 'ce mois-ci'}`
        : limitReachedMessage;

    return {
        allowed: true,
        isBusiness,
        planKey,
        planName: planObj.name,
        used,
        max,
        remaining,
        period,
        counterText,
        limitReachedMessage,
    };
}
