-- Fix: aggiorna l'ordine Annalisa da draft a commissionato
UPDATE sales_orders SET status = 'commissionato', updated_at = now() WHERE id = '2f50fed4-8d6a-4f6e-b568-00b69bb1c64b' AND status = 'draft';