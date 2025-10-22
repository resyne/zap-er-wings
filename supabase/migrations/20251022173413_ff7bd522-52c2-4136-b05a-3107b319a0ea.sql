-- Crea tabella per gli articoli delle offerte
CREATE TABLE IF NOT EXISTS public.offer_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID NOT NULL REFERENCES public.offers(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  total_price NUMERIC GENERATED ALWAYS AS (quantity * unit_price * (1 - COALESCE(discount_percent, 0) / 100)) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Abilita RLS
ALTER TABLE public.offer_items ENABLE ROW LEVEL SECURITY;

-- Policy per service role
CREATE POLICY "service_role_full_access_offer_items"
ON public.offer_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy per utenti autenticati - possono vedere tutti gli articoli delle offerte
CREATE POLICY "users_can_view_offer_items"
ON public.offer_items
FOR SELECT
TO authenticated
USING (has_minimum_role(auth.uid(), 'user'::app_role));

-- Policy per moderators - possono gestire tutti gli articoli
CREATE POLICY "moderators_can_manage_offer_items"
ON public.offer_items
FOR ALL
TO authenticated
USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

-- Crea trigger per aggiornare updated_at
CREATE TRIGGER update_offer_items_updated_at
BEFORE UPDATE ON public.offer_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Aggiungi commento alla tabella
COMMENT ON TABLE public.offer_items IS 'Articoli/prodotti associati alle offerte';