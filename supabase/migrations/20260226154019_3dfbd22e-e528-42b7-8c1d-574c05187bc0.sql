
-- Activity log for purchase orders
CREATE TABLE public.purchase_order_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_order_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'created', 'confirmed', 'status_changed', 'edited', 'email_sent', 'whatsapp_sent', 'items_modified', 'delivery_confirmed'
  description TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  metadata JSONB,
  performed_by TEXT, -- user id or 'supplier' or 'system'
  performer_label TEXT, -- display name
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_order_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_can_view_po_logs"
ON public.purchase_order_logs FOR SELECT
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "users_can_insert_po_logs"
ON public.purchase_order_logs FOR INSERT
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

-- Allow service role and anon (for supplier portal) to insert logs
CREATE POLICY "anon_can_insert_po_logs"
ON public.purchase_order_logs FOR INSERT
WITH CHECK (true);

CREATE INDEX idx_po_logs_order_id ON public.purchase_order_logs(purchase_order_id);
CREATE INDEX idx_po_logs_created_at ON public.purchase_order_logs(created_at DESC);
