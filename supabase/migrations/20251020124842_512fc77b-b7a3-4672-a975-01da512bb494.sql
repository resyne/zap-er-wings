-- Create table for user page visibility preferences
CREATE TABLE public.user_page_visibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  page_url TEXT NOT NULL,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, page_url)
);

-- Enable RLS
ALTER TABLE public.user_page_visibility ENABLE ROW LEVEL SECURITY;

-- Users can view their own visibility settings
CREATE POLICY "Users can view their own page visibility"
ON public.user_page_visibility
FOR SELECT
USING (auth.uid() = user_id);

-- Users can update their own visibility settings
CREATE POLICY "Users can update their own page visibility"
ON public.user_page_visibility
FOR UPDATE
USING (auth.uid() = user_id);

-- Admins can manage all visibility settings
CREATE POLICY "Admins can manage all page visibility"
ON public.user_page_visibility
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Service role full access
CREATE POLICY "Service role full access page visibility"
ON public.user_page_visibility
FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_user_page_visibility_updated_at
BEFORE UPDATE ON public.user_page_visibility
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();