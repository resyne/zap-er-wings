-- Create trigger function for lead activity assignment notifications
CREATE OR REPLACE FUNCTION notify_lead_activity_assignment()
RETURNS TRIGGER AS $$
DECLARE
  lead_info RECORD;
BEGIN
  -- Only proceed if there's an assigned_to user
  IF NEW.assigned_to IS NOT NULL THEN
    -- Check if this is a new assignment (INSERT or UPDATE with changed assigned_to)
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to)) THEN
      
      -- Get lead information
      SELECT company_name, contact_name 
      INTO lead_info
      FROM leads 
      WHERE id = NEW.lead_id;
      
      -- Create notification
      INSERT INTO notifications (
        user_id,
        title,
        message,
        type,
        entity_type,
        entity_id,
        is_read
      ) VALUES (
        NEW.assigned_to,
        'Nuova Attività CRM Assegnata',
        'Ti è stata assegnata un''attività di tipo "' || NEW.activity_type || 
        '" per ' || COALESCE(lead_info.company_name, lead_info.contact_name, 'lead') ||
        ' programmata per il ' || TO_CHAR(NEW.activity_date, 'DD/MM/YYYY HH24:MI'),
        'lead_activity_assignment',
        'lead_activity',
        NEW.id,
        false
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for lead activities
DROP TRIGGER IF EXISTS on_lead_activity_assignment ON lead_activities;
CREATE TRIGGER on_lead_activity_assignment
  AFTER INSERT OR UPDATE ON lead_activities
  FOR EACH ROW
  EXECUTE FUNCTION notify_lead_activity_assignment();