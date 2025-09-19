-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Enable RLS on storage.buckets if not already enabled  
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Create policy for buckets if needed
CREATE POLICY IF NOT EXISTS "Public buckets are viewable by everyone"
ON storage.buckets FOR SELECT
USING (true);