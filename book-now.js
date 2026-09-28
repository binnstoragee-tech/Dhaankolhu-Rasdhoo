/* Book Now — Dhaankolhu Rasdhoo Island: step flow, live booking summary ticket, rise-up transitions. */
(function () {
  "use strict";

  /* ==========================================================================
     Smooth cross-page transitions (matches script.js on the main site) —
     fades this page IN on load, and fades OUT before navigating to another
     page (e.g. tapping the logo or a nav link back to index.html).
     ========================================================================== */
  var PAGE_TRANSITION_MS = 220;

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

  /* Same quick, smooth lazy-image fade-in as script.js (room photos, footer
     mark, chat icons, and the dynamically-sourced FLIP room-expand image) —
     300ms fade instead of an abrupt pop, skipped entirely for anything
     already cached so it never feels like an added delay. */
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

  /* ---------- header + mobile menu (matches script.js on the main site) ---------- */
  var header = document.getElementById("site-header");
  var menu = document.getElementById("mobile-menu");
  var menuTrigger = document.getElementById("menu-trigger");

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

  /* No hero image on this page anymore, so the header should always use its solid
     "scrolled" style (dark text on white) rather than the transparent variant meant
     to sit on top of a dark hero photo. */
  header.classList.add("is-scrolled");

  /* hide navbar when scrolling down, reveal it again on scroll up — matches
     the behavior in script.js on the main site.
     NOTE: the step-transition auto-close (hideHeaderForStep) stays disabled
     below — header only reacts to scroll direction now, not to step changes. */
  var scrollTicking = false;
  var lastScrollY = window.scrollY;
  var HIDE_AFTER = 120;
  function applyHeaderScrollState() {
    var currentY = window.scrollY;
    var scrollingUp = currentY < lastScrollY;
    var scrollingDown = currentY > lastScrollY;
    if (scrollingUp) {
      header.classList.remove("is-hidden");
      header.classList.remove("is-drawer-hidden");
    } else if (scrollingDown && currentY > HIDE_AFTER && !menu.classList.contains("is-open")) {
      header.classList.add("is-hidden");
    }
    lastScrollY = currentY;
    scrollTicking = false;
  }

  /* closes the header like a drawer — smooth 1.5s slide-up — the moment the
     person starts moving through the booking steps (Next button or tapping
     a rail tab), regardless of current scroll position. It only reopens on
     an explicit scroll-up (handled in applyHeaderScrollState above).
     NOTE: disabled per request — header stays visible through step changes. */
  function hideHeaderForStep() {
    header.classList.remove("is-drawer-hidden");
    header.classList.remove("is-hidden");
  }

  window.addEventListener("scroll", function () {
    if (menu.classList.contains("is-open")) setMenu(false);
    if (!scrollTicking) {
      window.requestAnimationFrame(applyHeaderScrollState);
      scrollTicking = true;
    }
  }, { passive: true });

  menuTrigger.addEventListener("click", function () {
    header.classList.remove("is-hidden");
    header.classList.remove("is-drawer-hidden");
    setMenu(!menu.classList.contains("is-open"));
  });
  document.querySelectorAll(".mobile-menu a").forEach(function (link) {
    link.addEventListener("click", function () { setMenu(false); });
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setMenu(false);
  });
  document.querySelectorAll(".js-scroll-top").forEach(function (button) {
    button.addEventListener("click", function () {
      setMenu(false);
      var target = document.getElementById("booking-flow");
      if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  /* ---------- scroll reveal (below-the-fold content) ---------- */
  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(function (node) { revealObserver.observe(node); });

  /* ---------- hero rise-in on load ---------- */
  document.querySelectorAll(".bk-hero-content .rise").forEach(function (node, index) {
    window.setTimeout(function () { node.classList.add("is-up"); }, 220 + index * 140);
  });

  /* ================================================================
     Booking flow
     ================================================================ */
  var form = document.getElementById("bk-form");
  var panel = document.querySelector(".bk-panel");
  var bkGrid = document.querySelector(".bk-grid");
  var successView = document.getElementById("bk-success");
  var nextBtn = document.getElementById("bk-next");
  var actions = document.getElementById("bk-actions");

  /* keep the 5-step rail + top of the booking panel in view on every step
     change (Next, or a rail-tab click), so people always land back up top
     instead of wherever the previous step happened to be scrolled to */
  var bkRailOuter = document.querySelector(".bk-rail-outer");
  function scrollPanelIntoView() {
    var anchor = bkRailOuter || panel;
    if (!anchor) return;
    /* the fixed site header is ~106px tall once scrolled — this offset has
       to clear that plus a bit of breathing room, or the rail lands
       partly hidden behind/flush against the navbar instead of just below it */
    var headerOffset = 130;
    var top = anchor.getBoundingClientRect().top + window.pageYOffset - headerOffset;
    window.scrollTo({ top: top, behavior: "smooth" });
  }
  var railSteps = document.querySelectorAll(".bk-rail-step");
  var railEl = document.getElementById("bk-rail");
  var railIndicator = document.getElementById("bk-rail") ? document.querySelector(".bk-rail-indicator") : null;
  var reviewList = document.getElementById("bk-review-list");
  var reviewDownloadLink = document.getElementById("bk-review-download-link");

  var arrivalInput = document.getElementById("bk-arrival");
  var departureInput = document.getElementById("bk-departure");
  var arrivalTrigger = document.getElementById("bk-arrival-trigger");
  var departureTrigger = document.getElementById("bk-departure-trigger");
  var arrivalTimeInput = document.getElementById("bk-arrival-time");
  var departureTimeInput = document.getElementById("bk-departure-time");
  var roomGrid = document.getElementById("bk-room-grid");
  var paxInput = document.getElementById("bk-pax");
  var paxMinus = document.getElementById("bk-pax-minus");
  var paxPlus = document.getElementById("bk-pax-plus");
  var occupancyNote = document.getElementById("bk-occupancy-note");
  var nameInput = document.getElementById("bk-name");
  var emailInput = document.getElementById("bk-email");
  var phoneInput = document.getElementById("bk-phone");

  var ticketTotalEl = document.getElementById("bk-ticket-total");
  var ticketCodeEl = document.getElementById("bk-ticket-code");

  var state = { arrival: "", departure: "", arrivalTime: "14:00", departureTime: "12:00", room: null, price: 0, pax: 0, name: "", email: "", phone: "", country: "" };
  var currentStep = 1;
  var TOTAL_STEPS = 4;
  var pdfDownloaded = false;

  /* ---------- draft persistence (so filled-in info survives back/forward nav and reloads) ---------- */
  var DRAFT_KEY = "dhaankolhuBookingDraft";

  function saveDraft() {
    try {
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
        state: state,
        currentStep: currentStep,
        maxStepReached: maxStepReached,
        selectedPhoneCode: selectedPhoneCode
      }));
    } catch (err) {
      /* storage unavailable (private mode, quota, etc.) — fail silently */
    }
  }

  function clearDraft() {
    try { window.localStorage.removeItem(DRAFT_KEY); } catch (err) { /* ignore */ }
  }

  function loadDraft() {
    try {
      var raw = window.localStorage.getItem(DRAFT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  /* today as the earliest selectable date */
  var todayStr = (function () {
    var now = new Date();
    return toISO(now.getFullYear(), now.getMonth(), now.getDate());
  })();

  /* ---------- dates ---------- */
  arrivalInput.addEventListener("change", function () {
    state.arrival = arrivalInput.value;
    validateStep();
    updateTicket("dates");
    saveDraft();
  });
  departureInput.addEventListener("change", function () {
    state.departure = departureInput.value;
    validateStep();
    updateTicket("dates");
    saveDraft();
  });
  arrivalTimeInput.addEventListener("change", function () {
    state.arrivalTime = arrivalTimeInput.value;
    updateTicket("dates");
    saveDraft();
  });
  departureTimeInput.addEventListener("change", function () {
    state.departureTime = departureTimeInput.value;
    updateTicket("dates");
    saveDraft();
  });

  /* ---------- custom calendar dropdown ----------
     Was previously a native <input type="date">, which hands its popup
     entirely to the browser — but on mobile Chrome that popup's own
     positioning/hit-testing turned out to be fragile (see the
     .bk-step.is-current fix above: any ancestor transform threw it off,
     so dates painted fine but silently didn't register taps). This
     version is a plain, self-built panel: same look on every phone and
     desktop browser by construction, because we're the ones placing it
     and handling its clicks — no browser-specific popup behavior left to
     break. The two <input type="hidden"> fields (#bk-arrival /
     #bk-departure) stay the source of truth for the rest of this file —
     everything downstream (state.arrival/departure, syncDepartureMin,
     validation, the draft, the ticket) still just reads their ISO
     .value and reacts to their "change" event, unchanged. */

  function toISO(y, m, d) {
    var mm = String(m + 1).padStart(2, "0");
    var dd = String(d).padStart(2, "0");
    return y + "-" + mm + "-" + dd;
  }

  function parseISO(iso) {
    var parts = (iso || "").split("-");
    return { y: Number(parts[0]), m: Number(parts[1]) - 1, d: Number(parts[2]) };
  }

  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function formatDisplayDate(iso) {
    if (!iso) return "";
    var p = parseISO(iso);
    return p.d + " " + MONTH_NAMES[p.m].slice(0, 3) + " " + p.y;
  }

  function to12Hour(hhmm) {
    var parts = (hhmm || "12:00").split(":");
    var h = Number(parts[0]);
    var m = parts[1] || "00";
    var period = h >= 12 ? "PM" : "AM";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return { hour: String(h12), minute: m, period: period };
  }

  function formatTime(hhmm) {
    if (!hhmm) return "";
    var t = to12Hour(hhmm);
    return t.hour + ":" + t.minute + " " + t.period;
  }

  function syncDepartureMin() {
    departureInput.min = arrivalInput.value || todayStr;
    /* if departure is no longer after the (possibly new) arrival, clear it */
    if (departureInput.value && departureInput.value <= arrivalInput.value) {
      departureInput.value = "";
      departureInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
    departureCal.setMin(departureInput.min);
  }

  /* ---- one shared panel, reused for whichever field is currently open ---- */
  var calPanel = document.createElement("div");
  calPanel.className = "bk-cal";
  calPanel.setAttribute("role", "dialog");
  calPanel.innerHTML =
    '<div class="bk-cal-head">' +
      '<button type="button" class="bk-cal-nav" data-cal-prev aria-label="Previous month"><svg viewBox="0 0 24 24" fill="none"><path d="M15 5L8 12L15 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
      '<span class="bk-cal-title" data-cal-title></span>' +
      '<button type="button" class="bk-cal-nav" data-cal-next aria-label="Next month"><svg viewBox="0 0 24 24" fill="none"><path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    '</div>' +
    '<div class="bk-cal-weekdays"><span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span></div>' +
    '<div class="bk-cal-grid" data-cal-grid></div>';
  document.body.appendChild(calPanel);

  var calTitleEl = calPanel.querySelector("[data-cal-title]");
  var calGridEl = calPanel.querySelector("[data-cal-grid]");
  var calPrevBtn = calPanel.querySelector("[data-cal-prev]");
  var calNextBtn = calPanel.querySelector("[data-cal-next]");

  var activeCal = null; /* the field-controller currently driving the shared panel */

  function positionCalPanel(triggerEl) {
    var rect = triggerEl.getBoundingClientRect();
    var gap = 8;
    var top = rect.bottom + gap;
    var left = rect.left;
    var panelWidth = calPanel.offsetWidth || 296;
    var maxLeft = window.innerWidth - panelWidth - 8;
    if (left > maxLeft) left = Math.max(8, maxLeft);
    /* not enough room below (e.g. field near the bottom of a short mobile
       viewport) — open upward instead so the panel stays fully visible */
    var panelHeight = calPanel.offsetHeight || 320;
    if (top + panelHeight > window.innerHeight - 8 && rect.top - gap - panelHeight > 8) {
      top = rect.top - gap - panelHeight;
    }
    calPanel.style.top = top + "px";
    calPanel.style.left = left + "px";
  }

  function createCalendar(config) {
    /* config: { triggerEl, hiddenInput, min } */
    var controller = {
      min: config.min || todayStr,
      viewY: 0,
      viewM: 0,
      triggerEl: config.triggerEl,
      hiddenInput: config.hiddenInput
    };

    controller.render = function () {
      calTitleEl.textContent = MONTH_NAMES[controller.viewM] + " " + controller.viewY;
      var firstOfMonth = new Date(controller.viewY, controller.viewM, 1);
      var startWeekday = firstOfMonth.getDay();
      var daysInMonth = new Date(controller.viewY, controller.viewM + 1, 0).getDate();
      var daysInPrevMonth = new Date(controller.viewY, controller.viewM, 0).getDate();
      var selected = controller.hiddenInput.value;
      var min = controller.min;

      var cellsHtml = "";
      for (var i = 0; i < 42; i++) {
        var dayNum = i - startWeekday + 1;
        var cellY = controller.viewY, cellM = controller.viewM, isOutside = false;
        if (dayNum < 1) {
          cellM = controller.viewM - 1; cellY = cellM < 0 ? controller.viewY - 1 : controller.viewY; cellM = (cellM + 12) % 12;
          dayNum = daysInPrevMonth + dayNum;
          isOutside = true;
        } else if (dayNum > daysInMonth) {
          dayNum = dayNum - daysInMonth;
          cellM = controller.viewM + 1; cellY = cellM > 11 ? controller.viewY + 1 : controller.viewY; cellM = cellM % 12;
          isOutside = true;
        }
        var iso = toISO(cellY, cellM, dayNum);
        var disabled = iso < min;
        var classes = "bk-cal-day";
        if (isOutside) classes += " is-outside";
        if (iso === todayStr) classes += " is-today";
        if (iso === selected) classes += " is-selected";
        cellsHtml += '<button type="button" class="' + classes + '" data-iso="' + iso + '"' + (disabled ? " disabled" : "") + '>' + dayNum + "</button>";
      }
      calGridEl.innerHTML = cellsHtml;

      var minParsed = parseISO(min);
      calPrevBtn.disabled = (controller.viewY < minParsed.y) || (controller.viewY === minParsed.y && controller.viewM <= minParsed.m);
    };

    controller.gotoMonth = function (y, m) {
      if (m < 0) { m = 11; y -= 1; }
      if (m > 11) { m = 0; y += 1; }
      controller.viewY = y; controller.viewM = m;
      controller.render();
    };

    controller.open = function () {
      var base = controller.hiddenInput.value || controller.min;
      var p = parseISO(base);
      controller.viewY = p.y; controller.viewM = p.m;
      activeCal = controller;
      controller.render();
      calPanel.classList.add("is-open");
      controller.triggerEl.classList.add("is-open");
      controller.triggerEl.setAttribute("aria-expanded", "true");
      positionCalPanel(controller.triggerEl);
      /* recompute once real layout has settled (panel just became visible) */
      window.requestAnimationFrame(function () { positionCalPanel(controller.triggerEl); });
    };

    controller.close = function () {
      if (activeCal !== controller) return;
      calPanel.classList.remove("is-open");
      controller.triggerEl.classList.remove("is-open");
      controller.triggerEl.setAttribute("aria-expanded", "false");
      activeCal = null;
    };

    controller.setValue = function (iso) {
      controller.hiddenInput.value = iso;
      controller.triggerEl.textContent = iso ? formatDisplayDate(iso) : "dd/mm/yyyy";
      controller.triggerEl.setAttribute("data-empty", iso ? "false" : "true");
      controller.hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
    };

    controller.setMin = function (newMin) {
      controller.min = newMin || todayStr;
      if (activeCal === controller) controller.render();
    };

    return controller;
  }

  var arrivalCal = createCalendar({ triggerEl: arrivalTrigger, hiddenInput: arrivalInput, min: todayStr });
  var departureCal = createCalendar({ triggerEl: departureTrigger, hiddenInput: departureInput, min: todayStr });

  /* keep departure's own min (and its selected value, if it's no longer
     valid) in sync every time arrival changes — same rule as before */
  arrivalInput.addEventListener("change", syncDepartureMin);

  arrivalTrigger.addEventListener("click", function (event) {
    event.stopPropagation();
    if (activeCal === arrivalCal) { arrivalCal.close(); return; }
    arrivalCal.open();
  });
  departureTrigger.addEventListener("click", function (event) {
    event.stopPropagation();
    if (activeCal === departureCal) { departureCal.close(); return; }
    departureCal.open();
  });

  calGridEl.addEventListener("click", function (event) {
    var btn = event.target.closest(".bk-cal-day");
    if (!btn || btn.disabled || !activeCal) return;
    var wasArrival = activeCal === arrivalCal;
    activeCal.setValue(btn.getAttribute("data-iso"));
    activeCal.close();
    /* guide the guest into picking the departure date next, same flow as
       the previous native-picker version */
    if (wasArrival) {
      window.setTimeout(function () { departureCal.open(); }, 150);
    }
  });
  calPrevBtn.addEventListener("click", function () {
    if (activeCal) activeCal.gotoMonth(activeCal.viewY, activeCal.viewM - 1);
  });
  calNextBtn.addEventListener("click", function () {
    if (activeCal) activeCal.gotoMonth(activeCal.viewY, activeCal.viewM + 1);
  });

  document.addEventListener("click", function (event) {
    if (!activeCal) return;
    if (calPanel.contains(event.target) || event.target === arrivalTrigger || event.target === departureTrigger) return;
    activeCal.close();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && activeCal) activeCal.close();
  });
  window.addEventListener("scroll", function () {
    if (activeCal) positionCalPanel(activeCal.triggerEl);
  }, { passive: true, capture: true });
  window.addEventListener("resize", function () {
    if (activeCal) positionCalPanel(activeCal.triggerEl);
  });

  syncDepartureMin();


  /* ---------- room selection ---------- */
  roomGrid.addEventListener("click", function (event) {
    if (event.target.closest("a")) return; /* "More Details" link — let it navigate instead of selecting the room */
    var card = event.target.closest(".bk-room");
    if (!card) return;
    selectRoom(card);
  });
  roomGrid.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (event.target.closest("a")) return; /* let Enter on "More Details" follow the link normally */
    var card = event.target.closest(".bk-room");
    if (!card) return;
    event.preventDefault();
    selectRoom(card);
  });
  function selectRoom(card) {
    var alreadySelected = card.classList.contains("is-selected");
    roomGrid.querySelectorAll(".bk-room").forEach(function (r) {
      r.classList.remove("is-selected");
      r.setAttribute("aria-pressed", "false");
    });
    if (alreadySelected) {
      state.room = null;
      state.price = 0;
    } else {
      card.classList.add("is-selected");
      card.setAttribute("aria-pressed", "true");
      state.room = card.getAttribute("data-room");
      state.price = Number(card.getAttribute("data-price"));
    }
    validateStep();
    updateTicket("room");
    updateTicket("total");
    updateOccupancyNote();
    saveDraft();
  }

  /* ---------- number of pax + occupancy ----------
     Guests must state how many people are staying (required on Step 1). Some
     guests ask for a Double Room for single occupancy, so when a Double Room
     is chosen the request spells that out ("Single occupancy") instead of
     leaving the team to guess from the pax count. */
  var PAX_MAX = 10;

  function occupancyLabel() {
    /* Only the exception is worth flagging: a Double Room used by 1 guest.
       Normal double occupancy is already obvious from the room category. */
    if (state.room === "Double Room" && state.pax === 1) return "Single occupancy";
    return "";
  }

  function updateOccupancyNote() {
    if (!occupancyNote) return;
    var single = state.room === "Double Room" && state.pax === 1;
    occupancyNote.hidden = !single;
    occupancyNote.textContent = single
      ? "You're booking a Double Room for 1 guest \u2014 we'll send this as a single occupancy request."
      : "";
  }

  function updatePaxButtons() {
    if (paxMinus) paxMinus.disabled = !(state.pax > 1);
    if (paxPlus) paxPlus.disabled = state.pax >= PAX_MAX;
  }

  function setPax(n) {
    n = Math.max(0, Math.min(PAX_MAX, Number(n) || 0));
    state.pax = n;
    paxInput.value = n ? String(n) : "";
    updatePaxButtons();
    validateStep();
    updateTicket("pax");
    updateOccupancyNote();
    saveDraft();
  }

  paxPlus.addEventListener("click", function () { setPax((state.pax || 0) + 1); });
  paxMinus.addEventListener("click", function () { if (state.pax > 1) setPax(state.pax - 1); });
  paxInput.addEventListener("input", function () {
    var v = parseInt(paxInput.value, 10);
    if (isNaN(v)) v = 0;
    v = Math.max(0, Math.min(PAX_MAX, v));
    state.pax = v;
    updatePaxButtons();
    validateStep();
    updateTicket("pax");
    updateOccupancyNote();
    saveDraft();
  });
  paxInput.addEventListener("change", function () { setPax(state.pax); });
  updatePaxButtons();

  /* ---------- contact number: searchable country-code dropdown ---------- */
  var COUNTRY_CODES = [
    { name: "Maldives", flag: "🇲🇻", code: "+960", len: [7, 7] },
    { name: "United States", flag: "🇺🇸", code: "+1", len: [10, 10] },
    { name: "United Kingdom", flag: "🇬🇧", code: "+44", len: [10, 10] },
    { name: "Australia", flag: "🇦🇺", code: "+61", len: [9, 9] },
    { name: "New Zealand", flag: "🇳🇿", code: "+64", len: [8, 9] },
    { name: "Singapore", flag: "🇸🇬", code: "+65", len: [8, 8] },
    { name: "Malaysia", flag: "🇲🇾", code: "+60", len: [9, 10] },
    { name: "Thailand", flag: "🇹🇭", code: "+66", len: [9, 9] },
    { name: "Indonesia", flag: "🇮🇩", code: "+62", len: [9, 12] },
    { name: "Philippines", flag: "🇵🇭", code: "+63", len: [10, 10] },
    { name: "Vietnam", flag: "🇻🇳", code: "+84", len: [9, 9] },
    { name: "India", flag: "🇮🇳", code: "+91", len: [10, 10] },
    { name: "Pakistan", flag: "🇵🇰", code: "+92", len: [10, 10] },
    { name: "Bangladesh", flag: "🇧🇩", code: "+880", len: [10, 10] },
    { name: "Sri Lanka", flag: "🇱🇰", code: "+94", len: [9, 9] },
    { name: "United Arab Emirates", flag: "🇦🇪", code: "+971", len: [9, 9] },
    { name: "Saudi Arabia", flag: "🇸🇦", code: "+966", len: [9, 9] },
    { name: "Qatar", flag: "🇶🇦", code: "+974", len: [8, 8] },
    { name: "Bahrain", flag: "🇧🇭", code: "+973", len: [8, 8] },
    { name: "Kuwait", flag: "🇰🇼", code: "+965", len: [8, 8] },
    { name: "Oman", flag: "🇴🇲", code: "+968", len: [8, 8] },
    { name: "Egypt", flag: "🇪🇬", code: "+20", len: [10, 10] },
    { name: "South Africa", flag: "🇿🇦", code: "+27", len: [9, 9] },
    { name: "Japan", flag: "🇯🇵", code: "+81", len: [10, 10] },
    { name: "South Korea", flag: "🇰🇷", code: "+82", len: [9, 10] },
    { name: "China", flag: "🇨🇳", code: "+86", len: [11, 11] },
    { name: "Hong Kong", flag: "🇭🇰", code: "+852", len: [8, 8] },
    { name: "Taiwan", flag: "🇹🇼", code: "+886", len: [9, 9] },
    { name: "France", flag: "🇫🇷", code: "+33", len: [9, 9] },
    { name: "Germany", flag: "🇩🇪", code: "+49", len: [10, 11] },
    { name: "Italy", flag: "🇮🇹", code: "+39", len: [9, 10] },
    { name: "Spain", flag: "🇪🇸", code: "+34", len: [9, 9] },
    { name: "Netherlands", flag: "🇳🇱", code: "+31", len: [9, 9] },
    { name: "Switzerland", flag: "🇨🇭", code: "+41", len: [9, 9] },
    { name: "Sweden", flag: "🇸🇪", code: "+46", len: [7, 9] },
    { name: "Norway", flag: "🇳🇴", code: "+47", len: [8, 8] },
    { name: "Denmark", flag: "🇩🇰", code: "+45", len: [8, 8] },
    { name: "Russia", flag: "🇷🇺", code: "+7", len: [10, 10] },
    { name: "Turkey", flag: "🇹🇷", code: "+90", len: [10, 10] },
    { name: "Brazil", flag: "🇧🇷", code: "+55", len: [10, 11] },
    { name: "Mexico", flag: "🇲🇽", code: "+52", len: [10, 10] },
    { name: "Canada", flag: "🇨🇦", code: "+1", len: [10, 10] }
  ];

  var codeSelect = document.getElementById("bk-code-select");
  var codeTrigger = document.getElementById("bk-code-trigger");
  var codeFlagEl = document.getElementById("bk-code-flag");
  var codeValueEl = document.getElementById("bk-code-value");
  var codePanel = document.getElementById("bk-code-panel");
  var codeSearch = document.getElementById("bk-code-search");
  var codeList = document.getElementById("bk-code-list");
  var selectedPhoneCode = COUNTRY_CODES[0].code;
  paintFlags(codeFlagEl);

  /* Twemoji is fetched from a CDN, so on a slow connection it may not be ready
     yet when the line above runs — retry once everything has fully loaded so
     the default flag doesn't get stuck showing plain text (e.g. "MV"). */
  window.addEventListener("load", function () { paintFlags(codeFlagEl); });

  /* Windows doesn't render Unicode flag emoji as flags (shows plain letters like "PH"
     instead), so we use Twemoji to swap them for real flag icon images on every OS. */
  function paintFlags(root) {
    if (window.twemoji) window.twemoji.parse(root, { folder: "svg", ext: ".svg" });
  }

  function renderCodeList(query) {
    var q = (query || "").trim().toLowerCase();
    var matches = COUNTRY_CODES.filter(function (c) {
      return !q || c.name.toLowerCase().indexOf(q) !== -1 || c.code.indexOf(q) !== -1 || c.code.replace("+", "").indexOf(q) !== -1;
    });
    if (!matches.length) {
      codeList.innerHTML = '<div class="bk-code-empty">No matching country</div>';
      return;
    }
    codeList.innerHTML = matches.map(function (c) {
      return '<button type="button" class="bk-code-option" data-code="' + c.code + '" data-flag="' + c.flag + '">' +
        '<span class="bk-code-flag">' + c.flag + '</span>' +
        '<span class="bk-code-option-name">' + c.name + '</span>' +
        '<span class="bk-code-option-num">' + c.code + '</span>' +
        '</button>';
    }).join("");
    paintFlags(codeList);
  }

  function openCodePanel() {
    codeSelect.classList.add("is-open");
    codeTrigger.setAttribute("aria-expanded", "true");
    codeSearch.value = "";
    renderCodeList("");
    window.setTimeout(function () { codeSearch.focus(); }, 0);
  }

  function closeCodePanel() {
    codeSelect.classList.remove("is-open");
    codeTrigger.setAttribute("aria-expanded", "false");
  }

  codeTrigger.addEventListener("click", function () {
    if (codeSelect.classList.contains("is-open")) closeCodePanel();
    else openCodePanel();
  });

  codeSearch.addEventListener("input", function () { renderCodeList(codeSearch.value); });

  codeList.addEventListener("click", function (event) {
    var option = event.target.closest(".bk-code-option");
    if (!option) return;
    selectedPhoneCode = option.getAttribute("data-code");
    codeFlagEl.textContent = option.getAttribute("data-flag");
    codeValueEl.textContent = selectedPhoneCode;
    paintFlags(codeFlagEl);
    closeCodePanel();
    updatePhone();
    updatePhoneValidity();
    validateStep();
    updateTicket("phone");
    saveDraft();
  });

  document.addEventListener("click", function (event) {
    if (!codeSelect.contains(event.target)) closeCodePanel();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeCodePanel();
  });

  /* ---------- details ---------- */
  function updatePhone() {
    var digits = phoneInput.value.trim();
    state.phone = digits ? selectedPhoneCode + " " + digits : "";
  }

  var phoneRow = document.querySelector(".bk-phone-row");
  var phoneHintEl = document.getElementById("bk-phone-hint");
  var DEFAULT_PHONE_HINT = "Pick your country code, then type your number";

  function getSelectedCountry() {
    return COUNTRY_CODES.filter(function (c) { return c.code === selectedPhoneCode; })[0];
  }

  function isPhoneValid() {
    var digits = phoneInput.value.replace(/\D/g, "");
    if (!digits) return false;
    var country = getSelectedCountry();
    if (!country || !country.len) return digits.length >= 5;
    return digits.length >= country.len[0] && digits.length <= country.len[1];
  }

  function updatePhoneValidity() {
    var digits = phoneInput.value.replace(/\D/g, "");
    if (!digits) {
      if (phoneRow) phoneRow.classList.remove("is-invalid");
      if (phoneHintEl) { phoneHintEl.textContent = DEFAULT_PHONE_HINT; phoneHintEl.classList.remove("is-error"); }
      return;
    }
    var valid = isPhoneValid();
    if (phoneRow) phoneRow.classList.toggle("is-invalid", !valid);
    if (!phoneHintEl) return;
    if (valid) {
      phoneHintEl.textContent = DEFAULT_PHONE_HINT;
      phoneHintEl.classList.remove("is-error");
      return;
    }
    var country = getSelectedCountry();
    if (country && country.len) {
      var lo = country.len[0], hi = country.len[1];
      var expected = lo === hi ? (lo + " digits") : (lo + "\u2013" + hi + " digits");
      phoneHintEl.textContent = country.name + " numbers need " + expected + " after " + country.code + " \u2014 double-check the code and number match.";
    } else {
      phoneHintEl.textContent = "That doesn't look like a valid number for this country code.";
    }
    phoneHintEl.classList.add("is-error");
  }

  [nameInput, emailInput, phoneInput].forEach(function (input) {
    input.addEventListener("input", function () {
      state.name = nameInput.value.trim();
      state.email = emailInput.value.trim();
      updatePhone();
      updatePhoneValidity();
      validateStep();
      updateTicket("name");
      updateTicket("phone");
      saveDraft();
    });
  });

  /* ---------- ticket updates ---------- */
  function nights() {
    if (!state.arrival || !state.departure) return 0;
    var diff = (new Date(state.departure) - new Date(state.arrival)) / 86400000;
    return diff > 0 ? Math.round(diff) : 0;
  }
  function popValue(el) {
    el.classList.add("bk-value-pop");
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () { el.classList.remove("bk-value-pop"); });
    });
  }
  function setTicketRow(field, text, filled) {
    var row = document.querySelector('.bk-ticket-row[data-field="' + field + '"]');
    if (!row) return;
    row.classList.toggle("is-empty", !filled);
    var valueEl = row.querySelector("span:last-child");
    valueEl.textContent = text;
    popValue(valueEl);
  }
  function updateTicket(which) {
    if (!which || which === "dates") {
      var n = nights();
      if (state.arrival) {
        setTicketRow("checkin", formatDateTime(state.arrival, state.arrivalTime), true);
      } else {
        setTicketRow("checkin", "Select above", false);
      }
      if (state.departure) {
        setTicketRow("checkout", formatDateTime(state.departure, state.departureTime), true);
      } else {
        setTicketRow("checkout", "Select above", false);
      }
      if (state.arrival && state.departure && n > 0) {
        setTicketRow("nights", n + (n === 1 ? " night" : " nights"), true);
      } else {
        setTicketRow("nights", "—", false);
      }
    }
    if (!which || which === "pax") {
      setTicketRow("pax", state.pax ? String(state.pax) : "—", !!state.pax);
    }
    if (!which || which === "room") {
      setTicketRow("room", state.room || "Not chosen yet", !!state.room);
    }
    if (!which || which === "name") {
      setTicketRow("name", state.name || "—", !!state.name);
    }
    if (!which || which === "phone") {
      setTicketRow("phone", state.phone || "—", !!state.phone);
    }
    if (!which || which === "total") {
      var hasRoom = !!(state.room && state.price);
      var total = hasRoom && nights() ? state.price * nights() : 0;
      ticketTotalEl.textContent = hasRoom ? "$" + total.toLocaleString() + " +tax" : "—";
      popValue(ticketTotalEl);
    }
  }
  function formatDate(str) {
    var d = new Date(str + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function formatDateTime(str, timeStr) {
    if (!str) return "";
    return formatDate(str) + ", " + formatTime(timeStr);
  }

  /* keep total in sync whenever dates or room change */
  [arrivalInput, departureInput].forEach(function (input) {
    input.addEventListener("change", function () { updateTicket("total"); });
  });

  /* ---------- step validation ---------- */
  function validateStep() {
    var ok = true;
    if (currentStep === 1) {
      ok = !!(state.arrival && state.departure && nights() > 0 && state.pax > 0);
    } else if (currentStep === 2) {
      ok = !!state.room;
    } else if (currentStep === 3) {
      ok = !!(state.name && emailInput.checkValidity() && isPhoneValid());
    } else if (currentStep === 4) {
      ok = pdfDownloaded;
    }
    nextBtn.disabled = !ok;
    return ok;
  }

  /* ---------- rail (top step indicator — tappable once a step has been reached) ---------- */
  var maxStepReached = 1;

  function moveRailIndicator(activeBtn) {
    if (!railIndicator || !activeBtn || !railEl) return;
    var railRect = railEl.getBoundingClientRect();
    var btnRect = activeBtn.getBoundingClientRect();
    var offset = btnRect.left - railRect.left + railEl.scrollLeft;
    railIndicator.style.width = btnRect.width + "px";
    railIndicator.style.transform = "translateX(" + offset + "px)";
  }

  function updateRail(step) {
    var activeBtn = null;
    railSteps.forEach(function (btn) {
      var n = Number(btn.getAttribute("data-step"));
      var active = n === step;
      btn.classList.toggle("is-active", active);
      btn.classList.toggle("is-done", n < step);
      btn.disabled = n === 5 ? false : n > maxStepReached;
      if (active) activeBtn = btn;
    });
    if (activeBtn) {
      /* scroll the rail itself (not scrollIntoView, which can drag the
         whole page horizontally along with it) so only the tab strip
         shifts to center the active step, never the page content below */
      if (railEl) {
        var targetScroll = activeBtn.offsetLeft - (railEl.clientWidth - activeBtn.offsetWidth) / 2;
        var maxScroll = railEl.scrollWidth - railEl.clientWidth;
        targetScroll = Math.max(0, Math.min(targetScroll, maxScroll));
        railEl.scrollTo({ left: targetScroll, behavior: "smooth" });
      }
      window.requestAnimationFrame(function () { moveRailIndicator(activeBtn); });
    }
    /* the Review step (04) has its own full summary list, so the sticky
       reservation-note sidebar would just repeat it — hide it there and
       on the final Send screen (05), which also repeats the same details. */
    if (bkGrid) bkGrid.classList.toggle("bk-review-active", step === TOTAL_STEPS || step === 5);
  }

  window.addEventListener("resize", function () {
    var current = document.querySelector(".bk-rail-step.is-active");
    if (current) moveRailIndicator(current);
  });

  document.getElementById("bk-rail").addEventListener("click", function (event) {
    var btn = event.target.closest(".bk-rail-step");
    if (!btn || btn.disabled) return;
    var target = Number(btn.getAttribute("data-step"));
    if (target === 5 || target === currentStep) return;
    /* Block jumping ahead to a later step while the current one isn't
       filled out yet — without this, a step you'd already visited once
       (and which raised maxStepReached) stayed clickable forever, even
       after going back and clearing its required fields. */
    if (target > currentStep && !validateStep()) return;
    hideHeaderForStep();
    if (currentStep === 5) {
      successView.classList.remove("is-current", "bk-anim-in-start", "bk-anim-out");
      form.style.display = "";
      actions.style.display = "";
    }
    goToStep(target);
  });

  /* ---------- review (step 4) ---------- */
  function buildReview() {
    var n = nights();
    var total = state.price && n ? state.price * n : 0;
    var rows = [
      ["Name", state.name || "—"],
      ["Dates", state.arrival && state.departure ? formatDateTime(state.arrival, state.arrivalTime) + " – " + formatDateTime(state.departure, state.departureTime) + " (" + n + (n === 1 ? " night" : " nights") + ")" : "—"],
      ["Number of pax", state.pax ? String(state.pax) : "—"],
      ["Room category", state.room || "—"]
    ];
    if (occupancyLabel()) rows.push(["Occupancy", occupancyLabel()]);
    rows.push(["Email", state.email || "—"]);
    rows.push(["Contact number", state.phone || "—"]);
    rows.push(["Estimated total", "$" + total.toLocaleString() + " +tax"]);
    reviewList.innerHTML = rows.map(function (r) {
      return '<div class="bk-review-row"><span>' + r[0] + "</span><span>" + r[1] + "</span></div>";
    }).join("");
    pdfDownloaded = false;
    refreshReviewDownload();
    validateStep();
    reviewDownloadLink.classList.remove("is-done");
    var downloadCursor = document.querySelector(".bk-download-row .bk-download-cursor");
    var nextCursor = document.getElementById("bk-next-cursor");
    if (downloadCursor) downloadCursor.classList.remove("is-hidden");
    if (nextCursor) nextCursor.classList.remove("is-active");
  }

  /* ---------- build (or rebuild) the downloadable PDF on the Review step ---------- */
  function refreshReviewDownload() {
    var hasPdfLib = typeof window.jspdf !== "undefined" && typeof window.jspdf.jsPDF === "function";
    if (!hasPdfLib) return;
    try {
      var pdfDoc = buildInquiryPDF();
      var fileName = "Dhaankolhu_Booking.pdf";
      var pdfBlob = pdfDoc.output("blob");
      var pdfUrl = URL.createObjectURL(pdfBlob);
      reviewDownloadLink.href = pdfUrl;
      reviewDownloadLink.setAttribute("download", fileName);
    } catch (err) {
      /* PDF generation failed for any reason — leave the link as-is so
         the rest of the review step still works. */
    }
  }

  reviewDownloadLink.addEventListener("click", function (event) {
    event.preventDefault();

    var hasPdfLib = typeof window.jspdf !== "undefined" && typeof window.jspdf.jsPDF === "function";
    if (!hasPdfLib) return; /* library still loading — nothing to download yet */

    try {
      var pdfDoc = buildInquiryPDF();
      pdfDoc.save("Dhaankolhu_Booking.pdf");
    } catch (err) {
      return; /* generation failed — leave everything else untouched */
    }

    pdfDownloaded = true;
    validateStep();
    reviewDownloadLink.classList.add("is-done");
    reviewDownloadLink.blur(); /* drop the lingering teal focus ring once it's done */
    var downloadCursor = document.querySelector(".bk-download-row .bk-download-cursor");
    var nextCursor = document.getElementById("bk-next-cursor");
    if (downloadCursor) downloadCursor.classList.add("is-hidden");
    if (nextCursor) nextCursor.classList.add("is-active");
  });

  /* ---------- step navigation with rise-up transition ----------
     Rail tab clicks, Next, and Back all use the same immediate swap now:
     the current step's fields fade out (~0.38s) while the rail pill moves,
     then the target step's fields fade in — everything happens together,
     no extra pause.

     `stepTransitioning` guards against overlapping transitions: without it,
     clicking a second tab while the first one's swap is still in flight
     would run two goToStep() calls at once, each grabbing its own stale
     "current" element and independently adding "is-current" to a different
     step — which caused two steps' fields to render stacked on each other. */
  var stepTransitioning = false;
  function goToStep(target) {
    if (stepTransitioning) return;
    var current = form.querySelector('.bk-step.is-current');
    var next = form.querySelector('.bk-step[data-step="' + target + '"]');
    if (!current || !next) return;
    stepTransitioning = true;

    var reveal = function () {
      current.classList.remove("is-current", "bk-anim-out");
      next.classList.add("is-current", "bk-anim-in-start");
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { next.classList.remove("bk-anim-in-start"); });
      });
      currentStep = target;
      if (target > maxStepReached) maxStepReached = target;
      updateRail(target);
      nextBtn.textContent = target === TOTAL_STEPS ? "Send via WhatsApp" : "Next";
      if (!nextBtn.querySelector("span")) nextBtn.innerHTML = nextBtn.textContent + " <span>→</span>";
      if (target === TOTAL_STEPS) buildReview();
      else {
        var nextCursor = document.getElementById("bk-next-cursor");
        if (nextCursor) nextCursor.classList.remove("is-active");
      }
      validateStep();
      saveDraft();
      scrollPanelIntoView();
      stepTransitioning = false;
    };

    current.classList.add("bk-anim-out");
    window.setTimeout(reveal, 380);
  }

  var WHATSAPP_NUMBER_DISPLAY = "+960 989 8130";
  var WHATSAPP_NUMBER_RAW = "9609898130";
  var whatsappLink = document.getElementById("bk-whatsapp-link");

  /* Preload the black resort emblem as a data URL so it can be embedded in the
     downloadable PDF (jsPDF needs image data ready synchronously at draw time). */
  var bkLogoDataUrl = null;
  var bkLogoAspect = 1;
  fetch("img/logo/DHAANKOLHU_text_black_transparent.png").then(function (res) { return res.blob(); }).then(function (blob) {
    var reader = new FileReader();
    reader.onload = function () {
      var rawDataUrl = reader.result;
      var img = new Image();
      img.onload = function () {
        if (img.naturalWidth && img.naturalHeight) bkLogoAspect = img.naturalWidth / img.naturalHeight;

        /* Downscale to the size it's actually drawn at in the PDF (plus a
           little headroom for crispness). jsPDF embeds the source image at
           full resolution regardless of the display size you pass it, so an
           untouched high-res source PNG is the main thing bloating the file
           — resizing here keeps the PDF a few KB instead of several MB. */
        var TARGET_PX = 480;
        var w = img.naturalWidth, h = img.naturalHeight;
        if (w >= h && w > TARGET_PX) { h = Math.round(h * (TARGET_PX / w)); w = TARGET_PX; }
        else if (h > w && h > TARGET_PX) { w = Math.round(w * (TARGET_PX / h)); h = TARGET_PX; }

        try {
          var canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          bkLogoDataUrl = canvas.toDataURL("image/png");
        } catch (err) {
          bkLogoDataUrl = rawDataUrl; /* canvas failed (e.g. CORS) — fall back to the original */
        }
        refreshReviewDownload();
      };
      img.onerror = function () { refreshReviewDownload(); };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(blob);
  }).catch(function () { /* logo optional — PDF still renders without it */ });

  /* Official letterhead (logo, contact details + website footer are baked into
     the image), embedded directly in this file so there is no separate image
     path to get wrong. buildInquiryPDF paints it as the full-page background;
     the page size follows the letterhead's own 1240x2097 aspect ratio so
     nothing gets stretched or cropped. */
  var bkLetterheadDataUrl = "data:image/png;base64,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ZWzwqVYURZplvz77h5OXVWhYZQy5qtALf//7D77nPe//zGd232efRqOe12prey3SNMuyoig6hwz55s9/8a6PfWzRggXVHOZGvT6kq2v65MnveeUrZ06fXi3j7GceAACe/SFa1UUI4cAjjqjX6ytO0C3LsqWt7d477pg1ffoz6Nq8ajbpYw89dMOVV7W1t1eDaVmeX3LB+XEjXe9aXYD619//vtqCtSzLltbWB++951833BBCXKfNJKvSK4uia9iwb3/+cxedd16W50//dpRFo1GtkTvl8YlrqtBqKaa7b7/9o2972+477fTqt76tGhkezP1Xa+SWZfnhz33+7R/+yIL586sbNhqNzq6uRx544GNve2vRaMR1H1IGAACekSFa9cZeBxzQ2ta24nBcjDHP8wVz5949/rbwzJmdW5XMdf/8594HHZgkSUiSMsa2trY7brnl4Xvv3fDrXasLUKdPmdLb07PT7rv19PRUM1H7+/suPv+8ENbhOtSyLPsbxfIJw62trWe+4+333XXX0zwuWq1/+5sfnT114uPV6kSrVmiMMQmhr7f38x/60NyFC48/5ZQhXV2xLJNksG/RNE2TJCmK4sOf//yLX/nKhfPn53keqn1rR4y44u9///n3vmtQFAAA/mtCNE1DCLvssWfX0KFFo7FigaRp2tvbe+8dd1Yt8ow4ZVmWdS9d8uiDD/6/b/5fW3t70WgkIWS12oL58y7761/CBo+5VZ12+d//fvJpLzvltJcvXby4ur6xpbXtussvXzBv3mCuRK1O8ZCurh133rln6dKqPGtNTUuXLPnAG9+wcP78NMueniQrikaW57/7yU8efeDBj33py2va27MsyyRNf/eTn9x87TXDOzsOe85z1uNi1uX3/Pnvfm/XvfdeumRJNUBdNBqdQ4ac/fWvT5s8OdGiAADw3xCilWEjRmyz3fb9T16vKMaY12r33nlnqC683ORVlTj+xpuGjhix42677XPQQb09PVXbNDe3XHbhhfV6fUO360zTWJb33nnHYc95zpHPfW5La2u1GlBLS8ukRx658aorw2AGXZMkhNDc0vK1n/xk7JZb9nR3Z3neaDQ6Ojvvn3DXx97+tka9sXEXLlp9hTYaWZb/7Q9/+OAZZ4zebLOwbPfOlb6tmoK7aOHCX/3wB80tLa1tbTvvsUe1JNF6nL2yLDuGDPn8d7+X15qqExVjrDU3z5o+/Zc/+H61YpOffAAAeJaHaJIkZVFkeb7tDjv09/WtdJloranpkQfur1ZGfaYMit5w5ZWHPeeYGOOJLz21OuYyxpbW1vvuuuv2m28Oyy6LXb/QTZLkvrvuau/o6BzStfu+++6y55693d3L4+0ff/5zGPQ+Md1Ll+68xx5f+8lPsywrGo00TRuNxrDhI/7x5z9/+3OfzdawkOzGrNA8/8vvfvfht7y5a0jnb3/8o/lz5qx2OLc6XZf+5YLHHnooz/NRY8d2DR8elo3rrqssy4qise/BB7/hXe9evHBhlueh2tOlo+Nvf/jDnFkzsyxzpSgAADzLQzQsm6269fbbrXqFY55lC+bNmzF1atjkF5Kprt6cO3v2wvnz9z3o4CRJjj7hhC23Hdff15eEkKZpX1/fxedt0Iai1Rm45rLLDj7q6BBCS0vL8aec0tfXm6ZpUZat7e03X3PNtMmTBnmtY5ZnC+bP3//QQ8/8yleXLFpU/QqgKIphw4d//6tf+cu5v6vWm31KKrQosjy/4Le//ehbz8hrtba2tkmPPfaP885b7TW01RjyRX/+c7WQUmtbW1NT0wa9rZOsLMu3vP9922y/fV9PT7UUVlNz87RJk6655NLwTNsuCAAAhOh6SZIQwpbbbJvn+YoFFUNIs6x76dLpz4QQrerlhiuu2HG33fJarV7vHzp8+JHPfW5Pd/fAZZwtLddcdunihQvXc0PRGNM07e3unvTYowcdcUR1D8978UuGDOkqGo0QY61Wmz1jxhX/+MfgUyrPs1iWr37b297w7vcsmDs3z2vV+W9ta/t///Pee+64Y+OPi8ZY7cJy/q9//f/e+548z7MsaxRFU1PTuef8tFoHeMWTUw0CT504ccL48S0tLbGspgxv0DshSZMY47ARI17/znd1d3cvn/UdQ7j+yivC+o61AgAAz6QQrT73j91iiyzPn9QYMWZZ1r106bzZs6pOGFzVJmFdRh3X9fvXfj+333LLUc99bgghSdIQ44kvfUlTU1OVTy2trY8//PCNV10V1mvMrYwxSZLxN988ZvPNhwwdWl0auvPuu+9z0ME9Vb+FkNVql1xwQYwxzbJBzmRO0rQsik989atHn3DCgvnzslqtKIpardaztPsDb3j9vNmzq+sqN9ZrXZRllmW//MH3p06a9Klv/l9Pd3dIkliWbe3t9955x1WXXLLSoGj1frh/woR5s+fUmpo21q8i0iSJMb7wladvPW5cX29vNSja3Nx87513di9Zkv4nZuc+/e9YAAD4rw7RakR05Jgxq26zmSRJo16fN2dOFSWDCraiKMuyKIqyHNSfoijKstzADUtiLNM0nfToo2VRbLfzzgNbXCbJ/ocdtuNuu/X29CzfsfOi89bhMs4nP0QMIdxw5RWHH3tsVe/VaOHzXvyiagvWsizb2truvOWWB+65Z532iYkh5LXa1396zjbbb9+zdGm1cFFbR8dD99770bee0ajXw0ZZuCiGsixrtdqvz/7h1IkT333mmaecdtq4nXYamBwbQhKSc3/yk2qG80o3feSBB+qN/rBsqnb30qUb+o5L07IsR4wa/dwXvqh76dIqtpuamqZNnjxn1qzw9A6/xxjX4x379G/3CgAAT4/8aerQEEIIbe3tHUOGVLuJLM+AGEKapgvnL1jeq2v7QF+WLS0tvz777KsuvrjeXx9k65UxNjc3T37s8bb29nL9lxGKWRauuezSvQ44oOqK6gLLlpbWY0866e7x41vb2oqybGtvv/Hqq2dMnTp2iy1iWQ5+3deqbBfMnTtv9py9DzwohLB81O7Yk04ePfbz3UuWZHme5vn8OXMuOf/8XfbYY/AplaZpURSjxo79+k9++oZTTqkWLioajaHDh1924YVf+9SnPv7lL1fzaTfkVS5jmaZpNRb68S9/pdFotLS2vvQ1r/nKmWe2trU1Go32jo6brrn6thtuOOCww5c/XPUazpg2NU2zWJZZnldX4Q4fOXK1S+yu028/YownvvSlv/3R2QObl6ZpX0/PnJkzt95uu6dnZayyLFtbW6+97NK5s2cN/h0bY8jybNGCBUVRJJv8lHUAANhEQ3TgwfK8qampe8mSVf+pUa8PKi3StK+//+SXnfacE0+s1+vp4DKvLIqm5ubL//73G668oqW1df0GmqohtfvvmvC+//3fJEmqh64y6YQXv+Sc73ynKIqQJLWmplnTpl118cWnv/nNZVlmgw7RqmxvuubqHXbdpVarVZ1WDXtuvtVWhxx99N/++MeuoUPLsmxuabn87397x0c/2tTUNPhUqxbO3f+wwz571lkfevMbO4d0xRgbjcbQ4cN/8q3/23mPPV76mtdsSIuWZdk5pOv83/x6yuOPn/mVr5ZlmSZJCOHU177u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092dJEkMIcuyc8/5aVEUaZYVjUZTc/MRxx/f29OTVklcFO2dnb/6wfcff/jhrOrGDdCo18uyLMuyrb39OSedFAa3PjMAAPAUebomxMYYQpg6cVJZFGHZIFjVA0Wj0dbePnbzzTfNPKhWpr36kkvq/f1THp9YlsVqD7IsY5omM6ZMbWlpLWOMZdnc0vLYQw/deNVVx7/gBUVZrmlPlLIo0iy79667xt9001lf/MKaduyodoGJMXYMGTJvzuw0T2OMWZ5fcsEFr3zLGWmart9TS9M0CeHLPzx70qOP3T/hro7Ozkaj0dLWNm3SpA++6Y0/v/Bvq9luZ70eqCiKtvb2U1/3us998AOt7e1Fo9He0TH+xhtvuvrqw489towxC+GFp5/+mx/9qGw0QggxxlqtNm/OnK9/6pPf/d25sSwHvxHOk89bDCHMmTWre+nSGOMhRx212157VWvnbpTGBgAANt0QrXpg0mOPNur1NElWnPFZFMXQ4cO33HbbTTBEq2KZOnFijOVr3v62soxrOsCqko563gmPPfTgw/ff39LaWm3l8o/z/nz8C16wludVRd41l1x6+pvevPMeezQajTRZ/TI6RVHUak15rfatz362s6u5LIq29vbbb775oXvv3Wn33Vfck3OdErFakvebP/vZq5733O6lS2u1WrVw0Q1XXPG5D33wc2d9t2g0kjTdwJemOrYXv/KVPzvrO/PnzMlrtSRJ6vX6b3909uHHHlsNve6+z77POfGkv//pD13DhheNRlEUXUOH/uO8835/zjmveNOb1m+D02oF4EcffLDe319ranr9u99TTTlen7sCAACeWSFa7Xfy0D33rhpC9f7+cTvt1NbeHja99WPKssyy7KqLLz7wyCP3PfiQwdzk2JNPufuOO1rb2sqybG1ru+mqq2bPmDFq7NhYlskqoVhdgLpw/vyZ06a+73//dzD3v9nWW/3yBz/oWbIky/M0y+bPmXPpX/+y0+67x7IM6zUuWk3Q3XG33b7yox+94+Uvz/M8WbZw0a9/+MMdd9vtde94Z71eX79B15WKd8To0Sed+rIfffMbw0aMKIqio7Pz2sv++cDddw8UeJq+58wzr77k4qrGq71b2tvbv/zxj+22zz577rdfMehViFcM4CRJ/nX9dd31xote+MLnnHhiuebR6We0GKP/OwMA4Jni6bhGtBpXrNfr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d9SYMf+mQssySdMQwt23j7//rgmLFi7o7enpGjps2MiR+x966JoeMZbllEmTlixatPzrMcZarTZyzJihw4evPfNCCAvmzRsydOjaYzXGuHD+/K5hw1ZfyMvu//abb37ovnuXLlq8dMmS4SNHdnZ17X/ooZtvvfXaT1R1877e3luvv37So48uXbyoUW8MHTFi5JgxBxx22LARI7wJAQBAiP4XaTQa73/d63bfd9+29vZqdDFJknq9vmDu3P7e3oOPPvq4U05Z+z0URZFl2eV///tXzvz4H6++pmvo0DUlWfX1KY8/fs5Z32lrb9/noIOHjxhRxrIoismPPT5h/G2jx459/bve3dHZufweqv+YOXXqJ9/z7sOPOz6s8B5YumTJkkULk5Ace8opBxx22JoOryzLz37g/e//f5/uGjZsLa1Y7+//7Ac/cOZXvtra1rbSt1UZOWH8bb//6TkjRo/ea//9h40YXpQxScK0SZPvvuP2jo6Ot7zv/W0dHau9/+rml1xwwZUXXbTdTjvtsuee7Z0dMcZGf/3xRx657647d9xtt9e87e2xLNdjOjQAAPCUco3oU6JoNEaOGf32D3941X967MEHf/+zc/514w0f+sxnkzRd04himqZlWd53153PfeGLrrnkkhe84hVlWWarzDUtyzJNkomPPPLVT5z55ve9f79DDlnxXw8+8qiXve51fz333P99z3ve88lPbrv99isOcvb19e2w885veNe7Vn30CePH//HnP7v5mmve9bGPPRVzXKvDuOXaa3/8zW9+6POf33n33Z/0z4eFF55++vm//c3//s97P/eds1rWELHnnvPT22688SOf/8JKI8aHHHNMf1//j775ja/976c+/NnPlWUpRAEAYJNi1dynSlmWSxcvLouiLBplUZRFUS3JM26nnT72pS/nee3cc36apmlZFKu5bYxJkkx+7LEyxre8732333zTWmbJxhB+dtZ3zvjAB/c75JBGo1E9UKUoihjjC08//Y3vfe/sGdNX6rFqkLYoiqKx7AiLohq/3XO//T77nbOSJHzvy19Ks6z64sZSVeWCefN+8f3vf+6ss3beffdilcMuiuIlr3r1occ85+ff+26SJCseQKyGUm+77earr/nqj348asyYYoXbVjevNdXe/fGPx6K89C9/qZLeGxIAAITof8fJzbIn/UnTqqnKsnzv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W6+77uCjjirLstForLQhZ71ejzHuuMuu119xRVhhbPPfJlaSplmeF0UR1mUssSyKGOOdt97a3tHRMWRIWRQb5SRUB7D1dtvNmzO7v79/LXEbyzLG+PiDD3UNG7b8+VY332WPPR685561D6tWp+WeO+7YbuedvfcAAECI/ldL0vQFrzj9dz/5SQghrlBNaZrOmzNn8cKFu+69dzWSudKenFmWJUly5HOPv/3mm1dMymqNojXlaLV80dxZs/K8VuXlYA6yurckSf7ws3Oe/+IXL+/kjRKiZVl2dnUNHT58/A03JElSrOGQyhiTJLnx6isPPfqY5c+3Wh94u512XrRw4eyZM5I1dHj1xbIsH77//v0POTSs41AwAAAgRJ9FpztNy7I87DnPWbpkyT133FH9NSxbW+jGK6/ceY89sixb7ZWcVYPtsOtuZVlMfuyxdNlVppMfe6waGyyKYqUqqy5MTdP0H+f9ee8DD1xNT8a40rhrURTVnOE0y7756U9vv/Muex1w4Mbd+qWqxxed/so//fKX1fNaqUVjjI16Pc/zu8ePX7hgwT4HHxxXOIAYY1Nz81HPe94vvve9JE2roeOVb95oZFl2wW9/s9W4bUeOGbPSLGgAAECIPmubcy3/+vI3vvH3P/vZE22WJEmS3HbTjQcfddRablsV157773/9FZeHEKp+u/j887/2qU8uXbKkGjJd6RjyWu2C3/126aLFz33BC6px1xW/odbUVI21rjjumqbppEcf/dyHPlir1c74wAeKoljt8QwyTVf9tmqhph13223vAw/86ic+sXyl3xXPRl6rTXzkkbO//rU3vee96SpPqizL57/kJb3dPb/7yU9qtdpKD5EkSa1Wu/HKK6/75+Wvf+e7YoypCgUAgE2JxYqeKt1Ll65245A0Tcui2HO//f72h99fcdE/jj3xpEajkef5ow8+2N/bt+Nuu61lFaKquA4/9rhvf+5zp77u9XmWlWV5xgc+8Kdf/OL//c97DzriyL0PPHCb7bar1ontWbr03jvvvPxvfytj+bEvfznL85XGS5MkmTpp0oTx48OyibhLlyyZNX36vXfesXTJ0mOe//xjTzopxrjafWKqJziYFYBW+23VKOhr3/GOX3zvu2e+8x0nvuSle+y3X+eQISFJikZj2uTJN1511a3XXfv2j3x0u513XnU8tjo/H/785//vM5/+yifOPO6kk3fZa6/W1tYQQn9//6MPPHDVxRdPnTTpU9/4Rlt7e4wxCFEAANiUJFYTfSoUjcYNV1156NHHrLTvSKU659MmT37swQePOP74oiiyLHv0gQcWLViwz8EHD2Ye7FUXXXTgkUe2d3Qsv5hz3pw5/7zwwkmPPdrT3T1s+IhGo7508eIhQ4cdfPRR1XamK/Zt9d893d1/+d1vG41GmqQDB5WEIV1dO++x50677x6qhXzXcCQxxusv/+eBRxzZ3NKylnIui+K6Ky4/7JjnrOk8JEny0H33Xn3JJfNmz6k1NTU3Ny9ZsrhWq223007Hv+CF7R0d//Zs3HLttf+64fqlS5Y0NzenWda9dGlLa+ue++73nJNOWulZAwAAQpT1tcoQX1kU6bJxy3p/f6NeDyE0t7ZWCbc8VtfpQTbudaFrfJQVjrynuzvGmOV5c3PzwBMty7UtqxtjiDFZ9hx7urtDCE1NT2w6qkIBAECI/nf5tyFXLXW74ho8q17DOfg7r1bHTZJkxa8XRbHSV1ZSFMWKoVbtvZkkyWC2DB1kqf7781CW5ZMnAJdlWRXmYDKyWufpSTcvirDWZw0AAAhRNqplr+gzbjBwYOQ2rOdWMes38AsAAAhRAAAAnuVMXwQAAECIAgAAIEQBAABAiAIAACBEAQAAQIgCAAAgRAEAABCiAAAAIEQBAAAQogAAACBEAQAAEKIAAAAgRAEAABCiAAAACFEAAAAQogAAAAhRAAAAEKIAAAAIUQAAABCiAAAACFEAAACEKAAAAAhRAAAAhCgAAAAIUQAAAIQoAAAAQhQAAACEKAAAAEIUAAAAhCgAAABCFAAAAIQoAAAAQhQAAAAhCgAAAEIUAAAAIQoAAABCFAAAACEKAAAAQhQAAAAhCgAAgBAFAAAAIQoAAIAQBQAAACEKAACAEAUAAAAhCgAAgBAFAABAiAIAAIAQBQAAQIgCAACAEAUAAECIAgAAIEQBAABAiAIAACBEAQAAQIgCAAAgRAEAAECIAgAAIEQBAAAQogAAACBEAQAAEKIAAAAgRAEAABCiAAAAIEQBAAAQogAAAAhRAAAAEKIAAAAIUQAAABCiAAAACFEAAACEqFMAAACAEAUAAECIAgAAgBAFAABAiAIAAIAQBQAAQIgCAAAgRAEAAECIAgAAIEQBAABAiAIAACBEAQAAQIgCAAAgRAEAABCiAAAAIEQBAAAQogAAACBEAQAAEKIAAAAgRAEAABCiAAAACFEAAAAQogAAAAhRAAAAEKIAAAAIUQAAAIQoAAAACFEAAACEKAAAAAhRAAAAhCgAAAAIUQAAAIQoAAAAQhQAAACEKAAAAEIUAAAAhCgAAABCFAAAAIQoAAAAQhQAAAAhCgAAAEIUAAAAIQoAAABCFAAAACEKAAAAQhQAAAAhCgAAgBAFAAAAIQoAAIAQBQAAACEKAACAEAUAAECIAgAAgBAFAABAiAIAAIAQBQAAQIgCAACAEAUAAECIAgAAIEQBAABAiAIAACBEAQAAQIgCAAAgRAEAAECIAgAAIEQBAAAQogAAACBEAQAAEKIAAAAgRAEAABCiAAAACFEAAAAQogAAAAhRAAAAEKIAAAAIUQAAABCiAAAACFEAAACEKAAAAAhRAAAAhCgAAAAIUQAAAIQoAAAACFEAAACEKAAAAEIUAAAAhCgAAABCFAAAAIQoAAAAQhQAAACEKAAAAEIUAAAAIQoAAABCFAAAACEKAAAAQhQAAAAhCgAAgBAFAAAAIQoAAIAQBQAAACEKAACAEAUAAAAhCgAAgBAFAABAiAIAAIAQBQAAQIgCAACAEAUAAECIAgAAgBAFAABAiAIAACBEAQAAQIgCAAAgRAEAAECIAgAAIEQBAABAiAIAACBEAQAAEKIAAAAgRAEAABCiAAAAIEQBAAAQogAAAAhRAAAAEKIAAAAIUQAAABCiAAAACFEAAAAQogAAAAhRAAAAhCgAAAAIUQAAAIQoAAAACFEAAACEKAAAAAhRAAAAhCgAAABCFAAAAIQoAAAAQhQAAACEKAAAAEIUAAAAIQoAAABCFAAAACEKAAAAQhQAAAAhCgAAAEIUAAAAIQoAAIAQBQAAACEKAACAEAUAAAAhCgAAgBAFAAAAIQoAAIAQBQAAQIgCAACAEAUAAECIAgAAgBAFAABAiAIAAIAQBQAAQIgCAAAgRAEAAECIAgAAIEQBAABAiAIAACBEAQAAEKIAAAAgRAEAABCiAAAAIEQBAAAQogAAACBEAQAAEKIAAAAIUQAAABCiAAAACFEAAAAQogAAAAhRAAAAEKIAAAAIUQAAAIQoAAAACFEAAACEKAAAAAhRAAAAhCgAAAAIUQAAAIQoAAAAQhQAAACEKAAAAEIUAAAAhCgAAABCFAAAACEKAAAAQhQAAAAhCgAAAEIUAAAAIQoAAABCFAAAACEKAACAEAUAAAAhCgAAgBAFAAAAIQoAAIAQBQAAACEKAACAEAUAAECIAgAAgBAFAABAiAIAAIAQBQAAQIgCAAAgRAEAAECIAgAAIEQBAABAiAIAACBEAQAAQIgCAAAgRAEAABCiAAAAIEQBAAAQogAAACBEAQAAEKIAAAAgRAEAABCiAAAACFEAAAAQogAAAAhRAAAAEKIAAAAIUQAAABCiAAAACFEAAACEKAAAAAhRAAAAhCgAAAAIUQAAAIQoAAAAQhQAAACEKAAAAEIUAAAAhCgAAABCFAAAAIQoAAAAQhQAAAAhCgAAAEIUAAAAIQoAAABCFAAAACEKAAAAQhQAAAAhCgAAgBAFAAAAIQoAAIAQBQAAACEKAACAEAUAAECIOgUAAAAIUQAAAIQoAAAACFEAAACEKAAAAAhRAAAAhCgAAABCFAAAAIQoAAAAQhQAAACEKAAAAEIUAAAAhCgAAABCFAAAACEKAAAAQhQAAAAhCgAAAEIUAAAAIQoAAABCFAAAACEKAACAEAUAAAAhCgAAgBAFAAAAIQoAAIAQBQAAQIgCAACAEAUAAECIAgAAgBAFAABAiAIAAIAQBQAAQIgCAAAgRAEAAECIAgAAIEQBAABAiAIAACBEAQAAQIgCAAAgRAEAABCiAAAAIEQBAAAQogAAACBEAQAAEKIAAAAgRAEAABCiAAAACFEAAAAQogAAAAhRAAAAEKIAAAAIUQAAAIQoAAAACFEAAACEKAAAAAhRAAAAhCgAAAAIUQAAAIQoAAAAQhQAAACEKAAAAEIUAAAAhCgAAABCFAAAAIQoAAAAQhQAAAAhCgAAAEIUAAAAIQoAAABCFAAAACEKAACAEAUAAAAhCgAAgBAFAAAAIQoAAIAQBQAAACEKAACAEAUAAECIAgAAgBAFAABAiAIAAIAQBQAAQIgCAACAEAUAAECIAgAAIEQBAABAiAIAACBEAQAAQIgCAAAgRAEAAECIAgAAIEQBAAAQogAAACBEAQAAEKIAAAAgRAEAABCiAAAACFEAAAAQogAAAAhRAAAAEKIAAAAIUQAAABCiAAAACFEAAACEKAAAAAhRAAAAhCgAAAAIUQAAAIQoAAAACFEAAACEKAAAAEIUAAAAhCgAAABCFAAAAIQoAAAAQhQAAACEKAAAAEIUAAAAIQoAAABCFAAAACEKAAAAQhQAAAAhCgAAgBAFAAAAIQoAAIAQBQAAACEKAACAEAUAAAAhCgAAgBAFAABAiAIAAIAQBQAAQIgCAACAEAUAAECIAgAAgBAFAABAiAIAACBEAQAAQIgCAAAgRAEAAECIAgAAIEQBAAAQogAAACBEAQAAEKIAAAAgRAEAABCiAAAAIEQBAAAQogAAAAhRAAAAEKIAAAAIUQAAABCiAAAACFEAAAAQogAAAAhRAAAAhCgAAAAIUQAAAIQoAAAACFEAAACEKAAAAAhRAAAAhCgAAABCFAAAAIQoAAAAQhQAAACEKAAAAEIUAAAAIQoAAABCFAAAACEKAAAAQhQAAAAhCgAAAEIUAAAAIQoAAIAQBQAAACEKAACAEAUAAAAhCgAAgBAFAAAAIQoAAIAQBQAAQIgCAACAEAUAAECIAgAAgBAFAABAiAIAAIAQBQAAQIgCAAAgRAEAAECIAgAAIEQBAABAiAIAACBEAQAAEKIAAAAgRAEAABCiAAAAIEQBAAAQogAAACBEAQAAEKIAAAAIUQAAABCiAAAACFEAAAAQogAAAAhRAAAAEKIAAAAIUQAAAIQoAAAACFEAAACEKAAAAAhRAAAAhCgAAABCFAAAAIQoAAAAQhQAAACEKAAAAEIUAAAAhCgAAABCFAAAACEKAAAAQhQAAAAhCgAAAEIUAAAAIQoAAABCFAAAACEKAACAEAUAAAAhCgAAgBAFAAAAIQoAAIAQBQAAACEKAACAEAUAAECIAgAAgBAFAABAiAIAAIAQBQAAQIgCAAAgRAEAAECIAgAAIEQBAABAiAIAACBEAQAAQIgCAAAgRAEAABCiAAAAIEQBAAAQogAAACBEAQAAEKIAAAAgRAEAABCiAAAACFEAAAAQogAAAAhRAAAAEKIAAAAIUQAAAISoUwAAAIAQBQAAQIgCAACAEAUAAECIAgAAgBAFAABAiAIAACBEAQAAQIgCAAAgRAEAAECIAgAAIEQBAABAiAIAACBEAQAAEKIAAAAgRAEAABCiAAAAIEQBAAAQogAAACBEAQAAEKIAAAAIUQAAABCiAAAACFEAAAAQogAAAAhRAAAAhCgAAAAIUQAAAIQoAAAACFEAAACEKAAAAAhRAAAAhCgAAABCFAAAAIQoAAAAQhQAAACEKAAAAEIUAAAAhCgAAABCFAAAACEKAAAAQhQAAAAhCgAAAEIUAAAAIQoAAABCFAAAACEKAACAEAUAAAAhCgAAgBAFAAAAIQoAAIAQBQAAQIgCAACAEAUAAECIAgAAgBAFAABAiAIAAIAQBQAAQIgCAAAgRAEAAECIAgAAIEQBAABAiAIAACBEAQAAQIgCAAAgRAEAABCiAAAAIEQBAAAQogAAACBEAQAAEKIAAAAIUQAAABCiAAAACFEAAAAQogAAAAhRAAAAEKIAAAAIUQAAAIQoAAAACFEAAACEKAAAAAhRAAAAhCgAAAAIUQAAAIQoAAAAQhQAAACEKAAAAEIUAAAAhCgAAABCFAAAAIQoAAAAQhQAAAAhCgAAAEIUAAAAIQoAAABCFAAAACEKAACAEAUAAAAhCgAAgBAFAAAAIQoAAIAQBQAAACEKAACAEAUAAECIAgAAgBAFAABAiAIAAIAQBQAAQIgCAACAEAUAAECIAgAAIEQBAABAiAIAACBEAQAAQIgCAAAgRAEAAECIAgAAIEQBAAAQogAAACBEAQAAEKIAAAAgRAEAABCiAAAACFEAAAAQogAAAAhRAAAAEKIAAAAIUQAAABCiAAAACFEAAACEKAAAAAhRAAAAhCgAAAAIUQAAAIQoAAAACFEAAACEKAAAAEIUAAAAhCgAAABCFAAAAIQoAAAAQhQAAAAhCgAAAEIUAAAAIQoAAABCFAAAACEKAAAAQhQAAAAhCgAAgBAFAAAAIQoAAIAQBQAAACEKAACAEAUAAAAhCgAAgBAFAABAiAIAAIAQBQAAQIgCAACAEAUAAECIAgAAgBAFAABAiAIAACBEAQAAQIgCAAAgRAEAAECIAgAAIEQBAAAQogAAACBEAQAAEKIAAAAgRAEAABCiAAAAIEQBAAAQogAAAAhRAAAAEKIAAAAIUQAAABCiAAAACFEAAAAQogAAAAhRAAAAhCgAAAAIUQAAAIQoAAAACFEAAACEKAAAAAhRAAAAhCgAAABCFAAAAIQoAAAAQhQAAACEKAAAAEIUAAAAIQoAAABCFAAAACEKAAAAQhQAAAAhCgAAAEIUAAAAIQoAAIAQBQAAACEKAACAEAUAAAAhCgAAgBAFAAAAIQoAAIAQBQAAQIgCAACAEAUAAECIAgAAgBAFAABAiAIAACBEAQAAQIgCAAAgRAEAAECIAgAAIEQBAABAiAIAACBE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w36uc8CUpnOOOrKnu3vYQxHMctzw2msfeec7D54xff/6uv3rapc2N52waMHlv/rVzra2VUsPOGj6tP1c51ff/17wUoNX+/CaNQtraw6fO2dJU8PTjz363BNPXLDi+AObpyyqr1tUV3vAlKYzjzj8tuuuLX7NxT/xtZde+sJHPnLi/vsvbZ6ypLFh//q6A5oal02beuYRh1/ykx/7vm+NscYM+ipr7VW/u+SiU085bPasA6Y0Lm6oX9xQv3RK05Hz533kXe949oknin9c8CWe571r1coljQ37aPVvn/xktq/vK5/+1JHz5y1pbFhYW7O4of6oPeZ/7bOf7enpLv4pwXv84Te+sbAms2za1FMPPmjXzp393zObtdb+4Btf37++7vA5s/dx1A//4xtDf/Q1l1761uOOWzZt6uKG+kV1NfvX1y2dMuXERQu/9cUvdnZ0FP+44MQ98sD9B02fdtjsWUsaG4LrJ/jzYMLzptdfP2TWzMNmz9ov49589VVbNm36+3POPmja1P3r6xbV1ixpbDh5yZLLfvGL4sug8Pt/+sAHFtRk9q+ve/vJJxX/3OA3nbt3L99v32VTmxfW1lx1yW+Lr8yRBC/plmuueceqlYfOmrmkqWFRXe3+dbVLGhuOmj/v/W9967233Tb4Q+d51tq19933vnPfcujsWUsa81/S1HjU/Hmfft/7Xlm3rvCdC69t186dq5cduLR5yj5a/exb3+rs6PjUP/z9YXNmL25sWFhbs6Sh/sRFC3/74x9ba7PZrLX29z//+clLlixpalxYW7N/fd3BM6Z/9F3v3PT668XvGgDCZvzq9CSH+a/PTroxZHoekOCxUCXKyW0HylrQytBaW2uXHnzwgYcc0tfX57ru2jX3SWH+nrVaa+P7t117bW1tnVLq9uuvl6LZfUpra+0Ta9dmamr6ensPO+bofRctEpHjTj557wULfd83vv/wmjWDxo527dx5z623Tpk6tbur8/Ybrh80dNbb0/PM4483NDb2dHevWL06GJ49ftXqPffZ2xjjZb1H7n9AChtLWqu1bmtt+cvtt0+dNq1j9+47brhB8gX7gr/t6ux87sknG5qaent6Tjj1tNq6uqHbTgajnVs2vfGB88+7+eqrHMdpmjLFzWSyfdlNGzZ+/iMf/u9//ddggHeUsdDGxqa/3H77h9/5jkcffND3/Zqamqbm5vqGhtdefPGj7373TVdeqbUuLPMLZmZee+mlF56w4o8X/2bH9lYl4nme73me52mtN7z66hc+9vF/+ehH/NxCwP7XubOt7SPvesc/feADj69d6/u+8Y2XzXrZrBXxstnbrr3uvWec/td77in+cYXzpbR2M5nenp5//fjHfvo/39vd3q6Uamxqampu7u3t/el3vvOZ970vm82KHXsE2PM8x3X/dOUV3//aV5uam3e2tf2fT37qE1/4l8JonvF9pdS3/+1Ln/r7v3vx2WdqampqamtdN5Opqamtq93Z1vb9r3/9vaeftnXzZhl/5SFrTH1d3QtPP/3hd7z9rptv8TzPzWSampsbm5patm753Ac/+L/f+bZ2nMFHQCmdN9InIlDKsKExRmn93X//8scueveTa9dqrWtqajOZjJvJ1NbVeZ537+23/d8LL/jxN7/Z19sbvBJjjHacW66++n3nvuUvt9+ulKqtq8tkMm5NTV1dXTabvfbS3737lNUP/eUvasjpC15WbV1dW2vrJ//2by7/7SXdnZ1a6ynNzY3NzdtbW//l4x//0Te/6bruj//zm1/4yIc3b9ygRBoaGqY0NzuOc9NVV33g/PO2bNokydrqFkCsxke1aFd0phKbqYx3NFOMN8kCvwRRILQU6oeYQpXoIII6RNCKn1hjHMdZsfqU3p6e2vr6F55+uquzMwioxlql1PNPP/3cE0/W1tXXNTQ8/uCDG159RWsdPEfUWrfv2PH8U0/VNzRks9mTTjtdRLLZ7NTp04887rie7u5MJvPkIw/bQjIxxlr74L33vLF+faampr6+Yc0dd3Ts3uU4TqGKzIbXXlv/8ks1NTVuJrPy9NNFxPe8mbNnH3bMsT1dXU4m88TahyS/Oi5YYHn/3Xe/uXGjm8nU19ffe9ut3V1dxd/wtZde2vjqq5mamtra2pNPP12Gu+0E8xV/9q1vvfDU03Pmz89msz3dPQcfceRZF154/KpVzVOnXv6rX7Vu3ZqpqRkxLyllrf3pf//3htdeW7D//kcuX77ogAN8z+vq6Ghqbq6prf3m5/+5deu24MBK/rK2Im4mY43J9vXtvWDB+Re9570f+tAZ551XW1sr1s7bY/7vf/6Ly3/1y+BxQPEp08pxHSfb15epyRx38snv+eAH3/PBDy479NDurq5pM2d2dXT868c/1tbaGszSHBSYpzQ33/mnG6+4+OJ5c2YfdPgRhx1zTNOUKe07dmil5s2fd+Plf7z20kuVVmbUrGJ833XdJ9au/eInPtE0ZWr7jh1vveiiL33729Zana+jox3nyosv/sHXvz5j9uy6+vrdu3bNnD37iOXLF+y/f19fn+f78/fc49G/PviVT39q3DWHrbXW1tTV/fbHP378oYf2WbDfYcccs/SQQ4Jp5HV1ddNnzvjh17++7tlnh6bxMn5wtNZXXnzx9772tanTpjU2NbXv3NnY1HTIUUcdfOSRtbW1u3buDOYe//L739u2ZYvW2vc8rfVzTz75uQ9/SESmzZzZsWtXbV3doUcffeAhhziO09XZOXPOnJ1tbf/84Q9tb2lRStmBra4xpqGp6erfXXLHDTfstdeehxx11CFHHqm13t3eXltXN236tIt/9MNf/M93f/Jf/1VbV7fogAOOXL581ty5u9vbfc+bM2/es088+ZP/+k+lFOWGAVQ1jkakm2fFn1QWJYgC4XxUfbF+SD8rGAWt/qOydDnp1FPr6uszrrvx1VffWL9eiuqL3n3TTR27dzmOzrhu67Ztd998cy5SGiMiLz73XOvWrUqppubmFatXF0LCyWecYYypra9/+fnnd2zfHiSioFTMnX+6KSj/U1tXt/7llx/6y325iYjGiMhTjzzS3dXl+/7cPfY4cvnxhdxx8uln+L5fV1f34rPP7dq5MxiM1VqLUnf96U/BS62tq3tl3bpHH3jAFpVRffKRh3t6erxsdo+99z782GNlSImX4Pu0bN16yzXXTJsxvaerq76h4Xu/u+SyO+/80WV/uPTWW399/Q17L9ivt7d3lFEyrZTvecb3P/8f/3HdA3+99Nbb/nj3n393662HHn307vb2xsbGTRs23HLt1ZKvRhO8/rf97d9e/Zf73v63f/ud3/zmmjVrvnvxxV//0Y9/8scrLrnl1r0XLOjq7JzS3HTZL37R293jaJ07gCIzZs36yR//+JUf/OBvPvShK++593c33/KNH//kGz/+yR/v/vOnv/zlzl27mqdOfWXdupuuulIp5Q+JYdpx2tt2nLB69aW33nb5nXf+/rbbr//rgx///Od7u7uN79c31P/xN78OygiNcsE4rrt18+bPvO992d7ezo7dx5188n/+7Ge5ckFKiYhSqrOj45f/8z+NTU3WmGw2+/lv/ucNDz506S23XnnvX3513fUL9l+8q7199rx5t99ww4P33KO1HldRqEBXZ+cHP/3pa+5bc+ltt//hzjuvuOeeU889d3d7e01tbUdHx1W/vVgqtMuLtUH8++m3/ruxqcla29vT84kv/Mt1Dzzw+9vvuOyOO6/764Of+rd/6+nqmjNv3sU3/mmvffc1+ZWiv/yf/+lob69vaGjfsePd7//AtWvuv/S22/9w512X3/3nU9/ylvYdO6ZOn/7aiy9e9vP/VUoZY4f039TOtrbzLrro8jvvvOz2O35/+x1X3nPvGeef37FrVyaTyfb1fftLX8pkMv/1i19cde9ffnfzLdc98Ndv/OSnbibT09Mzbcb02669buvmzYUHIgBQxTzaP/GtakUoJzUuShAFKs8YMaGkUFV4PIbwBHnj4KOO2nfhwmw2293d/dSjj0h+pDTb13fnjTfW1df39fV5npepqfnzLbcEYcZYKyJPPry2r7e3t7d36SGH7H/ggUFEUUode9LKGbNmidiWLVteeuF5yRfyad229f677mpobOzt6bHWer5/101/ytUyVUpEnn70EWtMT1fX0StWTJs5MxhYU0otX7Vy6owZotTWzZtfeXGd5Gd+btm06a/33NPQ1NTb3S0i2b6+u266KVcaNfiGjzwiIj3d3ceceFJTc3MwJ3bgBW5E5KmHH25rbc3U1HR1dn7yi1868/wLHDeY2KmOWrHiX/7rv/t6ekYLoo7TsXv3uz7wgY/8v89NnznTcd2GxsbDjzn2B7/7/czZs/v6+rTjBJOKVVGiML6/z8KF3/rVr89957sam6b4npfNZrN9fcsOO+xz3/iG53k1tXXrX3rp1ZdfksLYZn53nPd+8ENf/cEPFx2wNJiRm+3LupnMRz/3zyecdtruXbtqamrW3rdGRJwh9YezfX1z9pj//d9detARR9TW17uZzOx58z7z7185/73v3dXeXtvQsPG1195Yvz6oeDRce2DE2t7unk+/7x82rn/N9/39ly794aW/b2hssvlj6/u+UuqJtWtffenFhqam9p07P/q5f/6/n/rU1OnTgyNz/KpV37344tr6emt83/dvu/76cV+3jtOxe/eqs8764re/M2/PPTOZTF1d/eIDl33vt5csOfigro6Ourq6J9auDeZ7l/1TE8T7h+9f8/orrzQ2Nu5ub//QZ//pM//+7/P23CuTyWQymT332eeTX/zSL6697lfX33DYMccYY4LSvq3btq29774pzc3tO3asPvvsb/zkJ3vtt18mk6mtq1uybNn3LvndAQcf3NXRUd/QcM+tt3nZ7KDEqLTu6epaevDB3/n1bxYdsLSmtrampmbR0qXf/tWvFx1wQE93t+O6vu9//AtfuPC9f9PU3OxkMlOnT3/X+9//qX/7cmdHR01NzfbWlicffjj4+ND6AYhGIA3m61Ypjga1iyb0bI4gClT682nEemG0QUzErVb7r5Tv+3X19ctXrerp6RGRxx74ayGePf3YYy+/8Lx2nPl77TV3/nzXdZ94+OF1zzxT2ATjybVrteNk+/qOP3llYfKhtXaPvfc6/Jhjerp7stnso/c/ICKe74u1D/z5ni2bNyml9l20qHnatJqamjV33rlj+3btOI7jeJ735COP1NbVWZETTj1NguFKpay1+yxYeMgRR/b19PT29gSv0PM8EVlz550tW7YopRYsXjyleWqmpube22/b1d4efMO+vt6nH3ustq5OiZx46qky7PiYtSKycf1rxhjf86ZOn37aW95ijBFjCxOADz/22Hl77pnt6xtlg0rHcU57y7nGGM/LFir9zN97r5NOP72rszOTyWzZvCnI1f1bWTqO53leNhscbcd1M5lMpqZGRI476aQZM2f6nuf7/qbX1xe/8uA1ZPv6fM8L/qebyWRqMsErO37VqmxfXyaT2brpDd/3B9VrVVp3d3Ude9JJM+fM8YtqRBljLvybv1VKuY6za+fONze9UTgyg95m8MjgK5/51IP33NPQ2Dhvzz1/9IfLZ82da4YMor747LNeNut73sw5c85/z3uMMf0lpjxv6SGHrFi1KkhHr764zhjraG1LvmpFKS+bXX32OdbabF+f5Ktn1dXXn3XB23q6u91MZntLy84dO6RCg6Iizzz+uFjb29s7d489/u6jHy1+g0HFphNOOeWAgw/OLZq1VkTeWL++ZesWN5Mxxrz97/4+eM3FL/68iy7q7Oyorat7842NwYVdfBaUUr29vSeednpNbW02mxVrxdpsNlvf0LD67LM7OzuttQ2NjWeef4ExJih3FCzVPvvtb589d67n+9m+vo3r19PuAYhqHK1Kb3CC46IEUaDCT4lMhVNoLoJSjqj6Tjz1NMdxMjU1zzzxeF9vbyaTEZFbr72mt6enq6PjPf/n/579trf39PR0tLffc+utkh+SevaJJ2pqamrr6laedaaIKK0kP9iy4pRTfN93HP3kI4+IiOu6otStV1+tte7u7PzE579w9IoVnue9+cYbf73nnuA1bHzttddffllpPWPWrGCibxB7gsHP41evDgr5PPHwwyISVA+65dpr3Eymu6vrH7/0b4cec7Qx5o316x9ec1/wDde/9NKG115TSs2aN2/5ypUy8kaRwUBfkJqmz5pV2As0KG+jtB5tgaiItTZTW5upqdFaa6VVnrV29rx5waaOnbt39/b0DHzOY1zXdTOZYLXtju3bd7a1Bb/u3rW7edq0YFVtX2/v0DSYqalxXLe3p6ettXVnW9vOtrbtra272ttr6+rcTMaK9Pb2Dn3BSsQaU9ihJxCU52meNi2YZdrT09O5u0OGXUxrbPO0ab/6/vd///Ofz5g9e9fOnZ/81y8uOuAAz/OG7pYZPF/o6+2dO3/+7HnzCkWAgjWK1trFyw7q6+3N1NS0tbT09nSLUuPoB1jrZDJ1dXW53Tjz78RaO2f+vOBE93Z3d+7ePWyiLoud27cHeXjuHnvMnD1bax1slxpwHMcY078RS77QVBAOp0ybts/ChUop7TjFL37xgQfW1NQqrdt37GjfuXPoWVAiU5qbC/PSRangSc1e+y1wHcf3vOapU6dMnRpctLmT6zh19XUzZs0KnhN17N6VC/MAELk4GszXdUPfsW8iPV72EQWi9Zkc56MvhkAjIegoH3PCCfP32qtl69bXX3nl9VdeWbxsWVdn55o773Izmbr6+tXnnNOxa9f/fufbotQdN97wgU9+MlNT8/xTT7Zs3er7/qIDDjjw0MNFRCktIkGEO+m006c0N/f19T3/1JM729qmzZixeePGxx560HHdWXPmrDr7bM/zrvvDH4K4e87b3y4iTz788O5du5RSBx9xxB57713Y8zD4hiefcfqP//Obvu8/+/hjHbt2NTU3v/7KK08+/LDjOHPmzz/5jDN2trXdcvXVotQt11xz6lvOFZHH167t6uzQog47+ujZ8+YNu5ln8f3PWltbVzdsWB1zVM1aOzRHBfNvC78fnCe1fuT++6/9/e+ffvTRzo7dtihsGGt3bm9zM5lBw7DBMenu7rryNxf/+ZabN23Y4GWzhbt1EPLrGxp6urtHmUic221ycMg0gwZdh2b1pilNV//uku986YvTZszwPS9TW3vV7y455x3vqKmtHbpBpcpXLaqvb6irqxv0D5RSrusGf9jb2+t7WZFxPo8ersRRMMI/6DVUrL+klIgxZtqMGTLcFp1DL6T+Y1JX1zxtmgxsAZVSWjtBmu3r68tms6OcvkHfNpPJBJWZ6hsaXNcd/lFL5Y8JAJSlfS3afdSEVCwzGH3R40iXBFGgYinUn2xV69EiaNgPujBGf9oYM3X69COOW37TlVdk+/oeffCv+x944CP33//aSy9aaw856qgFixf3dHfvv/TAV9a98MLTTz/z+OOHH3vsEw891NXR4TjOsSedVN9QH4z7iYhWSqzdb/HiJQcd/MTah7Zv2/bs44+vOOWUe269pXXbNhFZccopDY2NR61YMXf+Hjvbtj+8Zs2bG9+Yt9eejz34oPF9pVVQgDdYp1roOi8+cNn+S5c+9+ST27Zufe6pp4494YS7b7555/btInLy6afX1tUdc+KJs+bO3dXe/tBf/tKydevsuXMff/AhMdYqOen000XEWDvmesHyT+McIdRprS/5yU+++k+fMb7JZDJ9gwYwlWqaMmVQorDGiFKt27Z94r0Xrbnrz42NDb7vewPjSqampmnKlHK9zuLDUlNTs2XTpm9+/vPBjGKtdWNT0/133XXZz3/+gX/8x8LZH1eQ7I9G5WsQ4h60cnWVlRrXGykcTKoQAUhQB0WL0uHFUWvE+KUXK2FqLlAZpjIptDARlxQayb7vyjPOCObBPvHQQ0qp266/LtvX53neKW85V0Tq6utPectbstlsd1fXn2+9RSn1yAN/dTKudpyTTj9jUBTwjXFdd8Xq1cb3u7u7n3zkYaXUbdddF8zPPOO888TaPffZ57iVJ3vZbMvWrQ/ee49S6vGHHnQzmaYpzccX5uXmo4Xv+5mamuWrVvm+37V79zOPPipK3X7D9Y7rOq57+nnni8h+++9/9Akn+J63ZdMbwf6lT6x9yMlkmqdNO37lquhElCCFPvXII9/43P9raGhsnDKlrr7+iOXLl69cedzKlctXrly+cuWxJ54YjCIOfD4kSqlvf+mLa+768/w991BK7bXffsvzX3LcySuXr1y58IADfN8v+0fMBsOt3d1eNrt7165//OKX/v5jH2tr3T5txoyffftbG157zRmyaWeJETcZj3JSGJgBILw4ql1xMqJ0xWfSjWefCIIoUJkUWv5BIYe1oNHvSR970knTZ83SjvPCM8/s3L597Zo1jutOmzHjjPPPC/7Zaeee29DQ4LjuX267rXXb1lfXrbPG7rH33kcuXy4DJyIGp/mk006rratTSr3w9NNvvvHGM489prXee8GCE087PbjCznjreUFKuevmmzZv2LB540bf9xcfdNDiZcskvyNl8Tc8+bTTM5mMKPX8009tXL/+uSefCMoUHb9qVZCCTn/rW4O9W+666U8bXn11y6ZNvuctPfTQ/RYvzi2rKyGT20qnKWtF5JZrrgmm3U6dNu2nV1x5zX1rLr/r7j/edffld90d/GbuHntks9nCXOLg9W9vabn39ttnzJzRvmPH+e95z5V/vufywpfcfffld9398c9/vqerq5R3OgGu6+5sa/u7j3zkQ5/97Ic+89mFSxYb39/e0vLdL3+58L7636XJjex52b6gju7QZx+5e7njhJPKRp97PIHvZkWU0h0dHcN+T1M02zl/TIzkJ2z3dHfLSA/8rA0e2dA0AUB/RyCIo7rCs+qMX2I3mDYaqMTHr6yTHyKxZzHGOktaG2P22GefQ448MtvX19bScslPf7pt82bf9w856qh9Fy4K+tOHHHXU0kMPtb6/acOGK37zm/adO3zfO/zYY6fNmDFoW5QgPi07/PCFS5b4nv/aSy9d+rOfdXR0ZLPZ41etamxqClZOnnjaaXvus49S6vmnnrrqkkt6uruN7x+/cqXjOL4xMuQbHnr00fsuXGSNefn553//v//b09Xd19d3wimn1tXXB0F05RlnzttjD62dZx577NpLL+3t7TW+v2L16uAN5jv5QRGZ3Eaj/aHCWsd1d7S29nZ1FecHa621xnh+2cKSUiKyacPrmZqazt27zzz/ghWrVxvf2NxPMtba7u7uQQOMwUt68403erq6rLX1DQ0f/dznZs+bV1z81hozqLJReS+Sjt27z3nHO776wx95njd1+vRPf/nfu7q6ps2Y8acrr7jrppu04xSvz6xvbLDGuJlM67Ztba2twTEvPFZQSr35xhtuJuNls9NmzKhvaBw27Zd3omldfX3wRnp6eoLjVpQQza72di+bHVSothApc9dM0V/VNTSIiJtxtr35ZldnZ2Ev3HxT6gfFmYq/pL6xMcjzu9vb33xjY/FFGJzEbW++GexsNGXq1MYpTUK7CQCD76GO6ArvPlraxECCKFBW1pQ+IWHM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";
  var bkLetterheadAspect = 1240 / 2097;

  function buildInquiryMessage() {
    var firstName = (state.name || "").trim().split(/\s+/)[0];
    var lines = [
      "Hi! I'd like to inquire about a stay at Dhaankolhu Rasdhoo Island." + (firstName ? " This is " + firstName + "." : ""),
      "",
      "Room category: " + (state.room || "\u2014")
    ];
    if (occupancyLabel()) lines.push("Occupancy: " + occupancyLabel());
    lines.push("Number of pax: " + (state.pax || "\u2014"));
    lines.push("");
    lines.push("I've attached my booking details PDF here.");
    return lines.join("\n");
  }

  /* ---------- build the booking summary as a clean, simple A4 PDF (jsPDF):
     small black emblem + title lockup, soft-bordered table with a light
     zebra stripe, and a highlighted total row. No colors beyond ink/grey. ---------- */
  function buildInquiryPDF() {
    var n = nights();
    var total = state.price && n ? state.price * n : 0;
    var jsPDFCtor = window.jspdf.jsPDF;
    var hasLetterhead = !!(bkLetterheadDataUrl && bkLetterheadAspect);
    var doc = new jsPDFCtor({ unit: "pt", format: "a4", compress: true });
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();

    /* Letterhead placement: the artwork itself runs edge-to-edge (logo touches
       the left edge, the phone number touches the right edge), so it's set
       inside the same 56pt side margins as the content below. That keeps the
       logo lined up with the table's left edge and the contact block with its
       right edge, and nothing gets clipped. Centered vertically on A4. */
    var lhX = 56, lhW = pageW - 112, lhH = 0, lhY = 0;
    if (hasLetterhead) {
      lhH = lhW / bkLetterheadAspect;
      lhY = Math.max(0, (pageH - lhH) / 2);
      try { doc.addImage(bkLetterheadDataUrl, "PNG", lhX, lhY, lhW, lhH, undefined, "FAST"); } catch (err) { hasLetterhead = false; }
    }

    var INK = [23, 35, 42];
    var MUTED = [108, 113, 109];
    var BORDER = [210, 210, 210];
    var ROW_ALT = [247, 247, 246];
    var TOTAL_BG = [235, 235, 233];

    var margin = 56;
    var contentW = pageW - margin * 2;
    var y = margin;

    if (hasLetterhead) {
      /* The letterhead already carries the logo + contact details (top) and the
         website (bottom). Content starts just below the header artwork
         (it ends ~16.5% down the artwork) and must stay above the footer (~91.8%). */
      y = lhY + lhH * 0.255; /* title sits lower, well clear of the header artwork */
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor.apply(doc, INK);
      doc.text("Booking Enquiry", margin + contentW / 2, y + 14, { align: "center" });
      y += 44;
    } else {
      /* header: big logo (top-left) + location tagline on the opposite side (top-right).
         The logo is vertically centered against the 3-line text block on the right,
         so both sit level instead of the logo hanging lower on the page. */
      var logoSize = 192;
      var textBlockCenterY = y + 28; /* midpoint between the 3 lines of text below */
      if (bkLogoDataUrl) {
        var logoW = logoSize;
        var logoH = logoSize;
        if (bkLogoAspect >= 1) { logoH = logoSize / bkLogoAspect; } else { logoW = logoSize * bkLogoAspect; }
        var logoY = textBlockCenterY - logoH / 2;
        try { doc.addImage(bkLogoDataUrl, "PNG", margin, logoY, logoW, logoH); } catch (err) { /* image optional */ }
      }

      /* Top-right block: location, then contact number + email right below it.
         SAMPLE VALUES — swap "+960 989 8130" and "info@dhaankolhu.com" for
         the resort's real contact number and email once you have them. */
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, MUTED);
      doc.text("Local island \u00B7 North Ari Atoll, Maldives", margin + contentW, y + 14, { align: "right" });
      doc.text("+960 989 8130", margin + contentW, y + 28, { align: "right" });
      doc.text("info@dhaankolhu.com", margin + contentW, y + 42, { align: "right" });

      var headerBlockH = Math.max(logoSize, 42) + 18;
      y += headerBlockH;

      /* centered title, sitting in the open space between the header and the
         booking-summary divider — gives the page a clear "document title" anchor */
      var titleY = y - 40;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.setTextColor.apply(doc, INK);
      doc.text("Booking Enquiry", margin + contentW / 2, titleY, { align: "center" });
    }

    doc.setDrawColor.apply(doc, BORDER);
    doc.setLineWidth(1);
    doc.line(margin, y, margin + contentW, y);

    y += 22;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor.apply(doc, MUTED);
    doc.text("BOOKING SUMMARY", margin, y);
    y += 18;

    /* table rows: label left cell, value right cell */
    var rows = [
      ["Name", state.name || "\u2014"],
      ["Check-in", state.arrival ? formatDateTime(state.arrival, state.arrivalTime) : "\u2014"],
      ["Check-out", state.departure ? formatDateTime(state.departure, state.departureTime) : "\u2014"],
      [n === 1 ? "Night" : "Nights", state.arrival && state.departure && n > 0 ? String(n) : "\u2014"],
      ["Number of pax", state.pax ? String(state.pax) : "\u2014"],
      ["Room category", state.room || "\u2014"]
    ];
    if (occupancyLabel()) rows.push(["Occupancy", occupancyLabel()]);
    rows.push(["Email", state.email || "\u2014"]);
    if (state.phone) rows.push(["Contact", state.phone]);
    rows.push(["Estimated total", "$" + total.toLocaleString() + " +tax"]);

    var labelColW = contentW * 0.34;
    var valueColW = contentW - labelColW;
    var cellPad = 10;
    var valueMaxW = valueColW - cellPad * 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    /* with the letterhead, rows are as tall as fits between the table's top
       and just above the footer (max 38pt), so a longer request (e.g. with
       the extra Occupancy row) never runs into the website line. */
    var minRowH = hasLetterhead ? Math.max(27, Math.min(38, Math.floor((lhY + lhH * 0.78 - y) / rows.length))) : 27;
    var measuredRows = rows.map(function (row) {
      var lines = doc.splitTextToSize(String(row[1]), valueMaxW);
      return { label: row[0], lines: lines, h: Math.max(minRowH, lines.length * 13 + cellPad * 2) };
    });

    var tableTop = y;

    measuredRows.forEach(function (row, i) {
      var rowH = row.h;
      var isTotal = row.label === "Estimated total";

      /* row background */
      if (isTotal) {
        doc.setFillColor.apply(doc, TOTAL_BG);
        doc.rect(margin, y, contentW, rowH, "F");
      } else if (i % 2 === 1) {
        doc.setFillColor.apply(doc, ROW_ALT);
        doc.rect(margin, y, contentW, rowH, "F");
      }

      /* label */
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor.apply(doc, MUTED);
      doc.text(row.label.toUpperCase(), margin + cellPad, y + rowH / 2 + 3);

      /* value */
      doc.setFont("helvetica", isTotal ? "bold" : "normal");
      doc.setFontSize(isTotal ? 12.5 : 10.5);
      doc.setTextColor.apply(doc, INK);
      var lineBlockH = row.lines.length * 13;
      var lineStartY = y + rowH / 2 - lineBlockH / 2 + 9;
      row.lines.forEach(function (line, li) {
        doc.text(line, margin + labelColW + cellPad, lineStartY + li * 13);
      });

      /* row divider */
      doc.setDrawColor.apply(doc, BORDER);
      doc.setLineWidth(0.6);
      doc.line(margin, y + rowH, margin + contentW, y + rowH);

      y += rowH;
    });

    var tableBottom = y;

    /* outer table border + column divider */
    doc.setDrawColor.apply(doc, BORDER);
    doc.setLineWidth(0.75);
    doc.rect(margin, tableTop, contentW, tableBottom - tableTop);
    doc.line(margin + labelColW, tableTop, margin + labelColW, tableBottom);

    /* footer note */
    y = tableBottom + 26;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9.5);
    doc.setTextColor.apply(doc, MUTED);
    doc.text("We'll confirm the details with you on WhatsApp.", margin, y);

    y += 16;
    var note = "This is an enquiry, not a charge \u2014 our island team will follow up on WhatsApp to confirm availability before anything is booked.";
    doc.text(doc.splitTextToSize(note, contentW), margin, y);

    return doc;
  }

  function showSuccess() {
    clearDraft();
    var message = buildInquiryMessage();
    var encoded = encodeURIComponent(message);
    var deepLink = "https://wa.me/" + WHATSAPP_NUMBER_RAW + "?text=" + encoded;
    whatsappLink.href = deepLink;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(message).catch(function () {});
    }

    panel.querySelector("form").classList.add("bk-anim-out");
    window.setTimeout(function () {
      form.style.display = "none";
      actions.style.display = "none";
      successView.classList.add("is-current", "bk-anim-in-start");
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { successView.classList.remove("bk-anim-in-start"); });
      });
      currentStep = 5;
      if (5 > maxStepReached) maxStepReached = 5;
      updateRail(5);
      scrollPanelIntoView();
    }, 380);
  }

  function goNext() {
    if (!validateStep()) return;
    hideHeaderForStep();
    if (currentStep < TOTAL_STEPS) {
      goToStep(currentStep + 1);
    } else {
      showSuccess();
    }
  }

  nextBtn.addEventListener("click", goNext);

  form.addEventListener("submit", function (event) { event.preventDefault(); });

  /* safety net: also save right before the page is left, in case a change event
     didn't fire yet (e.g. typing then immediately clicking a nav link) */
  window.addEventListener("pagehide", saveDraft);
  window.addEventListener("beforeunload", saveDraft);

  /* ---------- restore a saved draft (back/forward nav, reload, revisit) ---------- */
  function restoreDraft() {
    var draft = loadDraft();
    if (!draft || !draft.state) return;

    for (var key in draft.state) {
      if (Object.prototype.hasOwnProperty.call(state, key)) state[key] = draft.state[key];
    }

    /* dates */
    arrivalInput.value = state.arrival || "";
    departureInput.value = state.departure || "";
    arrivalTrigger.textContent = state.arrival ? formatDisplayDate(state.arrival) : "dd/mm/yyyy";
    arrivalTrigger.setAttribute("data-empty", state.arrival ? "false" : "true");
    departureTrigger.textContent = state.departure ? formatDisplayDate(state.departure) : "dd/mm/yyyy";
    departureTrigger.setAttribute("data-empty", state.departure ? "false" : "true");
    arrivalTimeInput.value = state.arrivalTime || "14:00";
    departureTimeInput.value = state.departureTime || "12:00";
    syncDepartureMin();

    /* stay/room */
    if (state.room) {
      var matchingRoom = roomGrid.querySelector('.bk-room[data-room="' + state.room.replace(/"/g, '\\"') + '"]');
      if (matchingRoom) {
        roomGrid.querySelectorAll(".bk-room").forEach(function (r) {
          r.classList.remove("is-selected");
          r.setAttribute("aria-pressed", "false");
        });
        matchingRoom.classList.add("is-selected");
        matchingRoom.setAttribute("aria-pressed", "true");
      }
    }

    /* pax + occupancy note */
    state.pax = Number(state.pax) || 0;
    paxInput.value = state.pax ? String(state.pax) : "";
    updatePaxButtons();
    updateOccupancyNote();

    /* traveller details */
    nameInput.value = state.name || "";
    emailInput.value = state.email || "";

    /* phone + country code */
    if (draft.selectedPhoneCode) {
      selectedPhoneCode = draft.selectedPhoneCode;
      var matchingCode = COUNTRY_CODES.filter(function (c) { return c.code === selectedPhoneCode; })[0];
      if (matchingCode) {
        codeFlagEl.textContent = matchingCode.flag;
        codeValueEl.textContent = matchingCode.code;
        paintFlags(codeFlagEl);
      }
    }
    if (state.phone) {
      var phoneDigits = state.phone.indexOf(selectedPhoneCode) === 0
        ? state.phone.slice(selectedPhoneCode.length).trim()
        : state.phone;
      phoneInput.value = phoneDigits;
      updatePhoneValidity();
    }

    /* step position */
    var savedStep = Number(draft.currentStep) || 1;
    maxStepReached = Math.max(Number(draft.maxStepReached) || 1, savedStep);
    if (savedStep > 1 && savedStep <= TOTAL_STEPS) {
      var current = form.querySelector(".bk-step.is-current");
      var target = form.querySelector('.bk-step[data-step="' + savedStep + '"]');
      if (current && target && current !== target) {
        current.classList.remove("is-current");
        target.classList.add("is-current");
      }
      currentStep = savedStep;
      nextBtn.textContent = savedStep === TOTAL_STEPS ? "Send via WhatsApp" : "Next";
      if (!nextBtn.querySelector("span")) nextBtn.innerHTML = nextBtn.textContent + " <span>→</span>";
      if (savedStep === TOTAL_STEPS) buildReview();
    }
    updateRail(currentStep);

    updateTicket();
    validateStep();
  }

  /* initial state */
  restoreDraft();
  updateTicket();
  validateStep();
  updateRail(currentStep);

  /* the rail highlight's position/width is measured from the rendered
     button text, but if it's measured before the DM Sans/Poppins webfonts
     swap in, it locks onto the fallback font's (slightly different) text
     width — leaving the white highlight a few pixels off from the label
     it's supposed to sit under, clipping into the first letter. Re-measure
     once the real fonts are actually ready, and once more after a short
     delay as a fallback for browsers without the Font Loading API. */
  function recalibrateRailIndicator() {
    var active = document.querySelector(".bk-rail-step.is-active");
    if (active) moveRailIndicator(active);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(recalibrateRailIndicator).catch(function () {});
  }
  window.setTimeout(recalibrateRailIndicator, 400);
})();

