
-- Table to save AI cost estimator conversations
CREATE TABLE public.ai_cost_estimates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  estimate_data JSONB,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_cost_estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all estimates" ON public.ai_cost_estimates FOR SELECT USING (true);
CREATE POLICY "Users can insert estimates" ON public.ai_cost_estimates FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own estimates" ON public.ai_cost_estimates FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Users can delete own estimates" ON public.ai_cost_estimates FOR DELETE USING (auth.uid() = created_by);

CREATE TRIGGER update_ai_cost_estimates_updated_at
  BEFORE UPDATE ON public.ai_cost_estimates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
