-- Add new fields to invoice_registry for payment method, document linking, and cost/profit centers
ALTER TABLE public.invoice_registry
ADD COLUMN IF NOT EXISTS payment_method text,
ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.cost_centers(id),
ADD COLUMN IF NOT EXISTS profit_center_id uuid REFERENCES public.profit_centers(id),
ADD COLUMN IF NOT EXISTS cost_account_id uuid REFERENCES public.chart_of_accounts(id),
ADD COLUMN IF NOT EXISTS revenue_account_id uuid REFERENCES public.chart_of_accounts(id);

-- Add comment for clarity
COMMENT ON COLUMN public.invoice_registry.payment_method IS 'Payment method when invoice is paid (bonifico, contanti, carta, assegno, etc.)';
COMMENT ON COLUMN public.invoice_registry.cost_center_id IS 'Cost center for purchase invoices';
COMMENT ON COLUMN public.invoice_registry.profit_center_id IS 'Revenue center for sales invoices';
COMMENT ON COLUMN public.invoice_registry.cost_account_id IS 'Cost account from chart_of_accounts for purchase invoices';
COMMENT ON COLUMN public.invoice_registry.revenue_account_id IS 'Revenue account from chart_of_accounts for sales invoices';