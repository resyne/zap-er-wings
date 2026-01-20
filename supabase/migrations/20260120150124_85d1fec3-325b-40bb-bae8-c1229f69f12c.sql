-- Create lead_automation_campaigns table
CREATE TABLE public.lead_automation_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'new_lead', -- 'new_lead', 'lead_status_change', etc.
  target_pipeline TEXT, -- Optional: target specific pipeline
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create lead_automation_steps table for email sequence steps
CREATE TABLE public.lead_automation_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.lead_automation_campaigns(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  delay_days INTEGER NOT NULL DEFAULT 0, -- Days to wait before sending
  delay_hours INTEGER NOT NULL DEFAULT 0, -- Hours to wait before sending
  delay_minutes INTEGER NOT NULL DEFAULT 0, -- Minutes to wait before sending
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead_automation_executions table to track sent emails
CREATE TABLE public.lead_automation_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.lead_automation_campaigns(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.lead_automation_steps(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'cancelled'
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead_automation_templates table for reusable HTML templates
CREATE TABLE public.lead_automation_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  html_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.lead_automation_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_automation_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_automation_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_automation_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view campaigns" ON public.lead_automation_campaigns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create campaigns" ON public.lead_automation_campaigns FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update campaigns" ON public.lead_automation_campaigns FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete campaigns" ON public.lead_automation_campaigns FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view steps" ON public.lead_automation_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create steps" ON public.lead_automation_steps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update steps" ON public.lead_automation_steps FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete steps" ON public.lead_automation_steps FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view executions" ON public.lead_automation_executions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create executions" ON public.lead_automation_executions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update executions" ON public.lead_automation_executions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete executions" ON public.lead_automation_executions FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can view templates" ON public.lead_automation_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create templates" ON public.lead_automation_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update templates" ON public.lead_automation_templates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete templates" ON public.lead_automation_templates FOR DELETE TO authenticated USING (true);

-- Create indexes for performance
CREATE INDEX idx_automation_steps_campaign ON public.lead_automation_steps(campaign_id);
CREATE INDEX idx_automation_executions_campaign ON public.lead_automation_executions(campaign_id);
CREATE INDEX idx_automation_executions_lead ON public.lead_automation_executions(lead_id);
CREATE INDEX idx_automation_executions_status ON public.lead_automation_executions(status);
CREATE INDEX idx_automation_executions_scheduled ON public.lead_automation_executions(scheduled_at);

-- Create function to update updated_at
CREATE OR REPLACE FUNCTION public.update_lead_automation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_lead_automation_campaigns_updated_at
  BEFORE UPDATE ON public.lead_automation_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lead_automation_updated_at();

CREATE TRIGGER update_lead_automation_steps_updated_at
  BEFORE UPDATE ON public.lead_automation_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lead_automation_updated_at();

CREATE TRIGGER update_lead_automation_templates_updated_at
  BEFORE UPDATE ON public.lead_automation_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lead_automation_updated_at();