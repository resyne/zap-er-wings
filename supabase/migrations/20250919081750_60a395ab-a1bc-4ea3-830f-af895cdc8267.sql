-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Enable RLS on storage.buckets if not already enabled  
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy for buckets
DROP POLICY IF EXISTS "Public buckets are viewable by everyone" ON storage.buckets;
CREATE POLICY "Public buckets are viewable by everyone"
ON storage.buckets FOR SELECT
USING (true);