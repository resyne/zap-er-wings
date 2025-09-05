-- Create webhook_logs table for storing generic webhook data
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_type TEXT NOT NULL DEFAULT 'general',
  data JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'zapier',
  processed BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for webhook_logs
CREATE POLICY "Service role full access webhook logs" 
ON public.webhook_logs 
FOR ALL 
USING (true)
WITH CHECK (true);

CREATE POLICY "Users can view webhook logs" 
ON public.webhook_logs 
FOR SELECT 
USING (has_minimum_role(auth.uid(), 'user'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_webhook_logs_updated_at
BEFORE UPDATE ON public.webhook_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_webhook_logs_type_received ON public.webhook_logs (webhook_type, received_at DESC);
CREATE INDEX idx_webhook_logs_processed ON public.webhook_logs (processed, received_at DESC);