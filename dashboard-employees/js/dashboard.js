/**
 * TICK - Employee Dashboard Controller
 * Handles employee Work Pulse timeline, useful work graph, and application stats.
 */

(function() {
  'use strict';

  let empUsefulWorkChart = null;

  document.addEventListener('DOMContentLoaded', () => {
    initEmployeeDashboard();
  });

  function initEmployeeDashboard() {
    const state = window.TICK.getState();

    // Render Work Pulse
    renderWorkPulse(state.workPulse);

    // Render Useful Work Graph
    renderUsefulWorkGraph();

    // Render Application Usage
    renderAppUsage(state.applications);
  }

  function renderWorkPulse(segments) {
    const container = document.getElementById('empWorkPulseBar');
    const tooltip = document.getElementById('empPulseTooltip');
    const tooltipApp = document.getElementById('empTooltipApp');
    const tooltipMeta = document.getElementById('empTooltipMeta');

    if (!container || !segments) return;

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
      el.addEventListener('mouseenter', (e) => {
        const idx = parseInt(el.getAttribute('data-index'), 10);
        const seg = segments[idx];
        if (!seg) return;

        tooltipApp.textContent = `Application: ${seg.app}`;
        tooltipMeta.textContent = `Start: ${seg.start} • End: ${seg.end} • Duration: ${seg.duration}`;
        
        const rect = el.getBoundingClientRect();
        const parentRect = container.getBoundingClientRect();
        const leftPos = rect.left - parentRect.left + (rect.width / 2) - 80;
        
        tooltip.style.left = `${Math.max(10, Math.min(leftPos, parentRect.width - 240))}px`;
        tooltip.classList.add('visible');
      });

      el.addEventListener('mouseleave', () => {
        tooltip.classList.remove('visible');
      });

      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-index'), 10);
        const seg = segments[idx];
        window.TICK.showToast(`Session: ${seg.app} (${seg.start} - ${seg.end})`);
      });
    });
  }

  function renderUsefulWorkGraph() {
    const canvas = document.getElementById('empUsefulWorkChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (empUsefulWorkChart) empUsefulWorkChart.destroy();

    const hours = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    const intensity = [42, 80, 86, 38, 15, 76, 90, 72, 84, 30];

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
    if (!tbody || !apps) return;

    tbody.innerHTML = apps.map(app => {
      return `
        <tr>
          <td><strong style="color: #111827;">${app.name}</strong></td>
          <td><strong>${app.duration}</strong></td>
          <td style="color: #6B7280;">${app.category}</td>
          <td style="color: #6B7280; font-size: 0.8125rem;">Last active ${app.lastActive}</td>
        </tr>
      `;
    }).join('');
  }

})();
