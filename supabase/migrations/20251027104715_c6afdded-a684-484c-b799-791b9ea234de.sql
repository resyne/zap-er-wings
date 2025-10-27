-- Copy attachments from sales_orders to existing work_orders
UPDATE public.work_orders wo
SET attachments = so.attachments,
    updated_at = now()
FROM public.sales_orders so
WHERE wo.sales_order_id = so.id
  AND so.attachments IS NOT NULL
  AND jsonb_array_length(so.attachments) > 0
  AND (wo.attachments IS NULL OR jsonb_array_length(wo.attachments) = 0);

-- Copy attachments from sales_orders to existing service_work_orders
UPDATE public.service_work_orders swo
SET attachments = so.attachments,
    updated_at = now()
FROM public.sales_orders so
WHERE swo.sales_order_id = so.id
  AND so.attachments IS NOT NULL
  AND jsonb_array_length(so.attachments) > 0
  AND (swo.attachments IS NULL OR jsonb_array_length(swo.attachments) = 0);

-- Copy attachments from sales_orders to existing shipping_orders (if table exists)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'shipping_orders'
  ) THEN
    UPDATE public.shipping_orders sho
    SET attachments = so.attachments,
        updated_at = now()
    FROM public.sales_orders so
    WHERE sho.sales_order_id = so.id
      AND so.attachments IS NOT NULL
      AND jsonb_array_length(so.attachments) > 0
      AND (sho.attachments IS NULL OR jsonb_array_length(sho.attachments) = 0);
  END IF;
END $$;