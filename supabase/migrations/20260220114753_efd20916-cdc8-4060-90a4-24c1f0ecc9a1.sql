
-- Create production projects table
CREATE TABLE public.production_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'da_fare' CHECK (status IN ('da_fare', 'in_corso', 'chiuso', 'archiviato')),
  impact INTEGER CHECK (impact BETWEEN 1 AND 5),
  effort INTEGER CHECK (effort BETWEEN 1 AND 5),
  urgency INTEGER CHECK (urgency BETWEEN 1 AND 5),
  priority_score NUMERIC GENERATED ALWAYS AS (
    CASE WHEN impact IS NOT NULL AND effort IS NOT NULL 
    THEN ROUND((impact::numeric * 2 + COALESCE(urgency, 3)::numeric - effort::numeric) / 2, 1)
    ELSE NULL END
  ) STORED,
  assigned_to TEXT,
  design_request_id UUID REFERENCES public.design_requests(id) ON DELETE SET NULL,
  start_date DATE,
  due_date DATE,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.production_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view production projects"
  ON public.production_projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert production projects"
  ON public.production_projects FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update production projects"
  ON public.production_projects FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete production projects"
  ON public.production_projects FOR DELETE TO authenticated USING (true);

CREATE TRIGGER set_production_projects_updated_at
  BEFORE UPDATE ON public.production_projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
