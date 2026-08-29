/* Editorial Island Luxury: quiet, responsive interactions for the standalone Live Server build. */
(function () {
  "use strict";

  /* ==========================================================================
     Smooth cross-page transitions (Home <-> Book Now, etc.), matching the
     smooth "Book Now" open on maafushi.com. The <head> inline script already
     added "is-preload" (page starts invisible); here we fade the page IN on
     load, and fade it OUT before navigating away on internal link clicks.
     ========================================================================== */
  var PAGE_TRANSITION_MS = 380;

  /* fade in: wait two animation frames so the browser has actually painted
     the "invisible" state first, otherwise the opacity change won't transition */
  window.requestAnimationFrame(function () {
    window.requestAnimationFrame(function () {
      document.documentElement.classList.remove("is-preload");
    });
  });

  document.addEventListener("click", function (event) {
    var link = event.target.closest("a[href]");
    if (!link) return;
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.target && link.target !== "_self") return; // leave new-tab/_blank links alone

    var href = link.getAttribute("href");
    if (!href || href.charAt(0) === "#") return; // in-page anchors keep their own smooth-scroll

    var url;
    try { url = new URL(href, window.location.href); } catch (err) { return; }
    if (url.origin !== window.location.origin) return; // external links behave normally
    if (url.pathname === window.location.pathname && url.hash) return; // same-page hash link

    event.preventDefault();
    document.body.classList.add("is-leaving");
    window.setTimeout(function () { window.location.href = url.href; }, PAGE_TRANSITION_MS);
  });

  /* if the page is restored from the back/forward cache mid-transition
     (e.g. user hit Back while the fade-out was playing), reset it */
  window.addEventListener("pageshow", function () {
    document.body.classList.remove("is-leaving");
  });

  var header = document.getElementById("site-header");
  var menu = document.getElementById("mobile-menu");
  var menuTrigger = document.getElementById("menu-trigger");

  function scrollToTarget(selector) {
    var target = document.querySelector(selector);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setMenu(open) {
    menu.classList.toggle("is-open", open);
    menu.setAttribute("aria-hidden", String(!open));
    menuTrigger.setAttribute("aria-expanded", String(open));
    menuTrigger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }

  var scrollTicking = false;
  var lastScrollY = window.scrollY;
  var HIDE_AFTER = 120; /* px scrolled before the navbar is allowed to hide */

  function applyScrollState() {
    var currentY = window.scrollY;
    header.classList.toggle("is-scrolled", currentY > 56);

    /* hide navbar when scrolling down past HIDE_AFTER, reveal it again on any
       scroll up (or near the top of the page) — mobile menu stays open-proof */
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
    if (!scrollTicking) {
      window.requestAnimationFrame(applyScrollState);
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

  document.querySelectorAll(".js-scroll").forEach(function (button) {
    button.addEventListener("click", function () { scrollToTarget(button.getAttribute("data-target")); });
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") setMenu(false);
  });

  /* ==========================================================================
     Hero intro sequence: the page opens on a tight, "zoomed-in" crop of the
     hero photo (header hidden, text not yet shown) — like a paused video —
     then eases out to the full shot, the header fades/slides in, and the
     eyebrow/title/copy rise up one after another. Once that one-time reveal
     finishes, control hands off to the existing continuous ambient
     drift/flip animation on .hero-backdrop so it keeps gently breathing.
     ========================================================================== */
  var heroSection = document.getElementById("home");
  var heroBackdropWrap = document.getElementById("hero-backdrop-wrap");
  if (heroSection && heroBackdropWrap) {
    /* Split each .hero-rise element's text into one <span class="word-rise">
       per word (keeping any non-text nodes, like the mobile <br>, untouched)
       so the intro can animate the headline in word-by-word rather than as
       one solid block. */
    function splitIntoWords(el) {
      var words = [];
      Array.prototype.slice.call(el.childNodes).forEach(function (node) {
        if (node.nodeType === Node.TEXT_NODE) {
          var parts = node.textContent.split(/(\s+)/); /* keep whitespace as its own piece */
          var frag = document.createDocumentFragment();
          parts.forEach(function (part) {
            if (part === "") return;
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(part));
            } else {
              var span = document.createElement("span");
              span.className = "word-rise";
              span.textContent = part;
              frag.appendChild(span);
              words.push(span);
            }
          });
          el.replaceChild(frag, node);
        }
        /* element nodes (e.g. the <br>) are left exactly where they are */
      });
      return words;
    }

    var heroWords = [];
    heroSection.querySelectorAll(".hero-rise").forEach(function (el) {
      heroWords = heroWords.concat(splitIntoWords(el));
    });

    header.classList.add("is-intro-hidden");
    var HERO_ZOOM_MS = 3000;
    var HERO_START_DELAY = 250; /* small pause before the zoom-out begins, so it reads as intentional */
    var WORD_STEP_MS = 90; /* stagger between each word rising up */

    heroWords.forEach(function (word, index) {
      word.style.transitionDelay = (index * WORD_STEP_MS) + "ms";
    });

    window.setTimeout(function () {
      heroSection.classList.add("is-intro-revealed");
      header.classList.remove("is-intro-hidden");
      heroWords.forEach(function (word) { word.classList.add("is-shown"); });
    }, HERO_START_DELAY);

    window.setTimeout(function () {
      heroSection.classList.add("is-intro-done"); /* hand off to the ambient drift/flip animation */
    }, HERO_START_DELAY + HERO_ZOOM_MS);
  }

  var slideshow = document.getElementById("offer-slideshow");
  if (slideshow) {
    var slides = slideshow.querySelectorAll(".slide");
    var dots = slideshow.querySelectorAll(".dot");
    var current = 0;
    var slideTimer = null;

    function goToSlide(index) {
      slides[current].classList.remove("is-active");
      dots[current].classList.remove("is-active");
      current = index;
      slides[current].classList.add("is-active");
      var activeDot = dots[current];
      activeDot.classList.add("is-active");
      /* force reflow so the progress-bar animation restarts cleanly each
         time this dot becomes active again (e.g. looping back to slide 1) */
      var progress = activeDot.querySelector(".dot-progress");
      if (progress) {
        progress.style.animation = "none";
        void progress.offsetWidth;
        progress.style.animation = "";
      }
    }

    function nextSlide() {
      goToSlide((current + 1) % slides.length);
    }

    function startAutoplay() {
      slideTimer = window.setInterval(nextSlide, 6000);
    }

    function stopAutoplay() {
      if (slideTimer) window.clearInterval(slideTimer);
    }

    dots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        stopAutoplay();
        goToSlide(Number(dot.getAttribute("data-index")));
        startAutoplay();
      });
    });

    startAutoplay();
  }

  var islandVideo = document.getElementById("island-video");
  if (islandVideo) {
    islandVideo.addEventListener("click", function () {
      var videoId = islandVideo.getAttribute("data-youtube-id");
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube.com/embed/" + videoId + "?autoplay=1&rel=0";
      iframe.title = "Dhaankolhu Rasdhoo Island film";
      iframe.frameBorder = "0";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
      iframe.allowFullscreen = true;
      islandVideo.innerHTML = "";
      islandVideo.appendChild(iframe);
    });
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        entry.target.querySelectorAll(".word-rise").forEach(function (word) {
          word.classList.add("is-shown");
        });
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  /* ==========================================================================
     Per-word "rise up" reveal for section headings: as each heading scrolls
     into view, its words animate up one after another (same .word-rise
     timing used by the hero intro), instead of the heading fading in as one
     solid block. Body copy, eyebrows, and cards keep the simpler block-level
     .reveal fade/rise already set up above them.
     ========================================================================== */
  function splitHeadingIntoWords(el) {
    var words = [];
    Array.prototype.slice.call(el.childNodes).forEach(function (node) {
      if (node.nodeType === Node.TEXT_NODE) {
        var parts = node.textContent.split(/(\s+)/);
        var frag = document.createDocumentFragment();
        parts.forEach(function (part) {
          if (part === "") return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else {
            var span = document.createElement("span");
            span.className = "word-rise";
            span.textContent = part;
            frag.appendChild(span);
            words.push(span);
          }
        });
        el.replaceChild(frag, node);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        /* recurse into inline tags like <em> so those words rise too */
        words = words.concat(splitHeadingIntoWords(node));
      }
    });
    return words;
  }

  var HEADING_WORD_STEP_MS = 70;
  document.querySelectorAll(".display-heading.reveal").forEach(function (heading) {
    var words = splitHeadingIntoWords(heading);
    if (!words.length) return;
    words.forEach(function (word, index) {
      word.style.transitionDelay = (index * HEADING_WORD_STEP_MS) + "ms";
    });
    heading.classList.add("has-word-rise");
  });

  document.querySelectorAll(".reveal").forEach(function (node) { observer.observe(node); });

  /* ==========================================================================
     "Glimpse" collage: no 3D tilt — just a simple, continuous scroll-linked
     parallax. As the user scrolls down through the section, the circle
     photo drifts slowly DOWN and the location badge drifts slowly UP,
     each at its own gentle speed (Maafushi-style). Honours reduced motion.
     ========================================================================== */
  var collageStage = document.getElementById("welcome-collage");
  var collageMain = collageStage ? collageStage.querySelector(".collage-main") : null;
  var collageAccent = collageStage ? collageStage.querySelector(".collage-accent") : null;
  var collageBadge = collageStage ? collageStage.querySelector(".collage-badge") : null;
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (collageStage && collageMain && collageAccent && collageBadge && !prefersReducedMotion) {
    var collageScrollTicking = false;

    function updateCollageParallax() {
      var rect = collageStage.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;

      /* progress: 0 while the stage's top is still at the bottom of the
         viewport, 1 once it has scrolled up to roughly the upper-middle —
         drives the fade-in entrance. */
      var start = vh;
      var end = vh * 0.35;
      var progress = (start - rect.top) / (start - end);
      progress = Math.max(0, Math.min(1, progress));

      /* continuous drift: how far the stage has travelled past the middle
         of the viewport — capped so the two layers glide apart gently but
         always stay anchored/overlapping the photo's corner, instead of
         drifting away from it the longer the page keeps scrolling. Circle
         drifts down toward the bottom of the frame; badge drifts up
         toward the top — noticeably, so the motion reads clearly. Scaled
         down on small screens so the drift never outgrows the (smaller)
         mobile frame and pushes the layers off it. */
      var isMobileViewport = window.innerWidth <= 640;
      var driftMultiplier = isMobileViewport ? 0.16 : 0.28;
      var maxTravel = (isMobileViewport ? vh * 0.55 : vh * 0.85);
      var travelled = Math.max(0, Math.min(maxTravel, vh * 0.6 - rect.top));

      collageMain.style.opacity = String(progress);
      collageMain.style.transform = "none";

      collageAccent.style.opacity = String(progress);
      collageAccent.style.transform = "translateY(" + (travelled * driftMultiplier).toFixed(1) + "px)";

      collageBadge.style.opacity = String(progress);
      collageBadge.style.transform = "translateY(" + (-(travelled * driftMultiplier)).toFixed(1) + "px)";

      collageScrollTicking = false;
    }

    updateCollageParallax();
    window.addEventListener("scroll", function () {
      if (!collageScrollTicking) {
        window.requestAnimationFrame(updateCollageParallax);
        collageScrollTicking = true;
      }
    }, { passive: true });
    window.addEventListener("resize", updateCollageParallax, { passive: true });
  } else if (collageMain && collageAccent && collageBadge) {
    /* reduced motion: show the final composed state immediately, no animation */
    collageMain.style.opacity = collageAccent.style.opacity = collageBadge.style.opacity = "1";
  }
})();

