-- Enable RLS on ddts table
ALTER TABLE ddts ENABLE ROW LEVEL SECURITY;

-- Policy for viewing DDTs by unique code (public access)
CREATE POLICY "Anyone can view DDT by unique code"
ON ddts
FOR SELECT
USING (unique_code IS NOT NULL);

-- Policy for creating DDTs (authenticated users only)
CREATE POLICY "Authenticated users can create DDTs"
ON ddts
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);