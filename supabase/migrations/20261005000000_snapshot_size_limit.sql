-- Hardening: RLS lets users write their own snapshot directly, so cap its size in the database too (8 MB).
alter table public.workbooks drop constraint if exists workbooks_snapshot_size;
alter table public.workbooks add constraint workbooks_snapshot_size
  check (snapshot is null or pg_column_size(snapshot) <= 8388608);
