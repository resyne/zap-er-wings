-- Add site_origin to profiles table to separate users by site
ALTER TABLE public.profiles ADD COLUMN site_origin TEXT DEFAULT 'zap-er-wings.lovable.app';

-- Add files support to tasks
CREATE TABLE public.task_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  content_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on task_files
ALTER TABLE public.task_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for task_files
CREATE POLICY "Users can view task files they have access to" 
ON public.task_files 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.tasks 
    WHERE tasks.id = task_files.task_id 
    AND has_minimum_role(auth.uid(), 'user'::app_role)
  )
);

CREATE POLICY "Users can upload task files" 
ON public.task_files 
FOR INSERT 
WITH CHECK (
  has_minimum_role(auth.uid(), 'user'::app_role) 
  AND auth.uid() = uploaded_by
);

CREATE POLICY "Users can delete their own task files" 
ON public.task_files 
FOR DELETE 
USING (auth.uid() = uploaded_by);

-- Create storage bucket for task files
INSERT INTO storage.buckets (id, name, public) VALUES ('task-files', 'task-files', false);

-- Storage policies for task files
CREATE POLICY "Users can view task files they have access to"
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'task-files' 
  AND has_minimum_role(auth.uid(), 'user'::app_role)
);

CREATE POLICY "Users can upload task files"
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'task-files' 
  AND has_minimum_role(auth.uid(), 'user'::app_role)
);

CREATE POLICY "Users can delete their own task files"
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'task-files' 
  AND has_minimum_role(auth.uid(), 'user'::app_role)
);

-- Update handle_new_user function to set site_origin based on referrer
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  site_domain TEXT;
BEGIN
  -- Determine site origin from raw_user_meta_data or default
  site_domain := COALESCE(
    new.raw_user_meta_data ->> 'site_origin',
    'zap-er-wings.lovable.app'
  );
  
  INSERT INTO public.profiles (id, email, first_name, last_name, site_origin)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    site_domain
  );
  RETURN new;
END;
$$;