/* ==========================================================================
   Room photo viewer — same "grow from the card" morph effect as index.html's
   highlight-expand-overlay (a FLIP animation: the panel is set to the
   clicked image's exact on-screen rect with no transition, then on the next
   frame we change its rect to fill the screen while a transition is on, so
   the browser animates the interpolation between the two — this is what
   makes it look like the card itself is smoothly growing into the full
   view, rather than a modal just fading/popping in). Reuses the very same
   CSS classes as the index.html version (already defined in style.css), so
   the visual result is identical; this module only drives book-now.html's
   copy of that markup and adds angle (prev/next) browsing within one room's
   3 photos instead of cycling between sibling cards.
   ========================================================================== */
(function () {
  var wraps = Array.prototype.slice.call(document.querySelectorAll("[data-room-gallery]"));
  var overlay = document.getElementById("room-expand-overlay");
  if (!wraps.length || !overlay) return;

  var backdrop = document.getElementById("room-expand-backdrop");
  var panel = document.getElementById("room-expand-panel");
  var panelImg = document.getElementById("room-expand-img");
  var panelTitle = document.getElementById("room-expand-title");
  var panelDesc = document.getElementById("room-expand-desc");
  var panelTags = document.getElementById("room-expand-tags");
  var panelThumbs = document.getElementById("room-expand-thumbs");
  var closeBtn = document.getElementById("room-expand-close");
  var prevBtn = document.getElementById("room-expand-prev");
  var nextBtn = document.getElementById("room-expand-next");

  var EXPAND_MS = 600;
  var COLLAPSE_MS = 480;
  var activeWrap = null;
  var activeAngles = [];
  var activeIndex = 0;
  var isAnimating = false;

  function setPanelRect(rect, radius) {
    panel.style.top = rect.top + "px";
    panel.style.left = rect.left + "px";
    panel.style.width = rect.width + "px";
    panel.style.height = rect.height + "px";
    panel.style.borderRadius = radius;
  }

  function getExpandedRect() {
    return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
  }

  function getAngles(wrap) {
    var img = wrap.querySelector(".bk-room-photo");
    return (img.getAttribute("data-angles") || img.src).split("|").filter(Boolean);
  }

  function getRoomMeta(wrap) {
    var card = wrap.closest(".bk-room");
    var titleEl = card ? card.querySelector("h3") : null;
    var descEl = card ? card.querySelector(".bk-room-body p") : null;
    return {
      title: titleEl ? titleEl.textContent.trim() : "",
      desc: descEl ? descEl.textContent.trim() : ""
    };
  }

  function syncCardActiveAngle(wrap, index) {
    var media = wrap.closest(".bk-room-media");
    if (!media) return;
    var mainImg = wrap.querySelector(".bk-room-photo");
    var angles = getAngles(wrap);
    var url = angles[index];
    if (mainImg.getAttribute("src") !== url) {
      mainImg.classList.add("is-swapping");
      window.setTimeout(function () {
        mainImg.src = url;
        mainImg.classList.remove("is-swapping");
      }, 180);
    }
    /* TEMP DEMO ONLY: the 3 angle slots currently point to the same photo
       (placeholder until real distinct room photos are uploaded), so a
       plain src-swap wouldn't visibly show anything changed. This shifts
       the crop/zoom per angle purely so switching is visibly obvious in
       the meantime — remove the data-demo-angle attribute (and its CSS in
       book-now.css) once each angle has its own real photo. */
    mainImg.setAttribute("data-demo-angle", index);
    media.querySelectorAll(".bk-room-angle").forEach(function (btn, i) {
      btn.classList.toggle("is-active", i === index);
      btn.setAttribute("aria-pressed", i === index ? "true" : "false");
    });
  }

  function renderPanel() {
    panelImg.src = activeAngles[activeIndex];
    panelImg.setAttribute("data-demo-angle", activeIndex); /* TEMP DEMO ONLY — see note in syncCardActiveAngle */
    var meta = getRoomMeta(activeWrap);
    panelTitle.textContent = meta.title;
    panelTitle.style.display = meta.title ? "" : "none";
    panelDesc.textContent = meta.desc;
    panelDesc.style.display = meta.desc ? "" : "none";

    /* thumbnail strip: one button per angle, active one highlighted,
       clicking jumps straight to that angle (same crossfade as prev/next) */
    panelThumbs.innerHTML = "";
    if (activeAngles.length > 1) {
      activeAngles.forEach(function (url, i) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "room-expand-thumb" + (i === activeIndex ? " is-active" : "");
        btn.style.backgroundImage = "url('" + url + "')";
        btn.setAttribute("aria-label", "Photo " + (i + 1) + " of " + activeAngles.length);
        btn.setAttribute("aria-pressed", i === activeIndex ? "true" : "false");
        btn.addEventListener("click", function (event) {
          event.stopPropagation();
          if (i !== activeIndex) showAngle(i, true);
        });
        panelThumbs.appendChild(btn);
      });
      panelThumbs.style.display = "";
    } else {
      panelThumbs.style.display = "none";
    }
  }

  function showAngle(index, animate) {
    activeIndex = (index + activeAngles.length) % activeAngles.length;
    if (animate) {
      panel.classList.add("is-swapping");
      window.setTimeout(function () {
        renderPanel();
        panel.classList.remove("is-swapping");
      }, 220);
    } else {
      renderPanel();
    }
    syncCardActiveAngle(activeWrap, activeIndex);
  }

  function openViewer(wrap, startIndex) {
    if (isAnimating) return;
    isAnimating = true;
    activeWrap = wrap;
    activeAngles = getAngles(wrap);
    activeIndex = startIndex || 0;
    syncCardActiveAngle(wrap, activeIndex);
    renderPanel();

    var startRect = wrap.getBoundingClientRect();
    var startRadius = getComputedStyle(wrap).borderRadius || "0px";

    overlay.classList.add("is-visible");
    document.body.classList.add("highlight-expand-lock");

    panel.style.transition = "none";
    setPanelRect(startRect, startRadius);
    panel.classList.add("is-active");
    void panel.offsetWidth; /* force reflow so the next change animates */

    requestAnimationFrame(function () {
      panel.style.transition = "top " + EXPAND_MS + "ms cubic-bezier(.16,1,.3,1), left " + EXPAND_MS + "ms cubic-bezier(.16,1,.3,1), width " + EXPAND_MS + "ms cubic-bezier(.16,1,.3,1), height " + EXPAND_MS + "ms cubic-bezier(.16,1,.3,1), border-radius " + EXPAND_MS + "ms cubic-bezier(.16,1,.3,1)";
      backdrop.classList.add("is-visible");
      setPanelRect(getExpandedRect(), "0px");
    });

    window.setTimeout(function () {
      panel.classList.add("show-content");
      isAnimating = false;
    }, EXPAND_MS);
  }

  function closeViewer() {
    if (isAnimating || !activeWrap) return;
    isAnimating = true;
    panel.classList.remove("show-content");

    var endRect = activeWrap.getBoundingClientRect();
    var endRadius = getComputedStyle(activeWrap).borderRadius || "0px";

    backdrop.classList.remove("is-visible");
    panel.style.transition = "top " + COLLAPSE_MS + "ms cubic-bezier(.4,0,.2,1), left " + COLLAPSE_MS + "ms cubic-bezier(.4,0,.2,1), width " + COLLAPSE_MS + "ms cubic-bezier(.4,0,.2,1), height " + COLLAPSE_MS + "ms cubic-bezier(.4,0,.2,1), border-radius " + COLLAPSE_MS + "ms cubic-bezier(.4,0,.2,1)";
    setPanelRect(endRect, endRadius);

    window.setTimeout(function () {
      panel.classList.remove("is-active");
      overlay.classList.remove("is-visible");
      document.body.classList.remove("highlight-expand-lock");
      isAnimating = false;
      activeWrap = null;
    }, COLLAPSE_MS);
  }

  /* the main photo used to open the full viewer on click; now it's just
     part of the card's visual surface, so clicking it (or Enter/Space
     when focused) falls through to the existing room-selection handler
     on .bk-room via normal bubbling — no listener needed here anymore. */

  /* angle thumbnails: these just switch which photo the card's main image
     shows (a quiet "select" action) — they no longer open the full-screen
     viewer themselves. Only the big photo (data-room-gallery wrap) opens
     that; clicking a thumbnail first picks the angle, then a click on the
     now-bigger main photo opens the viewer landed on that same angle. */
  document.querySelectorAll(".bk-room-media").forEach(function (media) {
    var wrap = media.querySelector("[data-room-gallery]");
    media.querySelectorAll(".bk-room-angle").forEach(function (btn, index) {
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        syncCardActiveAngle(wrap, index);
      });
      btn.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        btn.click();
      });
    });
  });

  closeBtn.addEventListener("click", closeViewer);
  backdrop.addEventListener("click", closeViewer);
  prevBtn.addEventListener("click", function () { showAngle(activeIndex - 1, true); });
  nextBtn.addEventListener("click", function () { showAngle(activeIndex + 1, true); });
  document.addEventListener("keydown", function (event) {
    if (!panel.classList.contains("is-active")) return;
    if (event.key === "Escape") closeViewer();
    if (event.key === "ArrowRight") showAngle(activeIndex + 1, true);
    if (event.key === "ArrowLeft") showAngle(activeIndex - 1, true);
  });
})();

/* ==========================================================================
   Header contact bubble toggle (mirrors the floating contact-bubbles open/
   close behaviour from index.html/script.js — same interaction, just wired
   to this page's inline header version instead of the fixed corner one).
   ========================================================================== */
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

  /* same "chat widget that actually just opens WhatsApp" front door as the
     floating widget on index.html — typing a message and hitting send
     pre-fills that text into a WhatsApp chat with the same phone number
     used everywhere else on this page. */
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
