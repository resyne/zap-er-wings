-- Create sender emails table
CREATE TABLE public.sender_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  resend_domain_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sender_emails ENABLE ROW LEVEL SECURITY;

-- Create policies for sender emails
CREATE POLICY "Admins can manage sender emails" 
ON public.sender_emails 
FOR ALL 
USING (is_admin_user());

CREATE POLICY "Users can view sender emails" 
ON public.sender_emails 
FOR SELECT 
USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_sender_emails_updated_at
BEFORE UPDATE ON public.sender_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default sender email
INSERT INTO public.sender_emails (email, name, domain, is_verified, is_default)
VALUES ('noreply@company.com', 'Sistema CRM', 'company.com', true, true);