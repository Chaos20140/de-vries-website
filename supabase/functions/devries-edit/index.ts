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
const IMG_SLOTS: Record<string, string> = { "hero": "assets/img/senioren-zuhause.jpg" };

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  if (!GH_TOKEN || !EDIT_PW) return json({ error: "not_configured" }, 503);

  const admin = createClient(SB_URL, SB_SR);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown";

  // Rate-Limit: >= 10 Fehlversuche je IP in 15 Min -> sperren
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await admin.from("devries_edit_log")
    .select("*", { count: "exact", head: true }).eq("ip", ip).eq("ok", false).gte("created_at", since);
  if ((count || 0) >= 10) return json({ error: "rate_limited" }, 429);

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

    return json({ error: "bad_action" }, 400);
  } catch (_e) {
    return json({ error: "server_error" }, 500);
  }
});
