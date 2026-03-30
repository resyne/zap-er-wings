-- Add notification rule type for assegno_in_scadenza
-- and set up daily cron job at 7:00 AM to check expiring checks

SELECT cron.schedule(
  'notify-assegno-scadenza-daily',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url:='https://rucjkoleodtwrbftwgsm.supabase.co/functions/v1/notify-assegno-scadenza',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y2prb2xlb2R0d3JiZnR3Z3NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDUzMTEsImV4cCI6MjA2NDI4MTMxMX0.zWVVI5NkW9YPLp1WN-Gleo8vn6UVDabRtNbW5FCUcnA"}'::jsonb,
    body:='{"source": "cron"}'::jsonb
  ) AS request_id;
  $$
);