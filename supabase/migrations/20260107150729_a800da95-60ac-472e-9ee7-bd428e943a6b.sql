-- Add new columns to service_reports for technicians count and kilometers
ALTER TABLE public.service_reports
ADD COLUMN IF NOT EXISTS technicians_count integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS kilometers numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS head_technician_hours numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS specialized_technician_hours numeric DEFAULT 0;

-- Create settings table for service report pricing
CREATE TABLE IF NOT EXISTS public.service_report_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value numeric NOT NULL,
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_report_settings ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to read settings
CREATE POLICY "Authenticated users can read settings" 
ON public.service_report_settings 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Policy for authenticated users to update settings
CREATE POLICY "Authenticated users can update settings" 
ON public.service_report_settings 
FOR UPDATE 
USING (auth.role() = 'authenticated');

-- Policy for authenticated users to insert settings
CREATE POLICY "Authenticated users can insert settings" 
ON public.service_report_settings 
FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Insert default pricing values
INSERT INTO public.service_report_settings (setting_key, setting_value, description)
VALUES 
  ('specialized_technician_hourly_rate', 40.00, 'Tariffa oraria tecnico specializzato (€/ora)'),
  ('specialized_technician_km_rate', 0.40, 'Tariffa km tecnico specializzato (€/km)'),
  ('head_technician_hourly_rate', 60.00, 'Tariffa oraria capo tecnico (€/ora)'),
  ('head_technician_km_rate', 0.60, 'Tariffa km capo tecnico (€/km)')
ON CONFLICT (setting_key) DO NOTHING;

-- Create trigger for updated_at
CREATE TRIGGER update_service_report_settings_updated_at
BEFORE UPDATE ON public.service_report_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();