// de Vries – Inhalts-Editor (Speicher-Backend)
// Sicherheit: Passwort (konstante Zeit) + Rate-Limit + strikte Whitelist von
// bearbeitbaren Feldern/Bildern. Der GitHub-Token bleibt server-seitig (Secret)
// und darf NUR dieses eine Repo beschreiben. Deploy mit --no-verify-jwt
// (das Passwort ist die Zugangskontrolle).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
// Whitelist-Membership NUR über eigene Properties prüfen (kein __proto__/constructor über die Prototypkette).
const has = (o: Record<string, unknown>, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

// CORS auf die echte Editor-Domain beschränken (per Env überschreibbar). Auth läuft ohnehin über
// das Passwort im Body (keine Cookies), aber so kann kein fremder Origin die Antworten auslesen.
// Erlaubte Editor-Ursprünge (kommagetrennt per Env ALLOWED_ORIGINS überschreibbar). Die Antwort
// spiegelt pro Request den passenden Origin aus dieser Liste zurück (exakter Match); Standard = erster.
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "https://andreasdevries.de,https://www.andreasdevries.de,https://chaos20140.github.io").split(",").map((s) => s.trim()).filter(Boolean);
const CORS = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GH_REPO   = Deno.env.get("GITHUB_REPO")   || "Chaos20140/de-vries-website";
const GH_BRANCH = Deno.env.get("GITHUB_BRANCH") || "main";
const GH_TOKEN  = Deno.env.get("GITHUB_TOKEN")  || "";
const EDIT_PW   = Deno.env.get("EDIT_PASSWORD") || "";
const SB_URL    = Deno.env.get("SUPABASE_URL")!;
const SB_SR     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

