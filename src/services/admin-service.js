/**
 * Service d'administration globale (SuperAdmin UIDT).
 * Permet la supervision globale de la plateforme, l'approbation/refus des candidatures
 * de vendeurs, la modération des produits et le calcul des métriques financières réelles.
 */

import { supabase } from './supabase.js';
import {
    computeSubscriptionStatus,
    getMaxProductsForPlan,
    SUBSCRIPTION_PLANS,
    FREE_TRIAL_CONFIG,
} from '../config/subscription.js';
import { DEFAULT_CAROUSEL_SLIDES, CAROUSEL_TYPES } from '../config/announcements.js';
import { DEFAULT_PARTNERS, PARTNER_CATEGORIES } from '../config/partners.js';
import { compressImage, dataURLtoBlob } from '../utils/image-compressor.js';

/**
 * Vérifie formellement si l'utilisateur possède le rôle 'superadmin'.
 * @param {string} userId - UUID de l'utilisateur
 * @returns {Promise<boolean>}
 */
export async function verifyAdminRole(userId) {
    if (!userId) return false;

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .maybeSingle();

        if (error || !data) return false;
        return data.role === 'superadmin';
    } catch {
        return false;
    }
}

/**
 * Connecte un administrateur et vérifie ses privilèges.
 * @param {Object} credentials
 * @param {string} credentials.email
 * @param {string} credentials.password
 * @returns {Promise<{ user: Object, profile: Object }>}
 */
export async function loginAdmin({ email, password }) {
    if (!email || !password) {
        throw new Error('Email et mot de passe requis.');
    }

    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
    });

    if (authErr) {
        throw new Error('Identifiants administrateur incorrects.');
    }

    const user = authData.user;

    // Auto-réparation du profil SuperAdmin si absent ou rôle non synchronisé
    if (user.email === 'admin@univ-thies.sn') {
        const { data: existingProf } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('id', user.id)
            .maybeSingle();

        if (!existingProf) {
            await supabase.from('profiles').insert({
                id: user.id,
                email: user.email,
                prenom: 'Super',
                nom: 'Admin',
                telephone: '221770000000',
                role: 'superadmin',
                is_open: true,
            });
        } else if (existingProf.role !== 'superadmin') {
            await supabase.from('profiles').update({ role: 'superadmin' }).eq('id', user.id);
        }
    }

    const isAdmin = await verifyAdminRole(user.id);
    if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error('Accès refusé : ce compte ne possède pas les droits Super Administrateur.');
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    return { user, profile };
}

/**
 * Calcule les métriques globales RÉELLES de la plateforme (aucun plancher artificiel).
 * @returns {Promise<{ activeSellersCount: number, pendingSellersCount: number, totalOrdersCount: number, totalDeliveredRevenue: number }>}
 */
export async function fetchGlobalMetrics() {
    try {
        // 1. Profils (vendeurs actifs et en attente)
        const { data: profiles, error: errProf } = await supabase
            .from('profiles')
            .select('id, role, subscription_status, subscription_plan, subscription_expires_at, trial_ends_at');

        if (errProf) throw errProf;

        const allProfiles = profiles || [];
        const suspendedIds = getSuspendedSellersCache();
        const activeSellersCount = allProfiles.filter((p) => (p.role === 'vendeur' || p.role === 'superadmin') && !suspendedIds.includes(p.id) && p.role !== 'vendeur_desactive' && p.role !== 'suspendu').length;
        const pendingSellersCount = allProfiles.filter((p) => p.role === 'vendeur_pending').length;
        const suspendedSellersCount = allProfiles.filter((p) => p.role === 'vendeur_desactive' || p.role === 'suspendu' || suspendedIds.includes(p.id)).length;

        // 2. Commandes globales et CA réel
        const { data: orders, error: errOrders } = await supabase
            .from('orders')
            .select('id, price, status');

        if (errOrders) throw errOrders;

        const allOrders = orders || [];
        const totalOrdersCount = allOrders.length;
        const deliveredOrders = allOrders.filter((o) => o.status === 'delivered');

        // Somme des chiffres d'affaires réels sur les commandes livrées (Volume d'affaires vendeur)
        const totalDeliveredRevenue = deliveredOrders.reduce(
            (sum, o) => sum + (Number(o.price) || 0),
            0
        );

        // 3. Revenus Récurrents RÉELS des abonnements vendeurs (aucun montant arbitraire ou fictif)
        const now = new Date();
        let activePaidSubscriptionRevenue = 0;
        let activePaidSellersCount = 0;
        let trialSellersCount = 0;
        let expiredSellersCount = 0;

        allProfiles.forEach((p) => {
            if (p.role === 'vendeur' && !suspendedIds.includes(p.id)) {
                const isPaidActive = p.subscription_status === 'active' &&
                    p.subscription_expires_at &&
                    new Date(p.subscription_expires_at) > now;

                if (isPaidActive) {
                    activePaidSellersCount++;
                    const planKey = (p.subscription_plan || 'starter').toLowerCase();
                    const planFee = SUBSCRIPTION_PLANS[planKey]?.price || SUBSCRIPTION_PLANS.starter.price;
                    activePaidSubscriptionRevenue += planFee;
                } else if (p.subscription_status === 'trial' || (p.trial_ends_at && new Date(p.trial_ends_at) > now)) {
                    trialSellersCount++;
                } else {
                    expiredSellersCount++;
                }
            }
        });

        // Contrôle des transactions réellement enregistrées dans seller_payments
        let totalPaymentsCollected = 0;
        try {
            const { data: paymentsData } = await supabase
                .from('seller_payments')
                .select('amount, status')
                .in('status', ['success', 'approved', 'completed']);

            if (paymentsData && paymentsData.length > 0) {
                totalPaymentsCollected = paymentsData.reduce((sum, pay) => sum + (Number(pay.amount) || 0), 0);
            }
        } catch (e) {
            console.warn('[AdminService] seller_payments non bloquant:', e);
        }

        // Le revenu réel des abonnements actifs : somme des forfaits réels des boutiques actuellement payantes (Starter 1 500 F / Pro 2 500 F)
        // Ne doit pas être écrasé par seller_payments qui ne contient que les paiements automatisés en ligne
        const totalSubscriptionRevenue = activePaidSubscriptionRevenue > 0
            ? activePaidSubscriptionRevenue
            : totalPaymentsCollected;

        return {
            activeSellersCount,
            pendingSellersCount,
            suspendedSellersCount,
            totalOrdersCount,
            totalDeliveredRevenue,
            totalSubscriptionRevenue,
            activePaidSellersCount,
            trialSellersCount,
            expiredSellersCount,
            totalPaymentsCollected,
            sellerMonthlyFee: 1500,
        };
    } catch (err) {
        console.error('[AdminService] Erreur fetchGlobalMetrics:', err);
        throw new Error('Impossible de charger les métriques globales.');
    }
}

