-- "Last updated" must reflect real edits only: a changed snapshot (user save) or a rename.
-- It must NOT change when a workbook is merely opened (first-open snapshot creation, null -> value)
-- or when bookkeeping columns change. Stored in UTC (timestamptz); the UI renders it in local time.
alter table public.workbooks add column if not exists import_notes jsonb;

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  if (old.snapshot is not null and new.snapshot is distinct from old.snapshot)
     or new.name is distinct from old.name then
    new.updated_at = now();
  else
    new.updated_at = old.updated_at;
  end if;
  return new;
end $$;
