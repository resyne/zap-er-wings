-- Strategic Objectives table
CREATE TABLE public.strategic_objectives (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'active', 'completed', 'archived')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('oracle', 'manual')),
  impact TEXT DEFAULT 'medium' CHECK (impact IN ('low', 'medium', 'high')),
  effort TEXT DEFAULT 'medium' CHECK (effort IN ('low', 'medium', 'high')),
  risk_level TEXT DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high')),
  start_date DATE,
  target_date DATE,
  owner_id UUID,
  wise_analysis JSONB,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Key Results table
CREATE TABLE public.key_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  objective_id UUID NOT NULL REFERENCES public.strategic_objectives(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  unit TEXT NOT NULL,
  deadline DATE,
  status TEXT DEFAULT 'on_track' CHECK (status IN ('on_track', 'at_risk', 'off_track', 'completed')),
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Oracle Insights table
CREATE TABLE public.oracle_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  insight_type TEXT NOT NULL CHECK (insight_type IN ('opportunity', 'risk', 'bottleneck', 'blindspot')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  data_source TEXT,
  confidence INTEGER DEFAULT 70 CHECK (confidence >= 0 AND confidence <= 100),
  suggested_action TEXT,
  raw_data JSONB,
  is_dismissed BOOLEAN DEFAULT false,
  converted_to_objective_id UUID REFERENCES public.strategic_objectives(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strategic_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.key_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_insights ENABLE ROW LEVEL SECURITY;

-- Policies for strategic_objectives
CREATE POLICY "Users can view all strategic objectives" 
ON public.strategic_objectives FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create strategic objectives" 
ON public.strategic_objectives FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update strategic objectives" 
ON public.strategic_objectives FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete strategic objectives" 
ON public.strategic_objectives FOR DELETE USING (auth.uid() IS NOT NULL);

-- Policies for key_results
CREATE POLICY "Users can view all key results" 
ON public.key_results FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create key results" 
ON public.key_results FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update key results" 
ON public.key_results FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete key results" 
ON public.key_results FOR DELETE USING (auth.uid() IS NOT NULL);

-- Policies for oracle_insights
CREATE POLICY "Users can view all oracle insights" 
ON public.oracle_insights FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create oracle insights" 
ON public.oracle_insights FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update oracle insights" 
ON public.oracle_insights FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete oracle insights" 
ON public.oracle_insights FOR DELETE USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_strategic_objectives_updated_at
BEFORE UPDATE ON public.strategic_objectives
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_key_results_updated_at
BEFORE UPDATE ON public.key_results
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();