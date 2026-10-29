-- ==============================================================================
-- Migration : Notifications Web Push Vendeurs (Écran de veille / Téléphone verrouillé)
-- Campus Market - Université Iba Der Thiam de Thiès (UIDT)
-- ==============================================================================

-- 1. Table de stockage des abonnements push des navigateurs marchands
CREATE TABLE IF NOT EXISTS public.seller_push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour recherche rapide par vendeur
CREATE INDEX IF NOT EXISTS idx_seller_push_seller_id ON public.seller_push_subscriptions(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_push_endpoint ON public.seller_push_subscriptions(endpoint);

-- 2. Activation de la sécurité au niveau des lignes (RLS)
ALTER TABLE public.seller_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 3. Politiques RLS
DROP POLICY IF EXISTS "Les vendeurs peuvent enregistrer leurs abonnements push" ON public.seller_push_subscriptions;
CREATE POLICY "Les vendeurs peuvent enregistrer leurs abonnements push"
ON public.seller_push_subscriptions FOR INSERT
TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "Les vendeurs peuvent mettre à jour leurs abonnements push" ON public.seller_push_subscriptions;
CREATE POLICY "Les vendeurs peuvent mettre à jour leurs abonnements push"
ON public.seller_push_subscriptions FOR UPDATE
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Les vendeurs peuvent supprimer leurs abonnements push" ON public.seller_push_subscriptions;
CREATE POLICY "Les vendeurs peuvent supprimer leurs abonnements push"
ON public.seller_push_subscriptions FOR DELETE
TO authenticated, anon
USING (true);

DROP POLICY IF EXISTS "Lecture des abonnements push pour envoi de notification" ON public.seller_push_subscriptions;
CREATE POLICY "Lecture des abonnements push pour envoi de notification"
ON public.seller_push_subscriptions FOR SELECT
TO authenticated, anon
USING (true);

COMMENT ON TABLE public.seller_push_subscriptions IS 'Stocke les clés de souscription Web Push (FCM Google / APNs Apple) des téléphones des marchands.';
