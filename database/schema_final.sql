-- ====================================================================================
-- CAMPUS MARKET — SCHÉMA DE BASE DE DONNÉES ET SÉCURITÉ CONSOLIDÉS (schema_final.sql)
-- Exécution dans le "SQL Editor" de Supabase
-- Script idempotent : peut être ré-exécuté en toute sécurité
-- ====================================================================================

-- 0. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ====================================================================================
-- 1. CRÉATION / MISE À NIVEAU DES TABLES
-- ====================================================================================

-- TABLE: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    prenom TEXT NOT NULL,
    nom TEXT NOT NULL,
    telephone TEXT,
    role TEXT DEFAULT 'acheteur' CHECK (role IN ('acheteur', 'vendeur_pending', 'vendeur', 'vendeur_desactive', 'superadmin')),
    is_open BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLE: products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    price NUMERIC NOT NULL,
    category TEXT,
    icon TEXT,
    color TEXT,
    image_url TEXT,
    stock INTEGER DEFAULT -1,
    old_price NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLE: orders
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    buyer_name TEXT,
    buyer_phone TEXT,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    price NUMERIC NOT NULL,
    quantity INTEGER DEFAULT 1 NOT NULL,
    delivery_address TEXT NOT NULL,
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'wave', 'om')),
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'delivered', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- TABLE: reviews
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- ====================================================================================
-- 2. ACTIVATION DU ROW LEVEL SECURITY (RLS)
-- ====================================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;


-- ====================================================================================
-- 3. FONCTIONS UTILITAIRES & SÉCURITÉ (SECURITY DEFINER)
-- ====================================================================================

-- Résolution de la récursion infinie sur profiles
CREATE OR REPLACE FUNCTION public.get_current_user_role(user_id UUID)
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role FROM public.profiles WHERE id = user_id;
    RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Sécurisation du calcul de prix réel d'une commande
CREATE OR REPLACE FUNCTION public.force_order_price()
RETURNS TRIGGER AS $$
DECLARE
    real_price NUMERIC;
BEGIN
    SELECT price INTO real_price FROM public.products WHERE id = NEW.product_id;
    IF real_price IS NULL THEN
        RAISE EXCEPTION 'Le produit spécifié n''existe pas.';
    END IF;
    
    NEW.price := real_price * NEW.quantity;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Protection contre la modification des champs immuables d'une commande
CREATE OR REPLACE FUNCTION public.validate_order_update()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.id IS DISTINCT FROM OLD.id) OR
       (NEW.buyer_id IS DISTINCT FROM OLD.buyer_id) OR
       (NEW.seller_id IS DISTINCT FROM OLD.seller_id) OR
       (NEW.product_id IS DISTINCT FROM OLD.product_id) OR
       (NEW.price IS DISTINCT FROM OLD.price) OR
       (NEW.quantity IS DISTINCT FROM OLD.quantity) OR
       (NEW.delivery_address IS DISTINCT FROM OLD.delivery_address) OR
       (NEW.payment_method IS DISTINCT FROM OLD.payment_method) THEN
        RAISE EXCEPTION 'Seul le statut de la commande ou du paiement peut être mis à jour.';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Décrémentation automatique du stock
CREATE OR REPLACE FUNCTION public.decrement_product_stock()
RETURNS TRIGGER AS $$
DECLARE
    prod_stock INTEGER;
BEGIN
    SELECT stock INTO prod_stock FROM public.products WHERE id = NEW.product_id;
    IF prod_stock IS NOT NULL AND prod_stock >= 0 THEN
        UPDATE public.products
        SET stock = GREATEST(0, stock - NEW.quantity)
        WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restitution du stock en cas d'annulation
CREATE OR REPLACE FUNCTION public.adjust_product_stock_on_cancel()
RETURNS TRIGGER AS $$
DECLARE
    prod_stock INTEGER;
BEGIN
    IF NEW.status = 'cancelled' AND OLD.status != 'cancelled' THEN
        SELECT stock INTO prod_stock FROM public.products WHERE id = NEW.product_id;
        IF prod_stock IS NOT NULL AND prod_stock >= 0 THEN
            UPDATE public.products
            SET stock = stock + NEW.quantity
            WHERE id = NEW.product_id;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ====================================================================================
-- 4. TRIGGERS
-- ====================================================================================

DROP TRIGGER IF EXISTS tr_force_order_price ON public.orders;
CREATE TRIGGER tr_force_order_price
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.force_order_price();

DROP TRIGGER IF EXISTS tr_validate_order_update ON public.orders;
CREATE TRIGGER tr_validate_order_update
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_order_update();

DROP TRIGGER IF EXISTS tr_decrement_stock ON public.orders;
CREATE TRIGGER tr_decrement_stock
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.decrement_product_stock();

DROP TRIGGER IF EXISTS tr_adjust_stock_cancel ON public.orders;
CREATE TRIGGER tr_adjust_stock_cancel
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.adjust_product_stock_on_cancel();


-- ====================================================================================
-- 5. POLITIQUES DE SÉCURITÉ RLS (IDEMPOTENTES)
-- ====================================================================================

-- ------------------------------------------------------------------------------------
-- A. POLITIQUES POUR 'profiles'
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Les profils sont visibles par tous" ON public.profiles;
DROP POLICY IF EXISTS "Profils visibles par les membres" ON public.profiles;
DROP POLICY IF EXISTS "L'utilisateur peut créer son profil" ON public.profiles;
DROP POLICY IF EXISTS "L'utilisateur peut modifier son role en pending" ON public.profiles;
DROP POLICY IF EXISTS "Superadmin delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Superadmin update profiles" ON public.profiles;

