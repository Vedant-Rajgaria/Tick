/**
 * TICK - Admin Login & Registration Controller
 */
(function() {
  'use strict';

  const API_BASE = "http://localhost:8000/api/v1";
  const TOKEN_KEY = "tick_access_token";
  const USER_KEY = "tick_user";

  document.addEventListener('DOMContentLoaded', () => {
    const tabLogin = document.getElementById('tabLogin');
    const tabRegister = document.getElementById('tabRegister');
    const loginForm = document.getElementById('adminLoginForm');
    const registerForm = document.getElementById('adminRegisterForm');
    const authTitle = document.getElementById('authTitle');

    // Tab switching
    if (tabLogin && tabRegister && loginForm && registerForm) {
      tabLogin.addEventListener('click', () => {
        tabLogin.style.fontWeight = '600';
        tabLogin.style.color = '#2563EB';
        tabLogin.style.borderBottom = '2px solid #2563EB';

        tabRegister.style.fontWeight = '500';
        tabRegister.style.color = '#6B7280';
        tabRegister.style.borderBottom = '2px solid transparent';

        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
        if (authTitle) authTitle.textContent = 'Admin Login';
      });

      tabRegister.addEventListener('click', () => {
        tabRegister.style.fontWeight = '600';
        tabRegister.style.color = '#2563EB';
        tabRegister.style.borderBottom = '2px solid #2563EB';

        tabLogin.style.fontWeight = '500';
        tabLogin.style.color = '#6B7280';
        tabLogin.style.borderBottom = '2px solid transparent';

        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
        if (authTitle) authTitle.textContent = 'Create Admin Profile';
      });
    }

    function showLoginError(msg) {
      let errEl = document.getElementById('loginErrorMsg');
      if (!errEl) {
        errEl = document.createElement('div');
        errEl.id = 'loginErrorMsg';
        errEl.style.cssText = 'margin-top: 1rem; padding: 0.75rem 1rem; background-color: #FEF2F2; border: 1px solid #FCA5A5; border-radius: 6px; font-size: 0.8125rem; color: #B91C1C; font-weight: 500; text-align: center;';
        if (loginForm) loginForm.appendChild(errEl);
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

    // Login submission
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearLoginError();
        const email = document.getElementById('adminEmail').value.trim();
        const password = document.getElementById('adminPassword').value;
        const btn = loginForm.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;

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
            if (role === 'EMPLOYEE') {
              localStorage.removeItem(TOKEN_KEY);
              localStorage.removeItem(USER_KEY);
              showLoginError('Access Denied: Please use the Employee Portal.');
              if (btn) btn.disabled = false;
              return;
            }

            localStorage.setItem(TOKEN_KEY, data.access_token);
            if (data.user) {
              localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            }
            window.location.href = 'index.html';
          })
          .catch(err => {
            showLoginError(err.message || 'Login failed — please check your email and password.');
            if (btn) btn.disabled = false;
          });
      });
    }

    // Registration submission
    if (registerForm) {
      registerForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const org_name = document.getElementById('regOrgName').value.trim();
        const name = document.getElementById('regAdminName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;
        const btn = registerForm.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;

        fetch(`${API_BASE}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ org_name, name, email, password })
        })
          .then(res => {
            if (!res.ok) {
              return res.json().then(err => { throw new Error(err.detail || 'Registration failed'); });
            }
            return res.json();
          })
          .then(data => {
            localStorage.setItem(TOKEN_KEY, data.access_token);
            if (data.user) {
              localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            }
            window.location.href = 'index.html';
          })
          .catch(err => {
            alert(err.message || 'Registration failed — please verify inputs.');
            if (btn) btn.disabled = false;
          });
      });
    }
  });
})();
