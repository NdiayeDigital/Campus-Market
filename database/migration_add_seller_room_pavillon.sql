-- ====================================================================================
-- Campus Market — Migration Additive : Pavillon et Chambre de Résidence Vendeur
-- Fichier : database/migration_add_seller_room_pavillon.sql
-- ====================================================================================
-- Permet aux marchands de renseigner leur pavillon et leur numéro de chambre
-- au sein du campus de l'UIDT (nécessaire pour la traçabilité des livraisons et la règle FR-05).
-- Script purement additif et idempotent.
-- ====================================================================================

-- 1. Ajout des colonnes pavillon et chambre dans public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pavillon TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chambre TEXT;

-- 2. Commentaires descriptifs
COMMENT ON COLUMN public.profiles.pavillon IS 'Pavillon de résidence UIDT du vendeur (ex: Pavillon A, Pavillon B, 1000 lits, etc.)';
COMMENT ON COLUMN public.profiles.chambre IS 'Numéro de chambre de résidence UIDT du vendeur';

-- 3. Mise à jour automatique des politiques RLS (déjà gérées par le propriétaire de la ligne)
-- Tout vendeur authentifié peut mettre à jour ses propres colonnes pavillon et chambre.
