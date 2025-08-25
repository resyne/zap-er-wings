-- Update opportunity_activities to support user assignment if not already done
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'opportunity_activities' 
        AND column_name = 'assigned_to'
    ) THEN
        ALTER TABLE public.opportunity_activities 
        ADD COLUMN assigned_to UUID REFERENCES public.profiles(id);
    END IF;
END $$;

-- Create requests table for general task management
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  assigned_to UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on requests if not already enabled
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c 
        JOIN pg_namespace n ON n.oid = c.relnamespace 
        WHERE c.relname = 'requests' AND n.nspname = 'public' AND c.relrowsecurity = true
    ) THEN
        ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Create policies for requests (drop existing ones first to avoid conflicts)
DROP POLICY IF EXISTS "Users can view requests assigned to them or created by them" ON public.requests;
DROP POLICY IF EXISTS "Users can create requests" ON public.requests;
DROP POLICY IF EXISTS "Users can update requests assigned to them or created by them" ON public.requests;

CREATE POLICY "Users can view requests assigned to them or created by them" 
ON public.requests 
FOR SELECT 
USING (auth.uid() = assigned_to OR auth.uid() = created_by);

CREATE POLICY "Users can create requests" 
ON public.requests 
FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update requests assigned to them or created by them" 
ON public.requests 
FOR UPDATE 
USING (auth.uid() = assigned_to OR auth.uid() = created_by);

-- Create updated_at trigger for requests if it doesn't exist
DROP TRIGGER IF EXISTS update_requests_updated_at ON public.requests;
CREATE TRIGGER update_requests_updated_at
  BEFORE UPDATE ON public.requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();