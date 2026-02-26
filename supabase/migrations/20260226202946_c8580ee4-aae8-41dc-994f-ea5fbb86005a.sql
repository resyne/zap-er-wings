-- Assegna Bruno alle restanti chat Vesuviano non assegnate
UPDATE whatsapp_conversations 
SET assigned_user_id = 'f69a7d31-8606-4d20-9e4c-2613c833867e'
WHERE account_id = '9d24956a-d020-485e-9c5b-8cce3e224508'
  AND assigned_user_id IS NULL;