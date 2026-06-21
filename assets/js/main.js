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
    $$(".mobile-nav__links a", mobileNav).forEach(function (a) { a.addEventListener("click", function () { setMobile(false); }); });
  }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") setMobile(false); });

  /* ---------- active nav link ---------- */
  (function () {
    var here = location.pathname.split("/").pop() || "index.html";
    $$(".nav__links a, .mobile-nav__links a").forEach(function (a) {
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
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);

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
      window.location.href = "mailto:info@andreasdevries.de?subject=" + subject + "&body=" + body;
      status.textContent = "Ihr E-Mail-Programm wird geöffnet. Vielen Dank für Ihre Anfrage!";
      status.className = "form__status ok";
      form.reset();
    });
  })();

  /* ---------- footer year ---------- */
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- boot ---------- */
  initLenis();
  applyScroll();
})();
