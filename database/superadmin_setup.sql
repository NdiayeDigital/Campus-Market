-- ====================================================================================
-- SCRIPT DE CONFIGURATION SÉCURISÉE DU SUPER ADMIN
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase.
-- ====================================================================================

-- 1. CRÉATION DES POLITIQUES DYNAMIQUES BASÉES SUR LE RÔLE DANS LA TABLE PROFILES
-- Ces politiques vérifient directement si le rôle de l'utilisateur connecté est 'superadmin'.
-- Cela évite de coder en dur une adresse e-mail spécifique et est beaucoup plus sécurisé.

-- Suppression des anciennes politiques si elles existent pour éviter les conflits
DROP POLICY IF EXISTS "Superadmin update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Superadmin view orders" ON public.orders;
DROP POLICY IF EXISTS "Superadmin delete products" ON public.products;
DROP POLICY IF EXISTS "Superadmin delete profiles" ON public.profiles;

-- a. Politique de mise à jour des profils par le Super Admin (ex: pour valider un vendeur)
CREATE POLICY "Superadmin update profiles" 
ON public.profiles FOR UPDATE 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
);

-- b. Politique permettant au Super Admin de voir toutes les commandes
CREATE POLICY "Superadmin view orders"
ON public.orders FOR SELECT
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
);

-- c. Politique permettant au Super Admin de supprimer des produits
CREATE POLICY "Superadmin delete products"
ON public.products FOR DELETE
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
);

-- d. Politique permettant au Super Admin de supprimer des profils étudiants
CREATE POLICY "Superadmin delete profiles" 
ON public.profiles FOR DELETE 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
);


-- 2. TRANSFORMATION DU COMPTE EN SUPER ADMIN
-- Remplacez 'maamin.ndiaye@univ-thies.sn' par l'adresse e-mail de l'administrateur si nécessaire.
-- L'utilisateur doit déjà être inscrit sur l'application avant d'exécuter cette commande.
UPDATE public.profiles 
SET role = 'superadmin' 
WHERE id = (SELECT id FROM auth.users WHERE email = 'maamin.ndiaye@univ-thies.sn');


-- ====================================================================================
-- OPTION ALTERNATIVE (RÉSERVOIR EMAIL CODÉ EN DUR) :
-- Si vous préférez l'ancienne approche basée strictement sur l'e-mail dans le JWT :
--
-- CREATE POLICY "Superadmin update profiles" 
-- ON public.profiles FOR UPDATE 
-- USING (auth.jwt() ->> 'email' = 'maamin.ndiaye@univ-thies.sn');
-- ====================================================================================
