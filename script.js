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
    /* explicit class toggle (backup for the CSS :has() selector, which
       some browsers/webviews don't support) so the logo reliably flips
       to black against the mobile menu's light background */
    if (header) header.classList.toggle("is-menu-open", open);
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

  /* ==========================================================================
     Hero background video reliability: fade it in only once it actually has
     a frame ready (no more flash of a mismatched poster photo on refresh),
     and nudge it back to playing if the browser ever pauses/stalls it on
     its own (tab backgrounded, aggressive mobile power-saving, a network
     blip mid-loop) — since there are no visible controls, a stopped video
     would otherwise just sit frozen with no way for the visitor to restart it.
     ========================================================================== */
  (function () {
    var heroVideo = document.getElementById("hero-backdrop-video");
    if (!heroVideo) return;

    function markReady() { heroVideo.classList.add("is-ready"); }
    if (heroVideo.readyState >= 2) {
      markReady();
    } else {
      heroVideo.addEventListener("loadeddata", markReady, { once: true });
    }

    function resume() {
      if (heroVideo.paused && !document.hidden) {
        heroVideo.play().catch(function () {});
      }
    }
    heroVideo.addEventListener("pause", resume);
    heroVideo.addEventListener("stalled", resume);
    heroVideo.addEventListener("suspend", resume);
    document.addEventListener("visibilitychange", resume);
  })();

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

    /* the button rises up as its own single beat (see the .hero-explore-btn
       CSS comment for why it's not split into words like the rest) — timed
       to land just after the last word finishes rising. The 2s reveal
       transition is set inline, temporarily, and removed again once it's
       done — otherwise it would permanently override .button's own fast
       hover/active transition and make pressing the button feel broken. */
    var heroExploreBtn = heroSection.querySelector(".hero-explore-btn");
    var heroBtnReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var HERO_BTN_DELAY_MS = heroWords.length * WORD_STEP_MS + 120;
    var HERO_BTN_REVEAL_MS = heroBtnReducedMotion ? 0 : 2000;
    if (heroExploreBtn && !heroBtnReducedMotion) {
      heroExploreBtn.style.transitionProperty = "opacity, transform";
      heroExploreBtn.style.transitionDuration = HERO_BTN_REVEAL_MS + "ms";
      heroExploreBtn.style.transitionTimingFunction = "cubic-bezier(.16,1,.3,1)";
      heroExploreBtn.style.transitionDelay = HERO_BTN_DELAY_MS + "ms";
    }

    window.setTimeout(function () {
      heroSection.classList.add("is-intro-revealed");
      header.classList.remove("is-intro-hidden");
      heroWords.forEach(function (word) { word.classList.add("is-shown"); });
      if (heroExploreBtn) {
        heroExploreBtn.classList.add("is-shown");
        window.setTimeout(function () {
          heroExploreBtn.style.transitionProperty = "";
          heroExploreBtn.style.transitionDuration = "";
          heroExploreBtn.style.transitionTimingFunction = "";
          heroExploreBtn.style.transitionDelay = "";
        }, HERO_BTN_DELAY_MS + HERO_BTN_REVEAL_MS + 50);
      }
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
    /* two stacked <img> layers inside .collage-main — whichever carries
       .is-front is fully visible; the other sits behind at opacity 0 with
       the *next* photo already loaded into it. Toggling which one wears
       .is-front crossfades both simultaneously (old dissolving out while
       new dissolves in), instead of a flash-to-black fade-out-then-fade-in. */
    var storyCollageMainImgs = storyCollageMain ? Array.prototype.slice.call(storyCollageMain.querySelectorAll(".collage-main-img")) : [];
    var prefersReducedMotionHero = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- numbered row of 3 photos, right side of the settled final
       chapter (see CSS .frame-card-stack) — auto-cycles on a timer, and
       whichever thumbnail lights up each tick also becomes the new
       full-bleed backdrop photo (crossfaded via storyCollageMainImgs
       above). A slim progress bar under the row fills over each photo's
       dwell time so the cycle reads like a deliberate countdown, not a
       random flicker. ---------- */
    var frameCardStackEl = heroSection.querySelector(".frame-card-stack");
    var frameCardItems = frameCardStackEl ? Array.prototype.slice.call(frameCardStackEl.querySelectorAll(".frame-card-item")) : [];
    var frameProgressFill = frameCardStackEl ? frameCardStackEl.querySelector(".frame-card-progress-fill") : null;
    /* index 0 matches the backdrop's initial photo (img/home/1.webp) so the
       "01." thumbnail is correctly lit from the very first paint. */
    var FRAME_PHOTOS = ["img/home/1.webp", "img/home/2.webp", "img/home/3.webp"];
    var frameActiveIndex = 0;
    var frameCardTimer = null;
    var FRAME_CARD_MS = 5000;

    function setActiveFrameCard(index) {
      frameActiveIndex = index;
      frameCardItems.forEach(function (item, i) { item.classList.toggle("is-active", i === index); });
    }

    /* restart the countdown bar from empty and let it fill linearly over
       the full dwell time — forcing a reflow between the width:0 reset and
       the width:100% target is what makes it replay every cycle instead of
       only animating once. */
    function restartFrameProgress() {
      if (!frameProgressFill) return;
      frameProgressFill.style.transition = "none";
      frameProgressFill.style.width = "0%";
      void frameProgressFill.offsetWidth;
      frameProgressFill.style.transition = "width " + FRAME_CARD_MS + "ms linear";
      frameProgressFill.style.width = "100%";
    }

    function goToFrameCard(index) {
      if (index === frameActiveIndex) { restartFrameProgress(); return; }
      setActiveFrameCard(index);
      restartFrameProgress();
      if (storyCollageMainImgs.length < 2) return;
      var frontLayer = storyCollageMain.querySelector(".collage-main-img.is-front") || storyCollageMainImgs[0];
      var backLayer = storyCollageMainImgs.filter(function (img) { return img !== frontLayer; })[0];
      var nextSrc = FRAME_PHOTOS[index];
      if (!backLayer || frontLayer.getAttribute("src") === nextSrc) return;
      /* load the next photo into the hidden layer while it's still invisible,
         then flip which layer is "front" — both layers' opacity transitions
         fire together so the two photos genuinely dissolve into each other. */
      backLayer.src = nextSrc;
      window.requestAnimationFrame(function () {
        frontLayer.classList.remove("is-front");
        backLayer.classList.add("is-front");
      });
    }

    function advanceFrameCards() {
      goToFrameCard((frameActiveIndex + 1) % FRAME_PHOTOS.length);
    }

    function startFrameCardStack() {
      if (frameCardTimer || prefersReducedMotionHero || frameCardItems.length < 2) return;
      setActiveFrameCard(0);
      restartFrameProgress();
      frameCardTimer = window.setInterval(advanceFrameCards, FRAME_CARD_MS);
    }
    function stopFrameCardStack() {
      if (frameCardTimer) { window.clearInterval(frameCardTimer); frameCardTimer = null; }
      if (frameProgressFill) { frameProgressFill.style.transition = "none"; frameProgressFill.style.width = "0%"; }
    }

    /* Clicking/tapping a thumbnail jumps straight to that photo and resets
       the auto-advance countdown, instead of waiting for the timer — same
       expectation as the reference site's clickable destination list. */
    frameCardItems.forEach(function (item, i) {
      item.addEventListener("click", function () {
        goToFrameCard(i);
        if (frameCardTimer) { window.clearInterval(frameCardTimer); frameCardTimer = window.setInterval(advanceFrameCards, FRAME_CARD_MS); }
      });
    });

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
      /* true only while the user is "climbing back up" through the story
         after already reaching the main page and scrolling back to the
         top (see tryReengageLock) — keeps the navbar visible through that
         replay instead of re-hiding it. Without this, a normal mouse-wheel
         scroll-up that overshoots past scrollY 0 (extremely common — most
         wheel scrolls don't stop the exact instant they hit the top) would
         silently re-hide the navbar via .is-story-hidden and leave it
         hidden with no way to bring it back short of scrolling up several
         more times to walk back through every chapter to "Welcome". */
      var climbingBack = false;

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
        if (header) header.classList.toggle("is-story-hidden", locked && step > 0 && !climbingBack);
      }

      function setBackdropForStep(step) {
        if (heroBackdropWrap) {
          /* clear any inline transition left over from the "walking into the
             hallway" exit beat below, so ordinary per-chapter steps always
             animate on the normal, quicker 1.1s CSS transition.

             NOTE: this used to be gated behind ".is-intro-done" (only apply
             once the one-time intro zoom-out had fully finished, ~3.25s
             after load). That meant a user who scrolled down immediately —
             i.e. the very first scroll, right as the page finishes loading —
             got skipped entirely: the chapter's zoom never applied, and it
             never got a chance to catch up later since this function only
             ever runs from inside goToStep(). Now it always applies; the
             base .hero-backdrop-wrap CSS transition handles the smooth
             blend whether the intro zoom-out is still mid-flight or done. */
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
        climbingBack = false;
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
      var EXIT_ANIM_MS = prefersReducedMotionHero ? 0 : 550; /* quick, clean snap into the full-bleed banner — was a slow 2.5s zoom that read as the photo "falling"/lurching for a couple seconds; kept just long enough to still feel deliberate, not jarring */
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
          }, EXIT_ANIM_MS);
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
        if (storyCollageMainImgs.length) {
          storyCollageMainImgs.forEach(function (img, i) {
            img.classList.toggle("is-front", i === 0);
            if (i === 0) img.src = "img/home/1.webp";
          });
        }
        frameActiveIndex = 0;
        if (frameCardItems.length) setActiveFrameCard(0);
        if (heroBackdropWrap) { heroBackdropWrap.style.transition = ""; heroBackdropWrap.style.transformOrigin = ""; }
        if (storyShade) storyShade.style.transition = "";
        setBackdropForStep(lastStep);
      }

      var justReengaged = false; /* true for the single event that re-locks, so it isn't ALSO treated as a step command (which would immediately step backward again since we just resumed on the last chapter) */

      function tryReengageLock(deltaY) {
        if (!locked && window.scrollY <= 4 && deltaY < 0) {
          locked = true;
          heroStoryPinnedActive = true;
          climbingBack = true; /* keep the navbar visible through this replay — see the flag's declaration above for why */
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
        /* a tap that starts on a link/button (e.g. "Explore Rasdhoo") must
           always behave like a normal tap. Real fingers drift a few pixels
           even on a plain tap, and that drift was crossing the 36px
           threshold below and getting swallowed as a chapter-swipe instead
           of reaching the link — the button looked "dead" on real touch
           devices even though it worked fine with a zero-movement tap. */
        if (event.target && event.target.closest && event.target.closest("a, button")) {
          touchActive = false;
          return;
        }
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

      /* If the page loaded with a hash already in the URL (e.g. arriving
         from Book Now, a room page, or Explore Rasdhoo via a link like
         "index.html#highlights" / "index.html#gallery" / "index.html#about"),
         jump straight to that section instead of starting the pinned intro
         stepper. Without this, "locked" above defaults to true and the
         scroll-lock safety net (the "scroll" listener a bit further up)
         snapped the page back to 0 the instant the browser tried its native
         anchor-jump — so the link silently did nothing and the Others
         dropdown's Highlights/Gallery links (and About/Experience/
         Accommodation from other pages) all appeared broken. */
      var initialHash = window.location.hash;
      if (initialHash === "#about") {
        window.setTimeout(function () {
          locked = true;
          heroStoryPinnedActive = true;
          setLockClasses(true);
          goToStep(1);
        }, 30);
      } else if (initialHash) {
        var initialHashTarget;
        try { initialHashTarget = document.querySelector(initialHash); } catch (err) { initialHashTarget = null; }
        if (initialHashTarget) {
          releaseLock();
          window.setTimeout(function () {
            initialHashTarget.scrollIntoView({ behavior: "auto", block: "start" });
          }, 30);
        }
      }

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
    var topLoaderFill = slideshow.querySelector(".slideshow-top-loader-fill");
    var current = 0;
    var slideTimer = null;
    var SLIDE_MS = 6000;

    /* restart the top loading line from empty and let it fill linearly
       over each slide's 6s dwell time — forcing a reflow between the
       width:0 reset and the width:100% target is what makes it replay
       every cycle instead of only animating once. */
    function restartTopLoader() {
      if (!topLoaderFill) return;
      topLoaderFill.style.transition = "none";
      topLoaderFill.style.width = "0%";
      void topLoaderFill.offsetWidth;
      topLoaderFill.style.transition = "width " + SLIDE_MS + "ms linear";
      topLoaderFill.style.width = "100%";
    }

    function goToSlide(index) {
      slides[current].classList.remove("is-active");
      dots[current].classList.remove("is-active");
      current = index;
      slides[current].classList.add("is-active");
      dots[current].classList.add("is-active");
      restartTopLoader();
    }

    function nextSlide() {
      goToSlide((current + 1) % slides.length);
    }

    function startAutoplay() {
      slideTimer = window.setInterval(nextSlide, SLIDE_MS);
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

    restartTopLoader();
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
    /* This math (getBoundingClientRect + several style writes) used to run
       on every scroll event for the entire site, even when this section
       was nowhere near the viewport — wasted work on every scroll,
       everywhere on the page. Gate it behind an IntersectionObserver with
       generous margins so it only runs while the section is actually
       approaching or on screen. */
    var collageNearViewport = false;
    var collageRafId = null;

    /* current* = the values actually painted every frame; target* = where
       the scroll position says they should end up. Every frame nudges
       current a fraction of the way toward target (lerp) instead of
       snapping straight to it, so the motion trails the scroll slightly —
       reads as fluid, weighted drift instead of a 1:1 jumpy scrollbar
       tether. Loop keeps running (independent of scroll events) until
       current has essentially caught up to target, so the settle-in is
       itself smooth rather than stopping dead the instant scrolling stops. */
    var currentProgress = 0, targetProgress = 0;
    var currentTravelled = 0, targetTravelled = 0;
    var SMOOTHING = 0.085; /* lower = silkier/slower catch-up, higher = snappier */
    var SETTLE_EPSILON = 0.05;

    function computeTargets() {
      var rect = collageStage.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;

      /* progress: 0 while the stage's top is still at the bottom of the
         viewport, 1 once it has scrolled up to roughly the upper-middle —
         drives the fade-in entrance. */
      var start = vh;
      var end = vh * 0.35;
      var progress = (start - rect.top) / (start - end);
      targetProgress = Math.max(0, Math.min(1, progress));

      /* continuous drift: how far the stage has travelled past the middle
         of the viewport — capped so the two layers glide apart gently but
         always stay anchored/overlapping the photo's corner, instead of
         drifting away from it the longer the page keeps scrolling. */
      var isMobileViewport = window.innerWidth <= 640;
      var maxTravel = (isMobileViewport ? vh * 0.85 : vh * 1.3);
      targetTravelled = Math.max(0, Math.min(maxTravel, vh * 0.6 - rect.top));
    }

    function paint() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      var isMobileViewport = window.innerWidth <= 640;
      var maxTravel = (isMobileViewport ? vh * 0.85 : vh * 1.3);

      /* Deeper, more dramatic separation: the circle and badge now drift
         at noticeably different speeds from each other (not just a mirrored
         +/- of one number), and the whole drift range is larger, so the
         two layers read as sitting at clearly different depths rather than
         gliding in lockstep. */
      var accentMultiplier = isMobileViewport ? 0.42 : 0.72;
      var badgeMultiplier = isMobileViewport ? 0.58 : 0.98;

      collageMain.style.opacity = String(currentProgress);

      /* landscape -> portrait morph: as the user keeps scrolling past the
         section, the wide photo gradually narrows into a portrait crop
         (object-fit: cover handles the reveal, no distortion), with a
         gentle zoom and softening corners so it reads as one smooth,
         continuous move rather than a jump cut. */
      var portraitT = maxTravel > 0 ? Math.max(0, Math.min(1, currentTravelled / maxTravel)) : 0;
      var mainWidthPct = 100 - portraitT * 54; /* 100% (landscape) -> 46% (portrait) */
      var mainSidePct = (100 - mainWidthPct) / 2;
      collageMain.style.top = "0";
      collageMain.style.bottom = "0";
      collageMain.style.left = mainSidePct.toFixed(2) + "%";
      collageMain.style.right = mainSidePct.toFixed(2) + "%";
      collageMain.style.borderRadius = (22 + portraitT * 12).toFixed(1) + "px";
      /* subtle extra scale + a soft, growing shadow on the accent square as
         it drifts "forward" gives the two layers a real sense of depth
         (near layer scales/brightens slightly, far layer recedes) rather
         than a flat side-by-side slide. */
      collageMain.style.transform = "scale(" + (1 + portraitT * 0.07).toFixed(3) + ")";

      var accentT = maxTravel > 0 ? Math.max(0, Math.min(1, (currentTravelled * accentMultiplier) / maxTravel)) : 0;
      collageAccent.style.opacity = String(currentProgress);
      collageAccent.style.transform = "translateY(" + (currentTravelled * accentMultiplier).toFixed(1) + "px) scale(" + (1 + accentT * 0.05).toFixed(3) + ")";
      collageAccent.style.boxShadow = "0 " + (18 + accentT * 26).toFixed(0) + "px " + (40 + accentT * 50).toFixed(0) + "px rgba(10,22,24," + (0.22 + accentT * 0.14).toFixed(2) + ")";

      collageBadge.style.opacity = String(currentProgress);
      collageBadge.style.transform = "translateY(" + (-(currentTravelled * badgeMultiplier)).toFixed(1) + "px)";
    }

    function tick() {
      collageRafId = null;
      computeTargets();

      currentProgress += (targetProgress - currentProgress) * SMOOTHING;
      currentTravelled += (targetTravelled - currentTravelled) * SMOOTHING;

      paint();

      var settled = Math.abs(targetProgress - currentProgress) < 0.002 &&
                     Math.abs(targetTravelled - currentTravelled) < SETTLE_EPSILON;

      if (collageNearViewport && !settled) {
        collageRafId = window.requestAnimationFrame(tick);
      }
    }

    function ensureLoopRunning() {
      if (collageRafId === null) {
        collageRafId = window.requestAnimationFrame(tick);
      }
    }

    computeTargets();
    currentProgress = targetProgress;
    currentTravelled = targetTravelled;
    paint();

    if ("IntersectionObserver" in window) {
      var collageVisibilityObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          collageNearViewport = entry.isIntersecting;
          if (collageNearViewport) ensureLoopRunning();
        });
      }, { rootMargin: "50% 0px 50% 0px" });
      collageVisibilityObserver.observe(collageStage);
    } else {
      collageNearViewport = true; /* very old browsers: fall back to always-on, as before */
    }

    window.addEventListener("scroll", function () {
      if (!collageNearViewport) return;
      ensureLoopRunning();
    }, { passive: true });
    window.addEventListener("resize", function () {
      if (collageNearViewport) ensureLoopRunning();
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
  var setWidth = 0;         /* width of one full (non-duplicated) set of cards */
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

  /* setWidth = width of exactly ONE set of cards (the original, non
     -duplicated cards), measured as the gap between the left edge of the
     first real card and the left edge of the first aria-hidden duplicate
     card. This is the true "seamless wrap" distance, independent of how
     many duplicate sets currently exist in the track. */
  function measure() {
    var cards = track.querySelectorAll(".excursion-card");
    var firstDup = null;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute("aria-hidden") === "true") { firstDup = cards[i]; break; }
    }
    if (firstDup && cards.length) {
      setWidth = firstDup.offsetLeft - cards[0].offsetLeft;
    } else {
      setWidth = track.scrollWidth; /* fallback: no duplicate found */
    }
  }

  /* Clones the original (real, non-duplicated) set of cards and appends the
     clone — marked aria-hidden/tabindex -1, same as the existing duplicate
     set already in the markup — to the end of the track. */
  function cloneSet() {
    var cards = track.querySelectorAll(".excursion-card");
    var realCount = 0;
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].getAttribute("aria-hidden") === "true") break;
      realCount++;
    }
    if (!realCount) return false;
    for (var j = 0; j < realCount; j++) {
      var clone = cards[j].cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.setAttribute("tabindex", "-1");
      clone.classList.remove("reveal", "is-visible");
      track.appendChild(clone);
    }
    return true;
  }

  /* On wide/ultrawide viewports, two sets of cards (the original markup's
     real set + its single duplicate) aren't always wider than the screen.
     Once the belt scrolled past the end of that second set there was
     nothing left to show — a blank gap — right before the position wrapped
     back to the start, which read as the loop visibly "cutting". Keep
     appending duplicate sets until the track is comfortably wider than the
     viewport (with a full extra set of headroom) so there's always another
     card sliding in, no matter how wide the screen is. */
  function ensureEnoughCards() {
    var guard = 0;
    var target = (loop.clientWidth || window.innerWidth) + setWidth;
    while (setWidth > 0 && track.scrollWidth < target && guard < 12) {
      if (!cloneSet()) break;
      guard++;
    }
  }

  function applyTransform() {
    track.style.transform = "translateX(" + pos.toFixed(2) + "px)";
  }

  function wrap() {
    if (setWidth <= 0) return;
    while (pos <= -setWidth) pos += setWidth;
    while (pos > 0) pos -= setWidth;
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
  ensureEnoughCards();
  applyTransform();

  /* measure() is called immediately above, but the excursion-card images
     (several are remote Unsplash photos) are often still loading at that
     point, so card widths (and therefore track.scrollWidth) can still be
     briefly off. That produces a wrong setWidth, which makes the seamless
     wrap point land in the wrong place — the duplicated card sets end up
     slightly misaligned and visibly overlap/ghost into each other for a
     moment. Once every image has actually finished loading, remeasure,
     re-check whether more duplicate sets are now needed, and re-snap the
     position (keeping the same relative point in the loop) so the wrap is
     clean. */
  var loopImages = Array.prototype.slice.call(track.querySelectorAll("img"));
  var pendingImages = loopImages.filter(function (img) { return !img.complete; });
  function resyncAfterImagesLoad() {
    var ratio = setWidth > 0 ? pos / setWidth : 0;
    measure();
    ensureEnoughCards();
    pos = ratio * setWidth;
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
    var ratio = setWidth > 0 ? pos / setWidth : 0;
    measure();
    ensureEnoughCards();
    pos = ratio * setWidth;
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

/* ==========================================================================
   Footer "Stay in Touch" newsletter form -> Formspree.
   Submits via fetch (instead of a plain HTML POST) so the person sees an
   inline "you're subscribed" message right in the footer, rather than
   getting redirected away to a blank Formspree confirmation page.
   Requires action="https://formspree.io/f/YOUR_FORM_ID" above to be
   swapped for a real Formspree form ID (create a free form at
   formspree.io, then paste its endpoint into the form's action attribute
   in index.html) — without that, submissions have nowhere to go.
   ========================================================================== */
(function () {
  var newsletterForm = document.getElementById("newsletter-form");
  if (!newsletterForm) return;
  var newsletterMsg = document.getElementById("newsletter-msg");

  newsletterForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var submitBtn = newsletterForm.querySelector("button[type='submit']");
    var originalLabel = submitBtn ? submitBtn.textContent : "";

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Sending…"; }
    if (newsletterMsg) { newsletterMsg.textContent = ""; newsletterMsg.classList.remove("is-success", "is-error"); }

    fetch(newsletterForm.action, {
      method: "POST",
      body: new FormData(newsletterForm),
      headers: { "Accept": "application/json" }
    })
      .then(function (response) {
        if (response.ok) {
          if (newsletterMsg) { newsletterMsg.textContent = "Thanks — you're subscribed!"; newsletterMsg.classList.add("is-success"); }
          newsletterForm.reset();
        } else {
          return response.json().then(function (data) {
            var detail = data && data.errors && data.errors[0] && data.errors[0].message;
            throw new Error(detail || "Something went wrong.");
          });
        }
      })
      .catch(function () {
        if (newsletterMsg) { newsletterMsg.textContent = "Something went wrong — please try again."; newsletterMsg.classList.add("is-error"); }
      })
      .finally(function () {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalLabel; }
      });
  });
})();