import { getPendingSellersCache, removePendingSellerCache } from './seller-service.js';

/**
 * Récupère la liste des étudiants en attente de validation du statut vendeur.
 * @returns {Promise<Array>}
 */
export async function fetchPendingSellers() {
    try {
        let dbSellers = [];
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('role', 'vendeur_pending')
                .order('created_at', { ascending: false });

            if (!error && data) {
                dbSellers = data;
            }
        } catch (dbErr) {
            console.warn('[AdminService] Avertissement fetchPendingSellers DB:', dbErr);
        }

        // Récupérer et fusionner avec le cache de résilience des candidatures
        const cachedSellers = getPendingSellersCache();
        const mergedMap = new Map();

        // 1. Ajouter d'abord les profils DB
        for (const s of dbSellers) {
            mergedMap.set(s.id, {
                ...s,
                subscription_plan: s.subscription_plan || 'starter',
                max_products: Number(s.max_products) || getMaxProductsForPlan(s.subscription_plan),
            });
        }

        // 2. Fusionner avec le cache local (enrichit ou ajoute si pas encore synchronisé en DB)
        for (const c of cachedSellers) {
            if (mergedMap.has(c.id)) {
                mergedMap.set(c.id, {
                    ...c,
                    ...mergedMap.get(c.id),
                    shop_name: mergedMap.get(c.id).shop_name || c.shop_name,
                    shop_category: mergedMap.get(c.id).shop_category || c.shop_category,
                    subscription_plan: mergedMap.get(c.id).subscription_plan || c.subscription_plan || 'starter',
                    max_products: mergedMap.get(c.id).max_products || c.max_products || 5,
                    email: mergedMap.get(c.id).email || c.email,
                });
            } else {
                mergedMap.set(c.id, {
                    ...c,
                    subscription_plan: c.subscription_plan || 'starter',
                    max_products: Number(c.max_products) || getMaxProductsForPlan(c.subscription_plan),
                });
            }
        }

        return Array.from(mergedMap.values());
    } catch (err) {
        console.error('[AdminService] Erreur fetchPendingSellers:', err);
        return getPendingSellersCache();
    }
}

// Clé de persistance pour état de suspension local (résilience avant migration DB)
export const SUSPENDED_SELLERS_KEY = 'campus_market_suspended_sellers';

/**
 * Récupère la liste des IDs vendeurs suspendus en cache local.
 * @returns {string[]}
 */
export function getSuspendedSellersCache() {
    try {
        if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem(SUSPENDED_SELLERS_KEY);
            return raw ? JSON.parse(raw) : [];
        }
    } catch {}
    return [];
}

/**
 * Enregistre ou retire un vendeur de la liste des suspendus en cache local.
 * @param {string} sellerId
 * @param {boolean} isSuspended
 */
export function setSuspendedSellerInCache(sellerId, isSuspended) {
    if (!sellerId) return;
    try {
        if (typeof localStorage !== 'undefined') {
            let list = getSuspendedSellersCache();
            if (isSuspended) {
                if (!list.includes(sellerId)) list.push(sellerId);
            } else {
                list = list.filter((id) => id !== sellerId);
            }
            localStorage.setItem(SUSPENDED_SELLERS_KEY, JSON.stringify(list));
        }
    } catch {}
}

/**
 * Détermine avec certitude si un vendeur est actuellement suspendu.
 * Vérifie le champ booléen is_suspended, le rôle 'vendeur_desactive'/'suspendu',
 * ou le cache persistant local.
 * @param {Object} seller
 * @returns {boolean}
 */
export function isSellerSuspended(seller) {
    if (!seller) return false;
    if (seller.is_suspended === true) return true;
    if (seller.role === 'vendeur_desactive' || seller.role === 'suspendu') return true;
    const suspendedIds = getSuspendedSellersCache();
    if (suspendedIds.includes(seller.id)) return true;
    return false;
}

/**
 * Garantit que chaque compte administrateur possède un profil vendeur complet et opérationnel.
 * Initialise les champs de boutique par défaut (quota pro, statut ouvert, nom de boutique).
 * @param {Object} adminProfile - Profil de l'administrateur
 * @returns {Promise<Object>} Profil enrichi
 */
export async function ensureAdminSellerProfile(adminProfile) {
    if (!adminProfile) return null;
    if (adminProfile.role !== 'superadmin') return adminProfile;

    const needsUpdate = !adminProfile.shop_name || !adminProfile.subscription_plan || !adminProfile.max_products;
    const defaultShopName = adminProfile.shop_name || `${adminProfile.prenom || 'Admin'} UIDT Shop`;

    const enriched = {
        ...adminProfile,
        shop_name: defaultShopName,
        subscription_plan: adminProfile.subscription_plan || 'pro',
        max_products: adminProfile.max_products || 20,
        is_open: adminProfile.is_open !== false,
        shop_category: adminProfile.shop_category || 'autres',
        description: adminProfile.description || 'Boutique officielle de l\'administration UIDT',
    };

    if (needsUpdate && supabase) {
        try {
            await supabase
                .from('profiles')
                .update({
                    shop_name: enriched.shop_name,
                    subscription_plan: enriched.subscription_plan,
                    max_products: enriched.max_products,
                    is_open: enriched.is_open,
                    shop_category: enriched.shop_category,
                    description: enriched.description,
                })
                .eq('id', adminProfile.id);
        } catch (err) {
            console.warn('[AdminService] Note mise à jour profil vendeur admin:', err);
        }
    }

    return enriched;
}

