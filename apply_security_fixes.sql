-- ====================================================================================
-- CORRECTIFS DE SÉCURITÉ ET PROTECTION DES DONNÉES (AUDIT CYBERSÉCURITÉ)
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase.
-- ====================================================================================

-- 1. PROTECTION CONTRE LA MANIPULATION DE PRIX SUR LES COMMANDES
-- ------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.force_order_price()
RETURNS TRIGGER AS $$
DECLARE
  real_price NUMERIC;
BEGIN
  -- Aller chercher le prix officiel défini par le vendeur en base
  SELECT price INTO real_price FROM public.products WHERE id = NEW.product_id;
  IF real_price IS NULL THEN
    RAISE EXCEPTION 'Le produit spécifié n''existe pas.';
  END IF;
  
  -- Forcer le prix total (prix du produit * quantité)
  NEW.price := real_price * NEW.quantity;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Suppression du trigger s'il existe déjà pour éviter les doublons
DROP TRIGGER IF EXISTS tr_force_order_price ON public.orders;

-- Associer le trigger BEFORE INSERT
CREATE TRIGGER tr_force_order_price
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.force_order_price();


-- 2. RESTRICTION DE CRÉATION DE PRODUIT AUX VENDEURS VALIDES UNIQUEMENT
-- ------------------------------------------------------------------------------------
-- Suppression de l'ancienne politique
DROP POLICY IF EXISTS "Les vendeurs ajoutent leurs produits" ON public.products;

-- Nouvelle politique : Vérification du rôle dans profiles
CREATE POLICY "Les vendeurs ajoutent leurs produits" 
ON public.products FOR INSERT 
WITH CHECK (
    auth.uid() = seller_id AND 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'vendeur'
);


-- 3. SÉCURISATION CONTRE LE MOISSONNAGE DE DONNÉES (PROFILES)
-- ------------------------------------------------------------------------------------
-- Suppression de l'ancienne politique publique ouverte à tous
DROP POLICY IF EXISTS "Les profils sont visibles par tous" ON public.profiles;
DROP POLICY IF EXISTS "Profils visibles par les membres" ON public.profiles;

-- Règle : Seuls les membres authentifiés peuvent lire les profils de vendeurs ou leur propre profil
CREATE POLICY "Profils visibles par les membres" 
ON public.profiles FOR SELECT 
USING (
    auth.role() = 'authenticated' AND 
    (role = 'vendeur' OR id = auth.uid() OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin')
);


-- 4. RESTRICTION DE L'UPLOAD D'IMAGES AUX VENDEURS (STORAGE)
-- ------------------------------------------------------------------------------------
-- Suppression de l'ancienne politique qui permettait à tout utilisateur authentifié d'uploader
DROP POLICY IF EXISTS "Uploads authentifiés" ON storage.objects;

-- Nouvelle politique : Seuls les vendeurs et superadmins peuvent uploader des images
CREATE POLICY "Uploads réservés aux vendeurs" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'product-images' AND 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('vendeur', 'superadmin')
);
