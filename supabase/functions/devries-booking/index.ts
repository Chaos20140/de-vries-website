// de Vries — Terminbuchung (Supabase Edge Function, Deno)
// Endpunkte (Basis: /functions/v1/devries-booking):
//   GET  /health        → { status:"ok" }
//   GET  /booked-slots  → { slots:[{date,time}] }  (nur BESTÄTIGTE, ohne PII)
//   POST /booking       → speichert Anfrage (status=pending), mailt Inhaber (Bestätigen/Ablehnen)
//   POST /contact       → Kontaktformular: schickt die Nachricht direkt per Mail an den Inhaber
//   GET  /confirm?token=…&action=confirm|decline → setzt Status, zeigt HTML-Seite
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Mailversand ueber den SMTP-Server des eigenen Postfachs (kein Drittanbieter).
// Diese Werte als Supabase-Secrets setzen; SMTP_PASS ist das Postfach-Passwort.
const SMTP_HOST      = Deno.env.get("SMTP_HOST") || "";
const SMTP_PORT      = Number(Deno.env.get("SMTP_PORT") || "465");
const SMTP_USER      = Deno.env.get("SMTP_USER") || "";
const SMTP_PASS      = Deno.env.get("SMTP_PASS") || "";
const MAIL_FROM      = Deno.env.get("MAIL_FROM") || "info@andreasdevries.de";
const MAIL_FROM_NAME = Deno.env.get("MAIL_FROM_NAME") || "de Vries";
const OWNER_EMAIL    = Deno.env.get("OWNER_EMAIL") || "info@andreasdevries.de";
const SITE_URL       = Deno.env.get("SITE_URL") || "https://chaos20140.github.io/de-vries-website";
const REPLY_TO       = Deno.env.get("REPLY_TO") || "info@andreasdevries.de";
const FN_BASE        = `${SUPABASE_URL}/functions/v1/devries-booking`; // fuer den .ics-Kalenderlink

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

// ---- Kalender (.ics) ----
const icsEsc = (s: unknown) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function icsFor(bk: Record<string, string>): string {
  const d = String(bk.appt_date).replace(/-/g, "");                 // 20271015
  const sh = String(bk.appt_time).slice(0, 2), sm = String(bk.appt_time).slice(3, 5);
  const eh = String(Number(sh) + 1).padStart(2, "0");               // +1h Termindauer
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//de Vries//Termin//DE", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${icsEsc(bk.id)}@andreasdevries.de`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${d}T${sh}${sm}00`,
    `DTEND:${d}T${eh}${sm}00`,
    `SUMMARY:de Vries – ${icsEsc(bk.service)}`,
    "LOCATION:An den Flachsrotten 2\\, 31020 Salzhemmendorf",
    `DESCRIPTION:${icsEsc("Termin bei de Vries.\nLeistung: " + bk.service + "\nName: " + bk.name + "\nTelefon: " + bk.phone)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
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

// ---- E-Mail-Design (markensicher: Tabellen + Inline-Styles, keine Webfonts) ----
const M_BG = "#faf6f0", M_INK = "#1c1714", M_RED = "#d7120a", M_MUTED = "#8a7f74", M_GREEN = "#3b932b";
const M_SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif";
const M_SERIF = "Georgia,'Times New Roman',serif";

function mailRow(label: string, valueSafe: string): string {
  return `<tr>`
    + `<td style="padding:11px 0;border-bottom:1px solid rgba(28,23,20,.07);font-family:${M_SANS};font-size:14px;color:${M_MUTED};">${esc(label)}</td>`
    + `<td style="padding:11px 0;border-bottom:1px solid rgba(28,23,20,.07);font-family:${M_SANS};font-size:14px;color:${M_INK};font-weight:700;text-align:right;">${valueSafe}</td>`
    + `</tr>`;
}
function mailCard(rowsHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${M_BG};border-radius:12px;">`
    + `<tr><td style="padding:4px 18px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table></td></tr></table>`;
}
// Rahmen mit Kopfbalken, Logo, Eyebrow und Fuss; inner = eigentlicher Inhalt.
function mailDoc(preheader: string, eyebrow: string, eyebrowColor: string, inner: string): string {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>`
    + `<body style="margin:0;padding:0;background:${M_BG};">`
    + `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${M_BG};"><tr><td align="center" style="padding:30px 14px;">`
    + `<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border:1px solid rgba(28,23,20,.10);border-radius:18px;overflow:hidden;">`
    + `<tr><td style="background:${M_RED};height:5px;line-height:5px;font-size:5px;">&nbsp;</td></tr>`
    + `<tr><td style="padding:26px 32px 0;"><table role="presentation" cellpadding="0" cellspacing="0"><tr>`
    + `<td style="width:48px;"><img src="${SITE_URL}/assets/img/apple-touch-icon.png" width="48" height="48" alt="de Vries" style="display:block;border:0;border-radius:11px;"></td>`
    + `<td style="padding-left:12px;font-family:${M_SERIF};font-size:20px;font-weight:bold;color:${M_INK};letter-spacing:.4px;">de Vries</td>`
    + `</tr></table></td></tr>`
    + `<tr><td style="padding:22px 32px 0;"><p style="margin:0 0 6px;font-family:${M_SANS};font-size:12px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:${eyebrowColor};">${esc(eyebrow)}</p></td></tr>`
    + inner
    + `<tr><td style="padding:24px 32px 30px;border-top:1px solid rgba(28,23,20,.08);"><p style="margin:0;font-family:${M_SANS};font-size:12px;line-height:1.7;color:#9a8f84;">de Vries &middot; An den Flachsrotten 2 &middot; 31020 Salzhemmendorf<br>Tel. 05153 1552 &middot; info@andreasdevries.de</p></td></tr>`
    + `</table>`
    + `<p style="margin:14px 0 0;font-family:${M_SANS};font-size:11px;color:#b3a99e;">Seniorenbetreuung &amp; Haushaltshilfe in Salzhemmendorf</p>`
    + `</td></tr></table></body></html>`;
}

