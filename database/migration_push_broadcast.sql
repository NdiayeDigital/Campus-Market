-- ==============================================================================
-- Migration : Diffusion de Notifications Push Platform-Wide (SuperAdmin)
-- Campus Market - Université Iba Der Thiam de Thiès (UIDT)
-- ==============================================================================

-- 1. Table globale de stockage des abonnements push pour tous les terminaux (étudiants, acheteurs, vendeurs, visiteurs)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    role TEXT DEFAULT 'visitor' CHECK (role IN ('acheteur', 'vendeur', 'visitor', 'superadmin')),
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour recherche rapide et déduplication
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_role ON public.push_subscriptions(role);
CREATE INDEX IF NOT EXISTS idx_push_subs_endpoint ON public.push_subscriptions(endpoint);

-- 2. Activation de la sécurité au niveau des lignes (RLS) pour push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Politiques RLS permettant l'enregistrement d'abonnements par tout visiteur ou utilisateur connecté
DROP POLICY IF EXISTS "Enregistrement public des abonnements push" ON public.push_subscriptions;
CREATE POLICY "Enregistrement public des abonnements push"
ON public.push_subscriptions FOR INSERT
TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Mise à jour des abonnements push" ON public.push_subscriptions;
CREATE POLICY "Mise à jour des abonnements push"
ON public.push_subscriptions FOR UPDATE
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Suppression des abonnements push" ON public.push_subscriptions;
CREATE POLICY "Suppression des abonnements push"
ON public.push_subscriptions FOR DELETE
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Lecture des abonnements push" ON public.push_subscriptions;
CREATE POLICY "Lecture des abonnements push"
ON public.push_subscriptions FOR SELECT
TO authenticated, anon
USING (true);

-- 3. Table de l'historique des campagnes de diffusion push envoyées par les SuperAdmins
CREATE TABLE IF NOT EXISTS public.push_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    url TEXT DEFAULT '/',
    target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'sellers', 'buyers')),
    sent_count INT DEFAULT 0,
    failure_count INT DEFAULT 0,
    cleaned_stale_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_broadcasts_created_at ON public.push_broadcasts(created_at DESC);

-- 4. Activation RLS pour push_broadcasts (Accessible uniquement aux SuperAdmins)
ALTER TABLE public.push_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SuperAdmin peut lire l'historique des diffusions" ON public.push_broadcasts;
CREATE POLICY "SuperAdmin peut lire l'historique des diffusions"
ON public.push_broadcasts FOR SELECT
TO authenticated
USING (
    COALESCE(
        (SELECT role FROM public.profiles WHERE id = auth.uid()),
        ''
    ) = 'superadmin'
);

DROP POLICY IF EXISTS "SuperAdmin peut enregistrer une diffusion" ON public.push_broadcasts;
CREATE POLICY "SuperAdmin peut enregistrer une diffusion"
ON public.push_broadcasts FOR INSERT
TO authenticated
WITH CHECK (
    COALESCE(
        (SELECT role FROM public.profiles WHERE id = auth.uid()),
        ''
    ) = 'superadmin'
);

COMMENT ON TABLE public.push_subscriptions IS 'Stocke les souscriptions Web Push actives de tous les appareils (étudiants et marchands) de Campus Market.';
COMMENT ON TABLE public.push_broadcasts IS 'Historique des notifications push diffusées à la communauté par les SuperAdmins.';
