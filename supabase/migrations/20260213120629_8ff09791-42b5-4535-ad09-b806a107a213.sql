
-- Move all messages from duplicate conversation to the correct one
UPDATE whatsapp_messages 
SET conversation_id = '8b91f65c-503c-436b-89ef-ca41f82243f6' 
WHERE conversation_id = '89a166cd-3379-4c81-ba5c-39fbd3591a83';

-- Update last_message_at on the correct conversation
UPDATE whatsapp_conversations 
SET last_message_at = (
  SELECT MAX(created_at) FROM whatsapp_messages WHERE conversation_id = '8b91f65c-503c-436b-89ef-ca41f82243f6'
),
customer_name = 'Mauro Signorini'
WHERE id = '8b91f65c-503c-436b-89ef-ca41f82243f6';

-- Delete the duplicate conversation
DELETE FROM whatsapp_conversations 
WHERE id = '89a166cd-3379-4c81-ba5c-39fbd3591a83';
