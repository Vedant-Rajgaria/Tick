/**
 * TICK - Admin Login Controller
 */
(function() {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('adminLoginForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        window.location.href = 'index.html';
      });
    }
  });
})();
