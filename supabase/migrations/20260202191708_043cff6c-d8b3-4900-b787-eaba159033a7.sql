
-- Fix notify_user_tagged function to use created_by instead of user_id for lead_comments
CREATE OR REPLACE FUNCTION public.notify_user_tagged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tagged_user_id UUID;
  tagger_name TEXT;
  comment_author_id UUID;
BEGIN
  -- Determine the author column (user_id for some tables, created_by for others)
  comment_author_id := COALESCE(
    CASE WHEN TG_TABLE_NAME = 'lead_comments' THEN NEW.created_by ELSE NULL END,
    NEW.user_id
  );
  
  -- Se ci sono utenti taggati
  IF NEW.tagged_users IS NOT NULL AND array_length(NEW.tagged_users, 1) > 0 THEN
    -- Ottieni il nome di chi ha fatto il commento
    SELECT COALESCE(first_name || ' ' || last_name, email) INTO tagger_name
    FROM profiles
    WHERE id = comment_author_id;
    
    -- Per ogni utente taggato, crea una notifica (ma non se è lo stesso utente)
    FOREACH tagged_user_id IN ARRAY NEW.tagged_users
    LOOP
      IF tagged_user_id != comment_author_id THEN
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
$$;

-- Create trigger on lead_comments if it doesn't exist
DROP TRIGGER IF EXISTS notify_user_tagged_trigger ON lead_comments;
CREATE TRIGGER notify_user_tagged_trigger
  AFTER INSERT ON lead_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_user_tagged();
