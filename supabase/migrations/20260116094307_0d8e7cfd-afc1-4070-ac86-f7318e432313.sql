-- Create table for conformity declarations (dichiarazioni di conformità)
CREATE TABLE public.conformity_declarations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  serial_number TEXT NOT NULL,
  declaration_date DATE NOT NULL,
  model TEXT NOT NULL,
  order_number TEXT,
  customer_id UUID REFERENCES public.customers(id),
  customer_name TEXT NOT NULL,
  notes TEXT,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable Row Level Security
ALTER TABLE public.conformity_declarations ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Authenticated users can view conformity declarations" 
ON public.conformity_declarations 
FOR SELECT 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can create conformity declarations" 
ON public.conformity_declarations 
FOR INSERT 
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can update conformity declarations" 
ON public.conformity_declarations 
FOR UPDATE 
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can delete conformity declarations" 
ON public.conformity_declarations 
FOR DELETE 
TO authenticated
USING (true);

-- Create index for faster searches
CREATE INDEX idx_conformity_declarations_serial ON public.conformity_declarations(serial_number);
CREATE INDEX idx_conformity_declarations_date ON public.conformity_declarations(declaration_date);
CREATE INDEX idx_conformity_declarations_customer ON public.conformity_declarations(customer_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_conformity_declarations_updated_at
BEFORE UPDATE ON public.conformity_declarations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();