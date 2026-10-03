-- ====================================================================================
-- CAMPUS MARKET — MIGRATION DE PRODUCTION V2 (migration_production_v2.sql)
-- Script idempotent à exécuter dans le "SQL Editor" de votre tableau de bord Supabase
-- Résout les failles RLS, ajoute le statut 'shipped', la gestion des références,
-- le trigger d'inscription automatique et la fonction RPC de suivi sécurisé.
-- ====================================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================================
-- 2. MISE À JOUR DES COLONNES DES TABLES EXISTANTES
-- ====================================================================================

-- A. Table products : ajout de la colonne description
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS description TEXT;

-- B. Table orders : ajout des colonnes de traçabilité, frais et contact vendeur
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS reference TEXT;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS seller_name TEXT;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS seller_phone TEXT;

-- Index pour recherche rapide par référence de commande
CREATE INDEX IF NOT EXISTS idx_orders_reference ON public.orders(reference);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON public.orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_phone ON public.orders(buyer_phone);

-- ====================================================================================
-- 3. MISE À JOUR DE LA CONTRAINTE DE STATUT ('shipped' INCLUS)
-- ====================================================================================

ALTER TABLE public.orders 
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'));

-- ====================================================================================
-- 4. FONCTION RPC DE SUIVI SÉCURISÉ (INVITÉS & SANS COMPTE)
-- Permet à un étudiant de suivre sa commande en temps réel via référence et téléphone
-- SANS exposer la table orders aux requêtes publiques
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.track_order_secure(p_reference TEXT, p_phone TEXT DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    reference TEXT,
    buyer_name TEXT,
    buyer_phone TEXT,
    delivery_address TEXT,
    status TEXT,
    price NUMERIC,
    quantity INTEGER,
    delivery_fee NUMERIC,
    payment_method TEXT,
    payment_status TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    product_id UUID,
    product_title TEXT,
    product_image TEXT,
    seller_id UUID,
    seller_name TEXT,
    seller_phone TEXT
) AS $$
DECLARE
    clean_phone TEXT;
    clean_ref TEXT;
BEGIN
    clean_ref := TRIM(p_reference);
    clean_phone := REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');

    RETURN QUERY
    SELECT 
        o.id,
        o.reference,
        o.buyer_name,
        o.buyer_phone,
        o.delivery_address,
        o.status,
        o.price,
        o.quantity,
        o.delivery_fee,
        o.payment_method,
        o.payment_status,
        o.created_at,
        p.id AS product_id,
        COALESCE(p.title, 'Article Campus Market') AS product_title,
        p.image_url AS product_image,
        o.seller_id,
        COALESCE(o.seller_name, (prof.prenom || ' ' || prof.nom)) AS seller_name,
        COALESCE(o.seller_phone, prof.telephone) AS seller_phone
    FROM public.orders o
    LEFT JOIN public.products p ON p.id = o.product_id
    LEFT JOIN public.profiles prof ON prof.id = o.seller_id
    WHERE 
        -- Recherche par référence exacte (#CM-XXXX ou UUID)
        (
            o.reference ILIKE clean_ref 
            OR o.id::text ILIKE clean_ref
            OR ('#CMD-' || UPPER(SUBSTRING(o.id::text, 1, 6))) ILIKE clean_ref
        )
        -- Si téléphone fourni, vérification supplémentaire de correspondance
        AND (
            clean_phone = '' 
            OR REGEXP_REPLACE(COALESCE(o.buyer_phone, ''), '[^0-9]', '', 'g') LIKE ('%' || RIGHT(clean_phone, 9))
        )
    ORDER BY o.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.track_order_secure(TEXT, TEXT) TO anon, authenticated;

-- ====================================================================================
-- 5. TRIGGER D'INSCRIPTION AUTOMATIQUE DU PROFIL (auth.users -> profiles)
-- Résout les échecs de création de compte vendeur et acheteur
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_role TEXT;
BEGIN
    -- Protection contre l'élévation de privilèges :
    -- Seul 'vendeur_pending' ou 'acheteur' peut être assigné à l'inscription.
    -- Les rôles 'superadmin' et 'vendeur' exigent une approbation préalable.
    IF NEW.raw_user_meta_data->>'role' = 'vendeur_pending' THEN
        assigned_role := 'vendeur_pending';
    ELSE
        assigned_role := 'acheteur';
    END IF;

    INSERT INTO public.profiles (id, prenom, nom, telephone, role, is_open)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'prenom', 'Étudiant'),
        COALESCE(NEW.raw_user_meta_data->>'nom', 'UIDT'),
        COALESCE(NEW.raw_user_meta_data->>'telephone', ''),
        assigned_role,
        true
    )
    ON CONFLICT (id) DO UPDATE 
    SET 
        prenom = EXCLUDED.prenom,
        nom = EXCLUDED.nom,
        telephone = CASE WHEN EXCLUDED.telephone <> '' THEN EXCLUDED.telephone ELSE public.profiles.telephone END,
        role = CASE 
            WHEN public.profiles.role = 'superadmin' THEN 'superadmin'
            WHEN public.profiles.role = 'vendeur' THEN 'vendeur'
            ELSE assigned_role 
        END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================================
