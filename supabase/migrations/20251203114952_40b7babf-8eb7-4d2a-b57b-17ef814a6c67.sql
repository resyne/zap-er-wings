-- Add public read policy for work_orders (for public riepilogo operativo page)
CREATE POLICY "Public can view work orders for riepilogo operativo"
ON public.work_orders
FOR SELECT
USING (true);

-- Add public read policy for service_work_orders (for public riepilogo operativo page)
CREATE POLICY "Public can view service work orders for riepilogo operativo"
ON public.service_work_orders
FOR SELECT
USING (true);

-- Add public read policy for leads (needed for customer names)
CREATE POLICY "Public can view leads for riepilogo operativo"
ON public.leads
FOR SELECT
USING (true);

-- Add public read policy for sales_order_items (needed for articles)
CREATE POLICY "Public can view sales order items for riepilogo operativo"
ON public.sales_order_items
FOR SELECT
USING (true);