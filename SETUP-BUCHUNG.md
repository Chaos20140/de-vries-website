# Terminbuchung mit Supabase aktivieren

So wird aus der einfachen `mailto`-Anfrage ein echtes Buchungssystem:
**du bekommst eine E-Mail mit „✅ Bestätigen / ❌ Ablehnen"**, und bestätigte
Termine sperren automatisch den Zeit-Slot auf der Website.

> Solange Schritt 6 nicht erledigt ist, läuft alles weiter über `mailto`
> (öffnet dein E-Mail-Programm). Es geht also nichts kaputt, während du einrichtest.

## ✅ Status (von Claude bereits erledigt am 25.06.2026)
Projekt **de-vries** (`vxwjgxdlnwhatnbhjabw`, Frankfurt) angelegt, Tabelle migriert,
Edge Function `devries-booking` deployed (`--no-verify-jwt`), `OWNER_EMAIL` gesetzt,
`booking-config.js` mit URL+anon-Key gefüllt → **Backend ist live und getestet**
(Anfrage speichern, Bestätigen/Ablehnen, Slot-Sperre – alles geprüft).

**Es fehlt nur noch EINE Sache von dir: der Resend-API-Key**, damit die
Benachrichtigungs-E-Mail wirklich verschickt wird. Bis dahin wird jede Anfrage zwar
gespeichert (siehst du in Supabase → Table Editor → `devries_bookings`), aber du
bekommst noch keine Mail. So aktivierst du die Mail:
1. Auf https://resend.com einloggen → **API Keys** → Key erstellen & kopieren.
2. Im Terminal (irgendwo):
   ```bash
   supabase secrets set RESEND_API_KEY=DEIN_KEY --project-ref vxwjgxdlnwhatnbhjabw
   ```
   Fertig – ab dann kommt bei jeder Anfrage die E-Mail mit Bestätigen/Ablehnen.
   (Resend Free-Tarif schickt ohne verifizierte Domain nur an die E-Mail deines
   Resend-Kontos – das passt, weil `OWNER_EMAIL` darauf zeigt.)

---

## 1. Supabase-Projekt anlegen
1. Auf https://supabase.com einloggen → **New project** (Region z. B. *Frankfurt*).
2. Projektname z. B. `de-vries`. Datenbank-Passwort vergeben & merken.
3. Warten, bis das Projekt bereit ist.

## 2. Datenbank-Tabelle anlegen
1. Im Projekt: **SQL Editor** → **New query**.
2. Inhalt von [`supabase/migrations/0001_devries_bookings.sql`](supabase/migrations/0001_devries_bookings.sql) einfügen → **Run**.
   (Legt die Tabelle `devries_bookings` an, mit aktiviertem RLS.)

## 3. Resend für den E-Mail-Versand
1. Auf https://resend.com einloggen → **API Keys** → **Create API Key** → kopieren.
2. *Optional, empfohlen für später:* unter **Domains** eine eigene Domain verifizieren
   (z. B. `andreasdevries.de`). Ohne verifizierte Domain sendet Resend nur an
   **die E-Mail-Adresse deines Resend-Kontos** – das reicht zum Testen, weil die
   Benachrichtigungen ohnehin an dich gehen.

## 4. Edge Function deployen
**Variante A – mit der Supabase CLI (empfohlen):**
```bash
npm i -g supabase
supabase login
supabase link --project-ref <DEIN-PROJECT-REF>      # Project-Ref steht in den Projekt-Settings
supabase functions deploy devries-booking --no-verify-jwt
```
> `--no-verify-jwt` ist nötig, weil die Bestätigungs-Links (`/confirm`) ohne Login
> aus deinem E-Mail-Programm aufgerufen werden. Der Schutz läuft über den geheimen Token.

**Variante B – ohne CLI:** Im Dashboard unter **Edge Functions** → **Create function**
`devries-booking`, den Inhalt von
[`supabase/functions/devries-booking/index.ts`](supabase/functions/devries-booking/index.ts)
einfügen, **JWT verification** ausschalten, deployen.

## 5. Secrets der Function setzen
Dashboard → **Edge Functions** → `devries-booking` → **Secrets** (oder per CLI
`supabase secrets set ...`):

| Secret | Wert |
|---|---|
| `RESEND_API_KEY` | dein Resend-Key aus Schritt 3 |
| `OWNER_EMAIL` | wohin die Anfragen gehen sollen, z. B. `tolunayusul@gmail.com` |
| `RESEND_FROM` | *(optional)* `de Vries <termin@andreasdevries.de>` – nur mit verifizierter Domain; sonst weglassen (Default `onboarding@resend.dev`) |

`SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` setzt Supabase automatisch.

## 6. Frontend verbinden
In [`assets/js/booking-config.js`](assets/js/booking-config.js) die zwei Platzhalter ersetzen:
```js
window.DV_BOOKING = {
  url: "https://<DEIN-PROJECT-REF>.supabase.co/functions/v1/devries-booking",
  anonKey: "<DEIN-ANON-PUBLIC-KEY>"   // Settings → API → "anon public"
};
```
Dann committen & pushen. **Cache-Version hochzählen** (in allen HTML `?v=10` → `?v=11`),
damit Besucher die neue Config laden.

---

## Fertig – so läuft es dann
1. Besucher wählt Leistung + Tag + Uhrzeit + Kontakt → **Anfrage** (Status *pending*).
2. Du bekommst eine **E-Mail** mit allen Daten + **Bestätigen/Ablehnen**.
3. **Bestätigen** → Termin fest, der Slot ist auf der Website **ausgegraut/gesperrt**.
   **Ablehnen** → Slot bleibt frei.
4. Der Kalender lädt belegte Slots automatisch (`/booked-slots`, nur Datum+Uhrzeit, keine Kundendaten).

## Gut zu wissen
- **Datenschutz:** `/booked-slots` gibt nur Datum/Uhrzeit zurück, keine personenbezogenen Daten.
  Für echten Betrieb die Datenschutzerklärung um die Verarbeitung über Supabase/Resend ergänzen.
- **Doppelanfragen:** Slots werden erst nach *deiner* Bestätigung gesperrt – bis dahin können
  theoretisch zwei dieselbe Uhrzeit anfragen (so von dir gewünscht). Beim Bestätigen prüft das
  System, ob der Slot frei ist.
- **Kunden-Bestätigungsmail** (automatische Mail an den Kunden) ist bewusst nicht aktiv –
  dafür bräuchte Resend eine verifizierte Domain. Kann ich später ergänzen.
- **Termine ansehen:** Supabase → **Table Editor** → `devries_bookings`.
