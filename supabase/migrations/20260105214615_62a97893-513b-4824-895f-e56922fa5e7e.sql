-- Aggiorna accounting_entries con event_type e iva_mode
UPDATE accounting_entries 
SET 
  event_type = 'costo',
  iva_mode = 'DOMESTICA_IMPONIBILE'
WHERE id = '7eb53db6-d524-4c17-aac3-04eb3d94c7bf';

-- Aggiorna prima_nota con amount negativo e iva_mode
UPDATE prima_nota 
SET 
  amount = -64.538,
  iva_mode = 'DOMESTICA_IMPONIBILE'
WHERE id = '6e5cb97d-518d-4dbd-9a21-1a85a8d26bcf';

-- Inserisci le linee di partita doppia
INSERT INTO prima_nota_lines (prima_nota_id, line_order, account_type, dynamic_account_key, chart_account_id, dare, avere, description)
VALUES 
  ('6e5cb97d-518d-4dbd-9a21-1a85a8d26bcf', 1, 'dynamic', 'DEBITI_FORNITORI', NULL, 0, 64.538, 'Debiti vs fornitori'),
  ('6e5cb97d-518d-4dbd-9a21-1a85a8d26bcf', 2, 'dynamic', 'CONTO_COSTI', NULL, 52.9, 0, 'Costi'),
  ('6e5cb97d-518d-4dbd-9a21-1a85a8d26bcf', 3, 'dynamic', 'IVA_CREDITO', NULL, 11.638, 0, 'IVA a credito 22%');