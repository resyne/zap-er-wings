-- Add sales_order_id to work_orders table
ALTER TABLE public.work_orders 
ADD COLUMN sales_order_id uuid REFERENCES public.sales_orders(id);

-- Add sales_order_id to service_work_orders table  
ALTER TABLE public.service_work_orders
ADD COLUMN sales_order_id uuid REFERENCES public.sales_orders(id);

-- Add index for better performance
CREATE INDEX idx_work_orders_sales_order_id ON public.work_orders(sales_order_id);
CREATE INDEX idx_service_work_orders_sales_order_id ON public.service_work_orders(sales_order_id);