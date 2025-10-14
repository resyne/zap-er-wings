-- Create table to track weekly recurring task completions
CREATE TABLE IF NOT EXISTS public.recurring_task_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_task_id UUID NOT NULL REFERENCES public.recurring_tasks(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure one completion record per recurring task per week
  UNIQUE(recurring_task_id, week_start)
);

-- Enable RLS
ALTER TABLE public.recurring_task_completions ENABLE ROW LEVEL SECURITY;

-- Create policies for recurring_task_completions
CREATE POLICY "Users can view recurring task completions"
  ON public.recurring_task_completions
  FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create recurring task completions"
  ON public.recurring_task_completions
  FOR INSERT
  WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can update recurring task completions"
  ON public.recurring_task_completions
  FOR UPDATE
  USING (has_minimum_role(auth.uid(), 'user'::app_role))
  WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access recurring task completions"
  ON public.recurring_task_completions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_recurring_task_completions_updated_at
  BEFORE UPDATE ON public.recurring_task_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for better query performance
CREATE INDEX idx_recurring_task_completions_week ON public.recurring_task_completions(week_start, week_end);
CREATE INDEX idx_recurring_task_completions_task ON public.recurring_task_completions(recurring_task_id);