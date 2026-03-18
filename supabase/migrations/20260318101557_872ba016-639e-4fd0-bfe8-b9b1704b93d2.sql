
-- One-time retroactive fix: mark sales_orders as 'completato' where all commesse are already completed
UPDATE public.sales_orders so
SET status = 'completato', updated_at = now()
WHERE so.status NOT IN ('completato', 'annullato')
AND (
  SELECT COUNT(*) FROM public.commesse c WHERE c.sales_order_id = so.id
) > 0
AND (
  SELECT COUNT(*) FROM public.commesse c WHERE c.sales_order_id = so.id
) = (
  SELECT COUNT(*) FROM public.commesse c WHERE c.sales_order_id = so.id AND c.status IN ('completata', 'archiviata')
);
