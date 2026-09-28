/* smooth-ux.js — load with `defer` on every page, after the page's own scripts.
   Small, dependency-free helpers that make navigation and scrolling feel
   instant. Every block is independent and fails silently. */
(function () {
  "use strict";
  var root = document.documentElement;

  /* 1) Low-power / Data-Saver detection -> html.lite-fx (CSS drops blurs) */
  try {
    var conn = navigator.connection || {};
    var lowCpu = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
    var lowMem = navigator.deviceMemory && navigator.deviceMemory <= 4;
    if (conn.saveData || (lowCpu && lowMem)) root.classList.add("lite-fx");
  } catch (e) {}

  /* 2) Instant page loads: prefetch an internal page the moment the visitor
        hovers / touches its link, so the click feels immediate. */
  (function () {
    var done = {};
    function prefetch(url) {
      if (done[url]) return;
      done[url] = true;
      var l = document.createElement("link");
      l.rel = "prefetch";
      l.href = url;
      l.as = "document";
      document.head.appendChild(l);
    }
    function handler(ev) {
      var a = ev.target && ev.target.closest && ev.target.closest("a[href]");
      if (!a || (a.target && a.target !== "_self")) return;
      var href = a.getAttribute("href");
      if (!href || href.charAt(0) === "#") return;
      var u;
      try { u = new URL(href, location.href); } catch (e) { return; }
      if (u.origin !== location.origin || u.pathname === location.pathname) return;
      if (/\.(pdf|zip|jpe?g|png|webp|mp4)$/i.test(u.pathname)) return;
      var c = navigator.connection;
      if (c && (c.saveData || /2g/.test(c.effectiveType || ""))) return;
      prefetch(u.pathname + u.search);
    }
    document.addEventListener("pointerenter", handler, { capture: true, passive: true });
    document.addEventListener("touchstart", handler, { capture: true, passive: true });
  })();

  /* 3) Videos: only play while visible and while the tab is active
        (saves CPU/battery -> smoother scrolling everywhere else). */
  (function () {
    var vids = Array.prototype.slice.call(document.querySelectorAll("video[autoplay]"));
    if (!vids.length || !("IntersectionObserver" in window)) return;
    var visible = new Map();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        visible.set(en.target, en.isIntersecting);
        if (en.isIntersecting) {
          if (en.target.paused && !document.hidden) en.target.play().catch(function () {});
        } else if (!en.target.paused) {
          en.target.pause();
        }
      });
    }, { rootMargin: "80px 0px", threshold: 0.01 });
    vids.forEach(function (v) { io.observe(v); });
    document.addEventListener("visibilitychange", function () {
      vids.forEach(function (v) {
        if (document.hidden) { v.pause(); }
        else if (visible.get(v) !== false) { v.play().catch(function () {}); }
      });
    });
  })();

  /* 4) Back/forward button: restore the page cleanly if it was cached
        mid-transition (no blank/faded screen). */
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
      root.classList.remove("is-preload");
      if (document.body) document.body.classList.remove("is-leaving");
    }
  });

  /* 5) Keep long tasks off the main thread while scrolling: images decode
        asynchronously (never blocks a frame). */
  Array.prototype.forEach.call(document.images, function (img) {
    if (!img.hasAttribute("decoding")) img.decoding = "async";
  });
})();
