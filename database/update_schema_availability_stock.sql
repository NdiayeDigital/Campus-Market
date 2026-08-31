-- Ajout de la colonne is_open à la table profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT true;

-- Ajout de la colonne stock à la table products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT -1; -- -1 pour illimité
