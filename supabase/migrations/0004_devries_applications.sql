-- Bewerbungen (Initiativbewerbung + Bewerbung auf eine Stelle)
-- WICHTIG: Bewerberdaten sind besonders schutzbeduerftig. Die Tabelle bekommt
-- RLS OHNE jede Policy -> ueber die oeffentliche API (anon/authenticated) ist
-- weder Lesen noch Schreiben moeglich. Nur die Edge Function mit dem
-- Service-Role-Key darf schreiben/lesen.

create table if not exists devries_applications (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  -- Person
  first_name   text not null,
  last_name    text not null,
  birth_date   date,
  email        text not null,
  phone        text,
  -- Anschrift
  street       text,
  zip          text,
  city         text,
  -- Bewerbung
  position     text,                                   -- gewuenschte Taetigkeit
  license      text,                                   -- Fuehrerschein: "ja" | "nein" | Klasse
  available_from text,                                 -- frühestmoeglicher Start
  message      text,                                   -- Anschreiben
  files        jsonb not null default '[]'::jsonb,     -- [{name, path, size}]
  status       text not null default 'neu'             -- neu | gesichtet | erledigt
);

create index if not exists devries_applications_created_idx on devries_applications (created_at desc);

alter table devries_applications enable row level security;
-- bewusst KEINE Policy: damit ist der Zugriff ueber anon/authenticated komplett gesperrt.

-- Privater Storage-Bucket fuer die Unterlagen (Lebenslauf, Zeugnisse).
-- public = false -> Dateien sind NUR ueber zeitlich begrenzte, signierte Links erreichbar.
insert into storage.buckets (id, name, public)
values ('bewerbungen', 'bewerbungen', false)
on conflict (id) do nothing;
