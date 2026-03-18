-- Drop the existing restrictive delete policy
DROP POLICY IF EXISTS "Users can delete their own entries" ON accounting_entries;

-- Create a new policy: users can delete their own entries OR admins can delete any
CREATE POLICY "Users can delete own or admin can delete any"
ON accounting_entries
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id 
  OR public.has_role(auth.uid(), 'admin')
);