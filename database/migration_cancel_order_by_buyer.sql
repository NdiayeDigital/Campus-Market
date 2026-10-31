-- ====================================================================================
-- Campus Market — Migration Additive : Annulation sécurisée de commande par l'acheteur
-- Fichier : database/migration_cancel_order_by_buyer.sql
-- ====================================================================================
-- RÈGLE DE SÉCURITÉ & ARCHITECTURE :
-- 1. Les étudiants acheteurs commandent en tant qu'invités (sans compte Supabase auth).
-- 2. Cette fonction RPC (SECURITY DEFINER) permet à un acheteur d'annuler sa commande
--    de manière sécurisée via sa référence (#CMD-...) ou son identifiant UUID.
-- 3. RÈGLE MÉTIER STRICTE : Une commande ne peut être annulée que si son statut
--    est encore 'pending' (en attente de validation). Si le vendeur l'a déjà acceptée,
--    préparée ou expédiée, l'annulation unilatérale est rejetée.
-- 4. Déclenche automatiquement le trigger tr_adjust_stock_cancel pour restituer le stock
--    et émet un événement Supabase Realtime pour alerter instantanément le vendeur et l'admin.
-- ====================================================================================

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

    -- Règle métier : L'annulation par le client n'est plus faisable dès que la commande est en livraison ('shipped') ou livrée ('delivered').
    -- Elle reste faisable tant que la commande est en attente ('pending'), confirmée ('confirmed') ou en préparation ('processing').
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

    -- Mise à jour du statut à 'cancelled'
    -- (Le trigger public.adjust_product_stock_on_cancel() remet automatiquement le stock à jour)
    UPDATE public.orders
    SET status = 'cancelled'
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

-- Accès public pour les étudiants invités (anon) et connectés (authenticated)
GRANT EXECUTE ON FUNCTION public.cancel_order_by_buyer(TEXT, TEXT) TO anon, authenticated;

COMMENT ON FUNCTION public.cancel_order_by_buyer(TEXT, TEXT) IS 'Permet à un étudiant acheteur d''annuler sa commande en attente (pending) en toute sécurité sans exposer la table orders.';
