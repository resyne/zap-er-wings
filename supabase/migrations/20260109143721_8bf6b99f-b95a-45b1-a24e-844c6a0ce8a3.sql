-- Add project_id to key_results to link KRs to Projects
ALTER TABLE public.key_results 
ADD COLUMN project_id UUID REFERENCES public.management_projects(id) ON DELETE SET NULL;

-- Add index for better query performance
CREATE INDEX idx_key_results_project_id ON public.key_results(project_id);

-- Add key_result_id to management_projects for reverse lookup (optional direct link)
ALTER TABLE public.management_projects 
ADD COLUMN key_result_id UUID REFERENCES public.key_results(id) ON DELETE SET NULL;

-- Add objective_id to management_projects for direct access to the objective
ALTER TABLE public.management_projects 
ADD COLUMN objective_id UUID REFERENCES public.strategic_objectives(id) ON DELETE SET NULL;

-- Add period to strategic_objectives (Q1, Q2, Q3, Q4 + year)
ALTER TABLE public.strategic_objectives 
ADD COLUMN quarter TEXT;

ALTER TABLE public.strategic_objectives 
ADD COLUMN year INTEGER;

-- Add index for quarter filtering
CREATE INDEX idx_strategic_objectives_quarter_year ON public.strategic_objectives(year, quarter);