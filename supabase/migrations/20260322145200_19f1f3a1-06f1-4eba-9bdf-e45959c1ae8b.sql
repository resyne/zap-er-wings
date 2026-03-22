ALTER TABLE public.management_commesse 
  ADD COLUMN IF NOT EXISTS service_report_id uuid REFERENCES public.service_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_management_commesse_service_report_id ON public.management_commesse(service_report_id);
CREATE INDEX IF NOT EXISTS idx_management_commesse_commessa_id ON public.management_commesse(commessa_id);