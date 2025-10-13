-- Add lead_id to service_work_orders if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'service_work_orders' 
    AND column_name = 'lead_id'
  ) THEN
    ALTER TABLE public.service_work_orders 
    ADD COLUMN lead_id UUID REFERENCES public.leads(id);
    
    CREATE INDEX IF NOT EXISTS idx_service_work_orders_lead_id 
    ON public.service_work_orders(lead_id);
  END IF;
END $$;