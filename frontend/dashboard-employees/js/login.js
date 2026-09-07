/**
 * TICK - Employee Login Controller
 */
(function() {
  'use strict';

  const API_BASE = "http://localhost:8000/api/v1";
  const TOKEN_KEY = "tick_access_token";

  document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('employeeLoginForm');

    function showLoginError(msg) {
      let errEl = document.getElementById('loginErrorMsg');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.id = 'loginErrorMsg';
        errEl.style.cssText = 'margin-top: 1rem; padding: 0.75rem 1rem; background-color: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 6px; font-size: 0.8125rem; color: #B91C1C; font-weight: 500; text-align: center;';
        if (form) form.appendChild(errEl);
      }
      errEl.textContent = msg;
      errEl.style.display = 'block';
    }

    function clearLoginError() {
      const errEl = document.getElementById('loginErrorMsg');
      if (errEl) {
        errEl.textContent = '';
        errEl.style.display = 'none';
      }
    }

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        clearLoginError();

        const email = document.getElementById('employeeIdInput').value.trim();
        const password = document.getElementById('employeePassword').value;
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        fetch(`${API_BASE}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        })
          .then(res => {
            if (!res.ok) {
              return res.json().then(err => { throw new Error(err.detail || 'Login failed'); });
            }
            return res.json();
          })
          .then(data => {
            const role = data.user && data.user.role ? String(data.user.role).toUpperCase() : '';
            if (role === 'MANAGER' || role === 'ADMIN') {
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem('tick_user');
              showLoginError('Access Denied: Please use the Manager Portal.');
              if (submitBtn) submitBtn.disabled = false;
              return;
            }

            localStorage.setItem(TOKEN_KEY, data.access_token);
            if (data.user) {
              localStorage.setItem('tick_user', JSON.stringify(data.user));
            }
            window.location.href = 'index.html';
          })
          .catch(err => {
            showLoginError(err.message || 'Login failed — check the email and password.');
            if (submitBtn) submitBtn.disabled = false;
          });
      });
    }
  });
})();