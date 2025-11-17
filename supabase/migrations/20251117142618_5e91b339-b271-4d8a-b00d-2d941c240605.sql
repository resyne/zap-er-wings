-- Crea bucket Storage per prodotti
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-media',
  'product-media',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
);

-- Policy per permettere a tutti di vedere i file
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-media');

-- Policy per permettere agli utenti autenticati di caricare file
CREATE POLICY "Authenticated users can upload product media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-media' 
  AND auth.uid() IS NOT NULL
);

-- Policy per permettere agli utenti autenticati di aggiornare i loro file
CREATE POLICY "Authenticated users can update product media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-media' 
  AND auth.uid() IS NOT NULL
)
WITH CHECK (
  bucket_id = 'product-media' 
  AND auth.uid() IS NOT NULL
);

-- Policy per permettere agli utenti autenticati di eliminare file
CREATE POLICY "Authenticated users can delete product media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-media' 
  AND auth.uid() IS NOT NULL
);