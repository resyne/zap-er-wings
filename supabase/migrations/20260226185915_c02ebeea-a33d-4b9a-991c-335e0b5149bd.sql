
-- Table for tracking all communications/logs related to commesse
CREATE TABLE public.commessa_communications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commessa_id UUID NOT NULL REFERENCES public.commesse(id) ON DELETE CASCADE,
  communication_type TEXT NOT NULL, -- 'priority_change', 'urgent_message', 'note'
  content TEXT, -- message content for urgent messages
  old_value TEXT, -- for changes (e.g. old priority)
  new_value TEXT, -- for changes (e.g. new priority)
  sent_via TEXT[] DEFAULT '{}', -- ['whatsapp', 'email']
  sent_to TEXT[] DEFAULT '{}', -- recipient names
  sent_by UUID REFERENCES auth.users(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.commessa_communications ENABLE ROW LEVEL SECURITY;

-- Policies - authenticated users can read and insert
CREATE POLICY "Authenticated users can view commessa communications"
  ON public.commessa_communications FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create commessa communications"
  ON public.commessa_communications FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Index for fast lookups
CREATE INDEX idx_commessa_communications_commessa_id ON public.commessa_communications(commessa_id);
CREATE INDEX idx_commessa_communications_type ON public.commessa_communications(communication_type);
CREATE INDEX idx_commessa_communications_created_at ON public.commessa_communications(created_at DESC);
