-- ====================================================================================
-- MIGRATION : PROTECTION ABSOLUE ET IMMUNITÉ ENTRE SUPERADMINS (CAMPUS MARKET)
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase.
-- ====================================================================================

-- 1. PROTECTION SUR LA SUPPRESSION (DELETE) :
-- Un superadmin ne peut plus JAMAIS supprimer un autre superadmin via l'application web.
-- Seul le gestionnaire de la base dans le SQL Editor peut supprimer un superadmin.
DROP POLICY IF EXISTS "Superadmin delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Superadmin delete non-admin profiles" ON public.profiles;

CREATE POLICY "Superadmin delete non-admin profiles" 
ON public.profiles FOR DELETE 
TO authenticated
USING (
    public.get_current_user_role(auth.uid()) = 'superadmin'
    AND role <> 'superadmin' -- 🔒 Impossible de supprimer un compte SuperAdmin depuis le web
);

-- 2. PROTECTION SUR LA MODIFICATION (UPDATE) :
-- Un superadmin ne peut ni rétrograder un autre superadmin, ni créer de nouveaux superadmins
-- depuis l'interface web (réservé exclusivement au SQL Editor).
DROP POLICY IF EXISTS "L'utilisateur peut modifier son role en pending" ON public.profiles;
DROP POLICY IF EXISTS "Mise à jour sécurisée des profils et rôles" ON public.profiles;

CREATE POLICY "Mise à jour sécurisée des profils et rôles" 
ON public.profiles FOR UPDATE 
TO authenticated
USING (
    auth.uid() = id OR 
    (public.get_current_user_role(auth.uid()) = 'superadmin' AND role <> 'superadmin')
) 
WITH CHECK (
    -- Un superadmin peut modifier les profils étudiants, mais ne peut pas toucher à un superadmin
    -- ni élever un compte au rang de superadmin via l'API client
    (public.get_current_user_role(auth.uid()) = 'superadmin' AND role <> 'superadmin') OR
    -- L'utilisateur standard modifiant ses propres informations
    (auth.uid() = id AND (
        role IN ('acheteur', 'vendeur_pending') OR
        (public.get_current_user_role(auth.uid()) = 'vendeur' AND role = 'vendeur')
    ))
);
