
-- Tabella richieste di progettazione per COEM SRL
CREATE TABLE public.design_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'nuovo' CHECK (status IN ('nuovo', 'stima_richiesta', 'accettata', 'in_lavorazione', 'revisione', 'completata')),
  estimated_hours NUMERIC,
  estimated_cost NUMERIC,
  estimate_notes TEXT,
  accepted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabella file allegati
CREATE TABLE public.design_request_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_request_id UUID NOT NULL REFERENCES public.design_requests(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabella commenti/messaggi
CREATE TABLE public.design_request_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  design_request_id UUID NOT NULL REFERENCES public.design_requests(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  content TEXT NOT NULL,
  is_supplier BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.design_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_request_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.design_request_comments ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can manage, anon can read/write for supplier portal
CREATE POLICY "Authenticated users full access on design_requests"
ON public.design_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon can view design_requests"
ON public.design_requests FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can update design_requests"
ON public.design_requests FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users full access on design_request_files"
ON public.design_request_files FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon can view design_request_files"
ON public.design_request_files FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert design_request_files"
ON public.design_request_files FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Authenticated users full access on design_request_comments"
ON public.design_request_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anon can view design_request_comments"
ON public.design_request_comments FOR SELECT TO anon USING (true);

CREATE POLICY "Anon can insert design_request_comments"
ON public.design_request_comments FOR INSERT TO anon WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER set_design_requests_updated_at
BEFORE UPDATE ON public.design_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket per file di progettazione
INSERT INTO storage.buckets (id, name, public) VALUES ('design-requests', 'design-requests', true);

-- Storage policies
CREATE POLICY "Anyone can view design request files"
ON storage.objects FOR SELECT USING (bucket_id = 'design-requests');

CREATE POLICY "Authenticated can upload design request files"
ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'design-requests');

CREATE POLICY "Anon can upload design request files"
ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'design-requests');

CREATE POLICY "Authenticated can delete design request files"
ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'design-requests');
