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
     the behavior in script.js on the main site */
  var scrollTicking = false;
  var lastScrollY = window.scrollY;
  var HIDE_AFTER = 120;
  function applyHeaderScrollState() {
    var currentY = window.scrollY;
    var scrollingDown = currentY > lastScrollY;
    if (scrollingDown && currentY > HIDE_AFTER && !menu.classList.contains("is-open")) {
      header.classList.add("is-hidden");
    } else {
      header.classList.remove("is-hidden");
    }
    lastScrollY = currentY;
    scrollTicking = false;
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
  var backBtn = document.getElementById("bk-back");
  var actions = document.getElementById("bk-actions");

  /* keep the top of the booking panel in view on every step change,
     so people always land on the heading/CTA instead of wherever
     the previous step happened to be scrolled to */
  function scrollPanelIntoView() {
    if (!panel) return;
    var headerOffset = 96;
    var top = panel.getBoundingClientRect().top + window.pageYOffset - headerOffset;
    window.scrollTo({ top: top, behavior: "smooth" });
  }
  var railSteps = document.querySelectorAll(".bk-rail-step");
  var reviewList = document.getElementById("bk-review-list");
  var reviewDownloadLink = document.getElementById("bk-review-download-link");

  var arrivalInput = document.getElementById("bk-arrival");
  var departureInput = document.getElementById("bk-departure");
  var stepper = document.querySelector(".bk-stepper");
  var stepperCount = stepper.querySelector("span");
  var roomGrid = document.getElementById("bk-room-grid");
  var nameInput = document.getElementById("bk-name");
  var emailInput = document.getElementById("bk-email");
  var phoneInput = document.getElementById("bk-phone");

  var ticketTotalEl = document.getElementById("bk-ticket-total");
  var ticketCodeEl = document.getElementById("bk-ticket-code");

  var state = { arrival: "", departure: "", guests: 2, room: null, price: 0, name: "", email: "", phone: "", country: "" };
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
  arrivalInput.min = todayStr;
  departureInput.min = todayStr;

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
    departureInput.min = arrivalInput.value || todayStr;
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
        setTicketRow("checkin", formatDate(state.arrival), true);
      } else {
        setTicketRow("checkin", "Select above", false);
      }
      if (state.departure) {
        setTicketRow("checkout", formatDate(state.departure), true);
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

  function updateRail(step) {
    railSteps.forEach(function (btn) {
      var n = Number(btn.getAttribute("data-step"));
      btn.classList.toggle("is-active", n === step);
      btn.classList.toggle("is-done", n < step);
      btn.disabled = n === 5 ? false : n > maxStepReached;
    });
    /* the Review step (04) has its own full summary list, so the sticky
       reservation-note sidebar would just repeat it — hide it there and
       on the final Send screen (05), which also repeats the same details. */
    if (bkGrid) bkGrid.classList.toggle("bk-review-active", step === TOTAL_STEPS || step === 5);
  }

  document.getElementById("bk-rail").addEventListener("click", function (event) {
    var btn = event.target.closest(".bk-rail-step");
    if (!btn || btn.disabled) return;
    var target = Number(btn.getAttribute("data-step"));
    if (target === 5 || target === currentStep) return;
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
      ["Dates", state.arrival && state.departure ? formatDate(state.arrival) + " – " + formatDate(state.departure) + " (" + n + (n === 1 ? " night" : " nights") + ")" : "—"],
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

  /* ---------- step navigation with rise-up transition ---------- */
  function goToStep(target) {
    var current = form.querySelector('.bk-step.is-current');
    var next = form.querySelector('.bk-step[data-step="' + target + '"]');
    if (!current || !next) return;

    current.classList.add("bk-anim-out");
    window.setTimeout(function () {
      current.classList.remove("is-current", "bk-anim-out");
      next.classList.add("is-current", "bk-anim-in-start");
      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () { next.classList.remove("bk-anim-in-start"); });
      });
      currentStep = target;
      if (target > maxStepReached) maxStepReached = target;
      updateRail(target);
      backBtn.style.visibility = target === 1 ? "hidden" : "visible";
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
    }, 380);
  }

  var WHATSAPP_NUMBER_DISPLAY = "+960 929 1605";
  var WHATSAPP_NUMBER_RAW = "9609291605";
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
      "Dates: " + (state.arrival && state.departure ? formatDate(state.arrival) + " - " + formatDate(state.departure) + " (" + n + (n === 1 ? " night" : " nights") + ")" : "—"),
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
       SAMPLE VALUES — swap "+960 700 2020" and "stay@dhaankolhu.island" for
       the resort's real contact number and email once you have them. */
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor.apply(doc, MUTED);
    doc.text("Local island \u00B7 South Ari Atoll, Maldives", margin + contentW, y + 14, { align: "right" });
    doc.text("+960 700 2020", margin + contentW, y + 28, { align: "right" });
    doc.text("stay@dhaankolhu.island", margin + contentW, y + 42, { align: "right" });

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
      ["Check-in", state.arrival ? formatDate(state.arrival) : "\u2014"],
      ["Check-out", state.departure ? formatDate(state.departure) : "\u2014"],
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
    if (currentStep < TOTAL_STEPS) {
      goToStep(currentStep + 1);
    } else {
      showSuccess();
    }
  }

  nextBtn.addEventListener("click", goNext);
  backBtn.addEventListener("click", function () {
    if (currentStep > 1) goToStep(currentStep - 1);
  });

  var successBackBtn = document.getElementById("bk-success-back");
  if (successBackBtn) {
    successBackBtn.addEventListener("click", function () {
      successView.classList.remove("is-current", "bk-anim-in-start", "bk-anim-out");
      form.style.display = "";
      actions.style.display = "";
      goToStep(4);
    });
  }

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
    departureInput.min = state.arrival || todayStr;
    departureInput.value = state.departure || "";

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
      backBtn.style.visibility = savedStep === 1 ? "hidden" : "visible";
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
})();
