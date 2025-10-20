-- Modifica i trigger esistenti per evitare notifiche su auto-assegnazione

-- Aggiorna il trigger per le task
CREATE OR REPLACE FUNCTION public.notify_task_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_task_title TEXT;
BEGIN
  -- Skip if no assignment, it's a template, or self-assignment
  IF NEW.assigned_to IS NULL OR NEW.is_template = true OR NEW.assigned_to = NEW.created_by THEN
    RETURN NEW;
  END IF;
  
  -- Check if assignment changed (and not self-assignment)
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to)) THEN
    -- Verify it's not the same user doing the assignment
    IF NEW.assigned_to != auth.uid() THEN
      PERFORM create_notification(
        NEW.assigned_to,
        'Nuovo task assegnato',
        'Ti è stato assegnato il task: ' || COALESCE(NEW.title, 'Senza titolo'),
        'assignment',
        'task',
        NEW.id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Aggiorna il trigger per i lead
CREATE OR REPLACE FUNCTION public.notify_lead_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Skip if no assignment or self-assignment
  IF NEW.assigned_to IS NULL OR NEW.assigned_to = auth.uid() THEN
    RETURN NEW;
  END IF;
  
  -- Check if assignment changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to)) THEN
    PERFORM create_notification(
      NEW.assigned_to,
      'Nuovo lead assegnato',
      'Ti è stato assegnato il lead: ' || COALESCE(NEW.company_name, NEW.contact_name, 'Senza nome'),
      'assignment',
      'lead',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Aggiorna il trigger per i work order
CREATE OR REPLACE FUNCTION public.notify_work_order_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Skip if no assignment or self-assignment
  IF NEW.assigned_to IS NULL OR NEW.assigned_to = auth.uid() THEN
    RETURN NEW;
  END IF;
  
  -- Check if assignment changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to)) THEN
    PERFORM create_notification(
      NEW.assigned_to,
      'Nuovo ordine di lavoro assegnato',
      'Ti è stato assegnato l''ordine: ' || COALESCE(NEW.title, NEW.number, 'Senza titolo'),
      'assignment',
      'work_order',
      NEW.id
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crea funzione per notificare quando un utente viene taggato in un commento
CREATE OR REPLACE FUNCTION public.notify_user_tagged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  tagged_user_id UUID;
  tagger_name TEXT;
BEGIN
  -- Se ci sono utenti taggati
  IF NEW.tagged_users IS NOT NULL AND array_length(NEW.tagged_users, 1) > 0 THEN
    -- Ottieni il nome di chi ha fatto il commento
    SELECT COALESCE(first_name || ' ' || last_name, email) INTO tagger_name
    FROM profiles
    WHERE id = NEW.user_id;
    
    -- Per ogni utente taggato, crea una notifica (ma non se è lo stesso utente)
    FOREACH tagged_user_id IN ARRAY NEW.tagged_users
    LOOP
      IF tagged_user_id != NEW.user_id THEN
        PERFORM create_notification(
          tagged_user_id,
          'Sei stato menzionato',
          tagger_name || ' ti ha menzionato in un commento',
          'tag',
          CASE 
            WHEN NEW.lead_id IS NOT NULL THEN 'lead'
            WHEN NEW.task_id IS NOT NULL THEN 'task'
            WHEN NEW.work_order_id IS NOT NULL THEN 'work_order'
            ELSE 'comment'
          END,
          COALESCE(NEW.lead_id, NEW.task_id, NEW.work_order_id)
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Crea trigger per i commenti dei lead
DROP TRIGGER IF EXISTS notify_tagged_users_in_lead_comments ON lead_comments;
CREATE TRIGGER notify_tagged_users_in_lead_comments
  AFTER INSERT ON lead_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_tagged();

-- Crea trigger per inviare email quando viene creata una notifica
CREATE OR REPLACE FUNCTION public.send_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  user_email TEXT;
  user_name TEXT;
BEGIN
  -- Ottieni email e nome dell'utente
  SELECT email, COALESCE(first_name || ' ' || last_name, email) 
  INTO user_email, user_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Inserisci nella coda email
  INSERT INTO email_queue (
    recipient_email,
    recipient_name,
    subject,
    message,
    html_content,
    sender_email,
    sender_name,
    metadata
  ) VALUES (
    user_email,
    user_name,
    NEW.title,
    NEW.message,
    '<div style="font-family: Arial, sans-serif; padding: 20px;">
      <h2 style="color: #333;">' || NEW.title || '</h2>
      <p style="color: #666; font-size: 16px;">' || NEW.message || '</p>
      <p style="color: #999; font-size: 14px; margin-top: 30px;">
        Questa è una notifica automatica dal tuo ERP.
      </p>
    </div>',
    'noreply@abbattitorizapper.it',
    'ERP Zapper',
    jsonb_build_object(
      'notification_id', NEW.id,
      'notification_type', NEW.type,
      'entity_type', NEW.entity_type,
      'entity_id', NEW.entity_id
    )
  );
  
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS send_email_on_notification ON notifications;
CREATE TRIGGER send_email_on_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  EXECUTE FUNCTION send_notification_email();