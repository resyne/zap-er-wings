-- Add new fields to offers table for enhanced templates
ALTER TABLE offers 
ADD COLUMN IF NOT EXISTS timeline_produzione text DEFAULT '2-3 settimane',
ADD COLUMN IF NOT EXISTS timeline_consegna text DEFAULT '3-5 giorni',
ADD COLUMN IF NOT EXISTS timeline_installazione text DEFAULT '1 giorno',
ADD COLUMN IF NOT EXISTS timeline_collaudo text DEFAULT '1 giorno',
ADD COLUMN IF NOT EXISTS incluso_fornitura text,
ADD COLUMN IF NOT EXISTS metodi_pagamento text DEFAULT '30% acconto - 70% alla consegna';