// Base64 fuer beliebige Bytes (chunked, ohne Call-Stack-Limit).
function b64(bytes: Uint8Array): string {
  let bin = "";
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(bin);
}
const cleanAddr = (s: string) => s.replace(/[\r\n<>]/g, "").trim();

// Mailversand ueber direktes SMTP (implizites TLS, Port 465). Die Nachricht wird SELBST
// als EIN base64-kodierter HTML-Teil gebaut -> rendert zuverlaessig in jedem Client
// (inkl. Strato-Webmail). Gibt true/false zurueck; wirft nie (Buchung laeuft trotzdem).
async function sendMail(to: string, subject: string, html: string, replyTo?: string): Promise<boolean> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return false; // SMTP noch nicht konfiguriert
  subject = subject.replace(/[\r\n]+/g, " ").slice(0, 200); // Header-Injection im Betreff verhindern
  const rcpt = cleanAddr(to);
  const enc = new TextEncoder(), dec = new TextDecoder();
  let conn: Deno.TlsConn | null = null;
  const timer = setTimeout(() => { try { conn?.close(); } catch { /* */ } }, 20000); // Hard-Timeout gegen Haenger
  async function reply(): Promise<number> {
    let data = "";
    const buf = new Uint8Array(2048);
    while (true) {
      const n = await conn!.read(buf);
      if (n === null) break;
      data += dec.decode(buf.subarray(0, n));
      const lines = data.split("\n").map((l) => l.replace(/\r$/, "")).filter(Boolean);
      const last = lines[lines.length - 1];
      if (last && /^\d{3} /.test(last)) return parseInt(last.slice(0, 3), 10); // Abschlusszeile erreicht
    }
    return 0;
  }
  const line = (s: string) => conn!.write(enc.encode(s + "\r\n"));
  try {
    conn = await Deno.connectTls({ hostname: SMTP_HOST, port: SMTP_PORT });
    if (await reply() !== 220) throw 0;
    await line("EHLO andreasdevries.de"); if (await reply() !== 250) throw 0;
    await line("AUTH LOGIN"); if (await reply() !== 334) throw 0;
    await line(b64(enc.encode(SMTP_USER))); if (await reply() !== 334) throw 0;
    await line(b64(enc.encode(SMTP_PASS))); if (await reply() !== 235) throw 0;
    await line(`MAIL FROM:<${MAIL_FROM}>`); if (await reply() !== 250) throw 0;
    await line(`RCPT TO:<${rcpt}>`); if (await reply() !== 250) throw 0;
    await line("DATA"); if (await reply() !== 354) throw 0;
    const bodyB64 = b64(enc.encode(html)).replace(/.{76}/g, "$&\r\n");   // Zeilen <= 76 Zeichen
    const subjEnc = "=?UTF-8?B?" + b64(enc.encode(subject)) + "?=";       // Betreff RFC-2047-kodiert
    let msg =
      `From: ${MAIL_FROM_NAME} <${MAIL_FROM}>\r\n` +
      `To: <${rcpt}>\r\n` +
      `Reply-To: <${cleanAddr(replyTo || MAIL_FROM)}>\r\n` +
      `Subject: ${subjEnc}\r\n` +
      `Date: ${new Date().toUTCString()}\r\n` +
      `MIME-Version: 1.0\r\n` +
      `Content-Type: text/html; charset="utf-8"\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      bodyB64;
    msg = msg.replace(/\r\n\./g, "\r\n..");                               // Dot-Stuffing (RFC 5321)
    await conn.write(enc.encode(msg + "\r\n.\r\n"));
    if (await reply() !== 250) throw 0;
    await line("QUIT");
    conn.close();
    return true;
  } catch (_e) {
    try { conn?.close(); } catch { /* ignore */ }
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function mailOwner(b: Record<string, string>) {
  if (!SMTP_HOST) return false;
  // Links fuehren auf eine Bestaetigungs-Zwischenseite; die eigentliche Aktion loest
  // erst ein bewusster Klick dort per POST aus (kein Auto-Confirm durch Mail-Scanner/Prefetch).
  const confirm = `${SITE_URL}/termin-bestaetigen.html?token=${b.token}&action=confirm`;
  const decline = `${SITE_URL}/termin-bestaetigen.html?token=${b.token}&action=decline`;
  const details = mailCard(
    mailRow("Leistung", esc(b.service))
    + mailRow("Datum", esc(b.appt_date_de))
    + mailRow("Uhrzeit", esc(b.appt_time) + " Uhr")
    + mailRow("Name", esc(b.name))
    + mailRow("Telefon", esc(b.phone))
    + mailRow("E-Mail", esc(b.email)),
  );
  const msgBlock = b.message
    ? `<tr><td style="padding:14px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6ede1;border-radius:12px;"><tr><td style="padding:14px 18px;font-family:${M_SANS};font-size:14px;line-height:1.55;color:#4a423c;"><strong style="color:${M_INK};">Nachricht</strong><br>${esc(b.message).replace(/\n/g, "<br>")}</td></tr></table></td></tr>`
    : "";
  const inner = `<tr><td style="padding:2px 32px 0;"><h1 style="margin:0;font-family:${M_SERIF};font-weight:normal;font-size:23px;line-height:1.3;color:${M_INK};">Ein Termin wartet auf Ihre Bestätigung</h1></td></tr>`
    + `<tr><td style="padding:18px 32px 0;">${details}</td></tr>`
    + msgBlock
    + `<tr><td style="padding:24px 32px 4px;">`
    + `<a href="${confirm}" style="display:block;width:210px;margin:0 auto;box-sizing:border-box;text-align:center;white-space:nowrap;background:${M_RED};color:#ffffff;text-decoration:none;font-family:${M_SANS};font-weight:700;font-size:15px;padding:14px 0;border-radius:999px;">Bestätigen</a>`
    + `<a href="${decline}" style="display:block;width:210px;margin:12px auto 0;box-sizing:border-box;text-align:center;white-space:nowrap;background:#ffffff;color:${M_INK};text-decoration:none;font-family:${M_SANS};font-weight:700;font-size:15px;padding:13px 0;border:1px solid rgba(28,23,20,.2);border-radius:999px;">Ablehnen</a>`
    + `</td></tr>`
    + `<tr><td style="padding:14px 32px 8px;" align="center"><p style="margin:0;font-family:${M_SANS};font-size:12px;color:#9a8f84;">Erst nach dem Bestätigen wird der Zeit-Slot auf der Website gesperrt.</p></td></tr>`;
  const body = mailDoc(`Neue Terminanfrage von ${b.name} – ${b.appt_date_de}, ${b.appt_time} Uhr`, "Neue Terminanfrage", M_RED, inner);
  return await sendMail(OWNER_EMAIL, `Neue Terminanfrage: ${b.service} am ${b.appt_date_de} ${b.appt_time}`, body);
}

// Bestätigungs-Mail an den Kunden (nach „Bestätigen"). Versand nur, wenn SMTP
// konfiguriert ist; schlägt der Versand fehl, läuft die Bestätigung trotzdem durch.
async function mailCustomer(b: Record<string, string>) {
  if (!SMTP_HOST) return false;
  const details = mailCard(
    mailRow("Leistung", esc(b.service))
    + mailRow("Datum", esc(b.appt_date_de))
    + mailRow("Uhrzeit", esc(b.appt_time) + " Uhr"),
  );
  const inner = `<tr><td style="padding:6px 32px 0;"><div style="width:50px;height:50px;border-radius:50%;background:#e7f4e3;color:${M_GREEN};font-size:26px;line-height:50px;text-align:center;">&#10003;</div></td></tr>`
    + `<tr><td style="padding:16px 32px 0;"><h1 style="margin:0 0 10px;font-family:${M_SERIF};font-weight:normal;font-size:24px;line-height:1.3;color:${M_INK};">Ihr Termin steht fest</h1>`
    + `<p style="margin:0;font-family:${M_SANS};font-size:15px;line-height:1.6;color:#4a423c;">Guten Tag ${esc(b.name)},<br>vielen Dank für Ihre Anfrage – wir freuen uns, Ihren Wunschtermin zu bestätigen.</p></td></tr>`
    + `<tr><td style="padding:18px 32px 0;">${details}</td></tr>`
    + `<tr><td style="padding:20px 32px 0;" align="center"><a href="${FN_BASE}/ics?id=${b.id}" style="display:inline-block;white-space:nowrap;background:${M_RED};color:#ffffff;text-decoration:none;font-family:${M_SANS};font-weight:700;font-size:14px;padding:12px 28px;border-radius:999px;">&#128197;&nbsp; Zum Kalender hinzufügen</a></td></tr>`
    + `<tr><td style="padding:18px 32px 0;"><p style="margin:0;font-family:${M_SANS};font-size:14px;line-height:1.65;color:#4a423c;">Müssen Sie den Termin verschieben oder absagen? Melden Sie sich gern unter <a href="tel:051531552" style="color:${M_RED};text-decoration:none;font-weight:700;">05153 1552</a> oder <a href="mailto:${esc(REPLY_TO)}" style="color:${M_RED};text-decoration:none;font-weight:700;">${esc(REPLY_TO)}</a>.</p></td></tr>`
    + `<tr><td style="padding:18px 32px 4px;"><p style="margin:0;font-family:${M_SANS};font-size:15px;line-height:1.6;color:#4a423c;">Herzliche Grüße<br><strong style="color:${M_INK};">Ihr de Vries Team</strong></p></td></tr>`;
  const body = mailDoc(`Ihr Termin bei de Vries ist bestätigt – ${b.appt_date_de}, ${b.appt_time} Uhr`, "Termin bestätigt", M_GREEN, inner);
  return await sendMail(b.email, `Ihr Termin bei de Vries ist bestätigt – ${b.appt_date_de}, ${b.appt_time} Uhr`, body, REPLY_TO);
}

