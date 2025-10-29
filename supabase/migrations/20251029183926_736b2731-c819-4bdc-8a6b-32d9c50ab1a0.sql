-- Add foreign key from shipping_order_items.picked_by to profiles
ALTER TABLE public.shipping_order_items
DROP CONSTRAINT IF EXISTS shipping_order_items_picked_by_fkey;

ALTER TABLE public.shipping_order_items
ADD CONSTRAINT shipping_order_items_picked_by_fkey
FOREIGN KEY (picked_by) 
REFERENCES public.profiles(id)
ON DELETE SET NULL;