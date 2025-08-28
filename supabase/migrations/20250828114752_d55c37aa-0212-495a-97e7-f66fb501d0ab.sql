-- Create table for financial movements (Prima Nota)
CREATE TABLE public.financial_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL,
  registration_number TEXT NOT NULL,
  causale TEXT NOT NULL,
  movement_type TEXT NOT NULL CHECK (movement_type IN ('incasso', 'acquisto')),
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  registered BOOLEAN DEFAULT false,
  reporting_user TEXT NOT NULL,
  attachments TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for recurring subscriptions  
CREATE TABLE public.recurring_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('mensile', 'trimestrale', 'semestrale', 'annuale')),
  next_payment DATE NOT NULL,
  causale TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.financial_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policies for financial movements
CREATE POLICY "Users can view their own financial movements" 
ON public.financial_movements 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own financial movements" 
ON public.financial_movements 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own financial movements" 
ON public.financial_movements 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own financial movements" 
ON public.financial_movements 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create policies for recurring subscriptions
CREATE POLICY "Users can view their own subscriptions" 
ON public.recurring_subscriptions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own subscriptions" 
ON public.recurring_subscriptions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions" 
ON public.recurring_subscriptions 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions" 
ON public.recurring_subscriptions 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create triggers for updated_at
CREATE TRIGGER update_financial_movements_updated_at
BEFORE UPDATE ON public.financial_movements
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_recurring_subscriptions_updated_at
BEFORE UPDATE ON public.recurring_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();