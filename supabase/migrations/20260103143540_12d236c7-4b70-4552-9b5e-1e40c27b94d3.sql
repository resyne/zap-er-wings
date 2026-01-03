-- Fix RLS policies per scadenze
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.scadenze;
DROP POLICY IF EXISTS "Allow all for authenticated users" ON public.scadenza_movimenti;

CREATE POLICY "Authenticated users can do all" ON public.scadenze
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can do all" ON public.scadenza_movimenti
  FOR ALL USING (auth.uid() IS NOT NULL);