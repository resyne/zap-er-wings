-- Create strategic_visions table
CREATE TABLE public.strategic_visions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revised', 'archived')),
  start_date DATE NOT NULL,
  end_date DATE,
  observation_kpis JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create strategic_focus table
CREATE TABLE public.strategic_focus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vision_id UUID REFERENCES public.strategic_visions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add focus_id to strategic_objectives to link OKR to Focus
ALTER TABLE public.strategic_objectives 
ADD COLUMN focus_id UUID REFERENCES public.strategic_focus(id) ON DELETE SET NULL;

-- Add scope (areas involved/excluded)
ALTER TABLE public.strategic_objectives
ADD COLUMN scope_included TEXT[] DEFAULT '{}',
ADD COLUMN scope_excluded TEXT[] DEFAULT '{}';

-- Enable RLS
ALTER TABLE public.strategic_visions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strategic_focus ENABLE ROW LEVEL SECURITY;

-- Create policies for strategic_visions
CREATE POLICY "Users can view strategic visions" 
ON public.strategic_visions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create strategic visions" 
ON public.strategic_visions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update strategic visions" 
ON public.strategic_visions FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete strategic visions" 
ON public.strategic_visions FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create policies for strategic_focus
CREATE POLICY "Users can view strategic focus" 
ON public.strategic_focus FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create strategic focus" 
ON public.strategic_focus FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update strategic focus" 
ON public.strategic_focus FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete strategic focus" 
ON public.strategic_focus FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create indexes
CREATE INDEX idx_strategic_focus_vision_id ON public.strategic_focus(vision_id);
CREATE INDEX idx_strategic_objectives_focus_id ON public.strategic_objectives(focus_id);