/**
 * Récupère la liste des vendeurs actifs certifiés, suspendus et superadmins avec profil vendeur.
 * Synchronise l'état avec le cache local pour une persistance immédiate.
 * @returns {Promise<Array>}
 */
export async function fetchActiveSellers() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .in('role', ['vendeur', 'vendeur_desactive', 'suspendu', 'superadmin'])
            .order('created_at', { ascending: false });

        if (error) throw error;
        const sellers = data || [];
        const suspendedIds = getSuspendedSellersCache();

        return sellers.map((s) => {
            const isSuperAdmin = s.role === 'superadmin';
            const suspended = !isSuperAdmin && (
                s.is_suspended === true || 
                s.role === 'vendeur_desactive' || 
                s.role === 'suspendu' || 
                suspendedIds.includes(s.id)
            );

            if (suspended) {
                setSuspendedSellerInCache(s.id, true);
                return {
                    ...s,
                    is_suspended: true,
                    role: s.role === 'vendeur' ? 'vendeur_desactive' : s.role,
                    is_open: false,
                };
            }

            if (isSuperAdmin) {
                return {
                    ...s,
                    shop_name: s.shop_name || `${s.prenom || 'Admin'} UIDT Shop`,
                    subscription_plan: s.subscription_plan || 'pro',
                    max_products: s.max_products || 20,
                    is_open: s.is_open !== false,
                    shop_category: s.shop_category || 'autres',
                    isAdminSeller: true,
                };
            }

            return s;
        });
    } catch (err) {
        console.error('[AdminService] Erreur fetchActiveSellers:', err);
        throw err;
    }
}

/**
 * Approuve la candidature d'un étudiant vendeur.
 * Passe son rôle de 'vendeur_pending' à 'vendeur'.
 * @param {string} sellerId - UUID du vendeur
 * @returns {Promise<Object>}
 */
export async function approveSeller(sellerId) {
    if (!sellerId) throw new Error('ID vendeur manquant.');

    // Récupérer le plan de la candidature pour le conserver lors de la validation
    const cachedList = getPendingSellersCache();
    const cached = cachedList.find((s) => s.id === sellerId);
    const plan = cached?.subscription_plan || 'starter';
    const validPlan = SUBSCRIPTION_PLANS[plan] ? plan : 'starter';
    const maxProducts = getMaxProductsForPlan(validPlan);
    const nowIso = new Date().toISOString();
    const trialEndIso = new Date(Date.now() + FREE_TRIAL_CONFIG.durationDays * 24 * 60 * 60 * 1000).toISOString();

    // 1. Nettoyer le cache local de candidature en attente
    removePendingSellerCache(sellerId);

    let updated = null;
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({ 
                role: 'vendeur', 
                is_open: true,
                subscription_plan: validPlan,
                max_products: FREE_TRIAL_CONFIG.maxProducts,
                subscription_status: 'trial',
                trial_started_at: nowIso,
                trial_ends_at: trialEndIso,
            })
            .eq('id', sellerId)
            .select();

        if (!error && data?.length) {
            updated = data[0];
        }
    } catch {}

    if (!updated) {
        // Fallback sans colonnes étendues si migration non encore effectuée
        try {
            const { data, error } = await supabase
                .from('profiles')
                .update({ role: 'vendeur', is_open: true })
                .eq('id', sellerId)
                .select();

            if (!error && data?.length) {
                updated = data[0];
            } else if (error) {
                console.warn(`[AdminService] Avertissement approbation DB: ${error.message}`);
            }
        } catch {}
    }

    if (!updated) {
        updated = {
            id: sellerId,
            ...(cached || {}),
            role: 'vendeur',
            is_open: true,
            subscription_plan: plan,
            max_products: maxProducts,
        };
    }

    return updated;
}

/**
 * Rejette ou annule la demande vendeur d'un étudiant (repassage en 'acheteur').
 * @param {string} sellerId
 * @returns {Promise<Object>}
 */
export async function rejectSeller(sellerId) {
    if (!sellerId) throw new Error('ID vendeur manquant.');

    removePendingSellerCache(sellerId);

    const { data, error } = await supabase
        .from('profiles')
        .update({ role: 'acheteur' })
        .eq('id', sellerId)
        .select();

    if (error) {
        console.warn(`[AdminService] Avertissement rejet DB: ${error.message}`);
    }

    return (data && data[0]) || { id: sellerId, role: 'acheteur' };
}

/**
 * Suspend ou réactive un marchand (bascule entre 'vendeur' et 'vendeur_desactive').
 * @param {string} sellerId
 * @param {boolean} [suspend=true] - True pour suspendre, false pour réactiver
 * @returns {Promise<Object>}
 */
export async function suspendSeller(sellerId, suspend = true) {
    if (!sellerId) throw new Error('ID vendeur manquant.');

    // 🔒 Règle de protection mutuelle : Impossible de suspendre un SuperAdmin
    const { data: targetProf } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', sellerId)
        .maybeSingle();

    if (targetProf?.role === 'superadmin') {
        throw new Error('Action non autorisée : Les comptes SuperAdmin sont protégés et ne peuvent pas être suspendus.');
    }

    const targetRole = suspend ? 'vendeur_desactive' : 'vendeur';
    const isOpen = !suspend;

    // Synchronisation immédiate du cache local (résilience hors-ligne / avant migration)
    setSuspendedSellerInCache(sellerId, suspend);

    // 1. Tentative avec is_suspended et rôle (schéma complet)
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({ 
                is_suspended: suspend, 
                role: targetRole, 
                is_open: isOpen 
            })
            .eq('id', sellerId)
            .select();

        if (!error && data?.length) {
            return data[0];
        }
    } catch {}

    // 2. Tentative avec rôle et is_open (si is_suspended n'est pas encore migré)
    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({ 
                role: targetRole, 
                is_open: isOpen 
            })
            .eq('id', sellerId)
            .select();

        if (!error && data?.length) {
            return data[0];
        }
    } catch {}

    // 3. Repli avec is_open seul si la contrainte check bloque le rôle
    const { data, error } = await supabase
        .from('profiles')
        .update({ is_open: isOpen })
        .eq('id', sellerId)
        .select();

    if (error) {
        throw new Error(`Échec de mise à jour du statut: ${error.message}`);
    }

    return (data && data[0]) || { id: sellerId, role: targetRole, is_open: isOpen, is_suspended: suspend };
}

