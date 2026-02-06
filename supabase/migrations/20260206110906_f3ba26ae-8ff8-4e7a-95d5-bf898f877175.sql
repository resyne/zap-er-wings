-- Add language column to whatsapp_standard_messages
ALTER TABLE public.whatsapp_standard_messages 
ADD COLUMN language text NOT NULL DEFAULT 'it';

-- Add index for faster language filtering
CREATE INDEX idx_whatsapp_standard_messages_language 
ON public.whatsapp_standard_messages(account_id, language);

-- Add comment for documentation
COMMENT ON COLUMN public.whatsapp_standard_messages.language IS 'Language code: it, en, es, fr, de, pt';