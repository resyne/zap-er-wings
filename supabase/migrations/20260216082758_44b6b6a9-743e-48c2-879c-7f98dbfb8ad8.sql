ALTER TABLE public.suppliers ADD COLUMN contact_phone text;
ALTER TABLE public.suppliers ADD COLUMN notify_whatsapp boolean DEFAULT false;