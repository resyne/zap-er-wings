-- Update existing work orders to link them to their corresponding sales orders
-- Based on customer and date matching
UPDATE public.work_orders wo
SET sales_order_id = so.id
FROM public.sales_orders so
WHERE wo.customer_id = so.customer_id 
  AND wo.sales_order_id IS NULL
  AND so.order_type IN ('odp', 'odpel')
  AND DATE(wo.created_at) = so.order_date;