// Erlaubte Link-Ziele (kein javascript:, data: o.ä.)
function safeHref(h: string): boolean {
  h = (h || "").trim();
  // Attribut-Ausbruch / Markup-Injection generell ausschließen (unabhängig vom Schema).
  if (/["'<>`]/.test(h)) return false;
  return /^https?:\/\//i.test(h) || /^mailto:/i.test(h) || /^tel:/i.test(h)
      || /^[\w./-]+\.html(#[\w-]+)?$/i.test(h) || /^#[\w-]+$/.test(h);
}
// Bequemlichkeit: Ein bloßer Seitenname ("kontakt") wird zu "kontakt.html".
// Die strenge Prüfung in safeHref() bleibt unverändert – normalisiert wird DAVOR,
// und nur wenn der Wert ausschließlich aus harmlosen Zeichen besteht.
function normHref(h: string): string {
  h = (h || "").trim();
  return /^[a-z0-9][\w-]*$/i.test(h) ? h + ".html" : h;
}

// Rich-Text-Sanitizer (Escape-First-Allowlist): zuerst ALLES neutralisieren, dann
// nur eine winzige Allowlist sicherer Inline-Tags + sichere Links wiederherstellen.
// Alles andere (script, on*-Handler, style, beliebige Tags) bleibt neutralisierter
// Text -> XSS ist konstruktionsbedingt ausgeschlossen.
function sanitizeRich(html: string): string {
  // Eingabe ist bereits HTML (innerHTML) -> nur nackte & escapen, bestehende
  // Entities (&amp; &quot; &#39; …) NICHT doppelt-escapen.
  let s = html
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, "&amp;")
    .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  s = s.replace(/&lt;(\/?)(strong|b|em|i)&gt;/gi, "<$1$2>");
  s = s.replace(/&lt;br\s*\/?&gt;/gi, "<br>");
  s = s.replace(/&lt;a\b[\s\S]*?&gt;/gi, (m) => {
    const hm = m.match(/href=(?:&quot;|&#39;)([\s\S]*?)(?:&quot;|&#39;)/i);
    const href = hm ? hm[1] : "";
    return safeHref(href) ? '<a href="' + esc(href) + '">' : "";
  });
  s = s.replace(/&lt;\/a&gt;/gi, "</a>");
  s = s.replace(/&lt;\/?[a-z][\s\S]*?&gt;/gi, ""); // übrige (nicht erlaubte) Tags raus, Text bleibt
  return s;
}

// Passwortvergleich in konstanter Zeit (gegen Timing-Angriffe)
function ctEq(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  const n = Math.max(ea.length, eb.length);
  let r = ea.length ^ eb.length;
  for (let i = 0; i < n; i++) r |= (ea[i] || 0) ^ (eb[i] || 0);
  return r === 0;
}

// Whitelist: bearbeitbare Textfelder (Marker data-ed="…" in index.html) + Maxlänge
const HOME_FIELDS: Record<string, number> = {
  "hero-eyebrow": 90, "hero-line1": 24, "hero-line2": 24, "hero-line3": 24, "hero-lead": 340,
};
// Whitelist: ersetzbare Bild-Slots -> feste Pfade (keine beliebigen Dateien!)
const IMG_SLOTS: Record<string, string> = {
  "hero": "assets/img/senioren-zuhause.jpg",
  "senioren-zuhause": "assets/img/senioren-zuhause.jpg",
  "senioren-familie": "assets/img/senioren-familie.jpg",
  "senioren-pflege": "assets/img/senioren-pflege.jpg",
  "senioren-entlastung": "assets/img/senioren-entlastung.jpg",
  "haushalt-alltag": "assets/img/haushalt-alltag.jpg",
  "haushalt-reinigung": "assets/img/haushalt-reinigung.jpg",
};
// Whitelist: bearbeitbare Seiten (keine beliebigen Pfade)
const PAGES = new Set([
  "index.html","seniorenbetreuung.html","haushaltshilfe.html","entlastungsbetrag.html",
  "pflegeleistungen.html","kontakt.html","stellenangebote.html","impressum.html",
  "datenschutz.html","termin.html","verhinderungspflege.html",
]);
// Dynamische Liste selbst erstellter Seiten (Manifest im Repo, Jekyll-ausgeschlossen via "_").
const PAGES_MANIFEST = "_pages.json";
// Reservierte Slugs (nie als eigene Seite anlegbar/überschreibbar/löschbar).
const RESERVED_SLUGS = new Set(["index", "admin", "404", "sitemap", "robots", "template", "pages", "assets", "supabase", "termin-status", "readme", "curadoma"]);
async function extraPages(): Promise<string[]> {
  try {
    const mf = await getFile(PAGES_MANIFEST);
    const a = JSON.parse(mf.text);
    // Defense-in-Depth: selbst ein manuell vergiftetes Manifest kann keine Builtin-/Reserved-Seite exponieren.
    return Array.isArray(a) ? a.filter((x) =>
      typeof x === "string" && /^[a-z][a-z0-9-]{1,38}\.html$/.test(x)
      && !PAGES.has(x) && !RESERVED_SLUGS.has(x.replace(/\.html$/, ""))) : [];
  } catch { return []; }
}
async function isValidPage(file: string): Promise<boolean> {
  return PAGES.has(file) || (await extraPages()).includes(file);
}

function gh(path: string, init: RequestInit = {}) {
  return fetch(`https://api.github.com/repos/${GH_REPO}/${path}`, {
    ...init,
    headers: { "Authorization": `Bearer ${GH_TOKEN}`, "Accept": "application/vnd.github+json",
               "User-Agent": "devries-edit", ...(init.headers || {}) },
  });
}
async function getFile(path: string) {
  const r = await gh(`contents/${encodeURIComponent(path)}?ref=${GH_BRANCH}`);
  if (!r.ok) throw new Error("getFile " + r.status);
  const d = await r.json();
  const bin = atob((d.content as string).replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return { sha: d.sha as string, text: new TextDecoder().decode(bytes) };
}
function utf8B64(str: string) {
  const bytes = new TextEncoder().encode(str);
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function putFile(path: string, contentB64: string, sha: string | undefined, message: string) {
  return gh(`contents/${path}`, { method: "PUT",
    body: JSON.stringify({ message, content: contentB64, sha, branch: GH_BRANCH }) });
}
function ghDelete(path: string, sha: string, message: string) {
  return gh(`contents/${encodeURIComponent(path)}`, { method: "DELETE",
    body: JSON.stringify({ message, sha, branch: GH_BRANCH }) });
}
// Mehrere Dateien in EINEM Commit ändern (Git Data API) – für geteilte Blöcke (Menü/Footer),
// damit alle Seiten konsistent in einem einzigen Build aktualisiert werden.
async function commitMulti(files: { path: string; contentB64: string }[], message: string): Promise<boolean> {
  const refR = await gh(`git/ref/heads/${GH_BRANCH}`);
  if (!refR.ok) return false;
  const headSha = (await refR.json()).object.sha;
  const commitR = await gh(`git/commits/${headSha}`);
  if (!commitR.ok) return false;
  const baseTree = (await commitR.json()).tree.sha;
  const tree: unknown[] = [];
  for (const f of files) {
    const bR = await gh(`git/blobs`, { method: "POST", body: JSON.stringify({ content: f.contentB64, encoding: "base64" }) });
    if (!bR.ok) return false;
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: (await bR.json()).sha });
  }
  const treeR = await gh(`git/trees`, { method: "POST", body: JSON.stringify({ base_tree: baseTree, tree }) });
  if (!treeR.ok) return false;
  const ncR = await gh(`git/commits`, { method: "POST", body: JSON.stringify({ message, tree: (await treeR.json()).sha, parents: [headSha] }) });
  if (!ncR.ok) return false;
  const updR = await gh(`git/refs/heads/${GH_BRANCH}`, { method: "PATCH", body: JSON.stringify({ sha: (await ncR.json()).sha }) });
  return updR.ok;
}
// Ersetzt den INHALT einer Zone <tag ... data-ed-zone="X" ...>…</tag> balanciert – zählt verschachtelte
// gleiche Tags mit, damit Blöcke mit inneren <div> (Karten, Spalten, FAQ) nicht zerschnitten werden.
function replaceZoneInner(html: string, zone: string, inner: string): string | null {
  const z = zone.replace(/[^a-z0-9-]/g, "");
  const openRe = new RegExp('<([a-z]+)\\b[^>]*\\bdata-ed-zone="' + z + '"[^>]*>');
  const m = openRe.exec(html);
  if (!m) return null;
  const tag = m[1];
  const openEnd = m.index + m[0].length;
  const tokRe = new RegExp('<' + tag + '\\b|</' + tag + '>', "g");
  tokRe.lastIndex = openEnd;
  let depth = 1, t: RegExpExecArray | null, closeStart = -1;
  while ((t = tokRe.exec(html))) {
    if (t[0].charAt(1) === "/") { depth--; if (depth === 0) { closeStart = t.index; break; } }
    else depth++;
  }
  if (closeStart < 0) return null;
  return html.slice(0, openEnd) + inner + html.slice(closeStart);
}

Deno.serve(async (req) => {
  const res = await handle(req);
  // CORS: den konkreten Origin zurückspiegeln, wenn er in der Allowlist steht (sonst Standard).
  const origin = req.headers.get("Origin") || "";
  if (origin && ALLOWED_ORIGINS.includes(origin)) res.headers.set("Access-Control-Allow-Origin", origin);
  return res;
});

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!GH_TOKEN || !EDIT_PW) return json({ error: "not_configured" }, 503);

  const admin = createClient(SB_URL, SB_SR);
  // Echte Client-IP = LETZTER X-Forwarded-For-Eintrag (vom vertrauenswürdigen Edge-Proxy
  // angehängt). Vom Client selbst gespoofte Werte stehen weiter links -> werden ignoriert.
  const xff = (req.headers.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = xff[xff.length - 1] || "unknown";

  // Body-Größe VOR dem Parsen deckeln (Bild-Upload base64 <=3 MB + JSON-Overhead).
  const clen = Number(req.headers.get("content-length") || "0");
  if (clen > 5_000_000) return json({ error: "too_large" }, 413);

  let body: any;
  let raw: string;
  try { raw = await req.text(); } catch { return json({ error: "bad_json" }, 400); }
  // Zweite Grenze am tatsächlichen Body: Content-Length kann fehlen (chunked) oder gefälscht sein.
  if (raw.length > 5_000_000) return json({ error: "too_large" }, 413);
  try { body = JSON.parse(raw); } catch { return json({ error: "bad_json" }, 400); }

  // Passwort ZUERST prüfen: ein KORREKTES Passwort wird NIE ratenlimitiert -> kein Lockout des
  // Inhabers durch fremde Fehlversuche. Rate-Limit (Brute-Force-Schutz) greift NUR im Fehlerpfad:
  // pro IP >=10 ODER global >=60 Fehlversuche in 15 Min -> 429.
  const ok = typeof body.password === "string" && ctEq(body.password, EDIT_PW);
  if (!ok) {
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const [perIp, global] = await Promise.all([
      admin.from("devries_edit_log").select("*", { count: "exact", head: true }).eq("ip", ip).eq("ok", false).gte("created_at", since),
      admin.from("devries_edit_log").select("*", { count: "exact", head: true }).eq("ok", false).gte("created_at", since),
    ]);
    if ((perIp.count || 0) >= 10 || (global.count || 0) >= 60) return json({ error: "rate_limited" }, 429);
    await admin.from("devries_edit_log").insert({ ip, ok: false });
    await new Promise((r) => setTimeout(r, 600));
    return json({ error: "unauthorized" }, 401);
  }
  await admin.from("devries_edit_log").insert({ ip, ok: true });
  // Log-Hygiene: bei (seltenen) Owner-Aktionen alte Einträge >7 Tage entfernen (Rate-Fenster = 15 Min).
  try { await admin.from("devries_edit_log").delete().lt("created_at", new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()); } catch { /* nicht kritisch */ }

  try {
    if (body.action === "save-home") {
      const fields = (body.fields || {}) as Record<string, string>;
      for (const k of Object.keys(fields)) {
        if (!has(HOME_FIELDS, k)) return json({ error: "bad_field", field: k }, 400);
        if (typeof fields[k] !== "string" || fields[k].length > HOME_FIELDS[k])
          return json({ error: "too_long", field: k }, 400);
      }
      const f = await getFile("index.html");
      let html = f.text;
      for (const [k, v] of Object.entries(fields)) {
        const re = new RegExp('(data-ed="' + k + '"[^>]*>)([^<]*)(</)');
        if (!re.test(html)) return json({ error: "marker_missing", field: k }, 400);
        html = html.replace(re, (_m, a, _b, c) => a + esc(v) + c);
      }
      const r = await putFile("index.html", utf8B64(html), f.sha, "Editor: Startseiten-Texte aktualisiert");
      return r.ok ? json({ ok: true }) : json({ error: "commit_failed" }, 500);
    }

    if (body.action === "save-page") {
      const file = body.file as string;
      if (!(await isValidPage(file))) return json({ error: "bad_file" }, 400);
      const fields = (body.fields || {}) as Record<string, string>;
      const rich   = (body.rich   || {}) as Record<string, string>;
      const positions = (body.positions || {}) as Record<string, string>;
      for (const k of Object.keys(fields)) {
        if (!/^[a-z0-9-]{1,48}$/.test(k)) return json({ error: "bad_key", field: k }, 400); // verhindert Regex-Injection
        if (typeof fields[k] !== "string" || fields[k].length > 3000) return json({ error: "too_long", field: k }, 400);
      }
      for (const k of Object.keys(rich)) {
        if (!/^[a-z0-9-]{1,48}$/.test(k)) return json({ error: "bad_key", field: k }, 400);
        if (typeof rich[k] !== "string" || rich[k].length > 8000) return json({ error: "too_long", field: k }, 400);
      }
      for (const slot of Object.keys(positions)) {
        if (!(has(IMG_SLOTS, slot))) return json({ error: "bad_slot", field: slot }, 400);
        const m = /^(\d{1,3})% (\d{1,3})%$/.exec(positions[slot]);
        if (!m || +m[1] > 100 || +m[2] > 100) return json({ error: "bad_pos", field: slot }, 400);
      }
      const f = await getFile(file);
      let html = f.text;
      // 0) Bildausschnitt (object-position) als Inline-Style am passenden <img data-ed-img="slot">
      for (const [slot, val] of Object.entries(positions)) {
        const re = new RegExp('<img\\b[^>]*\\bdata-ed-img="' + slot + '"[^>]*>');
        if (!re.test(html)) return json({ error: "marker_missing", field: slot }, 400);
        html = html.replace(re, (tag) => {
          const t = tag.replace(/\s*style="object-position:[^"]*"/i, ""); // alte Position raus
          return t.replace(/>$/, ' style="object-position:' + val + '">');
        });
      }
      // 1) reine Text-Marker (data-ed) – Inhalt wird komplett escaped
      for (const [k, v] of Object.entries(fields)) {
        const re = new RegExp('(data-ed="' + k + '"[^>]*>)([^<]*)(</)');
        if (!re.test(html)) return json({ error: "marker_missing", field: k }, 400);
        html = html.replace(re, (_m, a, _b, c) => a + esc(v) + c);
      }
      // 2) Rich-Marker (data-ed-rich) – Inhalt darf erlaubte Inline-Tags/Links, wird sanitized
      for (const [k, v] of Object.entries(rich)) {
        const re = new RegExp('(<([a-zA-Z0-9]+)\\b[^>]*\\bdata-ed-rich="' + k + '"[^>]*>)([\\s\\S]*?)(</\\2>)');
        if (!re.test(html)) return json({ error: "marker_missing", field: k }, 400);
        html = html.replace(re, (_m, open, _tag, _inner, close) => open + sanitizeRich(v) + close);
      }
      const r = await putFile(file, utf8B64(html), f.sha, "Editor: Inhalt aktualisiert (" + file + ")");
      return r.ok ? json({ ok: true }) : json({ error: "commit_failed" }, 500);
    }

    if (body.action === "upload-image") {
      const slot = body.slot as string, data = body.dataBase64 as string;
      if (!(has(IMG_SLOTS, slot))) return json({ error: "bad_slot" }, 400);
      if (typeof data !== "string" || data.length > 3_000_000) return json({ error: "image_too_big" }, 400);
      const head = atob(data.slice(0, 32));
      const b = [...head].map((c) => c.charCodeAt(0));
      const isJpg = b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF;
      const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47 && b[4] === 0x0D && b[5] === 0x0A && b[6] === 0x1A && b[7] === 0x0A;
      const isWebp = head.slice(0, 4) === "RIFF" && head.slice(8, 12) === "WEBP";
      if (!(isJpg || isPng || isWebp)) return json({ error: "not_image" }, 400);
      const path = IMG_SLOTS[slot];
      let sha: string | undefined;
      try { sha = (await getFile(path)).sha; } catch { sha = undefined; }
      const r = await putFile(path, data, sha, "Editor: Bild aktualisiert (" + slot + ")");
      return r.ok ? json({ ok: true }) : json({ error: "commit_failed" }, 500);
    }

    if (body.action === "save-shared") {
      // Geteilte Menü-/Footer-Beschriftungen (data-eds="…") – auf ALLEN Seiten gleich.
      const shared = (body.shared || {}) as Record<string, string>;
      const keys = Object.keys(shared);
      if (!keys.length) return json({ error: "empty" }, 400);
      for (const k of keys) {
        if (!/^[a-z0-9-]{1,48}$/.test(k)) return json({ error: "bad_key", field: k }, 400);
        if (typeof shared[k] !== "string" || shared[k].length > 200) return json({ error: "too_long", field: k }, 400);
      }
      const changedFiles: { path: string; contentB64: string }[] = [];
      for (const page of [...PAGES, ...(await extraPages())]) {
        const f = await getFile(page);
        let html = f.text, changed = false;
        for (const k of keys) {
          const re = new RegExp('(data-eds="' + k + '"[^>]*>)([^<]*)(</)', "g"); // global: jedes Vorkommen pro Seite
          const nv = esc(shared[k]);
          const nh = html.replace(re, (_m, a, _b, c) => a + nv + c);
          if (nh !== html) { html = nh; changed = true; }
        }
        // Kontaktdaten: tel:/mailto:-Links + schema.org an den neuen Anzeigetext angleichen
        if (keys.includes("contact-phone")) {
          const digits = (shared["contact-phone"] || "").replace(/[^\d]/g, "");
          if (digits.length >= 3 && digits.length <= 20) {
            const nh = html.replace(/href="tel:[^"]*"/g, 'href="tel:' + digits + '"');
            if (nh !== html) { html = nh; changed = true; }
            const intl = digits.startsWith("0") ? "+49" + digits.slice(1) : digits;
            const ns = html.replace(/("telephone":\s*")[^"]*(")/g, (_m, a, b) => a + intl + b);
            if (ns !== html) { html = ns; changed = true; }
          }
        }
        if (keys.includes("contact-email")) {
          const em = (shared["contact-email"] || "").trim();
          if (em.length <= 120 && /^[^\s<>"'`]+@[^\s<>"'`]+\.[^\s<>"'`]+$/.test(em)) {
            const nh = html.replace(/href="mailto:[^"]*"/g, () => 'href="mailto:' + em + '"'); // Funktion: sonst würde $& im Wert expandieren
            if (nh !== html) { html = nh; changed = true; }
            const ns = html.replace(/("email":\s*")[^"]*(")/g, (_m, a, b) => a + esc(em) + b);
            if (ns !== html) { html = ns; changed = true; }
          }
        }
        if (changed) changedFiles.push({ path: page, contentB64: utf8B64(html) });
      }
      if (!changedFiles.length) return json({ error: "marker_missing" }, 400);
      const okShared = await commitMulti(changedFiles, "Editor: Menü/Footer aktualisiert");
      return okShared ? json({ ok: true, updated: changedFiles.length }) : json({ error: "commit_failed" }, 500);
    }

    if (body.action === "save-places") {
      // Standorte der Startseiten-Route: data-places="A|B|C" auf #route in index.html. Nur Klartext.
      const places = body.places;
      if (!Array.isArray(places) || places.length < 1 || places.length > 30) return json({ error: "bad_places" }, 400);
      const clean: string[] = [];
      for (const p of places) {
        if (typeof p !== "string") return json({ error: "bad_places" }, 400);
        const s = p.replace(/\s+/g, " ").trim();
        if (!s || s.length > 60) return json({ error: "bad_place_len" }, 400);
        if (s.includes("|")) return json({ error: "pipe_not_allowed" }, 400); // | ist der Trenner
        clean.push(s);
      }
      const val = esc(clean.join("|")); // fürs HTML-Attribut escapen (& < > ")
      const f = await getFile("index.html");
      const re = /(id="route"[^>]*\bdata-places=")([^"]*)(")/;
      if (!re.test(f.text)) return json({ error: "marker_missing" }, 400);
      const html = f.text.replace(re, (_m, a, _b, c) => a + val + c);
      const r = await putFile("index.html", utf8B64(html), f.sha, "Editor: Standorte (Route) aktualisiert");
      return r.ok ? json({ ok: true, count: clean.length }) : json({ error: "commit_failed" }, 500);
    }

    if (body.action === "save-meta") {
      // SEO/Meta pro Seite: <title>, Meta-Description (+ OG/Twitter-Spiegel) und Bild-Alt-Texte.
      // Isoliert von save-page; nutzt dieselbe Härtung (Whitelist-Datei, esc, Längenlimits).
      const file = body.file as string;
      if (!(await isValidPage(file))) return json({ error: "bad_file" }, 400);
      const rawTitle = typeof body.title === "string" ? body.title.trim() : "";
      const title = rawTitle ? rawTitle : null;                 // leerer Titel -> unverändert lassen
      const desc  = typeof body.description === "string" ? body.description : null;
      const alts  = (body.alts || {}) as Record<string, string>;
      if (title !== null && title.length > 80) return json({ error: "too_long", field: "title" }, 400);
      if (desc  !== null && desc.length > 320) return json({ error: "too_long", field: "description" }, 400);
      for (const slot of Object.keys(alts)) {
        if (!(has(IMG_SLOTS, slot))) return json({ error: "bad_slot", field: slot }, 400);
        if (typeof alts[slot] !== "string" || alts[slot].length > 160) return json({ error: "too_long", field: slot }, 400);
      }
      const f = await getFile(file);
      let html = f.text;
      if (title !== null) {
        if (!/<title>[\s\S]*?<\/title>/.test(html)) return json({ error: "marker_missing", field: "title" }, 400);
        const et = esc(title);
        html = html.replace(/<title>[\s\S]*?<\/title>/, () => "<title>" + et + "</title>");
        html = html.replace(/(<meta property="og:title" content=")[^"]*(">)/, (_m, a, b) => a + et + b);
        html = html.replace(/(<meta name="twitter:title" content=")[^"]*(">)/, (_m, a, b) => a + et + b);
      }
      if (desc !== null) {
        const ed = esc(desc);
        if (/(<meta name="description" content=")[^"]*(">)/.test(html)) {
          html = html.replace(/(<meta name="description" content=")[^"]*(">)/, (_m, a, b) => a + ed + b);
        } else {
          html = html.replace(/(<\/title>)/, (m) => m + '\n<meta name="description" content="' + ed + '">');
        }
        html = html.replace(/(<meta property="og:description" content=")[^"]*(">)/, (_m, a, b) => a + ed + b);
        html = html.replace(/(<meta name="twitter:description" content=")[^"]*(">)/, (_m, a, b) => a + ed + b);
      }
      for (const [slot, val] of Object.entries(alts)) {
        const ev = esc(val);
        const imgRe = new RegExp('<img\\b[^>]*\\bdata-ed-img="' + slot + '"[^>]*>');
        if (!imgRe.test(html)) return json({ error: "marker_missing", field: slot }, 400);
        html = html.replace(imgRe, (tag) => /\balt="/i.test(tag)
          ? tag.replace(/\balt="[^"]*"/i, () => 'alt="' + ev + '"')
          : tag.replace(/(\s*\/?>)$/, (m) => ' alt="' + ev + '"' + m));
      }
      const r = await putFile(file, utf8B64(html), f.sha, "Editor: SEO/Meta aktualisiert (" + file + ")");
      return r.ok ? json({ ok: true }) : json({ error: "commit_failed" }, 500);
    }

    if (body.action === "save-blocks") {
      // Frei hinzufügbare Elemente (Buttons/Überschriften/Text) in einer Zone einer Seite.
      // Sicherheit: Zone-Inhalt wird KOMPLETT aus validierten Daten neu erzeugt (kein HTML-Durchreichen).
      const file = body.file as string;
      if (!(await isValidPage(file))) return json({ error: "bad_file" }, 400);
      const zone = body.zone as string;
      if (!/^[a-z0-9-]{1,32}$/.test(zone)) return json({ error: "bad_key", field: "zone" }, 400);
      const blocks = Array.isArray(body.blocks) ? body.blocks : null;
      if (!blocks || blocks.length > 30) return json({ error: "bad_blocks" }, 400);
      let inner = "";
      for (const b of blocks) {
        const type = b && typeof b === "object" ? (b as any).type : null;
        const av = (b as any) ? (b as any).align : "";
        const wv = (b as any) ? (b as any).width : "";
        const sv = (b as any) ? (b as any).space : "";
        const fsv = (b as any) ? (b as any).size : "";
        const alc = "eb-al-" + (av === "left" || av === "right" ? av : "center") // Ausrichtung
          + " eb-w-" + (wv === "narrow" || wv === "wide" || wv === "full" ? wv : "normal") // Breite
          + " eb-sp-" + (sv === "small" || sv === "large" ? sv : "normal") // Abstand
          + " eb-fs-" + (fsv === "s" || fsv === "l" || fsv === "xl" ? fsv : "m"); // Textgröße
        if (type === "button") {
          const text = esc(String((b as any).text || "").slice(0, 80).trim());
          const href = normHref(String((b as any).href || ""));
          if (!text) continue;
          if (!safeHref(href)) return json({ error: "bad_href" }, 400);
          const ghost = (b as any).variant === "ghost";
          inner += '<a class="btn' + (ghost ? " btn--ghost" : "") + " " + alc + '" data-eb="button"'
            + (ghost ? ' data-eb-variant="ghost"' : "") + ' href="' + esc(href) + '">' + text + "</a>";
        } else if (type === "heading") {
          const text = esc(String((b as any).text || "").slice(0, 120).trim());
          if (!text) continue;
          inner += '<h3 class="' + alc + '" data-eb="heading">' + text + "</h3>";
        } else if (type === "text") {
          const text = esc(String((b as any).text || "").slice(0, 600).trim());
          if (!text) continue;
          inner += '<p class="' + alc + '" data-eb="text">' + text + "</p>";
        } else if (type === "quote") {
          const text = esc(String((b as any).text || "").slice(0, 400).trim());
          if (!text) continue;
          inner += '<blockquote class="' + alc + '" data-eb="quote">' + text + "</blockquote>";
        } else if (type === "divider") {
          inner += '<hr class="' + alc + '" data-eb="divider">';
        } else if (type === "list") {
          const items = Array.isArray((b as any).items) ? (b as any).items : [];
          let li = "";
          for (const it of items.slice(0, 20)) {
            const t = esc(String(it || "").slice(0, 200).trim());
            if (t) li += "<li>" + t + "</li>";
          }
          if (!li) continue;
          inner += '<ul class="' + alc + '" data-eb="list">' + li + "</ul>";
        } else if (type === "image") {
          const slot = String((b as any).slot || "");
          const src0 = String((b as any).src || "").trim();
          let src = "", isUp = false;
          if (/^assets\/img\/uploads\/[a-z0-9-]{8,60}\.(jpg|jpeg|png|webp)$/i.test(src0)) { src = src0; isUp = true; }
          else if (has(IMG_SLOTS, slot)) src = IMG_SLOTS[slot];
          else return json({ error: "bad_slot", field: slot || src0 }, 400);
          const alt = esc(String((b as any).alt || "").slice(0, 160).trim());
          const iw = parseInt(String((b as any).w || ""), 10);
          const hasW = iw >= 20 && iw <= 100; // per Ziehen gesetzte Bildbreite in %
          inner += '<img class="' + alc + '" data-eb="image" ' + (isUp ? 'data-eb-src="' + esc(src) + '"' : 'data-eb-slot="' + slot + '"') + (hasW ? ' data-eb-w="' + iw + '" style="width:' + iw + '%"' : "") + ' src="' + esc(src) + '" alt="' + alt + '" loading="lazy">';
        } else if (type === "columns") {
          const l = esc(String((b as any).left || "").slice(0, 600).trim());
          const r = esc(String((b as any).right || "").slice(0, 600).trim());
          // Optionales Bild je Spalte: entweder hochgeladener Pfad ODER Slot aus der Whitelist; sonst verworfen.
          const colImg = (srcRaw: unknown, slotRaw: unknown, altRaw: unknown): string => {
            const src0 = String(srcRaw || "").trim(), slot = String(slotRaw || "");
            let src = "", isUp = false;
            if (/^assets\/img\/uploads\/[a-z0-9-]{8,60}\.(jpg|jpeg|png|webp)$/i.test(src0)) { src = src0; isUp = true; }
            else if (slot && has(IMG_SLOTS, slot)) src = IMG_SLOTS[slot];
            else return "";
            const alt = esc(String(altRaw || "").slice(0, 160).trim());
            return '<img class="eb-col-img" data-eb-col-img="1" ' + (isUp ? 'data-eb-src="' + esc(src) + '"' : 'data-eb-slot="' + slot + '"')
              + ' src="' + esc(src) + '" alt="' + alt + '" loading="lazy">';
          };
          const lImg = colImg((b as any).leftSrc, (b as any).leftSlot, (b as any).leftAlt);
          const rImg = colImg((b as any).rightSrc, (b as any).rightSlot, (b as any).rightAlt);
          if (!l && !r && !lImg && !rImg) continue;
          inner += '<div class="eb-cols ' + alc + '" data-eb="columns"><div>' + lImg + (l ? "<p>" + l + "</p>" : "")
            + '</div><div>' + rImg + (r ? "<p>" + r + "</p>" : "") + "</div></div>";
        } else if (type === "faq") {
          const items = Array.isArray((b as any).items) ? (b as any).items : [];
          let d = "";
          for (const it of items.slice(0, 15)) {
            const q = esc(String((it && (it as any).q) || "").slice(0, 200).trim());
            const a = esc(String((it && (it as any).a) || "").slice(0, 800).trim());
            if (q) d += "<details class=\"eb-faq__item\"><summary>" + q + "</summary><div>" + a + "</div></details>";
          }
          if (!d) continue;
          inner += '<div class="eb-faq ' + alc + '" data-eb="faq">' + d + "</div>";
        } else if (type === "card") {
          // Leistungs-Kachel (design-konform wie die eingebauten .scard)
          const title = esc(String((b as any).title || "").slice(0, 80).trim()) || "Neue Leistung";
          const text = esc(String((b as any).text || "").slice(0, 600).trim());
          const href = normHref(String((b as any).href || ""));
          if (href && href !== "#" && !safeHref(href)) return json({ error: "bad_href" }, 400);
          const num = esc(String((b as any).num || "").replace(/\s+/g, " ").trim().slice(0, 4)); // frei wählbar (z. B. 05, 5, A1)
          const cItems = Array.isArray((b as any).items) ? (b as any).items : [];
          let cli = "";
          for (const it of cItems.slice(0, 8)) { const t = esc(String(it || "").slice(0, 120).trim()); if (t) cli += "<li>" + t + "</li>"; }
          const cardIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/></svg>';
          const arrow = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
          inner += '<a class="scard" data-eb="card" href="' + (href ? esc(href) : "#") + '">'
            + (num ? '<span class="scard__num">' + num + '</span>' : '')
            + '<div class="scard__icon">' + cardIcon + '</div>'
            + '<h3>' + title + '</h3>'
            + (text ? '<p>' + text + '</p>' : '')
            + (cli ? '<ul class="scard__list">' + cli + '</ul>' : '')
            + '<div class="scard__more"><span class="link-arrow">Mehr erfahren ' + arrow + '</span></div>'
            + '</a>';
        } else {
          return json({ error: "bad_block_type" }, 400);
        }
      }
      const f = await getFile(file);
      // Balanciert ersetzen: Zonen-Inhalt kann verschachtelte <div> enthalten (z. B. Karten mit
      // .scard__icon/.scard__more) – ein non-greedy </div>-Match würde am ersten inneren </div> abbrechen.
      const html = replaceZoneInner(f.text, zone, inner);
      if (html === null) return json({ error: "marker_missing", field: zone }, 400);
      const r = await putFile(file, utf8B64(html), f.sha, "Editor: Elemente/Buttons aktualisiert (" + file + ")");
      return r.ok ? json({ ok: true }) : json({ error: "commit_failed" }, 500);
    }

    if (body.action === "save-footer") {
      // Eigene Footer-Links (pro Spalte) – geteilt auf ALLEN Seiten (wie save-shared).
      const links = (body.links || {}) as Record<string, any>;
      const COLS = ["leistungen", "informationen", "kontakt"];
      const rendered: Record<string, string> = {};
      for (const col of COLS) {
        const arr = Array.isArray(links[col]) ? links[col] : [];
        if (arr.length > 12) return json({ error: "too_many", field: col }, 400);
        let out = "";
        for (const it of arr) {
          const text = esc(String((it && it.text) || "").slice(0, 60).trim());
          const href = normHref(String((it && it.href) || ""));
          if (!text) continue;
          if (href && href !== "#" && !safeHref(href)) return json({ error: "bad_href" }, 400);
          const ext = /^https?:\/\//i.test(href);
          out += '<a href="' + esc(href || "#") + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ' data-eb="flink">' + text + "</a>";
        }
        rendered[col] = out;
      }
      const changed: { path: string; contentB64: string }[] = [];
      let foundMarker = false; // gab es die Zonen ueberhaupt? (echter Fehler) …
      for (const page of [...PAGES, ...(await extraPages())]) {
        const pf = await getFile(page);
        let h = pf.text, ch = false;
        for (const col of COLS) {
          const re = new RegExp('(<div class="eb-footadd" data-foot-zone="' + col + '"[^>]*>)([\\s\\S]*?)(</div>)');
          if (re.test(h)) {
            foundMarker = true;
            const nh = h.replace(re, (_m, a, _o, c) => a + rendered[col] + c);
            if (nh !== h) { h = nh; ch = true; }
          }
        }
        if (ch) changed.push({ path: page, contentB64: utf8B64(h) });
      }
      if (!foundMarker) return json({ error: "marker_missing" }, 400);
      // … oder war schlicht nichts zu aendern? Das ist KEIN Fehler.
      if (!changed.length) return json({ ok: true, updated: 0 });
      const okc = await commitMulti(changed, "Editor: Footer-Links aktualisiert");
      return okc ? json({ ok: true, updated: changed.length }) : json({ error: "commit_failed" }, 500);
    }

    if (body.action === "save-footer-order") {
      // Reihenfolge der FESTEN Footer-Links: die <a data-eds="…"> zwischen der Spalten-
      // Ueberschrift und dem eb-footadd-Marker. Es wird AUSSCHLIESSLICH umsortiert –
      // Text/Ziel bleiben unveraendert, damit die data-eds-Kopplung ans Menue haelt.
      const order = (body.order || {}) as Record<string, string[]>;
      const OCOLS = ["leistungen", "informationen", "kontakt"];
      for (const col of OCOLS) {
        const arr = order[col];
        if (arr === undefined) continue;
        if (!Array.isArray(arr) || arr.length > 30) return json({ error: "bad_order", field: col }, 400);
        for (const k of arr) {
          if (typeof k !== "string" || !/^[a-z0-9-]{1,48}$/.test(k)) return json({ error: "bad_key", field: col }, 400);
        }
      }
      const ordChanged: { path: string; contentB64: string }[] = [];
      for (const page of [...PAGES, ...(await extraPages())]) {
        const pf = await getFile(page);
        let h = pf.text, ch = false;
        for (const col of OCOLS) {
          const arr = order[col];
          if (!Array.isArray(arr) || !arr.length) continue;
          const re = new RegExp('(<h4[^>]*data-eds="lbl-foot-' + col + '"[^>]*>[\\s\\S]*?</h4>)([\\s\\S]*?)(<div[^>]*data-foot-zone="' + col + '")');
          const m = re.exec(h);
          if (!m) continue;
          const anchors = m[2].match(/<a\b[\s\S]*?<\/a>/g) || [];
          if (!anchors.length) continue;
          const keyOf = (a: string) => { const km = /data-eds="([a-z0-9-]+)"/.exec(a); return km ? km[1] : ""; };
          const byKey: Record<string, string> = {};
          for (const a of anchors) { const k = keyOf(a); if (k) byKey[k] = a; }
          const used = new Set<string>();
          let out = "";
          for (const k of arr) if (byKey[k] && !used.has(k)) { out += "\n        " + byKey[k]; used.add(k); }
          // Nicht genannte Links hinten anhaengen -> es kann NIE einer verloren gehen
          for (const a of anchors) { const k = keyOf(a); if (!k || !used.has(k)) { out += "\n        " + a; if (k) used.add(k); } }
          const rebuilt = m[1] + out + "\n        " + m[3];
          const nh = h.replace(re, () => rebuilt); // Funktion -> $-Zeichen im Inhalt sind ungefaehrlich
          if (nh !== h) { h = nh; ch = true; }
        }
        if (ch) ordChanged.push({ path: page, contentB64: utf8B64(h) });
      }
      if (!ordChanged.length) return json({ ok: true, updated: 0 });
      const okOrd = await commitMulti(ordChanged, "Editor: Footer-Reihenfolge aktualisiert");
      return okOrd ? json({ ok: true, updated: ordChanged.length }) : json({ error: "commit_failed" }, 500);
    }

    if (body.action === "save-menu") {
      // Eigene Menüpunkte -> menu.json (veröffentlicht). Client blendet sie ins Haupt-/Mobil-Menü ein.
      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length > 8) return json({ error: "too_many" }, 400);
      const clean: Array<{ text: string; href: string }> = [];
      for (const it of items) {
        const text = String((it && it.text) || "").replace(/\s+/g, " ").trim().slice(0, 40);
        const href = String((it && it.href) || "").trim();
        if (!text) continue;
        if (!safeHref(href)) return json({ error: "bad_href", field: text }, 400);
        clean.push({ text, href });
      }
      let sha: string | undefined;
      try { sha = (await getFile("menu.json")).sha; } catch { sha = undefined; }
      const r = await putFile("menu.json", utf8B64(JSON.stringify(clean, null, 2)), sha, "Editor: Menüpunkte aktualisiert");
      return r.ok ? json({ ok: true, count: clean.length }) : json({ error: "commit_failed" }, 500);
    }

    if (body.action === "list-pages") {
      // Dateiliste (autoritativ aus dem Manifest) + Titel (aus der veröffentlichten pages.json).
      const files = await extraPages();
      const titles: Record<string, string> = {};
      try {
        const pj = await getFile("pages.json");
        const a = JSON.parse(pj.text);
        if (Array.isArray(a)) for (const x of a) if (x && typeof x.file === "string" && typeof x.title === "string") titles[x.file] = x.title;
      } catch { /* noch keine pages.json */ }
      return json({ ok: true, pages: files, items: files.map((f) => ({ file: f, title: titles[f] || f })) });
    }

    if (body.action === "create-page") {
      // Neue Seite aus _template.html. Slug streng validiert (kein Pfad-Trick, kein Überschreiben).
      const slug = String(body.slug || "").toLowerCase().trim();
      if (!/^[a-z][a-z0-9-]{1,38}$/.test(slug)) return json({ error: "bad_slug" }, 400);
      const file = slug + ".html";
      if (PAGES.has(file) || RESERVED_SLUGS.has(slug)) return json({ error: "reserved" }, 400);
      const title = String(body.title || "").trim();
      if (title.length < 2 || title.length > 80) return json({ error: "bad_title" }, 400);
      const desc = String(body.description || "").trim().slice(0, 320);
      const extra = await extraPages();
      if (extra.includes(file)) return json({ error: "exists" }, 400);
      if (extra.length >= 50) return json({ error: "limit" }, 400);
      // Echte Repo-Existenzprüfung: niemals eine bereits vorhandene Datei überschreiben.
      let existsInRepo = false;
      try { await getFile(file); existsInRepo = true; } catch { /* nicht vorhanden -> ok */ }
      if (existsInRepo) return json({ error: "exists" }, 400);
      let tpl: { sha: string; text: string };
      try { tpl = await getFile("_template.html"); } catch { return json({ error: "no_template" }, 500); }
      const et = esc(title), ed = esc(desc || title);
      const pageHtml = tpl.text.split("@@TITLE@@").join(et).split("@@DESC@@").join(ed).split("@@SLUG@@").join(file);
      const newManifest = JSON.stringify([...extra, file].sort(), null, 2);
      const files: { path: string; contentB64: string }[] = [
        { path: file, contentB64: utf8B64(pageHtml) },
        { path: PAGES_MANIFEST, contentB64: utf8B64(newManifest) },
      ];
      try {
        const sm = await getFile("sitemap.xml");
        let sitemap = sm.text;
        if (sitemap.indexOf("/" + file + "<") < 0 && sitemap.indexOf("</urlset>") >= 0) {
          const entry = "  <url>\n    <loc>https://andreasdevries.de/" + file + "</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n";
          sitemap = sitemap.replace("</urlset>", entry + "</urlset>");
          files.push({ path: "sitemap.xml", contentB64: utf8B64(sitemap) });
        }
      } catch { /* Sitemap optional */ }
      // Öffentliche Nav-Liste (mit Titeln) pflegen -> Client blendet erstellte Seiten ins Menü ein.
      let pubList: Array<{ file: string; title: string }> = [];
      try { const pj = await getFile("pages.json"); const a = JSON.parse(pj.text); if (Array.isArray(a)) pubList = a.filter((x) => x && typeof x.file === "string"); } catch { /* noch keine */ }
      pubList = pubList.filter((x) => x.file !== file);
      pubList.push({ file, title });
      files.push({ path: "pages.json", contentB64: utf8B64(JSON.stringify(pubList, null, 2)) });
      const okc = await commitMulti(files, "Editor: neue Seite erstellt (" + file + ")");
      return okc ? json({ ok: true, file }) : json({ error: "commit_failed" }, 500);
    }

    if (body.action === "delete-page") {
      // Nur selbst erstellte Seiten (Manifest) löschbar – Builtin-Seiten NIE.
      const file = String(body.file || "");
      const extra = await extraPages();
      if (!extra.includes(file)) return json({ error: "not_deletable" }, 400);
      // Upload-Bilder dieser Seite merken (für Verwaisten-Cleanup danach).
      let pageImgs: string[] = [], pageSha = "";
      try {
        const pf = await getFile(file);
        pageSha = pf.sha;
        const set = new Set<string>();
        const reI = /assets\/img\/uploads\/[a-z0-9-]{8,60}\.(?:jpg|jpeg|png|webp)/gi;
        let mm; while ((mm = reI.exec(pf.text))) set.add(mm[0]);
        pageImgs = [...set];
      } catch { /* evtl. schon weg */ }
      if (pageSha) {
        const dr = await ghDelete(file, pageSha, "Editor: Seite gelöscht (" + file + ")");
        if (!dr.ok) return json({ error: "delete_failed" }, 500);
      }
      const putFiles: { path: string; contentB64: string }[] = [
        { path: PAGES_MANIFEST, contentB64: utf8B64(JSON.stringify(extra.filter((p) => p !== file), null, 2)) },
      ];
      try {
        const sm = await getFile("sitemap.xml");
        const re = new RegExp("[ \\t]*<url>\\s*<loc>[^<]*/" + file.replace(/\./g, "\\.") + "</loc>[\\s\\S]*?</url>\\s*", "i");
        putFiles.push({ path: "sitemap.xml", contentB64: utf8B64(sm.text.replace(re, "")) });
      } catch { /* Sitemap optional */ }
      try {
        const pj = await getFile("pages.json");
        const a = JSON.parse(pj.text);
        if (Array.isArray(a)) putFiles.push({ path: "pages.json", contentB64: utf8B64(JSON.stringify(a.filter((x: any) => !(x && x.file === file)), null, 2)) });
      } catch { /* pages.json optional */ }
      const okc = await commitMulti(putFiles, "Editor: Seiten-Liste aktualisiert");
      // Verwaiste Upload-Bilder entfernen: jede ANDERE Seite EINMAL lesen, nur ungenutzte löschen.
      if (pageImgs.length) {
        const others = [...PAGES, ...extra].filter((p) => p !== file);
        const usedElsewhere = new Set<string>();
        for (const pg of others) {
          try { const t = (await getFile(pg)).text; for (const img of pageImgs) if (!usedElsewhere.has(img) && t.includes(img)) usedElsewhere.add(img); } catch { /* skip */ }
        }
        for (const img of pageImgs) {
          if (usedElsewhere.has(img)) continue;
          try { const ish = (await getFile(img)).sha; await ghDelete(img, ish, "Editor: verwaistes Bild entfernt"); } catch { /* schon weg */ }
        }
      }
      return okc ? json({ ok: true }) : json({ error: "commit_failed" }, 500);
    }

    if (body.action === "upload-block-image") {
      // Freies Bild für einen Bild-Block hochladen. Dateiname ist SERVER-generiert (UUID) ->
      // kein Pfad-Trick möglich; Typ per Magic-Bytes, Größe gedeckelt.
      const data = body.dataBase64 as string;
      if (typeof data !== "string" || data.length > 3_000_000) return json({ error: "image_too_big" }, 400);
      const head = atob(data.slice(0, 32));
      const bts = [...head].map((c) => c.charCodeAt(0));
      const ext = (bts[0] === 0xFF && bts[1] === 0xD8 && bts[2] === 0xFF) ? "jpg"
                : (bts[0] === 0x89 && bts[1] === 0x50 && bts[2] === 0x4E && bts[3] === 0x47 && bts[4] === 0x0D && bts[5] === 0x0A && bts[6] === 0x1A && bts[7] === 0x0A) ? "png"
                : (head.slice(0, 4) === "RIFF" && head.slice(8, 12) === "WEBP") ? "webp" : "";
      if (!ext) return json({ error: "not_image" }, 400);
      const src = "assets/img/uploads/" + crypto.randomUUID() + "." + ext;
      const r = await putFile(src, data, undefined, "Editor: Block-Bild hochgeladen");
      return r.ok ? json({ ok: true, src }) : json({ error: "commit_failed" }, 500);
    }

    if (body.action === "duplicate-page") {
      // Bestehende (gültige) Seite als neue Unterseite kopieren.
      const source = String(body.source || "");
      if (!(await isValidPage(source))) return json({ error: "bad_source" }, 400);
      const slug = String(body.slug || "").toLowerCase().trim();
      if (!/^[a-z][a-z0-9-]{1,38}$/.test(slug)) return json({ error: "bad_slug" }, 400);
      const file = slug + ".html";
      if (PAGES.has(file) || RESERVED_SLUGS.has(slug)) return json({ error: "reserved" }, 400);
      const title = String(body.title || "").trim();
      if (title.length < 2 || title.length > 80) return json({ error: "bad_title" }, 400);
      const extra = await extraPages();
      if (extra.includes(file)) return json({ error: "exists" }, 400);
      if (extra.length >= 50) return json({ error: "limit" }, 400);
      try { await getFile(file); return json({ error: "exists" }, 400); } catch { /* frei */ }
      const srcFile = await getFile(source);
      const et = esc(title);
      let html = srcFile.text
        .replace(/<title>[\s\S]*?<\/title>/, () => "<title>" + et + " | de Vries</title>")
        .replace(/(<meta property="og:title" content=")[^"]*(">)/, (_m, a, b2) => a + et + " | de Vries" + b2)
        .replace(/(<meta name="twitter:title" content=")[^"]*(">)/, (_m, a, b2) => a + et + " | de Vries" + b2);
      html = html.split("/" + source + '"').join("/" + file + '"'); // canonical + og:url auf neue Datei
      const files: { path: string; contentB64: string }[] = [
        { path: file, contentB64: utf8B64(html) },
        { path: PAGES_MANIFEST, contentB64: utf8B64(JSON.stringify([...extra, file].sort(), null, 2)) },
      ];
      let pubList: Array<{ file: string; title: string }> = [];
      try { const pj = await getFile("pages.json"); const a = JSON.parse(pj.text); if (Array.isArray(a)) pubList = a.filter((x) => x && typeof x.file === "string"); } catch { /* leer */ }
      pubList = pubList.filter((x) => x.file !== file);
      pubList.push({ file, title });
      files.push({ path: "pages.json", contentB64: utf8B64(JSON.stringify(pubList, null, 2)) });
      try {
        const sm = await getFile("sitemap.xml");
        let sitemap = sm.text;
        if (sitemap.indexOf("/" + file + "<") < 0 && sitemap.indexOf("</urlset>") >= 0) {
          const entry = "  <url>\n    <loc>https://andreasdevries.de/" + file + "</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n";
          sitemap = sitemap.replace("</urlset>", entry + "</urlset>");
          files.push({ path: "sitemap.xml", contentB64: utf8B64(sitemap) });
        }
      } catch { /* Sitemap optional */ }
      const okc = await commitMulti(files, "Editor: Seite dupliziert (" + source + " -> " + file + ")");
      return okc ? json({ ok: true, file }) : json({ error: "commit_failed" }, 500);
    }

    if (body.action === "list-uploads") {
      // Mediathek: hochgeladene Block-Bilder auflisten.
      try {
        const r = await gh("contents/assets/img/uploads");
        if (!r.ok) return json({ ok: true, uploads: [] });
        const arr = await r.json();
        const uploads = Array.isArray(arr)
          ? arr.filter((f: any) => f && typeof f.name === "string" && /^[a-z0-9-]{8,60}\.(jpg|jpeg|png|webp)$/i.test(f.name)).map((f: any) => "assets/img/uploads/" + f.name)
          : [];
        return json({ ok: true, uploads });
      } catch { return json({ ok: true, uploads: [] }); }
    }

    if (body.action === "delete-upload") {
      // Mediathek: Bild löschen – NUR wenn es auf keiner Seite mehr verwendet wird.
      const src = String(body.src || "");
      if (!/^assets\/img\/uploads\/[a-z0-9-]{8,60}\.(jpg|jpeg|png|webp)$/i.test(src)) return json({ error: "bad_src" }, 400);
      for (const pg of [...PAGES, ...(await extraPages())]) {
        try { if ((await getFile(pg)).text.includes(src)) return json({ error: "in_use" }, 409); } catch { /* skip */ }
      }
      try {
        const sh = (await getFile(src)).sha;
        const dr = await ghDelete(src, sh, "Editor: Bild aus Mediathek gelöscht");
        return dr.ok ? json({ ok: true }) : json({ error: "delete_failed" }, 500);
      } catch { return json({ ok: true }); }
    }

    return json({ error: "bad_action" }, 400);
  } catch (_e) {
    return json({ error: "server_error" }, 500);
  }
}
