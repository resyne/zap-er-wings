
-- Add sender_email and sender_name fields to campaigns
ALTER TABLE public.lead_automation_campaigns 
ADD COLUMN IF NOT EXISTS sender_email TEXT DEFAULT 'noreply@abbattitorizapper.it',
ADD COLUMN IF NOT EXISTS sender_name TEXT DEFAULT 'Vesuviano Forni';

-- Add comment for clarity
COMMENT ON COLUMN public.lead_automation_campaigns.sender_email IS 'Email address used as sender for this campaign';
COMMENT ON COLUMN public.lead_automation_campaigns.sender_name IS 'Display name used as sender for this campaign';
