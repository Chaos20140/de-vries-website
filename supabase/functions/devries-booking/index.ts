// de Vries — Terminbuchung (Supabase Edge Function, Deno)
// Endpunkte (Basis: /functions/v1/devries-booking):
//   GET  /health        → { status:"ok" }
//   GET  /booked-slots  → { slots:[{date,time}] }  (nur BESTÄTIGTE, ohne PII)
//   POST /booking       → speichert Anfrage (status=pending), mailt Inhaber (Bestätigen/Ablehnen)
//   GET  /confirm?token=…&action=confirm|decline → setzt Status, zeigt HTML-Seite
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const RESEND_FROM    = Deno.env.get("RESEND_FROM") || "de Vries <onboarding@resend.dev>";
const OWNER_EMAIL    = Deno.env.get("OWNER_EMAIL") || "tolunayusul@gmail.com";
const FUNCTION_BASE  = Deno.env.get("FUNCTION_BASE") || `${SUPABASE_URL}/functions/v1/devries-booking`;
const SITE_URL       = Deno.env.get("SITE_URL") || "https://chaos20140.github.io/de-vries-website";
const REPLY_TO       = Deno.env.get("REPLY_TO") || "info@andreasdevries.de";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const SLOTS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00"];
const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const WD = ["So","Mo","Di","Mi","Do","Fr","Sa"];

// CORS: nur die eigene Website darf die Buchungs-API vom Browser aus aufrufen
// (statt "*"). Per Env ALLOW_ORIGIN überschreibbar, falls später eine eigene
// Domain (CNAME) dazukommt. /confirm ist eine Top-Level-Navigation (kein CORS)
// und bleibt davon unberührt.
const ALLOW_ORIGIN = Deno.env.get("ALLOW_ORIGIN") || "https://chaos20140.github.io";
const CORS = {
  "Access-Control-Allow-Origin": ALLOW_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
// /confirm leitet auf eine echte Status-Seite der Website um (rendert garantiert als HTML,
// anders als Function-Antworten, die Supabase als text/plain ausliefert).
const redirect = (s: string) => new Response(null, { status: 302, headers: { ...CORS, "Location": `${SITE_URL}/termin-status.html?s=${s}` } });

function fmtDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return `${WD[d.getDay()]}. ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function page(title: string, msg: string, ok = true) {
  return new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} – de Vries</title>
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#faf6f0;color:#1c1714;display:grid;place-items:center;min-height:100vh;padding:1.5rem}
  .card{background:#fff;border:1px solid rgba(28,23,20,.12);border-radius:18px;max-width:480px;padding:2.5rem 2rem;box-shadow:0 30px 70px -45px rgba(28,23,20,.4);text-align:center}
  .mark{width:54px;height:54px;border-radius:50%;display:grid;place-items:center;margin:0 auto 1.2rem;font-size:1.6rem;background:${ok ? "#e7f4e3" : "#f4d9d6"}}
  h1{font-size:1.5rem;margin:0 0 .8rem}
  p{color:#4a423c;line-height:1.6;margin:0}
  .logo{display:inline-block;width:46px;height:46px;border-radius:9px;background:#d7120a;color:#fff;font-weight:800;font-size:1.4rem;line-height:46px;margin-bottom:1.4rem;letter-spacing:1px}
</style></head>
<body><div class="card"><div class="logo">DV</div><div class="mark">${ok ? "✓" : "–"}</div><h1>${esc(title)}</h1><p>${msg}</p></div></body></html>`,
    { status: 200, headers: { ...CORS, "Content-Type": "text/html; charset=utf-8" } },
  );
}

