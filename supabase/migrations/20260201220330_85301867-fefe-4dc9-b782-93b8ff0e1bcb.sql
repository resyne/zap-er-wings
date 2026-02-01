-- Add pipeline column to whatsapp_accounts
ALTER TABLE public.whatsapp_accounts 
ADD COLUMN pipeline text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.whatsapp_accounts.pipeline IS 'CRM pipeline associated with this WhatsApp number (e.g., Zapper, Vesuviano)';