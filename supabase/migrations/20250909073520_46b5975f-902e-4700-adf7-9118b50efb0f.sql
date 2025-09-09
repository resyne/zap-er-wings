-- Create email lists table
CREATE TABLE public.email_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES auth.users,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create email list contacts table
CREATE TABLE public.email_list_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_list_id UUID NOT NULL REFERENCES public.email_lists(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    company TEXT,
    email TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(email_list_id, email)
);

-- Enable RLS
ALTER TABLE public.email_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_list_contacts ENABLE ROW LEVEL SECURITY;

-- Create policies for email_lists
CREATE POLICY "Users can manage their own email lists"
ON public.email_lists FOR ALL
USING (has_minimum_role(auth.uid(), 'user'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

-- Create policies for email_list_contacts
CREATE POLICY "Users can manage email list contacts"
ON public.email_list_contacts FOR ALL
USING (has_minimum_role(auth.uid(), 'user'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

-- Service role policies
CREATE POLICY "Service role full access email lists"
ON public.email_lists FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access email list contacts"
ON public.email_list_contacts FOR ALL
USING (true)
WITH CHECK (true);

-- Update triggers
CREATE TRIGGER update_email_lists_updated_at
    BEFORE UPDATE ON public.email_lists
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_email_list_contacts_email_list_id ON public.email_list_contacts(email_list_id);
CREATE INDEX idx_email_list_contacts_email ON public.email_list_contacts(email);