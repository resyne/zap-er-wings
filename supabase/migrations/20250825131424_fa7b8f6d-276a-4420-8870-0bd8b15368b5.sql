-- Create storage bucket for opportunity files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('opportunity-files', 'opportunity-files', false);

-- Create storage policies for opportunity files
CREATE POLICY "Users can upload their own opportunity files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'opportunity-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view opportunity files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'opportunity-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own opportunity files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'opportunity-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own opportunity files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'opportunity-files' AND auth.uid() IS NOT NULL);