/**
 * Rétrograde un vendeur en simple acheteur (révocation définitive des droits marchand).
 * @param {string} sellerId
 * @returns {Promise<Object>}
 */
export async function revokeSeller(sellerId) {
    if (!sellerId) throw new Error('ID vendeur manquant.');

    // 🔒 Règle de protection mutuelle : Impossible de rétrograder un SuperAdmin
    const { data: targetProf } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', sellerId)
        .maybeSingle();

    if (targetProf?.role === 'superadmin') {
        throw new Error('Action non autorisée : Les comptes SuperAdmin sont protégés et ne peuvent pas être rétrogradés.');
    }

    setSuspendedSellerInCache(sellerId, false);

    try {
        const { data, error } = await supabase
            .from('profiles')
            .update({ role: 'acheteur', is_open: false, is_suspended: false })
            .eq('id', sellerId)
            .select()
            .single();

        if (!error && data) return data;
    } catch {}

    const { data: fbData, error: fbErr } = await supabase
        .from('profiles')
        .update({ role: 'acheteur', is_open: false })
        .eq('id', sellerId)
        .select()
        .single();

    if (fbErr) {
        throw new Error(`Échec de rétrogradation: ${fbErr.message}`);
    }

    return fbData;
}

/**
 * Supprime définitivement un profil utilisateur/vendeur.
 * @param {string} sellerId
 * @returns {Promise<boolean>}
 */
export async function deleteSellerAccount(sellerId) {
    if (!sellerId) throw new Error('ID vendeur manquant.');

    // 🔒 Règle de protection mutuelle : Impossible de supprimer un SuperAdmin depuis l'application
    const { data: targetProf } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', sellerId)
        .maybeSingle();

    if (targetProf?.role === 'superadmin') {
        throw new Error("Action non autorisée : Les comptes SuperAdmin sont protégés et ne peuvent pas être supprimés depuis l'application.");
    }

    setSuspendedSellerInCache(sellerId, false);

    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', sellerId);

    if (error) {
        throw new Error(`Échec de suppression du compte: ${error.message}`);
    }

    return true;
}

/**
 * Supprime un produit en tant que modérateur.
 * @param {string} productId
 * @returns {Promise<boolean>}
 */
export async function deleteProductAdmin(productId) {
    if (!productId) throw new Error('ID produit manquant.');

    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

    if (error) {
        throw new Error(`Échec de suppression du produit: ${error.message}`);
    }

    return true;
}

/**
 * Récupère l'intégralité des produits du catalogue pour modération SuperAdmin.
 * @returns {Promise<Array>}
 */
export async function fetchAllProductsAdmin() {
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*, seller:seller_id(id, prenom, nom, telephone)')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('[AdminService] Erreur fetchAllProductsAdmin:', err);
        throw err;
    }
}

/**
 * Récupère l'historique complet des commandes pour supervision SuperAdmin.
 * @returns {Promise<Array>}
 */
export async function fetchAllOrdersAdmin() {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*, product:product_id(id, title, image_url, price, category), seller:seller_id(id, prenom, nom, telephone, shop_name)')
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('[AdminService] Erreur fetchAllOrdersAdmin:', err);
        throw err;
    }
}

export const DEFAULT_DELIVERY_LOCATIONS = [
    { id: 'def-0a', name: 'Pavillon A', is_active: true },
    { id: 'def-0b', name: 'Pavillon B', is_active: true },
    { id: 'def-0c', name: '1000 lits', is_active: true },
    { id: 'def-1', name: 'Pavillon A1', is_active: true },
    { id: 'def-2', name: 'Pavillon A2', is_active: true },
    { id: 'def-3', name: 'Pavillon A3', is_active: true },
    { id: 'def-4', name: 'Pavillon A4', is_active: true },
    { id: 'def-5', name: 'Pavillon B1', is_active: true },
    { id: 'def-6', name: 'Pavillon B2', is_active: true },
    { id: 'def-7', name: 'Pavillon C', is_active: true },
    { id: 'def-8', name: 'Jardin Social', is_active: true },
    { id: 'def-9', name: 'Bibliothèque Universitaire (BU)', is_active: true },
    { id: 'def-10', name: 'Salles de cours / Espaces communs', is_active: true },
];

/**
 * Récupère les lieux et pavillons de livraison (avec fallback local si hors-ligne).
 * @param {boolean} [includeInactive=false] - Inclure les lieux inactifs (pour le SuperAdmin)
 * @returns {Promise<Array>}
 */
export async function fetchDeliveryLocations(includeInactive = false) {
    try {
        let query = supabase.from('delivery_locations').select('*').order('name', { ascending: true });
        if (!includeInactive) {
            query = query.eq('is_active', true);
        }
        const { data, error } = await query;
        if (error || !data || data.length === 0) {
            return includeInactive ? DEFAULT_DELIVERY_LOCATIONS : DEFAULT_DELIVERY_LOCATIONS.filter((l) => l.is_active);
        }
        return data;
    } catch {
        return includeInactive ? DEFAULT_DELIVERY_LOCATIONS : DEFAULT_DELIVERY_LOCATIONS.filter((l) => l.is_active);
    }
}

/**
 * Ajoute un nouveau lieu de livraison (SuperAdmin).
 * @param {Object} params
 * @param {string} params.name
 * @param {string} [params.category='pavillon']
 * @returns {Promise<Object>}
 */
