/**
 * TICK - Employee Detail Controller
 * Fully dynamic: fetches real employee profile, activity telemetry, work pulse,
 * hourly intensity, and application usage from the backend.
 */

(function() {
  'use strict';

  const API_BASE = "http://localhost:8000/api/v1";
  const TOKEN_KEY = "tick_access_token";

  let usefulWorkChart = null;
  let currentEmployeeId = null;
  let loadedEmployeeName = '';

  document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      window.location.href = 'login.html';
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    currentEmployeeId = urlParams.get('id');
    if (!currentEmployeeId) {
      window.location.href = 'index.html';
      return;
    }

    const calendarInput = document.getElementById('calendarDateInput');
    const paramDate = urlParams.get('date');
    if (paramDate && calendarInput) {
      calendarInput.value = paramDate;
    }

    setupLogout();
    updateHeaderDate();
    fetchAdminProfile(token);
    setupDatePicker(token);
    setupDeleteEmployee(token);

    const initialDate = calendarInput ? calendarInput.value : (paramDate || '');
    loadEmployeeData(token, initialDate);
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
      dateEl.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }

  function fetchAdminProfile(token) {
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Unauthorized');
        return res.json();
      })
      .then(user => {
        localStorage.setItem('tick_user', JSON.stringify(user));

        const nameEl = document.getElementById('adminSidebarName');
        const roleEl = document.getElementById('adminSidebarRole');
        const metaEl = document.getElementById('adminSidebarMeta');
        if (nameEl) nameEl.textContent = user.name;
        if (roleEl) roleEl.textContent = `${user.role || 'Manager'} Workspace`;
        if (metaEl) metaEl.textContent = `${user.department || 'Management'} • ${user.organization || 'TICK'}`;
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('tick_user');
        window.location.href = 'login.html';
      });
  }

  function loadEmployeeData(token, dateStr) {
    let empUrl = `${API_BASE}/manager/employees/${currentEmployeeId}`;
    if (dateStr) {
      empUrl += `?date=${encodeURIComponent(dateStr)}`;
    }

    // Concurrently fetch employee details, team overview (for baseline workload), and assigned tasks
    Promise.all([
      fetch(empUrl, { headers: { Authorization: `Bearer ${token}` } }).then(res => {
        if (!res.ok) throw new Error('Failed to load employee details');
        return res.json();
      }),
      fetch(`${API_BASE}/manager/team`, { headers: { Authorization: `Bearer ${token}` } }).then(res => {
        return res.ok ? res.json() : { members: [] };
      }).catch(() => ({ members: [] })),
      fetch(`${API_BASE}/manager/tasks`, { headers: { Authorization: `Bearer ${token}` } }).then(res => {
        return res.ok ? res.json() : [];
      }).catch(() => [])
    ])
      .then(([empData, teamData, tasksData]) => {
        renderProfileHeader(empData);

        const member = (teamData.members || []).find(m => String(m.id) === String(currentEmployeeId));
        const baselineWorkload = member ? member.workload : null;

        renderMetricsAndTelemetry(empData.dashboard, dateStr, baselineWorkload);

        const empTasks = (tasksData || []).filter(t => String(t.assigned_to) === String(currentEmployeeId));
        renderEmployeeTasks(empTasks);
      })
      .catch(err => {
        console.error('[TICK] Error loading employee:', err);
        alert('Could not load employee details.');
      });
  }

  function renderProfileHeader(emp) {
    const headerName = document.getElementById('headerEmpName');
    const profileName = document.getElementById('profileName');
    const roleDept = document.getElementById('profileRoleDept');
    const statusBadge = document.getElementById('profileStatusBadge');
    const empId = document.getElementById('profileEmpId');

    if (headerName) headerName.textContent = emp.name;
    if (profileName) profileName.textContent = emp.name;
    if (roleDept) roleDept.textContent = `${emp.role} • ${emp.department}`;
    if (statusBadge) statusBadge.textContent = emp.status || 'Active';
    if (empId) empId.textContent = emp.email ? emp.email : `ID: EMP-${emp.id}`;
    loadedEmployeeName = emp.name;
  }

  function renderMetricsAndTelemetry(dashboard, dateStr, baselineWorkload) {
    if (!dashboard) dashboard = {};

    const activeSec = dashboard.activeSeconds || 0;
    const idleSec = dashboard.idleSeconds || 0;
    const totalSec = activeSec + idleSec;
    const sessionCount = dashboard.sessionCount || 0;

    let workload = 0;
    if (activeSec > 0) {
      workload = Math.min(100, Math.round((activeSec / 28800) * 100));
    } else if (baselineWorkload !== null && baselineWorkload !== undefined) {
      workload = baselineWorkload;
    }

    const rangeText = document.getElementById('timeframeRangeText');
    if (rangeText) {
      rangeText.textContent = dateStr ? `Filtered to: ${dateStr}` : 'All-time activity cadence';
    }

    const workloadEl = document.getElementById('detailWorkload');
    const activeTimeEl = document.getElementById('detailActiveTime');
    const idleTimeEl = document.getElementById('detailIdleTime');
    const tasksCountEl = document.getElementById('detailTasksCount');

    if (workloadEl) workloadEl.textContent = `${workload}%`;
    if (activeTimeEl) activeTimeEl.textContent = formatDuration(activeSec);
    if (idleTimeEl) idleTimeEl.textContent = formatDuration(idleSec);
    if (tasksCountEl) tasksCountEl.textContent = sessionCount;

    const bActive = document.getElementById('breakdownActiveTime');
    const bIdle = document.getElementById('breakdownIdleTime');
    const bTotal = document.getElementById('breakdownTotalSession');
    const bRatio = document.getElementById('breakdownActiveRatio');
    const bNote = document.getElementById('breakdownObsNote');

    if (bActive) bActive.textContent = formatDuration(activeSec);
    if (bIdle) bIdle.textContent = formatDuration(idleSec);
    if (bTotal) bTotal.textContent = formatDuration(totalSec);
    if (bRatio) bRatio.textContent = totalSec > 0 ? `${Math.round((activeSec / totalSec) * 100)}%` : '0%';
    if (bNote) {
      bNote.textContent = sessionCount > 0 
        ? `${sessionCount} application session(s) recorded for this timeframe.`
        : 'No telemetry recorded for this timeframe.';
    }

    renderWorkPulse(dashboard.workPulse || []);
    renderUsefulWorkGraph(dashboard.hourlyActivity || []);
    renderAppUsage(dashboard.applications || []);
  }

  function renderWorkPulse(segments) {
    const container = document.getElementById('workPulseContainer');
    const emptyState = document.getElementById('workPulseEmptyState');
    const bar = document.getElementById('workPulseBar');
    const tooltip = document.getElementById('pulseTooltip');
    const tooltipApp = document.getElementById('tooltipApp');
    const tooltipMeta = document.getElementById('tooltipMeta');

    if (!bar) return;

    if (!segments || segments.length === 0) {
      if (container) container.style.display = 'none';
      if (emptyState) {
        emptyState.style.display = 'block';
        const emptyDesc = emptyState.querySelector('.empty-data-desc');
        if (emptyDesc) emptyDesc.textContent = 'No work pulse sessions recorded for this timeframe.';
      }
      return;
    }

    if (container) container.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    bar.innerHTML = segments.map((seg, idx) => {
      return `
        <div class="pulse-segment ${seg.type}" 
             data-index="${idx}"
             style="width: ${seg.width};"
             title="${seg.app} (${seg.duration})">
        </div>
      `;
    }).join('');

    const segEls = bar.querySelectorAll('.pulse-segment');
    segEls.forEach(el => {
      el.addEventListener('mouseenter', () => {
        const idx = parseInt(el.getAttribute('data-index'), 10);
        const seg = segments[idx];
        if (!seg || !tooltip) return;

        if (tooltipApp) tooltipApp.textContent = `Application: ${seg.app}`;
        if (tooltipMeta) tooltipMeta.textContent = `Start: ${seg.start} • End: ${seg.end} • Duration: ${seg.duration}`;

        const rect = el.getBoundingClientRect();
        const parentRect = bar.getBoundingClientRect();
        const leftPos = rect.left - parentRect.left + (rect.width / 2) - 80;

        tooltip.style.left = `${Math.max(10, Math.min(leftPos, parentRect.width - 240))}px`;
        tooltip.classList.add('visible');
      });

      el.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.classList.remove('visible');
      });
    });
  }

  function renderUsefulWorkGraph(hourlyData) {
    const canvas = document.getElementById('usefulWorkChart');
    const container = document.getElementById('usefulWorkChartContainer');
    const emptyState = document.getElementById('usefulWorkEmptyState');

    if (!canvas) return;

    if (usefulWorkChart) {
      usefulWorkChart.destroy();
      usefulWorkChart = null;
    }

    const hasData = hourlyData && hourlyData.length > 0 && hourlyData.some(d => (d.intensityPercent || 0) > 0);

    if (!hasData) {
      if (container) container.style.display = 'none';
      if (emptyState) emptyState.style.display = 'flex';
      return;
    }

    if (container) container.style.display = 'block';
    if (emptyState) emptyState.style.display = 'none';

    if (typeof Chart === 'undefined') {
      console.warn('[TICK] Chart.js not loaded');
      return;
    }

    const labels = hourlyData.map(d => d.hour);
    const dataPoints = hourlyData.map(d => d.intensityPercent || 0);

    usefulWorkChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Activity Intensity',
          data: dataPoints,
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 6,
          pointBackgroundColor: '#2563EB',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `Activity: ${ctx.raw}% intensity`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#6B7280' }
          },
          y: {
            min: 0,
            max: 100,
            ticks: { stepSize: 25, callback: v => `${v}%`, font: { size: 10 }, color: '#6B7280' },
            grid: { color: '#F3F4F6' }
          }
        }
      }
    });
  }

  function renderAppUsage(apps) {
    const tbody = document.getElementById('appUsageTableBody');
    if (!tbody) return;

    if (!apps || apps.length === 0) {
      tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #6B7280; padding: 1.5rem;">No application usage recorded for this timeframe.</td></tr>`;
      return;
    }

    tbody.innerHTML = apps.map(app => {
      return `
        <tr>
          <td><strong style="color: #111827;">${app.name}</strong></td>
          <td><strong>${app.duration}</strong></td>
          <td style="color: #6B7280;">${app.lastActive || '—'}</td>
        </tr>
      `;
    }).join('');
  }

  function renderEmployeeTasks(tasks) {
    const tbody = document.getElementById('employeeTasksTableBody');
    if (!tbody) return;

    if (!tasks || tasks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #6B7280; padding: 1.5rem;">No tasks currently assigned to this employee.</td></tr>`;
      return;
    }

    tbody.innerHTML = tasks.map(task => {
      const priority = (task.priority || 'MEDIUM').toUpperCase();
      const status = (task.status || 'TODO').toUpperCase();
      const isHigh = priority === 'HIGH';
      const isDone = status === 'COMPLETED';
      const inProgress = status === 'IN_PROGRESS';

      return `
        <tr>
          <td><strong style="color: #111827;">${escapeHtml(task.title)}</strong></td>
          <td>
            <span class="status-pill ${isHigh ? 'attention' : 'normal'}">
              ${escapeHtml(priority)}
            </span>
          </td>
          <td>${task.estimated_hours ? task.estimated_hours + ' hrs' : '—'}</td>
          <td>${escapeHtml(task.deadline || '—')}</td>
          <td>
            <span class="status-pill ${isDone ? 'low' : (inProgress ? 'normal' : 'attention')}">
              ${escapeHtml(status)}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  function setupDatePicker(token) {
    const calendarInput = document.getElementById('calendarDateInput');
    const btnToday = document.getElementById('btnToday');
    const btnYesterday = document.getElementById('btnYesterday');
    const prevBtn = document.getElementById('prevDayBtn');
    const nextBtn = document.getElementById('nextDayBtn');

    const todayObj = new Date();
    const todayStr = todayObj.toISOString().split('T')[0];
    const todayFormatted = todayObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    if (btnToday) {
      btnToday.textContent = `Today (${todayFormatted})`;
      btnToday.addEventListener('click', () => {
        if (calendarInput) calendarInput.value = todayStr;
        loadEmployeeData(token, todayStr);
      });
    }

    if (btnYesterday) {
      btnYesterday.addEventListener('click', () => {
        const y = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (calendarInput) calendarInput.value = y;
        loadEmployeeData(token, y);
      });
    }

    if (calendarInput) {
      calendarInput.addEventListener('change', (e) => {
        loadEmployeeData(token, e.target.value);
      });
    }

    if (prevBtn && calendarInput) {
      prevBtn.addEventListener('click', () => {
        const current = new Date(calendarInput.value || todayStr);
        current.setDate(current.getDate() - 1);
        const prev = current.toISOString().split('T')[0];
        calendarInput.value = prev;
        loadEmployeeData(token, prev);
      });
    }

    if (nextBtn && calendarInput) {
      nextBtn.addEventListener('click', () => {
        const current = new Date(calendarInput.value || todayStr);
        current.setDate(current.getDate() + 1);
        const next = current.toISOString().split('T')[0];
        calendarInput.value = next;
        loadEmployeeData(token, next);
      });
    }
  }

  function formatDuration(totalSeconds) {
    totalSeconds = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours && minutes) return `${hours}h ${minutes}m`;
    if (hours) return `${hours}h`;
    return `${minutes}m`;
  }

  function setupDeleteEmployee(token) {
    const deleteBtn = document.getElementById('deleteEmployeeBtn');
    const modal = document.getElementById('deleteConfirmModal');
    const closeBtn = document.getElementById('closeDeleteModalBtn');
    const cancelBtn = document.getElementById('cancelDeleteBtn');
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    const modalEmpName = document.getElementById('deleteModalEmpName');

    if (!modal) return;

    function openModal() {
      if (modalEmpName) modalEmpName.textContent = loadedEmployeeName || `Employee #${currentEmployeeId}`;
      modal.classList.add('active');
    }

    function closeModal() {
      modal.classList.remove('active');
    }

    if (deleteBtn) deleteBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        // Immediately dismiss the modal from the screen
        closeModal();

        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Deleting...';

        fetch(`${API_BASE}/manager/employees/${currentEmployeeId}`, {
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
            alert(data.message || 'Employee account permanently deleted.');
            window.location.href = 'index.html';
          })
          .catch(err => {
            console.error('[TICK] Delete error:', err);
            alert(`Error deleting employee: ${err.message}`);
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Yes, Delete Account Permanently';
          });
      });
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
