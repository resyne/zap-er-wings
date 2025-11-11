-- Fix lead_comments table structure and policies

-- First, drop ALL existing policies on lead_comments
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'lead_comments' AND schemaname = 'public') 
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.lead_comments';
    END LOOP;
END $$;

-- Handle column renaming
DO $$ 
BEGIN
  -- Check if user_id column exists and rename it to created_by if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lead_comments' 
    AND column_name = 'user_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lead_comments' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.lead_comments RENAME COLUMN user_id TO created_by;
  END IF;
  
  -- Ensure created_by column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'lead_comments' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.lead_comments ADD COLUMN created_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Create proper RLS policies using created_by
CREATE POLICY "Users can view all lead comments"
  ON public.lead_comments
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert lead comments"
  ON public.lead_comments
  FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own lead comments"
  ON public.lead_comments
  FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own lead comments"
  ON public.lead_comments
  FOR DELETE
  USING (auth.uid() = created_by);

-- Ensure RLS is enabled
ALTER TABLE public.lead_comments ENABLE ROW LEVEL SECURITY;