-- Fix notify_user_tagged trigger function: avoid referencing non-existent NEW.* fields on different comment tables
CREATE OR REPLACE FUNCTION public.notify_user_tagged()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  tagged_user_id UUID;
  tagger_name TEXT;
  payload JSONB;
  comment_author_id UUID;
  entity_type TEXT;
  entity_id UUID;
BEGIN
  -- Convert NEW record to JSONB so missing fields return NULL instead of raising errors
  payload := to_jsonb(NEW);

  -- Determine author id across different tables (lead_comments uses created_by; others often use user_id)
  comment_author_id := COALESCE(
    (payload ->> 'created_by')::uuid,
    (payload ->> 'user_id')::uuid
  );

  -- If we can't determine an author, do nothing
  IF comment_author_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only proceed if there are tagged users
  IF NEW.tagged_users IS NOT NULL AND array_length(NEW.tagged_users, 1) > 0 THEN
    -- Name of who tagged
    SELECT COALESCE(first_name || ' ' || last_name, email)
      INTO tagger_name
    FROM profiles
    WHERE id = comment_author_id;

    -- Determine entity type/id safely
    entity_id := COALESCE(
      (payload ->> 'lead_id')::uuid,
      (payload ->> 'task_id')::uuid,
      (payload ->> 'work_order_id')::uuid
    );

    entity_type := CASE
      WHEN (payload ->> 'lead_id') IS NOT NULL THEN 'lead'
      WHEN (payload ->> 'task_id') IS NOT NULL THEN 'task'
      WHEN (payload ->> 'work_order_id') IS NOT NULL THEN 'work_order'
      ELSE 'comment'
    END;

    FOREACH tagged_user_id IN ARRAY NEW.tagged_users
    LOOP
      IF tagged_user_id IS NOT NULL AND tagged_user_id != comment_author_id THEN
        PERFORM create_notification(
          tagged_user_id,
          'Sei stato menzionato',
          COALESCE(tagger_name, 'Un utente') || ' ti ha menzionato in un commento',
          'tag',
          entity_type,
          entity_id
        );
      END IF;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger on lead_comments to ensure it points to the updated function
DROP TRIGGER IF EXISTS notify_user_tagged_trigger ON public.lead_comments;
CREATE TRIGGER notify_user_tagged_trigger
  AFTER INSERT ON public.lead_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_user_tagged();
