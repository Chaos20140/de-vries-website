-- Kontaktanfragen (Nachrichten aus dem Kontaktformular)
-- Bisher wurden sie ausschliesslich per E-Mail verschickt. Fuer die Verwaltung
-- im Adminbereich werden sie zusaetzlich gespeichert.
-- Wie bei den Bewerbungen: RLS OHNE jede Policy -> ueber die oeffentliche API
-- (anon/authenticated) weder les- noch schreibbar. Nur die Edge Function mit
-- dem Service-Role-Key kommt heran.

create table if not exists devries_contacts (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null,
  email      text not null,
  message    text not null,
  status     text not null default 'neu'   -- neu | gesichtet | erledigt
);

create index if not exists devries_contacts_created_idx on devries_contacts (created_at desc);

alter table devries_contacts enable row level security;
-- bewusst KEINE Policy.
