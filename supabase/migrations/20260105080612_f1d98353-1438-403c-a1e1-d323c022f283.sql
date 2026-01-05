-- Add DELETE policy for ddts table
CREATE POLICY "Users can delete DDTs" 
ON public.ddts 
FOR DELETE 
USING (true);