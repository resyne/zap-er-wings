-- Add wasender_id to messages table for tracking message status updates
ALTER TABLE wasender_messages 
ADD COLUMN IF NOT EXISTS wasender_id TEXT;

-- Add session_id to accounts table to match incoming webhooks to the right account
ALTER TABLE wasender_accounts 
ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Create index for faster message lookups by wasender_id
CREATE INDEX IF NOT EXISTS idx_wasender_messages_wasender_id 
ON wasender_messages(wasender_id) 
WHERE wasender_id IS NOT NULL;

-- Create index for faster account lookups by session_id
CREATE INDEX IF NOT EXISTS idx_wasender_accounts_session_id 
ON wasender_accounts(session_id) 
WHERE session_id IS NOT NULL;