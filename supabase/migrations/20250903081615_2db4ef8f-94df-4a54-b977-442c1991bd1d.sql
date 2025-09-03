-- Create cost_centers table (skip if exists)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'cost_centers') THEN
    CREATE TABLE public.cost_centers (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT,
      account_code TEXT,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      CONSTRAINT fk_cost_centers_account_code FOREIGN KEY (account_code) REFERENCES public.chart_of_accounts(code)
    );
    
    -- Add RLS policies for cost_centers
    ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can manage cost centers" 
    ON public.cost_centers 
    FOR ALL 
    USING (has_minimum_role(auth.uid(), 'user'::app_role));
    
    CREATE POLICY "Service role full access cost centers" 
    ON public.cost_centers 
    FOR ALL 
    USING (true)
    WITH CHECK (true);
    
    -- Create trigger for cost_centers updated_at
    CREATE TRIGGER update_cost_centers_updated_at
      BEFORE UPDATE ON public.cost_centers
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Add account_code column to existing profit_centers table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profit_centers' AND column_name='account_code') THEN
    ALTER TABLE public.profit_centers 
    ADD COLUMN account_code TEXT,
    ADD CONSTRAINT fk_profit_centers_account_code FOREIGN KEY (account_code) REFERENCES public.chart_of_accounts(code);
  END IF;
END $$;

-- Insert predefined cost centers if they don't exist
INSERT INTO public.cost_centers (code, name, description, account_code) 
SELECT * FROM (VALUES 
  ('CC001', 'Produzione', 'Centro di costo per attività produttive', '02.01'),
  ('CC002', 'Installazioni', 'Centro di costo per installazioni', '02.02'),
  ('CC003', 'Service/Manutenzione', 'Centro di costo per service e manutenzione', '02.03'),
  ('CC004', 'Commerciale & Marketing', 'Centro di costo per attività commerciali', '03.20'),
  ('CC005', 'Amministrazione', 'Centro di costo per attività amministrative', '03.10')
) AS t(code, name, description, account_code)
WHERE NOT EXISTS (SELECT 1 FROM public.cost_centers WHERE cost_centers.code = t.code);

-- Update existing profit centers to link to chart of accounts (only if account_code is null)
UPDATE public.profit_centers SET account_code = '01.01' WHERE code = 'PC001' AND account_code IS NULL;
UPDATE public.profit_centers SET account_code = '01.02' WHERE code = 'PC002' AND account_code IS NULL; 
UPDATE public.profit_centers SET account_code = '01.03' WHERE code = 'PC003' AND account_code IS NULL;