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
  }
  if (burger) burger.addEventListener("click", function () { setMobile(true); });
  if (mobileNav) {
    $("#mobileClose", mobileNav) && $("#mobileClose", mobileNav).addEventListener("click", function () { setMobile(false); });
    $$("a[href]", mobileNav).forEach(function (a) { a.addEventListener("click", function () { setMobile(false); }); });
    // aufklappbare Einträge (z. B. Seniorenbetreuung)
    $$(".mnav__toggle", mobileNav).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var sub = document.getElementById(btn.getAttribute("aria-controls"));
        var open = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", open ? "false" : "true");
        if (sub) sub.classList.toggle("is-open", !open);
      });
    });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMobile(false); });

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

  /* ---------- counters ---------- */
  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-count"));
    var dec = (el.getAttribute("data-count").split(".")[1] || "").length;
    var dur = 1600, start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = target * eased;
      el.textContent = dec ? val.toFixed(dec) : Math.round(val).toLocaleString("de-DE");
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = dec ? target.toFixed(dec) : Math.round(target).toLocaleString("de-DE");
    }
    if (reduce) { el.textContent = dec ? target.toFixed(dec) : target.toLocaleString("de-DE"); }
    else requestAnimationFrame(step);
  }
  var countIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) { if (en.isIntersecting) { animateCount(en.target); countIO.unobserve(en.target); } });
  }, { threshold: 0.6 });
  $$("[data-count]").forEach(function (el) { countIO.observe(el); });

  /* ---------- magnetic buttons ---------- */
  if (!isTouch && !reduce) {
    $$("[data-magnetic]").forEach(function (el) {
      var strength = parseFloat(el.getAttribute("data-magnetic")) || 0.3;
      el.addEventListener("mousemove", function (e) {
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
    if (!road || !carG || !layer) return;
    var VBW = 760, VBH = 1480;
    var places = (route.getAttribute("data-places") || "").split("|").filter(Boolean);
    var len = 0;
    try { len = road.getTotalLength(); } catch (e) { return; }
    if (!len) return;
    var stops = [];
    places.forEach(function (name, i) {
      var frac = places.length > 1 ? 0.03 + (i / (places.length - 1)) * 0.94 : 0.5;
      var pt = road.getPointAtLength(frac * len);
      var el = document.createElement("div");
      el.className = "route__stop " + (pt.x < VBW / 2 ? "route__stop--left" : "route__stop--right");
      el.style.left = (pt.x / VBW * 100) + "%";
      el.style.top = (pt.y / VBH * 100) + "%";
      el.appendChild(document.createTextNode(name));
      layer.appendChild(el);
      stops.push({ frac: frac, el: el });
    });
    if (done) { done.style.strokeDasharray = len; done.style.strokeDashoffset = len; }
    var lastDir = 1;
    routeUpdate = function (p) {
      p = Math.max(0, Math.min(1, p));
      if (done) done.style.strokeDashoffset = len * (1 - p);
      var at = p * len;
      var pt = road.getPointAtLength(at);
      var a = road.getPointAtLength(Math.min(len, at + 3));
      var b = road.getPointAtLength(Math.max(0, at - 3));
      var dx = a.x - b.x;
      if (Math.abs(dx) > 0.6) lastDir = dx > 0 ? 1 : -1;
      carG.setAttribute("transform", "translate(" + pt.x + " " + pt.y + ") scale(" + lastDir + " 1)");
      for (var i = 0; i < stops.length; i++) {
        stops[i].el.classList.toggle("is-active", stops[i].frac <= p + 0.004);
      }
    };
    if (reduce) {
      if (done) done.style.strokeDashoffset = 0;
      stops.forEach(function (s) { s.el.classList.add("is-active"); });
      routeUpdate = null;
    } else {
      routeUpdate(0);
    }
  }

  /* ---------- cookie banner ---------- */
  (function () {
    var cookie = $("#cookie");
    if (!cookie) return;
    var KEY = "dv-cookie-ok";
    try { if (localStorage.getItem(KEY)) return; } catch (e) {}
    setTimeout(function () { cookie.classList.add("is-in"); }, 1400);
    $$("[data-cookie]", cookie).forEach(function (b) {
      b.addEventListener("click", function () {
        try { localStorage.setItem(KEY, "1"); } catch (e) {}
        cookie.classList.remove("is-in");
      });
    });
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

  /* ---------- boot ---------- */
  initLenis();
  initRoute();
  applyScroll();
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

  function start() {
    var st = document.createElement("style");
    st.textContent =
      '[data-ed],[data-ed-img]{outline:2px dashed rgba(215,18,10,.55);outline-offset:2px}'
      + '[data-ed]:hover,[data-ed-img]:hover{outline-style:solid;outline-color:#d7120a}'
      + '[data-ed]{cursor:text}[data-ed-img]{cursor:pointer}'
      + '[data-ed][contenteditable]:focus{outline:2px solid #d7120a;background:rgba(215,18,10,.08)}'
      + '#dvBar{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#1c1714;color:#fff;display:flex;gap:.6rem;flex-wrap:wrap;align-items:center;justify-content:center;padding:.6rem 1rem;font:14px system-ui,-apple-system,sans-serif;box-shadow:0 -10px 30px rgba(0,0,0,.35)}'
      + '#dvBar button{border:0;border-radius:999px;padding:.55em 1.25em;font-weight:700;cursor:pointer;font-size:.92rem}'
      + '#dvBar .s{background:#d7120a;color:#fff}#dvBar .x{background:#fff;color:#1c1714}'
      + '#dvBar .m{font-size:.82rem;opacity:.85;flex:1 1 100%;text-align:center;order:-1}'
      + '#dvPanel{position:fixed;inset:0;z-index:2147483646;background:rgba(28,23,20,.55);display:flex;align-items:center;justify-content:center;padding:1rem;font:14px system-ui,-apple-system,sans-serif}'
      + '#dvPanel .box{background:#fff;color:#1c1714;border-radius:14px;max-width:520px;width:100%;max-height:85vh;overflow:auto;padding:1.4rem 1.5rem;box-shadow:0 40px 90px -40px rgba(0,0,0,.6)}'
      + '#dvPanel h3{margin:0 0 .15rem;font-size:1.2rem}#dvPanel .sub{color:#756a60;font-size:.85rem;margin:0 0 .3rem}'
      + '#dvPanel .grp{font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#a50d07;margin:1.1rem 0 .2rem}'
      + '#dvPanel label{display:block;font-size:.78rem;color:#756a60;margin:.5rem 0 .12rem}'
      + '#dvPanel input{width:100%;padding:.5rem .6rem;border:1px solid rgba(28,23,20,.18);border-radius:8px;font:inherit}'
      + '#dvPanel .row{display:flex;gap:.6rem;justify-content:flex-end;margin-top:1.2rem;position:sticky;bottom:-1px;background:#fff;padding:.7rem 0}'
      + '#dvPanel button{border:0;border-radius:999px;padding:.6em 1.3em;font-weight:700;cursor:pointer}'
      + '#dvPanel .ok{background:#d7120a;color:#fff}#dvPanel .cancel{background:#eee;color:#1c1714}';
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
        URL.revokeObjectURL(url); msg("Neues Bild gewählt – bitte speichern.");
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
      el.addEventListener("keydown", noEnter);
    }
    // Rich-Felder (Absätze mit Links/Fett) editierbar machen – Tags bleiben erhalten
    var rds = document.querySelectorAll("[data-ed-rich]");
    for (var r0 = 0; r0 < rds.length; r0++) {
      var rel = rds[r0];
      rel.setAttribute("contenteditable", "true"); rel.setAttribute("spellcheck", "false");
      rel.addEventListener("keydown", noEnter);
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
        img.addEventListener("pointerup", function () { if (dragging && didDrag) msg("Bildausschnitt geändert – bitte speichern."); dragging = false; });
        img.addEventListener("click", function (e) {
          if (!e.isTrusted) return;
          e.preventDefault(); e.stopPropagation();
          if (didDrag) { didDrag = false; return; } // war ein Ziehen -> NICHT ersetzen
          target = img; slot = img.getAttribute("data-ed-img"); picker.value = ""; picker.click();
        });
      })(imgs[j]);
    }
    // Links sollen im Edit-Modus NICHT navigieren, wenn sie editierbaren Inhalt enthalten
    // (Karten-Links) oder selbst in einem Rich-Feld liegen (Link-Text bearbeitbar).
    // Echte Menü-/Nav-Links funktionieren weiter normal.
    document.addEventListener("click", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      if (a.closest("[data-ed-rich]") || a.querySelector("[data-ed],[data-ed-img]")) e.preventDefault();
    }, true);

    var bar = document.createElement("div"); bar.id = "dvBar";
    bar.innerHTML = '<span class="m" id="dvMsg">Bearbeitungsmodus aktiv · Text/Bild anklicken & ändern · andere Seiten normal über das Menü</span>'
      + '<button class="s" id="dvSave">💾 Diese Seite speichern</button>'
      + '<button class="x" id="dvShared">🧭 Menü &amp; Footer</button>'
      + '<button class="x" id="dvReload">🔄 Aktualisieren</button>'
      + '<button class="x" id="dvExit">🚪 Verlassen</button>';
    document.body.appendChild(bar);
    document.getElementById("dvSave").addEventListener("click", save);
    document.getElementById("dvShared").addEventListener("click", openShared);
    // Cache umgehen + frisch laden (GitHub Pages cached Seiten einige Minuten)
    document.getElementById("dvReload").addEventListener("click", function () {
      location.href = location.pathname + "?r=" + Date.now();
    });
    document.getElementById("dvExit").addEventListener("click", function () {
      localStorage.removeItem(FLAG); localStorage.removeItem(PWK); localStorage.removeItem(TSK);
      location.href = location.pathname; // ohne Cache-Buster, normaler Stand
    });
  }

  // Geteilte Menü-/Footer-Beschriftungen bearbeiten (Panel) -> save-shared -> alle Seiten
  var SHARED_ORDER = [
    ["Menü", ["lbl-start", "Start"], ["lbl-senioren", "Seniorenbetreuung"], ["lbl-haushalt", "Haushaltshilfe"], ["lbl-stellen", "Stellenangebote"], ["lbl-kontakt", "Kontakt (mobil)"]],
    ["Menü-Dropdown", ["lbl-uebersicht", "Übersicht"], ["lbl-entlastung", "Entlastungsbetrag"], ["lbl-pflege", "Pflegesachleistungen"]],
    ["Buttons", ["lbl-termin", "Termin buchen"]],
    ["Footer-Überschriften", ["lbl-foot-leistungen", "Leistungen"], ["lbl-foot-informationen", "Informationen"], ["lbl-foot-kontakt", "Kontakt"]],
    ["Footer-Links", ["lbl-impressum", "Impressum"], ["lbl-datenschutz", "Datenschutz"], ["lbl-kontaktformular", "Kontaktformular"]],
    ["Menü-Gruppen (mobil)", ["lbl-grp-leistungen", "Gruppe: Leistungen"], ["lbl-grp-mehr", "Gruppe: Mehr"]]
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
    html += '<div class="row"><button class="cancel" id="dvPx">Abbrechen</button><button class="ok" id="dvPok">Übernehmen</button></div></div>';
    var wrap = document.createElement("div"); wrap.id = "dvPanel"; wrap.innerHTML = html;
    document.body.appendChild(wrap);
    var inputs = wrap.querySelectorAll("input[data-k]");
    for (var n = 0; n < inputs.length; n++) { inputs[n].value = vals[inputs[n].getAttribute("data-k")] || ""; }
    function close() { wrap.remove(); }
    document.getElementById("dvPx").addEventListener("click", close);
    wrap.addEventListener("click", function (e) { if (e.target === wrap) close(); });
    document.getElementById("dvPok").addEventListener("click", function () {
      var shared = {}, ins = wrap.querySelectorAll("input[data-k]");
      for (var m = 0; m < ins.length; m++) { shared[ins[m].getAttribute("data-k")] = ins[m].value.replace(/\s+/g, " ").trim(); }
      var ok = document.getElementById("dvPok"); ok.disabled = true; ok.textContent = "Speichert …";
      call({ action: "save-shared", shared: shared }).then(function (res) {
        if (res.ok) { close(); msg("✓ Menü/Footer gespeichert (alle Seiten) – Neuaufbau ~1–3 Min, dann auf Aktualisieren klicken."); }
        else { ok.disabled = false; ok.textContent = "Übernehmen"; msg(res.status === 401 ? "Falsches Passwort – über /admin neu anmelden." : "Fehler: " + (res.d.error || res.status)); }
      }).catch(function () { ok.disabled = false; ok.textContent = "Übernehmen"; msg("Verbindungsfehler."); });
    });
  }

  function save() {
    var btn = document.getElementById("dvSave"); if (btn) btn.disabled = true;
    msg("Wird gespeichert …");
    var fields = {}, eds = document.querySelectorAll("[data-ed]");
    for (var i = 0; i < eds.length; i++) { fields[eds[i].getAttribute("data-ed")] = eds[i].textContent.replace(/\s+/g, " ").trim(); }
    var rich = {}, rds = document.querySelectorAll("[data-ed-rich]");
    for (var ri = 0; ri < rds.length; ri++) { rich[rds[ri].getAttribute("data-ed-rich")] = rds[ri].innerHTML; }
    call({ action: "save-page", file: file, fields: fields, rich: rich, positions: pendingPos }).then(function (res) {
      if (!res.ok) {
        msg(res.status === 401 ? "Falsches Passwort – bitte über /admin neu anmelden." : (res.status === 429 ? "Zu viele Versuche – bitte später." : "Fehler: " + (res.d.error || res.status)));
        if (btn) btn.disabled = false; return;
      }
      var slots = Object.keys(pending);
      (function next(k) {
        if (k >= slots.length) { msg("✓ Gespeichert! Seite wird neu gebaut (~1–3 Min) – danach auf Aktualisieren klicken."); if (btn) btn.disabled = false; return; }
        msg("Bild wird gespeichert …");
        call({ action: "upload-image", slot: slots[k], dataBase64: pending[slots[k]] }).then(function (r2) {
          if (r2.ok) delete pending[slots[k]]; next(k + 1);
        });
      })(0);
    }).catch(function () { msg("Verbindungsfehler."); if (btn) btn.disabled = false; });
  }

  if (document.body) start();
  else document.addEventListener("DOMContentLoaded", start);
})();
