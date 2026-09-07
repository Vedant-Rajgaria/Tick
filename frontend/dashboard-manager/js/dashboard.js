/**
 * TICK - Admin Dashboard Controller
 * Fetches real organization, admin profile, and team members from the backend.
 */

(function() {
  'use strict';

  const API_BASE = "http://localhost:8000/api/v1";
  const TOKEN_KEY = "tick_access_token";

  let teamMembers = [];

  document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      window.location.href = 'login.html';
      return;
    }

    setupLogout();
    updateHeaderDate();
    fetchAdminProfile(token);
    setupSearch();
    setupDeleteModal(token);
  });

  function setupLogout() {
    const logoutLink = document.getElementById('logoutLink');
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
      const options = { month: 'short', day: 'numeric', year: 'numeric' };
      dateEl.textContent = new Date().toLocaleDateString('en-US', options);
    }
  }

  function fetchAdminProfile(token) {
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load admin profile');
        return res.json();
      })
      .then(user => {
        const nameEl = document.getElementById('adminSidebarName');
        const roleEl = document.getElementById('adminSidebarRole');
        const metaEl = document.getElementById('adminSidebarMeta');
        const badgeEl = document.getElementById('topHeaderBadge');

        if (nameEl) nameEl.textContent = user.name;
        if (roleEl) roleEl.textContent = `${user.role || 'Manager'} Workspace`;
        if (badgeEl) badgeEl.textContent = user.role || 'Manager';
        if (metaEl) {
          const dept = user.department || 'Management';
          const org = user.organization || 'TICK';
          metaEl.textContent = `${dept} • ${org}`;
        }

        localStorage.setItem('tick_user', JSON.stringify(user));

        // Authenticated as Manager/Admin -> safely load team data
        fetchTeamData(token);
      })
      .catch(err => {
        console.error('[TICK] Error fetching profile:', err);
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('tick_user');
        window.location.href = 'login.html';
      });
  }

  function fetchTeamData(token) {
    fetch(`${API_BASE}/manager/team`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load team data');
        return res.json();
      })
      .then(data => {
        teamMembers = data.members || [];
        renderSummaryMetrics(teamMembers);
        renderTeamCapacity(teamMembers);
        renderRoster(teamMembers);
        renderTasksPlaceholder();
      })
      .catch(err => {
        console.error('[TICK] Error fetching team:', err);
        const capacityTbody = document.getElementById('teamCapacityTableBody');
        if (capacityTbody) {
          capacityTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #DC2626; padding: 1.5rem;">Failed to load team data from backend. Please refresh or check connection.</td></tr>`;
        }
      });
  }

  function renderSummaryMetrics(members) {
    const empCountEl = document.getElementById('statTotalEmployees');
    const sessionCountEl = document.getElementById('statTotalSessions');
    const attentionEl = document.getElementById('statNeedAttention');

    if (empCountEl) empCountEl.textContent = members.length;
    if (sessionCountEl) {
      const totalSessions = members.reduce((acc, m) => acc + (m.sessionCount || 0), 0);
      sessionCountEl.textContent = totalSessions;
    }
    if (attentionEl) {
      const attentionCount = members.filter(m => (m.workload || 0) >= 85).length;
      attentionEl.textContent = attentionCount;
    }
  }

  function renderTeamCapacity(members) {
    const capacityTbody = document.getElementById('teamCapacityTableBody');
    if (!capacityTbody) return;

    if (members.length === 0) {
      capacityTbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #6B7280; padding: 2rem;">
            No employees added yet. Use <a href="add-employee.html" style="color: #2563EB; font-weight: 600;">Add Employee</a> to register team members.
          </td>
        </tr>
      `;
      return;
    }

    capacityTbody.innerHTML = members.map(emp => {
      const workload = emp.workload || 0;
      const fillClass = getFillClass(workload);
      const statusPillClass = getPillClass(workload);
      const remaining = typeof emp.remainingHours === 'number' ? emp.remainingHours.toFixed(1) : '8.0';
      const capacity = typeof emp.capacityHours === 'number' ? emp.capacityHours.toFixed(0) : '8';

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
                <div class="workload-fill ${fillClass}" style="width: ${Math.min(workload, 100)}%;"></div>
              </div>
              <span class="workload-percent">${workload}%</span>
            </div>
          </td>
          <td>
            <strong style="color: #111827;">${remaining}h</strong>
            <span style="font-size: 0.75rem; color: #6B7280;"> / ${capacity}h capacity</span>
          </td>
          <td>
            <span class="status-pill ${statusPillClass}">
              ${emp.status || 'Active'}
            </span>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; align-items: center; gap: 0.4rem; justify-content: flex-end;">
              <a href="employee-detail.html?id=${emp.id}" class="btn btn-secondary btn-sm">
                View Detail →
              </a>
              <button type="button" class="btn btn-danger btn-sm delete-roster-btn" data-id="${emp.id}" data-name="${emp.name}" title="Delete Account" style="font-weight: 600;">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderRoster(members) {
    const rosterTbody = document.getElementById('employeesRosterTableBody');
    if (!rosterTbody) return;

    if (members.length === 0) {
      rosterTbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; color: #6B7280; padding: 2rem;">
            No employees registered yet.
          </td>
        </tr>
      `;
      return;
    }

    rosterTbody.innerHTML = members.map(emp => {
      const workload = emp.workload || 0;
      const pillClass = getPillClass(workload);

      return `
        <tr>
          <td>
            <a href="employee-detail.html?id=${emp.id}" class="table-link">
              ${emp.name}
            </a>
            <div style="font-size: 0.75rem; color: #9CA3AF;">${emp.email || `ID: EMP-${emp.id}`}</div>
          </td>
          <td>${emp.role}</td>
          <td>${emp.department}</td>
          <td>
            <div class="workload-visual">
              <span class="workload-percent">${workload}%</span>
              <div class="workload-meter" style="width: 60px;">
                <div class="workload-fill ${getFillClass(workload)}" style="width: ${Math.min(workload, 100)}%;"></div>
              </div>
            </div>
          </td>
          <td><strong>${emp.sessionCount || 0}</strong> sessions</td>
          <td>
            <span class="status-pill ${pillClass}">
              ${emp.status || 'Active'}
            </span>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; align-items: center; gap: 0.4rem; justify-content: flex-end;">
              <a href="employee-detail.html?id=${emp.id}" class="btn btn-secondary btn-sm">
                View
              </a>
              <button type="button" class="btn btn-danger btn-sm delete-roster-btn" data-id="${emp.id}" data-name="${emp.name}" title="Delete Account" style="font-weight: 600;">
                Delete
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderTasksPlaceholder() {
    const completedTbody = document.getElementById('completedTasksTableBody');
    if (completedTbody) {
      completedTbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; color: #6B7280; padding: 1.5rem;">
            Task manager module is inactive.
          </td>
        </tr>
      `;
    }
  }

  function setupSearch() {
    const searchInput = document.getElementById('employeeSearchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = teamMembers.filter(emp => 
        (emp.name && emp.name.toLowerCase().includes(q)) ||
        (emp.role && emp.role.toLowerCase().includes(q)) ||
        (emp.department && emp.department.toLowerCase().includes(q)) ||
        (emp.email && emp.email.toLowerCase().includes(q))
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

  function setupDeleteModal(token) {
    const modal = document.getElementById('deleteConfirmModal');
    const closeBtn = document.getElementById('closeDeleteModalBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const modalEmpName = document.getElementById('deleteModalEmpName');

    let employeeToDeleteId = null;

    if (!modal) return;

    function openModal(id, name) {
      employeeToDeleteId = id;
      if (modalEmpName) modalEmpName.textContent = name || `Employee #${id}`;
      modal.classList.add('active');
    }

    function closeModal() {
      employeeToDeleteId = null;
      modal.classList.remove('active');
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.delete-roster-btn');
      if (btn) {
        e.preventDefault();
        const id = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        openModal(id, name);
      }
    });

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (!employeeToDeleteId) return;

        const idToDelete = employeeToDeleteId;
        // Immediately close the modal from the screen
        closeModal();

        fetch(`${API_BASE}/manager/employees/${idToDelete}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
          .then(res => {
            if (!res.ok) {
              return res.json().then(d => { throw new Error(d.detail || 'Deletion failed'); });
            }
            return res.json();
          })
          .then(data => {
            fetchTeamData(token);
          })
          .catch(err => {
            console.error('[TICK] Delete error:', err);
            alert(`Error deleting employee: ${err.message}`);
          });
      });
    }
  }

})();
