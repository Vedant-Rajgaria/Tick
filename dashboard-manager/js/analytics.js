/**
 * TIC Manager Team Analytics Controller
 * Handles team capacity forecast, workload distribution, and historical team charts.
 */

(function(window) {
  'use strict';

  let workloadDistributionChart = null;
  let capacityForecastChart = null;
  let tasksVelocityChart = null;

  function init() {
    renderCharts();
  }

  function renderCharts() {
    renderWorkloadDistributionChart();
    renderCapacityForecastChart();
    renderTasksVelocityChart();
  }

  function renderWorkloadDistributionChart() {
    const canvas = document.getElementById('mgrWorkloadDistChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (workloadDistributionChart) {
      workloadDistributionChart.destroy();
    }

    // Number of engineers in each workload bucket
    const buckets = ['LOW (0-50%)', 'NORMAL (50-80%)', 'HIGH (80-100%)', 'OVERLOADED (>100%)'];
    const counts = [1, 2, 1, 0]; // Sarah (LOW), Sam & John (NORMAL), Alex (HIGH)
    const colors = ['#10B981', '#0284C7', '#F59E0B', '#EF4444'];

    workloadDistributionChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: buckets,
        datasets: [{
          label: 'Number of Engineers',
          data: counts,
          backgroundColor: colors,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `${ctx.raw} engineer(s) in this capacity threshold`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 },
            grid: { color: '#F1F5F9' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderCapacityForecastChart() {
    const canvas = document.getElementById('mgrCapacityForecastChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (capacityForecastChart) {
      capacityForecastChart.destroy();
    }

    // Next 4 weeks capacity forecast
    const weeks = ['Current Week', 'Week +1 (Sep 14)', 'Week +2 (Sep 21)', 'Week +3 (Sep 28)'];
    const available = [180, 180, 180, 180];
    const assigned = [162, 140, 95, 40];

    capacityForecastChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: weeks,
        datasets: [
          {
            label: 'Assigned Work (Hours)',
            data: assigned,
            backgroundColor: '#4F46E5',
            borderRadius: 4
          },
          {
            label: 'Total Available Capacity (Hours)',
            data: available,
            backgroundColor: '#CBD5E1',
            borderRadius: 4
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
              afterBody: function(items) {
                const idx = items[0].dataIndex;
                const spare = available[idx] - assigned[idx];
                return `Expected Spare Capacity: ${spare}h`;
              }
            }
          }
        },
        scales: {
          y: {
            max: 200,
            ticks: { callback: v => `${v}h` },
            grid: { color: '#F1F5F9' }
          },
          x: { grid: { display: false } }
        }
      }
    });
  }

  function renderTasksVelocityChart() {
    const canvas = document.getElementById('mgrTasksVelocityChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (tasksVelocityChart) {
      tasksVelocityChart.destroy();
    }

    tasksVelocityChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['Completed', 'In Progress', 'To Do', 'Blocked', 'Overdue'],
        datasets: [{
          data: [18, 12, 6, 2, 0],
          backgroundColor: ['#10B981', '#4F46E5', '#64748B', '#DC2626', '#7C3AED'],
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
            position: 'right',
            labels: { boxWidth: 10, font: { size: 11 } }
          }
        }
      }
    });
  }

  window.TIC_ManagerAnalytics = {
    init,
    renderCharts
  };

})(window);
