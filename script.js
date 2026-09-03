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

  /* ==========================================================================
     Smooth-but-quick fade-in for lazy-loaded images (gallery, highlights,
     experience cards, room thumbnails, etc.) — otherwise they just abruptly
     "pop" into place mid-scroll once the browser decides to load them. Kept
     short (300ms) on purpose so it still reads as fast, not a loading delay.
     Images already cached (img.complete on first check) skip the fade
     entirely and just show immediately, no need to animate what's instant. */
  (function () {
    function initLazyFade() {
      var lazyImgs = Array.prototype.slice.call(document.querySelectorAll('img[loading="lazy"], img.fade-load'));
      lazyImgs.forEach(function (img) {
        if (img.complete && img.naturalWidth > 0) {
          img.classList.add("is-loaded");
          return;
        }
        img.addEventListener("load", function () { img.classList.add("is-loaded"); }, { once: true });
        img.addEventListener("error", function () { img.classList.add("is-loaded"); }, { once: true });
      });
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initLazyFade);
    } else {
      initLazyFade();
    }
  })();

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

  /* while the pinned hero story (below) is still playing, it takes full
     control of the navbar's visibility (see .is-story-hidden) — this flag
     tells the regular scroll-direction hide/reveal logic to stand down so
     the two don't fight over the same element */
  var heroStoryPinnedActive = false;

  function applyScrollState() {
    /* the "ticking" flag is what lets each animation frame do its scroll
       work at most once — if anything inside threw before reaching the end,
       the flag used to stay stuck "true" forever and silently kill this
       animation for the rest of the session. try/finally guarantees it
       always gets released so the animation keeps running continuously. */
    try {
      var currentY = window.scrollY;
      header.classList.toggle("is-scrolled", currentY > 56);

      if (heroStoryPinnedActive) {
        lastScrollY = currentY;
        return;
      }

      /* hide navbar when scrolling down past HIDE_AFTER, reveal it again on any
         scroll up (or near the top of the page) — mobile menu stays open-proof */
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

    /* ==========================================================================
       HERO STEPPER — a fixed, full-viewport hero that steps through three
       chapters (Welcome → About → Island photo) one at a time. Each wheel
       tick or swipe advances/reverses exactly one chapter, animated with a
       fixed-duration CSS transition (see .story-panel rules) — so it reads
       as a deliberate "next" reveal rather than a scroll-scrubbed fade.
       Once the last chapter is reached, control is released and the page
       scrolls normally into the rest of the site; scrolling back up to the
       very top re-engages the stepper.
       ========================================================================== */
    var storyScrollEl = heroSection.classList.contains("story-scroll") ? heroSection : null;
    var storyShade = heroSection.querySelector(".hero-shade");
    var storyPanels = Array.prototype.slice.call(heroSection.querySelectorAll(".story-panel"));
    var storyCollageMain = heroSection.querySelector(".story-panel-frame .collage-main");
    var storyCollageAccent = heroSection.querySelector(".story-panel-frame .collage-accent");
    var storyCollageBadge = heroSection.querySelector(".story-panel-frame .collage-badge");
    var prefersReducedMotionHero = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- fanned Highlights card stack, right side of the settled
       final chapter — auto-cycles like a slideshow, and whichever card
       lands in front each tick also becomes the new full-bleed backdrop
       photo (see the matching CSS for the fan's rotation/offset per
       data-pos, and .frame-card-stack visibility). ---------- */
    var frameCardStackEl = heroSection.querySelector(".frame-card-stack");
    var frameCards = frameCardStackEl ? Array.prototype.slice.call(frameCardStackEl.querySelectorAll(".frame-card")) : [];
    var frameCardOrder = frameCards.map(function (_, i) { return i; }); /* order[0] = whichever card index is currently front */
    var frameCardTimer = null;
    var FRAME_CARD_MS = 3200;

    function renderFrameCardPositions() {
      frameCardOrder.forEach(function (cardIndex, pos) {
        frameCards[cardIndex].setAttribute("data-pos", String(pos));
      });
    }

    function advanceFrameCards() {
      frameCardOrder.push(frameCardOrder.shift()); /* front card cycles to the back of the fan */
      renderFrameCardPositions();
      var frontImg = frameCards[frameCardOrder[0]].querySelector("img");
      var backdropImg = storyCollageMain ? storyCollageMain.querySelector("img") : null;
      if (!backdropImg || !frontImg || backdropImg.src === frontImg.src) return;
      backdropImg.style.transition = "opacity .5s ease";
      backdropImg.style.opacity = "0";
      window.setTimeout(function () {
        backdropImg.src = frontImg.src;
        backdropImg.style.opacity = "1";
      }, 500);
    }

    function startFrameCardStack() {
      /* auto-cycling removed on request — the fan now stays put as a clean,
         static stack instead of looping through photos like a slideshow. */
      return;
    }
    function stopFrameCardStack() {
      if (frameCardTimer) { window.clearInterval(frameCardTimer); frameCardTimer = null; }
    }
    renderFrameCardPositions();

    if (storyScrollEl && storyPanels.length) {
      /* Reduced motion still gets the same full-screen pinned stepper as
         everyone else (see the matching CSS media query) — chapters just
         swap instantly (0ms) instead of animating, so we don't wait around
         for a crossfade duration that no longer plays. */
      var STEP_MS = prefersReducedMotionHero ? 0 : 700; /* must stay in sync with the .story-panel transition duration in the <style> block */
      var currentStep = 0;
      var lastStep = storyPanels.length - 1;
      var transitioning = false;
      var locked = true; /* true while the stepper owns wheel/touch input */

      /* Belt-and-suspenders lock: besides calling preventDefault() on each
         wheel/touch event, flip a CSS touch-action:none (+ html overflow
         hidden) switch so the browser itself never starts a native scroll
         while we're locked. preventDefault() alone can lose a timing race
         on mobile — this class toggle can't, since it's evaluated before
         any JS runs. This is what keeps the animation reliable instead of
         "sometimes working" on phones. */
      function setLockClasses(isLocked) {
        storyScrollEl.classList.toggle("is-story-locked", isLocked);
        document.documentElement.classList.toggle("story-scroll-lock", isLocked);
      }
      setLockClasses(locked);

      /* Self-healing safety net: touch-action:none stops almost all leaks,
         but some browsers/gestures (e.g. a fast flick, a mouse's scrollbar
         drag, certain Android WebViews) can still sneak the page a few
         pixels away from the top while we're supposed to be locked — which
         is exactly what shows up as the heading looking "cut off" at the
         top. Rather than chase every possible leak source, just snap the
         page back to 0 the instant it happens, every time, no exceptions. */
      window.addEventListener("scroll", function () {
        if (locked && window.scrollY !== 0) {
          window.scrollTo(0, 0);
        }
      }, { passive: true });

      function setHeaderForStep(step) {
        heroStoryPinnedActive = locked;
        if (header) header.classList.toggle("is-story-hidden", locked && step > 0);
      }

      function setBackdropForStep(step) {
        if (heroBackdropWrap && storyScrollEl.classList.contains("is-intro-done")) {
          /* clear any inline transition left over from the "walking into the
             hallway" exit beat below, so ordinary per-chapter steps always
             animate on the normal, quicker 1.1s CSS transition */
          heroBackdropWrap.style.transition = "";
          heroBackdropWrap.style.transform = "scale(" + (1 + step * 0.13).toFixed(3) + ")";
        }
        if (storyShade) {
          storyShade.style.transition = "";
          storyShade.style.opacity = String(Math.max(0.4, 1 - step * 0.3));
        }
      }

      function goToStep(nextStep) {
        if (nextStep === currentStep || nextStep < 0 || nextStep > lastStep) return;
        var forward = nextStep > currentStep;
        var prevPanel = storyPanels[currentStep];
        var nextPanel = storyPanels[nextStep];
        if (forward) {
          prevPanel.classList.remove("is-active");
          prevPanel.classList.add("is-exited");
        } else {
          prevPanel.classList.remove("is-active", "is-exited");
        }
        nextPanel.classList.remove("is-exited");
        nextPanel.classList.add("is-active");
        currentStep = nextStep;
        setHeaderForStep(currentStep);
        setBackdropForStep(currentStep);
        transitioning = true;
        window.setTimeout(function () { transitioning = false; }, STEP_MS);
      }

      /* first paint: chapter 0 active, header visible, nothing zoomed yet */
      storyPanels[0].classList.add("is-active");
      setHeaderForStep(0);
      setBackdropForStep(0);

      function releaseLock() {
        locked = false;
        heroStoryPinnedActive = false;
        setLockClasses(false);
        if (header) header.classList.remove("is-story-hidden");
      }

      /* Bonus beat once you keep scrolling past the last chapter (the photo
         frame): instead of handing off to normal scrolling immediately, play
         one more "exit" animation first — circle + badge slide up and fade
         out, the frame photo grows to fill the whole screen (see the
         .is-frame-exiting CSS rules) — then release the lock once it's
         finished. Only plays once per visit to this chapter; scrolling back
         up and re-triggering the stepper (resetToEnd) resets it so it can
         play again next time through. */
      var frameExited = false;
      var EXIT_ANIM_MS = prefersReducedMotionHero ? 0 : 2500; /* the hallway push-in itself: 2.5s, slow and deliberate (instant for reduced motion) */
      /* Where the hallway doorway actually sits within home web.jpeg (roughly
         center, a touch right and above vertical middle) — zooming from this
         point instead of the default dead-center origin makes the push read
         as walking toward that specific doorway rather than a generic
         zoom-into-the-middle-of-the-screen. Only applied for this exit beat;
         every other chapter keeps the normal centered zoom. */
      var HALLWAY_FOCAL_POINT = "54% 33%";
      var experienceSection = document.getElementById("experience");

      function playFrameExitThenRelease() {
        if (frameExited) { releaseLock(); return; }
        frameExited = true;
        transitioning = true;
        storyPanels[lastStep].classList.add("is-frame-exiting");

        /* Bring the navbar back in step with this final chapter's
           badge/heading/copy/CTA reveal (rather than waiting for the whole
           2.5s hallway push-in to finish) — a slow 2s "drawer" slide/fade,
           synced to feel like part of the same reveal beat. */
        if (header) {
          header.classList.add("is-frame-reveal");
          header.classList.remove("is-story-hidden");
          window.setTimeout(function () {
            header.classList.remove("is-frame-reveal");
          }, 2000);
        }

        /* Same beat, but on the persistent hallway backdrop photo itself:
           push the camera dramatically forward — as if walking through the
           doorway — while the dark shade lifts so the warm light at the end
           of the hallway brightens through. Slow, 2.5s push-in (set inline
           so it isn't tied to the quicker per-chapter step zoom above). */
        if (heroBackdropWrap) {
          heroBackdropWrap.style.transformOrigin = HALLWAY_FOCAL_POINT;
          heroBackdropWrap.style.transition = "transform " + EXIT_ANIM_MS + "ms cubic-bezier(.22, .68, 0, 1)";
          heroBackdropWrap.style.transform = "scale(3.6)";
        }
        if (storyShade) {
          storyShade.style.transition = "opacity " + EXIT_ANIM_MS + "ms ease";
          storyShade.style.opacity = "0.05";
        }

        /* Let the full 2.5s push-in play out completely — THEN, once it's
           done, snap straight to the Experience section in one sudden cut
           (no smooth glide) so it reads as "walked into the hallway... and
           suddenly you're at the activities" rather than a slow scroll. */
        window.setTimeout(function () {
          transitioning = false;
          releaseLock();
          startFrameCardStack();
        }, EXIT_ANIM_MS);
      }

      /* Re-engaging from a scroll-up should resume right where the user left
         off (the last chapter), with every earlier chapter marked "exited"
         underneath it — mirroring the state goToStep() would have left them
         in. That way the very next scroll-up tick steps backward one chapter
         at a time (bringing back what "disappeared") instead of snapping
         straight past all of them to the first "Welcome" chapter. */
      function resetToEnd() {
        storyPanels.forEach(function (panel, i) {
          panel.classList.remove("is-active", "is-exited", "is-frame-exiting");
          panel.classList.add(i === lastStep ? "is-active" : "is-exited");
        });
        currentStep = lastStep;
        frameExited = false;
        stopFrameCardStack();
        /* the card stack may have swapped this to a Highlights photo while
           cycling — put the original shoreline shot back now that the
           small collage box (not the full-bleed backdrop) is what's about
           to reappear */
        if (storyCollageMain) {
          var backdropImgReset = storyCollageMain.querySelector("img");
          if (backdropImgReset) { backdropImgReset.style.opacity = ""; backdropImgReset.src = "img/home/1.jpg"; }
        }
        frameCardOrder = frameCards.map(function (_, i) { return i; });
        renderFrameCardPositions();
        if (heroBackdropWrap) { heroBackdropWrap.style.transition = ""; heroBackdropWrap.style.transformOrigin = ""; }
        if (storyShade) storyShade.style.transition = "";
        setBackdropForStep(lastStep);
      }

      var justReengaged = false; /* true for the single event that re-locks, so it isn't ALSO treated as a step command (which would immediately step backward again since we just resumed on the last chapter) */

      function tryReengageLock(deltaY) {
        if (!locked && window.scrollY <= 4 && deltaY < 0) {
          locked = true;
          heroStoryPinnedActive = true;
          setLockClasses(true);
          resetToEnd(); /* resume on the last chapter so scrolling up reveals the chapters in reverse, instead of jumping straight back to "Welcome" */
          setHeaderForStep(currentStep);
          justReengaged = true;
        }
        return locked;
      }

      window.addEventListener("wheel", function (event) {
        if (!tryReengageLock(event.deltaY)) return; /* not our concern — let the page scroll normally */
        if (justReengaged) { justReengaged = false; event.preventDefault(); return; } /* absorb the event that triggered the reset — don't also step on it */
        if (transitioning) { event.preventDefault(); return; }
        if (event.deltaY > 0) {
          if (currentStep < lastStep) {
            event.preventDefault();
            goToStep(currentStep + 1);
          } else {
            event.preventDefault(); /* hold the lock through the exit-grow animation instead of scrolling away immediately */
            playFrameExitThenRelease();
          }
        } else if (event.deltaY < 0) {
          if (currentStep > 0) {
            event.preventDefault();
            goToStep(currentStep - 1);
          } else {
            event.preventDefault(); /* already at the first chapter — nothing above it, so just stay put instead of releasing the lock */
          }
        }
      }, { passive: false });

      var touchStartY = 0;
      var touchActive = false;
      window.addEventListener("touchstart", function (event) {
        if (!event.touches || event.touches.length !== 1) { touchActive = false; return; } /* ignore pinch/multi-touch */
        touchStartY = event.touches[0].clientY;
        touchActive = locked || (window.scrollY <= 4);
      }, { passive: true });

      window.addEventListener("touchmove", function (event) {
        if (!touchActive || !event.touches || event.touches.length !== 1) return;
        var deltaY = touchStartY - event.touches[0].clientY; /* positive = swiping up = scrolling down */
        if (Math.abs(deltaY) < 36) { if (locked) event.preventDefault(); return; } /* small movements are just taps/jitter — still hold the lock so nothing leaks through */
        if (!tryReengageLock(deltaY)) { touchActive = false; return; }
        if (justReengaged) { justReengaged = false; event.preventDefault(); touchStartY = event.touches[0].clientY; return; } /* absorb the event that triggered the reset — don't also step on it */
        if (transitioning) { event.preventDefault(); return; }
        if (deltaY > 0) {
          if (currentStep < lastStep) {
            event.preventDefault();
            goToStep(currentStep + 1);
            touchStartY = event.touches[0].clientY;
          } else {
            event.preventDefault(); /* hold the lock through the exit-grow animation instead of scrolling away immediately */
            playFrameExitThenRelease();
            touchActive = false;
          }
        } else {
          if (currentStep > 0) {
            event.preventDefault();
            goToStep(currentStep - 1);
            touchStartY = event.touches[0].clientY;
          } else {
            event.preventDefault(); /* already at the first chapter — nothing above it, so just stay put instead of releasing the lock */
            touchStartY = event.touches[0].clientY;
          }
        }
      }, { passive: false });

      /* touchend AND touchcancel — a gesture the OS interrupts (edge-swipe
         back, notification pull-down, a second finger landing) fires cancel
         instead of end. Without handling it here the lock/step state could
         be left stale until the next tap. */
      window.addEventListener("touchend", function () { touchActive = false; }, { passive: true });
      window.addEventListener("touchcancel", function () { touchActive = false; }, { passive: true });

      /* keyboard: ArrowDown/PageDown/Space advance, ArrowUp/PageUp reverse —
         only while the stepper is actually engaged, and only when focus
         isn't inside a form control or the mobile menu */
      window.addEventListener("keydown", function (event) {
        var tag = document.activeElement && document.activeElement.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || tag === "A") return;
        if (!tryReengageLock(event.key === "ArrowUp" || event.key === "PageUp" ? -1 : 1)) return;
        if (justReengaged) { justReengaged = false; event.preventDefault(); return; } /* absorb the key that triggered the reset — don't also step on it */
        if (transitioning) return;
        if (event.key === "ArrowDown" || event.key === "PageDown" || event.key === " ") {
          if (currentStep < lastStep) { event.preventDefault(); goToStep(currentStep + 1); }
          else { event.preventDefault(); playFrameExitThenRelease(); }
        } else if (event.key === "ArrowUp" || event.key === "PageUp") {
          if (currentStep > 0) { event.preventDefault(); goToStep(currentStep - 1); }
          else event.preventDefault(); /* already at the first chapter — nothing above it, so just stay put instead of releasing the lock */
        }
      });

      /* any other in-page anchor link (Experience, Highlights, Gallery,
         Contact, the logo's #home, etc.) needs the stepper lock released
         first — while locked, html/body has overflow:hidden, which was
         silently blocking the browser's native jump to those sections
         (only #about got a working handler, since it managed the lock
         itself). */
      document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        var hash = link.getAttribute("href");
        if (hash === "#about" || hash === "#" ) return; /* #about handled separately below; bare "#" isn't a section link */
        link.addEventListener("click", function () {
          if (locked) releaseLock();
        });
      });

      /* the "About" nav link should jump straight to that chapter — scroll
         back to the top first (in case the hero has already been scrolled
         past), then step the hero to the About chapter */
      document.querySelectorAll('a[href="#about"]').forEach(function (link) {
        link.addEventListener("click", function (event) {
          event.preventDefault();
          locked = true;
          heroStoryPinnedActive = true;
          setLockClasses(true);
          if (window.scrollY > 2) {
            window.scrollTo({ top: 0, behavior: "auto" });
          }
          window.setTimeout(function () { goToStep(1); }, 30);
        });
      });

      /* DEV/TESTING SHORTCUT — the hallway push-in beat is buried behind 3
         chapters of stepping, which makes it slow to re-test every time you
         tweak the zoom scale/focal point/timing. Skip straight to it: add
         ?zoomtest to the URL, or press "Z" anywhere on the page, and it
         jumps to the last chapter and immediately plays the push-in + jump
         to Experience — no need to scroll through Welcome/About first.
         Safe to leave in; it only fires on that explicit trigger. */
      function jumpToHallwayZoomTest() {
        window.scrollTo(0, 0);
        locked = true;
        heroStoryPinnedActive = true;
        setLockClasses(true);
        resetToEnd();
        setHeaderForStep(currentStep);
        window.setTimeout(function () { playFrameExitThenRelease(); }, 350);
      }
      if (window.location.search.indexOf("zoomtest") !== -1) {
        window.setTimeout(jumpToHallwayZoomTest, 500);
      }
      window.addEventListener("keydown", function (event) {
        if (event.key === "z" || event.key === "Z") jumpToHallwayZoomTest();
      });
    } else if (storyScrollEl && prefersReducedMotionHero) {
      /* reduced motion: CSS already lays every chapter out statically, one
         after another — just make sure nothing is left invisible. */
      storyPanels.forEach(function (panel) { panel.style.opacity = ""; panel.style.transform = ""; });
      if (storyCollageMain) storyCollageMain.style.opacity = "1";
      if (storyCollageAccent) storyCollageAccent.style.opacity = "1";
      if (storyCollageBadge) storyCollageBadge.style.opacity = "1";
    }
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

    /* pause the autoplay timer while the tab is backgrounded instead of
       silently racking up missed intervals that would otherwise all fire
       in a burst the moment the tab becomes visible again */
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) {
        stopAutoplay();
      } else {
        startAutoplay();
      }
    });
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
    /* This math (getBoundingClientRect + several style writes) used to run
       on every scroll event for the entire site, even when this section
       was nowhere near the viewport — wasted work on every scroll,
       everywhere on the page. Gate it behind an IntersectionObserver with
       generous margins so it only runs while the section is actually
       approaching or on screen. */
    var collageNearViewport = false;

    function updateCollageParallax() {
      try {
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
      var driftMultiplier = isMobileViewport ? 0.34 : 0.58;
      var maxTravel = (isMobileViewport ? vh * 0.85 : vh * 1.3);
      var travelled = Math.max(0, Math.min(maxTravel, vh * 0.6 - rect.top));

      collageMain.style.opacity = String(progress);

      /* landscape -> portrait morph: as the user keeps scrolling past the
         section, the wide photo gradually narrows into a portrait crop
         (object-fit: cover handles the reveal, no distortion), with a
         gentle zoom and softening corners so it reads as one smooth,
         continuous move rather than a jump cut. */
      var portraitT = maxTravel > 0 ? Math.max(0, Math.min(1, travelled / maxTravel)) : 0;
      var mainWidthPct = 100 - portraitT * 54; /* 100% (landscape) -> 46% (portrait) */
      var mainSidePct = (100 - mainWidthPct) / 2;
      collageMain.style.top = "0";
      collageMain.style.bottom = "0";
      collageMain.style.left = mainSidePct.toFixed(2) + "%";
      collageMain.style.right = mainSidePct.toFixed(2) + "%";
      collageMain.style.borderRadius = (22 + portraitT * 12).toFixed(1) + "px";
      collageMain.style.transform = "scale(" + (1 + portraitT * 0.07).toFixed(3) + ")";

      collageAccent.style.opacity = String(progress);
      collageAccent.style.transform = "translateY(" + (travelled * driftMultiplier).toFixed(1) + "px)";

      collageBadge.style.opacity = String(progress);
      collageBadge.style.transform = "translateY(" + (-(travelled * driftMultiplier)).toFixed(1) + "px)";
      } finally {
        /* same reasoning as applyScrollState above: never let this flag get
           stuck "true", or the drift silently stops for good mid-session. */
        collageScrollTicking = false;
      }
    }

    updateCollageParallax();

    if ("IntersectionObserver" in window) {
      var collageVisibilityObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          collageNearViewport = entry.isIntersecting;
          if (collageNearViewport) updateCollageParallax();
        });
      }, { rootMargin: "50% 0px 50% 0px" });
      collageVisibilityObserver.observe(collageStage);
    } else {
      collageNearViewport = true; /* very old browsers: fall back to always-on, as before */
    }

    window.addEventListener("scroll", function () {
      if (!collageNearViewport) return;
      if (!collageScrollTicking) {
        window.requestAnimationFrame(updateCollageParallax);
        collageScrollTicking = true;
      }
    }, { passive: true });
    window.addEventListener("resize", function () {
      if (collageNearViewport) updateCollageParallax();
    }, { passive: true });
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

  /* Was previously an unconditional requestAnimationFrame loop that ran
     forever, once per frame, for the entire life of the page — even while
     this carousel was scrolled far out of view or the browser tab was in
     the background. That's constant work competing with every other
     animation on the page (a big part of the site feeling laggy overall).
     Now it only keeps ticking while the carousel is actually on screen
     AND the tab is visible; it goes fully idle otherwise. */
  var isInViewport = false;
  var rafId = null;

  function tick() {
    if (!isDragging && !autoplayPaused) {
      pos -= speed();
      wrap();
      applyTransform();
    }
    rafId = isInViewport && !document.hidden ? window.requestAnimationFrame(tick) : null;
  }

  function startTickIfNeeded() {
    if (rafId === null && isInViewport && !document.hidden) {
      rafId = window.requestAnimationFrame(tick);
    }
  }

  if ("IntersectionObserver" in window) {
    var loopVisibilityObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        isInViewport = entry.isIntersecting;
        if (isInViewport) startTickIfNeeded();
      });
    }, { threshold: 0 });
    loopVisibilityObserver.observe(loop);
  } else {
    isInViewport = true; /* very old browsers: fall back to always-on, as before */
  }

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) startTickIfNeeded();
  });

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

  /* measure() is called immediately above, but the excursion-card images
     (several are remote Unsplash photos) are often still loading at that
     point, so track.scrollWidth is briefly too small. That produces a
     wrong halfWidth, which makes the seamless wrap point land in the wrong
     place — the two duplicated card sets end up slightly misaligned and
     visibly overlap/ghost into each other for a moment. Once every image
     has actually finished loading, remeasure and re-snap the position
     (keeping the same relative point in the loop) so the wrap is clean. */
  var loopImages = Array.prototype.slice.call(track.querySelectorAll("img"));
  var pendingImages = loopImages.filter(function (img) { return !img.complete; });
  function resyncAfterImagesLoad() {
    var ratio = halfWidth > 0 ? pos / halfWidth : 0;
    measure();
    pos = ratio * halfWidth;
    wrap();
    applyTransform();
  }
  if (pendingImages.length) {
    var remaining = pendingImages.length;
    pendingImages.forEach(function (img) {
      img.addEventListener("load", function () {
        remaining -= 1;
        if (remaining <= 0) resyncAfterImagesLoad();
      }, { once: true });
      img.addEventListener("error", function () {
        remaining -= 1;
        if (remaining <= 0) resyncAfterImagesLoad();
      }, { once: true });
    });
  }
  /* belt-and-suspenders: also resync once the whole page (all resources)
     has finished loading, in case any image listener above was missed */
  window.addEventListener("load", resyncAfterImagesLoad, { once: true });

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

  startTickIfNeeded();
})();

/* NOTE: card-detail opening (excursion cards, highlight cards, gallery
   photos) is handled entirely by the "highlight-expand" overlay defined
   inline in index.html. A second, duplicate lightbox implementation used
   to live here and was removed — having two click handlers open two
   different overlays on the same [data-expand] cards was causing the
   click to look broken/unresponsive, especially noticeable on desktop. */
