
CREATE TABLE public.management_commesse (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codice_commessa text NOT NULL,
  cliente text NOT NULL,
  descrizione text,
  stato text NOT NULL DEFAULT 'acquisita',
  data date NOT NULL DEFAULT CURRENT_DATE,
  ricavo numeric NOT NULL DEFAULT 0,
  costo_diretto_stimato numeric NOT NULL DEFAULT 0,
  margine_calcolato numeric GENERATED ALWAYS AS (ricavo - costo_diretto_stimato) STORED,
  note text,
  commessa_id uuid REFERENCES public.commesse(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.management_commesse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage management_commesse"
  ON public.management_commesse FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER set_management_commesse_updated_at
  BEFORE UPDATE ON public.management_commesse
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
