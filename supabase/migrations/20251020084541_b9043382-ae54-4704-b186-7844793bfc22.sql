-- Create ticket_comments table
CREATE TABLE IF NOT EXISTS public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  tagged_users UUID[] DEFAULT '{}'::UUID[]
);

-- Enable RLS
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- Policies for ticket_comments
CREATE POLICY "Users can view ticket comments"
  ON public.ticket_comments
  FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create ticket comments"
  ON public.ticket_comments
  FOR INSERT
  WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role) AND auth.uid() = created_by);

CREATE POLICY "Users can delete their own ticket comments"
  ON public.ticket_comments
  FOR DELETE
  USING (auth.uid() = created_by);

CREATE POLICY "Service role full access ticket comments"
  ON public.ticket_comments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_ticket_comments_updated_at
  BEFORE UPDATE ON public.ticket_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();