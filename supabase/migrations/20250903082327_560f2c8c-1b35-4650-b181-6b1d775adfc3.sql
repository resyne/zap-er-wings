-- Check if cost_centers table exists, if not create it
CREATE TABLE IF NOT EXISTS public.cost_centers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS if not already enabled
ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

-- Add account_code column to cost_centers if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='cost_centers' AND column_name='account_code') THEN
    ALTER TABLE public.cost_centers ADD COLUMN account_code TEXT;
  END IF;
END $$;

-- Add account_code column to profit_centers if it doesn't exist  
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profit_centers' AND column_name='account_code') THEN
    ALTER TABLE public.profit_centers ADD COLUMN account_code TEXT;
  END IF;
END $$;

-- Insert cost centers if they don't exist
INSERT INTO public.cost_centers (code, name, description, account_code) 
SELECT * FROM (VALUES 
  ('CC001', 'Produzione', 'Centro di costo per attività produttive', '02.01'),
  ('CC002', 'Installazioni', 'Centro di costo per installazioni', '02.02'),
  ('CC003', 'Service/Manutenzione', 'Centro di costo per service e manutenzione', '02.03'),
  ('CC004', 'Commerciale & Marketing', 'Centro di costo per attività commerciali', '03.20'),
  ('CC005', 'Amministrazione', 'Centro di costo per attività amministrative', '03.10')
) AS t(code, name, description, account_code)
WHERE NOT EXISTS (SELECT 1 FROM public.cost_centers WHERE cost_centers.code = t.code);

-- Update profit centers account codes
UPDATE public.profit_centers SET account_code = '01.01' WHERE code = 'PC001' AND account_code IS NULL;
UPDATE public.profit_centers SET account_code = '01.02' WHERE code = 'PC002' AND account_code IS NULL; 
UPDATE public.profit_centers SET account_code = '01.03' WHERE code = 'PC003' AND account_code IS NULL;