-- Add notes column to customer_invoices table
ALTER TABLE public.customer_invoices
ADD COLUMN IF NOT EXISTS notes TEXT;