/* ==========================================================================
   Room card photos (Double + Triple) — same idea as the Family Room photo
   drift above: the photo lags slightly behind the scroll ("naiiwan" /
   left-behind effect) instead of moving in lockstep with the card frame
   around it. Honours reduced motion, only runs while each card is near
   the viewport.
   ========================================================================== */
/* ==========================================================================
   Scroll-drift photo effect — reusable across every card/gallery image
   section on the page. The photo lags slightly behind the scroll
   ("naiiwan" / left-behind effect) instead of moving in lockstep with the
   frame around it. Sets a --img-drift CSS custom property (rather than
   writing the element's transform directly) so this composes cleanly with
   each section's own hover-zoom transform instead of one silently
   cancelling the other out. Honours reduced motion, only runs while each
   image is near the viewport.
   ========================================================================== */
function initImageDrift(selector, driftPx) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var wraps = Array.prototype.slice.call(document.querySelectorAll(selector));
  if (!wraps.length) return;

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
      targetShift = (progress - 0.5) * driftPx;
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

/* Accommodation cards (Double/Triple/Family carousel + the flat grids on
   Offers/Explore) — drift range doubled (30 -> 60) for a more noticeable,
   deeper effect. */
initImageDrift(".offer-card-media", 60);
/* Highlights section photos (Sunset Swing / Island From Above / Snorkeling
   the Lagoon + the mini gallery strip beneath them). */
