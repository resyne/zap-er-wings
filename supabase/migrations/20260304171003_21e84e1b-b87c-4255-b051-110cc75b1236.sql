
-- Elimina logs dell'ordine
DELETE FROM sales_order_logs WHERE sales_order_id = '504e2f72-b75e-4020-88c9-42896ebe921d';

-- Elimina l'ordine
DELETE FROM sales_orders WHERE id = '504e2f72-b75e-4020-88c9-42896ebe921d';

-- Ripristina l'offerta come "accettata" (pronta per conversione)
UPDATE offers SET status = 'accettata', archived = false WHERE id = '7010f14a-4c7a-4d6e-845b-1e04d471225b';
