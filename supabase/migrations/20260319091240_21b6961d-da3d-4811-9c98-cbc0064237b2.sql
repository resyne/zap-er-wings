ALTER TABLE public.scadenze ADD COLUMN IF NOT EXISTS fattura_id UUID REFERENCES public.invoice_registry(id) ON DELETE SET NULL;

-- Populate fattura_id for existing scadenze by looking up invoice_registry.scadenza_id
UPDATE public.scadenze s
SET fattura_id = ir.id
FROM public.invoice_registry ir
WHERE ir.scadenza_id = s.id
AND s.fattura_id IS NULL;