-- Add attachments field to work_orders
ALTER TABLE public.work_orders 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Add attachments field to service_work_orders
ALTER TABLE public.service_work_orders 
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;

-- Add attachments field to shipping_orders if the table exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'shipping_orders'
  ) THEN
    ALTER TABLE public.shipping_orders 
    ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;