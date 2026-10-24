-- ====================================================================================
-- MIGRATION : AUTO-APPROBATION DES BOUTIQUES DÈS CONFIRMATION D'EMAIL (BREVO / OTP)
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase.
-- ====================================================================================

-- 1. Ajout sécurisé et idempotent des colonnes d'abonnement sur profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days');

-- 2. Fonction de transition automatique ultra-sécurisée et résiliente
CREATE OR REPLACE FUNCTION public.handle_seller_email_confirmed()
RETURNS TRIGGER AS $$
DECLARE
    trial_duration_days INTEGER := 7;
BEGIN
    -- Se déclenche dès que l'adresse email est confirmée (par code OTP ou lien Brevo)
    IF (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL) THEN
        
        BEGIN
            -- Si l'étudiant a sollicité l'ouverture d'une boutique vendeur
            IF (NEW.raw_user_meta_data->>'role' = 'vendeur_pending' OR EXISTS (
                SELECT 1 FROM public.profiles WHERE id = NEW.id AND role = 'vendeur_pending'
            )) THEN
                UPDATE public.profiles
                SET 
                    role = 'vendeur',
                    subscription_status = 'trial',
                    trial_started_at = NOW(),
                    trial_ends_at = NOW() + (trial_duration_days || ' days')::INTERVAL,
                    is_open = true,
                    updated_at = NOW()
                WHERE id = NEW.id AND role != 'superadmin';
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Empêche formellement tout blocage sur auth.users en cas d'anomalie
            RAISE WARNING 'handle_seller_email_confirmed warning: %', SQLERRM;
        END;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Attachement du trigger sur auth.users
DROP TRIGGER IF EXISTS tr_on_seller_email_confirmed ON auth.users;
CREATE TRIGGER tr_on_seller_email_confirmed
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_seller_email_confirmed();
