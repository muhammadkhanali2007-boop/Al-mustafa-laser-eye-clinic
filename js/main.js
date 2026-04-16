(function () {
  "use strict";

  var header = document.querySelector(".site-header");
  var navToggle = document.querySelector(".nav-toggle");
  var navDesktop = document.querySelector(".nav-desktop");
  var fabBook = document.querySelector(".fab-book");
  var backToTop = document.getElementById("back-to-top");

  function onScroll() {
    if (!header) return;
    if (window.scrollY > 24) {
      header.classList.add("is-scrolled");
    } else {
      header.classList.remove("is-scrolled");
    }
    if (backToTop) {
      backToTop.classList.toggle("is-visible", window.scrollY > 480);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  var heroVideo = document.getElementById("hero-bg-video");
  var heroSection = document.getElementById("hero");
  var heroStatic = document.getElementById("hero-static");

  if (heroVideo && typeof heroVideo.play === "function") {
    heroVideo.play().catch(function () {});
  }

  function showHeroBanner() {
    if (!heroSection || !heroStatic) return;
    heroSection.classList.add("is-hero-banner");
    heroStatic.setAttribute("aria-hidden", "false");
    var img = heroStatic.querySelector(".hero-static__img");
    if (img) {
      img.setAttribute("fetchpriority", "high");
    }
  }

  function resetHeroToVideo() {
    if (!heroSection || !heroStatic) return;
    heroSection.classList.remove("is-hero-banner");
    heroStatic.setAttribute("aria-hidden", "true");
    var img = heroStatic.querySelector(".hero-static__img");
    if (img) {
      img.setAttribute("fetchpriority", "low");
    }
  }

  if (heroVideo && heroSection) {
    heroVideo.addEventListener("ended", function () {
      showHeroBanner();
    });

    heroVideo.addEventListener("play", function () {
      resetHeroToVideo();
    });
  }

  if (navToggle && navDesktop) {
    navToggle.addEventListener("click", function () {
      var open = navDesktop.classList.toggle("is-open");
      navToggle.classList.toggle("is-open", open);
      navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    navDesktop.querySelectorAll('a[href^="#"]').forEach(function (link) {
      link.addEventListener("click", function () {
        navDesktop.classList.remove("is-open");
        navToggle.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  var revealEls = document.querySelectorAll(".reveal");
  if (revealEls.length && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  var bookingForm = document.getElementById("booking-form");
  var formSuccess = document.querySelector(".form-success");

  if (bookingForm) {
    bookingForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (formSuccess) {
        formSuccess.classList.add("is-show");
        bookingForm.reset();
        setTimeout(function () {
          formSuccess.classList.remove("is-show");
        }, 6000);
      }
    });
  }

  var lightbox = document.getElementById("lightbox");
  var lightboxImg = lightbox ? lightbox.querySelector("img") : null;
  var lightboxClose = lightbox ? lightbox.querySelector(".lightbox-close") : null;

  document.querySelectorAll("[data-lightbox]").forEach(function (trigger) {
    trigger.addEventListener("click", function () {
      var src = trigger.getAttribute("data-full") || trigger.querySelector("img").src;
      var alt = trigger.querySelector("img").alt;
      if (lightbox && lightboxImg) {
        lightboxImg.src = src;
        lightboxImg.alt = alt || "";
        lightbox.classList.add("is-open");
        document.body.style.overflow = "hidden";
      }
    });
  });

  function closeLightbox() {
    if (lightbox) {
      lightbox.classList.remove("is-open");
      document.body.style.overflow = "";
    }
  }

  if (lightboxClose) {
    lightboxClose.addEventListener("click", closeLightbox);
  }
  if (lightbox) {
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
  }
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeLightbox();
  });

  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      var id = anchor.getAttribute("href");
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        var top = target.getBoundingClientRect().top + window.scrollY - 76;
        window.scrollTo({ top: top, behavior: "smooth" });
      }
    });
  });

  if (fabBook) {
    fabBook.addEventListener("click", function (e) {
      var form = document.getElementById("contact");
      if (form) {
        e.preventDefault();
        var top = form.getBoundingClientRect().top + window.scrollY - 76;
        window.scrollTo({ top: top, behavior: "smooth" });
      }
    });
  }

  if (backToTop) {
    backToTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  var diabeticWrap = document.querySelector("[data-diabetic-video]");
  var diabeticVideo = diabeticWrap ? diabeticWrap.querySelector("video") : null;
  if (diabeticVideo && diabeticWrap && "IntersectionObserver" in window) {
    var diabeticIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            diabeticVideo.play().catch(function () {});
          } else {
            diabeticVideo.pause();
          }
        });
      },
      { rootMargin: "0px", threshold: 0.28 }
    );
    diabeticIo.observe(diabeticWrap);
  } else if (diabeticVideo) {
    diabeticVideo.play().catch(function () {});
  }

  /* Our doctors (#about): one scroll trigger runs the full choreographed entrance (CSS). */
  var aboutSection = document.getElementById("about");
  var aboutReduceMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function activateAboutMotion() {
    if (aboutSection) {
      aboutSection.classList.add("is-about-motion");
    }
  }

  function aboutSectionIsRoughlyInView() {
    if (!aboutSection) return false;
    var r = aboutSection.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return r.top < vh * 0.88 && r.bottom > vh * 0.1;
  }

  if (aboutSection && !aboutReduceMotion && "IntersectionObserver" in window) {
    document.documentElement.classList.add("js-about-motion-ready");
    if (aboutSectionIsRoughlyInView()) {
      activateAboutMotion();
    } else {
      var aboutSectionIo = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            activateAboutMotion();
            aboutSectionIo.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -6% 0px", threshold: 0.1 }
      );
      aboutSectionIo.observe(aboutSection);
    }
  } else {
    activateAboutMotion();
  }
})();
