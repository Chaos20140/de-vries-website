# Inhalts-Editor – de Vries (passwortgeschützt, ohne Konto)

Der Editor liegt unter **`/admin/`**. Der/die Bearbeiter:in braucht **nur ein Passwort** –
kein GitHub, kein Konto, keine E-Mail-Anmeldung. Gespeichert wird über das **bereits
vorhandene Supabase** (Buchungssystem). Ein **Schlüssel, der nur dieses eine Repo
beschreiben darf**, liegt server-seitig in Supabase (nie im Browser/Code).

> Solange Schritt 1–3 nicht erledigt sind, zeigt der Editor beim Speichern
> „noch nicht fertig eingerichtet". Die Website funktioniert normal weiter.

---

## Einmalige Einrichtung (3 Schritte)

### 1) GitHub-Schlüssel erstellen – nur für dieses eine Repo
1. github.com → oben rechts Profil → **Settings**
2. ganz unten **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
   → **Generate new token**
3. **Token name:** `de Vries Editor` · **Expiration:** z. B. 1 Jahr
4. **Resource owner:** Chaos20140
5. **Repository access:** „Only select repositories" → **`de-vries-website`** auswählen
6. **Permissions** → **Repository permissions** → **Contents: Read and write**
   (alles andere auf „No access" lassen)
7. **Generate token** → den Schlüssel (`github_pat_…`) **kopieren**.
   ⚠️ **Nicht in den Chat posten** – er kommt direkt in Supabase (Schritt 3).

### 2) Editor-Passwort ausdenken
Ein **starkes Passwort** (z. B. 16+ Zeichen). Das gibst nur du / der/die Bearbeiter:in ein.

### 3) Beides in Supabase hinterlegen (Dashboard – ohne Terminal)
1. <https://supabase.com/dashboard> → Projekt **de-vries** → **Edge Functions**
   → **devries-edit** → **Secrets** (bzw. Project Settings → Edge Functions → Secrets)
2. Zwei Secrets anlegen:
   - `GITHUB_TOKEN` = dein Schlüssel aus Schritt 1
   - `EDIT_PASSWORD` = dein Passwort aus Schritt 2
3. Speichern – fertig.

*(Alternativ per CLI:
`supabase secrets set GITHUB_TOKEN=… EDIT_PASSWORD=… --project-ref vxwjgxdlnwhatnbhjabw`)*

---

## Benutzen
- Aufrufen: **`https://chaos20140.github.io/de-vries-website/admin/`**
- Passwort eingeben → Texte/Bild der Startseite ändern → **Speichern** →
  nach **1–2 Minuten live**.

## Sicherheit
- Bearbeiten nur mit **Passwort** (server-seitig geprüft, Brute-Force-gebremst:
  nach 10 Fehlversuchen 15 Min Sperre).
- Der **GitHub-Schlüssel** liegt **nur in Supabase**, nie im Browser/Code, und darf
  **ausschließlich `de-vries-website`** ändern – deine anderen Projekte sind unerreichbar.
- Der Editor darf nur **freigegebene Felder/Bilder** ändern (keine beliebigen Dateien).
- Schlüssel jederzeit widerrufbar (GitHub → Fine-grained tokens) bzw. Passwort in
  Supabase änderbar.

## Aktuell bearbeitbar (Stufe 1)
- **Startseite:** Eyebrow, 3 Überschrift-Zeilen, Einleitungstext, Hauptbild.

## Nächste Stufe
Sobald das läuft, erweitere ich den Editor auf **alle Seiten** (Leistungstexte,
weitere Bilder, Kontaktdaten überall) – gleiches Prinzip, nur mehr Felder.
