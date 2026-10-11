-- Run once in the Supabase SQL Editor for the Fieldnote project.
begin;

create table if not exists public.fieldnote_members (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.fieldnote_members enable row level security;
revoke all on public.fieldnote_members from anon, authenticated;
grant select on public.fieldnote_members to authenticated;
drop policy if exists fieldnote_self on public.fieldnote_members;
create policy fieldnote_self on public.fieldnote_members for select to authenticated
  using (user_id = (select auth.uid()));

create table if not exists public.fieldnote_reports (
  id uuid primary key default gen_random_uuid(),
  customer text not null check (length(trim(customer)) > 0),
  phone text not null default '',
  email text not null default '',
  contact text not null default '',
  location text not null default '',
  equipment text not null check (length(trim(equipment)) > 0),
  serial text not null default '',
  technician text not null check (length(trim(technician)) > 0),
  date date not null,
  action text not null check (action in ('Repair','Maintenance','Installation','Deliver','Others')),
  status text not null check (status in ('Completed','In progress','Follow-up')),
  notes text not null default '',
  parts text not null default '',
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);
create index if not exists fieldnote_reports_service_date on public.fieldnote_reports(date desc, created_at desc);
alter table public.fieldnote_reports enable row level security;
revoke all on public.fieldnote_reports from anon, authenticated;
grant select, insert, update on public.fieldnote_reports to authenticated;

create or replace function public.fieldnote_report_audit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists fieldnote_report_audit on public.fieldnote_reports;
create trigger fieldnote_report_audit before insert or update on public.fieldnote_reports
for each row execute function public.fieldnote_report_audit();

drop policy if exists fieldnote_read on public.fieldnote_reports;
create policy fieldnote_read on public.fieldnote_reports for select to authenticated
using (exists (select 1 from public.fieldnote_members where user_id = (select auth.uid())));
drop policy if exists fieldnote_create on public.fieldnote_reports;
create policy fieldnote_create on public.fieldnote_reports for insert to authenticated
with check (exists (select 1 from public.fieldnote_members where user_id = (select auth.uid())));
drop policy if exists fieldnote_edit on public.fieldnote_reports;
create policy fieldnote_edit on public.fieldnote_reports for update to authenticated
using (exists (select 1 from public.fieldnote_members where user_id = (select auth.uid())))
with check (exists (select 1 from public.fieldnote_members where user_id = (select auth.uid())));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fieldnote-photos','fieldnote-photos',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
drop policy if exists fieldnote_photo_read on storage.objects;
create policy fieldnote_photo_read on storage.objects for select to authenticated
using (bucket_id = 'fieldnote-photos' and exists (select 1 from public.fieldnote_members where user_id = (select auth.uid())));
drop policy if exists fieldnote_photo_upload on storage.objects;
create policy fieldnote_photo_upload on storage.objects for insert to authenticated
with check (bucket_id = 'fieldnote-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.fieldnote_members where user_id = (select auth.uid())));

commit;
