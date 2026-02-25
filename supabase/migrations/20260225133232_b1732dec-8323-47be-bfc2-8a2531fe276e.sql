
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS show_in_warehouse boolean NOT NULL DEFAULT false;
