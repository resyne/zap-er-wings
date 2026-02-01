-- Drop the existing foreign key constraint
ALTER TABLE wasender_conversations 
DROP CONSTRAINT IF EXISTS wasender_conversations_lead_id_fkey;

-- Recreate with ON DELETE CASCADE
ALTER TABLE wasender_conversations
ADD CONSTRAINT wasender_conversations_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE;

-- Also fix whatsapp_conversations if it has the same issue
ALTER TABLE whatsapp_conversations 
DROP CONSTRAINT IF EXISTS whatsapp_conversations_lead_id_fkey;

ALTER TABLE whatsapp_conversations
ADD CONSTRAINT whatsapp_conversations_lead_id_fkey 
FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;