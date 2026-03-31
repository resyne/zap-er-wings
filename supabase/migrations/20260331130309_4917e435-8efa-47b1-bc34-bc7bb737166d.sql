
-- Add auto-sync flags to email_lists
ALTER TABLE public.email_lists ADD COLUMN IF NOT EXISTS auto_sync_leads boolean DEFAULT false;
ALTER TABLE public.email_lists ADD COLUMN IF NOT EXISTS auto_sync_customers boolean DEFAULT false;

-- Function to sync a lead into all auto-sync lists
CREATE OR REPLACE FUNCTION public.sync_lead_to_email_lists()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if the lead has an email
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    -- Insert into all lists that have auto_sync_leads = true
    INSERT INTO public.email_list_contacts (email_list_id, email, first_name, company)
    SELECT el.id, TRIM(NEW.email), NEW.contact_name, NEW.company_name
    FROM public.email_lists el
    WHERE el.auto_sync_leads = true
    ON CONFLICT (email_list_id, email) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to sync a customer into all auto-sync lists
CREATE OR REPLACE FUNCTION public.sync_customer_to_email_lists()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use contact_email first, fallback to company email
  DECLARE
    sync_email text := COALESCE(NULLIF(TRIM(NEW.contact_email), ''), NULLIF(TRIM(NEW.email), ''));
  BEGIN
    IF sync_email IS NOT NULL AND sync_email != '' THEN
      INSERT INTO public.email_list_contacts (email_list_id, email, first_name, company)
      SELECT el.id, sync_email, NEW.contact_name, NEW.company_name
      FROM public.email_lists el
      WHERE el.auto_sync_customers = true
      ON CONFLICT (email_list_id, email) DO NOTHING;
    END IF;
  END;
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_sync_lead_to_email_lists ON public.leads;
CREATE TRIGGER trigger_sync_lead_to_email_lists
  AFTER INSERT ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lead_to_email_lists();

DROP TRIGGER IF EXISTS trigger_sync_customer_to_email_lists ON public.customers;
CREATE TRIGGER trigger_sync_customer_to_email_lists
  AFTER INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_to_email_lists();
