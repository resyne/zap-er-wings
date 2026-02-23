
-- Create table for structured material line items on service reports
CREATE TABLE public.service_report_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.service_reports(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  vat_rate NUMERIC DEFAULT 22,
  total NUMERIC GENERATED ALWAYS AS (quantity * unit_price) STORED,
  total_with_vat NUMERIC GENERATED ALWAYS AS (quantity * unit_price * (1 + vat_rate / 100)) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_report_materials ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (same as service_reports pattern)
CREATE POLICY "Authenticated users can manage service report materials"
  ON public.service_report_materials
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Index for fast lookups by report
CREATE INDEX idx_service_report_materials_report_id ON public.service_report_materials(report_id);
