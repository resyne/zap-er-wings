-- Create lead_activity_comments table
CREATE TABLE IF NOT EXISTS public.lead_activity_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.lead_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_activity_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view activity comments"
  ON public.lead_activity_comments
  FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create activity comments"
  ON public.lead_activity_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id AND has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can update their own comments"
  ON public.lead_activity_comments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON public.lead_activity_comments
  FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access activity comments"
  ON public.lead_activity_comments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_lead_activity_comments_updated_at
  BEFORE UPDATE ON public.lead_activity_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_lead_activity_comments_activity_id ON public.lead_activity_comments(activity_id);
CREATE INDEX idx_lead_activity_comments_user_id ON public.lead_activity_comments(user_id);