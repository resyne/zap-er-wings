-- Fix foreign key constraint for shipping_orders to allow work_order deletion
ALTER TABLE public.shipping_orders 
DROP CONSTRAINT shipping_orders_work_order_id_fkey;

-- Recreate the constraint with CASCADE or SET NULL to allow deletion
ALTER TABLE public.shipping_orders 
ADD CONSTRAINT shipping_orders_work_order_id_fkey 
FOREIGN KEY (work_order_id) REFERENCES public.work_orders(id) ON DELETE SET NULL;