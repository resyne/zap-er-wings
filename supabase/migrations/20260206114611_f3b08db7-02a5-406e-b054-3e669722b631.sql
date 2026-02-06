-- Tabella per tracciare la presenza online degli utenti
CREATE TABLE public.user_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all presence data
CREATE POLICY "Users can view all presence" 
ON public.user_presence 
FOR SELECT 
TO authenticated
USING (true);

-- Policy: Users can update their own presence
CREATE POLICY "Users can update own presence" 
ON public.user_presence 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own presence
CREATE POLICY "Users can insert own presence" 
ON public.user_presence 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Tabella per impostazioni notifiche WhatsApp
CREATE TABLE public.whatsapp_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES public.whatsapp_accounts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notify_on_message BOOLEAN NOT NULL DEFAULT true,
  email_when_offline BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(account_id, user_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_notification_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can view settings
CREATE POLICY "Users can view notification settings" 
ON public.whatsapp_notification_settings 
FOR SELECT 
TO authenticated
USING (true);

-- Policy: Authenticated users can manage settings
CREATE POLICY "Users can manage notification settings" 
ON public.whatsapp_notification_settings 
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

-- Funzione per aggiornare updated_at
CREATE TRIGGER update_user_presence_updated_at
BEFORE UPDATE ON public.user_presence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Funzione per upsert presenza utente
CREATE OR REPLACE FUNCTION public.upsert_user_presence(p_user_id UUID, p_is_online BOOLEAN)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_presence (user_id, is_online, last_seen_at, updated_at)
  VALUES (p_user_id, p_is_online, now(), now())
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    is_online = p_is_online,
    last_seen_at = now(),
    updated_at = now();
END;
$$;

-- Funzione per ottenere utenti online da notificare per un account WhatsApp
CREATE OR REPLACE FUNCTION public.get_whatsapp_notification_recipients(p_account_id UUID)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  is_online BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    wns.user_id,
    p.email,
    COALESCE(up.is_online, false) as is_online
  FROM whatsapp_notification_settings wns
  JOIN profiles p ON p.id = wns.user_id
  LEFT JOIN user_presence up ON up.user_id = wns.user_id
  WHERE wns.account_id = p_account_id
    AND wns.notify_on_message = true;
$$;