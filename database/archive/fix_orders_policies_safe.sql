ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS seller_phone TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'orders' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY "Les acheteurs créent des commandes" 
ON public.orders FOR INSERT 
WITH CHECK (
    (auth.uid() IS NOT NULL AND auth.uid() = buyer_id) OR 
    (buyer_id IS NULL)
);

CREATE POLICY "Confidentialité des commandes" 
ON public.orders FOR SELECT 
USING (
    auth.uid() = seller_id OR 
    (auth.uid() IS NOT NULL AND auth.uid() = buyer_id) OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'superadmin'
    )
);

CREATE POLICY "Modification des statuts de commandes" 
ON public.orders FOR UPDATE 
USING (
    (auth.uid() IS NOT NULL AND (auth.uid() = buyer_id OR auth.uid() = seller_id)) OR
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'superadmin'
    )
);

ALTER TABLE public.orders REPLICA IDENTITY FULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
END $$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'track_order_secure'
    ) THEN
        GRANT EXECUTE ON FUNCTION public.track_order_secure(TEXT, TEXT) TO anon, authenticated;
    END IF;
END $$;

NOTIFY pgrst, 'reload config';
