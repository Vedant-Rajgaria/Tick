/**
 * TICK - Employee Tasks Controller & Task Completion Flow
 * Handles assigned tasks, the completion confirmation modal, and recorded delivery duration.
 */

(function() {
  'use strict';

  let pendingTaskId = null;
  let pendingTaskTitle = '';

  document.addEventListener('DOMContentLoaded', () => {
    renderEmployeeTasks();
    setupModalListeners();
  });

  function renderEmployeeTasks() {
    const container = document.getElementById('myTasksContainer');
    if (!container) return;

    const state = window.TICK.getState();
    const alexTasks = state.tasks.filter(t => t.assignedTo === 'alex' || !t.assignedTo);

    // Update counters
    const assignedEl = document.getElementById('empAssignedCount');
    const completedEl = document.getElementById('empCompletedCount');
    if (assignedEl) assignedEl.textContent = alexTasks.length;
    if (completedEl) completedEl.textContent = alexTasks.filter(t => t.status === 'COMPLETED').length;

    if (alexTasks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: #6B7280; padding: 2.5rem 1rem;">
          <p style="font-weight: 500; font-size: 0.95rem; color: #374151;">No assigned tasks yet.</p>
          <p style="font-size: 0.8125rem; color: #9CA3AF; margin-top: 2px;">Your deliverables will appear here once allocated.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = alexTasks.map(task => {
      const isCompleted = task.status === 'COMPLETED';

      return `
        <div style="background-color: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 6px; padding: 1.25rem; margin-bottom: 1rem; box-shadow: 0 1px 2px rgba(0,0,0,0.03);">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
                <span class="status-pill ${isCompleted ? 'completed' : 'normal'}">${task.status}</span>
                <span class="priority-tag ${task.priority.toLowerCase()}">${task.priority}</span>
              </div>
              
              <h3 style="font-size: 1.05rem; font-weight: 700; color: #111827; margin-bottom: 0.25rem;">
                ${task.title}
              </h3>
              
              <div style="font-size: 0.8125rem; color: #6B7280; display: flex; gap: 1.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
                <div><strong>Deadline:</strong> ${task.deadline}</div>
                <div><strong>Estimated:</strong> ${task.estimatedHours}h</div>
                ${task.timeTaken ? `<div><strong>Time Taken:</strong> <span style="color: #059669; font-weight: 600;">${task.timeTaken}</span></div>` : ''}
                ${task.completedAt ? `<div><strong>Completed:</strong> ${task.completedAt}</div>` : ''}
              </div>
            </div>

            <div>
              ${!isCompleted ? `
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.TICK_EmployeeTasks.openCompleteModal('${task.id}', '${task.title}')" style="font-weight: 600;">
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
  }

  function setupModalListeners() {
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
        executeTaskCompletion(pendingTaskId);
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

  function executeTaskCompletion(taskId) {
    const state = window.TICK.getState();
    const task = state.tasks.find(t => t.id === taskId);
    const alex = state.employees.find(e => e.id === 'alex');

    if (task) {
      task.status = "COMPLETED";
      task.completedAt = "3:42 PM";
      task.timeTaken = "5h 12m";

      if (alex) {
        alex.completedCount = (alex.completedCount || 0) + 1;
        alex.remainingHours = Math.max(0, parseFloat((alex.remainingHours - task.estimatedHours).toFixed(1)));
        alex.workload = Math.max(45, Math.round((alex.remainingHours / alex.capacityHours) * 100));
        alex.status = alex.workload >= 85 ? "Needs attention" : "Active";
        alex.statusClass = alex.workload >= 85 ? "attention" : "normal";
      }

      window.TICK.saveState(state);
      window.TICK.showToast(`Task "${task.title}" completed. Time recorded: 5h 12m`);
    }

    const modal = document.getElementById('taskCompleteModal');
    if (modal) modal.classList.remove('active');

    renderEmployeeTasks();
  }

  window.TICK_EmployeeTasks = {
    renderEmployeeTasks,
    openCompleteModal
  };

})();
