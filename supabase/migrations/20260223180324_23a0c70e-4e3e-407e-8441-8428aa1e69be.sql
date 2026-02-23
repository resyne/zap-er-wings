
-- Create a function that queues notification emails when internal communications are created
CREATE OR REPLACE FUNCTION public.notify_internal_communication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender_name TEXT;
  v_sender_email TEXT;
  v_recipient_email TEXT;
  v_recipient_name TEXT;
  v_admin_email TEXT := 'stanislao@abbattitorizapper.it';
  v_comm_type_label TEXT;
  v_html TEXT;
BEGIN
  -- Get sender info
  SELECT COALESCE(first_name || ' ' || last_name, email), email
  INTO v_sender_name, v_sender_email
  FROM profiles WHERE id = NEW.sender_id;

  -- Map communication type to label
  v_comm_type_label := CASE NEW.communication_type
    WHEN 'announcement' THEN 'Annuncio'
    WHEN 'personal' THEN 'Messaggio Personale'
    WHEN 'formal_warning' THEN 'Richiamo Formale'
    WHEN 'vacation_response' THEN 'Risposta Ferie'
    WHEN 'vacation_request' THEN 'Richiesta Ferie'
    WHEN 'info' THEN 'Segnalazione'
    ELSE NEW.communication_type
  END;

  -- Build HTML template
  v_html := '
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff;">
    <div style="border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-bottom: 20px;">
      <h2 style="color: #667eea; margin: 0;">Zapper ERP - Comunicazione Interna</h2>
    </div>
    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
      <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280;">Tipo: <strong>' || v_comm_type_label || '</strong> | Priorità: <strong>' || COALESCE(NEW.priority, 'normal') || '</strong></p>
      <p style="margin: 0 0 4px; font-size: 12px; color: #6b7280;">Da: <strong>' || COALESCE(v_sender_name, 'Sistema') || '</strong></p>
    </div>
    <h3 style="color: #111827;">' || COALESCE(NEW.title, 'Senza titolo') || '</h3>
    <div style="color: #374151; line-height: 1.6;">' || REPLACE(COALESCE(NEW.content, ''), E'\n', '<br>') || '</div>
    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af;">
      <p>Questa è una notifica automatica dal sistema ERP Zapper.</p>
    </div>
  </div>';

  -- 1) Always notify admin
  IF v_sender_email IS DISTINCT FROM v_admin_email THEN
    INSERT INTO email_queue (recipient_email, recipient_name, subject, message, html_content, sender_email, sender_name, metadata)
    VALUES (
      v_admin_email, 'Admin', 
      'Comunicazione Interna: ' || COALESCE(NEW.title, 'Senza titolo'),
      COALESCE(NEW.content, ''),
      v_html,
      'noreply@abbattitorizapper.it', 'ERP Zapper',
      jsonb_build_object('type', 'internal_communication', 'communication_id', NEW.id)
    );
  END IF;

  -- 2) Notify specific recipient if set
  IF NEW.recipient_id IS NOT NULL THEN
    SELECT COALESCE(first_name || ' ' || last_name, email), email
    INTO v_recipient_name, v_recipient_email
    FROM profiles WHERE id = NEW.recipient_id;

    IF v_recipient_email IS NOT NULL AND v_recipient_email != v_admin_email THEN
      INSERT INTO email_queue (recipient_email, recipient_name, subject, message, html_content, sender_email, sender_name, metadata)
      VALUES (
        v_recipient_email, v_recipient_name,
        'Comunicazione Interna: ' || COALESCE(NEW.title, 'Senza titolo'),
        COALESCE(NEW.content, ''),
        v_html,
        'noreply@abbattitorizapper.it', 'ERP Zapper',
        jsonb_build_object('type', 'internal_communication', 'communication_id', NEW.id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_internal_communication_created ON internal_communications;
CREATE TRIGGER on_internal_communication_created
  AFTER INSERT ON internal_communications
  FOR EACH ROW
  EXECUTE FUNCTION notify_internal_communication();
