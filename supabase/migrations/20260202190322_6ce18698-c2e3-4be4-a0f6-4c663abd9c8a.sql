-- Add rating column to whatsapp_conversations
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN IF NOT EXISTS rating smallint DEFAULT NULL 
CHECK (rating IS NULL OR (rating >= 1 AND rating <= 3));