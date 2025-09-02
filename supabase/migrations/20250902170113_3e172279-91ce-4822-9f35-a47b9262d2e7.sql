-- Update existing sales orders to use OdV prefix instead of SO
UPDATE public.sales_orders 
SET number = REPLACE(number, 'SO-', 'OdV-')
WHERE number LIKE 'SO-%';