export async function addDeliveryLocation({ name, category = 'pavillon' }) {
    if (!name || !name.trim()) throw new Error('Le nom du lieu est requis.');

    const { data, error } = await supabase
        .from('delivery_locations')
        .insert([{ name: name.trim(), category, is_active: true }])
        .select()
        .single();

    if (error) {
        throw new Error(`Échec d'ajout du lieu : ${error.message}`);
    }
    return data;
}

/**
 * Active ou désactive un lieu de livraison (SuperAdmin).
 * @param {string} id
 * @param {boolean} isActive
 * @returns {Promise<Object>}
 */
export async function toggleDeliveryLocation(id, isActive) {
    if (!id) throw new Error('ID lieu manquant.');
    const { data, error } = await supabase
        .from('delivery_locations')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec de modification du statut : ${error.message}`);
    }
    return data;
}

/**
 * Supprime un lieu de livraison (SuperAdmin).
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteDeliveryLocation(id) {
    if (!id) throw new Error('ID lieu manquant.');
    const { error } = await supabase
        .from('delivery_locations')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`Échec de suppression du lieu : ${error.message}`);
    }
    return true;
}

/**
 * Modifie le statut d'une commande par le SuperAdmin (arbitrage et litiges).
 * @param {string} orderId
 * @param {string} newStatus - 'pending'|'confirmed'|'processing'|'shipped'|'delivered'|'cancelled'
 * @returns {Promise<Object>}
 */
export async function updateOrderStatusAdmin(orderId, newStatus) {
    if (!orderId) throw new Error('ID commande requis.');
    const VALID_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!VALID_STATUSES.includes(newStatus)) {
        throw new Error(`Statut invalide : ${newStatus}`);
    }

    const { data, error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec de mise à jour du statut : ${error.message}`);
    }
    return data;
}

/**
 * Récupère l'intégralité des profils d'utilisateurs de la plateforme (SuperAdmin).
 * @returns {Promise<Array>}
 */
export async function fetchAllProfilesAdmin() {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('[AdminService] Erreur fetchAllProfilesAdmin:', err);
        return [];
    }
}

/**
 * Met à jour le rôle d'un compte utilisateur (SuperAdmin).
 * @param {string} userId
 * @param {string} newRole - 'acheteur'|'vendeur_pending'|'vendeur'|'vendeur_desactive'|'suspendu'|'superadmin'
 * @returns {Promise<Object>}
 */
export async function updateUserRoleAdmin(userId, newRole) {
    if (!userId || !newRole) throw new Error('ID et rôle requis.');

    // 🔒 Règle de protection mutuelle : Impossible de modifier un SuperAdmin ou de nommer un SuperAdmin depuis le front
    const { data: targetProf } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

    if (targetProf?.role === 'superadmin') {
        throw new Error("Action non autorisée : Les droits d'un SuperAdmin ne peuvent être modifiés que directement depuis le SQL Editor de Supabase.");
    }

    if (newRole === 'superadmin') {
        throw new Error("Action non autorisée : La nomination au rôle SuperAdmin s'effectue exclusivement depuis le SQL Editor de Supabase.");
    }

    const { data, error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec de modification du rôle : ${error.message}`);
    }
    return data;
}

/**
 * Accorde une extension de la période d'essai gratuit à un vendeur (ex: +7 jours).
 * @param {string} sellerId
 * @param {number} [extraDays=7]
 * @returns {Promise<Object>}
 */
export async function grantSellerTrialExtension(sellerId, extraDays = 7) {
    if (!sellerId) throw new Error('ID vendeur requis.');

    // 🔒 Les SuperAdmins ont déjà un accès illimité permanent
    const { data: targetProf } = await supabase.from('profiles').select('role').eq('id', sellerId).maybeSingle();
    if (targetProf?.role === 'superadmin') {
        throw new Error("Action sans objet : Les comptes SuperAdmin disposent déjà d'un accès illimité permanent.");
    }

    const newTrialEnd = new Date(Date.now() + extraDays * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from('profiles')
        .update({
            subscription_status: 'trial',
            trial_ends_at: newTrialEnd,
            is_open: true,
        })
        .eq('id', sellerId)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec de l'extension d'essai: ${error.message}`);
    }
    return data;
}

/**
 * Active manuellement un abonnement vendeur pour 30 jours (ex: règlement direct en cash sur le campus).
 * @param {string} sellerId
 * @param {string} [plan='starter']
 * @param {number} [durationDays=30]
 * @returns {Promise<Object>}
 */
