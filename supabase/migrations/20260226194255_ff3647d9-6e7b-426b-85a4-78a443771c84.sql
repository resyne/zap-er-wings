
-- Add assigned_user_id to whatsapp_conversations to track who owns/manages the chat
ALTER TABLE public.whatsapp_conversations 
ADD COLUMN assigned_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_whatsapp_conversations_assigned_user ON public.whatsapp_conversations(assigned_user_id);

-- Auto-assign user on first outbound message if not already assigned
CREATE OR REPLACE FUNCTION public.auto_assign_whatsapp_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only for outbound messages with a sender
  IF NEW.direction = 'outbound' AND NEW.sent_by IS NOT NULL THEN
    -- Assign user to conversation if not already assigned
    UPDATE whatsapp_conversations 
    SET assigned_user_id = NEW.sent_by
    WHERE id = NEW.conversation_id 
      AND assigned_user_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_assign_whatsapp_conversation
AFTER INSERT ON public.whatsapp_messages
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_whatsapp_conversation();
