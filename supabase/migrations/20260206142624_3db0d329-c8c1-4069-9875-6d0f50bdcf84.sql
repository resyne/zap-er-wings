-- Add AI chat configuration columns to whatsapp_accounts
ALTER TABLE public.whatsapp_accounts
ADD COLUMN IF NOT EXISTS ai_chat_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT,
ADD COLUMN IF NOT EXISTS ai_auto_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_min_delay_minutes INTEGER DEFAULT 2,
ADD COLUMN IF NOT EXISTS ai_max_delay_minutes INTEGER DEFAULT 10;

-- Create table to track AI conversation state per conversation
CREATE TABLE IF NOT EXISTS public.whatsapp_ai_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, sent, cancelled
  suggested_message TEXT,
  ai_reasoning TEXT,
  delay_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(conversation_id, status) -- Only one pending per conversation
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_queue_scheduled ON public.whatsapp_ai_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_whatsapp_ai_queue_conversation ON public.whatsapp_ai_queue(conversation_id);

-- Enable RLS
ALTER TABLE public.whatsapp_ai_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for whatsapp_ai_queue
CREATE POLICY "Users can view AI queue" ON public.whatsapp_ai_queue FOR SELECT USING (true);
CREATE POLICY "Users can insert AI queue" ON public.whatsapp_ai_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update AI queue" ON public.whatsapp_ai_queue FOR UPDATE USING (true);
CREATE POLICY "Users can delete AI queue" ON public.whatsapp_ai_queue FOR DELETE USING (true);

-- Add comment
COMMENT ON TABLE public.whatsapp_ai_queue IS 'Queue for AI-generated WhatsApp messages with intelligent delay';