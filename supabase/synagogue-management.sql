-- Apply atomically BEFORE publishing synagogue.html. Safe to apply repeatedly.
-- Extends the five new management tables; no seating data is rewritten.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
create table if not exists public.synagogue_members (
  id uuid primary key default gen_random_uuid(),
  synagogue_id uuid not null references public.yamim_noraim_synagogues(id) on delete cascade,
  full_name text not null, family_name text, phone text, email text,
  role text not null default 'ישראל', status text not null default 'פעיל', notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.synagogue_prayers (
  id uuid primary key default gen_random_uuid(),
  synagogue_id uuid not null references public.yamim_noraim_synagogues(id) on delete cascade,
  service_date date not null, title text not null, service_time time, notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.synagogue_assignments (
  id uuid primary key default gen_random_uuid(),
  synagogue_id uuid not null references public.yamim_noraim_synagogues(id) on delete cascade,
  service_date date not null, duty text not null, member_id uuid, person_name text, notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.synagogue_events (
  id uuid primary key default gen_random_uuid(),
  synagogue_id uuid not null references public.yamim_noraim_synagogues(id) on delete cascade,
  event_date date not null, title text not null, kind text not null default 'אירוע', notes text,
  created_at timestamptz not null default now()
);
create table if not exists public.synagogue_finances (
  id uuid primary key default gen_random_uuid(),
  synagogue_id uuid not null references public.yamim_noraim_synagogues(id) on delete cascade,
  entry_date date not null, description text not null, member_id uuid, amount numeric(12,2) not null,
  status text not null default 'פתוח', notes text, created_at timestamptz not null default now()
);

-- Invoker trigger: keep record identity stable and increment the concurrency token.
create or replace function private.synagogue_record_version()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.synagogue_id is distinct from old.synagogue_id then
    raise exception 'Record identity and synagogue cannot be changed' using errcode = '23514';
  end if;
  new.created_at := old.created_at;
  new.version := old.version + 1;
  return new;
end;
$$;
revoke all on function private.synagogue_record_version() from public, anon, authenticated;

do $$ declare t text; begin
  foreach t in array array['synagogue_members','synagogue_prayers','synagogue_assignments','synagogue_events','synagogue_finances'] loop
    execute format('alter table public.%I add column if not exists version integer not null default 1', t);
    execute format('create index if not exists %I on public.%I (synagogue_id)', t || '_tenant_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', 'tenant admins manage ' || t, t);
    execute format('create policy %I on public.%I for all to authenticated
      using ((select auth.uid()) is not null and private.can_manage_yamim_noraim_synagogue(synagogue_id)
        and exists (select 1 from public.yamim_noraim_synagogues s where s.id = synagogue_id
          and (s.is_active or (select private.is_yamim_noraim_product_admin()))))
      with check ((select auth.uid()) is not null and private.can_manage_yamim_noraim_synagogue(synagogue_id)
        and exists (select 1 from public.yamim_noraim_synagogues s where s.id = synagogue_id
          and (s.is_active or (select private.is_yamim_noraim_product_admin()))))', 'tenant admins manage ' || t, t);
    execute format('drop trigger if exists synagogue_version on public.%I', t);
    execute format('create trigger synagogue_version before update on public.%I for each row execute function private.synagogue_record_version()', t);
    execute format('alter table public.%I drop constraint if exists management_notes_length', t);
    execute format('alter table public.%I add constraint management_notes_length check (notes is null or char_length(notes) <= 4000)', t);
  end loop;
end $$;

alter table public.synagogue_members drop constraint if exists member_role;
alter table public.synagogue_members drop constraint if exists management_member_values;
alter table public.synagogue_members add constraint management_member_values check (
  char_length(full_name) between 1 and 250 and full_name ~ '[^[:space:]]' and role in ('ישראל','כהן','לוי')
  and status in ('פעיל','לא פעיל') and coalesce(char_length(family_name),0) <= 250
  and coalesce(char_length(phone),0) <= 250 and coalesce(char_length(email),0) <= 250
);
create unique index if not exists synagogue_members_tenant_id_unique on public.synagogue_members (synagogue_id, id);
-- Composite references prevent linking a record to a member of a different synagogue.
-- Keep referenced people, including financial history; deactivate them instead of deleting.
alter table public.synagogue_assignments drop constraint if exists synagogue_assignments_member_id_fkey;
alter table public.synagogue_finances drop constraint if exists synagogue_finances_member_id_fkey;
alter table public.synagogue_assignments drop constraint if exists management_assignment_member;
alter table public.synagogue_assignments add constraint management_assignment_member
  foreign key (synagogue_id, member_id) references public.synagogue_members(synagogue_id, id) on delete restrict;
alter table public.synagogue_finances drop constraint if exists management_finance_member;
alter table public.synagogue_finances add constraint management_finance_member
  foreign key (synagogue_id, member_id) references public.synagogue_members(synagogue_id, id) on delete restrict;
create index if not exists synagogue_assignments_member_idx on public.synagogue_assignments (synagogue_id, member_id);
create index if not exists synagogue_finances_member_idx on public.synagogue_finances (synagogue_id, member_id);
alter table public.synagogue_prayers drop constraint if exists management_prayer_values;
alter table public.synagogue_prayers add constraint management_prayer_values check (
  char_length(title) between 1 and 250 and title ~ '[^[:space:]]' and service_date between date '1900-01-01' and date '2199-12-31'
  and (service_time is null or service_time < time '24:00')
);
alter table public.synagogue_assignments drop constraint if exists management_assignment_values;
alter table public.synagogue_assignments add constraint management_assignment_values check (
  char_length(duty) between 1 and 250 and duty ~ '[^[:space:]]' and service_date between date '1900-01-01' and date '2199-12-31'
  and coalesce(char_length(person_name),0) <= 250
  and (member_id is null or nullif(btrim(person_name),'') is null)
);
alter table public.synagogue_events drop constraint if exists management_event_values;
alter table public.synagogue_events add constraint management_event_values check (
  char_length(title) between 1 and 250 and title ~ '[^[:space:]]' and event_date between date '1900-01-01' and date '2199-12-31'
  and kind in ('אירוע','יארצייט','קידוש','שיעור')
);
alter table public.synagogue_finances drop constraint if exists management_finance_values;
alter table public.synagogue_finances add constraint management_finance_values check (
  char_length(description) between 1 and 250 and description ~ '[^[:space:]]' and entry_date between date '1900-01-01' and date '2199-12-31'
  and amount > 0 and amount <= 9999999999.99 and status in ('פתוח','שולם')
);
notify pgrst, 'reload schema';
commit;
