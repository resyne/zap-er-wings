
-- Enable pg_cron and pg_net extensions if not already
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule system monitor to run every 15 minutes
SELECT cron.schedule(
  'system-monitor-check',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://rucjkoleodtwrbftwgsm.supabase.co/functions/v1/system-monitor',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y2prb2xlb2R0d3JiZnR3Z3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDUzMTEsImV4cCI6MjA2NDI4MTMxMX0.zWVVI5NkW9YPLp1WN-Gleo8vn6UVDabRtNbW5FCUcnA"}'::jsonb,
    body:='{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);
