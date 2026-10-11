-- Add maintenance contracts to the existing Fieldnote database.
-- Run in Supabase SQL Editor before uploading the updated website.
begin;
create table if not exists public.fieldnote_contracts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  customer text not null check (length(trim(customer)) > 0),
  phone text not null default '', email text not null default '',
  location text not null default '',
  equipment text not null check (length(trim(equipment)) > 0),
  serial text not null default '',
  start_date date not null,
  end_date date not null check (end_date >= start_date),
  first_visit date not null check (first_visit >= start_date and first_visit <= end_date),
  interval_months integer not null check (interval_months in (3,4,6,12)),
  state text not null default 'Active' check (state in ('Active','Paused','Cancelled')),
  notes text not null default '',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.fieldnote_contracts enable row level security;
revoke all on public.fieldnote_contracts from anon, authenticated;
grant select, insert, update on public.fieldnote_contracts to authenticated;
drop policy if exists fieldnote_contract_read on public.fieldnote_contracts;
create policy fieldnote_contract_read on public.fieldnote_contracts for select to authenticated
using (exists (select 1 from public.fieldnote_members where user_id = (select auth.uid())));
drop policy if exists fieldnote_contract_create on public.fieldnote_contracts;
create policy fieldnote_contract_create on public.fieldnote_contracts for insert to authenticated
with check (exists (select 1 from public.fieldnote_members where user_id = (select auth.uid())));
drop policy if exists fieldnote_contract_edit on public.fieldnote_contracts;
create policy fieldnote_contract_edit on public.fieldnote_contracts for update to authenticated
using (exists (select 1 from public.fieldnote_members where user_id = (select auth.uid())))
with check (exists (select 1 from public.fieldnote_members where user_id = (select auth.uid())));
drop trigger if exists fieldnote_contract_audit on public.fieldnote_contracts;
create trigger fieldnote_contract_audit before insert or update on public.fieldnote_contracts
for each row execute function public.fieldnote_report_audit();

alter table public.fieldnote_reports add column if not exists maintenance_contract_id uuid references public.fieldnote_contracts(id);
alter table public.fieldnote_reports add column if not exists maintenance_due_date date;
create unique index if not exists fieldnote_one_report_per_visit
on public.fieldnote_reports (maintenance_contract_id, maintenance_due_date)
where maintenance_contract_id is not null;

create or replace function public.fieldnote_check_maintenance_report()
returns trigger language plpgsql set search_path = '' as $$
declare c public.fieldnote_contracts; month_count integer; expected date;
begin
  if (new.maintenance_contract_id is null) <> (new.maintenance_due_date is null) then
    raise exception 'A maintenance visit requires both a contract and due date.';
  end if;
  if tg_op = 'UPDATE' and (new.maintenance_contract_id is distinct from old.maintenance_contract_id
    or new.maintenance_due_date is distinct from old.maintenance_due_date) then
    raise exception 'A saved report cannot be reassigned to another maintenance visit.';
  end if;
  if new.maintenance_contract_id is not null then
    select * into c from public.fieldnote_contracts where id = new.maintenance_contract_id for update;
    if not found then raise exception 'Maintenance contract not found.'; end if;
    month_count := (extract(year from new.maintenance_due_date)::integer - extract(year from c.first_visit)::integer)*12
      + extract(month from new.maintenance_due_date)::integer - extract(month from c.first_visit)::integer;
    expected := (c.first_visit + pg_catalog.make_interval(months => month_count))::date;
    if new.action <> 'Maintenance' or new.maintenance_due_date < c.first_visit
      or new.maintenance_due_date > c.end_date or month_count % c.interval_months <> 0
      or new.maintenance_due_date <> expected then
      raise exception 'Report must match a scheduled Maintenance visit within the contract period.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists fieldnote_check_maintenance_report on public.fieldnote_reports;
create trigger fieldnote_check_maintenance_report before insert or update on public.fieldnote_reports
for each row execute function public.fieldnote_check_maintenance_report();

create or replace function public.fieldnote_protect_contract_history()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.fieldnote_reports where maintenance_contract_id = old.id) then
    if new.first_visit <> old.first_visit or new.interval_months <> old.interval_months then
      raise exception 'This contract has service reports. Create a new contract to change its schedule.';
    end if;
    if exists (select 1 from public.fieldnote_reports where maintenance_contract_id = old.id
      and (maintenance_due_date < new.start_date or maintenance_due_date > new.end_date)) then
      raise exception 'Contract dates must include all recorded maintenance visits.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists fieldnote_protect_contract_history on public.fieldnote_contracts;
create trigger fieldnote_protect_contract_history before update on public.fieldnote_contracts
for each row execute function public.fieldnote_protect_contract_history();
commit;
