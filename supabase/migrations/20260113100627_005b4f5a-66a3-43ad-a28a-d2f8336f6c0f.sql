-- Archivia i duplicati nella sezione Pre-Qualificato (status='new', archived=false)
-- e riallinea i call_records verso il lead "master" (più vecchio) per stesso telefono.

WITH base AS (
  SELECT
    id,
    created_at,
    regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') AS phone_digits
  FROM public.leads
  WHERE pre_qualificato = true
    AND status = 'new'
    AND archived = false
),
ranked AS (
  SELECT
    id,
    phone_digits,
    row_number() OVER (PARTITION BY phone_digits ORDER BY created_at ASC) AS rn,
    first_value(id) OVER (PARTITION BY phone_digits ORDER BY created_at ASC) AS keep_id
  FROM base
  WHERE phone_digits <> ''
),
dupes AS (
  SELECT id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.call_records cr
SET lead_id = d.keep_id
FROM dupes d
WHERE cr.lead_id = d.id;

WITH base AS (
  SELECT
    id,
    created_at,
    regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g') AS phone_digits
  FROM public.leads
  WHERE pre_qualificato = true
    AND status = 'new'
    AND archived = false
),
ranked AS (
  SELECT
    id,
    phone_digits,
    row_number() OVER (PARTITION BY phone_digits ORDER BY created_at ASC) AS rn
  FROM base
  WHERE phone_digits <> ''
)
UPDATE public.leads l
SET archived = true
FROM ranked r
WHERE l.id = r.id
  AND r.rn > 1;