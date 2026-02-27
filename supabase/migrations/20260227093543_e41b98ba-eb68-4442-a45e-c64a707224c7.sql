
-- Add completion tracking to sales_order_items for commessa production checklist
ALTER TABLE public.sales_order_items 
ADD COLUMN IF NOT EXISTS is_completed boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;