export async function manuallyActivateSubscription(sellerId, plan = 'starter', durationDays = null) {
    if (!sellerId) throw new Error('ID vendeur requis.');

    // 🔒 Les SuperAdmins ont déjà un accès illimité permanent
    const { data: targetProf } = await supabase.from('profiles').select('role').eq('id', sellerId).maybeSingle();
    if (targetProf?.role === 'superadmin') {
        throw new Error("Action sans objet : Les comptes SuperAdmin disposent déjà d'un accès illimité permanent.");
    }

    const validPlan = SUBSCRIPTION_PLANS[plan] ? plan : 'starter';
    const maxProducts = getMaxProductsForPlan(validPlan);
    const finalDurationDays = durationDays || 30;
    const expiresAt = new Date(Date.now() + finalDurationDays * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
        .from('profiles')
        .update({
            subscription_status: 'active',
            subscription_plan: validPlan,
            max_products: maxProducts,
            subscription_expires_at: expiresAt,
            last_payment_date: new Date().toISOString(),
            last_payment_id: 'manual_admin',
            is_open: true,
        })
        .eq('id', sellerId)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec de l'activation d'abonnement: ${error.message}`);
    }
    return data;
}

/**
 * Réinitialise le mot de passe d'un vendeur au mot de passe temporaire 'campus1234!'
 * et active le drapeau de changement obligatoire de mot de passe.
 * @param {string} sellerId - UUID du vendeur
 * @returns {Promise<Object>}
 */
export async function adminResetSellerPassword(sellerId) {
    if (!sellerId) throw new Error('ID vendeur manquant.');

    // 🔒 Règle de protection mutuelle : Impossible de réinitialiser le mot de passe d'un SuperAdmin
    const { data: targetProf } = await supabase.from('profiles').select('role').eq('id', sellerId).maybeSingle();
    if (targetProf?.role === 'superadmin') {
        throw new Error("Action non autorisée : Le mot de passe d'un compte SuperAdmin ne peut pas être réinitialisé via cette interface.");
    }

    // 1. Tenter via la procédure stockée RPC Supabase (admin_reset_seller_password)
    let rpcSuccess = false;
    let lastError = null;

    try {
        const { data, error } = await supabase.rpc('admin_reset_seller_password', {
            target_user_id: sellerId,
        });
        if (!error) {
            rpcSuccess = true;
        } else {
            console.error('[AdminService] Erreur RPC admin_reset_seller_password:', error);
            lastError = error;
        }
    } catch (err) {
        console.error('[AdminService] Exception RPC admin_reset_seller_password:', err);
        lastError = err;
    }

    // 2. Si le RPC n'a pas répondu, tenter l'API serverless /api/admin-reset-password (en environnement navigateur)
    if (!rpcSuccess && typeof window !== 'undefined' && typeof fetch !== 'undefined') {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/admin-reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
                },
                body: JSON.stringify({ sellerId }),
            });
            if (res.ok) {
                rpcSuccess = true;
            } else {
                const body = await res.json().catch(() => ({}));
                if (body.error) lastError = new Error(body.error);
            }
        } catch (fetchErr) {
            console.warn('[AdminService] Note API reset password:', fetchErr);
        }
    }

    if (!rpcSuccess) {
        const errorMsg = lastError?.message || 'Échec de la réinitialisation du mot de passe. Vérifiez vos permissions Super Administrateur.';
        throw new Error(errorMsg);
    }

    // 3. Mise à jour de sécurité de la colonne must_change_password dans profiles
    try {
        await supabase
            .from('profiles')
            .update({ must_change_password: true })
            .eq('id', sellerId);
    } catch (profErr) {
        console.warn('[AdminService] Note mise à jour drapeau profil:', profErr);
    }

    return {
        success: true,
        sellerId,
        temporaryPassword: 'campus1234!',
    };
}

/**
 * Récupère l'ensemble des demandes de paiement d'abonnements en attente de vérification.
 * @returns {Promise<Array>}
 */
export async function fetchPendingSubscriptionPayments() {
    try {
        const { data, error } = await supabase
            .from('seller_payments')
            .select('*, seller:seller_id(id, prenom, nom, email, telephone, subscription_plan, subscription_status, shop_name)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) {
            console.warn('[AdminService] Note fetchPendingSubscriptionPayments:', error.message);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('[AdminService] Erreur fetchPendingSubscriptionPayments:', err);
        return [];
    }
}

/**
 * Approuve un paiement d'abonnement et active la boutique du vendeur pour 30 jours.
 * @param {string} paymentId - UUID de la transaction dans seller_payments
 * @returns {Promise<Object>}
 */
export async function approveSubscriptionPayment(paymentId) {
    if (!paymentId) throw new Error('ID de paiement requis.');

    // 1. Tenter via la RPC sécurisée admin_approve_subscription_payment
    let rpcSuccess = false;
    try {
        const { data, error } = await supabase.rpc('admin_approve_subscription_payment', {
            target_payment_id: paymentId,
            duration_days: 30,
        });
        if (!error && data) {
            rpcSuccess = true;
        }
    } catch {}

    if (rpcSuccess) {
        return { success: true };
    }

    // 2. Repli côté service avec session SuperAdmin active
    const { data: payment, error: pErr } = await supabase
        .from('seller_payments')
        .select('*')
        .eq('id', paymentId)
        .single();

    if (pErr || !payment) throw new Error('Paiement introuvable.');

    // Activer l'abonnement du vendeur pour 30 jours
    await manuallyActivateSubscription(payment.seller_id, payment.plan || 'starter', 30);

    // Mettre à jour le statut du paiement
    const { data: updatedPay, error: uErr } = await supabase
        .from('seller_payments')
        .update({
            status: 'success',
            metadata: {
                ...(payment.metadata || {}),
                approved_at: new Date().toISOString(),
                approved_via: 'superadmin_dashboard',
            },
            updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .select()
        .single();

    if (uErr) {
        console.warn('[AdminService] Note mise à jour statut paiement:', uErr.message);
    }

    return { success: true, payment: updatedPay };
}

/**
 * Rejette une demande de paiement d'abonnement avec motif explicatif.
 * @param {string} paymentId
 * @param {string} [reason]
 * @returns {Promise<Object>}
 */
export async function rejectSubscriptionPayment(paymentId, reason = '') {
    if (!paymentId) throw new Error('ID de paiement requis.');

    // 1. Tenter via la RPC sécurisée admin_reject_subscription_payment
    let rpcSuccess = false;
    try {
        const { data, error } = await supabase.rpc('admin_reject_subscription_payment', {
            target_payment_id: paymentId,
            rejection_reason: reason || 'Paiement non constaté ou référence invalide.',
        });
        if (!error && data) {
            rpcSuccess = true;
        }
    } catch {}

    if (rpcSuccess) {
        return { success: true };
    }

    // 2. Repli côté service
    const { data: updatedPay, error } = await supabase
        .from('seller_payments')
        .update({
            status: 'failed',
            metadata: {
                rejected_at: new Date().toISOString(),
                rejection_reason: reason || 'Paiement non constaté ou référence invalide.',
            },
            updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .select()
        .single();

    if (error) throw new Error(`Échec du rejet : ${error.message}`);
    return { success: true, payment: updatedPay };
}

/**
 * Récupère les diapositives du carrousel d'accueil (avec repli local).
 * @param {boolean} [includeInactive=false]
 * @returns {Promise<Array>}
 */
export async function fetchCarouselSlides(includeInactive = false) {
    try {
        let query = supabase
            .from('carousel_slides')
            .select('*')
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (!includeInactive) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;
        if (error || !data || data.length === 0) {
            return includeInactive 
                ? DEFAULT_CAROUSEL_SLIDES 
                : DEFAULT_CAROUSEL_SLIDES.filter((s) => s.is_active);
        }
        return data;
    } catch {
        return includeInactive 
            ? DEFAULT_CAROUSEL_SLIDES 
            : DEFAULT_CAROUSEL_SLIDES.filter((s) => s.is_active);
    }
}

/**
 * Ajoute une diapositive au carrousel (SuperAdmin).
 * @param {Object} slideData
 * @returns {Promise<Object>}
 */
export async function addCarouselSlide(slideData) {
    if (!slideData.title?.trim()) {
        throw new Error('Le titre de la diapositive est obligatoire.');
    }

    const payload = {
        title: slideData.title.trim(),
        subtitle: slideData.subtitle?.trim() || '',
        slide_type: slideData.slide_type || 'annonce',
        badge: slideData.badge?.trim() || (CAROUSEL_TYPES[slideData.slide_type]?.defaultBadge || '📢 Info Campus'),
        image_url: slideData.image_url?.trim() || '',
        link_url: slideData.link_url?.trim() || '#catalog',
        link_text: slideData.link_text?.trim() || 'Découvrir',
        display_order: parseInt(slideData.display_order, 10) || 0,
        is_active: slideData.is_active !== false,
    };

    const { data, error } = await supabase
        .from('carousel_slides')
        .insert([payload])
        .select()
        .single();

    if (error) {
        throw new Error(`Échec d'ajout de la diapositive : ${error.message}`);
    }
    return data;
}

