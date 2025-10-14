-- Create lead_activities table to track all activities and history
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  activity_date TIMESTAMP WITH TIME ZONE NOT NULL,
  assigned_to UUID REFERENCES auth.users(id),
  notes TEXT,
  status TEXT DEFAULT 'scheduled',
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES auth.users(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_activities ENABLE ROW LEVEL SECURITY;

-- Create policies for lead_activities
CREATE POLICY "Users can view lead activities"
  ON public.lead_activities
  FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can insert lead activities"
  ON public.lead_activities
  FOR INSERT
  WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can update lead activities"
  ON public.lead_activities
  FOR UPDATE
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can delete lead activities"
  ON public.lead_activities
  FOR DELETE
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access lead activities"
  ON public.lead_activities
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for better query performance
CREATE INDEX idx_lead_activities_lead_id ON public.lead_activities(lead_id);
CREATE INDEX idx_lead_activities_assigned_to ON public.lead_activities(assigned_to);
CREATE INDEX idx_lead_activities_activity_date ON public.lead_activities(activity_date);

-- Create trigger for updated_at
CREATE TRIGGER update_lead_activities_updated_at
  BEFORE UPDATE ON public.lead_activities
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();