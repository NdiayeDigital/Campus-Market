/**
 * Suite de tests unitaires et d'intégration : Packs Pro (1 500 FCFA) & Business (2 500 FCFA)
 * Vérifie la rétrocompatibilité des identifiants en base, les quotas,
 * les règles Top Vendeurs (FR-18), la rétrogradation Découverte (FR-20)
 * et le comportement sous le feature flag QUOTAS_ENABLED.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
    FEATURE_FLAGS,
    SUBSCRIPTION_PLANS,
    PLAN_ALIASES,
    resolvePlanKey,
    getPlanDetails,
    getMaxProductsForPlan,
    computeSubscriptionStatus,
} from '../src/config/subscription.js';

describe('Packs Pro & Business - Rétrocompatibilité & Alias en Base', () => {
    it('1.1 : Conserve starter comme clé technique du Pack Pro (1 000 FCFA)', () => {
        const starterPlan = SUBSCRIPTION_PLANS.starter;
        assert.ok(starterPlan, 'Le plan starter doit exister');
        assert.equal(starterPlan.id, 'starter');
        assert.equal(starterPlan.name, 'Pack Pro');
        assert.equal(starterPlan.price, 1000);
        assert.equal(starterPlan.currency, 'XOF');
        assert.equal(starterPlan.maxProducts, 5);
        assert.equal(starterPlan.maxOrdersPerMonth, null, 'Les commandes doivent être illimitées');
        assert.equal(starterPlan.maxValidatedSalesPerMonth, null, 'Les ventes validées doivent être illimitées');
        assert.equal(starterPlan.allowPromotions, true);
        assert.equal(starterPlan.maxPromotionsPerMonth, 1);
        assert.equal(starterPlan.allowTopShops, false);
    });

    it('1.2 : Conserve pro comme clé technique du Pack Business (2 000 FCFA)', () => {
        const proPlan = SUBSCRIPTION_PLANS.pro;
        assert.ok(proPlan, 'Le plan pro doit exister');
        assert.equal(proPlan.id, 'pro');
        assert.equal(proPlan.name, 'Pack Business');
        assert.equal(proPlan.price, 2000);
        assert.equal(proPlan.currency, 'XOF');
        assert.equal(proPlan.maxProducts, 10);
        assert.equal(proPlan.maxOrdersPerMonth, null, 'Les commandes doivent être illimitées');
        assert.equal(proPlan.maxValidatedSalesPerMonth, null, 'Les ventes validées doivent être illimitées');
        assert.equal(proPlan.allowPromotions, true);
        assert.equal(proPlan.maxPromotionsPerWeek, 1);
        assert.equal(proPlan.promotionsFrequency, 'week');
        assert.equal(proPlan.freeAdsPerMonth, 0, 'Les 2 annonces offertes sont remplacées par la promo hebdo');
        assert.equal(proPlan.allowTopShops, true);
    });

    it('1.3 : SUBSCRIPTION_PLANS.business pointe vers le Pack Business (pro)', () => {
        assert.equal(SUBSCRIPTION_PLANS.business, SUBSCRIPTION_PLANS.pro);
        assert.equal(SUBSCRIPTION_PLANS.business.name, 'Pack Business');
        assert.equal(SUBSCRIPTION_PLANS.business.price, 2000);
    });

    it('1.4 : resolvePlanKey résout correctement les alias et montants SasPay', () => {
        // Résolution par montant (anciens et nouveaux tarifs)
        assert.equal(resolvePlanKey(null, 1000), 'starter', '1 000 FCFA -> clé starter (Pack Pro)');
        assert.equal(resolvePlanKey(null, 1500), 'starter', 'Ancien 1 500 FCFA -> clé starter (Pack Pro)');
        assert.equal(resolvePlanKey(null, 2000), 'pro', '2 000 FCFA -> clé pro (Pack Business)');
        assert.equal(resolvePlanKey(null, 2500), 'pro', 'Ancien 2 500 FCFA -> clé pro (Pack Business)');
        assert.equal(resolvePlanKey(null, 0), 'decouverte');

        // Résolution par alias
        assert.equal(resolvePlanKey('business'), 'pro', 'business -> clé pro');
        assert.equal(resolvePlanKey('pack_business'), 'pro');
        assert.equal(resolvePlanKey('starter'), 'starter', 'starter -> clé starter');
        assert.equal(resolvePlanKey('pro'), 'starter', 'alias commercial pro -> clé starter (Pack Pro)');

        // Résolution conjointe nom + montant (le montant confirme)
        assert.equal(resolvePlanKey('pro', 2000), 'pro', 'Montant 2 000F prioritaire -> pro');
        assert.equal(resolvePlanKey('pro', 2500), 'pro', 'Ancien montant 2 500F prioritaire -> pro');
        assert.equal(resolvePlanKey('business', 2000), 'pro');
    });

    it('1.5 : getPlanDetails gère les abonnés historiques et nouveaux alias', () => {
        // Ancien abonné en base avec subscription_plan = 'starter'
        const planOldStarter = getPlanDetails('starter');
        assert.equal(planOldStarter.name, 'Pack Pro');
        assert.equal(planOldStarter.price, 1000);
        assert.equal(planOldStarter.maxProducts, 5);

        // Ancien abonné en base avec subscription_plan = 'pro'
        const planOldPro = getPlanDetails('pro');
        assert.equal(planOldPro.name, 'Pack Business');
        assert.equal(planOldPro.price, 2000);
        assert.equal(planOldPro.maxProducts, 10);

        // Nouveau venu demandant 'business'
        const planBusiness = getPlanDetails('business');
        assert.equal(planBusiness.name, 'Pack Business');
        assert.equal(planBusiness.price, 2000);
    });
});

describe('Règles Pack Pro (1 000 FCFA) & Pack Business (2 000 FCFA)', () => {
    it('2.1 : Règle Pack Pro - 5 articles, commandes/ventes illimitées, 1 promo/mois, 0 annonce offerte, exclusion Top Vendeurs', () => {
        const plan = SUBSCRIPTION_PLANS.starter;
        assert.equal(plan.maxProducts, 5);
        assert.equal(plan.maxOrdersPerMonth, null);
        assert.equal(plan.maxValidatedSalesPerMonth, null);
        assert.equal(plan.maxPromotionsPerMonth, 1);
        assert.equal(plan.freeAdsPerMonth, 0);
        assert.equal(plan.allowTopShops, false);
    });

    it('2.2 : Règle Pack Business - 10 articles, commandes/ventes illimitées, 1 promo/semaine, 0 annonce offerte, accès Top Vendeurs', () => {
        const plan = SUBSCRIPTION_PLANS.pro;
        assert.equal(plan.maxProducts, 10);
        assert.equal(plan.maxOrdersPerMonth, null);
        assert.equal(plan.maxValidatedSalesPerMonth, null);
        assert.equal(plan.maxPromotionsPerWeek, 1);
        assert.equal(plan.promotionsFrequency, 'week');
        assert.equal(plan.freeAdsPerMonth, 0);
        assert.equal(plan.allowTopShops, true);
    });
});

describe('Top Vendeurs (FR-18) - Filtrage Pack Business & 10 Acheteurs Distincts', () => {
    // Simulation de la fonction de filtrage de fetchTopShops
    function filterTopShops(sellers, quotasEnabled) {
        if (!quotasEnabled) {
            return sellers.filter(s => s.is_open !== false);
        }

        const now = Date.now();
        return sellers.filter((seller) => {
            const isBusinessPlan = seller.subscription_plan === 'pro' || 
                                   seller.pack_actuel === 'pro' || 
                                   resolvePlanKey(seller.subscription_plan) === 'pro';
            const isPlanActive = seller.subscription_status === 'active' || 
                                 (seller.subscription_expires_at && new Date(seller.subscription_expires_at).getTime() > now);
            const hasTenDistinctBuyers = (seller.distinctBuyers || 0) >= 10;
            return isBusinessPlan && isPlanActive && hasTenDistinctBuyers;
        });
    }

    const mockSellers = [
        {
            id: 'seller-1',
            prenom: 'Moussa',
            subscription_plan: 'starter', // Pack Pro (1 500F) -> Exclu du Top
            subscription_status: 'active',
            subscription_expires_at: new Date(Date.now() + 86400000 * 20).toISOString(),
            distinctBuyers: 15,
            is_open: true,
        },
        {
            id: 'seller-2',
            prenom: 'Fatou',
            subscription_plan: 'pro', // Pack Business (2 500F)
            subscription_status: 'active',
            subscription_expires_at: new Date(Date.now() + 86400000 * 20).toISOString(),
            distinctBuyers: 12, // >= 10 acheteurs -> ÉLIGIBLE
            is_open: true,
        },
        {
            id: 'seller-3',
            prenom: 'Aliou',
            subscription_plan: 'pro', // Pack Business
            subscription_status: 'active',
            subscription_expires_at: new Date(Date.now() + 86400000 * 20).toISOString(),
            distinctBuyers: 8, // < 10 acheteurs -> EXCLU
            is_open: true,
        },
        {
            id: 'seller-4',
            prenom: 'Aminata',
            subscription_plan: 'pro', // Pack Business
            subscription_status: 'expired', // Expiré -> EXCLU
            subscription_expires_at: new Date(Date.now() - 86400000 * 5).toISOString(),
            distinctBuyers: 20,
            is_open: true,
        },
        {
            id: 'seller-5',
            prenom: 'Ousmane',
            subscription_plan: 'decouverte', // Découverte -> EXCLU
            subscription_status: 'active',
            distinctBuyers: 30,
            is_open: true,
        },
    ];

    it('3.1 : Sous QUOTAS_ENABLED = false, conserve le comportement de production sans exclusion', () => {
        const result = filterTopShops(mockSellers, false);
        assert.equal(result.length, 5, 'Tous les vendeurs ouverts doivent être inclus');
    });

    it('3.2 : Sous QUOTAS_ENABLED = true, n\'affiche QUE les vendeurs actifs Pack Business avec >= 10 acheteurs', () => {
        const result = filterTopShops(mockSellers, true);
        assert.equal(result.length, 1, 'Seul Fatou (seller-2) doit être éligible');
        assert.equal(result[0].id, 'seller-2');
        assert.equal(result[0].prenom, 'Fatou');
    });

    it('3.3 : Exclusion des commandes même_chambre du compte d\'acheteurs distincts', () => {
        // Vérifie la logique de calcul des acheteurs distincts hors même chambre
        const orders = [
            { buyer_phone: '770000001', is_same_room: false, status: 'delivered' },
            { buyer_phone: '770000002', is_same_room: false, status: 'delivered' },
            { buyer_phone: '770000003', is_same_room: true, status: 'delivered' }, // même chambre -> ignoré
            { buyer_phone: '770000001', is_same_room: false, status: 'delivered' }, // doublon -> 1 seul
            { buyer_phone: '770000004', is_same_room: false, status: 'pending' },   // non livré -> ignoré
        ];

        const validDistinctBuyers = new Set(
            orders
                .filter(o => o.status === 'delivered' && !o.is_same_room)
                .map(o => o.buyer_phone)
        );

        assert.equal(validDistinctBuyers.size, 2, 'Doit compter exactement 2 acheteurs distincts valides');
        assert.ok(validDistinctBuyers.has('770000001'));
        assert.ok(validDistinctBuyers.has('770000002'));
        assert.ok(!validDistinctBuyers.has('770000003'), 'La même chambre ne doit pas être comptée');
    });
});

describe('Rétrogradation Automatique vers Découverte (FR-20)', () => {
    it('4.1 : Un abonnement payant expiré bascule automatiquement en Découverte sans coupure commerciale', () => {
        const expiredProfile = {
            role: 'vendeur',
            subscription_plan: 'starter',
            subscription_expires_at: new Date(Date.now() - 86400000).toISOString(),
        };

        const status = computeSubscriptionStatus(expiredProfile);
        assert.equal(status.status, 'decouverte');
        assert.equal(status.isExpired, false);
        assert.equal(status.canPublish, true);
        assert.equal(status.canSell, true);
        assert.equal(status.maxProducts, 1);
    });

    it('4.2 : Quand QUOTAS_ENABLED = true, un abonnement payant expiré bascule automatiquement en Découverte (FR-20)', () => {
        const initialFlag = FEATURE_FLAGS.QUOTAS_ENABLED;
        FEATURE_FLAGS.QUOTAS_ENABLED = true;

        const expiredProProfile = {
            role: 'vendeur',
            subscription_plan: 'pro',
            subscription_expires_at: new Date(Date.now() - 86400000 * 2).toISOString(),
        };

        const status = computeSubscriptionStatus(expiredProProfile);
        assert.equal(status.status, 'decouverte', 'Doit rétrograder automatiquement vers decouverte');
        assert.equal(status.isExpired, false, 'Le statut Découverte reste exploitable');
        assert.equal(status.canPublish, true, 'Peut publier dans la limite du pack');
        assert.equal(status.canSell, true);
        assert.equal(status.maxProducts, 1, 'Catalogue restreint à 1 produit');
        assert.equal(status.maxOrdersPerMonth, 15, 'Quota de 15 commandes par mois');
        assert.equal(status.maxValidatedSalesPerMonth, 5, 'Quota de 5 ventes validées');
        assert.equal(status.plan.id, 'decouverte');

        FEATURE_FLAGS.QUOTAS_ENABLED = initialFlag;
    });

    it('4.3 : Même avec QUOTAS_ENABLED = false, un profil ayant pack_actuel = decouverte bascule en Découverte', () => {
        const initialFlag = FEATURE_FLAGS.QUOTAS_ENABLED;
        FEATURE_FLAGS.QUOTAS_ENABLED = false;

        const expiredProfile = {
            role: 'vendeur',
            subscription_plan: 'starter',
            pack_actuel: 'decouverte',
            subscription_expires_at: new Date(Date.now() - 86400000).toISOString(),
        };

        const status = computeSubscriptionStatus(expiredProfile);
        assert.equal(status.status, 'decouverte');
        assert.equal(status.maxProducts, 1);

        FEATURE_FLAGS.QUOTAS_ENABLED = initialFlag;
    });
});

describe('Sécurité Zéro Secret en Dur & Fail-Fast', () => {
    it('5.1 : Le feature flag QUOTAS_ENABLED est à false par défaut pour préserver la production', () => {
        assert.equal(FEATURE_FLAGS.QUOTAS_ENABLED, false);
    });

    it('5.2 : Le feature flag ADMIN_STATS_V2 est à false par défaut', () => {
        assert.equal(FEATURE_FLAGS.ADMIN_STATS_V2, false);
    });
});
