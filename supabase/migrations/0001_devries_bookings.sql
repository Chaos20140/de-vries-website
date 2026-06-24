-- de Vries — Terminbuchung: Tabelle + RLS
-- Im Supabase-Dashboard unter SQL Editor einmal ausführen.

create extension if not exists "pgcrypto";

create table if not exists public.devries_bookings (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  service       text not null,                 -- gewählte Leistung
  appt_date     date not null,                 -- Termindatum (ISO yyyy-mm-dd)
  appt_date_de  text not null,                 -- Anzeige-Datum (z. B. "Mi. 24. Juni 2026")
  appt_time     text not null,                 -- Uhrzeit (z. B. "10:00")
  name          text not null,
  phone         text not null,
  email         text not null,
  message       text,
  status        text not null default 'pending'
                check (status in ('pending','confirmed','declined')),
  token         uuid not null default gen_random_uuid()  -- geheimer Link-Token für Bestätigen/Ablehnen
);

create index if not exists devries_bookings_slot_idx
  on public.devries_bookings (appt_date, appt_time, status);

-- RLS an, KEINE anon-Policies: nur die Edge Function (Service-Role) darf lesen/schreiben.
-- Das Frontend spricht NIE direkt mit der Tabelle, nur über die Function.
alter table public.devries_bookings enable row level security;
