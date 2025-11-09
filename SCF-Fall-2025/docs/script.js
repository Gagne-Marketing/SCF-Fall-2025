// script.js

// ---------- Utilities ----------
const debounce = (fn, delay = 150) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
};

// ---------- Bootstrap form validation ----------
(() => {
  'use strict';
  const forms = document.querySelectorAll('.needs-validation');

  Array.from(forms).forEach((form) => {
    form.addEventListener(
      'submit',
      (event) => {
        if (!form.checkValidity()) {
          event.preventDefault();
          event.stopPropagation();

          // Focus the first invalid field for better UX & accessibility
          const firstInvalid = form.querySelector(':invalid');
          if (firstInvalid && typeof firstInvalid.focus === 'function') {
            // Scroll into view first (center) then focus the field
            firstInvalid.scrollIntoView({ block: 'center', behavior: 'smooth' });
            requestAnimationFrame(() => firstInvalid.focus());
          }
        }
        form.classList.add('was-validated');
      },
      false
    );
  });
})();

// ---------- DOM Ready ----------
document.addEventListener('DOMContentLoaded', () => {
  // ----- ScrollSpy (guard if Bootstrap JS isn't present) -----
  let scrollSpy = null;
  if (window.bootstrap && typeof bootstrap.ScrollSpy === 'function') {
    scrollSpy = new bootstrap.ScrollSpy(document.body, {
      target: '#mainNav',
      offset: 80,
    });

    // Refresh after images load (layout shift)
    window.addEventListener('load', () => {
      try { scrollSpy.refresh(); } catch { /* no-op */ }
    });

    // Refresh on resize (content height may change)
    window.addEventListener(
      'resize',
      debounce(() => {
        try { scrollSpy.refresh(); } catch { /* no-op */ }
      }, 200)
    );

    // Refresh on hashchange (in case of deep links)
    window.addEventListener('hashchange', () => {
      try { scrollSpy.refresh(); } catch { /* no-op */ }
    });
  }

  // ----- Reveal-on-scroll (respect reduced motion) -----
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReduced) {
    const els = document.querySelectorAll('.reveal-on-scroll');
    if (els.length) {
      const io = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('in-view');
              obs.unobserve(entry.target); // reveal once
            }
          });
        },
        {
          threshold: 0.1,
          // Start revealing just before the element fully enters the viewport
          rootMargin: '0px 0px -10%',
        }
      );
      els.forEach((el) => io.observe(el));
    }
  }
});
