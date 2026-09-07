/**
 * TICK - Employee Dashboard Controller
 * Fully dynamic: loads current employee profile, activity metrics, Work Pulse,
 * Useful Work intensity graph, and application usage from the backend.
 */

(function() {
  'use strict';

  const API_BASE = "http://localhost:8000/api/v1";
  const TOKEN_KEY = "tick_access_token";

  let empUsefulWorkChart = null;

  document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      window.location.href = 'login.html';
      return;
    }

    setupLogout();
    updateHeaderDate();
    fetchEmployeeProfile(token);
    fetchDashboardData(token);
  });

  function setupLogout() {
    const logoutLink = document.getElementById('empLogoutLink');
    if (logoutLink) {
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('tick_user');
        window.location.href = 'login.html';
      });
    }
  }

  function updateHeaderDate() {
    const dateEl = document.getElementById('topHeaderDate');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  function fetchEmployeeProfile(token) {
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(user => {
        const nameEl = document.getElementById('empSidebarName');
        const roleEl = document.getElementById('empSidebarRole');
        const metaEl = document.getElementById('empSidebarMeta');
        const greetingEl = document.getElementById('empGreeting');

        if (nameEl) nameEl.textContent = user.name;
        if (roleEl) roleEl.textContent = `${user.role} Workspace`;
        if (metaEl) metaEl.textContent = `${user.department || 'General'} • ${user.organization || 'TICK'}`;
        if (greetingEl) {
          const firstName = user.name ? user.name.split(' ')[0] : 'there';
          greetingEl.textContent = `Good morning, ${firstName}.`;
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = 'login.html';
      });
  }

  function fetchDashboardData(token) {
    fetch(`${API_BASE}/employee/me/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load dashboard data');
        return res.json();
      })
      .then(data => {
        renderMetrics(data);
        renderWorkPulse(data.workPulse || []);
        renderUsefulWorkGraph(data.hourlyActivity || []);
        renderAppUsage(data.applications || []);
      })
      .catch(err => {
        console.error('[TICK] Dashboard error:', err);
        const container = document.getElementById('empWorkPulseBar');
        if (container) {
          container.innerHTML = `<div style="padding: 1rem; color: #DC2626; text-align: center;">Unable to load telemetry data from server.</div>`;
        }
      });
  }

  function renderMetrics(data) {
    const activeSec = data.activeSeconds || 0;
    const idleSec = data.idleSeconds || 0;
    const sessionCount = data.sessionCount || 0;
    const appCount = (data.applications || []).length;

    const usefulEl = document.getElementById('empUsefulWork');
    const idleEl = document.getElementById('empIdleTime');
    const sessionEl = document.getElementById('empSessionCount');
    const appEl = document.getElementById('empAppCount');

    if (usefulEl) usefulEl.textContent = formatDuration(activeSec);
    if (idleEl) idleEl.textContent = formatDuration(idleSec);
    if (sessionEl) sessionEl.textContent = sessionCount;
    if (appEl) appEl.textContent = appCount;
  }

  function renderWorkPulse(segments) {
    const container = document.getElementById('empWorkPulseBar');
    const tooltip = document.getElementById('empPulseTooltip');
    const tooltipApp = document.getElementById('empTooltipApp');
    const tooltipMeta = document.getElementById('empTooltipMeta');

    if (!container) return;

    if (!segments || segments.length === 0) {
      container.innerHTML = `
        <div style="width: 100%; text-align: center; color: #6B7280; font-size: 0.8125rem; padding: 1.5rem 0;">
          No activity sessions recorded yet today. Run your desktop agent to track and display activity here.
        </div>
      `;
      return;
    }

    container.innerHTML = segments.map((seg, idx) => {
      return `
        <div class="pulse-segment ${seg.type}" 
             data-index="${idx}"
             style="width: ${seg.width};"
             title="${seg.app} (${seg.duration})">
        </div>
      `;
    }).join('');

    const segEls = container.querySelectorAll('.pulse-segment');
    segEls.forEach(el => {
      el.addEventListener('mouseenter', () => {
        const idx = parseInt(el.getAttribute('data-index'), 10);
        const seg = segments[idx];
        if (!seg || !tooltip) return;

        if (tooltipApp) tooltipApp.textContent = `Application: ${seg.app}`;
        if (tooltipMeta) tooltipMeta.textContent = `Start: ${seg.start} • End: ${seg.end} • Duration: ${seg.duration}`;
        
        const rect = el.getBoundingClientRect();
        const parentRect = container.getBoundingClientRect();
        const leftPos = rect.left - parentRect.left + (rect.width / 2) - 80;
        
        tooltip.style.left = `${Math.max(10, Math.min(leftPos, parentRect.width - 240))}px`;
        tooltip.classList.add('visible');
      });

      el.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.classList.remove('visible');
      });

      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-index'), 10);
        const seg = segments[idx];
        if (window.TICK && window.TICK.showToast) {
          window.TICK.showToast(`Session: ${seg.app} (${seg.start} - ${seg.end})`);
        }
      });
    });
  }

  function renderUsefulWorkGraph(hourlyData) {
    const canvas = document.getElementById('empUsefulWorkChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (empUsefulWorkChart) empUsefulWorkChart.destroy();

    let hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    let intensity = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    if (hourlyData && hourlyData.length > 0) {
      hours = hourlyData.map(d => d.hour);
      intensity = hourlyData.map(d => d.intensityPercent);
    }

    empUsefulWorkChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: hours,
        datasets: [{
          label: 'Activity Intensity',
          data: intensity,
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37, 99, 235, 0.04)',
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: '#2563EB',
          fill: true,
          tension: 0.25
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `Useful Work: ${ctx.raw}% intensity`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 } }
          },
          y: {
            min: 0,
            max: 100,
            ticks: { stepSize: 25, callback: v => `${v}%`, font: { size: 10 } },
            grid: { color: '#F3F4F6' }
          }
        }
      }
    });
  }

  function renderAppUsage(apps) {
    const tbody = document.getElementById('empAppUsageTbody');
    if (!tbody) return;

    if (!apps || apps.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #6B7280; padding: 1.5rem;">No application usage recorded today.</td></tr>`;
      return;
    }

    tbody.innerHTML = apps.map(app => {
      return `
        <tr>
          <td><strong style="color: #111827;">${app.name}</strong></td>
          <td><strong>${app.duration}</strong></td>
          <td style="color: #6B7280;">${app.category}</td>
          <td style="color: #6B7280; font-size: 0.8125rem;">Last active ${app.lastActive || '—'}</td>
        </tr>
      `;
    }).join('');
  }

  function formatDuration(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours && minutes) return `${hours}h ${minutes}m`;
    if (hours) return `${hours}h`;
    return `${minutes}m`;
  }

})();
