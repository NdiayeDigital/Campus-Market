ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Catalogue public" ON public.products;
DROP POLICY IF EXISTS "Les vendeurs ajoutent leurs produits" ON public.products;
DROP POLICY IF EXISTS "Les vendeurs modifient leurs produits" ON public.products;
DROP POLICY IF EXISTS "Les vendeurs suppriment leurs produits" ON public.products;
DROP POLICY IF EXISTS "Superadmin delete products" ON public.products;

CREATE POLICY "Catalogue public" ON public.products FOR SELECT USING (true);

CREATE POLICY "Les vendeurs ajoutent leurs produits" ON public.products FOR INSERT TO authenticated WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Les vendeurs modifient leurs produits" ON public.products FOR UPDATE TO authenticated USING (auth.uid() = seller_id);

CREATE POLICY "Les vendeurs suppriment leurs produits" ON public.products FOR DELETE TO authenticated USING (auth.uid() = seller_id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'superadmin');

NOTIFY pgrst, 'reload config';
