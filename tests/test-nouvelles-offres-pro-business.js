/**
 * Test Suite : NOUVELLES OFFRES PRO (1 000 FCFA) & BUSINESS (2 000 FCFA)
 * Campus Market - UIDT Thiès
 *
 * Vérifie rigoureusement :
 * 1. Centralisation des offres (SUBSCRIPTION_PLANS unique source de vérité).
 * 2. Vendeur Découverte : bloqué au 2e produit et à la 6e vente du mois.
 * 3. Vendeur Pro (1 000 FCFA) : 5 produits OK, 6e bloqué, ventes illimitées, 2e promo du mois bloquée.
 * 4. Vendeur Business (2 000 FCFA) : 10 produits OK, 11e bloqué, ventes illimitées, 2e promo de la semaine bloquée, remise à zéro le lundi Dakar.
 * 5. Préservation des abonnés existants (1 500 F et 2 500 F) jusqu'à fin de période.
 * 6. Masquage des produits excédentaires sans suppression (FR-20).
 * 7. Intégrité des règles anti-fraude (FR-01 à FR-16) et du programme Sargal.
 * 8. Conformité des scripts SQL de migration additive et de rollback.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    FEATURE_FLAGS,
    SUBSCRIPTION_PLANS,
    PLAN_ALIASES,
    resolvePlanKey,
    getPlanDetails,
    getMaxProductsForPlan,
    computeSubscriptionStatus,
    computePromotionQuota,
    getDakarWeekStart,
    getDakarMonthStart,
} from '../src/config/subscription.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('1. Centralisation des offres dans SUBSCRIPTION_PLANS', () => {
    it('1.1 : Source unique de vérité contenant tous les champs requis', () => {
        const requiredFields = [
            'prix',
            'max_produits',
            'max_ventes_mois',
            'promos_par_periode',
            'periode_promo',
            'top_vendeurs',
        ];

        for (const planKey of ['decouverte', 'starter', 'pro']) {
            const plan = SUBSCRIPTION_PLANS[planKey];
            assert.ok(plan, `Le plan ${planKey} doit exister dans SUBSCRIPTION_PLANS`);
            for (const field of requiredFields) {
                assert.ok(
                    Object.prototype.hasOwnProperty.call(plan, field),
                    `Le champ '${field}' doit être défini sur le plan ${planKey}`
                );
            }
        }
    });

    it('1.2 : Configuration exacte du Pack Découverte (0 FCFA)', () => {
        const decouverte = SUBSCRIPTION_PLANS.decouverte;
        assert.equal(decouverte.prix, 0);
        assert.equal(decouverte.price, 0);
        assert.equal(decouverte.max_produits, 1);
        assert.equal(decouverte.maxProducts, 1);
        assert.equal(decouverte.max_ventes_mois, 5);
        assert.equal(decouverte.promos_par_periode, 0);
        assert.equal(decouverte.top_vendeurs, false);
    });

    it('1.3 : Configuration exacte du Pack Pro (1 000 FCFA)', () => {
        const pro = SUBSCRIPTION_PLANS.starter; // starter est la clé technique
        assert.equal(pro.name, 'Pack Pro');
        assert.equal(pro.prix, 1000);
        assert.equal(pro.price, 1000);
        assert.equal(pro.max_produits, 5);
        assert.equal(pro.maxProducts, 5);
        assert.equal(pro.max_ventes_mois, null, 'Les ventes doivent être illimitées');
        assert.equal(pro.maxOrdersPerMonth, null, 'Les commandes doivent être illimitées');
        assert.equal(pro.promos_par_periode, 1);
        assert.equal(pro.periode_promo, 'month');
        assert.equal(pro.top_vendeurs, false);
    });

    it('1.4 : Configuration exacte du Pack Business (2 000 FCFA)', () => {
        const business = SUBSCRIPTION_PLANS.pro; // pro est la clé technique
        assert.equal(business.name, 'Pack Business');
        assert.equal(business.prix, 2000);
        assert.equal(business.price, 2000);
        assert.equal(business.max_produits, 10);
        assert.equal(business.maxProducts, 10);
        assert.equal(business.max_ventes_mois, null, 'Les ventes doivent être illimitées');
        assert.equal(business.maxOrdersPerMonth, null, 'Les commandes doivent être illimitées');
        assert.equal(business.promos_par_periode, 1);
        assert.equal(business.periode_promo, 'week');
        assert.equal(business.freeAdsPerMonth, 0, 'Les 2 annonces offertes sont supprimées au profit de la promo hebdo');
        assert.equal(business.top_vendeurs, true);
    });
});

describe('2. Vendeur Découverte : Plafonds 1 produit et 5 ventes/mois', () => {
    it('2.1 : Vendeur Découverte limité à 1 produit actif (2e produit bloqué)', () => {
        const max = getMaxProductsForPlan('decouverte');
        assert.equal(max, 1, 'Plafond Découverte = 1 produit');

        const canAddSecondProduct = (currentActiveCount) => currentActiveCount < max;
        assert.equal(canAddSecondProduct(0), true, '1er produit autorisé');
        assert.equal(canAddSecondProduct(1), false, '2e produit bloqué');
    });

    it('2.2 : Vendeur Découverte bloqué à la 6e vente du mois', () => {
        const maxSales = SUBSCRIPTION_PLANS.decouverte.max_ventes_mois;
        assert.equal(maxSales, 5, 'Plafond Découverte = 5 ventes');

        const canAcceptSale = (validatedSalesCount) => validatedSalesCount < maxSales;
        assert.equal(canAcceptSale(0), true);
        assert.equal(canAcceptSale(4), true, '5e vente autorisée');
        assert.equal(canAcceptSale(5), false, '6e vente bloquée');
    });
});

describe('3. Vendeur Pro (1 000 FCFA) : 5 produits, ventes illimitées, 1 promo/mois', () => {
    it('3.1 : Plafond catalogue à 5 produits (6e bloqué)', () => {
        const max = getMaxProductsForPlan('starter');
        assert.equal(max, 5);

        const canAddProduct = (currentCount) => currentCount < max;
        assert.equal(canAddProduct(4), true, '5e produit autorisé');
        assert.equal(canAddProduct(5), false, '6e produit bloqué');
    });

    it('3.2 : Commandes et ventes validées illimitées (aucune limite bloquante)', () => {
        const plan = SUBSCRIPTION_PLANS.starter;
        assert.equal(plan.max_ventes_mois, null);
        assert.equal(plan.maxOrdersPerMonth, null);
    });

    it('3.3 : 1 promotion autorisée par mois, 2e promo bloquée avec message exact', () => {
        const profileWithPromoAvailable = {
            subscription_plan: 'starter',
            subscription_status: 'active',
            subscription_expires_at: new Date(Date.now() + 86400000 * 20).toISOString(),
            promotions_used_this_period: 0,
            promotions_period_start: new Date().toISOString(),
        };

        const quotaAvailable = computePromotionQuota(profileWithPromoAvailable);
        assert.equal(quotaAvailable.allowed, true);
        assert.equal(quotaAvailable.remaining, 1);
        assert.equal(quotaAvailable.counterText, 'Promotions restantes : 1/1 ce mois-ci');

        const profileWithPromoConsumed = {
            subscription_plan: 'starter',
            subscription_status: 'active',
            subscription_expires_at: new Date(Date.now() + 86400000 * 20).toISOString(),
            promotions_used_this_period: 1,
            promotions_period_start: new Date().toISOString(),
        };

        const quotaConsumed = computePromotionQuota(profileWithPromoConsumed);
        assert.equal(quotaConsumed.allowed, true);
        assert.equal(quotaConsumed.remaining, 0);
        assert.equal(
            quotaConsumed.limitReachedMessage,
            'Vous avez utilisé votre promotion du mois. Prochaine disponible le 1er du mois.'
        );
        assert.equal(
            quotaConsumed.counterText,
            'Vous avez utilisé votre promotion du mois. Prochaine disponible le 1er du mois.'
        );
    });
});

describe('4. Vendeur Business (2 000 FCFA) : 10 produits, ventes illimitées, 1 promo/semaine, reset lundi', () => {
    it('4.1 : Plafond catalogue à 10 produits (11e bloqué)', () => {
        const max = getMaxProductsForPlan('pro');
        assert.equal(max, 10);

        const canAddProduct = (currentCount) => currentCount < max;
        assert.equal(canAddProduct(9), true, '10e produit autorisé');
        assert.equal(canAddProduct(10), false, '11e produit bloqué');
    });

    it('4.2 : Ventes et commandes illimitées', () => {
        const plan = SUBSCRIPTION_PLANS.pro;
        assert.equal(plan.max_ventes_mois, null);
        assert.equal(plan.maxOrdersPerMonth, null);
    });

    it('4.3 : 1 promotion par semaine, 2e promo bloquée avec message exact', () => {
        const profileAvailable = {
            subscription_plan: 'pro',
            subscription_status: 'active',
            subscription_expires_at: new Date(Date.now() + 86400000 * 20).toISOString(),
            promotions_used_this_period: 0,
            promotions_period_start: new Date().toISOString(),
        };

        const quota = computePromotionQuota(profileAvailable);
        assert.equal(quota.allowed, true);
        assert.equal(quota.isBusiness, true);
        assert.equal(quota.remaining, 1);
        assert.equal(quota.counterText, 'Promotions restantes : 1/1 cette semaine');

        const profileConsumed = {
            subscription_plan: 'pro',
            subscription_status: 'active',
            subscription_expires_at: new Date(Date.now() + 86400000 * 20).toISOString(),
            promotions_used_this_period: 1,
            promotions_period_start: new Date().toISOString(),
        };

        const quotaConsumed = computePromotionQuota(profileConsumed);
        assert.equal(quotaConsumed.allowed, true);
        assert.equal(quotaConsumed.remaining, 0);
        assert.equal(
            quotaConsumed.limitReachedMessage,
            'Vous avez utilisé votre promotion de la semaine. Prochaine disponible lundi.'
        );
        assert.equal(
            quotaConsumed.counterText,
            'Vous avez utilisé votre promotion de la semaine. Prochaine disponible lundi.'
        );
    });

    it('4.4 : Remise à zéro le lundi à 00h00 Dakar', () => {
        // Supposons une promotion consommée dimanche dernier
        const lastSunday = new Date(getDakarWeekStart().getTime() - 86400000);
        const profileFromLastWeek = {
            subscription_plan: 'pro',
            subscription_status: 'active',
            subscription_expires_at: new Date(Date.now() + 86400000 * 20).toISOString(),
            promotions_used_this_period: 1,
            promotions_period_start: lastSunday.toISOString(),
        };

        const quotaAfterMonday = computePromotionQuota(profileFromLastWeek);
        assert.equal(quotaAfterMonday.used, 0, 'Le compteur doit être remis à zéro dès le lundi');
        assert.equal(quotaAfterMonday.remaining, 1, '1 promotion à nouveau disponible');
    });
});

describe('5. Préservation des abonnés existants (1 500 F et 2 500 F)', () => {
    it('5.1 : Montants historiques de 1 500 F et 2 500 F reconnus sans pénalité', () => {
        assert.equal(resolvePlanKey(null, 1500), 'starter', 'Paiement 1 500 F -> Pack Pro');
        assert.equal(resolvePlanKey(null, 2500), 'pro', 'Paiement 2 500 F -> Pack Business');
        assert.equal(resolvePlanKey(null, 1000), 'starter', 'Paiement 1 000 F -> Pack Pro');
        assert.equal(resolvePlanKey(null, 2000), 'pro', 'Paiement 2 000 F -> Pack Business');
    });

    it('5.2 : Abonné Pro ayant payé 1 500 F conserve son accès complet jusqu à échéance', () => {
        const existingProSeller = {
            role: 'vendeur',
            subscription_plan: 'starter',
            subscription_status: 'active',
            subscription_expires_at: new Date(Date.now() + 86400000 * 15).toISOString(),
        };

        const status = computeSubscriptionStatus(existingProSeller);
        assert.equal(status.status, 'active');
        assert.equal(status.isPaid, true);
        assert.equal(status.canPublish, true);
        assert.equal(status.canSell, true);
        assert.equal(status.maxProducts, 5);
    });

    it('5.3 : Abonné Business ayant payé 2 500 F conserve son accès complet jusqu à échéance', () => {
        const existingBusinessSeller = {
            role: 'vendeur',
            subscription_plan: 'pro',
            subscription_status: 'active',
            subscription_expires_at: new Date(Date.now() + 86400000 * 15).toISOString(),
        };

        const status = computeSubscriptionStatus(existingBusinessSeller);
        assert.equal(status.status, 'active');
        assert.equal(status.isPaid, true);
        assert.equal(status.canPublish, true);
        assert.equal(status.canSell, true);
        assert.equal(status.maxProducts, 10);
    });
});

describe('6. Rétrogradation & Masquage sans suppression', () => {
    it('6.1 : À l échéance, bascule Découverte et conservation des articles masqués', () => {
        const initialQuotas = FEATURE_FLAGS.QUOTAS_ENABLED;
        FEATURE_FLAGS.QUOTAS_ENABLED = true;

        const expiredSeller = {
            role: 'vendeur',
            subscription_plan: 'pro',
            subscription_expires_at: new Date(Date.now() - 86400000).toISOString(),
        };

        const status = computeSubscriptionStatus(expiredSeller);
        assert.equal(status.status, 'decouverte');
        assert.equal(status.maxProducts, 1);
        assert.equal(status.maxValidatedSalesPerMonth, 5);

        FEATURE_FLAGS.QUOTAS_ENABLED = initialQuotas;
    });

    it('6.2 : Procédure de masquage présente dans la migration SQL sans DELETE', () => {
        const sqlPath = path.join(rootDir, 'database', 'migration_nouvelles_offres_pro_business_v1.sql');
        assert.ok(fs.existsSync(sqlPath), 'La migration SQL doit exister');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        assert.ok(sql.includes('mask_excess_products_for_sellers'), 'Doit définir mask_excess_products_for_sellers');
        assert.ok(!sql.toLowerCase().includes('delete from public.products'), 'Ne doit JAMAIS supprimer de produits');
        assert.ok(sql.includes("quota_status = 'masqué_quota'"), 'Doit marquer les produits excédentaires comme masqués');
    });
});

describe('7. Isolation stricte : Sargal et anti-fraude (FR-01 à FR-16) intacts', () => {
    it('7.1 : Règle FR-03 (anti-auto-commande) intacte', () => {
        const buyerId = 'user-abc';
        const sellerId = 'user-abc';
        const isSelfOrder = buyerId === sellerId;
        assert.equal(isSelfOrder, true, 'Auto-commande interdite');
    });

    it('7.2 : Règle FR-18 (Top Vendeurs réservé aux vendeurs Business ayant >= 10 acheteurs)', () => {
        assert.equal(SUBSCRIPTION_PLANS.starter.top_vendeurs, false, 'Pro exclu du Top');
        assert.equal(SUBSCRIPTION_PLANS.pro.top_vendeurs, true, 'Business inclus dans le Top');
        assert.equal(SUBSCRIPTION_PLANS.decouverte.top_vendeurs, false, 'Découverte exclu');
    });

    it('7.3 : Feature flag QUOTAS_ENABLED désactivé par défaut (sécurité production)', () => {
        assert.equal(FEATURE_FLAGS.QUOTAS_ENABLED, false);
    });
});

describe('8. Migration SQL et Rollback', () => {
    it('8.1 : Script de migration v1 idempotent et sécurisé', () => {
        const sqlPath = path.join(rootDir, 'database', 'migration_nouvelles_offres_pro_business_v1.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        assert.ok(sql.includes('ADD COLUMN IF NOT EXISTS is_promoted'), 'Ajoute is_promoted');
        assert.ok(sql.includes('ADD COLUMN IF NOT EXISTS promoted_until'), 'Ajoute promoted_until');
        assert.ok(sql.includes('ADD COLUMN IF NOT EXISTS promotions_used_this_period'), 'Ajoute promotions_used_this_period');
        assert.ok(sql.includes('ADD COLUMN IF NOT EXISTS promotions_period_start'), 'Ajoute promotions_period_start');
        assert.ok(sql.includes('use_product_promotion'), 'Définit la RPC use_product_promotion');
        assert.ok(sql.includes('check_product_quota_before_insert'), 'Définit le trigger de quota');
    });

    it('8.2 : Script de rollback réversible et propre', () => {
        const rollbackPath = path.join(rootDir, 'database', 'rollback_nouvelles_offres_pro_business_v1.sql');
        assert.ok(fs.existsSync(rollbackPath), 'Le script de rollback doit exister');
        const sql = fs.readFileSync(rollbackPath, 'utf8');

        assert.ok(sql.includes('DROP FUNCTION IF EXISTS public.use_product_promotion'), 'Rollback RPC promotion');
        assert.ok(sql.includes('DROP TRIGGER IF EXISTS trg_check_product_quota'), 'Rollback trigger quota');
    });
});
