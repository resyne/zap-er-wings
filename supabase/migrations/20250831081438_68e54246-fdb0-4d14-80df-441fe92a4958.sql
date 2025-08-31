-- Add public read access policies for purchase order confirmation flow

-- Allow public access to purchase_orders when accessed via valid confirmation token
CREATE POLICY "Public can view purchase orders via confirmation token" 
ON public.purchase_orders 
FOR SELECT 
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_order_confirmations poc
    WHERE poc.purchase_order_id = purchase_orders.id
    AND poc.confirmation_token IS NOT NULL
    AND poc.expires_at > now()
  )
);

-- Allow public access to purchase_order_items when accessed via valid confirmation token
CREATE POLICY "Public can view purchase order items via confirmation token" 
ON public.purchase_order_items 
FOR SELECT 
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_order_confirmations poc
    WHERE poc.purchase_order_id = purchase_order_items.purchase_order_id
    AND poc.confirmation_token IS NOT NULL
    AND poc.expires_at > now()
  )
);

-- Allow public access to suppliers when accessed via valid confirmation token
CREATE POLICY "Public can view suppliers via confirmation token" 
ON public.suppliers 
FOR SELECT 
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_orders po
    JOIN public.purchase_order_confirmations poc ON poc.purchase_order_id = po.id
    WHERE po.supplier_id = suppliers.id
    AND poc.confirmation_token IS NOT NULL
    AND poc.expires_at > now()
  )
);

-- Allow public access to materials when accessed via valid confirmation token
CREATE POLICY "Public can view materials via confirmation token" 
ON public.materials 
FOR SELECT 
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.purchase_order_items poi
    JOIN public.purchase_order_confirmations poc ON poc.purchase_order_id = poi.purchase_order_id
    WHERE poi.material_id = materials.id
    AND poc.confirmation_token IS NOT NULL
    AND poc.expires_at > now()
  )
);