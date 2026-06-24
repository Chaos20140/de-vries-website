/* ============================================================
   de Vries — Terminbuchung: Backend-Konfiguration
   ------------------------------------------------------------
   Supabase-Backend AKTIV. Solange hier echte Werte stehen, nutzt die
   Terminseite das Backend (Anfrage speichern + Inhaber benachrichtigen +
   bestätigte Slots sperren). Bei "DEIN-…"-Platzhaltern → mailto-Fallback.

   Hinweis: anonKey ist ein öffentlicher Client-Key (by design sichtbar);
   die Daten schützt Row Level Security + die Edge Function (Service-Role).
   ============================================================ */
window.DV_BOOKING = {
  url: "https://vxwjgxdlnwhatnbhjabw.supabase.co/functions/v1/devries-booking",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ4d2pneGRsbndoYXRuYmhqYWJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzNDI4MjAsImV4cCI6MjA5NzkxODgyMH0.ab3MxBbEFuswqh-nM3XxOIIBAzLuZoLtR1rEI79aNhw"
};
