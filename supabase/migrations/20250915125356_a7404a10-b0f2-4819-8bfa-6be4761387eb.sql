-- Create tickets table
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'medium',
  customer_name TEXT NOT NULL,
  customer_id UUID,
  assigned_to UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id) NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  attachments TEXT[] DEFAULT '{}'
);

-- Create ticket watchers table
CREATE TABLE public.ticket_watchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, user_id)
);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_watchers ENABLE ROW LEVEL SECURITY;

-- Create policies for tickets
CREATE POLICY "Users can view tickets" 
ON public.tickets 
FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create tickets" 
ON public.tickets 
FOR INSERT 
WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Moderators can manage tickets" 
ON public.tickets 
FOR ALL 
USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access tickets" 
ON public.tickets 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create policies for ticket_watchers
CREATE POLICY "Users can view ticket watchers" 
ON public.ticket_watchers 
FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can manage their own watchers" 
ON public.ticket_watchers 
FOR ALL 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Moderators can manage all watchers" 
ON public.ticket_watchers 
FOR ALL 
USING (has_minimum_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_minimum_role(auth.uid(), 'moderator'::app_role));

CREATE POLICY "Service role full access ticket watchers" 
ON public.ticket_watchers 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create sequence for ticket numbering
CREATE SEQUENCE ticket_sequence START WITH 1;

-- Create function to generate ticket numbers
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    RETURN 'TCK-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(NEXTVAL('ticket_sequence')::TEXT, 3, '0');
END;
$$;

-- Create trigger to auto-generate ticket numbers
CREATE OR REPLACE FUNCTION public.auto_generate_ticket_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
    IF NEW.number IS NULL OR NEW.number = '' THEN
        NEW.number := generate_ticket_number();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER auto_generate_ticket_number_trigger
    BEFORE INSERT ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_generate_ticket_number();

-- Create trigger to update timestamps
CREATE TRIGGER update_tickets_updated_at
    BEFORE UPDATE ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();