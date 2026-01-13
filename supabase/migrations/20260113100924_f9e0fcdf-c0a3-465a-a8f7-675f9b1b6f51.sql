-- Corregge le date invertite: 2026-08-01 → 2026-01-08, 2026-07-01 → 2026-01-07
-- dove la data è nel futuro rispetto a created_at (segno che giorno/mese sono invertiti)

UPDATE public.call_records
SET call_date = MAKE_DATE(
    EXTRACT(YEAR FROM call_date)::int,
    EXTRACT(DAY FROM call_date)::int,   -- day becomes month
    EXTRACT(MONTH FROM call_date)::int  -- month becomes day
)
WHERE call_date > created_at::date
  AND EXTRACT(DAY FROM call_date) <= 12;