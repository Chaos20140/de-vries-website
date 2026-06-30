# Inhalts-Editor (CMS) – de Vries

Komfort-Editor über **Pages CMS** (kostenlos, Open Source). Der Login ist bewusst
einfach: **nur mit GitHub anmelden + dieses Repo freigeben** – keine OAuth-App,
kein Worker, keine Secrets.

---

## Login einrichten (einmalig, ~2 Minuten)
1. Öffne **<https://app.pagescms.org>**
2. **„Sign in with GitHub"** klicken → mit deinem GitHub-Konto (Chaos20140) anmelden.
3. GitHub fragt, für welche Repositories du Zugriff gibst → wähle
   **`Chaos20140/de-vries-website`** (nur dieses) → **Install & Authorize**.
4. Fertig – du landest im Editor und siehst die bearbeitbaren Inhalte.

## Bearbeiten
- Inhalt ändern → **Save** → GitHub Pages baut automatisch neu (1–2 Min) → live.
- **Bilder:** über die Medien-Verwaltung hochladen oder ersetzen.

## Sicherheit / gut zu wissen
- Beim Anmelden bekommt die **„Pages CMS"-GitHub-App Schreibzugriff nur auf dieses
  eine Repo** (nötig, um deine Änderungen zu speichern). Jederzeit widerrufbar:
  GitHub → **Settings → Applications → Installed GitHub Apps**.
- Bearbeiten kann nur, wer Zugriff auf das GitHub-Repo hat.
- Es liegen **keine Passwörter/Secrets** im Projekt – die Konfiguration (`.pages.yml`)
  enthält nur, *welche* Felder bearbeitbar sind.

## Aktuell bearbeitbar
- **Kontaktdaten & Öffnungszeiten** (`_data/site.yml`)
- **Bilder** (Medien-Verwaltung, Ordner `assets/img`)

## Nächster Schritt von mir (Stufe 2)
Sobald du dich eingeloggt hast und es läuft, binde ich **alle Texte & Bilder** der
Seiten als Editor-Felder ein (Hero, Leistungen, Seitentexte, Bilder, Kontaktdaten
überall), damit du die komplette Website selbst pflegen kannst.