async function mailOwner(b: Record<string, string>) {
  if (!RESEND_API_KEY) return false;
  const confirm = `${FUNCTION_BASE}/confirm?token=${b.token}&action=confirm`;
  const decline = `${FUNCTION_BASE}/confirm?token=${b.token}&action=decline`;
  const body = `
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:auto;color:#1c1714">
  <h2 style="color:#d7120a;margin:0 0 1rem">Neue Terminanfrage</h2>
  <table style="width:100%;border-collapse:collapse;font-size:15px">
    <tr><td style="padding:8px 0;color:#756a60">Leistung</td><td style="padding:8px 0;font-weight:700;text-align:right">${esc(b.service)}</td></tr>
    <tr><td style="padding:8px 0;color:#756a60">Datum</td><td style="padding:8px 0;font-weight:700;text-align:right">${esc(b.appt_date_de)}</td></tr>
    <tr><td style="padding:8px 0;color:#756a60">Uhrzeit</td><td style="padding:8px 0;font-weight:700;text-align:right">${esc(b.appt_time)} Uhr</td></tr>
    <tr><td style="padding:8px 0;color:#756a60">Name</td><td style="padding:8px 0;font-weight:700;text-align:right">${esc(b.name)}</td></tr>
    <tr><td style="padding:8px 0;color:#756a60">Telefon</td><td style="padding:8px 0;font-weight:700;text-align:right">${esc(b.phone)}</td></tr>
    <tr><td style="padding:8px 0;color:#756a60">E-Mail</td><td style="padding:8px 0;font-weight:700;text-align:right">${esc(b.email)}</td></tr>
  </table>
  ${b.message ? `<p style="background:#f1e9de;padding:12px 14px;border-radius:10px;margin:1rem 0"><strong>Nachricht:</strong><br>${esc(b.message)}</p>` : ""}
  <div style="margin:1.8rem 0;text-align:center">
    <a href="${confirm}" style="display:inline-block;background:#d7120a;color:#fff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px;margin:6px">✅ Bestätigen</a>
    <a href="${decline}" style="display:inline-block;background:#fff;color:#1c1714;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:999px;border:1px solid #ccc;margin:6px">❌ Ablehnen</a>
  </div>
  <p style="font-size:12px;color:#999;text-align:center">Erst nach „Bestätigen" wird der Zeit-Slot auf der Website gesperrt.</p>
</div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: [OWNER_EMAIL], subject: `Neue Terminanfrage: ${b.service} am ${b.appt_date_de} ${b.appt_time}`, html: body }),
    });
    return r.ok;
  } catch { return false; }
}

// Bestätigungs-Mail an den Kunden (nach „Bestätigen"). Funktioniert nur mit
// verifizierter Resend-Absender-Domain (RESEND_FROM); sonst lehnt Resend den
// Versand an fremde Adressen ab → Bestätigung läuft trotzdem durch.
async function mailCustomer(b: Record<string, string>) {
  if (!RESEND_API_KEY) return false;
  const body = `
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px;margin:auto;color:#1c1714">
  <div style="width:46px;height:46px;border-radius:9px;background:#d7120a;color:#fff;font-weight:800;font-size:20px;line-height:46px;text-align:center;letter-spacing:1px">DV</div>
  <h2 style="margin:1rem 0 .5rem">Ihr Termin ist bestätigt ✅</h2>
  <p style="color:#4a423c;line-height:1.6;margin:0 0 1rem">Guten Tag ${esc(b.name)},<br>vielen Dank für Ihre Anfrage – wir freuen uns, Ihren Wunschtermin zu bestätigen:</p>
  <table style="width:100%;border-collapse:collapse;font-size:15px;background:#faf6f0;border-radius:12px;overflow:hidden">
    <tr><td style="padding:12px 14px;color:#756a60">Leistung</td><td style="padding:12px 14px;font-weight:700;text-align:right">${esc(b.service)}</td></tr>
    <tr><td style="padding:12px 14px;color:#756a60">Datum</td><td style="padding:12px 14px;font-weight:700;text-align:right">${esc(b.appt_date_de)}</td></tr>
    <tr><td style="padding:12px 14px;color:#756a60">Uhrzeit</td><td style="padding:12px 14px;font-weight:700;text-align:right">${esc(b.appt_time)} Uhr</td></tr>
  </table>
  <p style="color:#4a423c;line-height:1.6;margin:1.2rem 0 0">Müssen Sie den Termin verschieben oder absagen? Melden Sie sich gerne unter <strong>05153 - 1552</strong> oder ${esc(REPLY_TO)}.</p>
  <p style="color:#4a423c;line-height:1.6;margin:1rem 0 0">Herzliche Grüße<br><strong>Ihr de Vries Team</strong><br><span style="color:#756a60">An den Flachsrotten 2 · 31020 Salzhemmendorf</span></p>
</div>`;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: RESEND_FROM, to: [b.email], reply_to: REPLY_TO, subject: `Ihr Termin bei de Vries ist bestätigt – ${b.appt_date_de}, ${b.appt_time} Uhr`, html: body }),
    });
    return r.ok;
  } catch { return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/devries-booking/, "") || "/";

  if (path === "/health") return json({ status: "ok" });

  // ---- belegte (bestätigte) Slots, OHNE personenbezogene Daten ----
  if (path === "/booked-slots" && req.method === "GET") {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await admin
      .from("devries_bookings").select("appt_date, appt_time")
      .eq("status", "confirmed").gte("appt_date", today);
    if (error) return json({ slots: [] });
    return json({ slots: (data || []).map((r) => ({ date: r.appt_date, time: r.appt_time })) });
  }

  // ---- neue Anfrage ----
  if (path === "/booking" && req.method === "POST") {
    let b: Record<string, string>;
    try { b = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
    const service = (b.service || "").trim();
    const dateISO = (b.dateISO || "").trim();
    const time = (b.time || "").trim();
    const name = (b.name || "").trim();
    const phone = (b.phone || "").trim();
    const email = (b.email || "").trim();
    const message = (b.message || "").trim().slice(0, 2000);

    const fields: string[] = [];
    if (!service || service.length > 120) fields.push("service");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) fields.push("date");
    else if (dateISO < new Date().toISOString().slice(0, 10)) fields.push("date"); // keine Termine in der Vergangenheit
    if (SLOTS.indexOf(time) < 0) fields.push("time");
    if (!name || name.length > 120) fields.push("name");
    if (!phone || phone.length > 60) fields.push("phone");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fields.push("email");
    if (fields.length) return json({ error: "validation", fields }, 422);

    // ---- Rate-Limit (Spam-/Flood-Schutz fürs Postfach + die DB) ----
    // Fail-open: bei einem DB-Fehler wird die Buchung NICHT blockiert.
    // Grenzen bewusst großzügig (echte Praxis: wenige Anfragen/Tag), kappen aber
    // Fluten: global >=6 in 10 Min ODER >=3 mit derselben E-Mail in 60 Min -> 429.
    try {
      const nowMs = Date.now();
      const win10 = new Date(nowMs - 10 * 60 * 1000).toISOString();
      const win60 = new Date(nowMs - 60 * 60 * 1000).toISOString();
      const [glob, perMail] = await Promise.all([
        admin.from("devries_bookings").select("*", { count: "exact", head: true }).gte("created_at", win10),
        admin.from("devries_bookings").select("*", { count: "exact", head: true }).eq("email", email).gte("created_at", win60),
      ]);
      if ((glob.count || 0) >= 6 || (perMail.count || 0) >= 3) return json({ error: "rate_limited" }, 429);
    } catch { /* fail-open: im Zweifel Buchung zulassen */ }

    // Slot schon bestätigt vergeben?
    const { data: taken } = await admin.from("devries_bookings")
      .select("id").eq("status", "confirmed").eq("appt_date", dateISO).eq("appt_time", time).limit(1);
    if (taken && taken.length) return json({ error: "slot_taken" }, 409);

    const appt_date_de = fmtDate(dateISO);
    const { data, error } = await admin.from("devries_bookings")
      .insert({ service, appt_date: dateISO, appt_date_de, appt_time: time, name, phone, email, message: message || null })
      .select("id, token").single();
    if (error) return json({ error: "db_error" }, 500);

    const emailed = await mailOwner({ token: data.token, service, appt_date_de, appt_time: time, name, phone, email, message });
    return json({ ok: true, id: data.id, emailed });
  }

  // ---- Bestätigen / Ablehnen (per geheimem Token) ----
  if (path === "/confirm" && req.method === "GET") {
    const token = url.searchParams.get("token") || "";
    const action = url.searchParams.get("action") || "";
    if (!/^[0-9a-f-]{36}$/i.test(token) || (action !== "confirm" && action !== "decline")) return redirect("invalid");

    const { data: bk } = await admin.from("devries_bookings").select("*").eq("token", token).single();
    if (!bk) return redirect("notfound");
    if (bk.status !== "pending") return redirect(bk.status === "confirmed" ? "already-confirmed" : "already-declined");

    if (action === "confirm") {
      const { data: taken } = await admin.from("devries_bookings")
        .select("id").eq("status", "confirmed").eq("appt_date", bk.appt_date).eq("appt_time", bk.appt_time).limit(1);
      if (taken && taken.length) return redirect("taken");
      await admin.from("devries_bookings").update({ status: "confirmed" }).eq("id", bk.id);
      await mailCustomer(bk);
      return redirect("confirmed");
    } else {
      await admin.from("devries_bookings").update({ status: "declined" }).eq("id", bk.id);
      return redirect("declined");
    }
  }

  return json({ error: "not_found" }, 404);
});
