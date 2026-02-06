-- Add AI enabled flag per conversation
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS ai_enabled boolean DEFAULT true;

-- Comment
COMMENT ON COLUMN public.whatsapp_conversations.ai_enabled IS 'Whether AI Sales is enabled for this specific conversation';