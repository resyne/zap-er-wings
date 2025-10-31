-- Crea tabella per i log delle attività dell'AI
CREATE TABLE IF NOT EXISTS public.ai_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  action_type TEXT NOT NULL, -- 'get_leads', 'create_lead', 'update_lead', etc.
  action_description TEXT NOT NULL,
  entity_type TEXT, -- 'lead', 'customer', 'offer', etc.
  entity_id UUID,
  request_summary TEXT NOT NULL,
  response_summary TEXT,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Abilita RLS
ALTER TABLE public.ai_activity_logs ENABLE ROW LEVEL SECURITY;

-- Policy: tutti possono vedere i log
CREATE POLICY "Users can view AI activity logs"
  ON public.ai_activity_logs
  FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

-- Policy: service role può inserire
CREATE POLICY "Service role can insert AI activity logs"
  ON public.ai_activity_logs
  FOR INSERT
  WITH CHECK (true);

-- Crea indice per performance
CREATE INDEX idx_ai_activity_logs_created_at ON public.ai_activity_logs(created_at DESC);
CREATE INDEX idx_ai_activity_logs_entity ON public.ai_activity_logs(entity_type, entity_id);