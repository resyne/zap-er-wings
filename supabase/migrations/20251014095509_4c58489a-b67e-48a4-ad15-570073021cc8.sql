-- Create table for work order accessories
CREATE TABLE IF NOT EXISTS public.work_order_accessories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  bom_id UUID NOT NULL REFERENCES public.boms(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_order_accessories ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "service_role_full_access_work_order_accessories"
  ON public.work_order_accessories
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "moderators_can_manage_work_order_accessories"
  ON public.work_order_accessories
  FOR ALL
  USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
  WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "users_can_view_work_order_accessories"
  ON public.work_order_accessories
  FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_work_order_accessories_updated_at
  BEFORE UPDATE ON public.work_order_accessories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for performance
CREATE INDEX idx_work_order_accessories_work_order_id ON public.work_order_accessories(work_order_id);
CREATE INDEX idx_work_order_accessories_bom_id ON public.work_order_accessories(bom_id);