// Kontaktanfrage vom Website-Formular direkt an den Inhaber. Reply-To = Absender,
// damit der Inhaber einfach auf die Mail antworten kann. Kein Speichern (keine PII in der DB).
async function mailContact(c: { name: string; email: string; message: string }): Promise<boolean> {
  if (!SMTP_HOST) return false;
  const details = mailCard(
    mailRow("Name", esc(c.name))
    + mailRow("E-Mail", `<a href="mailto:${esc(c.email)}" style="color:${M_RED};text-decoration:none;font-weight:700;">${esc(c.email)}</a>`),
  );
  const msgBlock = `<tr><td style="padding:16px 32px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6ede1;border-radius:12px;"><tr><td style="padding:16px 18px;font-family:${M_SANS};font-size:15px;line-height:1.6;color:#4a423c;"><strong style="color:${M_INK};">Nachricht</strong><br>${esc(c.message).replace(/\n/g, "<br>")}</td></tr></table></td></tr>`;
  const inner = `<tr><td style="padding:2px 32px 0;"><h1 style="margin:0;font-family:${M_SERIF};font-weight:normal;font-size:23px;line-height:1.3;color:${M_INK};">Neue Nachricht über das Kontaktformular</h1></td></tr>`
    + `<tr><td style="padding:18px 32px 0;">${details}</td></tr>`
    + msgBlock
    + `<tr><td style="padding:18px 32px 4px;" align="center"><p style="margin:0;font-family:${M_SANS};font-size:12px;line-height:1.6;color:#9a8f84;">Antworten Sie einfach auf diese E-Mail – Ihre Antwort geht direkt an ${esc(c.name)}.</p></td></tr>`;
  const body = mailDoc(`Neue Kontaktanfrage von ${c.name}`, "Kontaktanfrage", M_RED, inner);
  return await sendMail(OWNER_EMAIL, `Kontaktanfrage über die Website – ${c.name}`, body, c.email);
}

