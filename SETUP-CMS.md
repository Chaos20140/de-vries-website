# Inhalts-Editor (CMS) einrichten – de Vries

Ziel: Du loggst dich unter **`/admin`** ein und bearbeitest Texte & Bilder in einer
einfachen Oberfläche; Änderungen gehen automatisch live. Wir nutzen **Sveltia CMS**
(kostenlos) mit GitHub-Login.

> **Status:** Das Editor-Gerüst ist eingebaut (`/admin`, Konfiguration, erste Felder).
> Es fehlt nur noch der **einmalige Login (Schritte 1–2)** + danach binde ich die
> restlichen Texte/Bilder als Felder ein (Stufe 2). Bis dahin funktioniert die
> Website ganz normal weiter.

---

## Schritt 1 – GitHub OAuth-App anlegen (ca. 3 Min, einmalig)
1. Auf **github.com** einloggen → oben rechts auf dein Profil → **Settings**.
2. Ganz unten links: **Developer settings** → **OAuth Apps** → **New OAuth App**.
3. Felder ausfüllen:
   - **Application name:** `de Vries CMS`
   - **Homepage URL:** `https://chaos20140.github.io/de-vries-website/`
   - **Authorization callback URL:** `https://DEIN-AUTH-WORKER.workers.dev/callback`
     *(diese Adresse bekommst du in Schritt 2 – erst dort eintragen)*
4. **Register application** → du erhältst eine **Client ID**; mit **Generate a new
   client secret** auch ein **Client Secret** (beides gleich für Schritt 2 kopieren,
   das Secret wird nur einmal angezeigt).

## Schritt 2 – Login-Vermittler (Auth-Worker) bereitstellen (kostenlos)
GitHub verlangt für den Login einen kleinen Vermittler. Am einfachsten über
**Cloudflare Workers** (kostenloses Konto):
1. Kostenloses Konto auf **cloudflare.com** anlegen.
2. Fertigen Vermittler nutzen: <https://github.com/sveltia/sveltia-cms-auth>
   → dort steht ein „Deploy to Cloudflare"-Button.
3. Beim Einrichten **Client ID** und **Client Secret** aus Schritt 1 eintragen.
4. Du bekommst eine Worker-Adresse wie `https://xxxx.workers.dev`.
   - Diese Adresse als **Authorization callback URL** in der GitHub-App ergänzen
     (Schritt 1, Punkt 3) – mit `/callback` am Ende.
   - Und in `admin/config.yml` bei `base_url:` eintragen (die Zeile entkommentieren).

## Schritt 3 – Fertig
- Aufrufen: **`https://chaos20140.github.io/de-vries-website/admin/`**
- „Mit GitHub anmelden" → bearbeiten → **Save/Publish** → Seite aktualisiert sich
  automatisch (1–2 Min Build-Zeit).

---

### Gut zu wissen
- **Bilder:** Über die Medien-Funktion im Editor kannst du Bilder hochladen/ersetzen.
- **Zugriff:** Nur wer Schreibrechte auf dem GitHub-Repo hat, kann einloggen.
- **Ich helfe gerne** bei Schritt 1–2 (sag Bescheid, dann gehen wir es zusammen durch).
- **Härtung (später):** Im Editor-Loader (`admin/index.html`) kann die CMS-Version
  fixiert + mit Subresource-Integrity (SRI) abgesichert werden.

### Nächster Schritt von mir (Stufe 2)
Sobald der Login steht, binde ich nach und nach **alle Texte und Bilder** der Seiten
als bearbeitbare Felder ein (Hero, Leistungen, Seitentexte, Kontaktdaten überall),
sodass du wirklich die komplette Seite selbst pflegen kannst.
