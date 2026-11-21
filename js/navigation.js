/*
 * Navigation helper for Orden del Toro.
 * The main navigation function remains in app.js so existing inline handlers
 * continue to work. This file only adds lightweight UX behavior.
 */
(function () {
  'use strict';

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    const nav = document.getElementById('mainNav');
    if (nav) nav.classList.remove('open');
  });

  window.odtNavigate = function (page) {
    if (typeof window.navigate === 'function') {
      window.navigate(page);
    }
  };
})();
