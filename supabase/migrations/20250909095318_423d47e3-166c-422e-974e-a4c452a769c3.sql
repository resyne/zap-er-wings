-- Create email queue table
CREATE TABLE public.email_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  html_content TEXT NOT NULL,
  sender_email TEXT,
  sender_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  campaign_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for efficient queue processing
CREATE INDEX idx_email_queue_status_scheduled ON public.email_queue(status, scheduled_at);
CREATE INDEX idx_email_queue_campaign ON public.email_queue(campaign_id);

-- Enable RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Service role full access email queue" 
ON public.email_queue 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view email queue" 
ON public.email_queue 
FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_email_queue_updated_at
  BEFORE UPDATE ON public.email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;