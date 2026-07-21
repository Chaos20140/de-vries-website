-- Einwilligungs-Protokoll (DSGVO-Nachweispflicht): haelt anonym fest, wann welche
-- Cookie-/Consent-Auswahl getroffen wurde. KEINE personenbezogenen Daten, KEINE IP.
create extension if not exists "pgcrypto";

create table if not exists public.devries_consents (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  client_id   uuid not null,                        -- zufaellige, browserseitig erzeugte ID (pseudonym, keine PII)
  version     int  not null,                        -- Version des Einwilligungstextes
  action      text not null,                        -- wie erteilt: all | necessary | custom | revoke
  choices     jsonb not null default '{}'::jsonb    -- z. B. {"maps": true}
);

create index if not exists idx_consents_client_time
  on public.devries_consents (client_id, created_at);

create index if not exists idx_consents_time
  on public.devries_consents (created_at);

-- RLS an, KEINE anon-Policies -> nur die Edge Function (Service Role) schreibt/liest.
-- Das Frontend spricht NIE direkt mit der Tabelle, nur ueber POST /consent.
alter table public.devries_consents enable row level security;
