-- Create table for AI knowledge base entries
CREATE TABLE public.whatsapp_ai_knowledge (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'general',
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_ai_knowledge ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view knowledge entries"
  ON public.whatsapp_ai_knowledge
  FOR SELECT
  USING (true);

CREATE POLICY "Users can create knowledge entries"
  ON public.whatsapp_ai_knowledge
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update knowledge entries"
  ON public.whatsapp_ai_knowledge
  FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete knowledge entries"
  ON public.whatsapp_ai_knowledge
  FOR DELETE
  USING (true);

-- Index for faster search
CREATE INDEX idx_whatsapp_ai_knowledge_account ON public.whatsapp_ai_knowledge(account_id);
CREATE INDEX idx_whatsapp_ai_knowledge_category ON public.whatsapp_ai_knowledge(category);
CREATE INDEX idx_whatsapp_ai_knowledge_keywords ON public.whatsapp_ai_knowledge USING GIN(keywords);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_ai_knowledge_updated_at
  BEFORE UPDATE ON public.whatsapp_ai_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.whatsapp_ai_knowledge IS 'Knowledge base for AI WhatsApp assistant - stores typical Q&A and company responses';