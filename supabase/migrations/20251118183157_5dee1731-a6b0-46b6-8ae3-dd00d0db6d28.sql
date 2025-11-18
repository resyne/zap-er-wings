-- Enable realtime for lead_activities table
ALTER TABLE public.lead_activities REPLICA IDENTITY FULL;

-- Enable realtime for lead_comments table
ALTER TABLE public.lead_comments REPLICA IDENTITY FULL;

-- Enable realtime for lead_files table
ALTER TABLE public.lead_files REPLICA IDENTITY FULL;

-- Add tables to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'lead_activities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_activities;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'lead_comments'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_comments;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'lead_files'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_files;
  END IF;
END $$;