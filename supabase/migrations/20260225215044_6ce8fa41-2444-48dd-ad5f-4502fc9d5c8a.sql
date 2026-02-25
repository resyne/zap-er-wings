
-- Add missing phases to existing commesse
INSERT INTO public.commessa_phases (commessa_id, phase_type, phase_order, status)
VALUES 
  -- Antonio Miele: add installazione
  ('0953acfa-fce4-4db9-af4d-4b0cef294258', 'installazione', 2, 'da_fare'),
  -- Ferdinando Vesi: add installazione
  ('5bd79803-8b07-4643-aafa-0cbab61df2d6', 'installazione', 2, 'da_fare'),
  -- lo porto: add spedizione
  ('6ae58544-b95c-4729-aa76-08541a7896ec', 'spedizione', 2, 'da_preparare'),
  -- Panificio Tramonti: add installazione
  ('6ad65158-f7b1-480c-b28d-a0f6354cd803', 'installazione', 2, 'da_fare');
