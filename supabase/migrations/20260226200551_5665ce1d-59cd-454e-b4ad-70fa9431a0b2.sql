-- Assegna Bruno alle chat Vesuviano inglesi (UK +44, Australia +61, India +91, US +1)
UPDATE whatsapp_conversations 
SET assigned_user_id = 'f69a7d31-8606-4d20-9e4c-2613c833867e'
WHERE account_id = '9d24956a-d020-485e-9c5b-8cce3e224508'
  AND assigned_user_id IS NULL
  AND (
    customer_phone LIKE '44%' OR customer_phone LIKE '+44%'
    OR customer_phone LIKE '61%' OR customer_phone LIKE '+61%'
    OR customer_phone LIKE '91%' OR customer_phone LIKE '+91%'
    OR customer_phone LIKE '1%' OR customer_phone LIKE '+1%'
  );

-- Assegna Flavia alle chat Vesuviano spagnole (Spagna +34, Colombia +57, Messico +52, ecc.)
UPDATE whatsapp_conversations 
SET assigned_user_id = '1db367ad-599d-48a5-9022-5ce368aa3e13'
WHERE account_id = '9d24956a-d020-485e-9c5b-8cce3e224508'
  AND assigned_user_id IS NULL
  AND (
    customer_phone LIKE '34%' OR customer_phone LIKE '+34%'
    OR customer_phone LIKE '52%' OR customer_phone LIKE '+52%'
    OR customer_phone LIKE '54%' OR customer_phone LIKE '+54%'
    OR customer_phone LIKE '56%' OR customer_phone LIKE '+56%'
    OR customer_phone LIKE '57%' OR customer_phone LIKE '+57%'
    OR customer_phone LIKE '58%' OR customer_phone LIKE '+58%'
  );