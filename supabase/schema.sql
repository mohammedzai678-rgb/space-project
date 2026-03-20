create table if not exists public.mission_snapshots (
  id text primary key,
  state_json jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text not null default 'bootstrap'
);

create table if not exists public.mission_audit_log (
  id bigint generated always as identity primary key,
  action text not null,
  actor text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.mission_snapshots enable row level security;
alter table public.mission_audit_log enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mission_snapshots'
      and policyname = 'mission snapshots public read'
  ) then
    create policy "mission snapshots public read"
      on public.mission_snapshots
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'mission_audit_log'
      and policyname = 'mission audit public read'
  ) then
    create policy "mission audit public read"
      on public.mission_audit_log
      for select
      using (true);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'mission_snapshots'
  ) then
    alter publication supabase_realtime add table public.mission_snapshots;
  end if;
end
$$;

insert into public.mission_snapshots (id, state_json, updated_by)
values (
  'global',
  jsonb_build_object(
    'nextId', 1001,
    'nextLaunchId', 1,
    'nextCatastropheId', 1,
    'selectedSatelliteId', null,
    'satellites', jsonb_build_array(),
    'launches', jsonb_build_array(),
    'catastrophes', jsonb_build_array(),
    'changeAlerts', jsonb_build_array(),
    'theme', 'dark'
  ),
  'bootstrap'
)
on conflict (id) do nothing;
