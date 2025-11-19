-- Migliora il trigger send_notification_email per creare template email più carini per i task assignment
CREATE OR REPLACE FUNCTION public.send_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  user_email TEXT;
  user_name TEXT;
  html_template TEXT;
  task_title TEXT;
  task_url TEXT;
BEGIN
  -- Ottieni email e nome dell'utente
  SELECT email, COALESCE(first_name || ' ' || last_name, email) 
  INTO user_email, user_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Crea il base URL per il link al task/entity
  task_url := 'https://zap-er-wings.lovable.app';
  
  -- Crea template HTML specifico per il tipo di notifica
  IF NEW.type = 'assignment' AND NEW.entity_type = 'task' THEN
    -- Template specifico per task assignment
    html_template := '
    <div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 24px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M9 11l3 3L22 4"></path>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
            </svg>
          </div>
          <h1 style="color: #111827; font-size: 24px; font-weight: 600; margin: 0;">' || NEW.title || '</h1>
        </div>
        
        <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">' || NEW.message || '</p>
        </div>
        
        <div style="text-align: center; margin: 32px 0;">
          <a href="' || task_url || '/tasks" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Visualizza Task
          </a>
        </div>
        
        <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 24px;">
          <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0;">
            Questa è una notifica automatica dal tuo sistema ERP. Se hai domande, contatta il tuo amministratore.
          </p>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 24px;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          © ' || EXTRACT(YEAR FROM NOW()) || ' ERP Zapper. Tutti i diritti riservati.
        </p>
      </div>
    </div>';
  ELSE
    -- Template generico per altre notifiche
    html_template := '
    <div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
      <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin: 0 0 16px 0;">' || NEW.title || '</h2>
        <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0;">' || NEW.message || '</p>
        
        <div style="border-top: 1px solid #e5e7eb; padding-top: 24px; margin-top: 24px;">
          <p style="color: #6b7280; font-size: 14px; line-height: 1.5; margin: 0;">
            Questa è una notifica automatica dal tuo sistema ERP.
          </p>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 24px;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          © ' || EXTRACT(YEAR FROM NOW()) || ' ERP Zapper. Tutti i diritti riservati.
        </p>
      </div>
    </div>';
  END IF;
  
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
    html_template,
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