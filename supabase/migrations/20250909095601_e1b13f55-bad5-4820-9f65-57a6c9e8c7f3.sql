-- Create the cron job to process email queue every minute
SELECT cron.schedule(
  'process-email-queue',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
        url:='https://rucjkoleodtwrbftwgsm.supabase.co/functions/v1/process-email-queue',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y2prb2xlb2R0d3JiZnR3Z3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDUzMTEsImV4cCI6MjA2NDI4MTMxMX0.zWVVI5NkW9YPLp1WN-Gleo8vn6UVDabRtNbW5FCUcnA"}'::jsonb,
        body:='{"scheduled": true}'::jsonb
    ) as request_id;
  $$
);