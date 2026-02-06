-- Add attachment fields to standard messages
ALTER TABLE public.whatsapp_standard_messages
ADD COLUMN IF NOT EXISTS attachment_file_id UUID REFERENCES public.whatsapp_business_files(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS attachment_url TEXT,
ADD COLUMN IF NOT EXISTS attachment_name TEXT,
ADD COLUMN IF NOT EXISTS attachment_type TEXT;

COMMENT ON COLUMN public.whatsapp_standard_messages.attachment_file_id IS 'Reference to a business file from the library';
COMMENT ON COLUMN public.whatsapp_standard_messages.attachment_url IS 'Direct URL of the attachment';
COMMENT ON COLUMN public.whatsapp_standard_messages.attachment_name IS 'Display name of the attachment';
COMMENT ON COLUMN public.whatsapp_standard_messages.attachment_type IS 'Type: image, video, audio, document';