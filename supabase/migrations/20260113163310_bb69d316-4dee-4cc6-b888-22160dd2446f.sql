-- Add DELETE policy for wasender_accounts
CREATE POLICY "Authenticated users can delete wasender accounts"
ON public.wasender_accounts
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Add DELETE policy for wasender_credit_transactions
CREATE POLICY "Authenticated users can delete wasender credit transactions"
ON public.wasender_credit_transactions
FOR DELETE
USING (auth.uid() IS NOT NULL);