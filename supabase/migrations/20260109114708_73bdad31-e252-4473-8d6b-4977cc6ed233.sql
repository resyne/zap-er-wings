-- Add report_number column to service_reports
ALTER TABLE public.service_reports 
ADD COLUMN report_number TEXT;

-- Create a function to generate the next report number in format RI-YYYY-NNNN
CREATE OR REPLACE FUNCTION public.generate_service_report_number()
RETURNS TEXT AS $$
DECLARE
  current_year TEXT;
  next_number INTEGER;
  new_report_number TEXT;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get the max number for the current year
  SELECT COALESCE(
    MAX(
      NULLIF(
        SUBSTRING(report_number FROM 'RI-' || current_year || '-(\d+)')::INTEGER,
        0
      )
    ),
    0
  ) + 1
  INTO next_number
  FROM service_reports
  WHERE report_number LIKE 'RI-' || current_year || '-%';
  
  -- Format: RI-2026-0001
  new_report_number := 'RI-' || current_year || '-' || LPAD(next_number::TEXT, 4, '0');
  
  RETURN new_report_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create a trigger to auto-generate report_number on insert
CREATE OR REPLACE FUNCTION public.set_service_report_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.report_number IS NULL THEN
    NEW.report_number := generate_service_report_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_set_service_report_number
  BEFORE INSERT ON public.service_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_service_report_number();

-- Update existing reports with sequential numbers based on created_at
WITH numbered_reports AS (
  SELECT 
    id, 
    ROW_NUMBER() OVER (ORDER BY created_at ASC) as rn,
    EXTRACT(YEAR FROM created_at)::TEXT as report_year
  FROM service_reports
  WHERE report_number IS NULL
)
UPDATE service_reports sr
SET report_number = 'RI-' || nr.report_year || '-' || LPAD(nr.rn::TEXT, 4, '0')
FROM numbered_reports nr
WHERE sr.id = nr.id;