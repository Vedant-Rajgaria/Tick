/**
 * TIC Centralized API Client & Mock Data Layer
 * Handles REST communication with FastAPI (/api/v1) and maintains seamless 
 * shared mock state across Employee and Manager dashboards.
 */

(function(window) {
  'use strict';

  const API_BASE = "http://localhost:8000/api/v1";
  
  // Set to true to use mock data for demo, or false to connect to FastAPI
  // Falls back to mock data if network request fails
  const FORCE_MOCK = true;

  // Storage key for cross-dashboard state synchronization
  const STORAGE_KEY = "tic_workforce_state_v1";

  // Default Mock Dataset
  const DEFAULT_STATE = {
    currentEmployee: {
      id: 17,
      name: "Alex Johnson",
      role: "Backend Developer",
      department: "Engineering",
      avatar: "AJ",
      workload: 62,
      activeTimeSeconds: 20520, // 5h 42m
      idleTimeSeconds: 2880,   // 48m (No-input time)
      sessions: 7,
      tasksCompleted: 4,
      remainingHours: 12.4,
      capacityHours: 20.0,
      contextSwitches: 31,
      activeRatio: 87,
      averageSessionMins: 48,
      focusDurationSeconds: 1250, // Future non-webcam signal
      gazeBreaks: 14             // Future non-webcam signal
    },
    employees: [
      {
        id: 17,
        name: "Alex Johnson",
        role: "Backend Developer",
        department: "Backend",
        avatar: "AJ",
        workload: 89,
        remainingHours: 17.8,
        capacityHours: 20.0,
        activeTime: "6h 10m",
        tasksCount: 6,
        tasksCompleted: 5,
        status: "HIGH",
        skillScore: 94,
        efficiencyScore: 90,
        workPatternNote: "Work sessions were shorter than the employee's recent baseline, with concentrated input bursts on payment infrastructure."
      },
      {
        id: 22,
        name: "Sam Smith",
        role: "DevOps Engineer",
        department: "Infrastructure",
        avatar: "SS",
        workload: 52,
        remainingHours: 10.4,
        capacityHours: 20.0,
        activeTime: "5h 15m",
        tasksCount: 3,
        tasksCompleted: 3,
        status: "NORMAL",
        skillScore: 78,
        efficiencyScore: 84,
        workPatternNote: "Terminal input patterns show steady rhythm; context switches between cloud console and bash sessions are consistent."
      },
      {
        id: 31,
        name: "John Doe",
        role: "Fullstack Engineer",
        department: "Fullstack",
        avatar: "JD",
        workload: 71,
        remainingHours: 14.2,
        capacityHours: 20.0,
        activeTime: "5h 50m",
        tasksCount: 4,
        tasksCompleted: 4,
        status: "NORMAL",
        skillScore: 85,
        efficiencyScore: 82,
        workPatternNote: "Application usage evenly balanced between React frontend and Node microservices with steady session durations."
      },
      {
        id: 45,
        name: "Sarah Wilson",
        role: "Frontend Architect",
        department: "Frontend",
        avatar: "SW",
        workload: 34,
        remainingHours: 6.8,
        capacityHours: 20.0,
        activeTime: "4h 40m",
        tasksCount: 2,
        tasksCompleted: 6,
        status: "LOW",
        skillScore: 88,
        efficiencyScore: 93,
        workPatternNote: "High available capacity; design review sessions completed earlier than typical sprint distribution."
      }
    ],
    tasks: [
      {
        id: 101,
        title: "Payment API Implementation",
        description: "Develop Stripe payment webhooks, idempotency keys, and receipt generator.",
        assignedTo: 17,
        assignedToName: "Alex Johnson",
        priority: "HIGH",
        complexity: "HIGH",
        estimatedHours: 8,
        actualHours: 5.5,
        remainingHours: 6.0,
        deadline: "2026-09-10",
        status: "IN_PROGRESS"
      },
      {
        id: 102,
        title: "Database Schema Optimization",
        description: "Partition transaction audit tables and optimize read query indexes.",
        assignedTo: 17,
        assignedToName: "Alex Johnson",
        priority: "MEDIUM",
        complexity: "MEDIUM",
        estimatedHours: 4,
        actualHours: 4.0,
        remainingHours: 0.0,
        deadline: "2026-09-08",
        status: "COMPLETED"
      },
      {
        id: 103,
        title: "Security & Penetration Testing",
        description: "Execute automated penetration testing and audit authentication headers.",
        assignedTo: 17,
        assignedToName: "Alex Johnson",
        priority: "HIGH",
        complexity: "HIGH",
        estimatedHours: 6,
        actualHours: 2.0,
        remainingHours: 4.0,
        deadline: "2026-09-14",
        status: "TODO"
      },
      {
        id: 104,
        title: "API Gateway Documentation",
        description: "Generate OpenAPI 3.1 documentation and developer sandbox specs.",
        assignedTo: 17,
        assignedToName: "Alex Johnson",
        priority: "LOW",
        complexity: "LOW",
        estimatedHours: 3,
        actualHours: 0.6,
        remainingHours: 2.4,
        deadline: "2026-09-15",
        status: "TODO"
      },
      {
        id: 105,
        title: "UI Design System Refactor",
        description: "Migrate legacy CSS variables to unified design token system.",
        assignedTo: 45,
        assignedToName: "Sarah Wilson",
        priority: "MEDIUM",
        complexity: "MEDIUM",
        estimatedHours: 6.8,
        actualHours: 2.0,
        remainingHours: 6.8,
        deadline: "2026-09-12",
        status: "IN_PROGRESS"
      },
      {
        id: 106,
        title: "Kubernetes Cluster Auto-scaler",
        description: "Configure HPA triggers for ingress traffic spikes.",
        assignedTo: 22,
        assignedToName: "Sam Smith",
        priority: "CRITICAL",
        complexity: "HIGH",
        estimatedHours: 10.4,
        actualHours: 4.0,
        remainingHours: 10.4,
        deadline: "2026-09-09",
        status: "BLOCKED"
      },
      {
        id: 107,
        title: "User Profile State Sync",
        description: "Resolve caching inconsistency in federated SSO logins.",
        assignedTo: 31,
        assignedToName: "John Doe",
        priority: "HIGH",
        complexity: "MEDIUM",
        estimatedHours: 14.2,
        actualHours: 8.0,
        remainingHours: 14.2,
        deadline: "2026-09-11",
        status: "IN_PROGRESS"
      }
    ],
    appUsage: [
      { name: "VS Code", category: "development", time: "3h 20m", minutes: 200, percentage: 55, color: "#4F46E5" },
      { name: "Google Chrome", category: "browser", time: "1h 10m", minutes: 70, percentage: 20, color: "#0284C7" },
      { name: "Microsoft Teams", category: "communication", time: "45m", minutes: 45, percentage: 12, color: "#8B5CF6" },
      { name: "Notion & Docs", category: "documentation", time: "30m", minutes: 30, percentage: 8, color: "#10B981" },
      { name: "Terminal / Other", category: "other", time: "18m", minutes: 18, percentage: 5, color: "#F59E0B" }
    ],
    categories: [
      { name: "Development", percentage: 55, color: "#4F46E5" },
      { name: "Browser", percentage: 20, color: "#0284C7" },
      { name: "Communication", percentage: 12, color: "#8B5CF6" },
      { name: "Documentation", percentage: 8, color: "#10B981" },
      { name: "Other", percentage: 5, color: "#F59E0B" }
    ],
    notifications: [
      {
        id: 1,
        type: "WORKLOAD_HIGH",
        title: "Workload Notice",
        message: "Your current workload has reached 62% (within normal range).",
        time: "10m ago",
        read: false,
        iconType: "high-workload"
      },
      {
        id: 2,
        type: "TASK_COMPLETED",
        title: "Task Completed",
        message: "Database Schema Optimization was marked completed.",
        time: "1h ago",
        read: true,
        iconType: "success"
      },
      {
        id: 3,
        type: "TASK_DEADLINE",
        title: "Upcoming Deadline",
        message: "Payment API Implementation deadline is in 4 days (Sep 10).",
        time: "3h ago",
        read: false,
        iconType: "task"
      }
    ],
    managerNotifications: [
      {
        id: 1,
        type: "WORKLOAD_HIGH",
        title: "Team Workload Alert",
        message: "Alex Johnson is currently at 89% workload capacity.",
        time: "15m ago",
        read: false,
        iconType: "high-workload"
      },
      {
        id: 2,
        type: "TASK_DEADLINE",
        title: "Blocked Task Identified",
        message: "Kubernetes Cluster Auto-scaler has been flagged BLOCKED by Sam Smith.",
        time: "45m ago",
        read: false,
        iconType: "overload"
      },
      {
        id: 3,
        type: "TASK_COMPLETED",
        title: "Milestone Completed",
        message: "Sarah Wilson completed Design System token audit.",
        time: "2h ago",
        read: true,
        iconType: "success"
      }
    ]
  };

  // State initialization and persistence
  function getSharedState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Could not read localStorage, using in-memory state:", e);
    }
    saveSharedState(DEFAULT_STATE);
    return JSON.parse(JSON.stringify(DEFAULT_STATE));
  }

  function saveSharedState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Could not save to localStorage:", e);
    }
  }

  // Workload calculator formula:
  // Workload % = (Remaining Task Hours / Available Work Hours) * 100
  function calculateWorkload(remainingHours, capacityHours) {
    if (!capacityHours || capacityHours <= 0) return 0;
    return Math.min(Math.round((remainingHours / capacityHours) * 100), 150);
  }

  // Workload Classification
  function getWorkloadClassification(percentage) {
    if (percentage <= 50) return { label: "LOW", className: "badge-workload-low", color: "#10B981" };
    if (percentage <= 80) return { label: "NORMAL", className: "badge-workload-normal", color: "#0284C7" };
    if (percentage <= 100) return { label: "HIGH", className: "badge-workload-high", color: "#F59E0B" };
    return { label: "OVERLOADED", className: "badge-workload-overloaded", color: "#EF4444" };
  }

  // Recommendation Engine formula:
  // Score = 0.35 * Skill + 0.30 * Availability + 0.20 * Efficiency + 0.15 * DeadlineFit
  function generateRecommendationsForTask(taskData) {
    const state = getSharedState();
    const estHours = Number(taskData.estimatedHours) || 8;
    const taskComplexity = taskData.complexity || "HIGH";

    const results = state.employees.map(emp => {
      // 1. Skill Match (0-100)
      let skillMatch = emp.skillScore || 80;
      if (taskData.title && taskData.title.toLowerCase().includes("api") && emp.role.includes("Backend")) {
        skillMatch = 94;
      } else if (taskData.title && taskData.title.toLowerCase().includes("ui") && emp.role.includes("Frontend")) {
        skillMatch = 95;
      }

      // 2. Availability Score (based on current workload and free capacity)
      // Free capacity = capacityHours - remainingHours
      const freeCapacity = Math.max(0, emp.capacityHours - emp.remainingHours);
      let availabilityScore = 80;
      if (emp.workload >= 90) {
        availabilityScore = 45; // penalized for heavy workload
      } else if (freeCapacity >= estHours) {
        availabilityScore = 85;
      } else {
        availabilityScore = Math.max(40, Math.round((freeCapacity / estHours) * 100));
      }
      if (emp.id === 17) {
        availabilityScore = 82; // Alex has 7.5h estimated free capacity
      }

      // 3. Efficiency Score (historical completion performance)
      const efficiencyScore = emp.efficiencyScore || 85;

      // 4. Deadline Fit (compatibility of remaining hours and schedule)
      const deadlineFit = 88;

      // Weighted calculation
      const weightedScore = Math.round(
        (0.35 * skillMatch) +
        (0.30 * availabilityScore) +
        (0.20 * efficiencyScore) +
        (0.15 * deadlineFit)
      );

      // Observational rationale
      const reasons = [];
      if (skillMatch >= 90) reasons.push("Strong historical skill match on API infrastructure");
      if (freeCapacity > 0) reasons.push(`${freeCapacity.toFixed(1)}h estimated available capacity`);
      if (efficiencyScore >= 85) reasons.push("Consistent task completion velocity within baseline");
      if (emp.workload < 90) reasons.push("Current workload within manageable team threshold");
      reasons.push("Target deadline aligns with recent work session distribution");

      return {
        employeeId: emp.id,
        employeeName: emp.name,
        employeeRole: emp.role,
        avatar: emp.avatar,
        score: weightedScore,
        skillScore: skillMatch,
        availabilityScore: availabilityScore,
        efficiencyScore: efficiencyScore,
        deadlineScore: deadlineFit,
        freeCapacityHours: freeCapacity,
        currentWorkload: emp.workload,
        reasons: reasons
      };
    });

    // Rank highest first
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  // Unified Request Helper
  async function request(endpoint, options = {}) {
    if (FORCE_MOCK) {
      return handleMockRequest(endpoint, options);
    }

    try {
      const token = localStorage.getItem("tick_access_token") || localStorage.getItem("tic_auth_token") || "mock-bearer-token";
      const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        ...(options.headers || {})
      };

      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      console.warn(`[TIC API] Backend request failed (${endpoint}), falling back to mock:`, err);
      return handleMockRequest(endpoint, options);
    }
  }

  // Mock Request Handler mimicking backend FastAPI endpoints
  function handleMockRequest(endpoint, options = {}) {
    const state = getSharedState();
    const method = (options.method || "GET").toUpperCase();

    // GET /api/v1/employee/me/dashboard
    if (endpoint === "/employee/me/dashboard") {
      return Promise.resolve({
        active_time: state.currentEmployee.activeTimeSeconds,
        idle_time: state.currentEmployee.idleTimeSeconds,
        sessions: state.currentEmployee.sessions,
        tasks_completed: state.currentEmployee.tasksCompleted,
        workload_percentage: state.currentEmployee.workload,
        remaining_hours: state.currentEmployee.remainingHours,
        capacity_hours: state.currentEmployee.capacityHours,
        context_switches: state.currentEmployee.contextSwitches,
        active_ratio: state.currentEmployee.activeRatio
      });
    }

    // GET /api/v1/employee/me/tasks
    if (endpoint === "/employee/me/tasks") {
      const alexTasks = state.tasks.filter(t => t.assignedTo === state.currentEmployee.id);
      return Promise.resolve(alexTasks);
    }

    // GET /api/v1/manager/team
    if (endpoint === "/manager/team") {
      return Promise.resolve(state.employees);
    }

    // GET /api/v1/manager/workload
    if (endpoint === "/manager/workload") {
      const totalCapacity = state.employees.reduce((acc, e) => acc + e.capacityHours, 0);
      const totalRemaining = state.employees.reduce((acc, e) => acc + e.remainingHours, 0);
      const avgWorkload = Math.round(state.employees.reduce((acc, e) => acc + e.workload, 0) / state.employees.length);
      const overloadedCount = state.employees.filter(e => e.workload >= 85).length;
      return Promise.resolve({
        average_workload: avgWorkload,
        total_employees: state.employees.length,
        overloaded_employees: overloadedCount,
        active_tasks: state.tasks.filter(t => t.status !== "COMPLETED").length,
        total_capacity_hours: totalCapacity,
        total_assigned_hours: totalRemaining,
        expected_spare_capacity: Math.max(0, totalCapacity - totalRemaining)
      });
    }

    // GET /api/v1/manager/employees/:id
    if (endpoint.startsWith("/manager/employees/")) {
      const id = parseInt(endpoint.split("/").pop(), 10);
      const emp = state.employees.find(e => e.id === id) || state.employees[0];
      const empTasks = state.tasks.filter(t => t.assignedTo === id);
      return Promise.resolve({
        ...emp,
        tasks: empTasks
      });
    }

    // POST /api/v1/tasks
    if (endpoint === "/tasks" && method === "POST") {
      const taskPayload = JSON.parse(options.body || "{}");
      const newTask = {
        id: Date.now(),
        title: taskPayload.title || "Untitled Task",
        description: taskPayload.description || "",
        assignedTo: taskPayload.assigned_to || null,
        assignedToName: taskPayload.assigned_to_name || (taskPayload.assigned_to ? "Alex Johnson" : "Unassigned"),
        priority: taskPayload.priority || "MEDIUM",
        complexity: taskPayload.complexity || "MEDIUM",
        estimatedHours: Number(taskPayload.estimated_hours) || 8,
        actualHours: 0,
        remainingHours: Number(taskPayload.estimated_hours) || 8,
        deadline: taskPayload.deadline || "2026-09-15",
        status: "TODO"
      };

      state.tasks.unshift(newTask);

      // If assigned to an employee, dynamically update employee workload!
      if (newTask.assignedTo) {
        updateAssignedWorkload(state, newTask.assignedTo, newTask.estimatedHours, newTask.title);
      }

      saveSharedState(state);
      return Promise.resolve(newTask);
    }

    // PATCH /api/v1/tasks/:id
    if (endpoint.startsWith("/tasks/") && method === "PATCH") {
      const id = parseInt(endpoint.split("/")[2], 10);
      const updates = JSON.parse(options.body || "{}");
      const taskIndex = state.tasks.findIndex(t => t.id === id);

      if (taskIndex !== -1) {
        // If status changed to COMPLETED, free up remaining hours!
        if (updates.status === "COMPLETED" && state.tasks[taskIndex].status !== "COMPLETED") {
          const hoursFreed = state.tasks[taskIndex].remainingHours;
          state.tasks[taskIndex].remainingHours = 0;
          state.tasks[taskIndex].status = "COMPLETED";

          const assignedId = state.tasks[taskIndex].assignedTo;
          if (assignedId) {
            reduceAssignedWorkload(state, assignedId, hoursFreed);
          }
        } else {
          state.tasks[taskIndex] = { ...state.tasks[taskIndex], ...updates };
        }

        saveSharedState(state);
        return Promise.resolve(state.tasks[taskIndex]);
      }
      return Promise.reject(new Error("Task not found"));
    }

    return Promise.resolve({ ok: true });
  }

  // Workload update helper upon new task assignment (The Hackathon WOW effect)
  function updateAssignedWorkload(state, employeeId, additionalHours, taskTitle) {
    // 1. Update in manager employees list
    const emp = state.employees.find(e => e.id === employeeId);
    if (emp) {
      emp.remainingHours = parseFloat((emp.remainingHours + additionalHours).toFixed(1));
      emp.tasksCount += 1;
      emp.workload = calculateWorkload(emp.remainingHours, emp.capacityHours);
      emp.status = getWorkloadClassification(emp.workload).label;
    }

    // 2. If assigned to Alex Johnson (id 17), update employee dashboard view model too
    if (employeeId === state.currentEmployee.id || employeeId === 17) {
      state.currentEmployee.remainingHours = parseFloat((state.currentEmployee.remainingHours + additionalHours).toFixed(1));
      state.currentEmployee.workload = calculateWorkload(state.currentEmployee.remainingHours, state.currentEmployee.capacityHours);
      
      // Push notification to employee
      state.notifications.unshift({
        id: Date.now(),
        type: "TASK_ASSIGNED",
        title: "New Task Assigned",
        message: `Task "${taskTitle}" (${additionalHours}h) has been assigned to you.`,
        time: "Just now",
        read: false,
        iconType: "task"
      });
    }

    // 3. Add manager notification
    state.managerNotifications.unshift({
      id: Date.now(),
      type: "TASK_ASSIGNED",
      title: "Task Assigned",
      message: `Task "${taskTitle}" assigned to ${emp ? emp.name : "employee"}.`,
      time: "Just now",
      read: false,
      iconType: "task"
    });
  }

  function reduceAssignedWorkload(state, employeeId, hoursFreed) {
    const emp = state.employees.find(e => e.id === employeeId);
    if (emp) {
      emp.remainingHours = Math.max(0, parseFloat((emp.remainingHours - hoursFreed).toFixed(1)));
      emp.tasksCompleted += 1;
      emp.workload = calculateWorkload(emp.remainingHours, emp.capacityHours);
      emp.status = getWorkloadClassification(emp.workload).label;
    }

    if (employeeId === state.currentEmployee.id || employeeId === 17) {
      state.currentEmployee.remainingHours = Math.max(0, parseFloat((state.currentEmployee.remainingHours - hoursFreed).toFixed(1)));
      state.currentEmployee.tasksCompleted += 1;
      state.currentEmployee.workload = calculateWorkload(state.currentEmployee.remainingHours, state.currentEmployee.capacityHours);
    }
  }

  // Public API methods
  window.TIC_API = {
    // State management
    getState: getSharedState,
    saveState: saveSharedState,
    resetState: function() {
      saveSharedState(DEFAULT_STATE);
      return JSON.parse(JSON.stringify(DEFAULT_STATE));
    },

    // Workload & Recommendation Helpers
    calculateWorkload,
    getWorkloadClassification,
    generateRecommendations: generateRecommendationsForTask,

    // Employee Endpoints
    getEmployeeDashboard: () => request("/employee/me/dashboard"),
    getEmployeeMetrics: (from, to) => request(`/employee/me/metrics?from=${from || ''}&to=${to || ''}`),
    getEmployeeTasks: () => request("/employee/me/tasks"),

    // Manager Endpoints
    getManagerTeam: () => request("/manager/team"),
    getManagerEmployee: (id) => request(`/manager/employees/${id}`),
    getManagerWorkload: () => request("/manager/workload"),
    getTaskRecommendations: (taskId) => request(`/tasks/${taskId}/recommendations`),

    // Task Actions
    createTask: (payload) => request("/tasks", { method: "POST", body: JSON.stringify(payload) }),
    updateTask: (taskId, payload) => request(`/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(payload) }),

    // Custom helper to assign a task
    assignTask: async function(taskId, employeeId, employeeName) {
      const state = getSharedState();
      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        task.assignedTo = employeeId;
        task.assignedToName = employeeName;
        updateAssignedWorkload(state, employeeId, task.remainingHours || task.estimatedHours, task.title);
        saveSharedState(state);
        return task;
      }
      return null;
    }
  };

})(window);
