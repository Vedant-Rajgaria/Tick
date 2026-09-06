/**
 * TICK - Recommendation Engine & Task Assignment Controller
 * Signatures: Best Fit Recommendation & Capacity View (Current 72% + 8h -> Projected 91%)
 */

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initRecommendations();
  });

  function initRecommendations() {
    const findBtn = document.getElementById('findBestFitBtn');
    if (!findBtn) return;

    findBtn.addEventListener('click', () => {
      runBestFitEvaluation();
    });
  }

  function runBestFitEvaluation() {
    const placeholder = document.getElementById('recPlaceholder');
    const loader = document.getElementById('recLoader');
    const loaderMsg = document.getElementById('loaderMessage');
    const results = document.getElementById('recResultsContent');

    if (placeholder) placeholder.style.display = 'none';
    if (results) results.style.display = 'none';
    if (loader) loader.style.display = 'flex';

    // Short, subtle progression
    setTimeout(() => {
      if (loaderMsg) loaderMsg.textContent = "Checking task requirements & velocity...";
    }, 200);

    setTimeout(() => {
      if (loaderMsg) loaderMsg.textContent = "Finding the best fit...";
    }, 400);

    setTimeout(() => {
      if (loader) loader.style.display = 'none';
      if (results) {
        results.style.display = 'block';
        renderBestFitResults();
      }
    }, 600);
  }

  function renderBestFitResults() {
    const container = document.getElementById('recResultsContent');
    const state = window.TICK.getState();
    const alex = state.employees.find(e => e.id === 'alex') || state.employees[0];

    const taskName = document.getElementById('taskNameInput').value || "Build Payment API";
    const estTime = document.getElementById('taskEstTimeInput').value || "8 hours";
    const deadline = document.getElementById('taskDeadlineInput').value || "September 10";

    // Current: 72%, Projected: 91% (after adding 8h)
    const currentLoad = alex.workload || 72;
    const projectedLoad = Math.min(Math.round(currentLoad + 19), 95);

    container.innerHTML = `
      <div style="font-size: 0.8125rem; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">
        TICK Found 3 Good Fits
      </div>

      <!-- BEST MATCH CARD (Alex Johnson) -->
      <div class="best-fit-card">
        <div class="best-fit-tag">Best Match</div>
        
        <div class="best-fit-header">
          <div>
            <div class="best-fit-name">${alex.name}</div>
            <div style="font-size: 0.8125rem; color: #6B7280;">${alex.role} &bull; ${alex.department}</div>
          </div>
          <div class="best-fit-score">
            ${alex.matchScore || 89}%
            <span>Match</span>
          </div>
        </div>

        <!-- Multi-Signal Breakdown -->
        <div class="breakdown-grid">
          <div class="breakdown-item">
            <span class="breakdown-lbl">Skill Match</span>
            <span class="breakdown-val">${alex.skillScore || 94}%</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-lbl">Availability</span>
            <span class="breakdown-val">${alex.availabilityScore || 82}%</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-lbl">Efficiency</span>
            <span class="breakdown-val">${alex.efficiencyScore || 90}%</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-lbl">Deadline Fit</span>
            <span class="breakdown-val">${alex.deadlineFit || 88}%</span>
          </div>
        </div>

        <!-- SIGNATURE EXPERIENCE 2: CAPACITY VIEW (Visual Decision Aid) -->
        <div class="capacity-view-box">
          <div style="font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #374151; margin-bottom: 0.75rem;">
            Capacity Impact Analysis
          </div>

          <div class="capacity-view-row">
            <span class="capacity-view-label">Current Workload</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="workload-meter" style="width: 120px;">
                <div class="workload-fill normal" style="width: ${currentLoad}%;"></div>
              </div>
              <span class="capacity-view-value">${currentLoad}%</span>
            </div>
          </div>

          <div class="capacity-view-row">
            <span class="capacity-view-label">New Task Commitment</span>
            <span class="capacity-delta-pill">+ ${estTime}</span>
          </div>

          <div class="capacity-view-row" style="padding-top: 0.5rem; border-top: 1px solid #E5E7EB;">
            <span class="capacity-view-label"><strong>Projected Workload</strong></span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="workload-meter" style="width: 120px;">
                <div class="workload-fill attention" style="width: ${projectedLoad}%;"></div>
              </div>
              <strong style="color: #D97706;">${projectedLoad}%</strong>
            </div>
          </div>
        </div>

        <!-- WHY ALEX? (Observational Rationale) -->
        <div class="why-box">
          <div class="why-title">Why Alex?</div>
          <ul class="why-list">
            <li>Strong skill match in backend & API infrastructure</li>
            <li>Good available capacity (7.2h buffer before attention limit)</li>
            <li>Strong historical completion velocity on similar tasks</li>
            <li>Target deadline is compatible with recent work session distribution</li>
          </ul>
        </div>

        <!-- Manager Decision Button -->
        <button type="button" class="btn btn-primary" id="confirmAssignBtn" style="width: 100%; padding: 0.75rem; font-size: 0.95rem;">
          ASSIGN TO ALEX →
        </button>
      </div>

      <!-- OTHER GOOD FITS -->
      <div style="margin-top: 1.5rem;">
        <div style="font-size: 0.75rem; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
          Other Good Fits
        </div>
        <div class="other-fits-list">
          <div class="other-fit-item">
            <div>
              <strong style="color: #111827;">Sarah Patel</strong>
              <div style="font-size: 0.75rem; color: #6B7280;">UI Designer &bull; High available capacity</div>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
              <strong style="color: #4B5563;">82%</strong>
              <button class="btn btn-secondary btn-sm" onclick="window.TICK.showToast('Selected Sarah Patel')">Choose</button>
            </div>
          </div>

          <div class="other-fit-item">
            <div>
              <strong style="color: #111827;">Rahul Shah</strong>
              <div style="font-size: 0.75rem; color: #6B7280;">Backend Developer &bull; Near capacity threshold</div>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
              <strong style="color: #4B5563;">76%</strong>
              <button class="btn btn-secondary btn-sm" onclick="window.TICK.showToast('Selected Rahul Shah')">Choose</button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach Assignment Action
    const assignBtn = document.getElementById('confirmAssignBtn');
    if (assignBtn) {
      assignBtn.addEventListener('click', () => {
        assignTaskToAlex(taskName, deadline, estTime, projectedLoad);
      });
    }
  }

  function assignTaskToAlex(taskName, deadline, estTime, projectedLoad) {
    const state = window.TICK.getState();
    const alex = state.employees.find(e => e.id === 'alex');

    if (alex) {
      alex.workload = projectedLoad;
      alex.remainingHours = parseFloat((alex.remainingHours + 8.0).toFixed(1));
      alex.tasksCount += 1;
      if (projectedLoad >= 85) {
        alex.status = "Needs attention";
        alex.statusClass = "attention";
      }
    }

    // Add or activate task
    const existingTask = state.tasks.find(t => t.title.toLowerCase() === taskName.toLowerCase());
    if (existingTask) {
      existingTask.status = "IN PROGRESS";
      existingTask.assignedTo = "alex";
      existingTask.assignedToName = "Alex Johnson";
    } else {
      state.tasks.unshift({
        id: `task-${Date.now()}`,
        title: taskName,
        type: "Development",
        priority: "HIGH",
        estimatedHours: 8,
        deadline: deadline,
        assignedTo: "alex",
        assignedToName: "Alex Johnson",
        status: "IN PROGRESS",
        completedAt: null,
        timeTaken: null
      });
    }

    window.TICK.saveState(state);
    window.TICK.showToast(`Task "${taskName}" assigned to Alex Johnson.`);

    // Render Success Confirmation in panel
    const container = document.getElementById('recResultsContent');
    if (container) {
      container.innerHTML = `
        <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 2rem; text-align: center;">
          <div style="width: 44px; height: 44px; border-radius: 50%; background-color: #DCFCE7; color: #15803D; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;">
            ✓
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 700; color: #14532D; margin-bottom: 0.35rem;">
            Task Successfully Assigned to Alex Johnson
          </h3>
          <p style="font-size: 0.875rem; color: #166534; max-width: 380px; margin: 0 auto 1.5rem; line-height: 1.4;">
            "${taskName}" is now active in Alex's workspace. Projected workload updated to <strong>${projectedLoad}%</strong>.
          </p>

          <div style="display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap;">
            <a href="index.html" class="btn btn-primary" style="background-color: #15803D;">
              View Team Capacity Overview →
            </a>
            <a href="../index.html" class="btn btn-secondary">
              Logout to Switch to Employee
            </a>
          </div>
        </div>
      `;
    }
  }

})();
