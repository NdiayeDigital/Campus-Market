-- Création de la table reviews
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(order_id)
);

-- Activation de RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Politiques RLS pour reviews
-- Tout le monde peut lire les reviews (pour calculer la note moyenne)
CREATE POLICY "Les reviews sont visibles par tous"
ON public.reviews FOR SELECT
USING (true);

-- Seul l'acheteur de la commande peut laisser un avis
CREATE POLICY "L'acheteur peut créer une review"
ON public.reviews FOR INSERT
WITH CHECK (
    auth.uid() = buyer_id AND 
    EXISTS (SELECT 1 FROM orders WHERE id = order_id AND buyer_id = auth.uid() AND status = 'delivered')
);