-- 6. TRIGGER DE SÉCURITÉ DE CALCUL DE PRIX RÉEL & FRAIS DE LIVRAISON
-- ====================================================================================

CREATE OR REPLACE FUNCTION public.force_order_price()
RETURNS TRIGGER AS $$
DECLARE
    real_price NUMERIC;
BEGIN
    SELECT price INTO real_price FROM public.products WHERE id = NEW.product_id;
    IF real_price IS NULL THEN
        RAISE EXCEPTION 'Le produit spécifié n''existe pas.';
    END IF;
    
    NEW.price := (real_price * NEW.quantity) + COALESCE(NEW.delivery_fee, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_force_order_price ON public.orders;
CREATE TRIGGER tr_force_order_price
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.force_order_price();

-- ====================================================================================
-- 7. CORRECTION STRICTE DES POLITIQUES RLS (FERMETURE DE LA FUITE DE DONNÉES)
-- ====================================================================================

-- A. Table profiles
DROP POLICY IF EXISTS "Profils visibles par les membres" ON public.profiles;
DROP POLICY IF EXISTS "Les profils sont visibles par tous" ON public.profiles;

CREATE POLICY "Profils visibles par les membres" 
ON public.profiles FOR SELECT 
USING (
    role IN ('vendeur', 'vendeur_desactive') OR 
    id = auth.uid() OR 
    public.get_current_user_role(auth.uid()) = 'superadmin'
);

-- B. Table orders : SUPPRESSION DÉFINITIVE DE "OR buyer_id IS NULL" SUR SELECT
DROP POLICY IF EXISTS "Confidentialité des commandes" ON public.orders;

CREATE POLICY "Confidentialité des commandes" 
ON public.orders FOR SELECT 
USING (
    auth.uid() = seller_id OR 
    (auth.uid() IS NOT NULL AND auth.uid() = buyer_id) OR
    public.get_current_user_role(auth.uid()) = 'superadmin'
);

-- C. Table orders : Modification de statut
DROP POLICY IF EXISTS "Modification des statuts de commandes" ON public.orders;

CREATE POLICY "Modification des statuts de commandes" 
ON public.orders FOR UPDATE 
USING (
    auth.uid() = seller_id OR 
    (auth.uid() IS NOT NULL AND auth.uid() = buyer_id) OR
    public.get_current_user_role(auth.uid()) = 'superadmin'
);

-- D. Table reviews : Notation ouverte aux acheteurs
DROP POLICY IF EXISTS "Avis visibles par tous" ON public.reviews;
DROP POLICY IF EXISTS "Ajout d'avis authentifié" ON public.reviews;
DROP POLICY IF EXISTS "Ajout d'avis" ON public.reviews;

CREATE POLICY "Avis visibles par tous" 
ON public.reviews FOR SELECT 
USING (true);

CREATE POLICY "Ajout d'avis" 
ON public.reviews FOR INSERT 
WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = buyer_id) OR 
    (buyer_id IS NULL)
);

-- ====================================================================================
-- 8. PUBLICATION REALTIME COMPLÈTE
-- ====================================================================================
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.profiles REPLICA IDENTITY FULL;

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
    WHERE pubname = 'supabase_realtime' AND tablename = 'products'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  END IF;
END $$;
