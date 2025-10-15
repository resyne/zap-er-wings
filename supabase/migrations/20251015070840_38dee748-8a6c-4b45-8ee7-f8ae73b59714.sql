-- Add billing fields to service_reports table
ALTER TABLE public.service_reports 
ADD COLUMN amount NUMERIC(10,2),
ADD COLUMN vat_rate NUMERIC(4,2) DEFAULT 22.00,
ADD COLUMN total_amount NUMERIC(10,2);