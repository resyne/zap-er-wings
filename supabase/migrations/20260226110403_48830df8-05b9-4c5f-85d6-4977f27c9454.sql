
-- Enum for notification event types
CREATE TYPE public.notification_event_type AS ENUM (
  'nuova_commessa',
  'cambio_stato_commessa',
  'nuovo_ordine',
  'scadenza_imminente'
);

-- Enum for notification channels
CREATE TYPE public.notification_channel AS ENUM (
  'whatsapp',
  'email'
);

-- Table for notification rules (per-event, per-channel, per-recipient)
CREATE TABLE public.zapp_notification_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type notification_event_type NOT NULL,
  channel notification_channel NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT,
  recipient_email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.zapp_notification_rules ENABLE ROW LEVEL SECURITY;

-- Only admins can manage notification rules
CREATE POLICY "Admins can manage notification rules"
  ON public.zapp_notification_rules
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER set_zapp_notification_rules_updated_at
  BEFORE UPDATE ON public.zapp_notification_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Constraint: at least one contact method
ALTER TABLE public.zapp_notification_rules
  ADD CONSTRAINT check_contact_method
  CHECK (recipient_phone IS NOT NULL OR recipient_email IS NOT NULL);
