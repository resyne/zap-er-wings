-- Enable pg_cron and pg_net extensions for scheduled functions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create a scheduled job to sync emails every 2 minutes
SELECT cron.schedule(
  'email-sync-every-2-minutes',
  '*/2 * * * *', -- Every 2 minutes
  $$
  SELECT
    net.http_post(
        url:='https://rucjkoleodtwrbftwgsm.supabase.co/functions/v1/sync-emails-scheduled',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y2prb2xlb2R0d3JiZnR3Z3NtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODcwNTMxMSwiZXhwIjoyMDY0MjgxMzExfQ.3VK5RrQJkUqZl0vSGhJ7T6MevP6pRgzLWKhh5I93nqw"}'::jsonb,
        body:=concat('{"scheduled": true, "timestamp": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);

-- Create function to manually start/stop email sync
CREATE OR REPLACE FUNCTION public.toggle_email_sync(enable_sync boolean)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF enable_sync THEN
        -- Enable the scheduled job
        PERFORM cron.schedule(
            'email-sync-every-2-minutes',
            '*/2 * * * *',
            $$
            SELECT
                net.http_post(
                    url:='https://rucjkoleodtwrbftwgsm.supabase.co/functions/v1/sync-emails-scheduled',
                    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1Y2prb2xlb2R0d3JiZnR3Z3NtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODcwNTMxMSwiZXhwIjoyMDY0MjgxMzExfQ.3VK5RrQJkUqZl0vSGhJ7T6MevP6pRgzLWKhh5I93nqw"}'::jsonb,
                    body:=concat('{"scheduled": true, "timestamp": "', now(), '"}')::jsonb
                ) as request_id;
            $$
        );
        RETURN 'Email sync enabled - running every 2 minutes';
    ELSE
        -- Disable the scheduled job
        PERFORM cron.unschedule('email-sync-every-2-minutes');
        RETURN 'Email sync disabled';
    END IF;
END;
$$;