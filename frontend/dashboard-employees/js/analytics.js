/**
 * TIC Employee Analytics Controller
 * Handles historical trend charts, workload history, and time filters.
 */

(function(window) {
  'use strict';

  let activityTrendChart = null;
  let workloadHistoryChart = null;
  let sessionDurationChart = null;
  let currentPeriod = 'week';

  function init() {
    setupTimeFilterListeners();
    renderCharts();
  }

  function setupTimeFilterListeners() {
    const periodButtons = document.querySelectorAll('#analyticsPeriodTabs .filter-pill');
    periodButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        periodButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPeriod = btn.getAttribute('data-period') || 'week';
        renderCharts();
      });
    });
  }

  function renderCharts() {
    renderActivityTrendChart();
    renderWorkloadHistoryChart();
    renderSessionDurationChart();
  }

  function renderActivityTrendChart() {
    const canvas = document.getElementById('analyticsActivityTrendChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (activityTrendChart) {
      activityTrendChart.destroy();
    }

    const labels = currentPeriod === 'today' 
      ? ['09:00', '11:00', '13:00', '15:00', '17:00']
      : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

    const activeData = currentPeriod === 'today'
      ? [50, 48, 25, 52, 45]
      : [5.2, 5.8, 6.1, 6.4, 5.7];

    const idleData = currentPeriod === 'today'
      ? [10, 12, 35, 8, 15]
      : [0.8, 0.9, 0.7, 1.1, 0.8];

    activityTrendChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Active Input (Hours)',
            data: activeData,
            borderColor: '#4F46E5',
            backgroundColor: 'rgba(79, 70, 229, 0.08)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointRadius: 4,
            pointBackgroundColor: '#4F46E5'
          },
          {
            label: 'No-input / Idle Interval (Hours)',
            data: idleData,
            borderColor: '#94A3B8',
            backgroundColor: 'rgba(148, 163, 184, 0.05)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            borderDash: [4, 4],
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' },
          tooltip: {
            callbacks: {
              afterLabel: ctx => ctx.datasetIndex === 1 ? 'Observational intervals without input' : 'Active work sessions'
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: v => `${v}h` },
            grid: { color: '#F1F5F9' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderWorkloadHistoryChart() {
    const canvas = document.getElementById('analyticsWorkloadHistoryChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (workloadHistoryChart) {
      workloadHistoryChart.destroy();
    }

    // Workload history as requested in specs:
    // Monday 52%, Tuesday 61%, Wednesday 58%, Thursday 72%, Friday 62%
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const percentages = [52, 61, 58, 72, 62];
    const colors = percentages.map(p => {
      if (p <= 50) return '#10B981';
      if (p <= 80) return '#0284C7';
      if (p <= 100) return '#F59E0B';
      return '#EF4444';
    });

    workloadHistoryChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: days,
        datasets: [{
          label: 'Workload % (Capacity Utilization)',
          data: percentages,
          backgroundColor: colors,
          borderRadius: 6,
          barPercentage: 0.6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `Workload: ${ctx.raw}% (${window.TIC_API.getWorkloadClassification(ctx.raw).label})`
            }
          }
        },
        scales: {
          y: {
            max: 100,
            ticks: { callback: v => `${v}%` },
            grid: { color: '#F1F5F9' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderSessionDurationChart() {
    const canvas = document.getElementById('analyticsSessionDurationChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (sessionDurationChart) {
      sessionDurationChart.destroy();
    }

    const sessionLabels = ['Session 1', 'Session 2', 'Session 3', 'Session 4', 'Session 5', 'Session 6', 'Session 7'];
    const sessionMins = [45, 60, 52, 35, 70, 40, 30];

    sessionDurationChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: sessionLabels,
        datasets: [{
          label: 'Session Duration (Minutes)',
          data: sessionMins,
          borderColor: '#06B6D4',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          fill: true,
          tension: 0.3,
          borderWidth: 2.5,
          pointRadius: 4,
          pointBackgroundColor: '#06B6D4'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: {
            ticks: { callback: v => `${v}m` },
            grid: { color: '#F1F5F9' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  window.TIC_Analytics = {
    init,
    renderCharts
  };

})(window);
