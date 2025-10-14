-- Add archived field to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- Create index for better performance on archived tasks
CREATE INDEX IF NOT EXISTS idx_tasks_archived ON public.tasks(archived) WHERE archived = true;