-- Allow public read access to offers table for preview functionality
-- This allows anyone with the offer ID to view it (needed for PDF generation)
CREATE POLICY "Public read access for offer preview" 
ON public.offers 
FOR SELECT 
USING (true);

-- Note: This makes offers publicly readable. If you need more security,
-- you could add a token-based system or time-limited access