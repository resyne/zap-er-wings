
-- Prima elimina eventuali messaggi associati alle conversazioni ZAPPER duplicate
DELETE FROM whatsapp_messages 
WHERE conversation_id IN ('829a2d20-177e-42bd-8ccd-ad60e1ede5e0', '0b817050-da7a-43f5-abbb-cca2feca9d6b');

-- Poi elimina le conversazioni duplicate sull'account ZAPPER  
DELETE FROM whatsapp_conversations 
WHERE id IN ('829a2d20-177e-42bd-8ccd-ad60e1ede5e0', '0b817050-da7a-43f5-abbb-cca2feca9d6b');