-- Lecture : profils de vendeurs visibles publiquement, les autres accessibles au propriétaire et superadmin
CREATE POLICY "Profils visibles par les membres" 
ON public.profiles FOR SELECT 
USING (
    role = 'vendeur' OR 
    id = auth.uid() OR 
    public.get_current_user_role(auth.uid()) = 'superadmin'
);

-- Insertion : Un utilisateur s'enregistre uniquement en acheteur ou vendeur_pending
CREATE POLICY "L'utilisateur peut créer son profil" 
ON public.profiles FOR INSERT 
WITH CHECK (
    auth.uid() = id AND 
    role IN ('acheteur', 'vendeur_pending')
);

-- Mise à jour : L'utilisateur ne peut demander que le statut vendeur_pending (pas vendeur direct)
CREATE POLICY "L'utilisateur peut modifier son role en pending" 
ON public.profiles FOR UPDATE 
USING (
    auth.uid() = id OR 
    public.get_current_user_role(auth.uid()) = 'superadmin'
) 
WITH CHECK (
    public.get_current_user_role(auth.uid()) = 'superadmin' OR
    (auth.uid() = id AND role IN ('acheteur', 'vendeur_pending'))
);

-- Suppression : Réservée au Super Admin
CREATE POLICY "Superadmin delete profiles" 
ON public.profiles FOR DELETE 
USING (public.get_current_user_role(auth.uid()) = 'superadmin');


-- ------------------------------------------------------------------------------------
-- B. POLITIQUES POUR 'products'
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Catalogue public" ON public.products;
DROP POLICY IF EXISTS "Les vendeurs ajoutent leurs produits" ON public.products;
DROP POLICY IF EXISTS "Les vendeurs modifient leurs produits" ON public.products;
DROP POLICY IF EXISTS "Les vendeurs suppriment leurs produits" ON public.products;

-- Lecture : Tout le monde (invités compris) peut voir le catalogue
CREATE POLICY "Catalogue public" 
ON public.products FOR SELECT 
USING (true);

-- Insertion : STRICTEMENT réservée aux vendeurs validés (rôle = 'vendeur')
CREATE POLICY "Les vendeurs ajoutent leurs produits" 
ON public.products FOR INSERT 
WITH CHECK (
    auth.uid() = seller_id AND 
    public.get_current_user_role(auth.uid()) = 'vendeur'
);

-- Mise à jour : Un vendeur validé modifie ses propres produits (ou le superadmin)
CREATE POLICY "Les vendeurs modifient leurs produits" 
ON public.products FOR UPDATE 
USING (
    (auth.uid() = seller_id AND public.get_current_user_role(auth.uid()) = 'vendeur') OR
    public.get_current_user_role(auth.uid()) = 'superadmin'
);

-- Suppression : Un vendeur ou le superadmin peut supprimer
CREATE POLICY "Les vendeurs suppriment leurs produits" 
ON public.products FOR DELETE 
USING (
    (auth.uid() = seller_id AND public.get_current_user_role(auth.uid()) = 'vendeur') OR
    public.get_current_user_role(auth.uid()) = 'superadmin'
);


-- ------------------------------------------------------------------------------------
-- C. POLITIQUES POUR 'orders'
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Les acheteurs créent des commandes" ON public.orders;
DROP POLICY IF EXISTS "Confidentialité des commandes" ON public.orders;
DROP POLICY IF EXISTS "Modification des statuts de commandes" ON public.orders;

-- Insertion : Tout acheteur (connecté ou invité buyer_id NULL)
CREATE POLICY "Les acheteurs créent des commandes" 
ON public.orders FOR INSERT 
WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = buyer_id) OR 
    (buyer_id IS NULL)
);

-- Lecture :
-- 1. Le vendeur concerné
-- 2. L'acheteur connecté propriétaire de la commande
-- 3. Le superadmin
-- 4. Pour un invité (buyer_id NULL), l'accès se fait via requête ciblée par ID de commande
CREATE POLICY "Confidentialité des commandes" 
ON public.orders FOR SELECT 
USING (
    auth.uid() = seller_id OR 
    (auth.uid() IS NOT NULL AND auth.uid() = buyer_id) OR
    public.get_current_user_role(auth.uid()) = 'superadmin' OR
    buyer_id IS NULL
);

-- Mise à jour : Vendeur concerné, acheteur (pour annulation/réception), ou superadmin
CREATE POLICY "Modification des statuts de commandes" 
ON public.orders FOR UPDATE 
USING (
    (auth.uid() IS NOT NULL AND (auth.uid() = buyer_id OR auth.uid() = seller_id)) OR
    public.get_current_user_role(auth.uid()) = 'superadmin'
);


-- ------------------------------------------------------------------------------------
-- D. POLITIQUES POUR 'reviews'
-- ------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Avis visibles par tous" ON public.reviews;
DROP POLICY IF EXISTS "Ajout d'avis authentifié" ON public.reviews;

CREATE POLICY "Avis visibles par tous" 
ON public.reviews FOR SELECT 
USING (true);

CREATE POLICY "Ajout d'avis authentifié" 
ON public.reviews FOR INSERT 
WITH CHECK (auth.uid() = buyer_id);


-- ====================================================================================
-- 6. CONFIGURATION DU STORAGE & BUCKET PRODUITS
-- ====================================================================================
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Images publiques" ON storage.objects;
DROP POLICY IF EXISTS "Uploads authentifiés" ON storage.objects;
DROP POLICY IF EXISTS "Uploads réservés aux vendeurs" ON storage.objects;

-- Lecture publique des images
CREATE POLICY "Images publiques" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'product-images');

-- Upload strictement réservé aux profils avec rôle 'vendeur' ou 'superadmin'
CREATE POLICY "Uploads réservés aux vendeurs" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'product-images' AND 
    public.get_current_user_role(auth.uid()) IN ('vendeur', 'superadmin')
);
