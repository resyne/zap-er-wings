
ALTER TABLE public.service_reports 
  ADD COLUMN is_warranty BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_maintenance_contract BOOLEAN NOT NULL DEFAULT false;
