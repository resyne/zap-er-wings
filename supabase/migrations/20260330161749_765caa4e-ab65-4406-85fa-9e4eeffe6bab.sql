-- Add place_id column for Google Maps deduplication
ALTER TABLE public.scraping_results ADD COLUMN IF NOT EXISTS place_id TEXT;

-- Create unique index on url to prevent duplicate scraping results
CREATE UNIQUE INDEX IF NOT EXISTS idx_scraping_results_url_unique ON public.scraping_results (url);

-- Index on place_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_scraping_results_place_id ON public.scraping_results (place_id) WHERE place_id IS NOT NULL;