/**
 * Met à jour une diapositive du carrousel (SuperAdmin).
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updateCarouselSlide(id, updates) {
    if (!id) throw new Error('ID diapositive manquant.');

    const payload = { ...updates };
    if (payload.title) payload.title = payload.title.trim();
    if (payload.subtitle) payload.subtitle = payload.subtitle.trim();
    if (payload.display_order !== undefined) payload.display_order = parseInt(payload.display_order, 10) || 0;

    const { data, error } = await supabase
        .from('carousel_slides')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec de mise à jour de la diapositive : ${error.message}`);
    }
    return data;
}

/**
 * Active ou désactive une diapositive du carrousel.
 * @param {string} id
 * @param {boolean} isActive
 * @returns {Promise<Object>}
 */
export async function toggleCarouselSlide(id, isActive) {
    return updateCarouselSlide(id, { is_active: isActive });
}

/**
 * Supprime une diapositive du carrousel (SuperAdmin).
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteCarouselSlide(id) {
    if (!id) throw new Error('ID diapositive manquant.');
    const { error } = await supabase
        .from('carousel_slides')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`Échec de suppression de la diapositive : ${error.message}`);
    }
    return true;
}

/**
 * Récupère les partenaires officiels de la plateforme (avec repli local).
 * @param {boolean} [includeInactive=false]
 * @returns {Promise<Array>}
 */
export async function fetchPartners(includeInactive = false) {
    try {
        let query = supabase
            .from('partners')
            .select('*')
            .order('display_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (!includeInactive) {
            query = query.eq('is_active', true);
        }

        const { data, error } = await query;
        if (error || !data || data.length === 0) {
            return includeInactive 
                ? DEFAULT_PARTNERS 
                : DEFAULT_PARTNERS.filter((p) => p.is_active);
        }
        return data;
    } catch {
        return includeInactive 
            ? DEFAULT_PARTNERS 
            : DEFAULT_PARTNERS.filter((p) => p.is_active);
    }
}

/**
 * Ajoute un nouveau partenaire (SuperAdmin).
 * @param {Object} partnerData
 * @returns {Promise<Object>}
 */
export async function addPartner(partnerData) {
    if (!partnerData.name?.trim()) {
        throw new Error('Le nom du partenaire est obligatoire.');
    }

    const category = partnerData.category || 'autre';
    const catConfig = PARTNER_CATEGORIES[category] || PARTNER_CATEGORIES.autre;

    const payload = {
        name: partnerData.name.trim(),
        category,
        category_label: partnerData.category_label?.trim() || catConfig.label,
        logo_url: partnerData.logo_url?.trim() || '',
        description: partnerData.description?.trim() || '',
        perk: partnerData.perk?.trim() || '',
        badge: partnerData.badge?.trim() || 'Partenaire Officiel',
        website_url: partnerData.website_url?.trim() || '',
        display_order: parseInt(partnerData.display_order, 10) || 0,
        is_active: partnerData.is_active !== false,
    };

    const { data, error } = await supabase
        .from('partners')
        .insert([payload])
        .select()
        .single();

    if (error) {
        throw new Error(`Échec d'ajout du partenaire : ${error.message}`);
    }
    return data;
}

/**
 * Met à jour un partenaire (SuperAdmin).
 * @param {string} id
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
export async function updatePartner(id, updates) {
    if (!id) throw new Error('ID partenaire manquant.');

    const payload = { ...updates };
    if (payload.name) payload.name = payload.name.trim();
    if (payload.description) payload.description = payload.description.trim();
    if (payload.perk) payload.perk = payload.perk.trim();
    if (payload.display_order !== undefined) payload.display_order = parseInt(payload.display_order, 10) || 0;

    const { data, error } = await supabase
        .from('partners')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        throw new Error(`Échec de mise à jour du partenaire : ${error.message}`);
    }
    return data;
}

/**
 * Active ou désactive un partenaire.
 * @param {string} id
 * @param {boolean} isActive
 * @returns {Promise<Object>}
 */
export async function togglePartner(id, isActive) {
    return updatePartner(id, { is_active: isActive });
}

