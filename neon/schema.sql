create table if not exists mission_snapshots (
  id text primary key,
  state_json jsonb not null,
  updated_at timestamptz not null default timezone('utc', now()),
  updated_by text not null default 'bootstrap'
);

create table if not exists mission_audit_log (
  id bigint generated always as identity primary key,
  action text not null,
  actor text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);
