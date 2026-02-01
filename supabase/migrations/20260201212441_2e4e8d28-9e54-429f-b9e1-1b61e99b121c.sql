
-- Fix translation language codes that were incorrectly set

-- 1. Update the Italian translation for step 1 (currently labeled as 'en' but has Italian content)
UPDATE lead_automation_step_translations
SET language_code = 'it'
WHERE id = '5669eeb0-42a3-4c7f-9079-c7bd980326b7';

-- 2. Update the Spanish translation for step 2 (currently labeled as 'en' but has Spanish content)  
UPDATE lead_automation_step_translations
SET language_code = 'es'
WHERE id = '3e1fe0c8-901a-4d02-a0be-c1995ed69876';

-- 3. Add Italian translation for step 2 (What really matters) if not exists
INSERT INTO lead_automation_step_translations (step_id, language_code, subject, html_content)
SELECT 
  '56195aaf-61ba-4091-bd39-5b613a269f98',
  'it',
  'Cosa conta davvero nella scelta di un forno professionale',
  (SELECT html_content FROM lead_automation_steps WHERE id = '56195aaf-61ba-4091-bd39-5b613a269f98')
WHERE NOT EXISTS (
  SELECT 1 FROM lead_automation_step_translations 
  WHERE step_id = '56195aaf-61ba-4091-bd39-5b613a269f98' AND language_code = 'it'
);
