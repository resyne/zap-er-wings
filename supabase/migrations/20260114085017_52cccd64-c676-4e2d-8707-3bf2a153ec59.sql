-- Add sent_by column to wasender_messages to track which user sent each message
ALTER TABLE public.wasender_messages 
ADD COLUMN sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_wasender_messages_sent_by ON public.wasender_messages(sent_by);

-- Add comment
COMMENT ON COLUMN public.wasender_messages.sent_by IS 'The user who sent this outbound message';