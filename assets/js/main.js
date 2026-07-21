/* ============================================================
   de Vries — motion engine (vanilla, single IIFE, no build step)
   Lenis smooth-scroll (CDN, guarded) + IntersectionObserver reveals +
   rAF scroll effects (parallax, timeline, progress) + counters + magnetic + form.
   ============================================================ */
(function () {
  "use strict";
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isTouch = window.matchMedia("(hover: none)").matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------- Lenis smooth scroll ---------- */
  var lenis = null;
  function initLenis() {
    if (reduce || typeof window.Lenis === "undefined") return;
    lenis = new window.Lenis({ duration: 1.1, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); }, smoothWheel: true, smoothTouch: false });
    function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
    requestAnimationFrame(raf);
    lenis.on("scroll", onScroll);
  }

  /* ---------- nav ---------- */
  var nav = $(".nav");
  var burger = $("#navBurger");
  var mobileNav = $("#mobileNav");
  function setMobile(open) {
    if (!mobileNav) return;
    mobileNav.classList.toggle("is-open", open);
    document.documentElement.classList.toggle("lenis-stopped", open);
    document.body.style.overflow = open ? "hidden" : "";
    if (lenis) { open ? lenis.stop() : lenis.start(); }
    if (open) {
      var cl = document.getElementById("mobileClose"); if (cl) cl.focus();
    } else {
      // aufgeklappte Untermenues beim Schliessen zuruecksetzen (sonst beim naechsten Oeffnen noch offen)
      $$(".mnav__sub.is-open", mobileNav).forEach(function (s) { s.classList.remove("is-open"); });
      $$(".mnav__toggle", mobileNav).forEach(function (t) { t.setAttribute("aria-expanded", "false"); });
      if (burger) burger.focus();
    }
  }
  if (burger) burger.addEventListener("click", function () { setMobile(true); });
  if (mobileNav) {
    $("#mobileClose", mobileNav) && $("#mobileClose", mobileNav).addEventListener("click", function () { setMobile(false); });
    // Klick-Delegation: gilt auch fuer spaeter injizierte Links (Menue/erstellte Seiten).
    // Normale Links schliessen das Menue; der aufklappbare Eintrag klappt nur auf/zu.
    mobileNav.addEventListener("click", function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || !mobileNav.contains(a)) return;
      if (a.classList.contains("mnav__toggle")) {
        e.preventDefault();
        var sub = document.getElementById(a.getAttribute("aria-controls"));
        var open = a.getAttribute("aria-expanded") === "true";
        a.setAttribute("aria-expanded", open ? "false" : "true");
        if (sub) sub.classList.toggle("is-open", !open);
      } else {
        setMobile(false);
      }
    });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && mobileNav && mobileNav.classList.contains("is-open")) setMobile(false); });

  /* ---------- active nav link ---------- */
  (function () {
    var here = location.pathname.split("/").pop() || "index.html";
    $$(".nav__links a, #mobileNav a[href]").forEach(function (a) {
      var href = (a.getAttribute("href") || "").split("/").pop();
      if (href && href === here) a.setAttribute("aria-current", "page");
    });
  })();

  /* ---------- split words for .reveal-words ---------- */
  if (!reduce) {
    $$(".reveal-words").forEach(function (el) {
      var words = el.textContent.trim().split(/\s+/);
      el.innerHTML = words.map(function (w) { return '<span class="word"><span>' + w + "</span></span>"; }).join(" ");
    });
  }

  /* ---------- IntersectionObserver reveals ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  $$("[data-reveal],[data-stagger],.reveal-words,.dv-draw,.tnode,.hero,.phero").forEach(function (el) { io.observe(el); });

  /* set dash length for DV draw */
  $$(".dv-draw path").forEach(function (p) {
    try { var len = p.getTotalLength(); p.style.setProperty("--len", len); } catch (e) {}
  });

  /* ---------- counters (Zielzahl steht editierbar im Element-Text) ---------- */
  function animateCount(el) {
    if (document.documentElement.classList.contains("dv-editing")) return; // im Editor echten Wert zeigen, nicht animieren
    var raw = el.getAttribute("data-count");
    var target = raw != null ? parseFloat(raw) : parseInt((el.textContent || "").replace(/[^\d]/g, ""), 10);
    if (!isFinite(target) || !target) return;
    var dur = 1600, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString("de-DE");
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target.toLocaleString("de-DE");
    }
    if (reduce) { el.textContent = target.toLocaleString("de-DE"); }
    else requestAnimationFrame(step);
  }
  var countIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { animateCount(en.target); countIO.unobserve(en.target); } });
  }, { threshold: 0.6 });
  $$("[data-countup],[data-count]").forEach(function (el) { countIO.observe(el); });

  /* ---------- magnetic buttons ---------- */
  if (!isTouch && !reduce) {
    $$("[data-magnetic]").forEach(function (el) {
      var strength = parseFloat(el.getAttribute("data-magnetic")) || 0.3;
      el.addEventListener("mousemove", function (e) {
        if (document.documentElement.classList.contains("dv-editing")) { el.style.transform = ""; return; } // im Editor: Button ruhig halten
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * strength;
        var y = (e.clientY - r.top - r.height / 2) * strength;
        el.style.transform = "translate(" + x + "px," + y + "px)";
      });
      el.addEventListener("mouseleave", function () { el.style.transform = ""; });
    });
  }

  /* ---------- service card glow follows cursor ---------- */
  if (!isTouch) {
    $$(".scard").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty("--mx", (e.clientX - r.left) + "px");
        card.style.setProperty("--my", (e.clientY - r.top) + "px");
      });
    });
  }

  /* ---------- scroll-driven effects (rAF batched) ---------- */
  var progBar = $("#scrollProg");
  var parallaxEls = $$("[data-parallax]");
  var timeline = $(".timeline");
  var tnodes = $$(".tnode");
  var route = $("#route");
  var routeUpdate = null;
  var ticking = false;
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(applyScroll); } }
  function applyScroll() {
    ticking = false;
    var st = window.pageYOffset || document.documentElement.scrollTop;
    var docH = document.documentElement.scrollHeight - window.innerHeight;
    /* progress bar */
    if (progBar) progBar.style.transform = "scaleX(" + (docH > 0 ? st / docH : 0) + ")";
    /* nav state */
    if (nav) nav.classList.toggle("is-scrolled", st > 24);
    /* parallax */
    if (!reduce) {
      for (var i = 0; i < parallaxEls.length; i++) {
        var el = parallaxEls[i];
        var speed = parseFloat(el.getAttribute("data-parallax")) || 0.15;
        var r = el.getBoundingClientRect();
        var mid = r.top + r.height / 2 - window.innerHeight / 2;
        el.style.transform = "translate3d(0," + (-mid * speed) + "px,0)";
      }
    }
    /* timeline progress + node activation */
    if (timeline) {
      var tr = timeline.getBoundingClientRect();
      var vh = window.innerHeight;
      var prog = (vh * 0.6 - tr.top) / tr.height;
      prog = Math.max(0, Math.min(1, prog));
      timeline.style.setProperty("--tl-progress", (prog * 100) + "%");
      tnodes.forEach(function (n) {
        var nr = n.getBoundingClientRect();
        n.classList.toggle("is-in", nr.top < vh * 0.7);
      });
    }
    /* Einzugsgebiet-Serpentine: Auto folgt der kurvigen Strecke */
    if (routeUpdate) {
      var rrt = route.getBoundingClientRect();
      var rvh = window.innerHeight;
      routeUpdate((rvh * 0.62 - rrt.top) / rrt.height);
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

  /* ---------- Einzugsgebiet: Serpentinen-Route mit fahrendem Auto ---------- */
  function initRoute() {
    if (!route) return;
    var road = $("#roadPath", route), done = $("#roadDone", route);
    var carG = $("#routeCar", route), layer = $("#routeStopsG", route);
    var mapClip = $("#mapClipRect", route);
    var roadCase = $("#roadCase", route), svg = $(".route__svg", route);
    if (!road || !carG || !layer) return;
    var VBW = 760, VBH = 1480;
    var places = (route.getAttribute("data-places") || "").split("|").filter(Boolean);
    var len = 0;
    try { len = road.getTotalLength(); } catch (e) { return; }
    if (!len) return;
    // Perf: Strecke EINMAL abtasten -> pro Scroll-Frame nur Array-Lookup statt 3x getPointAtLength (mobil flüssig)
    var SEG = 300, pts = new Array(SEG + 1);
    for (var sp = 0; sp <= SEG; sp++) pts[sp] = road.getPointAtLength(sp / SEG * len);
    var mqSmall = window.matchMedia("(max-width: 640px)");
    var lastP = 0;
    // Detail-Größe deckeln: die Karte darf mit dem Bildschirm mitwachsen, aber Straßendicke + Auto
    // skalieren nur bis Faktor FCAP mit und bleiben darüber KONSTANT (sonst auf großen Screens zu groß).
    // Einmalig/bei resize berechnet (kein Layout-Read pro Frame).
    var FCAP = 1.1, detailScale = 1;
    function updateDetail() {
      var w = svg ? svg.getBoundingClientRect().width : VBW;
      detailScale = Math.min(1, FCAP / (w / VBW));
      if (roadCase) roadCase.style.strokeWidth = 13 * detailScale;
      if (road) road.style.strokeWidth = 3 * detailScale;
      if (done) done.style.strokeWidth = 8 * detailScale;
      if (routeUpdate) routeUpdate(lastP);
    }
    var stops = [];
    places.forEach(function (name, i) {
      var frac = places.length > 1 ? 0.03 + (i / (places.length - 1)) * 0.94 : 0.5;
      var pt = road.getPointAtLength(frac * len);
      var el = document.createElement("div");
      el.className = "route__stop " + (pt.x < VBW / 2 ? "route__stop--left" : "route__stop--right");
      el.style.left = (pt.x / VBW * 100) + "%";
      el.style.top = (pt.y / VBH * 100) + "%";
      var dot = document.createElement("span"); dot.className = "route__stop-dot";
      var lab = document.createElement("span"); lab.className = "route__stop-label"; lab.textContent = name;
      el.appendChild(dot); el.appendChild(lab);
      layer.appendChild(el);
      stops.push({ frac: frac, el: el });
    });
    if (done) { done.style.strokeDasharray = len; done.style.strokeDashoffset = len; }
    var lastDir = 1;
    routeUpdate = function (p) {
      p = Math.max(0, Math.min(1, p));
      lastP = p;
      // Mobil: Strecke + Karte fest gezeichnet (idempotent -> nur beim ersten Mal geschrieben, kein Per-Frame-Repaint)
      if (mqSmall.matches) {
        if (done && done.style.strokeDashoffset !== "0") done.style.strokeDashoffset = 0;
        if (mapClip && +mapClip.getAttribute("height") !== VBH) mapClip.setAttribute("height", VBH);
      } else {
        if (done) done.style.strokeDashoffset = len * (1 - p);
        if (mapClip) mapClip.setAttribute("height", p * VBH);
      }
      var fi = p * SEG, i0 = fi | 0; if (i0 > SEG - 1) i0 = SEG - 1;
      var pt = pts[i0], pn = pts[i0 + 1], t = fi - i0;
      var cx = pt.x + (pn.x - pt.x) * t, cy = pt.y + (pn.y - pt.y) * t;
      var dx = pn.x - pt.x;
      if (Math.abs(dx) > 0.4) lastDir = dx > 0 ? 1 : -1;
      carG.setAttribute("transform", "translate(" + cx + " " + (cy - 9 * detailScale) + ") scale(" + (lastDir * detailScale) + " " + detailScale + ")");
      for (var i = 0; i < stops.length; i++) {
        stops[i].el.classList.toggle("is-active", stops[i].frac <= p + 0.004);
      }
    };
    if (reduce) {
      if (done) done.style.strokeDashoffset = 0;
      if (mapClip) mapClip.setAttribute("height", VBH);
      stops.forEach(function (s) { s.el.classList.add("is-active"); });
      routeUpdate = null;
    } else {
      routeUpdate(0);
    }
    updateDetail();
    // bei resize erst NACH dem Reflow messen (sonst stale Breite) -> rAF
    window.addEventListener("resize", function () { requestAnimationFrame(updateDetail); });
  }

  /* ---------- Einwilligung / Cookie-Einstellungen (echte, speichernde Auswahl) ---------- */
  (function () {
    var CKEY = "dv-consent", VER = 1;
    // Zustand: { v, maps:bool, ts }. null = noch keine Entscheidung getroffen.
    function read() {
      try {
        var raw = localStorage.getItem(CKEY);
        if (raw) { var o = JSON.parse(raw); if (o && o.v === VER) return o; }
        // sanfte Migration von den alten Einzel-Flags
        var old = localStorage.getItem("dv-cookie-ok");
        var oldMap = localStorage.getItem("dv-map-consent");
        if (old || oldMap) return { v: VER, maps: oldMap === "1" };
      } catch (e) {}
      return null;
    }
    function write(maps) { try { localStorage.setItem(CKEY, JSON.stringify({ v: VER, maps: !!maps, ts: Date.now() })); } catch (e) {} }
    // Anonymes Einwilligungs-Protokoll (DSGVO-Nachweis). Best effort: blockiert die UI nie,
    // speichert keine PII/IP – nur eine zufaellige, browserseitige ID + die Auswahl.
    function clientId() {
      var k = "dv-consent-id", id = null;
      try { id = localStorage.getItem(k); } catch (e) {}
      if (!id && window.crypto && crypto.randomUUID) { id = crypto.randomUUID(); try { localStorage.setItem(k, id); } catch (e) {} }
      return id;
    }
    function logConsent(action, maps) {
      var id = clientId(); if (!id) return;
      try {
        fetch("https://vxwjgxdlnwhatnbhjabw.supabase.co/functions/v1/devries-booking/consent", {
          method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
          body: JSON.stringify({ client_id: id, version: VER, action: action, choices: { maps: !!maps } })
        }).catch(function () {});
      } catch (e) {}
    }
    function commit(maps, action) { write(maps); logConsent(action, maps); }
    function decided() { return read() !== null; }
    function mapsAllowed() { var s = read(); return !!(s && s.maps); }

    // Google-Maps-Platzhalter gemaess Zustand durch das echte iframe ersetzen
    function applyMaps() {
      if (!mapsAllowed()) return;
      $$(".map-consent").forEach(function (box) {
        var src = box.getAttribute("data-map-embed") || "";
        if (!/^https:\/\/(maps|www)\.google\.com\//.test(src)) return; // nur echte Google-Maps-Embeds
        var f = document.createElement("iframe");
        f.src = src;
        f.title = box.getAttribute("data-map-title") || "Standort auf Google Maps";
        f.loading = "lazy";
        f.setAttribute("referrerpolicy", "no-referrer");
        f.setAttribute("allowfullscreen", "");
        if (box.parentNode) box.parentNode.replaceChild(f, box);
      });
    }

    var banner = document.getElementById("cookie");
    function hideBanner() { if (banner) banner.classList.remove("is-in"); }

    function openDialog() {
      var cur = read() || { maps: false };
      var ex = document.getElementById("dvConsent"); if (ex) ex.remove();
      var ov = document.createElement("div");
      ov.id = "dvConsent"; ov.className = "dvcov";
      ov.innerHTML =
        '<div class="dvc" role="dialog" aria-modal="true" aria-labelledby="dvcT">'
        + '<h3 id="dvcT">Cookie-Einstellungen</h3>'
        + '<p class="dvc__lead">Diese Website nutzt keine Tracking-Cookies. Gespeichert wird nur technisch Notwendiges. Externe Karten (Google Maps) laden wir ausschliesslich mit Ihrer Zustimmung.</p>'
        + '<label class="dvc__opt"><span class="dvc__t"><strong>Notwendig</strong><span class="dvc__d">Merkt sich Ihre Auswahl und Grundeinstellungen. Immer aktiv.</span></span><input type="checkbox" checked disabled></label>'
        + '<label class="dvc__opt"><span class="dvc__t"><strong>Externe Karten (Google Maps)</strong><span class="dvc__d">Laedt die Anfahrtskarte von Google. Dabei wird Ihre IP-Adresse an Google uebertragen.</span></span><input type="checkbox" id="dvcMaps"' + (cur.maps ? " checked" : "") + '></label>'
        + '<div class="dvc__row"><button type="button" class="btn btn--ghost" data-dvc="nec">Nur notwendige</button><button type="button" class="btn" data-dvc="save">Auswahl speichern</button></div>'
        + '</div>';
      document.body.appendChild(ov);
      ov.addEventListener("click", function (e) { if (e.target === ov) ov.remove(); });
      ov.querySelector('[data-dvc="save"]').addEventListener("click", function () {
        var before = mapsAllowed(), now = ov.querySelector("#dvcMaps").checked;
        commit(now, "custom"); ov.remove(); hideBanner();
        if (before && !now) location.reload(); else applyMaps(); // Widerruf -> Karte per Reload entfernen
      });
      ov.querySelector('[data-dvc="nec"]').addEventListener("click", function () {
        var before = mapsAllowed();
        commit(false, "necessary"); ov.remove(); hideBanner();
        if (before) location.reload(); else applyMaps();
      });
    }
    window.dvOpenConsent = openDialog;

    // Banner-Buttons: data-consent="all" | "necessary" | "settings"
    if (banner) {
      $$("[data-consent]", banner).forEach(function (b) {
        b.addEventListener("click", function () {
          var v = b.getAttribute("data-consent");
          if (v === "settings") { openDialog(); return; }
          commit(v === "all", v === "all" ? "all" : "necessary"); hideBanner(); applyMaps();
        });
      });
    }

    // Footer-Link "Cookie-Einstellungen" (jederzeit aenderbar = DSGVO-Widerruf)
    var ds = document.querySelector('.footer a[href="datenschutz.html"]');
    if (ds && ds.parentNode) {
      var cs = document.createElement("button");
      cs.type = "button"; cs.className = "footer__cookiebtn"; cs.textContent = "Cookie-Einstellungen";
      cs.addEventListener("click", openDialog);
      ds.parentNode.insertBefore(cs, ds.nextSibling);
    }

    // "Karte laden"-Button auf dem Platzhalter erteilt die Maps-Zustimmung dauerhaft
    $$(".map-consent__btn").forEach(function (b) {
      b.addEventListener("click", function () { commit(true, "maps"); applyMaps(); });
    });

    applyMaps();                                  // bereits erteilte Zustimmung sofort anwenden
    if (banner && !decided()) setTimeout(function () { banner.classList.add("is-in"); }, 1200);
  })();

  /* ---------- contact form (mailto fallback + validation) ---------- */
  (function () {
    var form = $("#contactForm");
    if (!form) return;
    var status = $("#formStatus");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = form.name.value.trim();
      var email = form.email.value.trim();
      var msg = form.message.value.trim();
      var consent = form.consent ? form.consent.checked : true;
      function fail(t) { status.textContent = t; status.className = "form__status err"; }
      if (!name || !email || !msg) return fail("Bitte füllen Sie alle Pflichtfelder aus.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Bitte geben Sie eine gültige E-Mail-Adresse an.");
      if (!consent) return fail("Bitte stimmen Sie der Datenschutzerklärung zu.");
      var subject = encodeURIComponent("Kontaktanfrage über die Website – " + name);
      var body = encodeURIComponent("Name: " + name + "\nE-Mail: " + email + "\n\nNachricht:\n" + msg);
      window.location.href = "mailto:tolunayusul@gmail.com?subject=" + subject + "&body=" + body;
      status.textContent = "Ihr E-Mail-Programm wird geöffnet. Vielen Dank für Ihre Anfrage!";
      status.className = "form__status ok";
      form.reset();
    });
  })();

  /* ---------- footer year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- booking (termin.html) ---------- */
  (function () {
    var form = $("#bookingForm");
    if (!form) return;
    var MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
    var WD = ["Mo","Di","Mi","Do","Fr","Sa","So"];
    var calTitle = $("#calTitle"), calGrid = $("#calGrid"), calPrev = $("#calPrev"), calNext = $("#calNext");
    var sumService = $("#sumService"), sumDate = $("#sumDate"), sumTime = $("#sumTime");
    var status = $("#bookingStatus");
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var view = new Date(today.getFullYear(), today.getMonth(), 1);
    var selISO = "";
    var cfg = window.DV_BOOKING || {};
    var backendOn = !!(cfg.url && cfg.anonKey && cfg.url.indexOf("DEIN-") < 0 && cfg.anonKey.indexOf("DEIN-") < 0);
    var bookedMap = {}; // { "2026-06-24": ["10:00", ...] } — bestätigte (gesperrte) Slots

    function pad(n) { return (n < 10 ? "0" : "") + n; }
    function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
    function fmt(d) { return WD[(d.getDay() + 6) % 7] + ". " + d.getDate() + ". " + MONTHS[d.getMonth()] + " " + d.getFullYear(); }

    function renderCal() {
      calTitle.textContent = MONTHS[view.getMonth()] + " " + view.getFullYear();
      calPrev.disabled = (view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth());
      calGrid.innerHTML = "";
      WD.forEach(function (w) { var el = document.createElement("div"); el.className = "cal__wd"; el.textContent = w; calGrid.appendChild(el); });
      var first = new Date(view.getFullYear(), view.getMonth(), 1);
      var offset = (first.getDay() + 6) % 7;
      var dim = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      for (var i = 0; i < offset; i++) { var e = document.createElement("div"); e.className = "cal__day is-empty"; calGrid.appendChild(e); }
      for (var d = 1; d <= dim; d++) {
        var date = new Date(view.getFullYear(), view.getMonth(), d);
        var btn = document.createElement("button");
        btn.type = "button"; btn.className = "cal__day"; btn.textContent = d;
        if (date.getDay() === 0 || date.getDay() === 6 || date < today) btn.disabled = true;
        if (iso(date) === iso(today)) btn.classList.add("is-today");
        if (selISO && iso(date) === selISO) btn.classList.add("is-selected");
        (function (date) {
          btn.addEventListener("click", function () {
            selISO = iso(date); form.date.value = fmt(date);
            renderCal(); updateSummary(); refreshSlots();
          });
        })(date);
        calGrid.appendChild(btn);
      }
    }
    calPrev.addEventListener("click", function () { view.setMonth(view.getMonth() - 1); renderCal(); });
    calNext.addEventListener("click", function () { view.setMonth(view.getMonth() + 1); renderCal(); });

    $$(".chip[data-service]").forEach(function (c) {
      c.addEventListener("click", function () {
        $$(".chip[data-service]").forEach(function (x) { x.classList.remove("is-active"); });
        c.classList.add("is-active"); form.service.value = c.getAttribute("data-service"); updateSummary();
      });
    });
    $$(".slot[data-time]").forEach(function (s) {
      s.addEventListener("click", function () {
        if (s.disabled) return;
        $$(".slot[data-time]").forEach(function (x) { x.classList.remove("is-active"); });
        s.classList.add("is-active"); form.time.value = s.getAttribute("data-time"); updateSummary();
      });
    });

    // grey out time slots that are already confirmed OR already in the past (today)
    function refreshSlots() {
      var taken = bookedMap[selISO] || [];
      var now = new Date();
      var isToday = selISO === iso(now);
      var nowMin = now.getHours() * 60 + now.getMinutes();
      $$(".slot[data-time]").forEach(function (s) {
        var t = s.getAttribute("data-time"), p = t.split(":");
        var past = isToday && (parseInt(p[0], 10) * 60 + parseInt(p[1], 10)) <= nowMin;
        var dis = taken.indexOf(t) > -1 || past;
        s.disabled = dis;
        s.classList.toggle("is-taken", dis);
        if (dis && s.classList.contains("is-active")) { s.classList.remove("is-active"); form.time.value = ""; updateSummary(); }
      });
    }

    function setSum(el, val) { if (!el) return; if (val) { el.textContent = val; el.classList.remove("empty"); } else { el.textContent = "Noch nicht gewählt"; el.classList.add("empty"); } }
    function updateSummary() {
      setSum(sumService, form.service.value);
      setSum(sumDate, form.date.value);
      setSum(sumTime, form.time.value ? form.time.value + " Uhr" : "");
    }

    // Senden erst möglich, wenn der Datenschutz-Haken gesetzt ist
    var submitBtn = form.querySelector('button[type="submit"]');
    function syncConsent() { if (submitBtn && form.consent) submitBtn.disabled = !form.consent.checked; }
    if (form.consent) form.consent.addEventListener("change", syncConsent);
    syncConsent();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      function fail(t) { status.textContent = t; status.className = "form__status err"; }
      function ok(t) { status.textContent = t; status.className = "form__status ok"; }
      if (!form.service.value) return fail("Bitte wählen Sie eine Leistung.");
      if (!form.date.value) return fail("Bitte wählen Sie ein Wunschdatum.");
      if (!form.time.value) return fail("Bitte wählen Sie eine Uhrzeit.");
      var name = form.name.value.trim(), tel = form.phone.value.trim(), email = form.email.value.trim();
      if (!name || !tel || !email) return fail("Bitte füllen Sie Name, Telefon und E-Mail aus.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Bitte geben Sie eine gültige E-Mail-Adresse an.");
      if (form.consent && !form.consent.checked) return fail("Bitte stimmen Sie der Datenschutzerklärung zu.");
      var msg = form.message ? form.message.value.trim() : "";

      // --- mit Backend: speichern + Inhaber benachrichtigen ---
      if (backendOn) {
        var btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;
        status.textContent = "Wird gesendet …"; status.className = "form__status";
        fetch(cfg.url + "/booking", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + cfg.anonKey },
          body: JSON.stringify({ service: form.service.value, date: form.date.value, dateISO: selISO, time: form.time.value, name: name, phone: tel, email: email, message: msg })
        }).then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (d) { return { s: r.status, ok: r.ok, d: d }; });
        }).then(function (res) {
          if (btn) btn.disabled = false;
          if (res.ok) {
            ok("Vielen Dank! Ihre Terminanfrage ist eingegangen – wir bestätigen sie schnellstmöglich.");
            $$(".chip[data-service],.slot[data-time]").forEach(function (x) { x.classList.remove("is-active"); });
            form.reset(); form.service.value = ""; form.date.value = ""; form.time.value = ""; selISO = "";
            updateSummary(); renderCal(); syncConsent();
          } else if (res.s === 409) {
            fail("Dieser Zeit-Slot ist leider gerade vergeben. Bitte wählen Sie eine andere Uhrzeit.");
          } else {
            fail("Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut oder rufen Sie uns an: 05153 - 1552.");
          }
        }).catch(function () {
          if (btn) btn.disabled = false;
          fail("Verbindung fehlgeschlagen. Bitte später erneut versuchen oder rufen Sie uns an: 05153 - 1552.");
        });
        return;
      }

      // --- Fallback ohne Backend: mailto ---
      var subject = encodeURIComponent("Terminanfrage: " + form.service.value + " am " + form.date.value);
      var body = encodeURIComponent(
        "Terminanfrage über die Website\n\n" +
        "Leistung: " + form.service.value + "\n" +
        "Wunschdatum: " + form.date.value + "\n" +
        "Uhrzeit: " + form.time.value + " Uhr\n\n" +
        "Name: " + name + "\nTelefon: " + tel + "\nE-Mail: " + email + "\n\n" +
        "Nachricht:\n" + (msg || "-")
      );
      window.location.href = "mailto:tolunayusul@gmail.com?subject=" + subject + "&body=" + body;
      ok("Ihr E-Mail-Programm wird geöffnet. Wir bestätigen Ihren Wunschtermin schnellstmöglich!");
    });

    // belegte (bestätigte) Slots laden und sperren
    if (backendOn) {
      fetch(cfg.url + "/booked-slots", { headers: { "Authorization": "Bearer " + cfg.anonKey } })
        .then(function (r) { return r.ok ? r.json() : { slots: [] }; })
        .then(function (d) { (d.slots || []).forEach(function (s) { (bookedMap[s.date] = bookedMap[s.date] || []).push(s.time); }); refreshSlots(); })
        .catch(function () {});
    }

    renderCal(); updateSummary();
  })();

  /* ---------- erstellte Seiten ins Menü einblenden (alle Besucher) ---------- */
  function injectCreatedPages() {
    fetch("pages.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
      if (!Array.isArray(list) || !list.length) return;
      var ul = document.querySelector(".nav__links");
      var mob = document.querySelector(".mobile-nav__body");
      var footH = document.querySelector('.footer__col h4[data-eds="lbl-foot-informationen"]');
      var foot = footH ? footH.parentNode : null;
      list.forEach(function (p, ix) {
        if (!p || typeof p.file !== "string" || !/^[a-z][a-z0-9-]{1,38}\.html$/.test(p.file)) return;
        var title = (typeof p.title === "string" && p.title.trim()) ? p.title.trim() : p.file;
        if (ul && !ul.querySelector('a[href="' + p.file + '"]')) {
          var li = document.createElement("li");
          var a = document.createElement("a"); a.setAttribute("href", p.file); a.textContent = title;
          li.appendChild(a); ul.appendChild(li);
        }
        if (mob && !mob.querySelector('a.mnav__link[href="' + p.file + '"]')) {
          var ma = document.createElement("a"); ma.className = "mnav__link"; ma.setAttribute("href", p.file); ma.textContent = title;
          ma.style.setProperty("--i", String(10 + ix)); // Stagger-Animation wie die anderen Menüpunkte
          mob.appendChild(ma);
        }
        if (foot && !foot.querySelector('a[href="' + p.file + '"]')) {
          var fa = document.createElement("a"); fa.setAttribute("href", p.file); fa.textContent = title;
          foot.appendChild(fa);
        }
      });
    }).catch(function () {});
  }

  // Eigene Menüpunkte (menu.json) in Haupt- und Mobil-Menü einblenden – für alle Besucher.
  function injectCustomMenu() {
    fetch("menu.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
      if (!Array.isArray(list) || !list.length) return;
      var ul = document.querySelector(".nav__links");
      var mob = document.querySelector(".mobile-nav__body");
      function okHref(h) { return typeof h === "string" && h.trim() && !/^\s*(javascript|data):/i.test(h); }
      list.forEach(function (m, ix) {
        if (!m || typeof m.text !== "string" || !m.text.trim() || !okHref(m.href)) return;
        var text = m.text.trim().slice(0, 40), href = m.href.trim(), ext = /^https?:\/\//i.test(href);
        if (ul && !ul.querySelector('a[href="' + href.replace(/"/g, "") + '"]')) {
          var li = document.createElement("li");
          var a = document.createElement("a"); a.setAttribute("href", href); a.textContent = text;
          if (ext) { a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener"); }
          li.appendChild(a); ul.appendChild(li);
        }
        if (mob && !mob.querySelector('a.mnav__link[href="' + href.replace(/"/g, "") + '"]')) {
          var ma = document.createElement("a"); ma.className = "mnav__link"; ma.setAttribute("href", href); ma.textContent = text;
          if (ext) { ma.setAttribute("target", "_blank"); ma.setAttribute("rel", "noopener"); }
          ma.style.setProperty("--i", String(12 + ix));
          mob.appendChild(ma);
        }
      });
    }).catch(function () {});
  }

  /* ---------- boot ---------- */
  initLenis();
  initRoute();
  applyScroll();
  injectCreatedPages();
  injectCustomMenu();
})();

