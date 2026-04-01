
DO $$
DECLARE
  r RECORD;
  v_list_id uuid;
BEGIN
  FOR r IN 
    SELECT * FROM scraping_missions 
    WHERE status = 'completed'
  LOOP
    SELECT id INTO v_list_id FROM email_lists 
      WHERE name = '📡 ' || r.name LIMIT 1;
    
    IF v_list_id IS NULL THEN
      INSERT INTO email_lists (name, description, created_by)
      VALUES ('📡 ' || r.name, 'Scraping: ' || r.query || ' (' || COALESCE(r.country_code, 'IT') || ')', r.created_by)
      RETURNING id INTO v_list_id;
    END IF;
    
    INSERT INTO email_list_contacts (email_list_id, email, first_name, company, city)
    SELECT DISTINCT ON (lower(sr.contact_email))
      v_list_id,
      lower(sr.contact_email),
      sr.recipient_name,
      COALESCE(sr.recipient_company, sr.title),
      sr.city
    FROM scraping_results sr
    WHERE sr.mission_id = r.id
      AND sr.contact_email IS NOT NULL
      AND sr.contact_email != ''
      AND sr.contact_email != 'NOT_FOUND'
    ORDER BY lower(sr.contact_email), sr.created_at DESC
    ON CONFLICT (email_list_id, email) DO UPDATE SET
      first_name = COALESCE(EXCLUDED.first_name, email_list_contacts.first_name),
      company = COALESCE(EXCLUDED.company, email_list_contacts.company),
      city = COALESCE(EXCLUDED.city, email_list_contacts.city);
  END LOOP;
END $$;
