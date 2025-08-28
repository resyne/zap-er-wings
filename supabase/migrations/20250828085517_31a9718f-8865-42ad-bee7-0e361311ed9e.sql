-- Enable pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a cron job for daily partner communications
-- This will run every day at 9:00 AM UTC
SELECT cron.schedule(
  'daily-partner-communication',
  '0 9 * * *',
  $$
  SELECT
    net.http_post(
        url:='https://rucjkoleodtwrbftwgsm.supabase.co/functions/v1/scheduled-partner-communication',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y2prb2xlb2R0d3JiZnR3Z3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDUzMTEsImV4cCI6MjA2NDI4MTMxMX0.zWVVI5NkW9YPLp1WN-Gleo8vn6UVDabRtNbW5FCUcnA"}'::jsonb,
        body:=concat('{"scheduled_run": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Create a table to track email campaigns (optional - for analytics)
CREATE TABLE IF NOT EXISTS email_campaigns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_type TEXT NOT NULL,
    partner_type TEXT,
    region TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    recipients_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    scheduled_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on email_campaigns table
ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

-- Create policy for authenticated users to view email campaigns
CREATE POLICY "Allow authenticated users to view email campaigns"
ON email_campaigns
FOR SELECT
USING (true);

-- Create policy for authenticated users to insert email campaigns
CREATE POLICY "Allow authenticated users to insert email campaigns"
ON email_campaigns
FOR INSERT
WITH CHECK (true);