-- ====================================================================================
-- SCRIPT DE CONFIGURATION : REALTIME & SÉCURITÉ DES COMMANDES
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase.
-- ====================================================================================

-- 1. CONTRAINTES DE VALIDATION
-- ------------------------------------------------------------------------------------
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS check_quantity_positive;
ALTER TABLE public.orders ADD CONSTRAINT check_quantity_positive CHECK (quantity > 0);

-- 2. SUPRESSION ET RE-CRÉATION DE LA POLITIQUE RLS SUR L'UPDATE DES COMMANDES
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Modification des statuts de commandes" ON public.orders;

CREATE POLICY "Modification des statuts de commandes" 
ON public.orders FOR UPDATE 
USING (
  auth.uid() = buyer_id OR auth.uid() = seller_id
)
WITH CHECK (
  -- Le vendeur peut modifier le statut sans restriction de statut d'origine
  (auth.uid() = seller_id) OR
  -- L'acheteur ne peut modifier le statut que pour annuler ('cancelled') et uniquement si l'ancien statut était 'pending'
  (
    auth.uid() = buyer_id AND 
    status = 'cancelled' AND 
    (SELECT o.status FROM public.orders o WHERE o.id = orders.id) = 'pending'
  )
);

-- 3. ACTIVATION DE SUPABASE REALTIME
-- ------------------------------------------------------------------------------------
-- Configurer la réplication de table pour envoyer toutes les modifications (requiert FULL)
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

-- Ajouter les tables à la publication Realtime de Supabase
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
  END IF;
END $$;
