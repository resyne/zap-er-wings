-- Enable RLS on sender_emails table
ALTER TABLE public.sender_emails ENABLE ROW LEVEL SECURITY;

-- Create policies for sender_emails table
CREATE POLICY "Users can manage their own sender emails" 
ON public.sender_emails 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Allow service role full access
CREATE POLICY "Service role full access sender emails" 
ON public.sender_emails 
FOR ALL 
USING (true)
WITH CHECK (true);