-- Create offers table
CREATE TABLE public.offers (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    customer_id UUID REFERENCES public.customers(id),
    customer_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
    valid_until DATE,
    attachments TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view offers" 
ON public.offers 
FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can manage offers" 
ON public.offers 
FOR ALL 
USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Users can create offers" 
ON public.offers 
FOR INSERT 
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access offers" 
ON public.offers 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Add trigger for updated_at
CREATE TRIGGER update_offers_updated_at
    BEFORE UPDATE ON public.offers
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();