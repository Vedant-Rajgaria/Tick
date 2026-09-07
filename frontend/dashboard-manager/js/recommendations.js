/**
 * TICK - Dynamic Recommendation Engine & Task Assignment Controller
 * Fully integrated with FastAPI backend Stage 5 Constrained Multi-Objective Optimization.
 * Includes interactive candidate inspector to evaluate every team member's score and signals.
 */

(function() {
  'use strict';

  const API_BASE = "http://localhost:8000/api/v1";
  const TOKEN_KEY = "tick_access_token";

  let currentEvaluationData = null;
  let currentTaskPayload = null;
  let currentSelectedCandidateId = null;

  document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      window.location.href = 'login.html';
      return;
    }

    setupAdminProfile(token);
    setupLogout();
    setupQuickSkillTags();
    setDefaultDeadline();
    initRecommendations(token);
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

  function setupAdminProfile(token) {
    const dateEl = document.getElementById('topHeaderDate');
    if (dateEl) {
      dateEl.textContent = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

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

  function setDefaultDeadline() {
    const deadlineInput = document.getElementById('taskDeadlineInput');
    if (deadlineInput && !deadlineInput.value) {
      const target = new Date();
      target.setDate(target.getDate() + 4);
      deadlineInput.value = target.toISOString().split('T')[0];
    }
  }

  function setupQuickSkillTags() {
    const container = document.getElementById('quickSkillTags');
    const input = document.getElementById('taskSkillsInput');
    if (!container || !input) return;

    container.addEventListener('click', (e) => {
      const pill = e.target.closest('.skill-tag-pill');
      if (!pill) return;

      const skill = pill.getAttribute('data-skill');
      let current = input.value.split(',').map(s => s.trim()).filter(Boolean);
      if (current.includes(skill)) {
        current = current.filter(s => s !== skill);
        pill.style.background = '#EEF2FF';
        pill.style.color = '#4F46E5';
      } else {
        current.push(skill);
        pill.style.background = '#4F46E5';
        pill.style.color = '#FFFFFF';
      }
      input.value = current.join(', ');
    });
  }

  function initRecommendations(token) {
    const findBtn = document.getElementById('findBestFitBtn');
    if (!findBtn) return;

    findBtn.addEventListener('click', () => {
      runBestFitEvaluation(token);
    });
  }

  function runBestFitEvaluation(token) {
    const title = document.getElementById('taskNameInput').value.trim();
    const skillsStr = document.getElementById('taskSkillsInput').value.trim();
    const taskType = document.getElementById('taskTypeSelect').value;
    const priority = document.getElementById('taskPrioritySelect').value;
    const deadline = document.getElementById('taskDeadlineInput').value || null;
    const estHours = parseFloat(document.getElementById('taskEstTimeInput').value) || 8.0;

    if (!title) {
      alert('Please enter a task name.');
      return;
    }

    const skills = skillsStr ? skillsStr.split(',').map(s => s.trim()).filter(Boolean) : [];

    const placeholder = document.getElementById('recPlaceholder');
    const loader = document.getElementById('recLoader');
    const loaderMsg = document.getElementById('loaderMessage');
    const results = document.getElementById('recResultsContent');

    if (placeholder) placeholder.style.display = 'none';
    if (results) results.style.display = 'none';
    if (loader) loader.style.display = 'flex';
    if (loaderMsg) loaderMsg.textContent = "Checking required skills & constraints...";

    const payload = {
      title: title,
      estimated_hours: estHours,
      deadline: deadline,
      required_skills: skills,
      complexity: "MEDIUM",
      priority: priority.toUpperCase()
    };

    fetch(`${API_BASE}/manager/tasks/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) throw new Error('Evaluation failed');
        return res.json();
      })
      .then(data => {
        currentEvaluationData = data;
        currentTaskPayload = payload;
        currentSelectedCandidateId = data.best_match ? data.best_match.employee_id : (data.candidates && data.candidates[0] ? data.candidates[0].employee_id : null);

        if (loader) loader.style.display = 'none';
        if (results) {
          results.style.display = 'block';
          renderEvaluationWorkspace(token);
        }
      })
      .catch(err => {
        console.error('[TICK] Recommendation error:', err);
        if (loader) loader.style.display = 'none';
        if (placeholder) {
          placeholder.style.display = 'block';
          placeholder.innerHTML = `<div style="color: #DC2626;">Evaluation failed: ${err.message}. Please check connection.</div>`;
        }
      });
  }

  function renderEvaluationWorkspace(token) {
    const container = document.getElementById('recResultsContent');
    if (!container || !currentEvaluationData) return;

    const data = currentEvaluationData;
    const candidates = data.candidates || (data.best_match ? [data.best_match, ...(data.alternatives || [])] : []);
    const best = data.best_match;

    if (!candidates || candidates.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem; color: #6B7280;">
          <h3 style="color: #111827; font-weight: 600; margin-bottom: 0.5rem;">No Employees Found</h3>
          <p style="font-size: 0.875rem;">Please add employee profiles in your organization to evaluate task assignment.</p>
        </div>
      `;
      return;
    }

    // Identify candidate currently selected for detailed inspection
    let candidate = candidates.find(c => c.employee_id === currentSelectedCandidateId) || best || candidates[0];
    const isBest = best && (candidate.employee_id === best.employee_id);

    // Derived human-readable capacity values
    const capHours = candidate.workload ? candidate.workload.capacity_hours : 8.0;
    const currentHours = candidate.workload ? candidate.workload.remaining_hours : 0.0;
    const taskHours = currentTaskPayload ? currentTaskPayload.estimated_hours : (candidate.workload ? Math.max(0, candidate.workload.projected_hours - currentHours) : 8.0);
    const projectedHours = candidate.workload ? candidate.workload.projected_hours : (currentHours + taskHours);
    const availableHours = Math.max(0, Math.round((capHours - currentHours) * 10) / 10);
    const isOverCapacity = projectedHours > capHours;
    const shortfallHours = Math.round((projectedHours - capHours) * 10) / 10;
    const bufferRemaining = Math.max(0, Math.round((capHours - projectedHours) * 10) / 10);
    const currentLoad = candidate.workload ? candidate.workload.current_percentage : 0;
    const projectedLoad = candidate.workload ? candidate.workload.projected_percentage : 0;

    const currentPct = Math.min(100, Math.round((currentHours / capHours) * 100));
    const addedPct = Math.min(100 - currentPct, Math.round((taskHours / capHours) * 100));

    // Status Tag / Badge
    let statusTagHtml = '';
    if (!candidate.is_feasible) {
      statusTagHtml = `<span class="decision-status-tag ineligible">✕ Ineligible &bull; Missing Required Skills</span>`;
    } else if (isOverCapacity) {
      statusTagHtml = `<span class="decision-status-tag warning">⚠ ${isBest ? 'Strongest Fit &bull; ' : ''}Capacity Warning</span>`;
    } else {
      statusTagHtml = `<span class="decision-status-tag feasible">✓ ${isBest ? 'Best Available Fit (Feasible)' : 'Feasible Candidate'}</span>`;
    }

    // Excluded or constrained candidates list for drawer
    const constrainedCandidates = candidates.filter(c => c.employee_id !== candidate.employee_id && (!c.is_feasible || (c.workload && c.workload.projected_hours > c.workload.capacity_hours)));

    let html = `
      <!-- TOP EVALUATION SUMMARY BAR -->
      <div style="display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem;">
        <div>
          <div style="font-size: 0.8125rem; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">
            Candidate Evaluation
          </div>
          <div style="font-size: 0.78rem; color: #6B7280; margin-top: 1px;">
            ${data.candidates_evaluated} employees considered &bull; <strong>${data.eligible_candidates} qualified</strong>
          </div>

          ${constrainedCandidates.length > 0 ? `
            <details style="margin-top: 0.35rem; font-size: 0.75rem; color: #4F46E5;">
              <summary style="cursor: pointer; font-weight: 600;">Why were others excluded or constrained?</summary>
              <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 4px; padding: 0.5rem 0.75rem; margin-top: 0.35rem; color: #4B5563;">
                ${constrainedCandidates.map(c => {
                  const reason = !c.is_feasible ? 'Missing required skills' : `Over capacity (+${Math.round((c.workload.projected_hours - c.workload.capacity_hours)*10)/10}h shortfall)`;
                  return `<div style="padding: 1px 0;">&bull; <strong>${c.name}</strong> &mdash; ${reason}</div>`;
                }).join('')}
              </div>
            </details>
          ` : ''}
        </div>

        <!-- CANDIDATE SELECTOR DROPDOWN -->
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <label for="candidateDropdown" style="font-size: 0.8125rem; font-weight: 600; color: #374151;">Selected:</label>
          <select id="candidateDropdown" class="form-select" style="padding: 0.35rem 0.65rem; font-size: 0.8125rem; font-weight: 600; border-radius: 6px; border: 1px solid #D1D5DB; background-color: #FFFFFF; color: #111827;">
            ${candidates.map(c => {
              const isCandidateBest = best && (c.employee_id === best.employee_id);
              const selected = c.employee_id === candidate.employee_id ? 'selected' : '';
              return `<option value="${c.employee_id}" ${selected}>${isCandidateBest ? '★ ' : ''}${c.name} (Fit: ${c.match_percentage}/100)</option>`;
            }).join('')}
          </select>
        </div>
      </div>

      <!-- PRIMARY DECISION CARD -->
      <div class="decision-card ${isOverCapacity ? 'warning-state' : (candidate.is_feasible ? 'feasible-state' : '')}">
        <div>${statusTagHtml}</div>
        
        <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 0.75rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span style="font-size: 1.35rem; font-weight: 800; color: #111827;">${candidate.name}</span>
              ${candidate.is_feasible ? `
                <span style="font-size: 0.72rem; padding: 2px 8px; background: #ECFDF5; color: #047857; border-radius: 4px; font-weight: 600;">
                  ✓ Meets required skills
                </span>
              ` : `
                <span style="font-size: 0.72rem; padding: 2px 8px; background: #FEF2F2; color: #B91C1C; border-radius: 4px; font-weight: 600;">
                  ✕ Missing required skills
                </span>
              `}
            </div>
            <div style="font-size: 0.8125rem; color: #6B7280; margin-top: 2px;">
              ${candidate.role} &bull; ${candidate.department}
            </div>
          </div>

          <!-- OVERALL FIT INDICATOR (Clear 86/100 instead of ambiguous 86% match) -->
          <div class="overall-fit-box">
            <span class="overall-fit-title">Overall Fit</span>
            <div class="overall-fit-score-val" style="color: ${candidate.match_percentage > 0 ? (isOverCapacity ? '#B45309' : '#047857') : '#9CA3AF'};">
              ${candidate.match_percentage}<span class="scale">/100</span>
            </div>
          </div>
        </div>

        <!-- 1. PRIMARY CAPACITY INFORMATION (Moved directly below name/fit) -->
        <div class="capacity-primary-box ${isOverCapacity ? 'overload' : 'healthy'}">
          <div class="capacity-status-banner">
            <span class="capacity-headline ${isOverCapacity ? 'overload' : 'healthy'}">
              ${isOverCapacity
                ? `⚠ Capacity Warning: ${shortfallHours}h over available capacity`
                : `✓ Can take task (${bufferRemaining}h buffer remaining)`}
            </span>
            <span class="capacity-sub-effort">
              Available: <strong>${availableHours}h</strong> &bull; Task effort: <strong>${taskHours}h</strong>
            </span>
          </div>

          <div class="capacity-stats-grid">
            <div class="capacity-stat-card">
              <div class="capacity-stat-label">Current Workload</div>
              <div class="capacity-stat-val">${currentHours}h <span style="font-size: 0.85rem; font-weight: 500; color: #6B7280;">/ ${capHours}h</span></div>
              <div class="capacity-stat-sub">${currentLoad}% capacity used</div>
            </div>

            <div class="capacity-stat-card" style="border-color: ${isOverCapacity ? '#FCD34D' : '#A7F3D0'};">
              <div class="capacity-stat-label">After This Task</div>
              <div class="capacity-stat-val" style="color: ${isOverCapacity ? '#B45309' : '#047857'};">
                ${projectedHours}h <span style="font-size: 0.85rem; font-weight: 500; color: #6B7280;">/ ${capHours}h</span>
              </div>
              <div class="capacity-stat-sub" style="color: ${isOverCapacity ? '#B45309' : '#047857'}; font-weight: 600;">
                ${isOverCapacity ? `⚠ ${shortfallHours}h over capacity (${projectedLoad}%)` : `✓ Fits within schedule (${projectedLoad}%)`}
              </div>
            </div>
          </div>

          <div class="capacity-meter-wrap">
            <div class="capacity-meter-current" style="width: ${currentPct}%;"></div>
            <div class="capacity-meter-added ${isOverCapacity ? 'overload' : ''}" style="left: ${currentPct}%; width: ${addedPct}%;"></div>
          </div>
          <div class="capacity-meter-labels">
            <span>0h (Start)</span>
            <span>${capHours}h capacity threshold</span>
            <span>${projectedHours > capHours ? `${projectedHours}h projected` : `${capHours}h`}</span>
          </div>
        </div>

        <!-- 2. ACTIONABLE DECISION SIGNALS (Replaces internal S/A/E/D technical labels) -->
        <div class="action-signals-grid">
          <div class="action-signal-pill ${candidate.breakdown.skill_match === 100 ? 'green' : (candidate.breakdown.skill_match > 0 ? 'amber' : 'red')}">
            <span>${candidate.breakdown.skill_match === 100 ? '✓' : (candidate.breakdown.skill_match > 0 ? '⚠' : '✕')}</span>
            <span>${candidate.breakdown.skill_match === 100 ? 'All required skills' : (candidate.breakdown.skill_match > 0 ? `Partial skills (${candidate.breakdown.skill_match}%)` : 'Missing skills')}</span>
          </div>

          <div class="action-signal-pill ${availableHours >= taskHours ? 'green' : (availableHours > 0 ? 'amber' : 'red')}">
            <span>${availableHours >= taskHours ? '✓' : (availableHours > 0 ? '⚠' : '✕')}</span>
            <span>${availableHours >= taskHours ? `${availableHours}h available` : (availableHours > 0 ? `${availableHours}h free (${shortfallHours}h short)` : '0h free (Booked)')}</span>
          </div>

          <div class="action-signal-pill ${candidate.breakdown.efficiency >= 75 ? 'green' : 'amber'}">
            <span>✓</span>
            <span>${candidate.breakdown.efficiency >= 85 ? 'Strong velocity' : 'Standard velocity'}</span>
          </div>

          <div class="action-signal-pill ${candidate.breakdown.deadline_fit >= 70 ? 'green' : 'amber'}">
            <span>${candidate.breakdown.deadline_fit >= 70 ? '✓' : '⚠'}</span>
            <span>${candidate.breakdown.deadline_fit >= 70 ? 'Deadline compatible' : 'Tight deadline'}</span>
          </div>
        </div>

        <!-- 3. WHY THIS CANDIDATE (Concise, intuitive bullets, no statistical noise) -->
        <div class="why-box" style="margin: 1rem 0; border-left-color: ${isOverCapacity ? '#F59E0B' : '#10B981'};">
          <div class="why-title" style="color: ${isOverCapacity ? '#92400E' : '#065F46'};">Why this candidate:</div>
          <ul class="why-list">
            <li>${candidate.is_feasible ? '✓ Qualified: matches required technical skills' : '✕ Missing core technical skills required for task'}</li>
            <li>${isOverCapacity ? `⚠ Capacity shortfall: task requires ${taskHours}h with only ${availableHours}h buffer available (${shortfallHours}h over capacity)` : `✓ Feasible capacity: absorbs ${taskHours}h effort with ${bufferRemaining}h buffer remaining`}</li>
            <li>${candidate.breakdown.deadline_fit >= 70 ? '✓ Delivery timeline aligns with target deadline' : '⚠ Tight delivery schedule near deadline'}</li>
            <li>${candidate.breakdown.efficiency >= 80 ? '✓ Strong completion track record on similar assignments' : '✓ Solid baseline performance history'}</li>
          </ul>
        </div>

        <!-- 4. COLLAPSIBLE SCORING DETAILS (Transparent progressive disclosure) -->
        <details class="disclosure-block" style="margin-bottom: 1.25rem;">
          <summary class="disclosure-summary">
            <span>View detailed scores & formula weights</span>
            <span style="font-size: 0.7rem; color: #6B7280;">▼</span>
          </summary>
          <div class="disclosure-content">
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; text-align: center; margin-bottom: 0.75rem;">
              <div style="background: #F9FAFB; padding: 0.5rem; border-radius: 4px;">
                <div style="font-size: 0.7rem; color: #6B7280;">Skills (35%)</div>
                <div style="font-size: 0.95rem; font-weight: 700; color: #111827;">${candidate.breakdown.skill_match}%</div>
              </div>
              <div style="background: #F9FAFB; padding: 0.5rem; border-radius: 4px;">
                <div style="font-size: 0.7rem; color: #6B7280;">Availability (30%)</div>
                <div style="font-size: 0.95rem; font-weight: 700; color: #111827;">${candidate.breakdown.availability}%</div>
              </div>
              <div style="background: #F9FAFB; padding: 0.5rem; border-radius: 4px;">
                <div style="font-size: 0.7rem; color: #6B7280;">Efficiency (20%)</div>
                <div style="font-size: 0.95rem; font-weight: 700; color: #111827;">${candidate.breakdown.efficiency}%</div>
              </div>
              <div style="background: #F9FAFB; padding: 0.5rem; border-radius: 4px;">
                <div style="font-size: 0.7rem; color: #6B7280;">Deadline Fit (15%)</div>
                <div style="font-size: 0.95rem; font-weight: 700; color: #111827;">${candidate.breakdown.deadline_fit}%</div>
              </div>
            </div>
            <div style="font-size: 0.72rem; color: #6B7280; line-height: 1.5;">
              Base weighted score: <strong>${Math.round(candidate.base_score * 100)}%</strong> &bull; Overload penalty multiplier: <strong>${candidate.penalty}</strong> &bull; Overall composite fit: <strong>${candidate.match_percentage}/100</strong>
            </div>
          </div>
        </details>

        <!-- 5. ACTION BUTTON & DELIBERATE CAPACITY CONFIRMATION -->
        <button type="button" class="btn btn-primary" id="mainActionBtn" style="width: 100%; padding: 0.75rem; font-size: 0.95rem; font-weight: 700; background-color: ${isOverCapacity ? '#D97706' : '#059669'};">
          ${isOverCapacity ? `REVIEW CAPACITY & ASSIGN TO ${candidate.name.toUpperCase()}` : `ASSIGN TASK TO ${candidate.name.toUpperCase()}`}
        </button>

        <!-- Capacity Warning Confirmation Box (Only shown if over capacity and manager clicks review) -->
        <div id="capacityConfirmCard" class="capacity-confirm-box" style="display: none;">
          <div class="capacity-confirm-title">
            <span>⚠</span>
            <span>Capacity Warning for ${candidate.name}</span>
          </div>
          <div class="capacity-confirm-body">
            Assigning this <strong>${taskHours}h</strong> task will increase ${candidate.name}'s workload to <strong>${projectedHours}h</strong> (<strong>${shortfallHours}h over</strong> their ${capHours}h capacity).
          </div>
          <div class="capacity-confirm-buttons">
            <button type="button" class="btn btn-secondary btn-sm" id="cancelAssignBtn" style="font-size: 0.8rem; padding: 5px 12px;">Cancel</button>
            <button type="button" class="btn btn-primary btn-sm" id="confirmOverloadAssignBtn" style="font-size: 0.8rem; padding: 5px 12px; background-color: #D97706;">Confirm Assignment Anyway</button>
          </div>
        </div>
      </div>

      <!-- 6. SCANNABLE CANDIDATE COMPARISON -->
      <div style="margin-top: 1.75rem;">
        <div style="font-size: 0.8125rem; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem;">
          Compare All Candidates in Organization (${candidates.length})
        </div>
        <div style="display: flex; flex-direction: column; gap: 0.65rem;">
          ${candidates.map(c => {
            const isSelected = c.employee_id === candidate.employee_id;
            const isCandidateBest = best && (c.employee_id === best.employee_id);
            const cCap = c.workload ? c.workload.capacity_hours : 8.0;
            const cRem = c.workload ? c.workload.remaining_hours : 0.0;
            const cProj = c.workload ? c.workload.projected_hours : cRem;
            const cOver = cProj > cCap;
            const cShortfall = Math.round((cProj - cCap) * 10) / 10;
            const cFree = Math.max(0, Math.round((cCap - cRem) * 10) / 10);

            return `
              <div style="background: #FFFFFF; border: ${isSelected ? '2px solid #4F46E5' : '1px solid #E5E7EB'}; border-radius: 6px; padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <strong style="color: #111827; font-size: 0.95rem;">${c.name}</strong>
                    ${isCandidateBest ? `<span style="font-size: 0.7rem; background: #EEF2FF; color: #4F46E5; padding: 1px 6px; border-radius: 4px; font-weight: 600;">TOP FIT</span>` : ''}
                    
                    <!-- 3 Decision Pills: Skills, Capacity, Deadline -->
                    <span style="font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; font-weight: 600; background: ${c.is_feasible ? '#ECFDF5' : '#FEE2E2'}; color: ${c.is_feasible ? '#047857' : '#B91C1C'};">
                      ${c.is_feasible ? '✓ Skills' : '✕ Missing skills'}
                    </span>

                    <span style="font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; font-weight: 600; background: ${cOver ? '#FFFBEB' : '#ECFDF5'}; color: ${cOver ? '#B45309' : '#047857'};">
                      ${cOver ? `⚠ +${cShortfall}h over` : `✓ ${cFree}h free`}
                    </span>

                    <span style="font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; font-weight: 600; background: ${c.breakdown.deadline_fit >= 70 ? '#ECFDF5' : '#FFFBEB'}; color: ${c.breakdown.deadline_fit >= 70 ? '#047857' : '#B45309'};">
                      ${c.breakdown.deadline_fit >= 70 ? '✓ Deadline' : '⚠ Deadline'}
                    </span>
                  </div>
                  <div style="font-size: 0.75rem; color: #6B7280; margin-top: 2px;">
                    ${c.role} &bull; ${c.department} &bull; Skills: ${c.skills && c.skills.length ? c.skills.join(', ') : 'None listed'}
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <div style="text-align: right;">
                    <div style="font-size: 1.05rem; font-weight: 800; color: ${c.match_percentage > 0 ? (cOver ? '#B45309' : '#047857') : '#9CA3AF'};">
                      ${c.match_percentage}<span style="font-size: 0.75rem; font-weight: 500; color: #9CA3AF;">/100</span>
                    </div>
                    <div style="font-size: 0.65rem; color: #6B7280; text-transform: uppercase;">Overall Fit</div>
                  </div>
                  <button type="button" class="btn btn-secondary btn-sm inspect-candidate-btn" data-empid="${c.employee_id}" style="font-size: 0.75rem; padding: 4px 10px;">
                    Inspect
                  </button>
                  <button type="button" class="btn btn-primary btn-sm assign-candidate-btn" data-empid="${c.employee_id}" data-empname="${c.name}" style="font-size: 0.75rem; padding: 4px 10px; background-color: ${cOver ? '#D97706' : '#059669'};">
                    Assign
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Dropdown change listener
    const dropdown = document.getElementById('candidateDropdown');
    if (dropdown) {
      dropdown.addEventListener('change', (e) => {
        currentSelectedCandidateId = parseInt(e.target.value, 10);
        renderEvaluationWorkspace(token);
      });
    }

    // Inspect buttons in candidate rows
    container.querySelectorAll('.inspect-candidate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSelectedCandidateId = parseInt(btn.getAttribute('data-empid'), 10);
        renderEvaluationWorkspace(token);
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Main Card Action Button
    const mainActionBtn = document.getElementById('mainActionBtn');
    const confirmCard = document.getElementById('capacityConfirmCard');
    const cancelBtn = document.getElementById('cancelAssignBtn');
    const confirmOverloadBtn = document.getElementById('confirmOverloadAssignBtn');

    if (mainActionBtn) {
      mainActionBtn.addEventListener('click', () => {
        if (isOverCapacity) {
          if (confirmCard) confirmCard.style.display = 'block';
        } else {
          executeTaskAssignment(candidate.employee_id, currentTaskPayload, token);
        }
      });
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        if (confirmCard) confirmCard.style.display = 'none';
      });
    }

    if (confirmOverloadBtn) {
      confirmOverloadBtn.addEventListener('click', () => {
        executeTaskAssignment(candidate.employee_id, currentTaskPayload, token);
      });
    }

    // Direct Assign buttons in candidate rows
    container.querySelectorAll('.assign-candidate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const empId = parseInt(btn.getAttribute('data-empid'), 10);
        const targetCandidate = candidates.find(c => c.employee_id === empId);
        if (targetCandidate && targetCandidate.workload && targetCandidate.workload.projected_hours > targetCandidate.workload.capacity_hours) {
          // Switch view to this candidate to inspect the capacity warning
          currentSelectedCandidateId = empId;
          renderEvaluationWorkspace(token);
          const activeConfirmCard = document.getElementById('capacityConfirmCard');
          if (activeConfirmCard) activeConfirmCard.style.display = 'block';
          container.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          executeTaskAssignment(empId, currentTaskPayload, token);
        }
      });
    });
  }

  function executeTaskAssignment(employeeId, payload, token) {
    const createPayload = {
      title: payload.title,
      description: payload.description || `${payload.title} requirements`,
      assigned_to: employeeId,
      estimated_hours: payload.estimated_hours,
      deadline: payload.deadline,
      required_skills: payload.required_skills,
      complexity: payload.complexity || "MEDIUM",
      priority: payload.priority || "HIGH"
    };

    fetch(`${API_BASE}/manager/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(createPayload)
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to create and assign task');
        return res.json();
      })
      .then(task => {
        alert(`Success! Task "${task.title}" has been assigned to ${task.assigned_name || 'employee'}.`);
        window.location.href = 'index.html';
      })
      .catch(err => {
        alert('Assignment failed: ' + err.message);
      });
  }

})();
