/* ============================================================
   de Vries — Terminbuchung: Backend-Konfiguration
   ------------------------------------------------------------
   Solange hier "DEIN-..."-Platzhalter stehen, nutzt die Terminseite
   automatisch den mailto-Fallback (öffnet das E-Mail-Programm).

   Nach dem Supabase-Setup (siehe SETUP-BUCHUNG.md) hier eintragen:
   - url:     deine Function-URL, endet auf /devries-booking
   - anonKey: dein Supabase "anon public" Key (ist öffentlich, das ist ok)
   Danach: echtes Buchungssystem aktiv (Bestätigen-Button + Slots sperren).
   ============================================================ */
window.DV_BOOKING = {
  url: "https://DEIN-PROJEKT.supabase.co/functions/v1/devries-booking",
  anonKey: "DEIN-ANON-PUBLIC-KEY"
};
