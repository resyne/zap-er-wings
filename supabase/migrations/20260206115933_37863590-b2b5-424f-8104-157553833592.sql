-- Add has_customer_reply column to track if customer has responded
ALTER TABLE whatsapp_conversations 
ADD COLUMN IF NOT EXISTS has_customer_reply BOOLEAN DEFAULT FALSE;

-- Update existing conversations based on their messages
UPDATE whatsapp_conversations wc
SET has_customer_reply = EXISTS (
  SELECT 1 FROM whatsapp_messages wm 
  WHERE wm.conversation_id = wc.id 
  AND wm.direction = 'inbound'
);

-- Create trigger function to update has_customer_reply when inbound message arrives
CREATE OR REPLACE FUNCTION update_conversation_has_customer_reply()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is an inbound message, set has_customer_reply to true
  IF NEW.direction = 'inbound' THEN
    UPDATE whatsapp_conversations 
    SET has_customer_reply = TRUE
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_has_customer_reply ON whatsapp_messages;
CREATE TRIGGER trigger_update_has_customer_reply
AFTER INSERT ON whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_has_customer_reply();