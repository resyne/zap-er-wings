-- Add is_picked field to shipping_order_items to track if item has been picked from warehouse
ALTER TABLE public.shipping_order_items 
ADD COLUMN IF NOT EXISTS is_picked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS picked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS picked_by UUID REFERENCES auth.users(id);

-- Create index for faster queries on is_picked status
CREATE INDEX IF NOT EXISTS idx_shipping_order_items_is_picked 
ON public.shipping_order_items(is_picked);

-- Create function to auto-update shipping order status when all items are picked
CREATE OR REPLACE FUNCTION public.update_shipping_order_status_on_pick()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if all items in the order are picked
  IF (SELECT COUNT(*) FROM public.shipping_order_items 
      WHERE shipping_order_id = NEW.shipping_order_id AND is_picked = false) = 0 THEN
    -- Update shipping order status to 'pronto' if all items are picked
    UPDATE public.shipping_orders 
    SET status = 'pronto',
        ready_date = NOW()
    WHERE id = NEW.shipping_order_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically update order status
DROP TRIGGER IF EXISTS trigger_update_shipping_order_status_on_pick ON public.shipping_order_items;
CREATE TRIGGER trigger_update_shipping_order_status_on_pick
  AFTER UPDATE OF is_picked ON public.shipping_order_items
  FOR EACH ROW
  WHEN (NEW.is_picked = true AND OLD.is_picked = false)
  EXECUTE FUNCTION public.update_shipping_order_status_on_pick();