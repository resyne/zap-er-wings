create or replace function public.normalize_bank_movement_text(input_text text)
returns text
language sql
immutable
as $$
  select substring(
    trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            lower(coalesce(input_text, '')),
            '(\s+cod\.?\s*disp\.?\s*.*$|\s+cash\s+.*$|\s+notprovided.*$|\s+not\s+provided.*$)',
            '',
            'g'
          ),
          '\s+',
          ' ',
          'g'
        ),
        '[^a-z0-9 ]',
        '',
        'g'
      )
    ),
    1,
    90
  );
$$;

with ranked as (
  select
    id,
    row_number() over (
      partition by
        coalesce(imported_by, '00000000-0000-0000-0000-000000000000'::uuid),
        movement_date,
        round(amount::numeric, 2),
        direction,
        public.normalize_bank_movement_text(description)
      order by
        case status
          when 'matched' then 0
          when 'partial' then 1
          when 'suggested' then 2
          else 3
        end,
        created_at asc,
        id asc
    ) as rn
  from public.bank_movements
)
delete from public.bank_movements b
using ranked r
where b.id = r.id
  and r.rn > 1;

create unique index if not exists bank_movements_dedupe_guard_idx
on public.bank_movements (
  coalesce(imported_by, '00000000-0000-0000-0000-000000000000'::uuid),
  movement_date,
  round(amount::numeric, 2),
  direction,
  public.normalize_bank_movement_text(description)
);