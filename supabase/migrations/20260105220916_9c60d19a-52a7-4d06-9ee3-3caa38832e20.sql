-- Aggiorna accounting_entries come pagata
UPDATE accounting_entries 
SET 
  financial_status = 'pagata',
  payment_date = '2026-01-02',
  payment_method = 'carta'
WHERE id = '7eb53db6-d524-4c17-aac3-04eb3d94c7bf';

-- Aggiorna prima_nota come pagata
UPDATE prima_nota 
SET 
  payment_method = 'carta'
WHERE id = '6e5cb97d-518d-4dbd-9a21-1a85a8d26bcf';

-- Elimina le vecchie linee di prima nota
DELETE FROM prima_nota_lines 
WHERE prima_nota_id = '6e5cb97d-518d-4dbd-9a21-1a85a8d26bcf';

-- Inserisci le nuove linee con partita doppia corretta per fattura PAGATA
-- Fattura acquisto pagata: Costi + IVA in DARE, Carta in AVERE
INSERT INTO prima_nota_lines (prima_nota_id, line_order, account_type, dynamic_account_key, chart_account_id, dare, avere, description)
VALUES 
  ('6e5cb97d-518d-4dbd-9a21-1a85a8d26bcf', 1, 'dynamic', 'CONTO_COSTI', NULL, 52.9, 0, 'Costi'),
  ('6e5cb97d-518d-4dbd-9a21-1a85a8d26bcf', 2, 'dynamic', 'IVA_CREDITO', NULL, 11.638, 0, 'IVA a credito 22%'),
  ('6e5cb97d-518d-4dbd-9a21-1a85a8d26bcf', 3, 'dynamic', 'CARTA', NULL, 0, 64.538, 'Pagamento con carta');