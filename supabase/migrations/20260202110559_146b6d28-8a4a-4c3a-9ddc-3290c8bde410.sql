-- Update page visibility for Flavia to allow WhatsApp access
UPDATE user_page_visibility 
SET is_visible = true, updated_at = now() 
WHERE user_id = '1db367ad-599d-48a5-9022-5ce368aa3e13' 
  AND page_url = '/crm/whatsapp';

-- If no row exists, insert it
INSERT INTO user_page_visibility (user_id, page_url, is_visible)
SELECT '1db367ad-599d-48a5-9022-5ce368aa3e13', '/crm/whatsapp', true
WHERE NOT EXISTS (
  SELECT 1 FROM user_page_visibility 
  WHERE user_id = '1db367ad-599d-48a5-9022-5ce368aa3e13' 
    AND page_url = '/crm/whatsapp'
);