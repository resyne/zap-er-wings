-- Fix: Aggiorna anche le righe RETTIFICA Ricavi (che hanno dare > 0 invece di avere)
UPDATE prima_nota_lines 
SET dynamic_account_key = 'CONTO_RICAVI'
WHERE description LIKE '%Ricavi%' 
  AND dynamic_account_key IS NULL;

-- Fix: Aggiorna anche le righe RETTIFICA Costi (che hanno avere > 0 invece di dare)
UPDATE prima_nota_lines 
SET dynamic_account_key = 'CONTO_COSTI'
WHERE description LIKE '%Costi%' 
  AND dynamic_account_key IS NULL;