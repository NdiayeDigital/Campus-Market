-- ====================================================================================
-- SCRIPT DE SÉCURISATION DES MISES À JOUR DES COMMANDES (TRIGGER & POLITIQUES)
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase.
-- ====================================================================================

-- 1. CRÉATION DU TRIGGER DE VALIDATION AVANT MISE À JOUR
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_order_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Empêcher la modification des colonnes sensibles sur la table orders
  IF (NEW.id IS DISTINCT FROM OLD.id) OR
     (NEW.buyer_id IS DISTINCT FROM OLD.buyer_id) OR
     (NEW.seller_id IS DISTINCT FROM OLD.seller_id) OR
     (NEW.product_id IS DISTINCT FROM OLD.product_id) OR
     (NEW.price IS DISTINCT FROM OLD.price) OR
     (NEW.quantity IS DISTINCT FROM OLD.quantity) OR
     (NEW.delivery_address IS DISTINCT FROM OLD.delivery_address) THEN
    RAISE EXCEPTION 'Modification de champs sensibles non autorisée. Seul le statut de la commande peut être mis à jour.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Suppression du trigger s'il existe déjà pour éviter les doublons
DROP TRIGGER IF EXISTS tr_validate_order_update ON public.orders;

-- Attacher le trigger BEFORE UPDATE
CREATE TRIGGER tr_validate_order_update
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_order_update();


-- 2. SIMPLIFICATION DE LA POLITIQUE RLS POUR LES MISES À JOUR
-- ------------------------------------------------------------------------------------
-- Suppression de l'ancienne politique
DROP POLICY IF EXISTS "Modification des statuts de commandes" ON public.orders;

-- Nouvelle politique RLS : Seul l'acheteur ou le vendeur lié peut initier la mise à jour (le trigger valide le reste)
CREATE POLICY "Modification des statuts de commandes" 
ON public.orders FOR UPDATE 
USING (
  auth.uid() = buyer_id OR 
  auth.uid() = seller_id OR
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
);
