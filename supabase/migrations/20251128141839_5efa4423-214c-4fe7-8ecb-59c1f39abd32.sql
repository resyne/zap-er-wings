-- Enable real-time updates for materials table
ALTER TABLE public.materials REPLICA IDENTITY FULL;

-- Add materials table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.materials;