/**
 * TIC Employee Activity Controller
 * Manages work-pattern observations, application usage charts, and session breakdowns.
 */

(function(window) {
  'use strict';

  let appUsageChart = null;
  let appCategoryChart = null;

  function init() {
    renderActivityMetrics();
    renderAppUsageList();
    renderCharts();
  }

  function renderActivityMetrics() {
    const state = window.TIC_API.getState();
    const emp = state.currentEmployee;

    const activeEl = document.getElementById('actActiveTime');
    const idleEl = document.getElementById('actIdleTime');
    const ratioEl = document.getElementById('actRatio');
    const switchEl = document.getElementById('actSwitches');
    const sessionsEl = document.getElementById('actSessions');
    const avgSessionEl = document.getElementById('actAvgSession');

    if (activeEl) activeEl.textContent = "5h 42m";
    if (idleEl) idleEl.textContent = "48m";
    if (ratioEl) ratioEl.textContent = `${emp.activeRatio}%`;
    if (switchEl) switchEl.textContent = emp.contextSwitches;
    if (sessionsEl) sessionsEl.textContent = emp.sessions;
    if (avgSessionEl) avgSessionEl.textContent = `${emp.averageSessionMins}m`;

    // Eye tracking / advanced non-webcam observational placeholders
    const focusEl = document.getElementById('actFocusDuration');
    const gazeEl = document.getElementById('actGazeBreaks');
    if (focusEl) focusEl.textContent = "20m 50s";
    if (gazeEl) gazeEl.textContent = `${emp.gazeBreaks}`;
  }

  function renderAppUsageList() {
    const state = window.TIC_API.getState();
    const container = document.getElementById('appUsageListContainer');
    if (!container) return;

    container.innerHTML = state.appUsage.map(app => {
      return `
        <div class="app-list-item">
          <div class="app-meta">
            <span class="app-color-bullet" style="background-color: ${app.color};"></span>
            <div>
              <div class="app-name">${app.name}</div>
              <div class="app-category">${app.category.replace('_', ' ').toUpperCase()} • ${app.percentage}% of total</div>
            </div>
          </div>
          <div class="app-time">${app.time}</div>
        </div>
      `;
    }).join('');
  }

  function renderCharts() {
    renderAppUsageBarChart();
    renderAppCategoryDoughnutChart();
  }

  function renderAppUsageBarChart() {
    const canvas = document.getElementById('appUsageChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (appUsageChart) {
      appUsageChart.destroy();
    }

    const state = window.TIC_API.getState();
    const labels = state.appUsage.map(a => a.name);
    const dataMins = state.appUsage.map(a => a.minutes);
    const colors = state.appUsage.map(a => a.color);

    appUsageChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Usage Duration (minutes)',
          data: dataMins,
          backgroundColor: colors,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx) {
                const mins = ctx.raw;
                const h = Math.floor(mins / 60);
                const m = mins % 60;
                return `Duration: ${h > 0 ? h + 'h ' : ''}${m}m`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { callback: v => `${v}m` },
            grid: { color: '#F1F5F9' }
          },
          y: {
            grid: { display: false }
          }
        }
      }
    });
  }

  function renderAppCategoryDoughnutChart() {
    const canvas = document.getElementById('appCategoryChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (appCategoryChart) {
      appCategoryChart.destroy();
    }

    const state = window.TIC_API.getState();
    const labels = state.categories.map(c => c.name);
    const data = state.categories.map(c => c.percentage);
    const colors = state.categories.map(c => c.color);

    appCategoryChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#FFFFFF'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              font: { size: 11 }
            }
          },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.raw}%`
            }
          }
        }
      }
    });
  }

  window.TIC_Activity = {
    init,
    renderCharts
  };

})(window);
