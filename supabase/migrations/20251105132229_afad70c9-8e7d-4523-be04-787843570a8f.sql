-- Create table for IMAP configuration
CREATE TABLE IF NOT EXISTS public.imap_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 993,
  username TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  folder TEXT DEFAULT 'INBOX',
  search_criteria TEXT DEFAULT 'ALL',
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.imap_config ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to manage IMAP configs
CREATE POLICY "Allow authenticated users to manage IMAP configs"
  ON public.imap_config
  FOR ALL
  USING (auth.role() = 'authenticated');

-- Create table for IMAP sync state
CREATE TABLE IF NOT EXISTS public.imap_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES public.imap_config(id) ON DELETE CASCADE,
  last_uid INTEGER,
  last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  emails_processed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(config_id)
);

-- Enable RLS
ALTER TABLE public.imap_sync_state ENABLE ROW LEVEL SECURITY;

-- Policy: Allow authenticated users to view sync state
CREATE POLICY "Allow authenticated users to view sync state"
  ON public.imap_sync_state
  FOR SELECT
  USING (auth.role() = 'authenticated');