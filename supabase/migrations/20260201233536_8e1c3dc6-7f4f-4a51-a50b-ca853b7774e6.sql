-- Add trigger condition column to support button-based activation
ALTER TABLE public.whatsapp_automation_steps 
ADD COLUMN trigger_type TEXT DEFAULT 'delay' CHECK (trigger_type IN ('delay', 'button_reply'));

-- Add column to store which button text triggers this step
ALTER TABLE public.whatsapp_automation_steps 
ADD COLUMN trigger_button_text TEXT;

-- Add column to reference which previous step this is triggered by
ALTER TABLE public.whatsapp_automation_steps 
ADD COLUMN trigger_from_step_id UUID REFERENCES public.whatsapp_automation_steps(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_whatsapp_automation_steps_trigger ON public.whatsapp_automation_steps(trigger_type, trigger_from_step_id);

COMMENT ON COLUMN public.whatsapp_automation_steps.trigger_type IS 'How this step is triggered: delay (time-based) or button_reply (user clicks quick reply)';
COMMENT ON COLUMN public.whatsapp_automation_steps.trigger_button_text IS 'The exact button text that triggers this step (for button_reply type)';
COMMENT ON COLUMN public.whatsapp_automation_steps.trigger_from_step_id IS 'Reference to the previous step whose button reply triggers this step';