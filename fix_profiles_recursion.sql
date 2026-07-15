-- ====================================================================================
-- CORRECTIF DE SÉCURITÉ : RÉSOLUTION DE LA RÉCURSION INFINIE RLS (TABLE PROFILES)
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase.
-- ====================================================================================

-- 1. CRÉATION D'UNE FONCTION SECURITY DEFINER
-- Cette fonction permet de lire le rôle d'un utilisateur en contournant les RLS, 
-- ce qui évite la boucle de récursion infinie dans les politiques PostgreSQL.
CREATE OR REPLACE FUNCTION public.get_current_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = user_id;
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- 2. RECRÉATION DE LA POLITIQUE SELECT POUR LA TABLE PROFILES
DROP POLICY IF EXISTS "Profils visibles par les membres" ON public.profiles;

CREATE POLICY "Profils visibles par les membres" 
ON public.profiles FOR SELECT 
USING (
    auth.role() = 'authenticated' AND 
    (
        role = 'vendeur' OR 
        id = auth.uid() OR 
        public.get_current_user_role(auth.uid()) = 'superadmin'
    )
);


-- 3. RECRÉATION DE LA POLITIQUE UPDATE POUR LA TABLE ORDERS
-- Utilisation de la nouvelle fonction pour éviter tout effet de bord récursif
DROP POLICY IF EXISTS "Modification des statuts de commandes" ON public.orders;

CREATE POLICY "Modification des statuts de commandes" 
ON public.orders FOR UPDATE 
USING (
  auth.uid() = buyer_id OR 
  auth.uid() = seller_id OR
  public.get_current_user_role(auth.uid()) = 'superadmin'
);
