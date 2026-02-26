-- Add new event types for purchase orders
ALTER TYPE notification_event_type ADD VALUE IF NOT EXISTS 'nuovo_ordine_acquisto';
ALTER TYPE notification_event_type ADD VALUE IF NOT EXISTS 'cambio_stato_ordine_acquisto';