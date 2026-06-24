# CLAUDE.md — de Vries Buildbook

> Diese Datei ist meine eigene Bauanleitung (Audience = *ich* in künftigen Sessions, nicht der Kunde).
> Vor jeder größeren Änderung **erst diese Datei lesen**, dann den eigenen Code hinterfragen.
> Geschwisterprojekte mit eigenem Stil/eigener CLAUDE.md: `Tolu MainPage` (aggressiv schwarz/rot, F1/Cyber) und `CuraDoma` (React/Vite, soft teal). **de Vries hat einen EIGENEN Look — nicht mit denen vermischen.**

---

## 0. Selbstcheck vor jeder Änderung
1. **Was will der Nutzer wirklich?** Das ästhetische Ziel ist *„Editorial Prestige"*: edel, warm, vertrauenswürdig, magazinhaft — und trotzdem umwerfend. Zielgruppe sind **ältere Menschen, pflegende Angehörige UND Gartenkunden**. Niemals kalt/aggressiv/cyberpunk werden (das ist der Tolu-Look, nicht hier).
2. **MOBILE IST PFLICHT.** Jede neue Section/Animation MUSS bei 375–390 px funktionieren, im selben Schritt gebaut — nie nachreichen. DevTools-Resize-Check ist Mindestanforderung.
3. **Bricht es den Design-Vertrag?** (§2) Wenn ja → zurück zum Briefing.
4. **Inhalt verbatim?** (§9) Body-Texte stammen 1:1 von andreasdevries.de. Nicht umschreiben.
5. **Performance-Budget ok?** (§7) Self-contained, kein schwerer Build, lazy images.

---

