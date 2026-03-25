-- Add "assegno_in_cassa" to the scadenze stato check constraint
ALTER TABLE public.scadenze DROP CONSTRAINT IF EXISTS scadenze_stato_check;
ALTER TABLE public.scadenze ADD CONSTRAINT scadenze_stato_check 
  CHECK (stato = ANY (ARRAY['aperta'::text, 'parziale'::text, 'chiusa'::text, 'saldata'::text, 'stornata'::text, 'assegno_in_cassa'::text]));
