-- Add UPDATE policy that was missing
CREATE POLICY "Allow all authenticated users to update bom_products"
  ON public.bom_products
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);