DELETE FROM public.becca_followup_queue;

ALTER TABLE public.becca_followup_queue 
  DROP CONSTRAINT IF EXISTS becca_followup_queue_conversation_id_fkey;

ALTER TABLE public.becca_followup_queue 
  ADD CONSTRAINT becca_followup_queue_conversation_id_fkey 
  FOREIGN KEY (conversation_id) REFERENCES public.whatsapp_conversations(id);