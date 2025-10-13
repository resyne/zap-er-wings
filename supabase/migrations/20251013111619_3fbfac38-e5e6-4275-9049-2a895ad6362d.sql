-- Create mail_messages table for efficient IMAP caching
CREATE TABLE IF NOT EXISTS public.mail_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  uid INTEGER NOT NULL,
  folder TEXT NOT NULL DEFAULT 'INBOX',
  subject TEXT,
  from_address TEXT,
  to_address TEXT,
  date TIMESTAMP WITH TIME ZONE,
  flags TEXT[],
  snippet TEXT,
  has_attachments BOOLEAN DEFAULT false,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  -- Full body is loaded on-demand, not cached
  UNIQUE(user_email, folder, uid)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_mail_messages_user_folder ON public.mail_messages(user_email, folder);
CREATE INDEX IF NOT EXISTS idx_mail_messages_uid ON public.mail_messages(uid);
CREATE INDEX IF NOT EXISTS idx_mail_messages_date ON public.mail_messages(date DESC);

-- Table for tracking folder sync state
CREATE TABLE IF NOT EXISTS public.mail_sync_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email TEXT NOT NULL,
  folder TEXT NOT NULL,
  uidvalidity INTEGER,
  uidnext INTEGER,
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_email, folder)
);

-- Enable RLS
ALTER TABLE public.mail_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mail_sync_state ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mail_messages
CREATE POLICY "Users can view their own mail messages"
  ON public.mail_messages FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own mail messages"
  ON public.mail_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own mail messages"
  ON public.mail_messages FOR UPDATE
  USING (true);

CREATE POLICY "Users can delete their own mail messages"
  ON public.mail_messages FOR DELETE
  USING (true);

-- RLS Policies for mail_sync_state
CREATE POLICY "Users can view their own sync state"
  ON public.mail_sync_state FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their own sync state"
  ON public.mail_sync_state FOR ALL
  USING (true)
  WITH CHECK (true);

-- Service role full access
CREATE POLICY "Service role full access mail_messages"
  ON public.mail_messages FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access mail_sync_state"
  ON public.mail_sync_state FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_mail_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_mail_messages_timestamp
  BEFORE UPDATE ON public.mail_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_mail_messages_updated_at();