-- Elimina tutti i call_records senza registrazione audio
DELETE FROM public.call_records WHERE recording_url IS NULL;