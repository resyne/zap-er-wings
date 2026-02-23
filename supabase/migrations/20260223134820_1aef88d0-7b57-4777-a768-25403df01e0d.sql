-- Add payment_status column to service_reports
ALTER TABLE public.service_reports 
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'non_pagato';

-- Add payment_date column
ALTER TABLE public.service_reports
ADD COLUMN IF NOT EXISTS payment_date date;

-- Add comment
COMMENT ON COLUMN public.service_reports.payment_status IS 'Payment status: non_pagato, pagato, parziale';
