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
      dots[current].classList.add("is-active");
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
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(function (node) { observer.observe(node); });
})();
