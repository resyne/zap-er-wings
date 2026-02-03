-- Add columns for audio transcription and media download
ALTER TABLE public.whatsapp_messages 
ADD COLUMN IF NOT EXISTS media_downloaded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS transcription text,
ADD COLUMN IF NOT EXISTS transcription_translated text,
ADD COLUMN IF NOT EXISTS transcription_language text;