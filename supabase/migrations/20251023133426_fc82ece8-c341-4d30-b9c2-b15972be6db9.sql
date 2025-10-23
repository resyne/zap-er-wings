-- Add attachments column to sales_orders table
ALTER TABLE public.sales_orders 
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Add comment to column
COMMENT ON COLUMN public.sales_orders.attachments IS 'Array of attachment objects with path, name, size, and type';

-- Create order-files storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-files', 'order-files', false)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for order-files bucket
CREATE POLICY "Users can view order files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'order-files' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can upload order files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'order-files' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can update order files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'order-files' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can delete order files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'order-files' AND
  auth.uid() IS NOT NULL
);