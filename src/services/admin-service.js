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
            .select('id, role');

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

        // 3. Revenus Récurrents Réels : Cotisations récurrentes des abonnements vendeurs (2 000 FCFA/mois par boutique active)
        const SELLER_MONTHLY_SUBSCRIPTION_FEE = 2000;
        const totalSubscriptionRevenue = activeSellersCount * SELLER_MONTHLY_SUBSCRIPTION_FEE;

        return {
            activeSellersCount,
            pendingSellersCount,
            suspendedSellersCount,
            totalOrdersCount,
            totalDeliveredRevenue,
            totalSubscriptionRevenue,
            sellerMonthlyFee: SELLER_MONTHLY_SUBSCRIPTION_FEE,
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
            .select('*, product:product_id(title, image_url), seller:seller_id(prenom, nom, telephone)')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        return data || [];
    } catch (err) {
        console.error('[AdminService] Erreur fetchAllOrdersAdmin:', err);
        throw err;
    }
}

export const DEFAULT_DELIVERY_LOCATIONS = [
    { id: 'def-1', name: 'Pavillon A1', category: 'pavillon', is_active: true },
    { id: 'def-2', name: 'Pavillon A2', category: 'pavillon', is_active: true },
    { id: 'def-3', name: 'Pavillon A3', category: 'pavillon', is_active: true },
    { id: 'def-4', name: 'Pavillon A4', category: 'pavillon', is_active: true },
    { id: 'def-5', name: 'Pavillon B1', category: 'pavillon', is_active: true },
    { id: 'def-6', name: 'Pavillon B2', category: 'pavillon', is_active: true },
    { id: 'def-7', name: 'Pavillon C', category: 'pavillon', is_active: true },
    { id: 'def-8', name: 'Jardin Social', category: 'site', is_active: true },
    { id: 'def-9', name: 'Bibliothèque Universitaire (BU)', category: 'bu', is_active: true },
    { id: 'def-10', name: 'Salles de cours / Espaces communs', category: 'site', is_active: true },
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
};

