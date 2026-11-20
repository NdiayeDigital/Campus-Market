-- ====================================================================================
-- ROLLBACK : NOUVELLES OFFRES MARCHANDES & PROMOTIONS - CAMPUS MARKET UIDT
-- Rétablit l'état antérieur des triggers et fonctions.
-- ====================================================================================

-- 1. Suppression du trigger et de la fonction de contrôle des produits
DROP TRIGGER IF EXISTS trg_check_product_quota_before_insert ON public.products;
DROP FUNCTION IF EXISTS public.check_product_quota_before_insert();
DROP FUNCTION IF EXISTS public.mask_excess_products_for_sellers();

-- 2. Restauration de use_product_promotion() à la version antérieure
DROP FUNCTION IF EXISTS public.use_product_promotion(UUID);

-- 3. Restauration des colonnes (optionnel en prod pour préserver l'historique)
-- ALTER TABLE public.products DROP COLUMN IF EXISTS is_promoted;
-- ALTER TABLE public.products DROP COLUMN IF EXISTS promoted_until;
