
-- Internal communications table
CREATE TABLE public.internal_communications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  communication_type TEXT NOT NULL DEFAULT 'announcement' CHECK (communication_type IN ('announcement', 'personal', 'formal_warning', 'vacation_request', 'vacation_response', 'info', 'urgent')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  sender_id UUID REFERENCES auth.users(id),
  recipient_id UUID REFERENCES auth.users(id), -- NULL = company-wide
  is_read BOOLEAN NOT NULL DEFAULT false,
  read_at TIMESTAMPTZ,
  attachment_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.internal_communications ENABLE ROW LEVEL SECURITY;

-- Users can see communications addressed to them OR company-wide (recipient_id IS NULL)
CREATE POLICY "Users can view their communications"
  ON public.internal_communications FOR SELECT
  USING (
    auth.uid() = recipient_id 
    OR recipient_id IS NULL 
    OR auth.uid() = sender_id
  );

-- Admins/moderators can create communications
CREATE POLICY "Authorized users can create communications"
  ON public.internal_communications FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Users can update their own received communications (mark as read)
CREATE POLICY "Users can update their received communications"
  ON public.internal_communications FOR UPDATE
  USING (auth.uid() = recipient_id OR (recipient_id IS NULL AND auth.uid() IS NOT NULL));

-- Trigger for updated_at
CREATE TRIGGER set_internal_communications_updated_at
  BEFORE UPDATE ON public.internal_communications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
