-- Create work_order_activities table for tracking production work order activities
CREATE TABLE IF NOT EXISTS public.work_order_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  activity_type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_order_activities ENABLE ROW LEVEL SECURITY;

-- Create policies for access
CREATE POLICY "Users can view work order activities" 
ON public.work_order_activities 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create work order activities" 
ON public.work_order_activities 
FOR INSERT 
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_work_order_activities_work_order_id ON public.work_order_activities(work_order_id);
CREATE INDEX idx_work_order_activities_created_at ON public.work_order_activities(created_at DESC);