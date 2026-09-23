ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('acheteur', 'vendeur_pending', 'vendeur', 'vendeur_desactive', 'suspendu', 'superadmin'));

NOTIFY pgrst, 'reload config';
