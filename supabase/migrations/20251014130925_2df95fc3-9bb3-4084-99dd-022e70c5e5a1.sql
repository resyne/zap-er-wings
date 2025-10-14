-- Add is_template column to tasks table to distinguish template tasks from regular tasks
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false;

-- Add index for better performance when filtering out templates
CREATE INDEX IF NOT EXISTS idx_tasks_is_template ON public.tasks(is_template) WHERE is_template = false;

-- Update existing tasks that are used as templates for recurring tasks
UPDATE public.tasks
SET is_template = true
WHERE id IN (SELECT task_template_id FROM public.recurring_tasks);