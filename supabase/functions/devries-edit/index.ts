// de Vries – Inhalts-Editor (Speicher-Backend)
// Sicherheit: Passwort (konstante Zeit) + Rate-Limit + strikte Whitelist von
// bearbeitbaren Feldern/Bildern. Der GitHub-Token bleibt server-seitig (Secret)
// und darf NUR dieses eine Repo beschreiben. Deploy mit --no-verify-jwt
// (das Passwort ist die Zugangskontrolle).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
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
  return /^https?:\/\//i.test(h) || /^mailto:/i.test(h) || /^tel:/i.test(h)
      || /^[\w./-]+\.html(#[\w-]+)?$/i.test(h) || /^#[\w-]+$/.test(h);
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
    return safeHref(href) ? '<a href="' + href + '">' : "";
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!GH_TOKEN || !EDIT_PW) return json({ error: "not_configured" }, 503);

  const admin = createClient(SB_URL, SB_SR);
  // Echte Client-IP = LETZTER X-Forwarded-For-Eintrag (vom vertrauenswürdigen Edge-Proxy
  // angehängt). Vom Client selbst gespoofte Werte stehen weiter links -> werden ignoriert.
  const xff = (req.headers.get("x-forwarded-for") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = xff[xff.length - 1] || "unknown";

  // Rate-Limit (Brute-Force-Schutz): pro IP >=10 ODER global >=60 Fehlversuche in 15 Min -> 429.
  // Der globale Zähler fängt verteilte Versuche ab (IP-Rotation); harte Sperre nur 15 Min und
  // betrifft nur den Editor, nie die öffentliche Seite.
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const [perIp, global] = await Promise.all([
    admin.from("devries_edit_log").select("*", { count: "exact", head: true }).eq("ip", ip).eq("ok", false).gte("created_at", since),
    admin.from("devries_edit_log").select("*", { count: "exact", head: true }).eq("ok", false).gte("created_at", since),
  ]);
  if ((perIp.count || 0) >= 10 || (global.count || 0) >= 60) return json({ error: "rate_limited" }, 429);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }

  const ok = typeof body.password === "string" && ctEq(body.password, EDIT_PW);
  await admin.from("devries_edit_log").insert({ ip, ok });
  if (!ok) { await new Promise((r) => setTimeout(r, 600)); return json({ error: "unauthorized" }, 401); }

  try {
    if (body.action === "save-home") {
      const fields = (body.fields || {}) as Record<string, string>;
      for (const k of Object.keys(fields)) {
        if (!(k in HOME_FIELDS)) return json({ error: "bad_field", field: k }, 400);
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
      if (!PAGES.has(file)) return json({ error: "bad_file" }, 400);
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
        if (!(slot in IMG_SLOTS)) return json({ error: "bad_slot", field: slot }, 400);
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
      if (!(slot in IMG_SLOTS)) return json({ error: "bad_slot" }, 400);
      if (typeof data !== "string" || data.length > 3_000_000) return json({ error: "image_too_big" }, 400);
      const head = atob(data.slice(0, 32));
      const b = [...head].map((c) => c.charCodeAt(0));
      const isJpg = b[0] === 0xFF && b[1] === 0xD8;
      const isPng = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47;
      const isWebp = head.slice(0, 4) === "RIFF";
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
      for (const page of PAGES) {
        const f = await getFile(page);
        let html = f.text, changed = false;
        for (const k of keys) {
          const re = new RegExp('(data-eds="' + k + '"[^>]*>)([^<]*)(</)', "g"); // global: jedes Vorkommen pro Seite
          const nv = esc(shared[k]);
          const nh = html.replace(re, (_m, a, _b, c) => a + nv + c);
          if (nh !== html) { html = nh; changed = true; }
        }
        if (changed) changedFiles.push({ path: page, contentB64: utf8B64(html) });
      }
      if (!changedFiles.length) return json({ error: "marker_missing" }, 400);
      const okShared = await commitMulti(changedFiles, "Editor: Menü/Footer aktualisiert");
      return okShared ? json({ ok: true, updated: changedFiles.length }) : json({ error: "commit_failed" }, 500);
    }

    return json({ error: "bad_action" }, 400);
  } catch (_e) {
    return json({ error: "server_error" }, 500);
  }
});
