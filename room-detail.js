/* Room Detail pages (double-room.html / triple-room.html / family-room.html)
   — header/menu/transitions match script.js on the main site; adds a small
   gallery rotator for the 3-photo strip. */
(function () {
  "use strict";

  /* ---------- smooth cross-page transitions (same as script.js) ---------- */
  var PAGE_TRANSITION_MS = 380;

  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () {
      document.documentElement.classList.remove("is-preload");
    });
  });

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[href]");
    if (!link) return;
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target && link.target !== "_self") return;

    var href = link.getAttribute("href");
    if (!href || href.charAt(0) === "#") return;

    var url;
    try { url = new URL(href, window.location.href); } catch (err) { return; }
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.hash) return;

    event.preventDefault();
    document.body.classList.add("is-leaving");
    window.setTimeout(function () { window.location.href = url.href; }, PAGE_TRANSITION_MS);
  });

  window.addEventListener("pageshow", function () {
    document.body.classList.remove("is-leaving");
  });

  /* ---------- lazy image fade-in (same as script.js) ---------- */
  (function () {
    var lazyImgs = Array.prototype.slice.call(document.querySelectorAll('img[loading="lazy"]'));
    lazyImgs.forEach(function (img) {
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add("is-loaded");
        return;
      }
      img.addEventListener("load", function () { img.classList.add("is-loaded"); }, { once: true });
      img.addEventListener("error", function () { img.classList.add("is-loaded"); }, { once: true });
    });
  })();

  /* ---------- scroll reveal for .reveal elements (matches script.js) ----------
     Without this, every element with class="reveal" (intro copy, tagline,
     features heading, island photo, and the ENTIRE footer since
     .footer-v2-center carries "reveal") stays at opacity:0 forever, because
     .reveal only becomes visible via the .is-visible class added here. This
     was the cause of large blank gaps and the "missing" footer. */
  (function () {
    var revealEls = document.querySelectorAll(".reveal");
    if (!revealEls.length) return;
    if (!("IntersectionObserver" in window)) {
      revealEls.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealEls.forEach(function (el) { revealObserver.observe(el); });
  })();

  /* ---------- header + mobile menu: transparent-over-hero, solid on scroll (matches index.html) ---------- */
  var header = document.getElementById("site-header");
  var menu = document.getElementById("mobile-menu");
  var menuTrigger = document.getElementById("menu-trigger");
  if (!header || !menu || !menuTrigger) return;

  function setMenu(open) {
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    menuTrigger.setAttribute("aria-expanded", String(open));
    menuTrigger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    /* explicit class toggle (backup for the CSS :has() selector, which
       some browsers/webviews don't support) so the logo reliably flips
       to black against the mobile menu's light background */
    if (header) header.classList.toggle("is-menu-open", open);
  }

  var scrollTicking = false;
  var lastScrollY = window.scrollY;
  var HIDE_AFTER = 120;

  function applyScrollState() {
    try {
      var currentY = window.scrollY;
      header.classList.toggle("is-scrolled", currentY > 56);

      var scrollingDown = currentY > lastScrollY;
      if (scrollingDown && currentY > HIDE_AFTER && !menu.classList.contains("is-open")) {
        header.classList.add("is-hidden");
      } else {
        header.classList.remove("is-hidden");
      }
      lastScrollY = currentY;
    } finally {
      scrollTicking = false;
    }
  }
  window.addEventListener("scroll", function () {
    if (!scrollTicking) {
      window.requestAnimationFrame(applyScrollState);
      scrollTicking = true;
    }
  }, { passive: true });
  applyScrollState();

  menuTrigger.addEventListener("click", function () {
    header.classList.remove("is-hidden");
    setMenu(!menu.classList.contains("is-open"));
  });
  document.querySelectorAll(".mobile-menu a").forEach(function (link) {
    link.addEventListener("click", function () { setMenu(false); });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setMenu(false);
  });

  /* ---------- discover-rasdhoo full-page video: fade in once ready, keep
     it playing (same reliability treatment as the homepage hero video) ---------- */
  (function () {
    var video = document.getElementById("discover-video");
    if (!video) return;

    function markReady() { video.classList.add("is-ready"); }
    if (video.readyState >= 2) {
      markReady();
    } else {
      video.addEventListener("loadeddata", markReady, { once: true });
    }

    function resume() {
      if (video.paused && !document.hidden) {
        video.play().catch(function () {});
      }
    }
    video.addEventListener("pause", resume);
    video.addEventListener("stalled", resume);
    video.addEventListener("suspend", resume);
    document.addEventListener("visibilitychange", resume);
  })();

  /* ---------- header contact bubble (same as book-now.js) ---------- */
  (function () {
    var wrap = document.getElementById("header-contact-bubbles");
    var trigger = document.getElementById("header-contact-trigger");
    if (!wrap || !trigger) return;

    function setOpen(open) {
      wrap.classList.toggle("is-open", open);
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      var panel = document.getElementById("header-chat-widget-panel");
      if (panel) panel.setAttribute("aria-hidden", String(!open));
      if (open) {
        var input = document.getElementById("header-chat-widget-input");
        if (input) setTimeout(function () { input.focus(); }, 250);
      }
    }

    trigger.addEventListener("click", function () {
      setOpen(!wrap.classList.contains("is-open"));
    });
    document.addEventListener("click", function (event) {
      if (!wrap.contains(event.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") setOpen(false);
    });

    var chatForm = document.getElementById("header-chat-widget-form");
    var chatInput = document.getElementById("header-chat-widget-input");
    if (chatForm && chatInput) {
      chatForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var msg = chatInput.value.trim() || "Hi Dhaankolhu Rasdhoo, I'd like to ask about a booking.";
        var url = "https://wa.me/9609898130?text=" + encodeURIComponent(msg);
        window.open(url, "_blank", "noopener");
        chatInput.value = "";
      });
    }
  })();

})();

