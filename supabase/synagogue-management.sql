-- Synagogue management records, isolated by the existing synagogue admin rule.
create table if not exists public.synagogue_members (
  id uuid primary key default gen_random_uuid(), synagogue_id uuid not null references public.yamim_noraim_synagogues(id) on delete cascade,
  full_name text not null, family_name text, phone text, email text, role text not null default 'ישראל',
  status text not null default 'פעיל', notes text, created_at timestamptz not null default now(),
  constraint member_role check (role in ('כהן','לוי','ישראל'))
);
create table if not exists public.synagogue_prayers (
  id uuid primary key default gen_random_uuid(), synagogue_id uuid not null references public.yamim_noraim_synagogues(id) on delete cascade,
  service_date date not null, title text not null, service_time time, notes text, created_at timestamptz not null default now()
);
create table if not exists public.synagogue_assignments (
  id uuid primary key default gen_random_uuid(), synagogue_id uuid not null references public.yamim_noraim_synagogues(id) on delete cascade,
  service_date date not null, duty text not null, member_id uuid references public.synagogue_members(id) on delete set null,
  person_name text, notes text, created_at timestamptz not null default now()
);
create table if not exists public.synagogue_events (
  id uuid primary key default gen_random_uuid(), synagogue_id uuid not null references public.yamim_noraim_synagogues(id) on delete cascade,
  event_date date not null, title text not null, kind text not null default 'אירוע', notes text, created_at timestamptz not null default now()
);
create table if not exists public.synagogue_finances (
  id uuid primary key default gen_random_uuid(), synagogue_id uuid not null references public.yamim_noraim_synagogues(id) on delete cascade,
  entry_date date not null, description text not null, member_id uuid references public.synagogue_members(id) on delete set null,
  amount numeric(12,2) not null, status text not null default 'פתוח', notes text, created_at timestamptz not null default now()
);
do $$ declare t text; begin
  foreach t in array array['synagogue_members','synagogue_prayers','synagogue_assignments','synagogue_events','synagogue_finances'] loop
    execute format('create index if not exists %I on public.%I (synagogue_id)', t || '_tenant_idx',t);
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon',t);
    execute format('grant select,insert,update,delete on public.%I to authenticated',t);
    execute format('create policy %I on public.%I for all to authenticated using (private.can_manage_yamim_noraim_synagogue(synagogue_id)) with check (private.can_manage_yamim_noraim_synagogue(synagogue_id))', 'tenant admins manage ' || t,t);
  end loop;
end $$;
