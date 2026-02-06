-- Create table for WhatsApp standard messages (quick replies)
CREATE TABLE public.whatsapp_standard_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  category TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_standard_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view standard messages"
ON public.whatsapp_standard_messages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create standard messages"
ON public.whatsapp_standard_messages
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update standard messages"
ON public.whatsapp_standard_messages
FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete standard messages"
ON public.whatsapp_standard_messages
FOR DELETE
TO authenticated
USING (true);

-- Create index for faster queries
CREATE INDEX idx_whatsapp_standard_messages_account ON public.whatsapp_standard_messages(account_id);

-- Add updated_at trigger
CREATE TRIGGER update_whatsapp_standard_messages_updated_at
BEFORE UPDATE ON public.whatsapp_standard_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();