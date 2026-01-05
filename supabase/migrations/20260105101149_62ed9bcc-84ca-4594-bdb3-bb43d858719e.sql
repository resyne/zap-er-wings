-- Enable deletion of 'generato' prima_nota movements for authenticated users
-- (needed for 'Da Correggere' / 'Annulla' flows when a movement is still in draft)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prima_nota'
      AND policyname = 'Authenticated users can delete generato prima_nota'
  ) THEN
    CREATE POLICY "Authenticated users can delete generato prima_nota"
    ON public.prima_nota
    FOR DELETE
    TO authenticated
    USING (auth.uid() IS NOT NULL AND status = 'generato');
  END IF;
END $$;