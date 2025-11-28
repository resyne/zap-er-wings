-- Enable real-time updates for purchase_order_comments table
ALTER TABLE public.purchase_order_comments REPLICA IDENTITY FULL;

-- Add purchase_order_comments table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_order_comments;