// Kontaktformular: einfache Flut-Bremse pro Isolate (ergänzt die CORS-Sperre auf die eigene Domain).
// Max. 8 Nachrichten je 10 Minuten – großzügig für echte Anfragen, kappt aber Spam-Fluten.
const _contactHits: number[] = [];
function contactRateOk(): boolean {
  const now = Date.now();
  while (_contactHits.length && _contactHits[0] < now - 10 * 60 * 1000) _contactHits.shift();
  if (_contactHits.length >= 8) return false;
  _contactHits.push(now);
  return true;
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

  // ---- Kontaktformular: Nachricht direkt per Mail an den Inhaber ----
  if (path === "/contact" && req.method === "POST") {
    let b: Record<string, string>;
    try { b = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
    const name = (b.name || "").trim();
    const email = (b.email || "").trim();
    const message = (b.message || "").trim();

    const fields: string[] = [];
    if (!name || name.length > 120) fields.push("name");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 160) fields.push("email");
    if (!message || message.length > 4000) fields.push("message");
    if (fields.length) return json({ error: "validation", fields }, 422);

    if (!contactRateOk()) return json({ error: "rate_limited" }, 429);

    const mailed = await mailContact({ name, email, message });
    if (!mailed) return json({ error: "mail_failed" }, 502); // Frontend zeigt dann Telefon/Direkt-Mail als Ausweichweg
    return json({ ok: true });
  }

  // ---- Status einer Anfrage (read-only, ohne PII) fuer die Bestaetigungsseite ----
  // Damit die Seite weiss, ob bereits bestaetigt/abgelehnt wurde, und dann keinen Button mehr zeigt.
  if (path === "/status" && req.method === "GET") {
    const token = url.searchParams.get("token") || "";
    if (!/^[0-9a-f-]{36}$/i.test(token)) return json({ status: "invalid" });
    const { data: bk } = await admin.from("devries_bookings").select("status").eq("token", token).single();
    return json({ status: bk ? bk.status : "notfound" });
  }

  // ---- Kalender-Datei (.ics) fuer einen BESTAETIGTEN Termin (per unratbarer id) ----
  if (path === "/ics" && req.method === "GET") {
    const id = url.searchParams.get("id") || "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("not_found", { status: 404, headers: CORS });
    const { data: bk } = await admin.from("devries_bookings").select("*").eq("id", id).eq("status", "confirmed").single();
    if (!bk) return new Response("not_found", { status: 404, headers: CORS });
    return new Response(icsFor(bk), {
      status: 200,
      // inline (statt attachment) -> iOS/Safari zeigt die "Zum Kalender hinzufuegen"-Vorschau direkt,
      // statt die Datei nur in "Dateien" abzulegen.
      headers: { ...CORS, "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH", "Content-Disposition": 'inline; filename="termin-de-vries.ics"' },
    });
  }

  // ---- Bestätigen / Ablehnen (per geheimem Token) ----
  // GET aendert NICHTS: Mail-Prefetch/Sicherheits-Scanner rufen Links automatisch per GET auf.
  // Deshalb leitet GET nur auf die Bestaetigungsseite; die Aktion laeuft ausschliesslich per POST.
  if (path === "/confirm" && req.method === "GET") {
    const token = url.searchParams.get("token") || "";
    const action = url.searchParams.get("action") || "";
    if (!/^[0-9a-f-]{36}$/i.test(token) || (action !== "confirm" && action !== "decline")) return redirect("invalid");
    return new Response(null, { status: 302, headers: { ...CORS, "Location": `${SITE_URL}/termin-bestaetigen.html?token=${token}&action=${action}` } });
  }

  // POST fuehrt die eigentliche Zustandsaenderung aus (nur nach bewusstem Klick auf der Zwischenseite).
  if (path === "/confirm" && req.method === "POST") {
    let token = "", action = "";
    try {
      const ct = req.headers.get("content-type") || "";
      if (ct.includes("application/json")) { const j = await req.json(); token = String(j.token || ""); action = String(j.action || ""); }
      else { const fd = await req.formData(); token = String(fd.get("token") || ""); action = String(fd.get("action") || ""); }
    } catch { return redirect("invalid"); }
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
      // mit id -> die Bestaetigt-Seite kann den Kalender-Eintrag (.ics) anbieten
      return new Response(null, { status: 302, headers: { ...CORS, "Location": `${SITE_URL}/termin-status.html?s=confirmed&id=${bk.id}` } });
    } else {
      await admin.from("devries_bookings").update({ status: "declined" }).eq("id", bk.id);
      return redirect("declined");
    }
  }

  // ---- Einwilligungs-Protokoll (DSGVO-Nachweis, anonym: keine PII, keine IP) ----
  if (path === "/consent" && req.method === "POST") {
    let b: Record<string, unknown>;
    try { b = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
    const clientId = String(b.client_id || "");
    if (!/^[0-9a-f-]{36}$/i.test(clientId)) return json({ error: "bad_client_id" }, 400);
    const version = Number(b.version);
    if (!Number.isInteger(version) || version < 1 || version > 999) return json({ error: "bad_version" }, 400);
    const action = String(b.action || "").slice(0, 20);
    if (!/^[a-z_]+$/.test(action)) return json({ error: "bad_action" }, 400);
    // choices: nur bekannte Schluessel, nur Boolean-Werte (eigene Properties)
    const raw = (b.choices && typeof b.choices === "object") ? b.choices as Record<string, unknown> : {};
    const choices: Record<string, boolean> = {};
    for (const k of ["maps"]) if (Object.prototype.hasOwnProperty.call(raw, k)) choices[k] = !!raw[k];
    // Flood-Schutz (fail-open): global bzw. pro client_id deckeln
    try {
      const now = Date.now();
      const [glob, perClient] = await Promise.all([
        admin.from("devries_consents").select("*", { count: "exact", head: true }).gte("created_at", new Date(now - 10 * 60 * 1000).toISOString()),
        admin.from("devries_consents").select("*", { count: "exact", head: true }).eq("client_id", clientId).gte("created_at", new Date(now - 60 * 60 * 1000).toISOString()),
      ]);
      if ((glob.count || 0) >= 300 || (perClient.count || 0) >= 30) return json({ error: "rate_limited" }, 429);
    } catch { /* fail-open */ }
    const { error } = await admin.from("devries_consents").insert({ client_id: clientId, version, action, choices });
    if (error) return json({ error: "db_error" }, 500);
    return json({ ok: true });
  }

  return json({ error: "not_found" }, 404);
});
