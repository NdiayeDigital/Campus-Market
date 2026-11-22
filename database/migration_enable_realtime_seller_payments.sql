-- ==============================================================================
-- Migration : Activation de Supabase Realtime sur seller_payments
-- Permet aux SuperAdmins de recevoir en direct les demandes d'adhésion et de packs SasPay
-- Campus Market - Université Iba Der Thiam de Thiès (UIDT)
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'seller_payments'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.seller_payments;
    END IF;
END $$;

-- Commentaire de documentation
COMMENT ON TABLE public.seller_payments IS 'Historique des règlements de packs et adhésions SasPay avec synchronisation temps réel pour la modération SuperAdmin.';