/* ==========================================================================
   Island Experiences card loop: continuous auto-scroll (seamless, wraps at
   the halfway point since the cards are duplicated once in the markup),
   but the user can still swipe/drag it left or right at any time. Dragging
   pauses the autoplay immediately; autoplay quietly picks back up a couple
   seconds after the user lets go, moving the same direction as before.
   ========================================================================== */
(function () {
  var loop = document.querySelector(".excursion-loop");
  var track = document.querySelector(".excursion-track");
  if (!loop || !track) return;

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return; /* let it fall back to plain native overflow-x scroll */

  var pos = 0;              /* current translateX in px, always <= 0 */
  var halfWidth = 0;        /* width of one full (non-duplicated) set of cards */
  var isDragging = false;
  var dragStartX = 0;
  var dragStartPos = 0;
  var dragMoved = 0;
  var autoplayPaused = false;
  var resumeTimer = null;
  var activePointerId = null;
  var RESUME_DELAY = 2000;  /* ms of no interaction before autoplay resumes */

  function speed() {
    return window.innerWidth <= 640 ? 0.6 : 0.45; /* px per frame, ~60fps */
  }

  function measure() {
    halfWidth = track.scrollWidth / 2;
  }

  function applyTransform() {
    track.style.transform = "translateX(" + pos.toFixed(2) + "px)";
  }

  function wrap() {
    if (halfWidth <= 0) return;
    while (pos <= -halfWidth) pos += halfWidth;
    while (pos > 0) pos -= halfWidth;
  }

  function scheduleResume() {
    if (resumeTimer) clearTimeout(resumeTimer);
    resumeTimer = setTimeout(function () { autoplayPaused = false; }, RESUME_DELAY);
  }

  function tick() {
    if (!isDragging && !autoplayPaused) {
      pos -= speed();
      wrap();
      applyTransform();
    }
    window.requestAnimationFrame(tick);
  }

  function onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    isDragging = true;
    autoplayPaused = true;
    if (resumeTimer) clearTimeout(resumeTimer);
    dragStartX = event.clientX;
    dragStartPos = pos;
    dragMoved = 0;
    activePointerId = event.pointerId;
    track.classList.add("is-dragging");
    /* NOTE: pointer capture is intentionally NOT taken here. Capturing on
       every pointerdown (even a plain click) makes the browser redirect
       the resulting mouseup/click to the track itself instead of the card
       under the cursor, per the Pointer Events spec — which silently broke
       every card click. Capture is only taken once real dragging starts
       (see onPointerMove), so a simple tap/click still reaches the card. */
  }

  function onPointerMove(event) {
    if (!isDragging || event.pointerId !== activePointerId) return;
    var dx = event.clientX - dragStartX;
    dragMoved = Math.abs(dx);
    if (dragMoved > 6 && !track.hasPointerCapture(event.pointerId)) {
      try { track.setPointerCapture(event.pointerId); } catch (e) {}
    }
    pos = dragStartPos + dx;
    wrap();
    applyTransform();
  }

  function onPointerUp(event) {
    if (!isDragging || event.pointerId !== activePointerId) return;
    isDragging = false;
    activePointerId = null;
    track.classList.remove("is-dragging");
    scheduleResume();
  }

  measure();
  applyTransform();
  window.addEventListener("resize", function () {
    var ratio = halfWidth > 0 ? pos / halfWidth : 0;
    measure();
    pos = ratio * halfWidth;
    wrap();
    applyTransform();
  }, { passive: true });

  track.addEventListener("pointerdown", onPointerDown);
  track.addEventListener("pointermove", onPointerMove);
  track.addEventListener("pointerup", onPointerUp);
  track.addEventListener("pointercancel", onPointerUp);

  /* if the user dragged more than a few px, swallow the resulting click so
     a swipe doesn't accidentally trigger a card's open-modal action */
  track.addEventListener("click", function (event) {
    if (dragMoved > 6) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);

  window.requestAnimationFrame(tick);
})();

/* NOTE: card-detail opening (excursion cards, highlight cards, gallery
   photos) is handled entirely by the "highlight-expand" overlay defined
   inline in index.html. A second, duplicate lightbox implementation used
   to live here and was removed — having two click handlers open two
   different overlays on the same [data-expand] cards was causing the
   click to look broken/unresponsive, especially noticeable on desktop. */
