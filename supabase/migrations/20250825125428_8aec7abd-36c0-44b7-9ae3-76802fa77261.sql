-- Create opportunity_activities table
CREATE TABLE public.opportunity_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('completed', 'todo')),
  title TEXT NOT NULL,
  description TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  scheduled_date TIMESTAMP WITH TIME ZONE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create opportunity_files table
CREATE TABLE public.opportunity_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  opportunity_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.opportunity_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_files ENABLE ROW LEVEL SECURITY;

-- Create policies for opportunity_activities
CREATE POLICY "Allow authenticated users to view activities" 
ON public.opportunity_activities 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to insert activities" 
ON public.opportunity_activities 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update activities" 
ON public.opportunity_activities 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow authenticated users to delete activities" 
ON public.opportunity_activities 
FOR DELETE 
USING (true);

-- Create policies for opportunity_files
CREATE POLICY "Allow authenticated users to view files" 
ON public.opportunity_files 
FOR SELECT 
USING (true);

CREATE POLICY "Allow authenticated users to insert files" 
ON public.opportunity_files 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update files" 
ON public.opportunity_files 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow authenticated users to delete files" 
ON public.opportunity_files 
FOR DELETE 
USING (true);