-- Add file_name column to wasender_messages for document names
ALTER TABLE public.wasender_messages 
ADD COLUMN IF NOT EXISTS file_name text;