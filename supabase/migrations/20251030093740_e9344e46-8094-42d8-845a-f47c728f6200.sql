-- Aggiungi policy per permettere agli utenti di aggiornare i DDT che hanno creato
CREATE POLICY "Users can update their own DDTs"
ON public.ddts
FOR UPDATE
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);