initImageDrift(".highlights-section .card-image-wrap", 60);
/* Main Gallery section photos. */
initImageDrift(".gallery-section .gallery-item", 55);
/* Highlights mini-gallery strip (the 6 photos below the Sunset Swing /
   Island From Above / Snorkeling the Lagoon cards) — didn't have drift
   yet since it lives inside .highlights-section, not .gallery-section, so
   the main-gallery selector above never reached it. Drift range doubled
   (55 -> 110) for a more noticeable, deeper effect than the main gallery. */
initImageDrift(".highlights-gallery-grid .gallery-item", 110);


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

/* ---------- Nav dropdown hover grace period ----------
   Pure CSS ":hover" drops the panel the instant the pointer leaves
   ".nav-dropdown" by even a pixel — real mouse movement isn't perfectly
   straight, so tracking down to a lower row (e.g. Family Room) can nudge
   the cursor off the hoverable area for a frame and snap the panel shut
   before the click lands, making it feel like it "won't reach" the
   bottom rows. Driving the open state from JS with a short close delay
   (cancelled if the pointer comes back before it fires) gives the same
   panel some forgiveness, reusing the existing ".is-open" CSS hook —
   the ":hover"/":focus-within" CSS rules stay in place as a fallback. */
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
   Card carousels — Accommodation (Double / Triple / Family) and Island
   Activities (Snorkeling / Fishing / Dolphin / Turtle / Sharks) both use
   this same auto-looping "one centered card at a time" mechanic, auto-
   advancing every 4s and looping forever. See the ".room-carousel" /
   ".experience-carousel" comment blocks in style.css for how the seamless
   loop (clone slides + instant snap-back) works; this is the shared JS
   half of that mechanic, instantiated once per carousel below.

   Autoplay switches slides every 4s (a normal, readable dwell time).
   TRANSITION_MS (the slide-glide duration, must stay in sync with the CSS
   transition on each carousel's -track class) is kept noticeably shorter
   than AUTOPLAY_MS on purpose: if the two are equal, the setInterval tick
   and the CSS transitionend event land at almost the exact same
   millisecond, and whichever one wins that race governs — half the time
   the tick fires a hair before "isAnimating" gets cleared and goTo()
   silently no-ops, so it visibly switches on some other cadence than
   intended. A 700ms glide leaves a clean gap before the next tick, so
   there's no race and every switch reliably lands on schedule.
   ========================================================================== */
function initCardCarousel(config) {
  var track = document.getElementById(config.trackId);
  var viewport = track ? track.parentElement : null;
  var prevBtn = document.getElementById(config.prevId);
  var nextBtn = document.getElementById(config.nextId);
  var dotsWrap = config.dotsId ? document.getElementById(config.dotsId) : null;
  var carousel = config.carouselId ? document.getElementById(config.carouselId) : null;
  var viewAllLink = config.viewAllId ? document.getElementById(config.viewAllId) : null;
  if (!track || !viewport || !prevBtn || !nextBtn) return;

  var slides = Array.prototype.slice.call(track.children);
  var realSlides = slides.filter(function (slide) { return !slide.hasAttribute("data-clone"); });
  var REAL_COUNT = realSlides.length;
  if (REAL_COUNT < 1) return;

  var dots = dotsWrap ? Array.prototype.slice.call(dotsWrap.children) : [];
  var AUTOPLAY_MS = 4000;
  var TRANSITION_MS = 700;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var position = 1; /* index 1 in the track = the first real slide */
  var slideWidth = 0;
  var timer = null;
  var resizeT = null;
  var isAnimating = false;
  var fallbackT = null;

  function layout() {
    slideWidth = viewport.clientWidth;
    slides.forEach(function (slide) { slide.style.width = slideWidth + "px"; });
    render(false);
  }

  function render(animate) {
    track.classList.toggle("is-jumping", !animate);
    track.style.transform = "translateX(" + (-position * slideWidth) + "px)";
    updateDots();
  }

  function updateDots() {
    var realIndex = ((position - 1) % REAL_COUNT + REAL_COUNT) % REAL_COUNT;
    if (dots.length) {
      dots.forEach(function (dot, i) { dot.classList.toggle("is-active", i === realIndex); });
    }
    /* "View All Rooms" below the carousel actually points at whichever
       room is currently showing (config.roomPages/roomLabels, indexed to
       match each slide's data-room), not a static "see everything" page —
       so pressing it while Triple Room is centered goes to
       triple-room.html, not always the same destination. */
    if (viewAllLink && config.roomPages && config.roomPages[realIndex]) {
      viewAllLink.setAttribute("href", config.roomPages[realIndex]);
      if (config.roomLabels && config.roomLabels[realIndex]) {
        viewAllLink.textContent = config.roomLabels[realIndex];
      }
    }
  }

  /* Snap the clone the track just finished sliding to back to its matching
     real slide, instantly (transition switched off for this one frame) —
     the clone and the real slide look identical so this is invisible, but
     it's what lets autoplay/arrows keep moving the same direction forever
     without ever rewinding across every slide. */
  function settle() {
    if (position >= REAL_COUNT + 1) {
      position = 1;
      render(false);
    } else if (position <= 0) {
      position = REAL_COUNT;
      render(false);
    }
    isAnimating = false;
    if (fallbackT) { window.clearTimeout(fallbackT); fallbackT = null; }
  }

  function goTo(pos) {
    /* Ignore new moves while one is still animating — without this guard,
       clicking Next fast (or autoplay firing mid-click) could push
       "position" past the track's actual slides (only REAL_COUNT + 2
       clones exist), translating the track clean off past its last slide
       and leaving an empty-looking carousel. */
    if (isAnimating || pos === position) return;
    isAnimating = true;
    position = pos;
    render(true);
    /* Fallback in case transitionend doesn't fire for some reason (e.g. a
       backgrounded tab) — guarantees the lock always releases and the
       clone always gets snapped back. */
    fallbackT = window.setTimeout(settle, TRANSITION_MS + 120);
  }

  track.addEventListener("transitionend", function (event) {
    if (event.propertyName !== "transform") return;
    settle();
  });

  function next() { goTo(position + 1); }
  function prev() { goTo(position - 1); }

  function startAutoplay() {
    if (reduceMotion) return;
    stopAutoplay();
    timer = window.setInterval(next, AUTOPLAY_MS);
  }
  function stopAutoplay() {
    if (timer) { window.clearInterval(timer); timer = null; }
  }

  nextBtn.addEventListener("click", function () { next(); startAutoplay(); });
  prevBtn.addEventListener("click", function () { prev(); startAutoplay(); });

  dots.forEach(function (dot, i) {
    dot.addEventListener("click", function () {
      goTo(i + 1);
      startAutoplay();
    });
  });

  if (carousel) {
    carousel.addEventListener("mouseenter", stopAutoplay);
    carousel.addEventListener("mouseleave", startAutoplay);
    carousel.addEventListener("focusin", stopAutoplay);
    carousel.addEventListener("focusout", startAutoplay);
  }

  window.addEventListener("resize", function () {
    window.clearTimeout(resizeT);
    resizeT = window.setTimeout(layout, 120);
  });

  layout();
  startAutoplay();
}

initCardCarousel({ trackId: "room-carousel-track", prevId: "room-carousel-prev", nextId: "room-carousel-next", dotsId: "room-carousel-dots", carouselId: "room-carousel", viewAllId: "room-carousel-view-all-link", roomPages: ["double-room.html", "triple-room.html", "family-room.html"], roomLabels: ["View Double Room", "View Triple Room", "View Family Room"] });
initCardCarousel({ trackId: "experience-carousel-track", prevId: "experience-carousel-prev", nextId: "experience-carousel-next", dotsId: "experience-carousel-dots", carouselId: "experience-carousel" });
