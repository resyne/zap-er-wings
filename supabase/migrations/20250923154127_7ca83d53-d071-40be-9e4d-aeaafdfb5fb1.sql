-- Create content table for marketing content creation
CREATE TABLE public.marketing_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'video', 'graphic', 'blog', 'email', 'other')),
  status TEXT NOT NULL DEFAULT 'da_fare' CHECK (status IN ('da_fare', 'fatto', 'da_montare', 'pubblicato')),
  platform TEXT CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'youtube', 'website', 'email', 'tiktok', 'twitter')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id),
  due_date DATE,
  published_date DATE,
  content_url TEXT,
  thumbnail_url TEXT,
  notes TEXT,
  tags TEXT[],
  created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.marketing_content ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view marketing content" 
ON public.marketing_content 
FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create marketing content" 
ON public.marketing_content 
FOR INSERT 
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can update marketing content" 
ON public.marketing_content 
FOR UPDATE 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can delete marketing content" 
ON public.marketing_content 
FOR DELETE 
USING (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access marketing content" 
ON public.marketing_content 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_marketing_content_updated_at
BEFORE UPDATE ON public.marketing_content
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();