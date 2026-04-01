
-- Update trigger function to exclude Vesuviano leads
CREATE OR REPLACE FUNCTION public.sync_lead_to_email_lists()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if the lead has an email and is NOT from Vesuviano pipeline
  IF NEW.email IS NOT NULL AND NEW.email != '' 
     AND (NEW.pipeline IS NULL OR LOWER(NEW.pipeline) != 'vesuviano') THEN
    INSERT INTO public.email_list_contacts (email_list_id, email, first_name, company)
    SELECT el.id, TRIM(NEW.email), NEW.contact_name, NEW.company_name
    FROM public.email_lists el
    WHERE el.auto_sync_leads = true
    ON CONFLICT (email_list_id, email) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Remove existing Vesuviano leads from all auto-sync email lists
DELETE FROM public.email_list_contacts
WHERE id IN (
  SELECT elc.id 
  FROM public.email_list_contacts elc
  JOIN public.email_lists el ON el.id = elc.email_list_id
  JOIN public.leads l ON LOWER(TRIM(l.email)) = LOWER(TRIM(elc.email))
  WHERE el.auto_sync_leads = true
    AND LOWER(l.pipeline) = 'vesuviano'
);
