ALTER TABLE public.service_reports
ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_service_reports_archived ON public.service_reports(archived);