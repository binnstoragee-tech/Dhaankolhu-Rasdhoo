/* Book Now — Dhaankolhu Rasdhoo Island: step flow, live booking summary ticket, rise-up transitions. */
(function () {
  "use strict";

  /* ==========================================================================
     Smooth cross-page transitions (matches script.js on the main site) —
     fades this page IN on load, and fades OUT before navigating to another
     page (e.g. tapping the logo or a nav link back to index.html).
     ========================================================================== */
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
  var arrivalTimeInput = document.getElementById("bk-arrival-time");
  var departureTimeInput = document.getElementById("bk-departure-time");
  var stepper = document.querySelector(".bk-stepper");
  var stepperCount = stepper.querySelector("span");
  var roomGrid = document.getElementById("bk-room-grid");
  var nameInput = document.getElementById("bk-name");
  var emailInput = document.getElementById("bk-email");
  var phoneInput = document.getElementById("bk-phone");

  var ticketTotalEl = document.getElementById("bk-ticket-total");
  var ticketCodeEl = document.getElementById("bk-ticket-code");

  var state = { arrival: "", departure: "", arrivalTime: "14:00", departureTime: "12:00", guests: 5, room: null, price: 0, name: "", email: "", phone: "", country: "" };
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
  var todayStr = new Date().toISOString().slice(0, 10);

  /* ---------- guest stepper ---------- */
  stepper.addEventListener("click", function (event) {
    var btn = event.target.closest("button");
    if (!btn) return;
    var delta = btn.getAttribute("data-action") === "increase" ? 1 : -1;
    state.guests = Math.min(10, Math.max(1, state.guests + delta));
    stepperCount.textContent = state.guests;
    updateTicket("guests");
    saveDraft();
  });

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

  /* ---------- custom animated date pickers ---------- */
  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function toISO(y, m, d) {
    var mm = String(m + 1).padStart(2, "0");
    var dd = String(d).padStart(2, "0");
    return y + "-" + mm + "-" + dd;
  }

  function parseISO(str) {
    if (!str) return null;
    var parts = str.split("-");
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }

  function displayDate(str) {
    var d = parseISO(str);
    if (!d) return "";
    var dd = String(d.getDate()).padStart(2, "0");
    var mm = String(d.getMonth() + 1).padStart(2, "0");
    return dd + "/" + mm + "/" + d.getFullYear();
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

  function to24Hour(hour12, minute, period) {
    var h = Number(hour12) % 12;
    if (period === "PM") h += 12;
    return String(h).padStart(2, "0") + ":" + minute;
  }

  function formatTime(hhmm) {
    if (!hhmm) return "";
    var t = to12Hour(hhmm);
    return t.hour + ":" + t.minute + " " + t.period;
  }

  function makeDatePicker(opts) {
    var root = document.getElementById(opts.rootId);
    var trigger = document.getElementById(opts.triggerId);
    var valueEl = trigger.querySelector(".bk-date-value");
    var input = document.getElementById(opts.inputId);
    var clearBtn = document.getElementById(opts.clearId);
    var panel = root.querySelector(".bk-date-panel");
    var titleEl = root.querySelector(".bk-cal-title");
    var gridEl = root.querySelector(".bk-cal-grid");
    var timeInput = document.getElementById(opts.timeInputId);
    var hourSelect = root.querySelector(".bk-cal-hour-select");
    var minuteSelect = root.querySelector(".bk-cal-minute-select");
    var periodSelect = root.querySelector(".bk-cal-period-select");
    var todayD = parseISO(todayStr);
    var view = parseISO(input.value) || todayD;
    view = new Date(view.getFullYear(), view.getMonth(), 1);

    /* time selects — the Time-of-day picker UI was removed; arrival/departure
       still carry a fixed default time (set via the hidden inputs' value attr)
       used for the summary/PDF, so this just guards against the now-missing
       select elements instead of throwing. */
    if (hourSelect && minuteSelect && periodSelect) {
      for (var hh = 1; hh <= 12; hh++) {
        var hOpt = document.createElement("option");
        hOpt.value = String(hh);
        hOpt.textContent = String(hh);
        hourSelect.appendChild(hOpt);
      }
      ["00", "15", "30", "45"].forEach(function (mm) {
        var mOpt = document.createElement("option");
        mOpt.value = mm;
        mOpt.textContent = mm;
        minuteSelect.appendChild(mOpt);
      });

      [hourSelect, minuteSelect, periodSelect].forEach(function (sel) {
        sel.addEventListener("click", function (e) { e.stopPropagation(); });
        sel.addEventListener("change", commitTime);
      });
    }

    function syncTimeSelects() {
      if (!hourSelect || !minuteSelect || !periodSelect) return;
      var t = to12Hour(timeInput.value);
      hourSelect.value = t.hour;
      minuteSelect.value = t.minute;
      periodSelect.value = t.period;
    }

    function commitTime() {
      timeInput.value = to24Hour(hourSelect.value, minuteSelect.value, periodSelect.value);
      timeInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    syncTimeSelects();

    function minDate() {
      var min = opts.getMin ? parseISO(opts.getMin()) : todayD;
      return min && min > todayD ? min : todayD;
    }

    function isSameDay(a, b) {
      return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    function render() {
      titleEl.textContent = MONTH_NAMES[view.getMonth()] + " " + view.getFullYear();
      gridEl.innerHTML = "";
      var min = minDate();
      var selected = parseISO(input.value);
      var rangeStart = parseISO(arrivalInput.value);
      var rangeEnd = parseISO(departureInput.value);
      var firstWeekday = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
      var daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      var daysInPrevMonth = new Date(view.getFullYear(), view.getMonth(), 0).getDate();
      var totalCells = 42;
      var frag = document.createDocumentFragment();

      for (var i = 0; i < totalCells; i++) {
        var dayNum, cellMonth, cellYear, isOutside = false;
        if (i < firstWeekday) {
          dayNum = daysInPrevMonth - firstWeekday + 1 + i;
          cellMonth = view.getMonth() - 1;
          cellYear = view.getFullYear();
          isOutside = true;
        } else if (i >= firstWeekday + daysInMonth) {
          dayNum = i - (firstWeekday + daysInMonth) + 1;
          cellMonth = view.getMonth() + 1;
          cellYear = view.getFullYear();
          isOutside = true;
        } else {
          dayNum = i - firstWeekday + 1;
          cellMonth = view.getMonth();
          cellYear = view.getFullYear();
        }
        var cellDate = new Date(cellYear, cellMonth, dayNum);

        var btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = String(dayNum);
        btn.className = "bk-cal-day";
        if (isOutside) btn.classList.add("is-outside");
        if (isSameDay(cellDate, todayD)) btn.classList.add("is-today");
        if (isSameDay(cellDate, selected)) btn.classList.add("is-selected");
        if (rangeStart && rangeEnd && cellDate > rangeStart && cellDate < rangeEnd) btn.classList.add("is-in-range");
        if (isSameDay(cellDate, rangeStart)) btn.classList.add("is-range-start");
        if (isSameDay(cellDate, rangeEnd)) btn.classList.add("is-range-end");
        if (cellDate < min) {
          btn.disabled = true;
          btn.classList.add("is-disabled");
        }
        btn.addEventListener("click", function (d) {
          return function () { selectDate(d); };
        }(cellDate));
        frag.appendChild(btn);
      }
      gridEl.appendChild(frag);
    }

    function selectDate(d) {
      input.value = toISO(d.getFullYear(), d.getMonth(), d.getDate());
      valueEl.textContent = displayDate(input.value);
      valueEl.classList.add("has-value");
      root.classList.add("has-date");
      input.dispatchEvent(new Event("change", { bubbles: true }));
      closePanel();
      if (opts.onSelect) opts.onSelect(d);
      /* re-render the *other* picker too, so the visual range/min updates immediately */
      if (opts.sibling) opts.sibling.refresh();
    }

    function clearDate() {
      input.value = "";
      valueEl.textContent = valueEl.getAttribute("data-empty-text");
      valueEl.classList.remove("has-value");
      root.classList.remove("has-date");
      input.dispatchEvent(new Event("change", { bubbles: true }));
      render();
      if (opts.onClear) opts.onClear();
      if (opts.sibling) opts.sibling.refresh();
    }

    if (clearBtn) {
      clearBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        clearDate();
      });
    }

    function openPanel() {
      closeAllPickers(root);
      view = new Date((parseISO(input.value) || minDate()).getFullYear(), (parseISO(input.value) || minDate()).getMonth(), 1);
      render();
      root.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");
      var panelWrap = root.closest(".bk-panel");
      if (panelWrap) panelWrap.classList.add("bk-allow-overflow");
    }

    function closePanel() {
      root.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      var panelWrap = root.closest(".bk-panel");
      if (panelWrap && !panelWrap.querySelector(".bk-date-select.is-open")) panelWrap.classList.remove("bk-allow-overflow");
    }

    function togglePanel() {
      if (root.classList.contains("is-open")) closePanel();
      else openPanel();
    }

    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      togglePanel();
    });

    root.querySelectorAll(".bk-cal-nav").forEach(function (nav) {
      nav.addEventListener("click", function (e) {
        e.stopPropagation();
        var dir = Number(nav.getAttribute("data-nav"));
        view = new Date(view.getFullYear(), view.getMonth() + dir, 1);
        render();
      });
    });

    panel.addEventListener("click", function (e) { e.stopPropagation(); });

    if (input.value) {
      valueEl.textContent = displayDate(input.value);
      valueEl.classList.add("has-value");
      root.classList.add("has-date");
    }

    var api = { close: closePanel, refresh: render, root: root, clear: clearDate, syncTime: syncTimeSelects };
    return api;
  }

  function closeAllPickers(except) {
    document.querySelectorAll(".bk-date-select.is-open").forEach(function (el) {
      if (el !== except) {
        el.classList.remove("is-open");
        var t = el.querySelector(".bk-date-trigger");
        if (t) t.setAttribute("aria-expanded", "false");
        var panelWrap = el.closest(".bk-panel");
        if (panelWrap && !panelWrap.querySelector(".bk-date-select.is-open")) panelWrap.classList.remove("bk-allow-overflow");
      }
    });
  }

  document.addEventListener("click", function () { closeAllPickers(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeAllPickers(); });

  var arrivalPicker = makeDatePicker({
    rootId: "bk-arrival-select",
    triggerId: "bk-arrival-trigger",
    inputId: "bk-arrival",
    clearId: "bk-arrival-clear",
    timeInputId: "bk-arrival-time",
    getMin: function () { return todayStr; },
    onSelect: function (d) {
      /* if departure is now before the new arrival, clear it */
      var dep = parseISO(departureInput.value);
      if (dep && dep <= d) {
        departureInput.value = "";
        var depValueEl = document.querySelector("#bk-departure-trigger .bk-date-value");
        depValueEl.textContent = depValueEl.getAttribute("data-empty-text");
        depValueEl.classList.remove("has-value");
        document.getElementById("bk-departure-select").classList.remove("has-date");
        departureInput.dispatchEvent(new Event("change", { bubbles: true }));
      }
      /* smoothly guide the guest into picking the departure date next */
      window.setTimeout(function () {
        document.getElementById("bk-departure-trigger").click();
      }, 220);
    },
    onClear: function () {
      /* clearing arrival also clears departure, since it depends on it */
      var dep = departureInput;
      if (dep.value) {
        dep.value = "";
        var depValueEl = document.querySelector("#bk-departure-trigger .bk-date-value");
        depValueEl.textContent = depValueEl.getAttribute("data-empty-text");
        depValueEl.classList.remove("has-value");
        document.getElementById("bk-departure-select").classList.remove("has-date");
        dep.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
  });

  var departurePicker = makeDatePicker({
    rootId: "bk-departure-select",
    triggerId: "bk-departure-trigger",
    inputId: "bk-departure",
    clearId: "bk-departure-clear",
    timeInputId: "bk-departure-time",
    getMin: function () { return arrivalInput.value || todayStr; }
  });

  arrivalPicker.sibling = departurePicker;
  departurePicker.sibling = arrivalPicker;

  /* ---------- room selection ---------- */
  roomGrid.addEventListener("click", function (event) {
    var card = event.target.closest(".bk-room");
    if (!card) return;
    selectRoom(card);
  });
  roomGrid.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") return;
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
    saveDraft();
  }

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
    if (!which || which === "guests") {
      setTicketRow("guests", state.guests + (state.guests === 1 ? " guest" : " guests"), true);
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
      ticketTotalEl.textContent = hasRoom ? "$" + total.toLocaleString() + " +TGST" : "—";
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
      ok = !!(state.arrival && state.departure && nights() > 0);
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
      ["Dates", state.arrival && state.departure ? formatDateTime(state.arrival, state.arrivalTime) + " – " + formatDateTime(state.departure, state.departureTime) + " (" + n + (n === 1 ? " night" : " nights") + ")" : "—"],
      ["Guests", state.guests + (state.guests === 1 ? " guest" : " guests")],
      ["Stay", state.room || "—"],
      ["Traveller", state.name || "—"],
      ["Email", state.email || "—"],
      ["Contact number", state.phone || "—"]
    ];
    rows.push(["Estimated total", "$" + total.toLocaleString() + " +TGST"]);
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
      nextBtn.textContent = target === TOTAL_STEPS ? "Send via WhatsApp" : "Next step";
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
  fetch("img/logo/logo%20black.png").then(function (res) { return res.blob(); }).then(function (blob) {
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

  function buildInquiryMessage() {
    var n = nights();
    var total = state.price && n ? state.price * n : 0;
    var lines = [
      "Hi! I'd like to inquire about a stay at Dhaankolhu Rasdhoo Island.",
      "Dates: " + (state.arrival && state.departure ? formatDateTime(state.arrival, state.arrivalTime) + " - " + formatDateTime(state.departure, state.departureTime) + " (" + n + (n === 1 ? " night" : " nights") + ")" : "—"),
      "Guests: " + state.guests,
      "Stay: " + (state.room || "—"),
      "Estimated total: $" + total.toLocaleString() + " +TGST",
      "Name: " + (state.name || "—"),
      "Email: " + (state.email || "—")
    ];
    if (state.phone) lines.push("Phone: " + state.phone);
    return lines.join("\n");
  }

  /* ---------- build the booking summary as a clean, simple A4 PDF (jsPDF):
     small black emblem + title lockup, soft-bordered table with a light
     zebra stripe, and a highlighted total row. No colors beyond ink/grey. ---------- */
  function buildInquiryPDF() {
    var n = nights();
    var total = state.price && n ? state.price * n : 0;
    var jsPDFCtor = window.jspdf.jsPDF;
    var doc = new jsPDFCtor({ unit: "pt", format: "a4", compress: true });
    var pageW = doc.internal.pageSize.getWidth();

    var INK = [23, 35, 42];
    var MUTED = [108, 113, 109];
    var BORDER = [210, 210, 210];
    var ROW_ALT = [247, 247, 246];
    var TOTAL_BG = [235, 235, 233];

    var margin = 56;
    var contentW = pageW - margin * 2;
    var y = margin;

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
    doc.text("Local island \u00B7 South Ari Atoll, Maldives", margin + contentW, y + 14, { align: "right" });
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
      ["Check-in", state.arrival ? formatDateTime(state.arrival, state.arrivalTime) : "\u2014"],
      ["Check-out", state.departure ? formatDateTime(state.departure, state.departureTime) : "\u2014"],
      ["Nights", state.arrival && state.departure && n > 0 ? String(n) : "\u2014"],
      ["Guests", state.guests + (state.guests === 1 ? " guest" : " guests")],
      ["Stay", state.room || "\u2014"],
      ["Traveller", state.name || "\u2014"],
      ["Email", state.email || "\u2014"]
    ];
    if (state.phone) rows.push(["Contact", state.phone]);
    rows.push(["Estimated total", "$" + total.toLocaleString() + " +TGST"]);

    var labelColW = contentW * 0.34;
    var valueColW = contentW - labelColW;
    var cellPad = 10;
    var valueMaxW = valueColW - cellPad * 2;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    var measuredRows = rows.map(function (row) {
      var lines = doc.splitTextToSize(String(row[1]), valueMaxW);
      return { label: row[0], lines: lines, h: Math.max(27, lines.length * 13 + cellPad * 2) };
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
    arrivalTimeInput.value = state.arrivalTime || "14:00";
    departureTimeInput.value = state.departureTime || "12:00";
    arrivalPicker.syncTime();
    departurePicker.syncTime();
    [
      ["bk-arrival-trigger", state.arrival],
      ["bk-departure-trigger", state.departure]
    ].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (!el) return;
      var valueEl = el.querySelector(".bk-date-value");
      if (pair[1]) {
        valueEl.textContent = displayDate(pair[1]);
        valueEl.classList.add("has-value");
        var selectWrap = el.closest(".bk-date-select");
        if (selectWrap) selectWrap.classList.add("has-date");
      }
    });

    /* guests */
    stepperCount.textContent = state.guests;

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
      nextBtn.textContent = savedStep === TOTAL_STEPS ? "Send via WhatsApp" : "Next step";
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
})();
