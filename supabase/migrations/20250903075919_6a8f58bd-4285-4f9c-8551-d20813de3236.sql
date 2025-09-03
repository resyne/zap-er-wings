-- Remove the project_id column and add sales_order_id column to journal_entries
ALTER TABLE public.journal_entries 
DROP COLUMN IF EXISTS project_id;

ALTER TABLE public.journal_entries 
ADD COLUMN sales_order_id UUID REFERENCES public.sales_orders(id);