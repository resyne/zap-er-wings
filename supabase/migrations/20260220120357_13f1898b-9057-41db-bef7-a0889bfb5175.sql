
-- Table for production project attachments
CREATE TABLE public.production_project_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.production_projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL DEFAULT 'link', -- link, image, video, document
  file_size INTEGER,
  mime_type TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.production_project_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view attachments"
  ON public.production_project_attachments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert attachments"
  ON public.production_project_attachments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete attachments"
  ON public.production_project_attachments FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Storage bucket for project files
INSERT INTO storage.buckets (id, name, public) VALUES ('production-project-files', 'production-project-files', true);

CREATE POLICY "Authenticated users can upload project files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'production-project-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Anyone can view project files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'production-project-files');

CREATE POLICY "Authenticated users can delete project files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'production-project-files' AND auth.uid() IS NOT NULL);
