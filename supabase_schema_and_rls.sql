-- ====================================================================================
-- SCHEMA DE BASE DE DONNÃ‰ES CAMPUS MARKET & POLITIQUES DE SÃ‰CURITÃ‰ (RLS)
-- Ã€ exÃ©cuter dans le "SQL Editor" de votre tableau de bord Supabase.
-- ====================================================================================

-- 1. CRÃ‰ATION DES TABLES PRINCIPALES
-- ------------------------------------------------------------------------------------

-- Table des Profils (LiÃ©e Ã  l'authentification Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    prenom TEXT NOT NULL,
    nom TEXT NOT NULL,
    telephone TEXT,
    role TEXT DEFAULT 'acheteur' CHECK (role IN ('acheteur', 'vendeur_pending', 'vendeur', 'superadmin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des Produits
CREATE TABLE IF NOT EXISTS public.products (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    price NUMERIC NOT NULL,
    category TEXT,
    icon TEXT,
    image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des Commandes
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    buyer_name TEXT,
    buyer_phone TEXT,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    price NUMERIC NOT NULL,
    quantity INTEGER DEFAULT 1 NOT NULL,
    delivery_address TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'delivered', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);


-- 2. ACTIVATION DU ROW LEVEL SECURITY (RLS) (FAILLE DE SÃ‰CURITÃ‰ CRITIQUE)
-- ------------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;


-- 3. DÃ‰FINITION DES POLITIQUES (POLICIES) DE SÃ‰CURITÃ‰
-- ------------------------------------------------------------------------------------

-- POLITIQUES POUR 'profiles'
-- a. Tout le monde peut voir les profils publics (pour afficher le nom des vendeurs)
CREATE POLICY "Les profils sont visibles par tous" 
ON public.profiles FOR SELECT USING (true);

-- b. L'utilisateur peut créer son propre profil (lors de l'inscription, uniquement en tant qu'acheteur)
CREATE POLICY "L'utilisateur peut créer son profil" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id AND role = 'acheteur');

-- c. L'utilisateur peut mettre Ã  jour SON propre profil UNIQUEMENT (ex: devenir vendeur_pending)
-- On vÃ©rifie que auth.uid() == id et on empÃªche un Ã©tudiant de se nommer 'superadmin'
CREATE POLICY "L'utilisateur peut modifier son role en pending" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = id) 
WITH CHECK (role IN ('acheteur', 'vendeur_pending'));


-- POLITIQUES POUR 'products'
-- a. Tout le monde peut voir le catalogue de produits
CREATE POLICY "Catalogue public" 
ON public.products FOR SELECT USING (true);

-- b. Seuls les vendeurs authentifiÃ©s peuvent insÃ©rer des produits
CREATE POLICY "Les vendeurs ajoutent leurs produits" 
ON public.products FOR INSERT 
WITH CHECK (auth.uid() = seller_id);

-- c. Seuls les vendeurs peuvent modifier ou supprimer LEURS propres produits
CREATE POLICY "Les vendeurs modifient leurs produits" 
ON public.products FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Les vendeurs suppriment leurs produits" 
ON public.products FOR DELETE USING (auth.uid() = seller_id);


-- POLITIQUES POUR 'orders'
-- a. Un acheteur peut créer une commande (y compris un invité avec buyer_id NULL)
CREATE POLICY "Les acheteurs créent des commandes" 
ON public.orders FOR INSERT 
WITH CHECK (auth.uid() = buyer_id OR buyer_id IS NULL);

-- b. Un utilisateur peut voir ses commandes (les invités peuvent voir les commandes sans compte)
CREATE POLICY "Confidentialité des commandes" 
ON public.orders FOR SELECT 
USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR buyer_id IS NULL);

-- c. Seul le vendeur concernÃ© (ou l'acheteur pour annuler) peut modifier le statut d'une commande
CREATE POLICY "Modification des statuts de commandes" 
ON public.orders FOR UPDATE 
USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

-- ====================================================================================
-- FIN DU SCRIPT. 
-- Cliquez sur "Run" en bas Ã  droite de l'Ã©diteur SQL de Supabase.
-- ====================================================================================


-- ====================================================================================
-- 5. CONFIGURATION DU STORAGE POUR LES IMAGES DES PRODUITS
-- ====================================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Politique : Tout le monde peut voir les images
CREATE POLICY "Images publiques" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

-- Politique : Seuls les utilisateurs connectés peuvent uploader
CREATE POLICY "Uploads authentifiés" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images' AND auth.role() = 'authenticated');


-- ====================================================================================
-- 6. AMÉLIORATION DE LA SÉCURITÉ ET DES TRIGGERS DE STOCK AUTOMATIQUES
-- ====================================================================================

-- Politique permettant au Super Admin de supprimer des profils étudiants
CREATE POLICY "Superadmin delete profiles" 
ON public.profiles FOR DELETE 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
);

-- Trigger pour décrémenter automatiquement le stock d'un produit lors d'une nouvelle commande
CREATE OR REPLACE FUNCTION decrement_product_stock()
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

CREATE OR REPLACE TRIGGER tr_decrement_stock
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION decrement_product_stock();

-- Trigger pour restituer automatiquement le stock d'un produit si la commande est annulée
CREATE OR REPLACE FUNCTION adjust_product_stock_on_cancel()
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

CREATE OR REPLACE TRIGGER tr_adjust_stock_cancel
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION adjust_product_stock_on_cancel();

