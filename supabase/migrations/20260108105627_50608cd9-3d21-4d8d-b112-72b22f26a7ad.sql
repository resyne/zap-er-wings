-- Add pbx_id to imap_config to link IMAP configuration to specific PBX numbers
ALTER TABLE public.imap_config 
ADD COLUMN pbx_id uuid REFERENCES public.pbx_numbers(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_imap_config_pbx_id ON public.imap_config(pbx_id);