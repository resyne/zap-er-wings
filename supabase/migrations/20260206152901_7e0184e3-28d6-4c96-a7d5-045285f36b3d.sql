-- Add translation column to whatsapp_messages table
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS translation_it TEXT,
ADD COLUMN IF NOT EXISTS source_language VARCHAR(10);

-- Add index for faster lookups on messages that have translations
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_translation 
ON public.whatsapp_messages (id) 
WHERE translation_it IS NOT NULL;