## 1. Projekt-Identität
- **Kunde**: „de Vries" (Andreas de Vries), Familienbetrieb seit **01. März 1998**, **Salzhemmendorf**.
- **Drei Säulen**: **Garten- & Landschaftsbau**, **Seniorenbetreuung** (ambulant + stationär), **Haushaltshilfe / hauswirtschaftliche Versorgung**.
- **USP**: anerkannt nach **§§ 45a Abs. 1 und 45b Abs. 1 SGB XI** → direkte Abrechnung mit der Pflegekasse, ab Pflegegrad 1.
- **Logo**: DV-Monogramm (feine weiße Linien D+V auf Rot). **Im UI wird das ECHTE Logo-Bild 1:1 eingebunden**: `<img class="brand__mark" src="assets/img/DeVries_Hauptlogo_4c.jpg">` (in Nav + Footer jeder Seite, 50×50, `border-radius:9px`). NICHT durch ein nachgebautes SVG ersetzen — der Nutzer will das Original-Logo (das frühere SVG-Monogramm sah „nicht zugehörig" aus). `favicon.svg` bleibt die SVG-Variante (nur Favicon).
- **Vorlage des Redesigns**: die alte WordPress-Seite https://andreasdevries.de (komplett analysiert, verbatim-Texte + Bilder unter `.scrape/`).

### Stamm-Kontaktdaten (überall identisch halten — bei Änderung global grep'en)
- Telefon angezeigt **05153 - 1552** / Link `tel:051531552`
- E-Mail **info@andreasdevries.de**
- Adresse **An den Flachsrotten 2, 31020 Salzhemmendorf**
- Öffnungszeiten **Mo–Fr 8:00–16:00 Uhr**
- USt-IdNr **DE192201141** · inhaltlich verantwortlich: Andreas de Vries, Schützenplatzweg 5, 31020 Salzhemmendorf
- Social: Facebook `devriesdienstleistungen`, Instagram `dv_devries` · Schwesterseite `https://devries-galabau.de/`

---

## 2. Design-Vertrag (NICHT aufweichen)
| Aspekt | Regel |
|---|---|
| Hintergrund | Warmes Off-White `--paper #faf6f0`; alternierende Sections `--paper-2 #f1e9de`; dunkle Bänder `--ink #1c1714`. NIE reinweiß/kühlgrau als Body. |
| Markenfarbe | Rot `--red #d7120a` (verbatim aus Original). Hover/dunkel `--red-deep #a50d07`. |
| Service-Akzente | Grün `--green #57b046` = Garten · Blau `--blue #0089f7` = Pflege. Sparsam (Card-Akzente, Hover-Glow). |
| Typo Display | **Fraunces** (variable Serif, opsz). Headlines, große Zahlen, Logo-Wortmarke. |
| Typo Body/Labels | **Manrope**. Eyebrows = Manrope UPPERCASE, `letter-spacing .22em`, rot, mit Strich-`::before`. |
| Buttons | Pille (`border-radius 999px`), `.btn` rot mit Ink-Wipe-Hover; `.btn--ghost`, `.btn--light`. Magnetisch via `data-magnetic`. |
| Layout | Großer Weißraum, asymmetrische Editorial-Grids, nummerierte Section-Heads (`.section__index` 01/02/03), 12-col-Galerie-Masonry. |
| Bildsprache | Echte Original-Fotos, `object-fit: cover`, dezenter Hover-Zoom + Rot-Multiply-Tint. |
| Motion | Smooth (Lenis) + IO-Reveals + Ken-Burns. Edel & ruhig, NIE zappelig. `prefers-reduced-motion` immer ehren. |
| Sprache | Deutsch, Sie-Form, verbatim Originaltexte. |

CSS-System-Tokens (NICHT umbenennen): `--red --red-deep --green --blue --ink --paper --paper-2 --line`, Typo `--display --body`, Easing `--ease`.

---

## 3. Dateistruktur
```
.
├── index.html               # Startseite (Flagship: Hero, Leistungen, Referenzen-Teaser, Timeline, CTA)
├── garten-landschaftsbau.html
├── seniorenbetreuung.html    # Nav-Dropdown-Parent: Entlastungsbetrag + Pflegesachleistungen
├── entlastungsbetrag.html
├── pflegeleistungen.html     # = „Pflegesachleistungen" (Slug pflegeleistungen)
├── haushaltshilfe.html
├── referenzen.html           # Galerie-Showcase
├── kontakt.html              # Formular (#contactForm, mailto) + Info-Card + Google-Maps-iframe
├── termin.html               # Terminbuchung: Leistung-Chips + eigener Kalender + Zeit-Slots → mailto (#bookingForm)
├── stellenangebote.html      # Karriere + „Aktuell keine Stellen" + Initiativbewerbung
├── impressum.html            # .prose, kein CTA-Band
├── datenschutz.html          # .prose, kein CTA-Band
├── CLAUDE.md                 # ← diese Datei
├── README.md
├── assets/
│   ├── css/style.css         # KOMPLETTES Stylesheet (Single-File). §-nummeriert.
│   ├── js/main.js            # Motion-Engine (eine IIFE, vanilla)
│   ├── js/lenis.min.js       # Lenis lokal (kein CDN — SRI/Offline-sicher)
│   └── img/                  # Original-Fotos + Logo + favicon.svg
└── .scrape/                  # NICHT deployen: Roh-Analyse der Altseite (verbatim Texte, COMPONENTS.md, extract.py)
```
**Prinzip**: wenige große Dateien, kein Build-Step, kein Framework. Statisch → läuft direkt auf GitHub Pages.

**Shared Blocks** (head/topbar/`header.nav`/`.mobile-nav`/footer/cookie/scripts) sind auf JEDER Seite **identisch**. Quelle der Wahrheit = `index.html`. Ändert sich Nav/Footer/Kontakt → auf ALLEN 11 Seiten nachziehen (sind kopiert, kein Include). Komponenten-Vokabular: `.scrape/COMPONENTS.md`.

**Nav-Rubriken**: Start · Garten & Landschaftsbau · Seniorenbetreuung ▸ (Entlastungsbetrag · Pflegesachleistungen) · Haushaltshilfe · Referenzen · Stellenangebote · **[Termin-buchen-CTA → termin.html]**. Aktiver Link wird **automatisch** per JS gesetzt (`aria-current` aus `location.pathname`) — nicht hardcoden.
- **„Kontakt" steht NICHT in der Desktop-Nav** (Platzgründe: 6 Links + CTA passen sonst nicht in `--wrap` 1280px). Kontakt ist erreichbar über Topbar (Tel/Mail), Footer und das **Mobile-Menü** (dort: … Stellenangebote · Kontakt · Termin buchen). Wer einen Desktop-Nav-Link hinzufügt: erst Breite prüfen (Burger-Breakpoint ist **1240px**; volle Nav nur ≥1241px), CTA hat `flex:none` + `overflow:hidden` → bei zu wenig Platz wird der CTA-Text sonst abgeschnitten.

---

## 4. Seiten-Sektionen (Reihenfolge nicht ohne Grund ändern)
**index.html**: Hero (Mega-Typo „Garten. Pflege. Zuhause.", Foto, Spin-Badge, „25+"-Counter) → Stat-Strip → Intro-Split (verbatim §45a/b-Absätze) → Leistungen (4 `.scard`) → Referenzen-Teaser (`.gallery`) → Timeline (1998→2024, scroll-progress) → CTA-Band → Footer.
**Unterseiten**: `.phero` (Crumb + Eyebrow + H1 + Lead + Foto) → alternierende `.section` / `.section.bg-paper-2` mit `.section__head` (01/02/…) → Inhalt (`.feature`, `.tick-list`, `.table-card/.ptable`, `.gallery`, `.scard`) → CTA-Band → Footer. **Ausnahme**: Impressum/Datenschutz = `.prose`, KEIN CTA-Band.
**termin.html**: `.phero` → `.section` mit `<form id="bookingForm">` umschließt `.booking-grid` (links 4 `.bstep`: Leistung-`.chip-group` · `.calendar` · `.slot-group` · Kontaktfelder; rechts sticky `.booking__summary` mit Live-Werten + Submit) → `.section.bg-paper-2` „So einfach geht's" (`.how-grid` 3 `.how-step`) → Footer (KEIN CTA-Band, die Seite IST der CTA).

---

## 5. Animations-System (`assets/js/main.js`, eine IIFE)
- **Lenis Smooth-Scroll**: lokal geladen, guarded (`typeof window.Lenis`), bei `reduce` aus. rAF-Loop; `lenis.on('scroll', onScroll)`. Mobile `smoothTouch:false`.
- **Reveals**: ein `IntersectionObserver` togglet `.is-in` auf `[data-reveal]`, `[data-stagger]`, `.reveal-words`, `.tnode`, `.dv-draw`, `.hero`, `.phero` (dann `unobserve`). Varianten: `data-reveal="left|right|scale"`.
- **Split-Text**: `.reveal-words` wird zur Laufzeit in `<span class="word"><span>…` zerlegt → word-by-word-Rise. (innerHTML nur auf EIGENEM statischem Text — kein User-Input, daher safe.)
- **Counters**: `[data-count="25"]` zählt hoch (cubic ease, `toLocaleString('de-DE')`), getriggert via eigenem IO @ threshold 0.6.
- **Magnetic Buttons**: `[data-magnetic="0.3"]` folgt dem Cursor (nur Desktop, nicht touch, nicht reduce).
- **Service-Card-Glow**: Mausposition → `--mx/--my` für radialen Hover-Schein.
- **Scroll-rAF (gebatcht)**: Progress-Bar (`#scrollProg` scaleX), Nav-`is-scrolled` (>24px), Parallax (`[data-parallax]`), Timeline-Fortschritt (`--tl-progress` + `.tnode.is-in`). Alles in EINER `applyScroll()` hinter `requestAnimationFrame`-Gate.
- **Mobile-Nav**: `#navBurger` öffnet `#mobileNav` (clip-path-circle reveal, per-Link `--i`-Stagger), sperrt Body-Scroll + `lenis.stop()`. Esc/Close/Linkklick schließt.
- **Cookie**: `#cookie` nach 1.4s ein, `localStorage 'dv-cookie-ok'` merkt Zustimmung.
- **Kontaktformular**: `#contactForm` → Validierung (Name/E-Mail/Nachricht/Consent) → **`mailto:`-Fallback** an info@andreasdevries.de. Kein Backend.
- **Terminbuchung** (`#bookingForm`, nur termin.html, im JS via `if(!form) return` gegated): selbst gebauter **Kalender** (vanilla `Date`, Monatsnavigation, Wochenenden + Vergangenes gesperrt, Prev gesperrt im aktuellen Monat, Montag-basiert), **Service-Chips** (`.chip[data-service]`) und **Zeit-Slots** (`.slot[data-time]`, Mo–Fr 8–16 Uhr) sind Single-Select; Auswahl füllt Hidden-Inputs (`service/date/time`) + Live-`.booking__summary`. Submit → **`mailto:`** an info@andreasdevries.de mit allen Feldern. Kein Backend, keine echte Verfügbarkeitsprüfung → es ist eine **Anfrage**, die de Vries bestätigt (so auch im UI getextet). Calendar-Grid wird per `createElement` gebaut (kein User-`innerHTML`).
- **DV-Monogramm-Draw**: `.dv-draw path` mit `stroke-dasharray` (Länge per `getTotalLength()`), zeichnet sich bei `.is-in`. (Derzeit optionales Element.)

---

## 6. Mobile-Strategie
- Breakpoints: **980px** (Nav → Burger), **900px** (Hero/Stats stapeln), **820/760px** (Feature/Services/Galerie → 1 Spalte), **600/460px** (Feintuning).
- Hero: Media `order:-1` (Foto zuerst), Badge rückt rein, Stat-Strip 2×2.
- Galerie: 12-col → 2-col, alle Items `span 1`.
- Timeline bleibt vertikal (ist von Haus aus vertikal — gut für Mobile).
- **Pflicht-Check**: bei 375–390 px kein Overflow, alle Schriften lesbar, Tabellen scrollen/stapeln sauber.

---

## 7. Performance-Budget
| Asset | Regel |
|---|---|
| CSS | eine Datei, ~ aktuell ok. Keine zweite CSS-Datei einführen. |
| JS | `main.js` vanilla + `lenis.min.js` (~13 KB). Keine weiteren Libs ohne Grund. |
| Fonts | Google Fonts (Fraunces + Manrope) mit `preconnect` + `display=swap`. |
| Bilder | immer `loading="lazy"` außer Hero/Phero-Foto. Originale teils groß (`garten-pflastereinfahrt.jpg` ~690 KB) → bei Bedarf re-encoden (WebP/Resize), aber nur wenn echtes Problem. |
| Externes | NUR Google-Maps-iframe (kontakt) + Fonts. Kein Tracking. Lenis ist lokal. |

---

## 8. Code-Hygiene
**❌ nicht erlaubt:** neue CSS-Datei oder `<style>`-Blöcke in Seiten · CSS-Variablen umbenennen · Inter/Roboto/Arial laden · Body solide kühle Farbe · Inline-`style=` (außer `--i` der Mobile-Nav) · Texte umschreiben · absolute `andreasdevries.de/<slug>/`-Links (immer relative `.html`) · `scroll`-Listener ohne rAF-Gate · `setInterval` ohne Off-Screen-Gate.
**✅ Pflicht:** Shared Blocks auf allen Seiten synchron halten · `prefers-reduced-motion` ehren · Bilder lazy + `alt` deutsch · relative Pfade (`assets/...`) · vor Commit eigenen Diff lesen · neue interaktive Klasse → ggf. in `main.js`-Selektoren ergänzen.

**Wichtige technische Lehren (nicht zurückdrehen):**
- **Cache-Busting**: CSS/JS werden mit Query-Version eingebunden (`style.css?v=2`, `main.js?v=2`). Bei jeder CSS/JS-Änderung die Version auf ALLEN Seiten hochzählen (sonst sehen wiederkehrende Besucher altes CSS — genau das war ein Bug). 
- **`html { overflow-x: clip }`** ist gesetzt (zusätzlich zu `body`), weil das rotierende Hero-Spin-Badge je nach Drehwinkel kurzzeitig die Dokumentbreite aufblähte → horizontaler Scroll-Flacker auf Mobile. `clip` (nicht `hidden`) → Sticky-Nav + Lenis bleiben funktionsfähig (verifiziert).
- **`.section__head`** nutzt `align-items: start` (NICHT `end`) — sonst rutscht die `.section__index`-Nummer (01/02…) bei mehrzeiligem Inhalt nach unten und kollidiert mit dem Lead-Text („01fühlen").
- **Reveal-Richtungen**: `[data-reveal="left|right"]` MÜSSEN `:not(.is-in)` haben, sonst bleibt der `translateX(±40px)`-Versatz dauerhaft (Overflow). Horizontale Reveals NIE in schmalen Spalten (z. B. sticky `.booking__summary` nutzt nur `data-reveal`, kein `="right"`).
- **`.reveal-words`** (Wort-Reveal-Headlines): das `.word` hat `padding/margin: 0.22em 0.06em` (positiv/negativ) — sonst schneidet `overflow:hidden` Umlaut-Punkte (Ü/Ö/Ä) und Unterlängen ab. Nicht entfernen.
- **`.section__head`**: `align-items: start` (Index 01/02 oben), NICHT `end`.
- **Galerie = CSS-Spalten-Masonry** (`.gallery { columns }`, `.gitem { break-inside: avoid }`), KEIN 12-col-Grid mehr → nie Raster-Lücken, Bilder in natürlichem Seitenverhältnis. `gitem--wide/half/tall` sind tote No-Ops.
- **Feature-Sektionen = EINE Überschrift**: nur der `.section__head` (Index + Eyebrow + h2). Im `.feature`-Textblock KEIN zweiter Eyebrow/h3 (war redundant + kollidierte) — erster Absatz ist `<p class="lead-tight">`.
- **Service-Karten** (`.scard__list`): Häkchen-Liste (2-spaltig), KEINE Pillen — passt zum Editorial-Look. Akzent-Häkchen grün/blau je `scard--accent-*`.
- **Logo-Bilder & Original-Downloads**: Original-WP-URLs mit Umlaut (ä/ö, z. B. `tätigkeiten`, `Wellenförmig`) brechen curl-Downloads → kamen als HTML-Fehlerseite an (`file` zeigt „HTML document"). Beim Bild-Nachladen IMMER `file -b` prüfen. Das `allgemeine-tätigkeiten`-Bild ist serverseitig 404 → ersetzt.
- **Bilder-Check**: `for f in assets/img/*; do file -b "$f"; done` — alles muss image/* sein. Bei Bild-Tausch immer verifizieren.

---

## 9. Inhalts-Regeln
- Body-Copy = **verbatim** aus `.scrape/pages/<seite>.txt` (Quelle der Wahrheit, gezogen von der Altseite). Nicht paraphrasieren/kürzen/übersetzen. Nur offensichtliche Tipp-/Spacing-Fehler glätten.
- Überschriften/Eyebrows dürfen leicht editorial neu gesetzt werden, müssen aber inhaltstreu bleiben.
- Zahlen/Beträge (Pflegegrad-Tabellen, 131 €, §§45a/b) **exakt** übernehmen — das ist rechtlich/fachlich sensibel.

---

## 10. Review-Checklist nach jedem Build
```
[ ] Alle 11 Seiten laden, Konsole sauber (favicon-404 egal).
[ ] Nav: aktiver Link markiert, Dropdown Seniorenbetreuung öffnet, alle Links gehen auf existierende .html.
[ ] Hero: Typo steigt rein, Foto Ken-Burns, Counter zählt, Spin-Badge dreht.
[ ] Reveals lösen beim Scrollen aus (nichts bleibt unsichtbar/opacity:0 hängen).
[ ] Timeline-Fortschrittslinie + Node-Aktivierung laufen mit dem Scroll.
[ ] Mobile 375–390px: Burger öffnet (Stagger), keine Overflows, Tabellen ok.
[ ] Kontaktformular: leer → Fehlerstatus; gültig → mailto öffnet.
[ ] prefers-reduced-motion: keine großen Bewegungen.
[ ] Footer/Kontaktdaten auf allen Seiten identisch.
```

---

## 11. Deployment
- Statisch → **GitHub Pages** (Account `Chaos20140`). Repo z. B. `de-vries` / `devries-website`.
- `.scrape/`, `*.jpeg`-Test-Screenshots, `.playwright-mcp/` NICHT mit-deployen → `.gitignore`.
- Lokaler Test: `python -m http.server 8848` reicht (keine Range-Requests nötig, kein Video). Für späteres Scroll-Video → `npx http-server`.
- GitHub Pages: Branch `main`, root. Optional `CNAME` wenn eigene Domain.

---

## 12. Wenn der Nutzer etwas Neues will
1. Erst überlegen, **wo** im Designsystem es sitzt (welche bestehende Komponente?).
2. Bestehende Komponente erweitern statt parallele bauen.
3. Auf ALLEN betroffenen Seiten nachziehen (Shared Blocks!).
4. Mobile im selben Schritt.
5. Browser-Smoke-Test (Playwright, §10).
6. **Im Zweifel weniger Effekt, mehr Ruhe** — der Look lebt von Eleganz, nicht von Effekt-Stacking.
