-- ====================================================================================
-- Campus Market — Migration Additive : Traçabilité de l'initiateur d'annulation de commande
-- Fichier : database/migration_orders_cancelled_by.sql
-- ====================================================================================
-- RÈGLE MÉTIER & GAMIFICATION :
-- Seules les commandes expressément refusées ou annulées par le vendeur entraînent
-- une déduction de 5 points au classement. Les annulations initiées par les clients
-- (acheteurs) n'affectent aucunement le score du marchand.
-- ====================================================================================

-- 1. Ajout de la colonne cancelled_by sur la table public.orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS cancelled_by TEXT DEFAULT NULL 
CHECK (cancelled_by IN ('seller', 'buyer', 'admin'));

-- 2. Index pour filtrage et calcul rapide des scores
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_by ON public.orders(seller_id, status, cancelled_by);

COMMENT ON COLUMN public.orders.cancelled_by IS 'Indique l''initiateur de l''annulation de la commande (seller, buyer, admin) pour le calcul équitable des points de classement.';

-- 3. Mise à jour de la fonction RPC cancel_order_by_buyer pour marquer cancelled_by = 'buyer'
CREATE OR REPLACE FUNCTION public.cancel_order_by_buyer(
    p_reference_or_id TEXT,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_order RECORD;
    v_clean_ref TEXT;
    v_clean_phone TEXT;
BEGIN
    IF p_reference_or_id IS NULL OR TRIM(p_reference_or_id) = '' THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Référence ou identifiant de commande requis.'
        );
    END IF;

    v_clean_ref := TRIM(p_reference_or_id);
    v_clean_phone := REGEXP_REPLACE(COALESCE(p_phone, ''), '[^0-9]', '', 'g');

    -- Recherche de la commande par référence exacte ou UUID
    SELECT * INTO v_order
    FROM public.orders
    WHERE 
        (
            reference ILIKE v_clean_ref
            OR reference ILIKE ('%' || v_clean_ref)
            OR id::text ILIKE v_clean_ref
            OR ('#CMD-' || UPPER(SUBSTRING(id::text, 1, 6))) ILIKE v_clean_ref
        )
        AND (
            v_clean_phone = '' 
            OR REGEXP_REPLACE(COALESCE(buyer_phone, ''), '[^0-9]', '', 'g') LIKE ('%' || RIGHT(v_clean_phone, 9))
        )
    ORDER BY created_at DESC
    LIMIT 1;

    -- Commande introuvable
    IF v_order.id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Commande introuvable. Veuillez vérifier votre référence.'
        );
    END IF;

    -- Cas où la commande est déjà annulée
    IF v_order.status = 'cancelled' THEN
        RETURN jsonb_build_object(
            'success', true, 
            'message', 'Cette commande est déjà enregistrée comme annulée.', 
            'order_id', v_order.id,
            'reference', v_order.reference
        );
    END IF;

    -- L'annulation par le client n'est plus faisable si la commande est en livraison ou livrée
    IF v_order.status IN ('shipped', 'delivered') THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Cette commande ne peut plus être annulée car elle est déjà ' || 
                       CASE WHEN v_order.status = 'shipped' THEN 'en cours de livraison' ELSE 'livrée' END || 
                       '. Veuillez contacter directement le vendeur au ' || COALESCE(v_order.seller_phone, 'numéro du vendeur') || '.'
        );
    END IF;

    IF v_order.status NOT IN ('pending', 'confirmed', 'processing') THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', 'Cette commande ne peut pas être annulée dans son état actuel (' || v_order.status || ').'
        );
    END IF;

    -- Mise à jour du statut à 'cancelled' avec cancelled_by = 'buyer' (0 pénalité pour le vendeur)
    UPDATE public.orders
    SET status = 'cancelled',
        cancelled_by = 'buyer'
    WHERE id = v_order.id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Votre commande a été annulée avec succès.',
        'order_id', v_order.id, 
        'reference', v_order.reference,
        'seller_id', v_order.seller_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.cancel_order_by_buyer(TEXT, TEXT) TO anon, authenticated;
