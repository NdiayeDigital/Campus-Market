-- ==============================================================================
-- Migration : Ajout de la colonne whatsapp_phone à la table partners
-- Permet la prise de contact WhatsApp directe depuis Campus Market
-- Campus Market - Université Iba Der Thiam de Thiès (UIDT)
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'partners' 
          AND column_name = 'whatsapp_phone'
    ) THEN
        ALTER TABLE public.partners ADD COLUMN whatsapp_phone TEXT;
    END IF;
END $$;

-- Commentaire explicatif
COMMENT ON COLUMN public.partners.whatsapp_phone IS 'Numéro de téléphone WhatsApp direct pour la mise en relation avec le partenaire depuis la plateforme Campus Market.';
