-- Add relationship between service work orders and production work orders
ALTER TABLE public.service_work_orders 
ADD COLUMN production_work_order_id UUID REFERENCES public.work_orders(id);