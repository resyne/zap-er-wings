
CREATE OR REPLACE FUNCTION public.sync_scraping_to_mailing_list()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_list_id uuid;
  v_mission_name text;
  v_mission_description text;
BEGIN
  IF NEW.status = 'completed' OR NEW.email_generation_status = 'completed' THEN
    v_mission_name := NEW.name;
    v_mission_description := 'Scraping: ' || NEW.query || ' (' || COALESCE(NEW.country_code, 'IT') || ')';
    
    SELECT id INTO v_list_id FROM email_lists 
      WHERE name = '📡 ' || v_mission_name
      LIMIT 1;
    
    IF v_list_id IS NULL THEN
      INSERT INTO email_lists (name, description, created_by)
      VALUES ('📡 ' || v_mission_name, v_mission_description, NEW.created_by)
      RETURNING id INTO v_list_id;
    ELSE
      UPDATE email_lists SET description = v_mission_description, updated_at = now()
      WHERE id = v_list_id;
    END IF;
    
    INSERT INTO email_list_contacts (email_list_id, email, first_name, company, city)
    SELECT DISTINCT ON (lower(sr.contact_email))
      v_list_id,
      lower(sr.contact_email),
      sr.recipient_name,
      COALESCE(sr.recipient_company, sr.title),
      sr.city
    FROM scraping_results sr
    WHERE sr.mission_id = NEW.id
      AND sr.contact_email IS NOT NULL
      AND sr.contact_email != ''
      AND sr.contact_email != 'NOT_FOUND'
    ORDER BY lower(sr.contact_email), sr.created_at DESC
    ON CONFLICT (email_list_id, email) DO UPDATE SET
      first_name = COALESCE(EXCLUDED.first_name, email_list_contacts.first_name),
      company = COALESCE(EXCLUDED.company, email_list_contacts.company),
      city = COALESCE(EXCLUDED.city, email_list_contacts.city);
  END IF;
  
  RETURN NEW;
END;
$$;
