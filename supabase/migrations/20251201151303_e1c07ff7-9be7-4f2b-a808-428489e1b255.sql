-- Add configurator tracking fields to leads table
ALTER TABLE leads
ADD COLUMN configurator_session_id TEXT,
ADD COLUMN configurator_link TEXT,
ADD COLUMN configurator_opened BOOLEAN DEFAULT false,
ADD COLUMN configurator_opened_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN configurator_last_updated TIMESTAMP WITH TIME ZONE,
ADD COLUMN configurator_status TEXT,
ADD COLUMN configurator_model TEXT,
ADD COLUMN configurator_has_quote BOOLEAN DEFAULT false,
ADD COLUMN configurator_quote_price NUMERIC,
ADD COLUMN configurator_history JSONB DEFAULT '[]'::jsonb;

-- Add index for faster lookups by session_id
CREATE INDEX idx_leads_configurator_session_id ON leads(configurator_session_id);