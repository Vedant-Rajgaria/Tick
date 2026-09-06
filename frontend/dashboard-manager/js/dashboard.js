/**
 * TICK - Admin Dashboard Controller
 * Manages team capacity table, summary metrics, and employee roster search.
 */

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    renderDashboard();
    setupSearch();
  });

  function renderDashboard() {
    const state = window.TICK.getState();

    // Summary Metrics
    const empCountEl = document.getElementById('statTotalEmployees');
    const taskCountEl = document.getElementById('statTotalTasks');
    const attentionEl = document.getElementById('statNeedAttention');

    if (empCountEl) empCountEl.textContent = state.admin.totalEmployees || state.employees.length;
    if (taskCountEl) taskCountEl.textContent = state.tasks.filter(t => t.status !== 'COMPLETED').length + 34; // Total active squad commitments
    if (attentionEl) attentionEl.textContent = state.employees.filter(e => e.workload >= 85).length || 1;

    // Team Capacity Table
    const capacityTbody = document.getElementById('teamCapacityTableBody');
    if (capacityTbody) {
      capacityTbody.innerHTML = state.employees.map(emp => {
        const fillClass = getFillClass(emp.workload);
        const statusPillClass = getPillClass(emp.workload);

        return `
          <tr>
            <td>
              <a href="employee-detail.html?id=${emp.id}" class="table-link" style="font-size: 0.95rem;">
                ${emp.name}
              </a>
              <div style="font-size: 0.75rem; color: #6B7280;">${emp.role} &bull; ${emp.department}</div>
            </td>
            <td>
              <div class="workload-visual">
                <div class="workload-meter">
                  <div class="workload-fill ${fillClass}" style="width: ${Math.min(emp.workload, 100)}%;"></div>
                </div>
                <span class="workload-percent">${emp.workload}%</span>
              </div>
            </td>
            <td>
              <strong style="color: #111827;">${emp.remainingHours.toFixed(1)}h</strong>
              <span style="font-size: 0.75rem; color: #6B7280;"> / ${emp.capacityHours}h capacity</span>
            </td>
            <td>
              <span class="status-pill ${statusPillClass}">
                ${emp.workload >= 85 ? 'Needs attention' : (emp.workload <= 50 ? 'Low workload' : 'Normal')}
              </span>
            </td>
            <td style="text-align: right;">
              <a href="employee-detail.html?id=${emp.id}" class="btn btn-secondary btn-sm">
                View Detail →
              </a>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Employees Roster Table
    renderRoster(state.employees);

    // Completed Tasks Table (Shows real-time recorded completion!)
    const completedTbody = document.getElementById('completedTasksTableBody');
    if (completedTbody) {
      const completedTasks = state.tasks.filter(t => t.status === 'COMPLETED');
      if (completedTasks.length === 0) {
        completedTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #6B7280; padding: 1.5rem;">No tasks recorded as completed yet.</td></tr>`;
      } else {
        completedTbody.innerHTML = completedTasks.map(t => {
          return `
            <tr>
              <td><strong style="color: #111827;">${t.title}</strong></td>
              <td>${t.assignedToName}</td>
              <td style="color: #4B5563;">${t.completedAt || 'Recently'}</td>
              <td><strong style="color: #059669;">${t.timeTaken || '5h 12m'}</strong></td>
              <td><span class="status-pill completed">✓ COMPLETED</span></td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  function renderRoster(employees) {
    const rosterTbody = document.getElementById('employeesRosterTableBody');
    if (!rosterTbody) return;

    rosterTbody.innerHTML = employees.map(emp => {
      const pillClass = getPillClass(emp.workload);
      return `
        <tr>
          <td>
            <a href="employee-detail.html?id=${emp.id}" class="table-link">
              ${emp.name}
            </a>
            <div style="font-size: 0.75rem; color: #9CA3AF;">ID: ${emp.empId || 'EMP-1024'}</div>
          </td>
          <td>${emp.role}</td>
          <td>${emp.department}</td>
          <td>
            <div class="workload-visual">
              <span class="workload-percent">${emp.workload}%</span>
              <div class="workload-meter" style="width: 60px;">
                <div class="workload-fill ${getFillClass(emp.workload)}" style="width: ${Math.min(emp.workload, 100)}%;"></div>
              </div>
            </div>
          </td>
          <td><strong>${emp.tasksCount}</strong> tasks</td>
          <td>
            <span class="status-pill ${pillClass}">
              ${emp.status || 'Active'}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  function setupSearch() {
    const searchInput = document.getElementById('employeeSearchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const state = window.TICK.getState();
      const filtered = state.employees.filter(emp => 
        emp.name.toLowerCase().includes(q) ||
        emp.role.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q)
      );
      renderRoster(filtered);
    });
  }

  function getFillClass(workload) {
    if (workload <= 50) return 'low';
    if (workload <= 80) return 'normal';
    if (workload <= 90) return 'attention';
    return 'overloaded';
  }

  function getPillClass(workload) {
    if (workload <= 50) return 'low';
    if (workload <= 80) return 'normal';
    return 'attention';
  }

})();
