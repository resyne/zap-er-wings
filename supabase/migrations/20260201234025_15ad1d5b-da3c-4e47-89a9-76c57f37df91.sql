-- Add activated_at timestamp to track when campaign was first activated
ALTER TABLE public.whatsapp_automation_campaigns 
ADD COLUMN activated_at TIMESTAMPTZ;

-- Add index for efficient filtering
CREATE INDEX idx_whatsapp_automation_campaigns_activated 
ON public.whatsapp_automation_campaigns(is_active, activated_at);

COMMENT ON COLUMN public.whatsapp_automation_campaigns.activated_at IS 'Timestamp when the campaign was first activated. Only leads created after this date will be processed.';