/* ---------- Nav dropdowns (Accommodation + Others) ----------
   The panel now opens purely on hover (see style.css ":hover"), plus
   ":focus-within" for keyboard/tab users — no click-to-toggle JS needed
   for opening/closing any more. Click behavior differs per trigger:
   - Accommodation: a real link (now points straight to
     family-room.html), so it's left alone and just navigates normally.
   - Others: has no page to go to, so its click is swallowed
     (event.preventDefault, no navigation) via [data-nav-noop] on the
     trigger in the HTML. */
(function () {
  var noopTriggers = document.querySelectorAll(".nav-dropdown-trigger[data-nav-noop]");
  noopTriggers.forEach(function (trigger) {
    trigger.setAttribute("aria-haspopup", "true");
    trigger.addEventListener("click", function (event) {
      event.preventDefault();
    });
  });
})();

/* ---------- Nav dropdown hover grace period (mirrors script.js) ----------
   Pure CSS ":hover" drops the panel the instant the pointer leaves
   ".nav-dropdown" by even a pixel — real mouse movement isn't perfectly
   straight, so tracking down to a lower row (e.g. Family Room) can nudge
   the cursor off the hoverable area for a frame and snap the panel shut
   before the click lands. Driving the open state from JS with a short
   close delay (cancelled if the pointer comes back before it fires)
   gives the panel some forgiveness, reusing the existing ".is-open" CSS
   hook — the ":hover"/":focus-within" CSS rules stay as a fallback. */
(function () {
  var dropdowns = document.querySelectorAll(".nav-dropdown");
  var CLOSE_DELAY_MS = 300;
  dropdowns.forEach(function (dropdown) {
    var closeTimer = null;
    dropdown.addEventListener("mouseenter", function () {
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
      dropdown.classList.add("is-open");
    });
    dropdown.addEventListener("mouseleave", function () {
      if (closeTimer) clearTimeout(closeTimer);
      closeTimer = setTimeout(function () {
        dropdown.classList.remove("is-open");
        closeTimer = null;
      }, CLOSE_DELAY_MS);
    });
  });
})();

/* ==========================================================================
   Scroll-drift photo effect — reusable across every image on this page.
   Same "naiiwan" left-behind drift used on the homepage's
   Highlights/Gallery/Accommodation photos (see initImageDrift in
   script.js — duplicated here since these pages load room-detail.js, not
   script.js). Sets a --img-drift CSS custom property (composes with each
   image's own hover-zoom transform in style.css/room-detail.css instead
   of overwriting it). Honours reduced motion, only runs while each image
   is near the viewport.
   ========================================================================== */
function initRoomDetailImageDrift(selector, driftPx) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var wraps = Array.prototype.slice.call(document.querySelectorAll(selector));
  if (!wraps.length) return;

  var DRIFT_PX = driftPx;
  var SMOOTHING = 0.1;

  wraps.forEach(function (wrap) {
    var img = wrap.tagName === "IMG" ? wrap : wrap.querySelector("img");
    if (!img) return;
    var media = wrap.tagName === "IMG" ? wrap.parentElement : wrap;
    var nearViewport = false;
    var rafId = null;
    var currentShift = 0, targetShift = 0;

    function computeTarget() {
      var rect = media.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var progress = (vh - rect.top) / (vh + rect.height);
      progress = Math.max(0, Math.min(1, progress));
      targetShift = (progress - 0.5) * DRIFT_PX;
    }

    function tick() {
      rafId = null;
      computeTarget();
      currentShift += (targetShift - currentShift) * SMOOTHING;
      img.style.setProperty("--img-drift", currentShift.toFixed(2) + "px");
      if (nearViewport && Math.abs(targetShift - currentShift) > 0.05) {
        rafId = requestAnimationFrame(tick);
      }
    }

    function ensureLoopRunning() {
      if (rafId === null) rafId = requestAnimationFrame(tick);
    }

    function onScroll() {
      if (!nearViewport) return;
      ensureLoopRunning();
    }

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          nearViewport = entry.isIntersecting;
          if (nearViewport) ensureLoopRunning();
        });
      }, { rootMargin: "25% 0px 25% 0px" });
      io.observe(media);
    } else {
      nearViewport = true;
      ensureLoopRunning();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { if (nearViewport) ensureLoopRunning(); });
  });
}

/* Accommodation cards on Offers / Explore Rasdhoo. */
initRoomDetailImageDrift("#discover-accommodation .offer-card-media", 60);
/* Room hero photo (double/triple/family-room.html) — biggest drift range
   since it's the biggest, most prominent image on the page. */
initRoomDetailImageDrift(".room-hero", 80);
/* 3-photo gallery strip. */
initRoomDetailImageDrift(".room-gallery-frame", 55);
/* "Other Rooms" cards at the bottom of each room-detail page. */
initRoomDetailImageDrift(".room-offers-grid .offer-card-media", 60);
