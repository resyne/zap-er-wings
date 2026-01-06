-- Fix: Aggiorna le righe Ricavi esistenti con dynamic_account_key mancante
UPDATE prima_nota_lines 
SET dynamic_account_key = 'CONTO_RICAVI'
WHERE description LIKE '%Ricavi%' 
  AND dynamic_account_key IS NULL
  AND avere > 0;

-- Fix: Aggiorna le righe Costi esistenti con dynamic_account_key mancante  
UPDATE prima_nota_lines 
SET dynamic_account_key = 'CONTO_COSTI'
WHERE description LIKE '%Costi%' 
  AND dynamic_account_key IS NULL
  AND dare > 0;