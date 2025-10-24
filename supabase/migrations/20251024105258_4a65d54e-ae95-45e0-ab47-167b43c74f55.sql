-- Add diameter and smoke_inlet columns to work_orders table
ALTER TABLE public.work_orders 
ADD COLUMN IF NOT EXISTS diameter text,
ADD COLUMN IF NOT EXISTS smoke_inlet text;