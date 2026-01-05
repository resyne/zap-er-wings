-- Add archived column to ddts and service_reports tables
ALTER TABLE public.ddts ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
ALTER TABLE public.service_reports ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;