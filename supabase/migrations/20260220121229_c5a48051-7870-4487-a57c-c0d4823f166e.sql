
-- Tasks for production projects
CREATE TABLE public.production_project_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.production_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT false,
  assigned_to TEXT,
  due_date DATE,
  sort_order INT NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.production_project_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage project tasks" ON public.production_project_tasks FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Comments for production projects
CREATE TABLE public.production_project_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.production_projects(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.production_project_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can manage project comments" ON public.production_project_comments FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Activity log for production projects
CREATE TABLE public.production_project_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.production_projects(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.production_project_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can view project activity" ON public.production_project_activity_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can insert project activity" ON public.production_project_activity_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
