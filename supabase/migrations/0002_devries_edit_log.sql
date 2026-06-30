-- Protokoll für den Inhalts-Editor: dient dem Rate-Limiting (Brute-Force-Schutz).
create table if not exists public.devries_edit_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  ip          text,
  ok          boolean not null default false
);

create index if not exists idx_edit_log_ip_time
  on public.devries_edit_log (ip, created_at);

-- RLS an, KEINE anon-Policies -> nur die Edge Function (Service Role) hat Zugriff.
alter table public.devries_edit_log enable row level security;
