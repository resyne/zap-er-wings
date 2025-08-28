-- Enable pg_cron and pg_net extensions for scheduled functions
SELECT cron.schedule(
  'process-recurring-subscriptions-daily',
  '0 6 * * *', -- Every day at 6 AM
  $$
  SELECT
    net.http_post(
        url:='https://rucjkoleodtwrbftwgsm.supabase.co/functions/v1/process-recurring-subscriptions',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y2prb2xlb2R0d3JiZnR3Z3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDUzMTEsImV4cCI6MjA2NDI4MTMxMX0.zWVVI5NkW9YPLp1WN-Gleo8vn6UVDabRtNbW5FCUcnA"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);