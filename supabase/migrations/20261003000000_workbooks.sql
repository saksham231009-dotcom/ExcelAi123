-- ExcelAI: workbooks table, private storage bucket, and ownership-based RLS.
-- Run in Supabase Dashboard -> SQL Editor (or `supabase db push`).

create table if not exists public.workbooks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  file_type   text not null check (file_type in ('blank', 'xlsx', 'csv')),
  storage_path text,
  size_bytes  bigint not null default 0 check (size_bytes >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- uploaded files must have a path inside the owner's folder; blank ones must not
  constraint workbooks_path_matches_type check (
    (file_type = 'blank' and storage_path is null) or
    (file_type <> 'blank' and storage_path like owner_id::text || '/%')
  )
);

create index if not exists workbooks_owner_updated_idx on public.workbooks (owner_id, updated_at desc);

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists workbooks_set_updated_at on public.workbooks;
create trigger workbooks_set_updated_at before update on public.workbooks
  for each row execute function public.set_updated_at();

alter table public.workbooks enable row level security;

drop policy if exists "workbooks_select_own" on public.workbooks;
drop policy if exists "workbooks_insert_own" on public.workbooks;
drop policy if exists "workbooks_update_own" on public.workbooks;
drop policy if exists "workbooks_delete_own" on public.workbooks;

create policy "workbooks_select_own" on public.workbooks for select to authenticated
  using (owner_id = (select auth.uid()));
create policy "workbooks_insert_own" on public.workbooks for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "workbooks_update_own" on public.workbooks for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "workbooks_delete_own" on public.workbooks for delete to authenticated
  using (owner_id = (select auth.uid()));

-- Private bucket: 5 MB limit, spreadsheet MIME types only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workbooks', 'workbooks', false, 5242880,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv'])
on conflict (id) do update set public = false, file_size_limit = 5242880,
  allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies: each user may only touch objects in a folder named after their user id.
drop policy if exists "workbooks_obj_select_own" on storage.objects;
drop policy if exists "workbooks_obj_insert_own" on storage.objects;
drop policy if exists "workbooks_obj_update_own" on storage.objects;
drop policy if exists "workbooks_obj_delete_own" on storage.objects;

create policy "workbooks_obj_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'workbooks' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "workbooks_obj_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'workbooks' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "workbooks_obj_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'workbooks' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'workbooks' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "workbooks_obj_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'workbooks' and (storage.foldername(name))[1] = (select auth.uid())::text);
