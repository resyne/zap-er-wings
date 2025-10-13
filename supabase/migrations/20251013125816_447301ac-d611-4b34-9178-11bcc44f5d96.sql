-- Add order_source field to sales_orders table to track if it's for a sale or warranty
ALTER TABLE public.sales_orders 
ADD COLUMN order_source TEXT DEFAULT 'sale' CHECK (order_source IN ('sale', 'warranty'));

COMMENT ON COLUMN public.sales_orders.order_source IS 'Indicates if the order is for a sale or warranty';
