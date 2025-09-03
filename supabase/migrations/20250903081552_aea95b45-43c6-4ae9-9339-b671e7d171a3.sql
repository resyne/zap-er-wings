-- Create cost_centers table
CREATE TABLE IF NOT EXISTS public.cost_centers (
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

-- Add account_code column to existing profit_centers table if it doesn't exist
ALTER TABLE public.profit_centers 
ADD COLUMN IF NOT EXISTS account_code TEXT,
ADD CONSTRAINT fk_profit_centers_account_code FOREIGN KEY (account_code) REFERENCES public.chart_of_accounts(code);

-- Create trigger for cost_centers updated_at
CREATE TRIGGER update_cost_centers_updated_at
  BEFORE UPDATE ON public.cost_centers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert predefined cost centers linked to chart of accounts
INSERT INTO public.cost_centers (code, name, description, account_code) VALUES 
('CC001', 'Produzione', 'Centro di costo per attività produttive', '02.01'),
('CC002', 'Installazioni', 'Centro di costo per installazioni', '02.02'),
('CC003', 'Service/Manutenzione', 'Centro di costo per service e manutenzione', '02.03'),
('CC004', 'Commerciale & Marketing', 'Centro di costo per attività commerciali', '03.20'),
('CC005', 'Amministrazione', 'Centro di costo per attività amministrative', '03.10');

-- Update existing profit centers to link to chart of accounts
UPDATE public.profit_centers SET account_code = '01.01' WHERE code = 'PC001';
UPDATE public.profit_centers SET account_code = '01.02' WHERE code = 'PC002'; 
UPDATE public.profit_centers SET account_code = '01.03' WHERE code = 'PC003';