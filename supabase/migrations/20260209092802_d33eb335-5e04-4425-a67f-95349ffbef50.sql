-- Create folders table for WhatsApp business files
CREATE TABLE public.whatsapp_business_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.whatsapp_business_folders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add folder_id to existing files table
ALTER TABLE public.whatsapp_business_files 
ADD COLUMN folder_id UUID REFERENCES public.whatsapp_business_folders(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.whatsapp_business_folders ENABLE ROW LEVEL SECURITY;

-- RLS policies for folders
CREATE POLICY "Users can view folders" 
ON public.whatsapp_business_folders 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create folders" 
ON public.whatsapp_business_folders 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can update folders" 
ON public.whatsapp_business_folders 
FOR UPDATE 
USING (true);

CREATE POLICY "Users can delete folders" 
ON public.whatsapp_business_folders 
FOR DELETE 
USING (true);

-- Index for performance
CREATE INDEX idx_whatsapp_business_folders_account ON public.whatsapp_business_folders(account_id);
CREATE INDEX idx_whatsapp_business_folders_parent ON public.whatsapp_business_folders(parent_id);
CREATE INDEX idx_whatsapp_business_files_folder ON public.whatsapp_business_files(folder_id);