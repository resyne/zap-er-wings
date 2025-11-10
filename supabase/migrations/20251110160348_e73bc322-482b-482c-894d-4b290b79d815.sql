-- Create invoice_reminders table to track credit collection reminders
CREATE TABLE public.invoice_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_invoice_id UUID NOT NULL REFERENCES public.customer_invoices(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('email', 'whatsapp')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;

-- Create policies for invoice_reminders
CREATE POLICY "Users can view invoice reminders"
  ON public.invoice_reminders
  FOR SELECT
  USING (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Users can create invoice reminders"
  ON public.invoice_reminders
  FOR INSERT
  WITH CHECK (has_minimum_role(auth.uid(), 'user'::app_role));

CREATE POLICY "Service role full access invoice reminders"
  ON public.invoice_reminders
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_invoice_reminders_customer_invoice ON public.invoice_reminders(customer_invoice_id);
CREATE INDEX idx_invoice_reminders_created_at ON public.invoice_reminders(created_at DESC);