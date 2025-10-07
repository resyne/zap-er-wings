-- Create email automations table
CREATE TABLE IF NOT EXISTS public.email_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_id UUID REFERENCES public.newsletter_templates(id) ON DELETE SET NULL,
  trigger_type TEXT NOT NULL DEFAULT 'manual', -- manual, after_campaign, date_based
  delay_days INTEGER NOT NULL DEFAULT 0,
  target_audience TEXT NOT NULL, -- all, partners, customers, contacts, email_list
  partner_type TEXT,
  region TEXT,
  email_list_id UUID REFERENCES public.email_lists(id) ON DELETE SET NULL,
  sender_email TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create email automation logs table
CREATE TABLE IF NOT EXISTS public.email_automation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.email_automations(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'scheduled', -- scheduled, sent, failed
  error_message TEXT,
  campaign_id UUID REFERENCES public.email_campaigns(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_automation_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for email_automations
CREATE POLICY "Users can manage their own automations"
  ON public.email_automations
  FOR ALL
  USING (has_minimum_role(auth.uid(), 'user'::app_role))
  WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access email automations"
  ON public.email_automations
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create policies for email_automation_logs
CREATE POLICY "Users can view automation logs"
  ON public.email_automation_logs
  FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access automation logs"
  ON public.email_automation_logs
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_email_automations_active ON public.email_automations(is_active);
CREATE INDEX idx_email_automation_logs_status ON public.email_automation_logs(status);
CREATE INDEX idx_email_automation_logs_scheduled ON public.email_automation_logs(scheduled_for);