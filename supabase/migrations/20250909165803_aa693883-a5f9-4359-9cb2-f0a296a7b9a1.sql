-- Create task management tables
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'completed', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_category AS ENUM ('amministrazione', 'back_office', 'ricerca_sviluppo');
CREATE TYPE recurrence_type AS ENUM ('none', 'daily', 'weekly', 'monthly', 'yearly');

-- Main tasks table
CREATE TABLE public.tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status task_status NOT NULL DEFAULT 'todo',
    priority task_priority NOT NULL DEFAULT 'medium',
    category task_category NOT NULL,
    assigned_to UUID REFERENCES auth.users(id),
    created_by UUID REFERENCES auth.users(id),
    start_date TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_hours NUMERIC,
    actual_hours NUMERIC,
    tags TEXT[],
    parent_task_id UUID REFERENCES public.tasks(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Recurring tasks configuration
CREATE TABLE public.recurring_tasks (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_template_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    recurrence_type recurrence_type NOT NULL DEFAULT 'none',
    recurrence_interval INTEGER NOT NULL DEFAULT 1,
    recurrence_days INTEGER[], -- For weekly: [1,2,3] = Mon,Tue,Wed
    recurrence_end_date DATE,
    last_generated_date DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Task comments/updates
CREATE TABLE public.task_comments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    comment TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Task attachments
CREATE TABLE public.task_attachments (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tasks
CREATE POLICY "Users can view tasks" ON public.tasks FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create tasks" ON public.tasks FOR INSERT 
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can update tasks" ON public.tasks FOR UPDATE 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can delete tasks" ON public.tasks FOR DELETE 
USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

-- RLS Policies for recurring tasks
CREATE POLICY "Users can view recurring tasks" ON public.recurring_tasks FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can manage recurring tasks" ON public.recurring_tasks FOR ALL 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

-- RLS Policies for task comments
CREATE POLICY "Users can view task comments" ON public.task_comments FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create task comments" ON public.task_comments FOR INSERT 
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role) AND auth.uid() = user_id);

CREATE POLICY "Users can update own comments" ON public.task_comments FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Moderators can delete comments" ON public.task_comments FOR DELETE 
USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

-- RLS Policies for task attachments
CREATE POLICY "Users can view task attachments" ON public.task_attachments FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can upload task attachments" ON public.task_attachments FOR INSERT 
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role) AND auth.uid() = uploaded_by);

CREATE POLICY "Users can delete own attachments" ON public.task_attachments FOR DELETE 
USING (auth.uid() = uploaded_by OR has_minimum_role(auth.uid(), 'moderator'::app_role));

-- Create indexes for performance
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_category ON public.tasks(category);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date);
CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);
CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);

-- Add trigger for updated_at
CREATE TRIGGER update_tasks_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_tasks_updated_at
    BEFORE UPDATE ON public.recurring_tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate recurring tasks
CREATE OR REPLACE FUNCTION public.generate_recurring_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    recurring_task RECORD;
    template_task RECORD;
    next_date DATE;
    new_task_id UUID;
BEGIN
    FOR recurring_task IN 
        SELECT rt.*, t.title, t.description, t.category, t.assigned_to, t.created_by, 
               t.estimated_hours, t.tags, t.priority
        FROM recurring_tasks rt
        JOIN tasks t ON rt.task_template_id = t.id
        WHERE rt.is_active = true
        AND (rt.last_generated_date IS NULL OR rt.last_generated_date < CURRENT_DATE)
    LOOP
        -- Calculate next occurrence date
        next_date := COALESCE(recurring_task.last_generated_date, CURRENT_DATE);
        
        CASE recurring_task.recurrence_type
            WHEN 'daily' THEN
                next_date := next_date + (recurring_task.recurrence_interval || ' days')::INTERVAL;
            WHEN 'weekly' THEN
                next_date := next_date + (recurring_task.recurrence_interval * 7 || ' days')::INTERVAL;
            WHEN 'monthly' THEN
                next_date := next_date + (recurring_task.recurrence_interval || ' months')::INTERVAL;
            WHEN 'yearly' THEN
                next_date := next_date + (recurring_task.recurrence_interval || ' years')::INTERVAL;
        END CASE;
        
        -- Check if we should generate the task (not past end date)
        IF recurring_task.recurrence_end_date IS NULL OR next_date <= recurring_task.recurrence_end_date THEN
            -- Create new task
            INSERT INTO tasks (
                title, description, category, assigned_to, created_by,
                estimated_hours, tags, priority, start_date, due_date,
                parent_task_id
            ) VALUES (
                recurring_task.title,
                recurring_task.description,
                recurring_task.category,
                recurring_task.assigned_to,
                recurring_task.created_by,
                recurring_task.estimated_hours,
                recurring_task.tags,
                recurring_task.priority,
                next_date,
                next_date + INTERVAL '1 day',
                recurring_task.task_template_id
            ) RETURNING id INTO new_task_id;
            
            -- Update last generated date
            UPDATE recurring_tasks 
            SET last_generated_date = next_date,
                updated_at = now()
            WHERE id = recurring_task.id;
        END IF;
    END LOOP;
END;
$$;