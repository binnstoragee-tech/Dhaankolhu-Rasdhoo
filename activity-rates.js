/* Shared carousel slide: fixed, normal slideshow speed (~550ms, ease-in-out)
   instead of the browser's native smooth-scroll, which crawls over long
   distances and fights scroll-snap. Snap + native smooth are switched off
   only while the slide runs, then restored so touch-swipe still snaps. */
(function () {
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function ease(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  window.arSlideBy = function (track, delta) {
    var max = track.scrollWidth - track.clientWidth;
    var from = track.scrollLeft;
    var to = Math.max(0, Math.min(max, from + delta));
    if (track._arRaf) cancelAnimationFrame(track._arRaf);
    if (reduce || Math.abs(to - from) < 2) { track.scrollLeft = to; return; }
    var dur = Math.max(450, Math.min(650, 380 + Math.abs(to - from) * 0.14));
    var snap = track.style.scrollSnapType, beh = track.style.scrollBehavior;
    track.style.scrollSnapType = "none";
    track.style.scrollBehavior = "auto";
    var t0 = null;
    function stop() {
      track._arRaf = null;
      track.style.scrollSnapType = snap;
      track.style.scrollBehavior = beh;
      track.removeEventListener("touchstart", cancel);
      track.removeEventListener("wheel", cancel);
    }
    function cancel() { if (track._arRaf) { cancelAnimationFrame(track._arRaf); stop(); } }
    track.addEventListener("touchstart", cancel, { passive: true });
    track.addEventListener("wheel", cancel, { passive: true });
    function frame(now) {
      if (t0 === null) t0 = now;
      var p = Math.min(1, (now - t0) / dur);
      track.scrollLeft = from + (to - from) * ease(p);
      if (p < 1) track._arRaf = requestAnimationFrame(frame);
      else stop();
    }
    track._arRaf = requestAnimationFrame(frame);
  };
})();

/* Dhaankolhu Rasdhoo — Activity Rates (single source of truth for both index.html and offers.html)
   Edit prices/details ONLY in the DATA array below. */
(function () {
  // The full "Activity Rates" grid lives on offers.html (#ar-root). On the
  // homepage that section is gone, but the Experience carousel + details
  // modal below still need this script, so fall back to a detached node
  // instead of bailing out.
  var root = document.getElementById("ar-root") || document.createElement("div");

  // false = empty frames (no photos yet). Set to true when photos are ready: img/activities/<slug>.webp (falls back to the site photo in f, else empty frame).
  var SHOW_IMAGES = false;

  var ICO = {
    all: '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
    snorkel: '<path d="M3 9.5A2.5 2.5 0 015.5 7h13A2.5 2.5 0 0121 9.5V12a4.5 4.5 0 01-4.5 4.5h-1.2L14 14h-4l-1.300 2.500H7.500A4.500 4.500 0 013 12z"/><path d="M8 11.500h8"/><path d="M19 7V3.500"/>',
    fishing: '<path d="M2.500 12C5 8 9 6.500 13 8c1.800.700 3.200 1.800 4.200 3.200L21.500 8v8l-4.300-3.200C16.200 14.200 14.800 15.300 13 16c-4 1.500-8 0-10.500-4z"/><circle cx="7.500" cy="11" r=".7" fill="currentColor"/>',
    evening: '<path d="M7.500 3h9v5.500a4.500 4.500 0 01-9 0z"/><path d="M12 13v7.500M8 21h8"/><path d="M7.500 8h9"/>',
    trips: '<circle cx="12" cy="12" r="9"/><path d="M15.700 8.300l-2 5.400-5.400 2 2-5.400z"/>'
  };
  var CATS = [
    { id: "all", label: "All", full: "All Activities" },
    { id: "snorkel", label: "Snorkeling" },
    { id: "fishing", label: "Fishing" },
    { id: "evening", label: "Cruise & Dining" },
    { id: "trips", label: "Day Trips & Expeditions" }
  ];
  function catIcon(id) { return '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICO[id] + "</svg>"; }
  var CAT_NAME = { snorkel: "Snorkeling", fishing: "Fishing", evening: "Cruise & Dining", trips: "Day Trips" };

  // f = fallback photo already on the site (used until img/activities/<slug>.webp exists)
  // t = [1 pax, 2 pax, 3+ pax]   g = group-only price (per person)   gl = price label   note = pax rule
  var DATA = [
    { n: "1 Spot Snorkeling", f: "img/experience/snorkeling.webp", c: "snorkel", d: "45 min", t: [40, 38, 35], i: ["Snorkel Gear", "Water", "Towel", "Guide", "GoPro Pics & Vids"], feat: true },
    { n: "3 Spot Snorkeling", f: "img/experience/snorkeling.webp", c: "snorkel", d: "2 hr", t: [85, 85, 75], i: ["Snorkel Gear", "Water", "Towel", "Guide", "GoPro Pics & Vids"] },
    { n: "Manta Snorkeling", f: "img/experience/snorkeling.webp", c: "snorkel", d: "1 hr 30 min", t: [90, 80, 70], i: ["Snorkel Gear", "Water", "Towel", "Guide", "GoPro Pics & Vids"] },
    { n: "Turtle Snorkeling", f: "img/experience/turtle.webp", c: "snorkel", d: "1 hr 30 min", t: [55, 50, 45], i: ["Snorkel Gear", "Water", "Towel", "Guide", "GoPro Pics & Vids"], feat: true },
    { n: "Gangehi Shark Quest", f: "img/experience/shark.webp", c: "snorkel", d: "1 hr 30 min", g: 70, note: "Min 4 pax", i: ["Snorkel Gear", "Water", "Towel", "Guide", "GoPro Pics & Vids"] },

    { n: "Night Fishing with BBQ Dinner", f: "img/experience/fishing.webp", c: "fishing", d: "2 hr", t: [65, 60, 55], i: ["Fishing Equipment", "Water", "Snacks", "Guide"], feat: true },
    { n: "Day Fishing with BBQ Dinner", f: "img/experience/fishing.webp", c: "fishing", d: "2 hr", t: [65, 60, 55], i: ["Fishing Equipment", "Water", "Snacks", "Guide"] },
    { n: "Big Game Fishing", f: "img/experience/fishing.webp", c: "fishing", d: "Per hour", g: 90, gl: "per hour", note: "Max 5 pax", i: ["Fishing Equipment", "Water", "Snacks", "Guide"] },

    { n: "Sunset Cruise", f: "img/experience/dolpin.webp", c: "evening", d: "2 hr", t: [85, 80, 70], i: ["Snacks", "Water", "Drone Pics & Vids"], feat: true },
    { n: "Beach Dinner", c: "evening", d: "2 hr", t: [100, 85, 75], i: ["Meal"] },
    { n: "Sandbank Dinner", c: "evening", d: "3 hr", t: [150, 120, 100], i: ["Meal"] },

    { n: "Sandbank Full Day Trip", c: "trips", d: "7 hr", t: [60, 50, 40], i: ["Lunch", "Snorkel Gear", "Water", "Towel", "Guide", "GoPro Pics & Vids"], feat: true },
    { n: "Island Hopping", c: "trips", d: "8 hr", g: 100, note: "Min 4 pax", i: ["Meal", "Guide"] },
    { n: "Madivaru Camping", c: "trips", d: "17 hr", g: 200, note: "Min 4 pax", i: ["Camping Tents", "Fishing Equipment", "Meal", "Water", "GoPro Pics & Vids"] },
    { n: "Whale Shark Trip", f: "img/experience/shark.webp", c: "trips", d: "7 hr", g: 160, note: "Min 8 pax", i: ["Snorkel Gear", "Water", "Meal", "Towel", "Guide", "GoPro Pics & Vids"], feat: true },
    { n: "Hanifaru Bay Manta", c: "trips", d: "8 hr", g: 200, note: "Min 4 pax", i: ["Snorkel Gear", "Water", "Meal", "Towel", "Guide", "GoPro Pics & Vids"] }
  ];

  var clock = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  var group = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3.2 3.2 0 010 5.6M18 14.4c1.8.8 3 2.6 3 5.6"/></svg>';

  var pin = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.2A7 7 0 0112 3a7 7 0 017 6.8C19 14.8 12 21 12 21z"/><circle cx="12" cy="10" r="2.4"/></svg>';
  var PAL = { snorkel: ["#0b8c92", "#073d4a"], fishing: ["#1c5d8a", "#0c2a44"], evening: ["#e58b5a", "#4b2a5c"], trips: ["#2f9c7a", "#0f3f4a"] };

  function slug(n) { return n.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  // Temporary placeholder (shown only until img/activities/<slug>.webp exists)
  function placeholder(a) {
    var p = PAL[a.c], f = "img/activities/" + slug(a.n) + ".webp";
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + p[0] + '"/><stop offset="1" stop-color="' + p[1] + '"/></linearGradient></defs><rect width="800" height="600" fill="url(#g)"/><g fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="3"><path d="M0 330q100-40 200 0t200 0 200 0 200 0"/><path d="M0 380q100-40 200 0t200 0 200 0 200 0"/><path d="M0 430q100-40 200 0t200 0 200 0 200 0"/></g><text x="400" y="190" text-anchor="middle" font-family="Georgia,serif" font-size="46" fill="#fff" fill-opacity=".9">' + a.n.replace(/&/g, "&amp;") + '</text><text x="400" y="235" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" fill="#fff" fill-opacity=".6">' + f + '</text></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  function price(v) { return '<strong class="ar-price"><sup>$</sup><span data-count="' + v + '">' + v + "</span></strong>"; }

  function tiersHtml(a) {
    if (a.t) {
      var labels = ["1 pax", "2 pax", "3+ pax"];
      return '<div class="ar-tiers">' + a.t.map(function (v, k) {
        return '<div class="ar-tier' + (k === 2 ? " is-best" : "") + '"><small>' + labels[k] + "</small><b>$" + v + "</b></div>";
      }).join("") + "</div>";
    }
    return '<div class="ar-tiers ar-tiers-solo"><div class="ar-tier is-best"><small>Group rate' + (a.gl ? " · per hour" : " · per person") + "</small><b>$" + a.g + "</b></div></div>";
  }

  function card(a, forceImg) {
    var from = a.t ? Math.min.apply(null, a.t) : a.g;
    var fromLabel = a.t ? "From" : (a.gl ? "Per hour" : "Per person");
    var tiers = tiersHtml(a);
    var img = "img/activities/" + slug(a.n) + ".webp";
    var showImg = forceImg ? !!a.f : SHOW_IMAGES;
    var imgSrc = forceImg && a.f ? a.f : img;
    return '<article class="ar-card" role="button" tabindex="0" aria-haspopup="dialog" aria-label="View details: ' + a.n + '" data-cat="' + a.c + '" data-slug="' + slug(a.n) + '">' +
      '<div class="ar-media">' + (showImg ? '<img loading="lazy" decoding="async" src="' + imgSrc + '" alt="' + a.n + '" />' : "") +
      (a.b ? '<span class="ar-badge">' + a.b + "</span>" : "") +
      '<div class="ar-cap"><div class="ar-cap-l"><h3>' + a.n + '</h3><span class="ar-sub">' + clock + a.d + (a.note ? '<span class="ar-note-inline"> &nbsp;·&nbsp; ' + a.note + "</span>" : "") + '</span></div>' +
      '<div class="ar-cap-r"><em>' + fromLabel + "</em>" + price(from) + "</div></div></div>" +
      '<div class="ar-body">' + tiers +
      '<ul class="ar-incl" aria-label="Included">' + a.i.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>" +
      '</div>' +
      '<span class="ar-more" aria-hidden="true">View details <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>' +
      "</article>";
  }

  // Compact "package card" — just the photo with a category badge and a
  // title/price overlay, no tiers or included-items panel below. Used only
  // for the homepage Experience teaser carousel; tapping it still opens the
  // same full-detail modal as the grid.
  function previewCard(a) {
    var from = a.t ? Math.min.apply(null, a.t) : a.g;
    var fromLabel = a.t ? "From" : (a.gl ? "Per hour" : "Per person");
    var imgSrc = a.f || ("img/activities/" + slug(a.n) + ".webp");
    return '<article class="ar-card ar-card-preview" role="button" tabindex="0" aria-haspopup="dialog" aria-label="View details: ' + a.n + '" data-cat="' + a.c + '" data-slug="' + slug(a.n) + '">' +
      '<div class="ar-media">' + (a.f ? '<img loading="lazy" decoding="async" src="' + imgSrc + '" alt="' + a.n + '" />' : "") +
      '<span class="ar-badge">' + CAT_NAME[a.c] + '</span>' +
      '<div class="ar-cap"><div class="ar-cap-l"><h3>' + a.n + '</h3>' +
      '<div class="ar-cap-price"><em>' + fromLabel + '</em>' + price(from) + '<span class="ar-per">' + (a.gl ? "/hr" : "/person") + '</span></div>' +
      '<span class="ar-sub">' + clock + a.d + '</span></div></div></div>' +
      "</article>";
  }

  root.innerHTML =
    '<div class="ar-tabs-wrap"><div class="ar-tabs" role="tablist" aria-label="Activity categories"><span class="ar-ind" aria-hidden="true"></span>' +
    CATS.map(function (c, k) { return '<button type="button" role="tab" class="ar-tab' + (k === 0 ? " is-active" : "") + '" data-cat="' + c.id + '" aria-selected="' + (k === 0) + '" aria-label="' + (c.full || c.label) + '" title="' + (c.full || c.label) + '"><span class="ar-tab-ico">' + catIcon(c.id) + '</span><span class="ar-tab-txt">' + c.label + "</span></button>"; }).join("") +
    "</div></div>" +
    '<p class="ar-cat-label" aria-live="polite">' + (CATS[0].full || CATS[0].label) + "</p>" +
    '<div class="ar-grid">' + DATA.map(function (a) { return card(a); }).join("") + "</div>" +
    '<p class="ar-note">All rates are in US dollars, per person, and subject to a 10% service charge.</p>';

  // temporary placeholder if the real photo is not uploaded yet
  var byName = {}; DATA.forEach(function (a) { byName[slug(a.n)] = a; });
  root.querySelectorAll(".ar-card img").forEach(function (im) {
    // 1) img/activities/<slug>.webp  ->  2) existing site photo (f)  ->  3) empty frame
    var stage = 0;
    im.addEventListener("error", function () {
      var a = byName[im.closest(".ar-card").getAttribute("data-slug")];
      stage++;
      if (stage === 1 && a.f) im.src = a.f;
      else im.remove(); // no photo yet: leave the empty frame
    });
  });

  var tabs = root.querySelector(".ar-tabs"), ind = root.querySelector(".ar-ind"), cards = [].slice.call(root.querySelectorAll(".ar-card"));
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function moveInd(btn) {
    ind.style.width = btn.offsetWidth + "px";
    ind.style.transform = "translateX(" + btn.offsetLeft + "px)";
    if (tabs.scrollWidth > tabs.clientWidth) tabs.scrollTo({ left: btn.offsetLeft - 16, behavior: "smooth" });
  }

  function count(el) {
    var end = +el.getAttribute("data-count");
    if (reduce) { el.textContent = end; return; }
    var t0 = null, dur = 900;
    (function step(t) {
      if (t0 === null) t0 = t;
      var p = Math.min((t - t0) / dur, 1), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(end * e);
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  function show(card, delay) {
    card.style.setProperty("--d", delay + "ms");
    card.classList.add("is-in");
    card.querySelectorAll("[data-count]").forEach(function (el) { setTimeout(function () { count(el); }, delay + 250); });
  }

  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    var n = 0;
    es.forEach(function (e) { if (e.isIntersecting && !e.target.hidden) { show(e.target, (n++) * 90); io.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }) : null;

  function observeAll() { cards.forEach(function (c) { if (io) io.observe(c); else show(c, 0); }); }
  observeAll();

  tabs.addEventListener("click", function (e) {
    var b = e.target.closest(".ar-tab"); if (!b || b.classList.contains("is-active")) return;
    tabs.querySelectorAll(".ar-tab").forEach(function (x) { var on = x === b; x.classList.toggle("is-active", on); x.setAttribute("aria-selected", on); });
    moveInd(b);
    var capEl = root.querySelector(".ar-cat-label"); if (capEl) capEl.textContent = b.getAttribute("aria-label");
    var cat = b.getAttribute("data-cat"), n = 0;
    cards.forEach(function (c) {
      if (io) io.unobserve(c);
      c.classList.remove("is-in");
      c.hidden = !(cat === "all" || c.getAttribute("data-cat") === cat);
    });
    void root.offsetWidth;
    cards.forEach(function (c) { if (!c.hidden) show(c, (n++) * 80); });
  });

  // Deep link from the homepage "Browse Activities" tiles: ?cat=snorkel#activity-rates
  // selects that category tab on load instead of defaulting to "All".
  var wantCat = new URLSearchParams(window.location.search).get("cat");
  if (wantCat) {
    var wantBtn = tabs.querySelector('.ar-tab[data-cat="' + wantCat + '"]');
    if (wantBtn) wantBtn.click();
  }

  var first = tabs.querySelector(".is-active");
  requestAnimationFrame(function () { moveInd(first); });
  window.addEventListener("resize", function () { moveInd(tabs.querySelector(".is-active")); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveInd(tabs.querySelector(".is-active")); });

  /* ---------- Details modal (opens when a card is tapped/clicked) ---------- */
  var WA = "9609898130";
  var modal = document.createElement("div");
  modal.className = "ar-modal";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = '<div class="ar-modal-backdrop" data-close></div><div class="ar-modal-panel" tabindex="-1"></div>';
  document.body.appendChild(modal);
  var panel = modal.querySelector(".ar-modal-panel"), lastFocus = null;

  function openModal(a, from) {
    var lab = a.t ? "From" : (a.gl ? "Per hour" : "Per person");
    var msg = "Hi Dhaankolhu Rasdhoo, I'd like to book the " + a.n + " activity.";
    var arrow = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    panel.innerHTML =
      '<button type="button" class="ar-modal-x" data-close aria-label="Close">' +
        '<svg class="ico-x" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '<svg class="ico-back" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg></button>' +
      '<div class="ar-modal-scroll">' +
        '<div class="ar-modal-media"><span class="ar-modal-ph">' + catIcon(a.c) + '</span><img alt="' + a.n + '" decoding="async" />' +
          '<div class="ar-modal-head"><span class="ar-modal-cat">' + CAT_NAME[a.c] + '</span><h3>' + a.n + '</h3>' +
          '<span class="ar-sub">' + clock + a.d + (a.note ? " &nbsp;·&nbsp; " + a.note : "") + '</span></div></div>' +
        '<div class="ar-modal-body">' +
          '<p class="ar-modal-label">Rates <em>· ' + lab + ' $' + (a.t ? Math.min.apply(null, a.t) : a.g) + '</em></p>' + tiersHtml(a) +
          '<p class="ar-modal-label">What\'s included</p>' +
          '<ul class="ar-incl">' + a.i.map(function (x) { return "<li>" + x + "</li>"; }).join("") + '</ul>' +
          '<p class="ar-modal-note">Rates are in US dollars, per person, and subject to a 10% service charge.</p>' +
        '</div>' +
      '</div>' +
      '<div class="ar-modal-foot"><a class="ar-book ar-modal-book" href="https://wa.me/' + WA + '?text=' + encodeURIComponent(msg) + '" target="_blank" rel="noopener">Book on WhatsApp ' + arrow + '</a></div>';

    // photo: img/activities/<slug>.webp -> site photo (f) -> gradient + icon placeholder
    var im = panel.querySelector(".ar-modal-media img"), stage = 0;
    im.addEventListener("error", function () { stage++; if (stage === 1 && a.f) im.src = a.f; else im.remove(); });
    im.src = "img/activities/" + slug(a.n) + ".webp";

    lastFocus = from || document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("ar-modal-lock");
    panel.querySelector(".ar-modal-scroll").scrollTop = 0;
    panel.focus({ preventScroll: true });
  }

  function closeModal() {
    if (!modal.classList.contains("is-open")) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("ar-modal-lock");
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  modal.addEventListener("click", function (e) { if (e.target.closest("[data-close]")) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  function openFromCard(c) { var a = byName[c.getAttribute("data-slug")]; if (a) openModal(a, c); }
  root.querySelector(".ar-grid").addEventListener("click", function (e) {
    var c = e.target.closest(".ar-card"); if (c) openFromCard(c);
  });
  root.querySelector(".ar-grid").addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var c = e.target.closest(".ar-card"); if (!c) return;
    e.preventDefault(); openFromCard(c);
  });

  /* ---------- Homepage "Experience" teaser: a horizontal, scroll-snap
     carousel of a curated set of activity-rate cards (DATA items flagged
     feat: true), reusing the exact same card markup/styling and the same
     details modal as the full Activity Rates grid above — single source
     of truth, no separate content to keep in sync. ---------- */
  var expTrack = document.getElementById("experience-rates-track");
  if (expTrack) {
    // Only activities with a real photo (a.f) — items without one yet
    // (Beach Dinner, Sandbank Dinner, Island Hopping, Madivaru Camping,
    // Hanifaru Bay Manta) still show below in the full Activity Rates grid,
    // just not here where a blank/imageless card would look broken.
    expTrack.innerHTML = DATA.filter(function (a) { return a.f; }).map(previewCard).join("");

    var expPrev = document.getElementById("experience-rates-prev");
    var expNext = document.getElementById("experience-rates-next");

    // Page-style step like the sample: move (visible cards - 1) at a time,
    // so the row always lands on whole cards.
    function expCardStep() {
      var first = expTrack.querySelector(".ar-card");
      if (!first) return 320;
      var style = window.getComputedStyle(expTrack);
      var gap = parseFloat(style.columnGap || style.gap || "0") || 0;
      var w = first.getBoundingClientRect().width + gap;
      var visible = Math.max(1, Math.round((expTrack.clientWidth + gap) / w));
      return w * Math.max(1, visible - 1);
    }
    function expUpdateArrows() {
      var max = expTrack.scrollWidth - expTrack.clientWidth - 2;
      expPrev.disabled = expTrack.scrollLeft <= 2;
      expNext.disabled = expTrack.scrollLeft >= max;
    }
    if (expPrev && expNext) {
      expPrev.addEventListener("click", function () { window.arSlideBy(expTrack, -expCardStep()); });
      expNext.addEventListener("click", function () { window.arSlideBy(expTrack, expCardStep()); });
      expTrack.addEventListener("scroll", function () {
        window.clearTimeout(expTrack._t);
        expTrack._t = window.setTimeout(expUpdateArrows, 80);
      });
      window.addEventListener("resize", expUpdateArrows);
      expUpdateArrows();
    }

    expTrack.addEventListener("click", function (e) {
      var c = e.target.closest(".ar-card"); if (c) openFromCard(c);
    });
    expTrack.addEventListener("keydown", function (e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      var c = e.target.closest(".ar-card"); if (!c) return;
      e.preventDefault(); openFromCard(c);
    });

    // Reveal + count-up: same fade/rise + price count-up treatment as the
    // main grid, but on a per-track basis (no tab filtering here).
    // Reveal ONCE when the carousel first scrolls into view (blur -> sharp,
    // staggered). All cards are revealed together so nothing pops in
    // later while sliding left/right.
    var expCards = [].slice.call(expTrack.querySelectorAll(".ar-card"));
    function expRevealAll() {
      expCards.forEach(function (c, k) { show(c, Math.min(k, 4) * 90); });
    }
    var expIo = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { expRevealAll(); expIo.disconnect(); }
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }) : null;
    if (expIo) expCards.forEach(function (c) { expIo.observe(c); }); else expRevealAll();
  }
})();


/* ---------- Island-categories grid entrance (sample-style, GPU-friendly) ----------
   Independent of the Activity Rates code above; only runs on pages that
   have .activity-theme-grid (the homepage). Animates opacity/transform only:
   the grid keeps its final layout the whole time. */
(function () {
  var grid = document.querySelector(".activity-theme-grid");
  if (!grid) return;
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var feat = grid.querySelector(".activity-theme-featured");
  var cells = [].slice.call(grid.querySelectorAll(".activity-theme-cell"));
  if (!feat || cells.length < 4 || !("IntersectionObserver" in window)) return;

  var wide = window.matchMedia("(min-width: 901px)");
  var first = cells[0], last = cells[3];
  first.classList.add("atg-first");

  // featured copy: eyebrow, each title word, CTA blur in one after another
  var words = [];
  var eyebrow = feat.querySelector(".eyebrow");
  var title = feat.querySelector(".activity-theme-featured-title");
  var cta = feat.querySelector(".activity-theme-cta");
  if (eyebrow) words.push(eyebrow);
  if (title) {
    var parts = title.textContent.trim().split(/\s+/);
    title.textContent = "";
    parts.forEach(function (w, k) {
      var sp = document.createElement("span");
      sp.textContent = w;
      title.appendChild(sp);
      if (k < parts.length - 1) title.appendChild(document.createTextNode(" "));
      words.push(sp);
    });
  }
  if (cta) words.push(cta);
  words.forEach(function (el, i) { el.classList.add("atg-w"); el.style.setProperty("--wd", (260 + i * 110) + "ms"); });

  // The first tile starts scaled up (top-left anchored) to cover the whole
  // right-hand block (its cell + the 3 others). Cell and block have almost
  // the same aspect ratio, so a plain scale() looks undistorted.
  function measure() {
    if (!wide.matches) return;
    var w = first.offsetWidth, h = first.offsetHeight;
    if (!w || !h) return;
    var bw = (last.offsetLeft + last.offsetWidth) - first.offsetLeft;
    var bh = (last.offsetTop + last.offsetHeight) - first.offsetTop;
    grid.style.setProperty("--atg-sx", (bw / w).toFixed(4));
    grid.style.setProperty("--atg-sy", (bh / h).toFixed(4));
  }
  function reveal(el, delay) { setTimeout(function () { el.classList.add("is-in"); }, delay); }

  var started = false;
  function run() {
    if (started) return; started = true;
    measure();
    grid.classList.add("atg-go");
    feat.classList.add("is-in");
    first.classList.add("is-in");
    if (!wide.matches) {               // phones/tablets: simple staggered fade-in
      cells.slice(1).forEach(function (c, i) { reveal(c, 300 + i * 160); });
      setTimeout(finish, 2000);
      return;
    }
    setTimeout(function () {
      measure();
      first.classList.add("is-morph");
      reveal(cells[1], 560); reveal(cells[2], 790); reveal(cells[3], 1020);
      setTimeout(finish, 2100);
    }, 1300);
  }
  // drop the helper classes so the grid is back to plain CSS (free layers)
  function finish() {
    grid.classList.remove("atg-js", "atg-wide", "atg-go");
    first.classList.remove("atg-first", "is-morph");
    first.style.willChange = "auto";
  }

  /* Phones/tablets: each piece animates the moment IT scrolls into view
     (the old single trigger fired when only the top edge was visible, so
     the tiles below had already finished animating before the visitor ever
     saw them). Featured card rises in, tiles slide in from alternating
     sides, pieces entering together are staggered. */
  if (!wide.matches) {
    started = true;
    cells.forEach(function (c, i) { c.style.setProperty("--atg-x", i % 2 === 0 ? "-46px" : "46px"); });
    grid.classList.add("atg-js");
    var pending = 1 + cells.length;
    var mIO = new IntersectionObserver(function (es) {
      var batch = es.filter(function (e) { return e.isIntersecting; }).sort(function (a, b) {
        return (a.boundingClientRect.top - b.boundingClientRect.top) || (a.boundingClientRect.left - b.boundingClientRect.left);
      });
      batch.forEach(function (e, i) {
        var el = e.target;
        mIO.unobserve(el);
        setTimeout(function () {
          el.classList.add("is-in");
          if (el === feat) grid.classList.add("atg-go");
        }, i * 180);
        pending--;
      });
      if (pending <= 0) setTimeout(finish, 2200);
    }, { threshold: 0.3, rootMargin: "0px 0px -8% 0px" });
    mIO.observe(feat);
    cells.forEach(function (c) { mIO.observe(c); });
    return;
  }

  if (wide.matches) grid.classList.add("atg-wide");
  measure();
  grid.classList.add("atg-js");
  window.addEventListener("resize", function () { if (!started) { grid.classList.toggle("atg-wide", wide.matches); measure(); } });
  var io = new IntersectionObserver(function (es) {
    if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); run(); }
  }, { threshold: 0.2 });
  io.observe(grid);
})();


/* ---------- Accommodation carousel (homepage #rooms-track) ----------
   Same behaviour as the Experience carousel: whole-card page steps, native
   smooth scroll-snap, one-time fade/scale reveal. Only runs where present. */
(function () {
  var track = document.getElementById("rooms-track");
  if (!track) return;
  var wrap = document.getElementById("rooms-carousel");
  var prev = document.getElementById("rooms-prev");
  var next = document.getElementById("rooms-next");
  var cards = [].slice.call(track.querySelectorAll(".ar-card"));

  function step() {
    var first = track.querySelector(".ar-card");
    if (!first) return 320;
    var cs = getComputedStyle(track);
    var gap = parseFloat(cs.columnGap || cs.gap || "0") || 0;
    var w = first.getBoundingClientRect().width + gap;
    var visible = Math.max(1, Math.round((track.clientWidth + gap) / w));
    return w * Math.max(1, visible - 1);
  }
  function update() {
    var max = track.scrollWidth - track.clientWidth - 2;
    if (wrap) wrap.classList.toggle("is-static", max <= 0);
    if (prev) prev.disabled = track.scrollLeft <= 2;
    if (next) next.disabled = track.scrollLeft >= max;
  }
  if (prev && next) {
    prev.addEventListener("click", function () { window.arSlideBy(track, -step()); });
    next.addEventListener("click", function () { window.arSlideBy(track, step()); });
    track.addEventListener("scroll", function () {
      window.clearTimeout(track._t);
      track._t = window.setTimeout(update, 80);
    }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  function revealAll() { cards.forEach(function (c, k) { c.style.setProperty("--d", Math.min(k, 4) * 90 + "ms"); c.classList.add("is-in"); }); }
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { revealAll(); io.disconnect(); }
    }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
    cards.forEach(function (c) { io.observe(c); });
  } else { revealAll(); }
})();
