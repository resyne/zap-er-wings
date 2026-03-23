WITH normalized AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY
        movement_date,
        round(amount::numeric, 2),
        direction,
        substring(
          trim(
            regexp_replace(
              regexp_replace(
                lower(coalesce(description, '')),
                '(\s+cod\.?\s*disp\.?\s*.*$|\s+cash\s+.*$|\s+notprovided.*$|\s+not\s+provided.*$)',
                '',
                'g'
              ),
              '\s+',
              ' ',
              'g'
            )
          ),
          1,
          70
        )
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM public.bank_movements
)
DELETE FROM public.bank_movements b
USING normalized n
WHERE b.id = n.id
  AND n.rn > 1;