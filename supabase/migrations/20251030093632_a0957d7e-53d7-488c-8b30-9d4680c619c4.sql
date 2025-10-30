-- Aggiungi policy per accesso pubblico ai DDT tramite unique_code
CREATE POLICY "Allow public read access to DDTs by unique code"
ON public.ddts
FOR SELECT
TO anon
USING (true);