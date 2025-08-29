-- Create service_reports table for technical intervention reports
CREATE TABLE public.service_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID REFERENCES public.crm_contacts(id),
  intervention_type TEXT NOT NULL,
  description TEXT NOT NULL,
  work_performed TEXT,
  materials_used TEXT,
  notes TEXT,
  technician_name TEXT NOT NULL,
  intervention_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  customer_signature TEXT NOT NULL,
  technician_signature TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.service_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view service reports" 
ON public.service_reports 
FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create service reports" 
ON public.service_reports 
FOR INSERT 
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can update service reports" 
ON public.service_reports 
FOR UPDATE 
USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Admins can delete service reports" 
ON public.service_reports 
FOR DELETE 
USING (has_minimum_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_service_reports_updated_at
BEFORE UPDATE ON public.service_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();