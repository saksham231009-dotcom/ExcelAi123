-- Stores the live spreadsheet (Univer snapshot JSON) per workbook. Covered by the existing owner-only RLS policies.
alter table public.workbooks add column if not exists snapshot jsonb;
alter table public.workbooks add column if not exists snapshot_version integer not null default 0;