/**
 * Supprime un partenaire (SuperAdmin).
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deletePartner(id) {
    if (!id) throw new Error('ID partenaire manquant.');
    const { error } = await supabase
        .from('partners')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(`Échec de suppression du partenaire : ${error.message}`);
    }
    return true;
}

/**
 * Téléverse un média d'administration (bannière ou logo) vers Supabase Storage.
 * @param {File|Blob} file
 * @param {string} [folder='carousel'] - 'carousel' ou 'partners'
 * @returns {Promise<string>} URL publique du fichier
 */
export async function uploadAdminMedia(file, folder = 'carousel') {
    if (!file) throw new Error('Aucun fichier fourni.');

    // Compression adaptée
    let blob;
    if (folder === 'carousel') {
        const compressed = await compressImage(file, { maxWidth: 1280, maxHeight: 720, quality: 0.8 });
        blob = dataURLtoBlob(compressed);
    } else {
        const compressed = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.85 });
        blob = dataURLtoBlob(compressed);
    }

    const ext = 'jpg';
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(fileName, blob, {
            contentType: 'image/jpeg',
            upsert: true,
        });

    if (uploadError) {
        throw new Error(`Échec de l'upload du média : ${uploadError.message}`);
    }

    const { data: publicData } = supabase.storage
        .from('products')
        .getPublicUrl(fileName);

    return publicData?.publicUrl || '';
}

/**
 * Diffuse une notification Web Push native via l'endpoint serverless sécurisé /api/admin-broadcast-push.
 * @param {Object} options
 * @param {string} options.title - Titre de l'alerte (3-80 caractères)
 * @param {string} options.body - Message (5-250 caractères)
 * @param {string} [options.url='/'] - URL de redirection au clic
 * @param {'all'|'sellers'|'buyers'} [options.targetAudience='all'] - Cible
 * @returns {Promise<Object>} Résumé de délivrabilité
 */
export async function broadcastPushNotification({ title, body, url = '/', targetAudience = 'all' } = {}) {
    const cleanTitle = (title || '').trim();
    const cleanBody = (body || '').trim();
    const cleanUrl = (url || '/').trim();

    if (!cleanTitle || cleanTitle.length < 3 || cleanTitle.length > 80) {
        throw new Error('Le titre est obligatoire (entre 3 et 80 caractères).');
    }
    if (!cleanBody || cleanBody.length < 5 || cleanBody.length > 250) {
        throw new Error('Le message est obligatoire (entre 5 et 250 caractères).');
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.access_token) {
        throw new Error('Authentification requise. Veuillez vous reconnecter en tant que Super Administrateur.');
    }

    const response = await fetch('/api/admin-broadcast-push', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
            title: cleanTitle,
            body: cleanBody,
            url: cleanUrl,
            targetAudience,
        }),
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(result.error || `Erreur lors de la diffusion push (Code ${response.status})`);
    }

    return result;
}

/**
 * Récupère l'historique des campagnes push diffusées par le SuperAdmin.
 * @returns {Promise<Array>}
 */
export async function fetchPushBroadcasts() {
    try {
        const { data, error } = await supabase
            .from('push_broadcasts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(30);

        if (error) {
            console.warn('[AdminService] push_broadcasts non disponible ou non migré:', error.message);
            return [];
        }
        return data || [];
    } catch {
        return [];
    }
}

/**
 * Récupère le nombre d'appareils et terminaux enregistrés pour recevoir les notifications.
 * @returns {Promise<{ total: number, sellers: number, buyers: number }>}
 */
export async function fetchPushSubscribersCount() {
    let globalCount = 0;
    let sellersCount = 0;
    let buyersCount = 0;

    try {
        const { data: globalSubs, error: globalErr } = await supabase
            .from('push_subscriptions')
            .select('role, endpoint');

        if (!globalErr && Array.isArray(globalSubs)) {
            globalCount = globalSubs.length;
            sellersCount = globalSubs.filter((s) => s.role === 'vendeur').length;
            buyersCount = globalSubs.filter((s) => s.role === 'acheteur' || s.role === 'visitor').length;
        }
    } catch {
        // Table push_subscriptions non migrée encore
    }

    // Compléter avec seller_push_subscriptions pour rétrocompatibilité
    try {
        const { count, error } = await supabase
            .from('seller_push_subscriptions')
            .select('id', { count: 'exact', head: true });

        if (!error && typeof count === 'number' && count > 0) {
            if (globalCount === 0) {
                globalCount = count;
                sellersCount = count;
            } else {
                sellersCount = Math.max(sellersCount, count);
                globalCount = Math.max(globalCount, sellersCount + buyersCount);
            }
        }
    } catch {
        // Table seller_push_subscriptions non accessible
    }

    return {
        total: globalCount,
        sellers: sellersCount,
        buyers: buyersCount,
    };
}

export default {
    ensureAdminSellerProfile,
    verifyAdminRole,
    loginAdmin,
    fetchGlobalMetrics,
    fetchPendingSellers,
    fetchActiveSellers,
    fetchAllProductsAdmin,
    fetchAllOrdersAdmin,
    fetchAllProfilesAdmin,
    approveSeller,
    rejectSeller,
    suspendSeller,
    revokeSeller,
    deleteSellerAccount,
    deleteProductAdmin,
    fetchDeliveryLocations,
    addDeliveryLocation,
    toggleDeliveryLocation,
    deleteDeliveryLocation,
    updateOrderStatusAdmin,
    updateUserRoleAdmin,
    grantSellerTrialExtension,
    manuallyActivateSubscription,
    adminResetSellerPassword,
    fetchPendingSubscriptionPayments,
    approveSubscriptionPayment,
    rejectSubscriptionPayment,
    DEFAULT_DELIVERY_LOCATIONS,
    fetchCarouselSlides,
    addCarouselSlide,
    updateCarouselSlide,
    toggleCarouselSlide,
    deleteCarouselSlide,
    fetchPartners,
    addPartner,
    updatePartner,
    togglePartner,
    deletePartner,
    uploadAdminMedia,
    broadcastPushNotification,
    fetchPushBroadcasts,
    fetchPushSubscribersCount,
};

