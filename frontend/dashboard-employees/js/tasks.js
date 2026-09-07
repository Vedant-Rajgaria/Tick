/**
 * TICK - Employee Tasks Controller & Task Completion Flow
 * Fully dynamic: loads assigned tasks from backend and completes tasks via API.
 */

(function() {
  'use strict';

  const API_BASE = "http://localhost:8000/api/v1";
  const TOKEN_KEY = "tick_access_token";

  let pendingTaskId = null;
  let pendingTaskTitle = '';

  document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    fetchAndRenderTasks(token);
    setupModalListeners(token);
  });

  function fetchAndRenderTasks(token) {
    const container = document.getElementById('myTasksContainer');
    if (!container) return;

    fetch(`${API_BASE}/employee/me/tasks`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to load tasks');
        return res.json();
      })
      .then(tasks => {
        renderEmployeeTasks(tasks);
      })
      .catch(err => {
        console.error('[TICK] Error fetching tasks:', err);
        container.innerHTML = `
          <div style="text-align: center; color: #DC2626; padding: 2rem;">
            Failed to load assigned tasks. Please check server connection.
          </div>
        `;
      });
  }

  function renderEmployeeTasks(tasks) {
    const container = document.getElementById('myTasksContainer');
    if (!container) return;

    if (!tasks || tasks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #6B7280; padding: 2.5rem 1rem;">
          <p style="font-weight: 500; font-size: 0.95rem; color: #374151;">No assigned tasks yet.</p>
          <p style="font-size: 0.8125rem; color: #9CA3AF; margin-top: 2px;">Your deliverables will appear here once allocated by your manager.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = tasks.map(task => {
      const isCompleted = task.status === 'COMPLETED';
      const prioClass = (task.priority || 'medium').toLowerCase();
      const statusClass = isCompleted ? 'completed' : 'normal';

      let formattedCompleted = '';
      if (task.completed_at) {
        try {
          const d = new Date(task.completed_at);
          formattedCompleted = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
          formattedCompleted = task.completed_at;
        }
      }

      return `
        <div style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
                <span class="status-pill ${statusClass}">${task.status}</span>
                <span class="priority-tag ${prioClass}">${task.priority || 'NORMAL'}</span>
                ${task.required_skills && task.required_skills.length > 0 ? `
                  <span style="font-size: 0.72rem; color: #4F46E5; background: #EEF2FF; padding: 2px 6px; border-radius: 4px;">
                    ${task.required_skills.join(', ')}
                  </span>
                ` : ''}
              </div>
              
              <h3 style="font-size: 1.05rem; font-weight: 700; color: #111827; margin-bottom: 0.25rem;">
                ${task.title}
              </h3>
              ${task.description ? `<p style="font-size: 0.8125rem; color: #4B5563; margin-bottom: 0.5rem;">${task.description}</p>` : ''}
              
              <div style="font-size: 0.8125rem; color: #6B7280; display: flex; gap: 1.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
                <div><strong>Deadline:</strong> ${task.deadline || 'No deadline'}</div>
                <div><strong>Estimated:</strong> ${task.estimated_hours}h</div>
                ${task.actual_hours ? `<div><strong>Actual Time:</strong> <span style="color: #059669; font-weight: 600;">${task.actual_hours}h</span></div>` : ''}
                ${formattedCompleted ? `<div><strong>Completed:</strong> ${formattedCompleted}</div>` : ''}
              </div>
            </div>

            <div>
              ${!isCompleted ? `
                <button type="button" class="btn btn-secondary btn-sm complete-trigger-btn" data-taskid="${task.id}" data-tasktitle="${task.title}" style="font-weight: 600;">
                  MARK AS COMPLETED
                </button>
              ` : `
                <span class="status-pill completed" style="font-size: 0.8125rem; padding: 4px 10px;">
                  ✓ COMPLETED
                </span>
              `}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click listeners to all complete buttons
    container.querySelectorAll('.complete-trigger-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-taskid'), 10);
        const title = btn.getAttribute('data-tasktitle');
        openCompleteModal(id, title);
      });
    });
  }

  function setupModalListeners(token) {
    const modal = document.getElementById('taskCompleteModal');
    const cancelBtn = document.getElementById('cancelCompleteBtn');
    const confirmBtn = document.getElementById('confirmCompleteBtn');

    if (cancelBtn && modal) {
      cancelBtn.addEventListener('click', () => {
        modal.classList.remove('active');
        pendingTaskId = null;
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
          pendingTaskId = null;
        }
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        if (!pendingTaskId) return;
        executeTaskCompletion(pendingTaskId, token);
      });
    }
  }

  function openCompleteModal(taskId, taskTitle) {
    pendingTaskId = taskId;
    pendingTaskTitle = taskTitle;

    const modal = document.getElementById('taskCompleteModal');
    const desc = document.getElementById('modalTaskDesc');
    if (desc) {
      desc.textContent = `Are you sure you have completed "${taskTitle}"?`;
    }
    if (modal) {
      modal.classList.add('active');
    }
  }

  function executeTaskCompletion(taskId, token) {
    const confirmBtn = document.getElementById('confirmCompleteBtn');
    if (confirmBtn) confirmBtn.disabled = true;

    fetch(`${API_BASE}/employee/me/tasks/${taskId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to complete task');
        return res.json();
      })
      .then(data => {
        const modal = document.getElementById('taskCompleteModal');
        if (modal) modal.classList.remove('active');
        if (confirmBtn) confirmBtn.disabled = false;
        pendingTaskId = null;

        // Refresh task list
        fetchAndRenderTasks(token);
      })
      .catch(err => {
        alert('Could not complete task: ' + err.message);
        if (confirmBtn) confirmBtn.disabled = false;
      });
  }

  window.TICK_EmployeeTasks = {
    fetchAndRenderTasks,
    openCompleteModal
  };

})();
