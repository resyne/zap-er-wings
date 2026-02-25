
-- Add deadline to sales_orders
ALTER TABLE public.sales_orders ADD COLUMN deadline date;

-- Add deadline to commesse
ALTER TABLE public.commesse ADD COLUMN deadline date;
