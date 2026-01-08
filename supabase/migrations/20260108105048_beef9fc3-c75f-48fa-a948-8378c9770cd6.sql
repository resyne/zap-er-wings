-- Create table for PBX/switchboard numbers
CREATE TABLE public.pbx_numbers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone_number VARCHAR(50) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pbx_numbers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view pbx_numbers" 
ON public.pbx_numbers FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage pbx_numbers" 
ON public.pbx_numbers FOR ALL 
USING (auth.role() = 'authenticated');

-- Add trigger for updated_at
CREATE TRIGGER update_pbx_numbers_updated_at
BEFORE UPDATE ON public.pbx_numbers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add pbx_id to phone_extensions
ALTER TABLE public.phone_extensions 
ADD COLUMN pbx_id UUID REFERENCES public.pbx_numbers(id) ON DELETE SET NULL;

-- Add index
CREATE INDEX idx_phone_extensions_pbx_id ON public.phone_extensions(pbx_id);