/* ============================================================
   Inhalts-Editor (Bearbeitungsmodus) – läuft NUR, wenn über /admin
   aktiviert (localStorage-Flag). Für normale Besucher: sofortiger Abbruch.
   Speichern -> gehärtete Supabase-Function -> Commit -> GitHub Pages baut neu.
   ============================================================ */
(function () {
  var FLAG = "dv_edit", PWK = "dv_edit_pw", TSK = "dv_edit_ts";
  try { if (localStorage.getItem(FLAG) !== "1") return; } catch (e) { return; }
  if (Date.now() - (parseInt(localStorage.getItem(TSK), 10) || 0) > 3 * 3600 * 1000) {
    localStorage.removeItem(FLAG); localStorage.removeItem(PWK); localStorage.removeItem(TSK); return;
  }
  var FN = "https://vxwjgxdlnwhatnbhjabw.supabase.co/functions/v1/devries-edit";
  var pw = localStorage.getItem(PWK) || "";
  var file = (location.pathname.split("/").pop() || "index.html"); if (file.indexOf(".html") < 0) file = "index.html";
  var pending = {}; // slot -> base64 (neues Bild)
  var pendingPos = {}; // slot -> "X% Y%" (Bildausschnitt/Position)

  function call(p) {
    p.password = pw;
    return fetch(FN, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, ok: r.ok, d: d }; }); });
  }
  function msg(m) { var e = document.getElementById("dvMsg"); if (e) e.textContent = m; }

  // ---- Bearbeitungs-Komfort: Toasts, Änderungs-Tracking ----
  function toast(text, kind) {
    var t = document.createElement("div"); t.className = "dv-toast" + (kind ? (" " + kind) : "");
    t.textContent = text; document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add("show"); });
    setTimeout(function () { t.classList.remove("show"); setTimeout(function () { if (t.parentNode) t.remove(); }, 320); }, kind === "err" ? 5200 : 3600);
  }
  function unsavedCount() {
    return document.querySelectorAll(".dv-changed").length + Object.keys(pending).length + Object.keys(pendingPos).length + Object.keys(dirtyZones).length + (dirtyFooter ? 1 : 0);
  }
  function hasUnsaved() { return unsavedCount() > 0; }
  function refreshSaveBtn() {
    var b = document.getElementById("dvSave"); if (!b) return;
    var n = unsavedCount();
    b.textContent = n > 0 ? ("💾 Speichern (" + n + ")") : "💾 Diese Seite speichern";
    b.classList.toggle("has-changes", n > 0);
  }
  function markChanged(el) { if (el && el.classList && !el.classList.contains("dv-changed")) el.classList.add("dv-changed"); refreshSaveBtn(); }
  function clearChanged() {
    var c = document.querySelectorAll(".dv-changed");
    for (var i = 0; i < c.length; i++) c[i].classList.remove("dv-changed");
    refreshSaveBtn();
  }

  // ---- Standorte (Route auf der Startseite) bearbeiten ----
  function openPlaces() {
    if (document.getElementById("dvPanel")) return;
    var route = document.getElementById("route"); if (!route) return;
    var model = (route.getAttribute("data-places") || "").split("|").filter(Boolean);
    var wrap = document.createElement("div"); wrap.id = "dvPanel"; document.body.appendChild(wrap);
    wrap.addEventListener("click", function (e) { if (e.target === wrap) wrap.remove(); });
    function sync() {
      var ins = wrap.querySelectorAll("input[data-i]"), m = [];
      for (var i = 0; i < ins.length; i++) m[+ins[i].getAttribute("data-i")] = ins[i].value;
      model = m.map(function (s) { return (s == null ? "" : s); });
    }
    function wireBtns(attr, fn) {
      var b = wrap.querySelectorAll("[" + attr + "]");
      for (var i = 0; i < b.length; i++) (function (el) { el.onclick = function () { fn(+el.getAttribute(attr)); }; })(b[i]);
    }
    function render() {
      var h = '<div class="box"><h3>Standorte / Einzugsgebiet</h3><p class="sub">Orte auf der Karte der Startseite &ndash; die Reihenfolge entspricht dem Verlauf der Route. Max. 30.</p><div class="pl-list">';
      for (var i = 0; i < model.length; i++) {
        h += '<div class="pl-row"><input data-i="' + i + '" maxlength="60" placeholder="Ortsname">'
          + '<button type="button" data-up="' + i + '" title="nach oben">↑</button>'
          + '<button type="button" data-down="' + i + '" title="nach unten">↓</button>'
          + '<button type="button" data-del="' + i + '" title="entfernen">✕</button></div>';
      }
      h += '</div><button type="button" class="pl-add" id="plAdd">➕ Ort hinzufügen</button>';
      h += '<div class="row"><button class="cancel" id="plX">Abbrechen</button><button class="ok" id="plOk">Speichern</button></div></div>';
      wrap.innerHTML = h;
      var ins = wrap.querySelectorAll("input[data-i]");
      for (var k = 0; k < ins.length; k++) ins[k].value = model[+ins[k].getAttribute("data-i")] || "";
      wireBtns("data-del", function (i) { sync(); model.splice(i, 1); render(); });
      wireBtns("data-up", function (i) { if (i > 0) { sync(); var t = model[i - 1]; model[i - 1] = model[i]; model[i] = t; render(); } });
      wireBtns("data-down", function (i) { if (i < model.length - 1) { sync(); var t = model[i + 1]; model[i + 1] = model[i]; model[i] = t; render(); } });
      document.getElementById("plAdd").onclick = function () { sync(); model.push(""); render(); var xs = wrap.querySelectorAll("input[data-i]"); if (xs.length) xs[xs.length - 1].focus(); };
      document.getElementById("plX").onclick = function () { wrap.remove(); };
      document.getElementById("plOk").onclick = doSave;
    }
    function doSave() {
      sync();
      var list = model.map(function (s) { return (s || "").replace(/\s+/g, " ").trim(); }).filter(Boolean);
      if (!list.length) { toast("Bitte mindestens einen Ort angeben.", "err"); return; }
      if (list.length > 30) { toast("Maximal 30 Orte möglich.", "err"); return; }
      for (var i = 0; i < list.length; i++) {
        if (list[i].indexOf("|") >= 0) { toast("Ortsnamen dürfen kein senkrechtes | enthalten.", "err"); return; }
        if (list[i].length > 60) { toast("Ortsname zu lang (max. 60 Zeichen).", "err"); return; }
      }
      var ok = document.getElementById("plOk"); ok.disabled = true; ok.textContent = "Speichert …";
      call({ action: "save-places", places: list }).then(function (res) {
        if (res.ok) { wrap.remove(); toast("✓ Standorte gespeichert. Neuaufbau in ~1-3 Min, danach auf Aktualisieren klicken.", "ok"); }
        else { ok.disabled = false; ok.textContent = "Speichern"; toast(res.status === 401 ? "Falsches Passwort – über /admin neu anmelden." : ("Fehler: " + ((res.d && res.d.error) || res.status)), "err"); }
      }).catch(function () { ok.disabled = false; ok.textContent = "Speichern"; toast("Verbindungsfehler.", "err"); });
    }
    render();
  }

  // ---- Onboarding / Hilfe für Erstnutzer ----
  function openGuide() {
    if (document.getElementById("dvGuide")) return;
    var steps = [
      ["✍️", "Texte & Zahlen ändern", "Alles mit rot gestricheltem Rahmen anklicken und direkt überschreiben – auch Zahlen wie 25+ oder 1998."],
      ["🖼️", "Bilder", "Bild anklicken zum Ersetzen. Mit gedrückter Maus ziehen verschiebt den Bildausschnitt."],
      ["💾", "Speichern", "Geänderte Felder werden gelb markiert. Unten auf Speichern klicken oder Strg+S drücken. Live in etwa 1–3 Minuten."],
      ["↩", "Verschrieben?", "Unten auf Rückgängig klicken oder Strg+Z – auch für Text. Mit Strg+Umschalt+Z bzw. dem Knopf daneben lässt sich alles wiederherstellen."],
      ["🧭", "Menü, Footer & Kontakt", "Über den Knopf Menü & Footer änderst du, was auf allen Seiten gleich ist: Menü-Namen, Adresse, Öffnungszeiten sowie Telefon und E-Mail (mit Klick-Link)."],
      ["📍", "Standorte", "Über den Knopf Standorte die Orte auf der Karte der Startseite hinzufügen, umbenennen und sortieren."],
      ["➕", "Neue Elemente", "Zwischen den Abschnitten sitzt ein rundes Plus. Fahre mit der Maus darauf, dann fächern sich die Möglichkeiten auf: Text, Titel, Button, Bild, Liste, Spalten, FAQ, Zitat, Linie. Ein Klick fügt das Element direkt auf der Seite ein – und du kannst sofort lostippen."],
      ["🔍", "SEO & Titel", "Seitentitel und Google-Beschreibung je Seite anpassen."]
    ];
    var h = '<div class="dv-guide__box"><h3>Willkommen im Bearbeitungsmodus 👋</h3><p class="lead">Kurz erklärt – so änderst du deine Seite selbst. Keine Sorge, du kannst nichts kaputt machen: gespeichert wird erst, wenn du auf Speichern klickst.</p>';
    for (var i = 0; i < steps.length; i++) {
      h += '<div class="dv-guide__step"><div class="ic">' + steps[i][0] + '</div><div><b>' + steps[i][1] + '</b><span>' + steps[i][2] + '</span></div></div>';
    }
    h += '<div class="dv-guide__foot"><span class="hint">Diesen Hinweis öffnest du jederzeit über ❓ Hilfe unten in der Leiste.</span><button class="go" id="dvGuideGo">Los geht\'s</button></div></div>';
    var g = document.createElement("div"); g.id = "dvGuide"; g.className = "dv-guide"; g.innerHTML = h;
    document.body.appendChild(g);
    function close() { g.remove(); }
    document.getElementById("dvGuideGo").addEventListener("click", close);
    g.addEventListener("click", function (e) { if (e.target === g) close(); });
  }

  // ===== Inline-Element-System: subtiles "+" mit Fächer-Menü, Live-Bearbeitung direkt auf der Seite =====
  var EB_IMG = { "hero": "assets/img/senioren-zuhause.jpg", "senioren-zuhause": "assets/img/senioren-zuhause.jpg", "senioren-familie": "assets/img/senioren-familie.jpg", "senioren-pflege": "assets/img/senioren-pflege.jpg", "senioren-entlastung": "assets/img/senioren-entlastung.jpg", "haushalt-alltag": "assets/img/haushalt-alltag.jpg", "haushalt-reinigung": "assets/img/haushalt-reinigung.jpg" };
  var EB_SLOTS = [["senioren-zuhause", "Senioren zuhause"], ["senioren-familie", "Familie / Team"], ["senioren-pflege", "Pflege"], ["senioren-entlastung", "Entlastung"], ["haushalt-alltag", "Haushalt: Alltag"], ["haushalt-reinigung", "Haushalt: Reinigung"]];
  var EB_TYPES = [
    { t: "text", ic: "¶", lbl: "Text" }, { t: "heading", ic: "H", lbl: "Titel" },
    { t: "button", ic: "⬢", lbl: "Button" }, { t: "image", ic: "🖼", lbl: "Bild" },
    { t: "list", ic: "☰", lbl: "Liste" }, { t: "columns", ic: "◫", lbl: "Spalten" },
    { t: "faq", ic: "?", lbl: "FAQ" }, { t: "quote", ic: "❝", lbl: "Zitat" },
    { t: "divider", ic: "—", lbl: "Linie" }
  ];
  var dirtyZones = {}, dirtyFooter = false, ebActive = null, ebImgPicker = null, ebCtx = null;
  var EB_SIZES = ["s", "m", "l", "xl"], EB_WIDTHS = ["narrow", "normal", "wide", "full"], EB_ALIGN = ["left", "center", "right"];
  var CARD_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/></svg>';
  var CARD_ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  function ebLabel(t) { return t === "text" ? "Text" : t === "heading" ? "Titel" : t === "button" ? "Button" : t === "image" ? "Bild" : t === "list" ? "Liste" : t === "columns" ? "Spalten" : t === "faq" ? "FAQ" : t === "quote" ? "Zitat" : "Linie"; }
  // Text eines Feldes lesen: innerText respektiert Zeilenumbrüche/Block-Grenzen.
  // textContent würde "Zeile eins" + <div>"Zeile zwei" zu "Zeile einsZeile zwei" verschmelzen.
  function ebText(el) { return el ? (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim() : ""; }
  function ebNoEnter(e) { if (e.key === "Enter") e.preventDefault(); } // einzeilige Felder: Enter erzeugt sonst <div>/<br>
  function ebPastePlain(e) {
    var cd = e.clipboardData || window.clipboardData; if (!cd) return;
    var s = cd.getData("text/plain"); if (s == null) return;
    e.preventDefault();
    try { document.execCommand("insertText", false, String(s).replace(/\s*\n+\s*/g, " ")); } catch (x) {}
  }
  // Serverseitige Limits (index.ts) – hier vorher prüfen, statt still abzuschneiden.
  var EB_LIMITS = { button: 80, heading: 120, text: 600, quote: 400 };
  function ebValidateModel(model) {
    for (var i = 0; i < model.length; i++) {
      var b = model[i], lim = EB_LIMITS[b.type];
      if (lim && (b.text || "").length > lim) return ebLabel(b.type) + ": Text zu lang (" + b.text.length + " von max. " + lim + " Zeichen)";
      if (b.type === "columns" && ((b.left || "").length > 600 || (b.right || "").length > 600)) return "Spalten: Text zu lang (max. 600 Zeichen je Spalte)";
      if (b.type === "card") {
        if ((b.title || "").length > 80) return "Leistung: Titel zu lang (max. 80 Zeichen)";
        if ((b.text || "").length > 600) return "Leistung: Text zu lang (max. 600 Zeichen)";
        if ((b.items || []).length > 8) return "Leistung: höchstens 8 Stichpunkte";
      }
      if (b.type === "list" && (b.items || []).length > 20) return "Liste: höchstens 20 Punkte";
      if (b.type === "faq" && (b.items || []).length > 15) return "FAQ: höchstens 15 Fragen";
    }
    return null;
  }
  function ebClass(b) { return "eb-al-" + (b.align || "center") + " eb-w-" + (b.width || "normal") + " eb-sp-" + (b.space || "normal") + " eb-fs-" + (b.size || "m"); }
  function ebGet(el, prefix, vals, def) { for (var i = 0; i < vals.length; i++) if (el.classList.contains(prefix + vals[i])) return vals[i]; return def; }
  function ebSet(el, prefix, vals, val) { ebSnapshot(el); for (var i = 0; i < vals.length; i++) el.classList.remove(prefix + vals[i]); el.classList.add(prefix + val); ebDirty(el); }
  function ebDirty(el) {
    if (el.closest && el.closest("[data-foot-zone]")) { dirtyFooter = true; refreshSaveBtn(); return; }
    var z = el.closest ? el.closest("[data-ed-zone]") : null; if (z) { dirtyZones[z.getAttribute("data-ed-zone")] = true; refreshSaveBtn(); }
  }
  function ebBuild(type) {
    var b = { align: "center", width: "normal", space: "normal", size: "m" }, el;
    if (type === "button") { el = document.createElement("a"); el.href = "#"; el.setAttribute("data-eb", "button"); el.className = "btn " + ebClass(b); el.textContent = "Button-Text"; }
    else if (type === "heading") { el = document.createElement("h3"); el.setAttribute("data-eb", "heading"); el.className = ebClass(b); el.textContent = "Neue Überschrift"; }
    else if (type === "text") { el = document.createElement("p"); el.setAttribute("data-eb", "text"); el.className = ebClass(b); el.textContent = "Hier deinen Text schreiben …"; }
    else if (type === "quote") { el = document.createElement("blockquote"); el.setAttribute("data-eb", "quote"); el.className = ebClass(b); el.textContent = "Zitat …"; }
    else if (type === "divider") { el = document.createElement("hr"); el.setAttribute("data-eb", "divider"); el.className = ebClass(b); }
    else if (type === "list") { el = document.createElement("ul"); el.setAttribute("data-eb", "list"); el.className = ebClass(b); ["Erster Punkt", "Zweiter Punkt"].forEach(function (x) { var li = document.createElement("li"); li.textContent = x; el.appendChild(li); }); }
    else if (type === "image") { el = document.createElement("img"); el.setAttribute("data-eb", "image"); el.setAttribute("data-eb-slot", "senioren-zuhause"); el.className = ebClass(b); el.src = EB_IMG["senioren-zuhause"]; el.alt = ""; }
    else if (type === "columns") {
      el = document.createElement("div"); el.setAttribute("data-eb", "columns"); el.className = "eb-cols " + ebClass(b);
      el.innerHTML = '<div><p data-cf="left">Linke Spalte – Text hier eintragen.</p></div><div><p data-cf="right">Rechte Spalte – Text hier eintragen.</p></div>';
    }
    else if (type === "faq") {
      el = document.createElement("div"); el.setAttribute("data-eb", "faq"); el.className = "eb-faq " + ebClass(b);
      el.innerHTML = '<details class="eb-faq__item" open><summary data-cf="q">Ihre Frage?</summary><div data-cf="a">Die Antwort hier eintragen.</div></details>';
    }
    else if (type === "card") {
      el = document.createElement("div"); el.setAttribute("data-eb-href", "#"); el.setAttribute("data-eb", "card"); el.className = "scard";
      el.innerHTML = '<span class="scard__num" data-cf="num">05</span><div class="scard__icon">' + CARD_ICON + '</div>'
        + '<h3 data-cf="title">Neue Leistung</h3>'
        + '<p data-cf="text">Kurze Beschreibung der Leistung – hier eintragen.</p>'
        + '<ul class="scard__list" data-cf="list"><li>Stichpunkt eins</li><li>Stichpunkt zwei</li><li>Stichpunkt drei</li></ul>'
        + '<div class="scard__more"><span class="link-arrow">Mehr erfahren ' + CARD_ARROW + '</span></div>';
    }
    return el;
  }
  function ebCardToDiv(a) {
    var d = document.createElement("div");
    d.className = a.className; d.setAttribute("data-eb", "card"); d.setAttribute("data-eb-href", a.getAttribute("href") || "#");
    while (a.firstChild) d.appendChild(a.firstChild);
    if (a.parentNode) a.parentNode.replaceChild(d, a);
    return d;
  }
  function ebCardAddBullet(cardEl) {
    ebSnapshot(cardEl);
    var ul = cardEl.querySelector('[data-cf="list"]');
    if (!ul) {
      ul = document.createElement("ul"); ul.className = "scard__list"; ul.setAttribute("data-cf", "list"); ul.setAttribute("contenteditable", "true"); ul.setAttribute("spellcheck", "false");
      var more = cardEl.querySelector(".scard__more"); if (more) cardEl.insertBefore(ul, more); else cardEl.appendChild(ul);
    }
    var li = document.createElement("li"); li.textContent = "Neuer Stichpunkt"; ul.appendChild(li);
    ebWireList(ul); ebDirty(cardEl);
    try { ul.focus(); var r = document.createRange(); r.selectNodeContents(li); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
  }
  // ---- Listen: ✕ pro Punkt, sauberes Enter ----
  function ebLiText(li) {
    var c = li.cloneNode(true), xs = c.querySelectorAll(".eb-li-x");
    for (var i = 0; i < xs.length; i++) xs[i].remove();
    return (c.textContent || "").replace(/\s+/g, " ").trim();
  }
  function ebDecorateLi(li) {
    var old = li.querySelector(".eb-li-x"); if (old) old.remove(); // immer frisch verdrahten (auch nach Undo)
    var x = document.createElement("button");
    x.type = "button"; x.className = "eb-li-x"; x.setAttribute("contenteditable", "false"); x.textContent = "✕"; x.title = "Punkt löschen";
    x.onmousedown = function (e) { e.preventDefault(); };
    x.onclick = function (e) { e.preventDefault(); e.stopPropagation(); var ul = li.parentNode; ebSnapshot(ul); li.remove(); ebDirty(ul); };
    li.appendChild(x);
  }
  function ebWireList(ul) {
    var lis = ul.querySelectorAll("li");
    for (var i = 0; i < lis.length; i++) ebDecorateLi(lis[i]);
    if (ul.__ebWired) return; ul.__ebWired = true; // Property (nicht Attribut) -> nach Undo neu verdrahtet
    ul.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      ebSnapshot(ul); ebTypeActive = false; // neuer Punkt = eigener Undo-Schritt
      var s = window.getSelection(), n = s && s.anchorNode ? s.anchorNode : null;
      var li = n ? (n.nodeType === 1 ? n : n.parentNode) : null;
      while (li && li !== ul && li.tagName !== "LI") li = li.parentNode;
      var nli = document.createElement("li");
      if (li && li.tagName === "LI") li.parentNode.insertBefore(nli, li.nextSibling); else ul.appendChild(nli);
      ebDecorateLi(nli); ebDirty(ul);
      try { var r = document.createRange(); r.setStart(nli, 0); r.collapse(true); var s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(r); } catch (e2) {}
    });
  }
  function ebFaqDecorate(d, blockEl) {
    var old = d.querySelector(".eb-faq-x"); if (old) old.remove();
    var x = document.createElement("button");
    x.type = "button"; x.className = "eb-faq-x"; x.setAttribute("contenteditable", "false"); x.textContent = "✕"; x.title = "Diese Frage löschen";
    x.onmousedown = function (e) { e.preventDefault(); };
    x.onclick = function (e) { e.preventDefault(); e.stopPropagation(); ebSnapshot(blockEl); d.remove(); ebDirty(blockEl); ebShowCtx(blockEl); };
    d.appendChild(x);
  }
  function ebFaqAdd(el) {
    ebSnapshot(el);
    var d = document.createElement("details"); d.className = "eb-faq__item"; d.setAttribute("open", "");
    d.innerHTML = '<summary data-cf="q">Neue Frage?</summary><div data-cf="a">Antwort hier eintragen.</div>';
    el.appendChild(d);
    var s = d.querySelector("summary"), a = d.querySelector("div");
    s.setAttribute("contenteditable", "true"); s.setAttribute("spellcheck", "false"); s.addEventListener("click", function (e) { e.preventDefault(); });
    a.setAttribute("contenteditable", "true"); a.setAttribute("spellcheck", "false");
    ebFaqDecorate(d, el);
    ebDirty(el);
    try { s.focus(); var r = document.createRange(); r.selectNodeContents(s); var sl = window.getSelection(); sl.removeAllRanges(); sl.addRange(r); } catch (e2) {}
  }
  // ---- Undo: Schnappschuss der Zone vor jeder strukturellen Änderung ----
  var ebUndoStack = [], ebRedoStack = [];
  function ebZoneOf(el) { return el && el.closest ? (el.closest("[data-ed-zone]") || el.closest("[data-foot-zone]")) : null; }
  function ebZoneParts(z) {
    var parts = [], kids = z.children;
    for (var i = 0; i < kids.length; i++) if (!kids[i].classList.contains("eb-adder") && !kids[i].classList.contains("eb-footaddbtn")) parts.push(kids[i].outerHTML);
    return parts.join("");
  }
  function ebZoneFrom(el) { return (el && el.hasAttribute && (el.hasAttribute("data-ed-zone") || el.hasAttribute("data-foot-zone"))) ? el : ebZoneOf(el); }
  // Ein Undo-Eintrag ist entweder eine ganze Zone (Elemente) oder ein einzelnes Seiten-Textfeld.
  function ebSnapEntry(target) {
    var z = ebZoneFrom(target);
    if (z) return { kind: "zone", zone: z, html: ebZoneParts(z) };
    var f = target && target.closest ? target.closest("[data-ed],[data-ed-rich]") : null;
    if (f) return { kind: "el", el: f, html: f.innerHTML };
    return null;
  }
  function ebCurrentOf(e) {
    return e.kind === "zone" ? { kind: "zone", zone: e.zone, html: ebZoneParts(e.zone) } : { kind: "el", el: e.el, html: e.el.innerHTML };
  }
  function ebSnapshot(el) {
    var e = ebSnapEntry(el); if (!e) return;
    ebUndoStack.push(e);
    if (ebUndoStack.length > 40) ebUndoStack.shift();
    ebRedoStack.length = 0; // neue Änderung -> Wiederherstellen verfällt
    refreshUndoBtn();
  }
  // Wiederherstellen und alles neu verdrahten (wiederhergestellte Elemente haben keine Listener)
  function ebApply(e) {
    if (e.kind === "el") {
      e.el.innerHTML = e.html; markChanged(e.el); ebHideCtx(); refreshSaveBtn(); refreshUndoBtn(); return;
    }
    var z = e.zone, kids = [].slice.call(z.children);
    for (var i = 0; i < kids.length; i++) if (!kids[i].classList.contains("eb-adder") && !kids[i].classList.contains("eb-footaddbtn")) kids[i].remove();
    var tmp = document.createElement("div"); tmp.innerHTML = e.html;
    var anchor = z.querySelector(".eb-adder") || z.querySelector(".eb-footaddbtn");
    while (tmp.firstChild) { if (anchor) z.insertBefore(tmp.firstChild, anchor); else z.appendChild(tmp.firstChild); }
    var ebs = z.querySelectorAll("[data-eb]");
    for (var j = 0; j < ebs.length; j++) ebEnhance(ebs[j]);
    ebHideCtx();
    if (z.hasAttribute("data-foot-zone")) dirtyFooter = true; else dirtyZones[z.getAttribute("data-ed-zone")] = true;
    refreshSaveBtn(); refreshUndoBtn();
  }
  function ebUndo() {
    var s = ebUndoStack.pop();
    if (!s) { toast("Nichts zum Rückgängigmachen.", ""); return; }
    ebRedoStack.push(ebCurrentOf(s)); // aktuellen Stand für Wiederherstellen sichern
    ebApply(s);
    toast("↩ Rückgängig gemacht.", "ok");
  }
  function ebRedo() {
    var s = ebRedoStack.pop();
    if (!s) { toast("Nichts zum Wiederherstellen.", ""); return; }
    ebUndoStack.push(ebCurrentOf(s));
    ebApply(s);
    toast("↪ Wiederhergestellt.", "ok");
  }
  // Tippen: pro Schreib-Abschnitt EIN Undo-Schritt (Schnappschuss vor der ersten Eingabe, 800 ms Pause = neuer Schritt)
  var ebTypeTimer = null, ebTypeActive = false;
  function ebTypeSnapshot(el) {
    if (!ebTypeActive) { ebSnapshot(el); ebTypeActive = true; }
    if (ebTypeTimer) clearTimeout(ebTypeTimer);
    ebTypeTimer = setTimeout(function () { ebTypeActive = false; }, 800);
  }
  function refreshUndoBtn() {
    var b = document.getElementById("dvUndo"); if (b) b.disabled = !ebUndoStack.length;
    var r = document.getElementById("dvRedo"); if (r) r.disabled = !ebRedoStack.length;
  }
  function ebPositionCtx(el) {
    var c = ebCtx; if (!c || !el || !c.classList.contains("show")) return;
    var r = el.getBoundingClientRect(), cw = c.offsetWidth, chh = c.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    // Fallback: Element (fast) außerhalb des sichtbaren Bereichs -> Leiste unten mittig einblenden
    if (r.bottom < 44 || r.top > vh - 44) { c.style.top = Math.max(8, vh - chh - 84) + "px"; c.style.left = Math.max(8, (vw - cw) / 2) + "px"; return; }
    var top = r.bottom + 10;
    if (top + chh > vh - 84) top = r.top - chh - 10; // über das Element, wenn unten kein Platz (Bottom-Bar freihalten)
    if (top < 8) top = 8;
    var left = r.left + r.width / 2 - cw / 2;
    if (left < 8) left = 8; if (left + cw > vw - 8) left = vw - cw - 8;
    c.style.top = Math.round(top) + "px"; c.style.left = Math.round(left) + "px";
  }
  function ebEnhance(el) {
    var t = el.getAttribute("data-eb");
    if (t === "card") {
      if (el.tagName === "A") el = ebCardToDiv(el); // Link -> div, damit die Felder zuverlässig editierbar sind
      var cn = el.querySelector('[data-cf="num"]') || el.querySelector(".scard__num"); if (cn) cn.setAttribute("data-cf", "num");
      var ct = el.querySelector('[data-cf="title"]') || el.querySelector("h3"); if (ct) ct.setAttribute("data-cf", "title");
      var cx = el.querySelector('[data-cf="text"]') || el.querySelector("p"); if (cx) cx.setAttribute("data-cf", "text");
      var cl = el.querySelector('[data-cf="list"]') || el.querySelector("ul.scard__list"); if (cl) cl.setAttribute("data-cf", "list");
      var flds = el.querySelectorAll("[data-cf]");
      for (var ci = 0; ci < flds.length; ci++) { flds[ci].setAttribute("contenteditable", "true"); flds[ci].setAttribute("spellcheck", "false"); }
      if (cl) ebWireList(cl);
      // Titel/Text sind einzeilig: Enter würde beim Speichern die Zeilen verschmelzen
      if (ct) { ct.addEventListener("keydown", ebNoEnter); ct.addEventListener("paste", ebPastePlain); }
      if (cx) { cx.addEventListener("keydown", ebNoEnter); cx.addEventListener("paste", ebPastePlain); }
      if (cn) { cn.addEventListener("keydown", ebNoEnter); cn.addEventListener("paste", ebPastePlain); }
      var cardEl = el;
      el.addEventListener("focusin", function () { ebSelect(cardEl); });
      el.addEventListener("click", function () { ebSelect(cardEl); });
      el.addEventListener("beforeinput", function () { ebTypeSnapshot(cardEl); });
      el.addEventListener("input", function () { ebDirty(cardEl); });
      return;
    }
    if (t === "columns" || t === "faq") {
      if (t === "columns") {
        var cds = el.querySelectorAll(":scope > div");
        if (cds[0]) { var p0 = cds[0].querySelector("p") || cds[0]; p0.setAttribute("data-cf", "left"); }
        if (cds[1]) { var p1 = cds[1].querySelector("p") || cds[1]; p1.setAttribute("data-cf", "right"); }
      } else {
        var dts = el.querySelectorAll("details");
        for (var di = 0; di < dts.length; di++) {
          dts[di].setAttribute("open", "");
          var sm = dts[di].querySelector("summary"); if (sm) { sm.setAttribute("data-cf", "q"); sm.addEventListener("click", function (e) { e.preventDefault(); }); }
          var av = dts[di].querySelector("div"); if (av) av.setAttribute("data-cf", "a");
          ebFaqDecorate(dts[di], el);
        }
      }
      var f2 = el.querySelectorAll("[data-cf]");
      for (var q2 = 0; q2 < f2.length; q2++) { f2[q2].setAttribute("contenteditable", "true"); f2[q2].setAttribute("spellcheck", "false"); f2[q2].addEventListener("keydown", ebNoEnter); f2[q2].addEventListener("paste", ebPastePlain); }
      var cfEl = el;
      el.addEventListener("focusin", function () { ebSelect(cfEl); });
      el.addEventListener("click", function () { ebSelect(cfEl); });
      el.addEventListener("beforeinput", function () { ebTypeSnapshot(cfEl); });
      el.addEventListener("input", function () { ebDirty(cfEl); });
      return;
    }
    if (t === "flink") {
      el.setAttribute("contenteditable", "true"); el.setAttribute("spellcheck", "false");
      el.addEventListener("keydown", ebNoEnter); el.addEventListener("paste", ebPastePlain);
      el.addEventListener("click", function (e) { e.preventDefault(); ebSelect(el); });
      el.addEventListener("focusin", function () { ebSelect(el); });
      el.addEventListener("beforeinput", function () { ebTypeSnapshot(el); });
      el.addEventListener("input", function () { ebDirty(el); });
      return;
    }
    if (t === "text" || t === "heading" || t === "quote" || t === "list" || t === "button") { el.setAttribute("contenteditable", "true"); el.setAttribute("spellcheck", "false"); }
    if (t === "list") ebWireList(el); // Liste braucht Enter für neue Punkte
    else if (el.getAttribute("contenteditable") === "true") el.addEventListener("keydown", ebNoEnter);
    el.addEventListener("paste", ebPastePlain);
    el.addEventListener("focusin", function () { ebSelect(el); });
    el.addEventListener("click", function (e) { if (t === "button") e.preventDefault(); ebSelect(el); });
    el.addEventListener("beforeinput", function () { ebTypeSnapshot(el); });
    el.addEventListener("input", function () { ebDirty(el); });
  }
  function ebSelect(el) { if (ebActive && ebActive !== el) ebActive.classList.remove("eb-active"); ebActive = el; el.classList.add("eb-active"); ebShowCtx(el); }
  function ebPickImage(el) {
    if (!ebImgPicker) { ebImgPicker = document.createElement("input"); ebImgPicker.type = "file"; ebImgPicker.accept = "image/jpeg,image/png,image/webp"; ebImgPicker.style.display = "none"; document.body.appendChild(ebImgPicker); }
    ebImgPicker.onchange = function () {
      var f = ebImgPicker.files && ebImgPicker.files[0]; ebImgPicker.value = ""; if (!f) return;
      if (f.size > 3000000) { toast("Bild zu groß (max. 3 MB).", "err"); return; }
      var rd = new FileReader(); rd.onload = function () {
        var b64 = String(rd.result || "").split(",")[1] || ""; if (!b64) return; toast("Bild wird hochgeladen …", "");
        call({ action: "upload-block-image", dataBase64: b64 }).then(function (res) {
          if (res.ok && res.d && res.d.src) { el.setAttribute("data-eb-src", res.d.src); el.src = res.d.src; ebDirty(el); toast("Bild eingefügt.", "ok"); }
          else toast("Upload fehlgeschlagen.", "err");
        }).catch(function () { toast("Verbindungsfehler.", "err"); });
      }; rd.readAsDataURL(f);
    };
    ebImgPicker.click();
  }
  // Bild in einer Spalte setzen/ersetzen bzw. entfernen
  function ebColPick(blockEl, side) {
    var cds = blockEl.querySelectorAll(":scope > div"), col = cds[side === "right" ? 1 : 0];
    if (!col) return;
    if (!ebImgPicker) { ebImgPicker = document.createElement("input"); ebImgPicker.type = "file"; ebImgPicker.accept = "image/jpeg,image/png,image/webp"; ebImgPicker.style.display = "none"; document.body.appendChild(ebImgPicker); }
    ebImgPicker.onchange = function () {
      var f = ebImgPicker.files && ebImgPicker.files[0]; ebImgPicker.value = ""; if (!f) return;
      if (f.size > 3000000) { toast("Bild zu groß (max. 3 MB).", "err"); return; }
      var rd = new FileReader(); rd.onload = function () {
        var b64 = String(rd.result || "").split(",")[1] || ""; if (!b64) return; toast("Bild wird hochgeladen …", "");
        call({ action: "upload-block-image", dataBase64: b64 }).then(function (res) {
          if (res.ok && res.d && res.d.src) {
            ebSnapshot(blockEl);
            var img = col.querySelector("img.eb-col-img");
            if (!img) { img = document.createElement("img"); img.className = "eb-col-img"; img.setAttribute("data-eb-col-img", "1"); img.alt = ""; col.insertBefore(img, col.firstChild); }
            img.setAttribute("data-eb-src", res.d.src); img.removeAttribute("data-eb-slot"); img.src = res.d.src;
            ebDirty(blockEl); ebShowCtx(blockEl); toast("Bild eingefügt.", "ok");
          } else toast("Upload fehlgeschlagen.", "err");
        }).catch(function () { toast("Verbindungsfehler.", "err"); });
      }; rd.readAsDataURL(f);
    };
    ebImgPicker.click();
  }
  function ebColRemove(blockEl, side) {
    var cds = blockEl.querySelectorAll(":scope > div"), col = cds[side === "right" ? 1 : 0];
    if (!col) return;
    var img = col.querySelector("img.eb-col-img"); if (!img) return;
    ebSnapshot(blockEl); img.remove(); ebDirty(blockEl); ebShowCtx(blockEl);
  }
  // Mediathek-Auswahl; onPick(pfad) entscheidet, wohin das Bild gesetzt wird.
  function ebLib(onPick) {
    var ov = document.createElement("div"); ov.className = "eb-libov";
    ov.innerHTML = '<div class="eb-libbox"><h4>Mediathek &ndash; Bild wählen</h4><div class="eb-libgrid">lädt …</div><div class="row"><button class="cancel" type="button" id="ebLibX">Schließen</button></div></div>';
    document.body.appendChild(ov);
    var grid = ov.querySelector(".eb-libgrid");
    document.getElementById("ebLibX").onclick = function () { ov.remove(); };
    ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
    call({ action: "list-uploads" }).then(function (res) {
      var ups = (res.ok && res.d && res.d.uploads) ? res.d.uploads : [];
      if (!ups.length) { grid.textContent = "Noch keine hochgeladenen Bilder."; return; }
      grid.innerHTML = "";
      ups.forEach(function (u) { var im = document.createElement("img"); im.src = u; im.loading = "lazy"; im.onclick = function () { ov.remove(); onPick(u); }; grid.appendChild(im); });
    }).catch(function () { grid.textContent = "Fehler beim Laden."; });
  }
  // Bild-Element einer Spalte holen bzw. anlegen (erst wenn wirklich ein Bild gesetzt wird)
  function ebColImgEnsure(blockEl, side) {
    var cds = blockEl.querySelectorAll(":scope > div"), col = cds[side === "right" ? 1 : 0];
    if (!col) return null;
    var img = col.querySelector("img.eb-col-img");
    if (!img) { img = document.createElement("img"); img.className = "eb-col-img"; img.setAttribute("data-eb-col-img", "1"); img.alt = ""; col.insertBefore(img, col.firstChild); }
    return img;
  }
  function ebColLib(blockEl, side) {
    ebLib(function (u) {
      ebSnapshot(blockEl);
      var img = ebColImgEnsure(blockEl, side); if (!img) return;
      img.setAttribute("data-eb-src", u); img.removeAttribute("data-eb-slot"); img.src = u;
      ebDirty(blockEl); ebShowCtx(blockEl); toast("Bild eingefügt.", "ok");
    });
  }
  function ebMove(el, dir) {
    var zone = el.closest("[data-ed-zone]") || el.closest("[data-foot-zone]"); if (!zone) return;
    var sib = dir < 0 ? el.previousElementSibling : el.nextElementSibling;
    while (sib && !sib.hasAttribute("data-eb")) sib = dir < 0 ? sib.previousElementSibling : sib.nextElementSibling;
    if (!sib) { toast(dir < 0 ? "Schon ganz oben." : "Schon ganz unten.", ""); return; } // kein Phantom-Undo, kein Redo-Verlust
    ebSnapshot(el);
    if (dir < 0) zone.insertBefore(el, sib); else zone.insertBefore(sib, el);
    ebDirty(el);
  }
  function ebEnsureCtx() { if (ebCtx) return ebCtx; ebCtx = document.createElement("div"); ebCtx.id = "ebCtx"; document.body.appendChild(ebCtx); return ebCtx; }
  function ebHideCtx() { if (ebCtx) ebCtx.classList.remove("show"); if (ebActive) { ebActive.classList.remove("eb-active"); ebActive = null; } }
  function ebShowCtx(el) {
    var c = ebEnsureCtx(), t = el.getAttribute("data-eb");
    if (t === "card") {
      c.innerHTML = '<span class="lbl">Leistung</span><button data-a="bullet" title="Stichpunkt hinzufügen">＋ Stichpunkt</button><span class="sep"></span><input data-a="href" placeholder="Link, z. B. seniorenbetreuung.html"><span class="sep"></span><button data-a="up" title="nach oben">↑</button><button data-a="down" title="nach unten">↓</button><button data-a="del" title="löschen">🗑</button>';
      c.classList.add("show");
      var chi = c.querySelector('input[data-a="href"]'); var chv = el.getAttribute("data-eb-href") || el.getAttribute("href") || ""; chi.value = chv === "#" ? "" : chv; chi.oninput = function () { el.setAttribute("data-eb-href", chi.value.trim() || "#"); ebDirty(el); };
      var cbs = c.querySelectorAll("button[data-a]");
      for (var ci = 0; ci < cbs.length; ci++) (function (btn) {
        btn.onclick = function () {
          var a = btn.getAttribute("data-a");
          if (a === "bullet") ebCardAddBullet(el);
          else if (a === "up") ebMove(el, -1); else if (a === "down") ebMove(el, 1);
          else if (a === "del") { if (window.confirm("Diese Leistung wirklich löschen?")) { var z = el.closest("[data-ed-zone]"); ebSnapshot(el); el.remove(); if (z) { dirtyZones[z.getAttribute("data-ed-zone")] = true; refreshSaveBtn(); } ebHideCtx(); } }
        };
      })(cbs[ci]);
      ebPositionCtx(el);
      return;
    }
    if (t === "flink") {
      c.innerHTML = '<span class="lbl">Footer-Link</span><input data-a="href" placeholder="Ziel, z. B. haushaltshilfe.html oder https://…"><span class="sep"></span><button data-a="up" title="nach oben">↑</button><button data-a="down" title="nach unten">↓</button><button data-a="del" title="löschen">🗑</button>';
      c.classList.add("show");
      var fhi = c.querySelector('input[data-a="href"]'); var fhv = el.getAttribute("href") || ""; fhi.value = fhv === "#" ? "" : fhv; fhi.oninput = function () { el.setAttribute("href", fhi.value.trim() || "#"); ebDirty(el); };
      var fbs = c.querySelectorAll("button[data-a]");
      for (var fi = 0; fi < fbs.length; fi++) (function (btn) {
        btn.onclick = function () {
          var a = btn.getAttribute("data-a");
          if (a === "up") ebMove(el, -1); else if (a === "down") ebMove(el, 1);
          else if (a === "del") { if (window.confirm("Diesen Footer-Link löschen?")) { ebSnapshot(el); el.remove(); dirtyFooter = true; refreshSaveBtn(); ebHideCtx(); } }
        };
      })(fbs[fi]);
      ebPositionCtx(el);
      return;
    }
    var al = ebGet(el, "eb-al-", EB_ALIGN, "center"), w = ebGet(el, "eb-w-", EB_WIDTHS, "normal");
    var h = '<span class="lbl">' + ebLabel(t) + '</span>';
    if (t !== "divider" && t !== "image") h += '<button data-a="fsd" title="kleiner">A−</button><button data-a="fsu" title="größer">A+</button><span class="sep"></span>';
    h += '<button data-a="all" class="' + (al === "left" ? "on" : "") + '" title="links">◧</button><button data-a="alc" class="' + (al === "center" ? "on" : "") + '" title="mittig">▣</button><button data-a="alr" class="' + (al === "right" ? "on" : "") + '" title="rechts">◨</button>';
    h += '<span class="sep"></span><button data-a="w" title="Breite ändern">↔ ' + w + '</button>';
    if (t === "image") h += '<span class="sep"></span><button data-a="imgup" title="Bild hochladen">📤</button><button data-a="imglib" title="Mediathek">🖼</button><input data-a="alt" placeholder="Bildbeschreibung (Alt-Text)">';
    if (t === "faq") h += '<span class="sep"></span><button data-a="faqadd">＋ Frage</button>';
    if (t === "columns") {
      var cds3 = el.querySelectorAll(":scope > div");
      var hasL = !!(cds3[0] && cds3[0].querySelector("img.eb-col-img")), hasR = !!(cds3[1] && cds3[1].querySelector("img.eb-col-img"));
      h += '<span class="sep"></span><span class="lbl2">Links</span><button data-a="colupL" title="Bild hochladen">📤</button><button data-a="collibL" title="Mediathek">🖼</button>'
        + (hasL ? '<input data-a="altL" placeholder="Alt-Text links"><button data-a="colrmL" title="Bild links entfernen">✕</button>' : '')
        + '<span class="sep"></span><span class="lbl2">Rechts</span><button data-a="colupR" title="Bild hochladen">📤</button><button data-a="collibR" title="Mediathek">🖼</button>'
        + (hasR ? '<input data-a="altR" placeholder="Alt-Text rechts"><button data-a="colrmR" title="Bild rechts entfernen">✕</button>' : '');
    }
    if (t === "button") h += '<span class="sep"></span><input data-a="href" placeholder="Link, z. B. kontakt.html">';
    h += '<span class="sep"></span><button data-a="up" title="nach oben">↑</button><button data-a="down" title="nach unten">↓</button><button data-a="del" title="löschen">🗑</button>';
    c.innerHTML = h; c.classList.add("show");
    if (t === "button") { var hi = c.querySelector('input[data-a="href"]'); var hv = el.getAttribute("href") || ""; hi.value = hv === "#" ? "" : hv; hi.oninput = function () { el.setAttribute("href", hi.value.trim() || "#"); ebDirty(el); }; }
    if (t === "image") { var ai = c.querySelector('input[data-a="alt"]'); ai.value = el.getAttribute("alt") || ""; ai.oninput = function () { el.setAttribute("alt", ai.value); ebDirty(el); }; }
    if (t === "columns") {
      var cds4 = el.querySelectorAll(":scope > div");
      [["altL", 0], ["altR", 1]].forEach(function (pair) {
        var inp = c.querySelector('input[data-a="' + pair[0] + '"]'); if (!inp) return;
        var img = cds4[pair[1]] ? cds4[pair[1]].querySelector("img.eb-col-img") : null; if (!img) return;
        inp.value = img.getAttribute("alt") || "";
        inp.oninput = function () { img.setAttribute("alt", inp.value); ebDirty(el); };
      });
    }
    var bs = c.querySelectorAll("button[data-a]");
    for (var i = 0; i < bs.length; i++) (function (btn) {
      btn.onclick = function () {
        var a = btn.getAttribute("data-a"); var cur;
        if (a === "fsd") { cur = EB_SIZES.indexOf(ebGet(el, "eb-fs-", EB_SIZES, "m")); ebSet(el, "eb-fs-", EB_SIZES, EB_SIZES[Math.max(0, cur - 1)]); }
        else if (a === "fsu") { cur = EB_SIZES.indexOf(ebGet(el, "eb-fs-", EB_SIZES, "m")); ebSet(el, "eb-fs-", EB_SIZES, EB_SIZES[Math.min(EB_SIZES.length - 1, cur + 1)]); }
        else if (a === "all") ebSet(el, "eb-al-", EB_ALIGN, "left");
        else if (a === "alc") ebSet(el, "eb-al-", EB_ALIGN, "center");
        else if (a === "alr") ebSet(el, "eb-al-", EB_ALIGN, "right");
        else if (a === "w") { cur = EB_WIDTHS.indexOf(ebGet(el, "eb-w-", EB_WIDTHS, "normal")); ebSet(el, "eb-w-", EB_WIDTHS, EB_WIDTHS[(cur + 1) % EB_WIDTHS.length]); }
        else if (a === "imgup") ebPickImage(el);
        else if (a === "imglib") ebLib(function (u) { ebSnapshot(el); el.setAttribute("data-eb-src", u); el.removeAttribute("data-eb-slot"); el.src = u; ebDirty(el); toast("Bild eingefügt.", "ok"); });
        else if (a === "up") ebMove(el, -1);
        else if (a === "down") ebMove(el, 1);
        else if (a === "faqadd") ebFaqAdd(el);
        else if (a === "colupL") ebColPick(el, "left");
        else if (a === "colupR") ebColPick(el, "right");
        else if (a === "collibL") ebColLib(el, "left");
        else if (a === "collibR") ebColLib(el, "right");
        else if (a === "colrmL") ebColRemove(el, "left");
        else if (a === "colrmR") ebColRemove(el, "right");
        else if (a === "del") { if (window.confirm("Dieses Element löschen?")) { var z = el.closest("[data-ed-zone]"); ebSnapshot(el); el.remove(); if (z) { dirtyZones[z.getAttribute("data-ed-zone")] = true; refreshSaveBtn(); } ebHideCtx(); return; } }
        if (a !== "del" && a !== "imgup" && a !== "imglib" && a !== "faqadd" && a.indexOf("col") !== 0) ebShowCtx(el); // Panel aktualisieren
      };
    })(bs[i]);
    ebPositionCtx(el);
  }
  function ebAdd(zone, type) {
    ebSnapshot(zone);
    var el = ebBuild(type), adder = zone.querySelector(".eb-adder");
    if (adder) zone.insertBefore(el, adder); else zone.appendChild(el);
    ebEnhance(el);
    dirtyZones[zone.getAttribute("data-ed-zone")] = true; refreshSaveBtn();
    if (type === "card") {
      // Nummer als Vorschlag hochzählen (bleibt danach frei editierbar)
      var nEl2 = el.querySelector('[data-cf="num"]');
      if (nEl2 && zone.parentNode) { var cnt = zone.parentNode.querySelectorAll(".scard").length; nEl2.textContent = cnt < 10 ? ("0" + cnt) : String(cnt); }
      el.classList.add("eb-card-in"); setTimeout(function () { el.classList.remove("eb-card-in"); }, 650);
      var ct = el.querySelector('[data-cf="title"]'); if (ct) { ct.focus(); try { var rr = document.createRange(); rr.selectNodeContents(ct); var ss = window.getSelection(); ss.removeAllRanges(); ss.addRange(rr); } catch (e) {} }
      ebSelect(el); return;
    }
    if (type === "image") { ebSelect(el); ebPickImage(el); return; }
    if (type === "divider") { ebSelect(el); return; }
    el.focus();
    try { var r = document.createRange(); r.selectNodeContents(el); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
    ebSelect(el);
  }
  function ebEnhanceZone(zone) {
    var isCards = zone.hasAttribute("data-ed-cards");
    var ebs = zone.querySelectorAll("[data-eb]");
    for (var i = 0; i < ebs.length; i++) ebEnhance(ebs[i]);
    var adder = document.createElement("div"); adder.className = "eb-adder" + (isCards ? " eb-adder--card" : "");
    var plus = document.createElement("button"); plus.type = "button"; plus.className = "eb-plus"; plus.textContent = "+"; plus.title = isCards ? "Neue Leistung hinzufügen" : "Element hinzufügen";
    var fan = document.createElement("div"); fan.className = "eb-fan";
    var types = isCards ? [{ t: "card", ic: "➕", lbl: "Neue Leistung" }] : EB_TYPES;
    // Buttons (Icon + Name) auf einem Halbkreis-Bogen über dem "+" verteilen.
    // Radius am Viewport deckeln, sonst ragt der Bogen auf dem Handy über den Rand (overflow-x:clip schneidet ab).
    var n = types.length, Rwish = n > 5 ? 172 : (n > 1 ? 120 : 84);
    var Rmax = Math.max(72, Math.floor(window.innerWidth / 2) - 44);
    var R = Math.min(Rwish, Rmax);
    types.forEach(function (ty, i2) {
      var b = document.createElement("button"); b.type = "button"; b.title = ty.lbl;
      b.innerHTML = '<span class="ei">' + ty.ic + '</span><span class="el">' + ty.lbl + '</span>';
      var ang = (n === 1) ? 90 : (180 - (i2 / (n - 1)) * 180);       // 180° = links … 0° = rechts
      var rad = ang * Math.PI / 180;
      b.style.setProperty("--x", Math.round(Math.cos(rad) * R) + "px");
      b.style.setProperty("--y", Math.round(-Math.sin(rad) * R) + "px"); // negativ = nach oben
      b.style.transitionDelay = (i2 * 28) + "ms";
      b.onclick = function () { adder.classList.remove("open"); ebAdd(zone, ty.t); };
      fan.appendChild(b);
    });
    // Öffnen bei Hover (mit Nachlauf, damit der Weg zum Bogen nicht abbricht) + Klick-Toggle für Touch
    var closeT = null;
    function openFan() { if (closeT) { clearTimeout(closeT); closeT = null; } adder.classList.add("open"); }
    function closeFanSoon() { if (closeT) clearTimeout(closeT); closeT = setTimeout(function () { adder.classList.remove("open"); }, 380); }
    adder.addEventListener("mouseenter", openFan);
    adder.addEventListener("mouseleave", closeFanSoon);
    plus.onclick = function () { if (adder.classList.contains("open")) adder.classList.remove("open"); else openFan(); };
    adder.appendChild(fan); adder.appendChild(plus); zone.appendChild(adder);
  }
  function ebSerialize(zone) {
    var model = [], ebs = zone.querySelectorAll("[data-eb]");
    for (var i = 0; i < ebs.length; i++) {
      var el = ebs[i], t = el.getAttribute("data-eb"), b = { type: t };
      if (t === "card") {
        var h3 = el.querySelector('[data-cf="title"]'), pp = el.querySelector('[data-cf="text"]'), ull = el.querySelector('[data-cf="list"]');
        b.title = ebText(h3); b.text = ebText(pp);
        b.items = []; if (ull) { var clis = ull.querySelectorAll("li"); for (var cq = 0; cq < clis.length; cq++) { var ct2 = ebLiText(clis[cq]); if (ct2) b.items.push(ct2); } }
        var nEl = el.querySelector('[data-cf="num"]');
        b.href = el.getAttribute("data-eb-href") || el.getAttribute("href") || "";
        b.num = ebText(nEl).slice(0, 4); // frei editierbar
        model.push(b); continue;
      }
      if (t === "button") { b.text = ebText(el); b.href = el.getAttribute("href") || ""; b.variant = el.classList.contains("btn--ghost") ? "ghost" : "solid"; }
      else if (t === "heading" || t === "text" || t === "quote") { b.text = ebText(el); }
      else if (t === "list") { b.items = []; var lis2 = el.querySelectorAll("li"); for (var lq = 0; lq < lis2.length; lq++) { var lt = ebLiText(lis2[lq]); if (lt) b.items.push(lt); } }
      else if (t === "columns") {
        var cds2 = el.querySelectorAll(":scope > div");
        b.left = ebText(cds2[0]); b.right = ebText(cds2[1]);
        var lim = cds2[0] ? cds2[0].querySelector("img.eb-col-img") : null, rim = cds2[1] ? cds2[1].querySelector("img.eb-col-img") : null;
        b.leftSrc = lim ? (lim.getAttribute("data-eb-src") || "") : ""; b.leftSlot = lim ? (lim.getAttribute("data-eb-slot") || "") : ""; b.leftAlt = lim ? (lim.getAttribute("alt") || "") : "";
        b.rightSrc = rim ? (rim.getAttribute("data-eb-src") || "") : ""; b.rightSlot = rim ? (rim.getAttribute("data-eb-slot") || "") : ""; b.rightAlt = rim ? (rim.getAttribute("alt") || "") : "";
      }
      else if (t === "faq") { b.items = []; var dts2 = el.querySelectorAll("details"); for (var dq = 0; dq < dts2.length; dq++) { var sq = dts2[dq].querySelector("summary"), aq = dts2[dq].querySelector("div"); var qq = ebText(sq), aa = ebText(aq); if (qq) b.items.push({ q: qq, a: aa }); } }
      else if (t === "image") { b.slot = el.getAttribute("data-eb-slot") || "senioren-zuhause"; b.src = el.getAttribute("data-eb-src") || ""; b.alt = el.getAttribute("alt") || ""; var wm = (el.style.width || "").match(/(\d+)/); b.w = el.getAttribute("data-eb-w") || (wm ? wm[1] : ""); }
      else if (t !== "divider") continue;
      b.align = ebGet(el, "eb-al-", EB_ALIGN, "center"); b.width = ebGet(el, "eb-w-", EB_WIDTHS, "normal");
      b.space = ebGet(el, "eb-sp-", ["small", "large", "normal"], "normal"); b.size = ebGet(el, "eb-fs-", EB_SIZES, "m");
      model.push(b);
    }
    return model;
  }
  function ebSaveZones() {
    var names = Object.keys(dirtyZones), chain = Promise.resolve(), okAll = true;
    names.forEach(function (zn) {
      chain = chain.then(function () {
        var zone = document.querySelector('[data-ed-zone="' + zn + '"]'); if (!zone) { delete dirtyZones[zn]; return; }
        var model = ebSerialize(zone);
        var bad = ebValidateModel(model); // lieber melden als serverseitig still abschneiden
        if (bad) { okAll = false; toast(bad + " – bitte kürzen und erneut speichern.", "err"); return; }
        return call({ action: "save-blocks", file: file, zone: zn, blocks: model })
          .then(function (res) { if (res.ok) delete dirtyZones[zn]; else okAll = false; })
          .catch(function () { okAll = false; }); // eine abgebrochene Anfrage darf die Kette nicht sprengen
      });
    });
    return chain.then(function () { return okAll; });
  }
  function ebSerializeFooter() {
    var out = {}, zones = document.querySelectorAll("[data-foot-zone]");
    for (var i = 0; i < zones.length; i++) {
      var z = zones[i], col = z.getAttribute("data-foot-zone"), arr = [];
      var ls = z.querySelectorAll('[data-eb="flink"]');
      for (var j = 0; j < ls.length; j++) { var t = ebText(ls[j]); if (t) arr.push({ text: t, href: ls[j].getAttribute("href") || "" }); }
      out[col] = arr;
    }
    return out;
  }
  function ebAddFooterLink(zone) {
    ebSnapshot(zone);
    var a = document.createElement("a"); a.href = "#"; a.setAttribute("data-eb", "flink"); a.textContent = "Neuer Link";
    var addBtn = zone.querySelector(".eb-footaddbtn");
    if (addBtn) zone.insertBefore(a, addBtn); else zone.appendChild(a);
    ebEnhance(a); dirtyFooter = true; refreshSaveBtn();
    a.focus(); try { var r = document.createRange(); r.selectNodeContents(a); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e) {}
    ebSelect(a);
  }
  function ebEnhanceFooterZone(zone) {
    var links = zone.querySelectorAll('[data-eb="flink"]');
    for (var i = 0; i < links.length; i++) ebEnhance(links[i]);
    var add = document.createElement("button"); add.type = "button"; add.className = "eb-footaddbtn"; add.textContent = "＋ Link hinzufügen";
    add.onclick = function () { ebAddFooterLink(zone); };
    zone.appendChild(add);
  }
  function ebSaveAll() {
    return ebSaveZones().then(function (zonesOk) {
      if (!dirtyFooter) return zonesOk;
      return call({ action: "save-footer", links: ebSerializeFooter() })
        .then(function (res) { if (res.ok) dirtyFooter = false; return zonesOk && res.ok; })
        .catch(function () { return false; });
    });
  }

  function start() {
    document.documentElement.classList.add("dv-editing"); // Magnetic-Buttons im Editor ruhig halten
    var mg = document.querySelectorAll("[data-magnetic]");
    for (var m0 = 0; m0 < mg.length; m0++) mg[m0].style.transform = "";
    var st = document.createElement("style");
    st.textContent =
      '[data-ed],[data-ed-img]{outline:2px dashed rgba(215,18,10,.55);outline-offset:2px}'
      + '[data-ed]:hover,[data-ed-img]:hover{outline-style:solid;outline-color:#d7120a}'
      + '[data-ed]{cursor:text}[data-ed-img]{cursor:pointer}'
      + '[data-ed][contenteditable]:focus{outline:2px solid #d7120a;background:rgba(215,18,10,.08)}'
      + '#dvBar{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#1c1714;color:#fff;display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;justify-content:center;padding:.6rem 1rem;font:14px system-ui,-apple-system,sans-serif;box-shadow:0 -10px 30px rgba(0,0,0,.35)}'
      + '#dvBar button{border:0;border-radius:999px;padding:.55em 1.25em;font-weight:700;cursor:pointer;font-size:.92rem}'
      + '#dvBar .s{background:#d7120a;color:#fff}#dvBar .x{background:#fff;color:#1c1714}'
      + '#dvBar button:disabled{opacity:.45;cursor:not-allowed}'
      + '#dvBar .m{font-size:.82rem;opacity:.85;flex:1 1 100%;text-align:center;order:-1}'
      + '#dvPanel{position:fixed;inset:0;z-index:2147483646;background:rgba(28,23,20,.55);display:flex;align-items:center;justify-content:center;padding:1rem;font:14px system-ui,-apple-system,sans-serif}'
      + '#dvPanel .box{background:#fff;color:#1c1714;border-radius:14px;max-width:520px;width:100%;max-height:85vh;overflow:auto;padding:1.4rem 1.5rem;box-shadow:0 40px 90px -40px rgba(0,0,0,.6)}'
      + '#dvPanel h3{margin:0 0 .15rem;font-size:1.2rem}#dvPanel .sub{color:#756a60;font-size:.85rem;margin:0 0 .3rem}'
      + '#dvPanel .grp{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a50d07;margin:1.1rem 0 .2rem}'
      + '#dvPanel label{display:block;font-size:.78rem;color:#756a60;margin:.5rem 0 .12rem}'
      + '#dvPanel input{width:100%;padding:.5rem .6rem;border:1px solid rgba(28,23,20,.18);border-radius:8px;font:inherit}'
      + '#dvPanel .row{display:flex;gap:.6rem;justify-content:flex-end;margin-top:1.2rem;position:sticky;bottom:-1px;background:#fff;padding:.7rem 0}'
      + '#dvPanel button{border:0;border-radius:999px;padding:.6em 1.3em;font-weight:700;cursor:pointer}'
      + '#dvPanel .ok{background:#d7120a;color:#fff}#dvPanel .cancel{background:#eee;color:#1c1714}'
      + '#dvPanel textarea{width:100%;padding:.5rem .6rem;border:1px solid rgba(28,23,20,.18);border-radius:8px;font:inherit;resize:vertical;min-height:66px}'
      + '#dvPanel .hint{display:flex;justify-content:space-between;font-size:.72rem;color:#a0968c;margin:.16rem 0 .1rem}'
      + '[data-ed-zone]{position:relative;min-height:0}'
      + '.eb-add{display:inline-flex;gap:.4em;margin:1.4rem auto;border:0;border-radius:999px;background:#1c1714;color:#fff;font-weight:700;font-size:.82rem;padding:.55em 1.15em;cursor:pointer}'
      + '#dvPanel select{width:100%;padding:.5rem .6rem;border:1px solid rgba(28,23,20,.18);border-radius:8px;font:inherit;margin-top:.3rem}'
      + '#dvPanel .eb-add-row{display:flex;gap:.5rem;flex-wrap:wrap;margin:.5rem 0 .2rem}'
      + '#dvPanel .eb-add-row button{background:#f0e9e0;color:#1c1714;border-radius:999px;padding:.5em 1em;font-weight:700;font-size:.85rem}'
      + '#dvPanel .eb-row{border:1px solid rgba(28,23,20,.14);border-radius:10px;padding:.6rem .7rem;margin:.55rem 0;background:#faf6f0}'
      + '#dvPanel .eb-row .t{display:flex;gap:.4rem;align-items:center;margin-bottom:.35rem}'
      + '#dvPanel .eb-row .t b{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:#a50d07;flex:1}'
      + '#dvPanel .eb-row .t button{background:#eee;border-radius:7px;width:28px;height:28px;cursor:pointer;font-size:.9rem;padding:0}'
      + '#dvPanel .eb-imgrow{display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin:.4rem 0 .1rem}'
      + '#dvPanel .eb-imgrow button{background:#f0e9e0;color:#1c1714;border-radius:999px;padding:.42em .95em;font-weight:700;font-size:.8rem;cursor:pointer}'
      + '#dvPanel .eb-al-ctl{display:inline-flex;gap:.15rem;margin-right:.3rem}'
      + '#dvPanel .eb-al-ctl button{background:#eee;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:.8rem;padding:0;color:#756a60}'
      + '#dvPanel .eb-al-ctl button.on{background:#d7120a;color:#fff}'
      + '#dvPanel .eb-lay{display:flex;gap:.4rem;align-items:center;font-size:.72rem;color:#a0968c;margin:.35rem 0}'
      + '#dvPanel .eb-lay select{width:auto;flex:1;padding:.3rem .4rem;font-size:.8rem}'
      + '#dvPanel .eb-imgprev{position:relative;max-width:100%;margin:.45rem 0;min-width:64px}'
      + '#dvPanel .eb-imgprev img{width:100%;display:block;border-radius:8px;border:1px solid rgba(28,23,20,.15)}'
      + '#dvPanel .eb-imgh{position:absolute;right:-7px;bottom:-7px;width:18px;height:18px;background:#d7120a;border:2px solid #fff;border-radius:50%;cursor:nwse-resize;touch-action:none;box-shadow:0 1px 4px rgba(0,0,0,.3)}'
      + '#dvPanel .eb-imgpct{position:absolute;left:5px;bottom:5px;background:rgba(0,0,0,.6);color:#fff;font-size:.68rem;padding:.1em .45em;border-radius:6px}'
      + '.eb-libov{position:fixed;inset:0;z-index:2147483647;background:rgba(28,23,20,.6);display:flex;align-items:center;justify-content:center;padding:1rem;font:14px system-ui,sans-serif}'
      + '.eb-libbox{background:#fff;color:#1c1714;border-radius:14px;max-width:560px;width:100%;max-height:82vh;overflow:auto;padding:1.3rem 1.4rem}'
      + '.eb-libbox h4{margin:0 0 .7rem}.eb-libbox .row{display:flex;justify-content:flex-end;margin-top:.9rem}'
      + '.eb-libbox .cancel{background:#eee;border:0;border-radius:999px;padding:.55em 1.3em;font-weight:700;cursor:pointer}'
      + '.eb-libgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:.5rem}'
      + '.eb-libgrid img{width:100%;height:78px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid transparent}'
      + '.eb-libgrid img:hover{border-color:#d7120a}'
      // Bearbeitungs-Komfort: geänderte Felder markieren, Toasts, Standort-Editor
      + '[data-ed].dv-changed,[data-ed-rich].dv-changed,[data-ed-img].dv-changed{outline:2px solid #e8a400 !important;outline-offset:2px;background:rgba(232,164,0,.12)}'
      + '#dvBar .s.has-changes{box-shadow:0 0 0 3px rgba(232,164,0,.5)}'
      + '.dv-toast{position:fixed;left:50%;bottom:76px;transform:translate(-50%,14px);z-index:2147483647;background:#2a2320;color:#fff;padding:.72rem 1.1rem;border-radius:12px;font:14px system-ui,-apple-system,sans-serif;line-height:1.4;max-width:min(92vw,460px);box-shadow:0 18px 45px -15px rgba(0,0,0,.65);opacity:0;transition:opacity .25s,transform .25s;text-align:center;pointer-events:none}'
      + '.dv-toast.show{opacity:1;transform:translate(-50%,0)}'
      + '.dv-toast.ok{background:#237a16}.dv-toast.err{background:#b3140c}'
      + '#dvPanel .pl-list{margin:.4rem 0 .2rem}'
      + '#dvPanel .pl-row{display:flex;gap:.35rem;align-items:center;margin:.32rem 0}'
      + '#dvPanel .pl-row input{flex:1;margin:0}'
      + '#dvPanel .pl-row button{background:#eee;border:0;border-radius:7px;width:32px;height:34px;cursor:pointer;font-size:.9rem;padding:0;flex:none;font-weight:700}'
      + '#dvPanel .pl-add{background:#f0e9e0;color:#1c1714;border:0;border-radius:999px;padding:.5em 1.1em;font-weight:700;cursor:pointer;margin-top:.5rem}'
      // Onboarding-/Hilfe-Overlay
      + '.dv-guide{position:fixed;inset:0;z-index:2147483647;background:rgba(28,23,20,.62);display:flex;align-items:center;justify-content:center;padding:1rem;font:15px/1.55 system-ui,-apple-system,sans-serif}'
      + '.dv-guide__box{background:#fff;color:#1c1714;border-radius:18px;max-width:560px;width:100%;max-height:88vh;overflow:auto;padding:1.6rem 1.7rem;box-shadow:0 50px 100px -40px rgba(0,0,0,.7)}'
      + '.dv-guide__box h3{margin:0 0 .2rem;font-size:1.4rem}'
      + '.dv-guide__box .lead{color:#756a60;margin:0 0 1rem;font-size:.95rem}'
      + '.dv-guide__step{display:flex;gap:.8rem;align-items:flex-start;padding:.62rem 0;border-top:1px solid rgba(28,23,20,.1)}'
      + '.dv-guide__step .ic{flex:none;width:34px;height:34px;border-radius:9px;background:rgba(215,18,10,.1);display:grid;place-items:center;font-size:1.05rem}'
      + '.dv-guide__step b{display:block;margin-bottom:.08rem;font-size:.98rem}'
      + '.dv-guide__step span{color:#5f564e;font-size:.9rem}'
      + '.dv-guide__foot{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin-top:1.2rem;flex-wrap:wrap}'
      + '.dv-guide__foot .hint{color:#a0968c;font-size:.82rem;flex:1;min-width:150px}'
      + '.dv-guide__box .go{background:#d7120a;color:#fff;border:0;border-radius:999px;padding:.7em 1.6em;font-weight:700;font-size:1rem;cursor:pointer}'
      // Inline-Element-System: subtiles "+" mit Fächer, Kontext-Leiste
      + '.eb-adder{position:relative;display:flex;flex-direction:column;align-items:center;margin:1rem auto .2rem;width:100%}'
      + '.eb-plus{position:relative;z-index:2;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:#d7120a;color:#fff;border:0;font-size:1.5rem;line-height:1;cursor:pointer;box-shadow:0 8px 20px -8px rgba(215,18,10,.65);transition:transform .18s,opacity .18s;opacity:.5}'
      + '.eb-adder:hover .eb-plus,.eb-adder.open .eb-plus{opacity:1;transform:scale(1.08)}'
      // Halbkreis-Fächer: Buttons fahren aus der Mitte auf einen Bogen über dem "+"
      + '.eb-fan{position:absolute;left:50%;top:50%;width:0;height:0;z-index:3}'
      + '.eb-fan button{position:absolute;left:0;top:0;width:62px;height:62px;margin:-31px 0 0 -31px;display:grid;place-items:center;align-content:center;gap:2px;background:#fff;color:#1c1714;border:1px solid rgba(28,23,20,.16);border-radius:15px;cursor:pointer;box-shadow:0 10px 24px -10px rgba(0,0,0,.5);opacity:0;visibility:hidden;transform:translate(0,0) scale(.3);pointer-events:none;transition:transform .32s cubic-bezier(.2,.9,.3,1),opacity .22s,visibility .22s,border-color .12s,color .12s;padding:0}'
      + '.eb-adder.open .eb-fan button{opacity:1;visibility:visible;transform:translate(var(--x),var(--y)) scale(1);pointer-events:auto}'
      + '.eb-fan button:hover{border-color:#d7120a;color:#d7120a}'
      + '.eb-fan button .ei{font-size:1.05rem;font-weight:800;line-height:1}'
      + '.eb-fan button .el{font-size:.52rem;font-weight:800;line-height:1.05;letter-spacing:.01em;max-width:56px;text-align:center;overflow-wrap:anywhere}'
      // ✕ pro Listenpunkt (nur im Editor, erscheint beim Überfahren)
      + '.eb-li-x{border:0;background:rgba(215,18,10,.14);color:#d7120a;border-radius:50%;width:20px;height:20px;font-size:.58rem;line-height:1;cursor:pointer;padding:0;margin-left:.45em;opacity:0;transition:opacity .15s;vertical-align:middle;font-weight:700}'
      + 'li:hover > .eb-li-x,li:focus-within > .eb-li-x{opacity:1}'
      // Touch-Geräte haben kein Hover -> ✕ und FAQ-Löschen dauerhaft zeigen
      + '@media (hover:none){.eb-li-x{opacity:.85}.eb-faq-x{opacity:.85}}'
      + '.eb-faq__item{position:relative}'
      + '.eb-faq-x{position:absolute;top:.35rem;right:.35rem;border:0;background:rgba(215,18,10,.14);color:#d7120a;border-radius:50%;width:20px;height:20px;font-size:.6rem;line-height:1;cursor:pointer;padding:0;opacity:0;transition:opacity .15s;font-weight:700;z-index:2}'
      + '.eb-faq__item:hover > .eb-faq-x,.eb-faq__item:focus-within > .eb-faq-x{opacity:1}'
      // Bottom-Bar überdeckt sonst den Seitenfuß (Footer-Zonen)
      + 'html.dv-editing body{padding-bottom:180px}'
      + '.eb-zone [data-eb]{transition:outline .12s}'
      + '.eb-zone [data-eb][contenteditable]:hover{outline:2px dashed rgba(215,18,10,.35);outline-offset:3px}'
      + '.eb-zone [data-eb].eb-active{outline:2px solid #d7120a;outline-offset:3px}'
      + '#ebCtx{position:fixed;top:0;left:0;z-index:2147483646;background:#fff;border:1px solid rgba(28,23,20,.18);border-top:3px solid #d7120a;border-radius:13px;box-shadow:0 10px 26px -8px rgba(215,18,10,.42),0 26px 60px -22px rgba(0,0,0,.6);display:none;gap:.3rem;align-items:center;padding:.5rem .6rem;flex-wrap:wrap;max-width:min(94vw,560px);font:13px system-ui,-apple-system,sans-serif}'
      + '#ebCtx.show{display:flex;animation:ebCtxPop .24s cubic-bezier(.2,.9,.3,1)}'
      + '@keyframes ebCtxPop{from{opacity:0;transform:translateY(8px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}'
      + '#ebCtx button{background:#f0e9e0;color:#1c1714;border:0;border-radius:8px;min-width:32px;height:30px;padding:0 .55em;cursor:pointer;font-weight:700;font-size:.85rem}'
      + '#ebCtx button:hover{background:#e7ddcf}#ebCtx button.on{background:#d7120a;color:#fff}'
      + '#ebCtx .lbl{font-weight:800;color:#a50d07;font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;margin-right:.15rem}'
      + '#ebCtx .sep{width:1px;height:22px;background:rgba(28,23,20,.14);margin:0 .18rem}'
      + '#ebCtx input{border:1px solid rgba(28,23,20,.2);border-radius:7px;padding:.32em .5em;font:inherit;width:170px}'
      + '#ebCtx input[data-a="altL"],#ebCtx input[data-a="altR"]{width:118px}'
      + '#ebCtx .lbl2{font-size:.68rem;font-weight:800;color:#756a60;text-transform:uppercase;letter-spacing:.04em}'
      // Leistungs-Kachel: Einblend-Animation, bearbeitbare Felder, Hinzufügen-Slot
      + '@keyframes ebCardIn{from{opacity:0;transform:scale(.82) translateY(12px)}to{opacity:1;transform:none}}'
      + '.eb-card-in{animation:ebCardIn .55s cubic-bezier(.2,.8,.3,1)}'
      + '[data-eb="card"]{cursor:default}'
      + '[data-eb="card"] [data-cf][contenteditable]:hover{outline:2px dashed rgba(215,18,10,.4);outline-offset:2px}'
      + '[data-eb="card"].eb-active{outline:2px solid #d7120a;outline-offset:4px}'
      + '.eb-adder--card{border:2px dashed rgba(215,18,10,.45);border-radius:16px;min-height:150px;width:auto;margin:0;justify-content:center;gap:.35rem}'
      + '.eb-adder--card .eb-plus{opacity:.9}'
      // Footer-Link-Editor
      + '.eb-footaddbtn{background:transparent;border:1px dashed rgba(215,18,10,.55);color:#d7120a;border-radius:8px;padding:.28em .7em;font-size:.78rem;font-weight:700;cursor:pointer;margin-top:.35rem;align-self:flex-start}'
      + '.eb-footaddbtn:hover{background:rgba(215,18,10,.09)}'
      + '[data-eb="flink"]{cursor:text}'
      + '[data-eb="flink"].eb-active{outline:2px solid #d7120a;outline-offset:2px;border-radius:3px}'
      + '#dvPanel .dv-menurow{display:flex;gap:.35rem;margin:.32rem 0;align-items:center}'
      + '#dvPanel .dv-menurow input{margin:0}#dvPanel .dv-menurow .mt{flex:0 0 38%}#dvPanel .dv-menurow .mh{flex:1}'
      + '#dvPanel .dv-menurow .mx{background:#eee;border:0;border-radius:7px;width:30px;height:32px;cursor:pointer;flex:none;font-weight:700}';
    document.head.appendChild(st);

    var picker = document.createElement("input");
    picker.type = "file"; picker.accept = "image/jpeg,image/png,image/webp"; picker.style.display = "none";
    document.body.appendChild(picker);
    var target = null, slot = null;
    picker.addEventListener("change", function () {
      var f = picker.files[0]; if (!f || !target) return;
      var im = new Image(), url = URL.createObjectURL(f);
      im.onload = function () {
        var max = 1400, w = im.width, h = im.height; if (w > max) { h = Math.round(h * max / w); w = max; }
        var c = document.createElement("canvas"); c.width = w; c.height = h; c.getContext("2d").drawImage(im, 0, 0, w, h);
        var du = c.toDataURL("image/jpeg", 0.82); target.src = du; pending[slot] = du.split(",")[1];
        URL.revokeObjectURL(url); markChanged(target); msg("Neues Bild gewählt – bitte speichern.");
      };
      im.src = url;
    });

    function noEnter(e) { if (e.key === "Enter") e.preventDefault(); }
    // Reine Text-Felder editierbar machen (flatten entfernt Lauf-Spans wie reveal-words)
    var eds = document.querySelectorAll("[data-ed]");
    for (var i = 0; i < eds.length; i++) {
      var el = eds[i];
      try { el.textContent = el.textContent; } catch (e) {}
      el.setAttribute("contenteditable", "true"); el.setAttribute("spellcheck", "false");
      el.title = "Klicken zum Bearbeiten";
      el.addEventListener("keydown", noEnter);
      el.addEventListener("beforeinput", function () { ebTypeSnapshot(this); });
      el.addEventListener("paste", ebPastePlain);
      el.addEventListener("input", function () { markChanged(this); });
    }
    // Rich-Felder (Absätze mit Links/Fett) editierbar machen – Tags bleiben erhalten
    var rds = document.querySelectorAll("[data-ed-rich]");
    for (var r0 = 0; r0 < rds.length; r0++) {
      var rel = rds[r0];
      rel.setAttribute("contenteditable", "true"); rel.setAttribute("spellcheck", "false");
      rel.title = "Klicken zum Bearbeiten";
      rel.addEventListener("keydown", noEnter);
      rel.addEventListener("beforeinput", function () { ebTypeSnapshot(this); });
      rel.addEventListener("paste", ebPastePlain);
      rel.addEventListener("input", function () { markChanged(this); });
    }
    // Bilder: Tippen = ersetzen (nur echte Klicks, isTrusted), Ziehen = Ausschnitt verschieben.
    function clampPct(v) { return v < 0 ? 0 : v > 100 ? 100 : v; }
    var imgs = document.querySelectorAll("[data-ed-img]");
    for (var j = 0; j < imgs.length; j++) {
      (function (img) {
        img.title = "Tippen: Bild ersetzen · Ziehen: Ausschnitt positionieren";
        img.style.cursor = "move"; img.style.touchAction = "none";
        var sx, sy, px, py, dragging = false, didDrag = false;
        img.addEventListener("pointerdown", function (e) {
          if (!e.isTrusted) return;
          dragging = true; didDrag = false; sx = e.clientX; sy = e.clientY;
          var p = (img.style.objectPosition || "50% 50%").split(/\s+/);
          px = parseFloat(p[0]); py = parseFloat(p[1]); if (isNaN(px)) px = 50; if (isNaN(py)) py = 50;
          try { img.setPointerCapture(e.pointerId); } catch (_e) {}
        });
        img.addEventListener("pointermove", function (e) {
          if (!dragging) return;
          var dx = e.clientX - sx, dy = e.clientY - sy;
          if (!didDrag && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) didDrag = true;
          if (!didDrag) return;
          var nx = clampPct(px - dx / (img.clientWidth || 1) * 100);
          var ny = clampPct(py - dy / (img.clientHeight || 1) * 100);
          img.style.objectPosition = nx + "% " + ny + "%";
          pendingPos[img.getAttribute("data-ed-img")] = Math.round(nx) + "% " + Math.round(ny) + "%";
        });
        img.addEventListener("pointerup", function () { if (dragging && didDrag) { markChanged(img); msg("Bildausschnitt geändert – bitte speichern."); } dragging = false; });
        img.addEventListener("click", function (e) {
          if (!e.isTrusted) return;
          e.preventDefault(); e.stopPropagation();
          if (didDrag) { didDrag = false; return; } // war ein Ziehen -> NICHT ersetzen
          target = img; slot = img.getAttribute("data-ed-img"); picker.value = ""; picker.click();
        });
      })(imgs[j]);
    }
    // Frei-Element-Zonen: pro Zone einen Verwalten-Button einfügen
    var zones = document.querySelectorAll("[data-ed-zone]");
    for (var z = 0; z < zones.length; z++) ebEnhanceZone(zones[z]);
    var fzones = document.querySelectorAll("[data-foot-zone]");
    for (var fz = 0; fz < fzones.length; fz++) ebEnhanceFooterZone(fzones[fz]);
    // Kontext-Leiste ausblenden, wenn außerhalb eines Elements/der Leiste geklickt wird
    document.addEventListener("mousedown", function (e) {
      // offene Fächer schließen, wenn daneben getippt/geklickt wird (Touch hat kein mouseleave)
      var inAdder = e.target.closest && e.target.closest(".eb-adder");
      var open = document.querySelectorAll(".eb-adder.open");
      for (var o = 0; o < open.length; o++) if (open[o] !== inAdder) open[o].classList.remove("open");
      if (e.target.closest && (e.target.closest("[data-eb]") || e.target.closest("#ebCtx") || inAdder)) return;
      ebHideCtx();
    }, true);
    var ebReposition = function () { if (ebActive && ebCtx && ebCtx.classList.contains("show")) ebPositionCtx(ebActive); };
    window.addEventListener("scroll", ebReposition, true);
    window.addEventListener("resize", ebReposition);

    // Links sollen im Edit-Modus NICHT navigieren, wenn sie editierbaren Inhalt enthalten
    // (Karten-Links) oder selbst in einem Rich-Feld liegen (Link-Text bearbeitbar).
    // Echte Menü-/Nav-Links funktionieren weiter normal.
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      if (a.closest("[data-ed-rich]") || a.querySelector("[data-ed],[data-ed-img]") || a.hasAttribute("data-eb")) e.preventDefault();
    }, true);

    var bar = document.createElement("div"); bar.id = "dvBar";
    var hasRoute = !!document.getElementById("route");
    bar.innerHTML = '<span class="m" id="dvMsg">Bearbeitungsmodus aktiv · Text/Bild anklicken &amp; ändern · Strg+S speichert · andere Seiten über das Menü</span>'
      + '<button class="s" id="dvSave">💾 Diese Seite speichern</button>'
      + '<button class="x" id="dvUndo" disabled>↩ Rückgängig</button>'
      + '<button class="x" id="dvRedo" disabled>↪ Wiederherstellen</button>'
      + '<button class="x" id="dvSeo">🔍 SEO &amp; Titel</button>'
      + '<button class="x" id="dvShared">🧭 Menü &amp; Footer</button>'
      + (hasRoute ? '<button class="x" id="dvPlaces">📍 Standorte</button>' : '')
      + '<button class="x" id="dvGuideBtn">❓ Hilfe</button>'
      + '<button class="x" id="dvReload">🔄 Aktualisieren</button>'
      + '<button class="x" id="dvExit">🚪 Verlassen</button>';
    document.body.appendChild(bar);
    var leaving = false;
    document.getElementById("dvSave").addEventListener("click", save);
    document.getElementById("dvSeo").addEventListener("click", openSeo);
    document.getElementById("dvShared").addEventListener("click", openShared);
    if (hasRoute) document.getElementById("dvPlaces").addEventListener("click", openPlaces);
    document.getElementById("dvGuideBtn").addEventListener("click", openGuide);
    // Cache umgehen + frisch laden (GitHub Pages cached Seiten einige Minuten)
    document.getElementById("dvReload").addEventListener("click", function () {
      if (hasUnsaved() && !window.confirm("Es gibt ungespeicherte Änderungen. Wirklich neu laden? Die Änderungen gehen dann verloren.")) return;
      leaving = true; location.href = location.pathname + "?r=" + Date.now();
    });
    document.getElementById("dvExit").addEventListener("click", function () {
      if (hasUnsaved() && !window.confirm("Es gibt ungespeicherte Änderungen. Wirklich verlassen? Die Änderungen gehen dann verloren.")) return;
      leaving = true;
      localStorage.removeItem(FLAG); localStorage.removeItem(PWK); localStorage.removeItem(TSK);
      location.href = location.pathname; // ohne Cache-Buster, normaler Stand
    });
    // Strg/Cmd+S speichert; Warnung vor Datenverlust beim ungewollten Verlassen
    document.getElementById("dvUndo").addEventListener("click", ebUndo);
    document.getElementById("dvRedo").addEventListener("click", ebRedo);
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) { e.preventDefault(); save(); }
      if (!(e.ctrlKey || e.metaKey)) return;
      var ae = document.activeElement;
      // Panel-Eingabefelder behalten ihr eigenes Undo; Seiten-/Element-Texte laufen über unser einheitliches Undo.
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) return;
      // Strg+Z = rückgängig · Strg+Umschalt+Z bzw. Strg+Y = wiederherstellen
      if (!e.shiftKey && (e.key === "z" || e.key === "Z")) { e.preventDefault(); ebUndo(); }
      else if ((e.shiftKey && (e.key === "z" || e.key === "Z")) || e.key === "y" || e.key === "Y") { e.preventDefault(); ebRedo(); }
    });
    window.addEventListener("beforeunload", function (e) { if (!leaving && hasUnsaved()) { e.preventDefault(); e.returnValue = ""; } });
    refreshSaveBtn(); refreshUndoBtn();
    var seenGuide = false; try { seenGuide = sessionStorage.getItem("dv_guide_seen") === "1"; } catch (e) {}
    if (!seenGuide) { openGuide(); try { sessionStorage.setItem("dv_guide_seen", "1"); } catch (e) {} }
    else { toast("Bearbeitungsmodus aktiv. Text/Bild anklicken & ändern. ❓ Hilfe unten erklärt alles. Speichern: Strg+S.", ""); }
  }

  // Geteilte Menü-/Footer-Beschriftungen bearbeiten (Panel) -> save-shared -> alle Seiten
  var SHARED_ORDER = [
    ["Menü", ["lbl-start", "Start"], ["lbl-senioren", "Seniorenbetreuung"], ["lbl-haushalt", "Haushaltshilfe"], ["lbl-verhinderung", "Verhinderungspflege"], ["lbl-stellen", "Stellenangebote"], ["lbl-kontakt", "Kontakt (mobil)"]],
    ["Menü-Dropdown", ["lbl-uebersicht", "Übersicht"], ["lbl-entlastung", "Entlastungsbetrag"], ["lbl-pflege", "Pflegesachleistungen"]],
    ["Buttons", ["lbl-termin", "Termin buchen"]],
    ["Footer-Überschriften", ["lbl-foot-leistungen", "Leistungen"], ["lbl-foot-informationen", "Informationen"], ["lbl-foot-kontakt", "Kontakt"]],
    ["Footer-Links", ["lbl-galabau", "de Vries GaLa-Bau"], ["lbl-impressum", "Impressum"], ["lbl-datenschutz", "Datenschutz"], ["lbl-kontaktformular", "Kontaktformular"]],
    ["Menü-Gruppen (mobil)", ["lbl-grp-leistungen", "Gruppe: Leistungen"], ["lbl-grp-mehr", "Gruppe: Mehr"]],
    ["Footer-Adresse & Öffnungszeiten", ["foot-addr-street", "Straße & Hausnr."], ["foot-addr-city", "PLZ & Ort"], ["foot-hours-label", "Überschrift (z. B. Öffnungszeiten)"], ["foot-hours-days", "Tage (z. B. Montag – Freitag)"], ["foot-hours-time", "Uhrzeit (z. B. 8:00 bis 16:00 Uhr)"]],
    ["Kontaktdaten (auf allen Seiten)", ["contact-phone", "Telefon (ändert Anzeige + Anruf-Link)"], ["contact-email", "E-Mail (ändert Anzeige + Mail-Link)"]]
  ];
  function openShared() {
    if (document.getElementById("dvPanel")) return;
    var vals = {};
    var nodes = document.querySelectorAll("[data-eds]");
    for (var i = 0; i < nodes.length; i++) { var k = nodes[i].getAttribute("data-eds"); if (!(k in vals)) vals[k] = nodes[i].textContent.trim(); }
    var html = '<div class="box"><h3>Menü &amp; Footer bearbeiten</h3><p class="sub">Änderungen gelten automatisch auf <b>allen Seiten</b>.</p>';
    for (var g = 0; g < SHARED_ORDER.length; g++) {
      var grp = SHARED_ORDER[g], shown = "";
      for (var j = 1; j < grp.length; j++) {
        var key = grp[j][0]; if (!(key in vals)) continue;
        if (!shown) { html += '<div class="grp">' + grp[0] + "</div>"; shown = "1"; }
        html += '<label>' + grp[j][1] + '</label><input data-k="' + key + '">';
      }
    }
    html += '<div class="grp">Eigene Menüpunkte</div><p class="sub" style="margin:-.1rem 0 .35rem">Zusätzliche Links im Menü (oben &amp; mobil) – gelten auf allen Seiten. Max. 8.</p><div id="dvMenuList"></div><button type="button" class="eb-footaddbtn" id="dvMenuAdd" style="margin-top:.25rem">＋ Menüpunkt</button>';
    html += '<div class="row"><button class="cancel" id="dvPx">Abbrechen</button><button class="ok" id="dvPok">Übernehmen</button></div></div>';
    var wrap = document.createElement("div"); wrap.id = "dvPanel"; wrap.innerHTML = html;
    document.body.appendChild(wrap);
    var inputs = wrap.querySelectorAll("input[data-k]");
    for (var n = 0; n < inputs.length; n++) { inputs[n].value = vals[inputs[n].getAttribute("data-k")] || ""; }
    var menuList = document.getElementById("dvMenuList");
    function menuRow(text, href) {
      var d = document.createElement("div"); d.className = "dv-menurow";
      d.innerHTML = '<input class="mt" maxlength="40" placeholder="Menüname"><input class="mh" maxlength="200" placeholder="Ziel, z. B. kontakt.html"><button type="button" class="mx" title="entfernen">✕</button>';
      d.querySelector(".mt").value = text || ""; d.querySelector(".mh").value = href || "";
      d.querySelector(".mx").onclick = function () { d.remove(); };
      menuList.appendChild(d);
    }
    document.getElementById("dvMenuAdd").onclick = function () { menuRow("", ""); };
    fetch("menu.json", { cache: "no-cache" }).then(function (r) { return r.ok ? r.json() : []; }).then(function (list) {
      if (Array.isArray(list)) list.forEach(function (m) { if (m && m.text) menuRow(m.text, m.href); });
    }).catch(function () {});
    function close() { wrap.remove(); }
    document.getElementById("dvPx").addEventListener("click", close);
    wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });
    document.getElementById("dvPok").addEventListener("click", function () {
      var shared = {}, ins = wrap.querySelectorAll("input[data-k]");
      for (var m = 0; m < ins.length; m++) { shared[ins[m].getAttribute("data-k")] = ins[m].value.replace(/\s+/g, " ").trim(); }
      var menuItems = [], rows = wrap.querySelectorAll(".dv-menurow");
      for (var mi = 0; mi < rows.length; mi++) { var mt = rows[mi].querySelector(".mt").value.replace(/\s+/g, " ").trim(), mh = rows[mi].querySelector(".mh").value.trim(); if (mt && mh) menuItems.push({ text: mt, href: mh }); }
      var ok = document.getElementById("dvPok"); ok.disabled = true; ok.textContent = "Speichert …";
      call({ action: "save-shared", shared: shared }).then(function (res) {
        var sharedFine = res.ok || (res.status === 400 && res.d && res.d.error === "marker_missing"); // keine Label-Änderung ist ok
        if (!sharedFine) { ok.disabled = false; ok.textContent = "Übernehmen"; msg(res.status === 401 ? "Falsches Passwort – über /admin neu anmelden." : "Fehler: " + (res.d.error || res.status)); return; }
        call({ action: "save-menu", items: menuItems }).then(function (r2) {
          if (r2.ok) { close(); msg("✓ Menü/Footer gespeichert (alle Seiten) – Neuaufbau ~1–3 Min, dann auf Aktualisieren klicken."); toast("✓ Menü & Footer gespeichert (alle Seiten). Neuaufbau in ~1-3 Min.", "ok"); }
          else { ok.disabled = false; ok.textContent = "Übernehmen"; toast(r2.status === 401 ? "Falsches Passwort – neu anmelden." : "Menüpunkte-Fehler: " + ((r2.d && r2.d.error) || r2.status), "err"); }
        }).catch(function () { ok.disabled = false; ok.textContent = "Übernehmen"; toast("Verbindungsfehler.", "err"); });
      }).catch(function () { ok.disabled = false; ok.textContent = "Übernehmen"; msg("Verbindungsfehler."); });
    });
  }

  // Frei hinzufügbare Elemente (Buttons/Überschriften/Text) einer Zone verwalten -> save-blocks
  function openBlocks(zoneEl) {
    if (document.getElementById("dvPanel")) return;
    var zone = zoneEl.getAttribute("data-ed-zone");
    // Verfügbare Bild-Slots (müssen serverseitig in IMG_SLOTS existieren).
    var EB_SLOTS = [["senioren-zuhause", "Senioren zuhause"], ["senioren-familie", "Familie / Team"], ["senioren-pflege", "Pflege"], ["senioren-entlastung", "Entlastung"], ["haushalt-alltag", "Haushalt: Alltag"], ["haushalt-reinigung", "Haushalt: Reinigung"], ["hero", "Hero-Bild"]];
    var EB_SLOT_IMG = { "hero": "assets/img/senioren-zuhause.jpg", "senioren-zuhause": "assets/img/senioren-zuhause.jpg", "senioren-familie": "assets/img/senioren-familie.jpg", "senioren-pflege": "assets/img/senioren-pflege.jpg", "senioren-entlastung": "assets/img/senioren-entlastung.jpg", "haushalt-alltag": "assets/img/haushalt-alltag.jpg", "haushalt-reinigung": "assets/img/haushalt-reinigung.jpg" };
    var model = [];
    var ebs = zoneEl.querySelectorAll("[data-eb]");
    for (var i = 0; i < ebs.length; i++) {
      var el = ebs[i], t = el.getAttribute("data-eb");
      if (t === "button") model.push({ type: "button", text: el.textContent.trim(), href: el.getAttribute("href") || "", variant: el.classList.contains("btn--ghost") ? "ghost" : "solid" });
      else if (t === "heading") model.push({ type: "heading", text: el.textContent.trim() });
      else if (t === "text") model.push({ type: "text", text: el.textContent.trim() });
      else if (t === "quote") model.push({ type: "quote", text: el.textContent.trim() });
      else if (t === "divider") model.push({ type: "divider" });
      else if (t === "list") { var items = [], lis = el.querySelectorAll("li"); for (var q = 0; q < lis.length; q++) items.push(lis[q].textContent.trim()); model.push({ type: "list", text: items.join("\n") }); }
      else if (t === "image") model.push({ type: "image", slot: el.getAttribute("data-eb-slot") || "senioren-zuhause", src: el.getAttribute("data-eb-src") || "", alt: el.getAttribute("alt") || "", w: el.getAttribute("data-eb-w") || "" });
      else if (t === "columns") { var cd = el.children; model.push({ type: "columns", left: cd[0] ? cd[0].textContent.trim() : "", right: cd[1] ? cd[1].textContent.trim() : "" }); }
      else if (t === "faq") { var qa = [], dts = el.querySelectorAll("details"); for (var w = 0; w < dts.length; w++) { var su = dts[w].querySelector("summary"), dv = dts[w].querySelector("div"); qa.push(((su ? su.textContent.trim() : "") + " | " + (dv ? dv.textContent.trim() : ""))); } model.push({ type: "faq", text: qa.join("\n") }); }
      if (model.length) { var mm = model[model.length - 1]; mm.align = el.classList.contains("eb-al-left") ? "left" : el.classList.contains("eb-al-right") ? "right" : "center"; mm.width = el.classList.contains("eb-w-narrow") ? "narrow" : el.classList.contains("eb-w-wide") ? "wide" : el.classList.contains("eb-w-full") ? "full" : "normal"; mm.space = el.classList.contains("eb-sp-small") ? "small" : el.classList.contains("eb-sp-large") ? "large" : "normal"; }
    }
    var wrap = document.createElement("div"); wrap.id = "dvPanel"; document.body.appendChild(wrap);
    // Bild-Upload für Bild-Blöcke (einmalig erzeugt, überlebt Re-Render)
    var imgPicker = document.createElement("input");
    imgPicker.type = "file"; imgPicker.accept = "image/jpeg,image/png,image/webp"; imgPicker.style.display = "none";
    document.body.appendChild(imgPicker);
    var upIdx = -1;
    imgPicker.addEventListener("change", function () {
      var f = imgPicker.files && imgPicker.files[0], idx = upIdx; imgPicker.value = "";
      if (!f || idx < 0) return;
      if (f.size > 3000000) { var s0 = wrap.querySelector('[data-img-state="' + idx + '"]'); if (s0) s0.textContent = "Bild zu groß (max 3 MB)"; return; }
      var st = wrap.querySelector('[data-img-state="' + idx + '"]'); if (st) st.textContent = "lädt hoch …";
      var reader = new FileReader();
      reader.onload = function () {
        var b64 = String(reader.result || "").split(",")[1] || ""; if (!b64) { if (st) st.textContent = "Fehler"; return; }
        call({ action: "upload-block-image", dataBase64: b64 }).then(function (res) {
          if (res.ok && res.d && res.d.src) { sync(); model[idx].src = res.d.src; render(); }
          else if (st) st.textContent = "Upload-Fehler (" + ((res.d && res.d.error) || res.status) + ")";
        }).catch(function () { if (st) st.textContent = "Verbindungsfehler"; });
      };
      reader.readAsDataURL(f);
    });
    function closePanel() { wrap.remove(); imgPicker.remove(); }
    function openLibPicker(idx) {
      var ov = document.createElement("div"); ov.className = "eb-libov";
      ov.innerHTML = '<div class="eb-libbox"><h4>Mediathek &ndash; Bild wählen</h4><div class="eb-libgrid">lädt …</div><div class="row"><button class="cancel" type="button" id="ebLibX">Schließen</button></div></div>';
      wrap.appendChild(ov);
      var grid = ov.querySelector(".eb-libgrid");
      document.getElementById("ebLibX").onclick = function () { ov.remove(); };
      ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
      call({ action: "list-uploads" }).then(function (res) {
        var ups = (res.ok && res.d && res.d.uploads) ? res.d.uploads : [];
        if (!ups.length) { grid.textContent = "Noch keine hochgeladenen Bilder."; return; }
        grid.innerHTML = "";
        ups.forEach(function (u) {
          var im = document.createElement("img"); im.src = u; im.loading = "lazy";
          im.onclick = function () { model[idx].src = u; ov.remove(); render(); };
          grid.appendChild(im);
        });
      }).catch(function () { grid.textContent = "Fehler beim Laden."; });
    }
    function label(t) { return t === "button" ? "Button" : t === "heading" ? "Überschrift" : t === "quote" ? "Zitat" : t === "divider" ? "Trenner" : t === "list" ? "Liste" : t === "image" ? "Bild" : t === "columns" ? "Spalten" : t === "faq" ? "FAQ / Akkordeon" : "Text"; }
    function sync() {
      var ins = wrap.querySelectorAll("[data-f]");
      for (var k = 0; k < ins.length; k++) { var f = ins[k].getAttribute("data-f"), idx = +ins[k].getAttribute("data-i"); if (model[idx]) model[idx][f] = ins[k].value; }
    }
    function render() {
      var h = '<div class="box"><h3>Elemente &amp; Buttons</h3><p class="sub">Erscheinen auf dieser Seite über dem Footer. Reihenfolge mit den Pfeilen, danach Speichern.</p>';
      h += '<div class="eb-add-row"><button data-add="button">➕ Button</button><button data-add="heading">➕ Überschrift</button><button data-add="text">➕ Text</button><button data-add="list">➕ Liste</button><button data-add="image">➕ Bild</button><button data-add="columns">➕ Spalten</button><button data-add="faq">➕ FAQ</button><button data-add="quote">➕ Zitat</button><button data-add="divider">➕ Trenner</button></div><div>';
      if (!model.length) h += '<p class="sub">Noch keine Elemente – oben eins hinzufügen.</p>';
      for (var i = 0; i < model.length; i++) {
        var b = model[i], al = b.align || "center";
        h += '<div class="eb-row"><div class="t"><b>' + label(b.type) + '</b>'
          + '<span class="eb-al-ctl">'
          + '<button data-al="left" data-i="' + i + '" class="' + (al === "left" ? "on" : "") + '" title="links ausrichten">◧</button>'
          + '<button data-al="center" data-i="' + i + '" class="' + (al === "center" ? "on" : "") + '" title="mittig">▣</button>'
          + '<button data-al="right" data-i="' + i + '" class="' + (al === "right" ? "on" : "") + '" title="rechts ausrichten">◨</button>'
          + '</span>'
          + '<button data-up="' + i + '" title="nach oben">↑</button><button data-down="' + i + '" title="nach unten">↓</button><button data-del="' + i + '" title="entfernen">🗑</button></div>';
        h += '<div class="eb-lay"><span>Breite</span>'
          + '<select data-f="width" data-i="' + i + '"><option value="normal">normal</option><option value="narrow">schmal</option><option value="wide">breit</option><option value="full">voll</option></select>'
          + '<span>Abstand</span>'
          + '<select data-f="space" data-i="' + i + '"><option value="normal">normal</option><option value="small">klein</option><option value="large">groß</option></select></div>';
        if (b.type === "divider") {
          h += '<p class="sub" style="margin:.15rem 0 0">Waagerechte Trennlinie – keine Eingabe nötig.</p>';
        } else if (b.type === "list") {
          h += '<textarea data-f="text" data-i="' + i + '" maxlength="1600" placeholder="Ein Listenpunkt pro Zeile"></textarea>';
        } else if (b.type === "image") {
          h += '<select data-f="slot" data-i="' + i + '">';
          for (var si = 0; si < EB_SLOTS.length; si++) h += '<option value="' + EB_SLOTS[si][0] + '">' + EB_SLOTS[si][1] + '</option>';
          var pw = parseInt(b.w, 10); if (!(pw >= 20 && pw <= 100)) pw = 100;
          var psrc = b.src || EB_SLOT_IMG[b.slot] || "assets/img/senioren-zuhause.jpg";
          h += '</select>'
            + '<div class="eb-imgprev" style="width:' + pw + '%"><img src="' + psrc + '"><span class="eb-imgh" data-resize="' + i + '" title="Ziehen zum Ändern der Breite"></span><span class="eb-imgpct">' + pw + '%</span></div>'
            + '<div class="eb-imgrow"><button type="button" data-up-img="' + i + '">📤 Hochladen</button><button type="button" data-lib-img="' + i + '">🖼 Mediathek</button>'
            + (b.src ? '<button type="button" data-clr-img="' + i + '">✕ eigenes entfernen</button>' : '')
            + '<span class="sub" data-img-state="' + i + '">' + (b.src ? "eigenes Bild ✓" : "Auswahl oben oder hochladen") + '</span></div>'
            + '<input data-f="alt" data-i="' + i + '" maxlength="160" placeholder="Alt-Text (Bildbeschreibung)">';
        } else if (b.type === "columns") {
          h += '<textarea data-f="left" data-i="' + i + '" maxlength="600" placeholder="Linke Spalte"></textarea>'
            + '<textarea data-f="right" data-i="' + i + '" maxlength="600" placeholder="Rechte Spalte"></textarea>';
        } else if (b.type === "faq") {
          h += '<textarea data-f="text" data-i="' + i + '" maxlength="6000" placeholder="Eine Frage pro Zeile im Format:  Frage | Antwort"></textarea>';
        } else {
          var max = b.type === "text" ? 600 : b.type === "quote" ? 400 : b.type === "heading" ? 120 : 80;
          h += '<input data-f="text" data-i="' + i + '" maxlength="' + max + '" placeholder="Beschriftung / Text">';
          if (b.type === "button") {
            h += '<input data-f="href" data-i="' + i + '" maxlength="200" placeholder="Link: termin.html · tel:051531552 · https://…">'
              + '<select data-f="variant" data-i="' + i + '"><option value="solid">Gefüllt (rot)</option><option value="ghost">Umrandet</option></select>';
          }
        }
        h += '</div>';
      }
      h += '</div><div class="row"><button class="cancel" id="ebX">Abbrechen</button><button class="ok" id="ebOk">Speichern</button></div></div>';
      wrap.innerHTML = h;
      var ins = wrap.querySelectorAll("[data-f]");
      for (var k = 0; k < ins.length; k++) { var f = ins[k].getAttribute("data-f"), idx = +ins[k].getAttribute("data-i"); ins[k].value = (model[idx] && model[idx][f] != null) ? model[idx][f] : ""; }
      bind();
    }
    function bind() {
      var add = wrap.querySelectorAll("[data-add]");
      for (var a = 0; a < add.length; a++) { add[a].onclick = (function (t) { return function () { sync(); model.push(t === "button" ? { type: "button", text: "", href: "", variant: "solid" } : t === "divider" ? { type: "divider" } : t === "image" ? { type: "image", slot: "senioren-zuhause", src: "", alt: "" } : t === "columns" ? { type: "columns", left: "", right: "" } : { type: t, text: "" }); render(); }; })(add[a].getAttribute("data-add")); }
      var upB = wrap.querySelectorAll("[data-up-img]");
      for (var q2 = 0; q2 < upB.length; q2++) { upB[q2].onclick = (function (idx) { return function () { sync(); upIdx = idx; imgPicker.click(); }; })(+upB[q2].getAttribute("data-up-img")); }
      var clrB = wrap.querySelectorAll("[data-clr-img]");
      for (var q3 = 0; q3 < clrB.length; q3++) { clrB[q3].onclick = (function (idx) { return function () { sync(); model[idx].src = ""; render(); }; })(+clrB[q3].getAttribute("data-clr-img")); }
      var alB = wrap.querySelectorAll("[data-al]");
      for (var q4 = 0; q4 < alB.length; q4++) { alB[q4].onclick = (function (idx, v) { return function () { sync(); model[idx].align = v; render(); }; })(+alB[q4].getAttribute("data-i"), alB[q4].getAttribute("data-al")); }
      var rz = wrap.querySelectorAll("[data-resize]");
      for (var q5 = 0; q5 < rz.length; q5++) {
        (function (handle) {
          var idx = +handle.getAttribute("data-resize"), prev = handle.parentNode, pct = prev.querySelector(".eb-imgpct"), dragging = false;
          handle.addEventListener("pointerdown", function (e) { dragging = true; try { handle.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); });
          handle.addEventListener("pointermove", function (e) {
            if (!dragging) return;
            var pr = prev.parentNode.getBoundingClientRect();
            var w = Math.max(20, Math.min(100, Math.round(((e.clientX - pr.left) / (pr.width || 1)) * 100)));
            prev.style.width = w + "%"; if (pct) pct.textContent = w + "%"; model[idx].w = String(w);
          });
          handle.addEventListener("pointerup", function () { dragging = false; });
        })(rz[q5]);
      }
      var libB = wrap.querySelectorAll("[data-lib-img]");
      for (var q6 = 0; q6 < libB.length; q6++) { libB[q6].onclick = (function (idx) { return function () { sync(); openLibPicker(idx); }; })(+libB[q6].getAttribute("data-lib-img")); }
      var del = wrap.querySelectorAll("[data-del]");
      for (var d = 0; d < del.length; d++) { del[d].onclick = (function (i) { return function () { sync(); model.splice(i, 1); render(); }; })(+del[d].getAttribute("data-del")); }
      var up = wrap.querySelectorAll("[data-up]");
      for (var u = 0; u < up.length; u++) { up[u].onclick = (function (i) { return function () { sync(); if (i > 0) { var m = model[i - 1]; model[i - 1] = model[i]; model[i] = m; } render(); }; })(+up[u].getAttribute("data-up")); }
      var dn = wrap.querySelectorAll("[data-down]");
      for (var n = 0; n < dn.length; n++) { dn[n].onclick = (function (i) { return function () { sync(); if (i < model.length - 1) { var m = model[i + 1]; model[i + 1] = model[i]; model[i] = m; } render(); }; })(+dn[n].getAttribute("data-down")); }
      var sels = wrap.querySelectorAll('select[data-f="variant"]');
      for (var s = 0; s < sels.length; s++) { var idx = +sels[s].getAttribute("data-i"); if (model[idx]) sels[s].value = model[idx].variant || "solid"; }
      document.getElementById("ebX").onclick = function () { closePanel(); };
      wrap.onclick = function (e) { if (e.target === wrap) closePanel(); };
      document.getElementById("ebOk").onclick = function () {
        sync();
        var ok = document.getElementById("ebOk"); ok.disabled = true; ok.textContent = "Speichert …";
        var payload = [];
        for (var p = 0; p < model.length; p++) {
          var mb = model[p];
          if (mb.type === "list") payload.push({ type: "list", align: mb.align, width: mb.width, space: mb.space, items: (mb.text || "").split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean) });
          else if (mb.type === "faq") payload.push({ type: "faq", align: mb.align, width: mb.width, space: mb.space, items: (mb.text || "").split(/\n+/).map(function (line) { var parts = line.split("|"); return { q: (parts[0] || "").trim(), a: parts.slice(1).join("|").trim() }; }).filter(function (x) { return x.q; }) });
          else payload.push(mb);
        }
        call({ action: "save-blocks", file: file, zone: zone, blocks: payload }).then(function (res) {
          if (res.ok) { closePanel(); msg("✓ Elemente gespeichert – Neuaufbau ~1–3 Min, dann auf Aktualisieren klicken."); }
          else { ok.disabled = false; ok.textContent = "Speichern"; msg(res.status === 401 ? "Falsches Passwort – über /admin neu anmelden." : "Fehler: " + (res.d.error || res.status)); }
        }).catch(function () { ok.disabled = false; ok.textContent = "Speichern"; msg("Verbindungsfehler."); });
      };
    }
    render();
  }

  // SEO/Titel + Meta-Beschreibung + Bild-Alt-Texte der AKTUELLEN Seite bearbeiten -> save-meta
  function openSeo() {
    if (document.getElementById("dvPanel")) return;
    var metaEl = document.querySelector('meta[name="description"]');
    var imgs = document.querySelectorAll("[data-ed-img]");
    var html = '<div class="box"><h3>SEO &amp; Seitentitel</h3><p class="sub">Gilt nur für <b>diese</b> Seite – wichtig für Google-Treffer &amp; die Vorschau beim Teilen.</p>'
      + '<label>Seitentitel (Browser-Tab &amp; Google-Überschrift)</label>'
      + '<input id="dvSeoT" maxlength="80">'
      + '<div class="hint"><span>Empfehlung: ca. 50–60 Zeichen</span><b><span id="dvSeoTn">0</span>/80</b></div>'
      + '<label>Meta-Beschreibung (Textausschnitt bei Google)</label>'
      + '<textarea id="dvSeoD" maxlength="320"></textarea>'
      + '<div class="hint"><span>Empfehlung: ca. 150–160 Zeichen</span><b><span id="dvSeoDn">0</span>/320</b></div>';
    if (imgs.length) {
      html += '<div class="grp">Bild-Alt-Texte (Google-Bildersuche &amp; Barrierefreiheit)</div>';
      for (var i = 0; i < imgs.length; i++) {
        html += '<label>Bild: ' + imgs[i].getAttribute("data-ed-img") + '</label><input data-alt="' + imgs[i].getAttribute("data-ed-img") + '" maxlength="160">';
      }
    }
    html += '<div class="row"><button class="cancel" id="dvSeoX">Abbrechen</button><button class="ok" id="dvSeoOk">Übernehmen</button></div></div>';
    var wrap = document.createElement("div"); wrap.id = "dvPanel"; wrap.innerHTML = html;
    document.body.appendChild(wrap);
    var tIn = document.getElementById("dvSeoT"), dIn = document.getElementById("dvSeoD");
    tIn.value = document.title || "";
    dIn.value = metaEl ? (metaEl.getAttribute("content") || "") : "";
    // Alt-Werte per Property setzen (kein HTML-Inject)
    var altIns = wrap.querySelectorAll("input[data-alt]");
    for (var k = 0; k < altIns.length; k++) {
      var im = document.querySelector('[data-ed-img="' + altIns[k].getAttribute("data-alt") + '"]');
      altIns[k].value = im ? (im.getAttribute("alt") || "") : "";
    }
    function cnt() { document.getElementById("dvSeoTn").textContent = tIn.value.length; document.getElementById("dvSeoDn").textContent = dIn.value.length; }
    tIn.addEventListener("input", cnt); dIn.addEventListener("input", cnt); cnt();
    function close() { wrap.remove(); }
    document.getElementById("dvSeoX").addEventListener("click", close);
    wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });
    document.getElementById("dvSeoOk").addEventListener("click", function () {
      var alts = {}, as = wrap.querySelectorAll("input[data-alt]");
      for (var j = 0; j < as.length; j++) { alts[as[j].getAttribute("data-alt")] = as[j].value.replace(/\s+/g, " ").trim(); }
      var ok = document.getElementById("dvSeoOk"); ok.disabled = true; ok.textContent = "Speichert …";
      call({ action: "save-meta", file: file, title: tIn.value.replace(/\s+/g, " ").trim(), description: dIn.value.replace(/\s+/g, " ").trim(), alts: alts }).then(function (res) {
        if (res.ok) { close(); msg("✓ SEO/Titel gespeichert – Neuaufbau ~1–3 Min, dann auf Aktualisieren klicken."); }
        else { ok.disabled = false; ok.textContent = "Übernehmen"; msg(res.status === 401 ? "Falsches Passwort – über /admin neu anmelden." : "Fehler: " + (res.d.error || res.status)); }
      }).catch(function () { ok.disabled = false; ok.textContent = "Übernehmen"; msg("Verbindungsfehler."); });
    });
  }

  var dvSaving = false;
  function save() {
    if (dvSaving) return; // Reentrancy-Schutz: kein paralleles Doppel-Speichern (z. B. schnelles Strg+S)
    dvSaving = true;
    var btn = document.getElementById("dvSave"); if (btn) btn.disabled = true;
    msg("Wird gespeichert …");
    var fields = {}, eds = document.querySelectorAll("[data-ed]");
    for (var i = 0; i < eds.length; i++) { fields[eds[i].getAttribute("data-ed")] = eds[i].textContent.replace(/\s+/g, " ").trim(); }
    var rich = {}, rds = document.querySelectorAll("[data-ed-rich]");
    for (var ri = 0; ri < rds.length; ri++) { rich[rds[ri].getAttribute("data-ed-rich")] = rds[ri].innerHTML; }
    var sentPos = Object.keys(pendingPos); // nur DIESE Ausschnitte gehen jetzt raus; waehrenddessen neu gezogene bleiben erhalten
    call({ action: "save-page", file: file, fields: fields, rich: rich, positions: pendingPos }).then(function (res) {
      if (!res.ok) {
        var em = res.status === 401 ? "Falsches Passwort – bitte über /admin neu anmelden." : (res.status === 429 ? "Zu viele Versuche – bitte später." : "Fehler: " + (res.d.error || res.status));
        msg(em); toast(em, "err");
        dvSaving = false; if (btn) btn.disabled = false; return;
      }
      for (var pk = 0; pk < sentPos.length; pk++) delete pendingPos[sentPos[pk]]; // nur die tatsaechlich gesendeten Bildausschnitte entfernen
      var slots = Object.keys(pending), upFail = 0;
      function finish() {
        ebSaveAll().then(function (zonesOk) {
          clearChanged();
          if (zonesOk && !upFail) { msg("✓ Gespeichert! Seite wird neu gebaut (~1–3 Min) – danach auf Aktualisieren klicken."); toast("✓ Gespeichert! Neuaufbau in ~1-3 Min, danach auf Aktualisieren klicken.", "ok"); }
          else {
            var what = upFail && !zonesOk ? "Bilder und Elemente" : upFail ? (upFail === 1 ? "ein Bild" : upFail + " Bilder") : "einige Elemente";
            msg("Teilweise gespeichert – " + what + " konnten nicht gesichert werden. Bitte noch einmal speichern.");
            toast("Teilweise gespeichert: " + what + " konnten nicht gesichert werden. Bitte erneut speichern.", "err");
          }
          dvSaving = false; if (btn) btn.disabled = false;
        }).catch(function () { msg("Verbindungsfehler beim Speichern der Elemente."); toast("Verbindungsfehler – bitte erneut speichern.", "err"); dvSaving = false; if (btn) btn.disabled = false; });
      }
      (function next(k) {
        if (k >= slots.length) { finish(); return; }
        msg("Bild wird gespeichert …");
        call({ action: "upload-image", slot: slots[k], dataBase64: pending[slots[k]] }).then(function (r2) {
          if (r2.ok) delete pending[slots[k]]; else upFail++;
          next(k + 1);
        }).catch(function () { upFail++; next(k + 1); }); // ohne catch bliebe der Speichern-Knopf für immer deaktiviert
      })(0);
    }).catch(function () { msg("Verbindungsfehler."); dvSaving = false; if (btn) btn.disabled = false; });
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
