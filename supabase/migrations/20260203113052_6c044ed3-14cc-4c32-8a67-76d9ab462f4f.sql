-- Fix Spanish (ES) template with correct translation
UPDATE public.whatsapp_templates 
SET components = '[{"type": "BODY", "text": "Hola {{1}},\n\nte escribo desde Vesuviano, los fabricantes italianos de hornos napolitanos profesionales.\n\nHace algún tiempo nos pediste información\nsobre un horno de Italia.\n¿El proyecto sigue en evaluación?"}]'::jsonb
WHERE id = 'c3618a86-f272-4484-9774-371892f00596';

-- Also fix French template (mixed Italian "Ciao" + French text)
UPDATE public.whatsapp_templates 
SET components = '[{"type": "BODY", "text": "Bonjour {{1}},\n\nje vous écris de Vesuviano, les fabricants italiens de fours napolitains professionnels.\n\nIl y a quelque temps, vous nous aviez demandé des informations\npour un four d''Italie.\nLe projet est-il toujours en cours d''évaluation ?"}]'::jsonb
WHERE id = 'c95c331a-0253-47bd-af75-4c01c342f763';