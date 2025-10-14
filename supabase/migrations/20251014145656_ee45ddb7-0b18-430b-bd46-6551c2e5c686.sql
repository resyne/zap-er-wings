-- Create storage bucket for lead files
INSERT INTO storage.buckets (id, name, public)
VALUES ('lead-files', 'lead-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create table to track lead files
CREATE TABLE IF NOT EXISTS public.lead_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lead_files
CREATE POLICY "Users can view lead files"
  ON public.lead_files FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can upload lead files"
  ON public.lead_files FOR INSERT
  WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can delete lead files"
  ON public.lead_files FOR DELETE
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access lead files"
  ON public.lead_files FOR ALL
  USING (true)
  WITH CHECK (true);

-- Storage policies for lead-files bucket
CREATE POLICY "Users can view lead files in storage"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'lead-files' AND has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can upload lead files to storage"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'lead-files' AND has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can delete lead files from storage"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'lead-files' AND has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access lead files storage"
  ON storage.objects FOR ALL
  USING (bucket_id = 'lead-files')
  WITH CHECK (bucket_id = 'lead-files');

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_lead_files_lead_id ON public.lead_files(lead_id);

-- Add updated_at trigger
CREATE TRIGGER update_lead_files_updated_at
  BEFORE UPDATE ON public.lead_files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();