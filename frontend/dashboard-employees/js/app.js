/**
 * TICK - Core Shared State & Application Service
 * "Work smarter. Distribute better."
 */

(function(window) {
  'use strict';

  const STORAGE_KEY = 'tick_workforce_state_v2';

  const INITIAL_STATE = {
    admin: {
      name: "Elena Rostova",
      role: "Engineering Lead",
      totalEmployees: 24,
      totalTasks: 38,
      needAttentionCount: 3
    },
    employees: [
      {
        id: "alex",
        empId: "EMP-1024",
        name: "Alex Johnson",
        role: "Software Developer",
        department: "Engineering",
        workload: 72,
        remainingHours: 17.8,
        capacityHours: 25.0,
        activeTime: "5h 42m",
        idleTime: "48m",
        tasksCount: 4,
        completedCount: 2,
        status: "Active",
        statusClass: "normal",
        skillScore: 94,
        availabilityScore: 82,
        efficiencyScore: 90,
        deadlineFit: 88,
        matchScore: 89,
        whyReasons: [
          "Strong historical skill match in backend & API infrastructure",
          "Good available capacity (7.2h buffer before attention limit)",
          "Strong historical completion velocity on similar tasks",
          "Target deadline is compatible with recent work session distribution"
        ]
      },
      {
        id: "sarah",
        empId: "EMP-1031",
        name: "Sarah Patel",
        role: "UI Designer",
        department: "Design",
        workload: 45,
        remainingHours: 8.2,
        capacityHours: 20.0,
        activeTime: "4h 15m",
        idleTime: "30m",
        tasksCount: 3,
        completedCount: 5,
        status: "Active",
        statusClass: "low",
        skillScore: 82,
        availabilityScore: 88,
        efficiencyScore: 80,
        deadlineFit: 84,
        matchScore: 82,
        whyReasons: [
          "High available spare capacity (11.8h buffer)",
          "Consistent design system delivery cadence"
        ]
      },
      {
        id: "rahul",
        empId: "EMP-1019",
        name: "Rahul Shah",
        role: "Backend Developer",
        department: "Engineering",
        workload: 91,
        remainingHours: 20.4,
        capacityHours: 22.0,
        activeTime: "6h 10m",
        idleTime: "50m",
        tasksCount: 6,
        completedCount: 3,
        status: "Needs attention",
        statusClass: "attention",
        skillScore: 88,
        availabilityScore: 60,
        efficiencyScore: 85,
        deadlineFit: 78,
        matchScore: 76,
        whyReasons: [
          "High skill relevance, but workload currently near capacity limit"
        ]
      },
      {
        id: "john",
        empId: "EMP-1044",
        name: "John Doe",
        role: "Fullstack Engineer",
        department: "Engineering",
        workload: 64,
        remainingHours: 12.5,
        capacityHours: 20.0,
        activeTime: "5h 10m",
        idleTime: "40m",
        tasksCount: 3,
        completedCount: 4,
        status: "Active",
        statusClass: "normal",
        skillScore: 80,
        availabilityScore: 75,
        efficiencyScore: 82,
        deadlineFit: 80,
        matchScore: 78,
        whyReasons: [
          "Balanced capacity and reliable multi-tier delivery"
        ]
      }
    ],
    tasks: [
      {
        id: "task-101",
        title: "Build Payment API",
        type: "Development",
        priority: "HIGH",
        estimatedHours: 8,
        deadline: "September 10",
        assignedTo: "alex",
        assignedToName: "Alex Johnson",
        status: "IN PROGRESS",
        completedAt: null,
        timeTaken: null
      },
      {
        id: "task-102",
        title: "Database Schema",
        type: "Architecture",
        priority: "MEDIUM",
        estimatedHours: 6,
        deadline: "September 5",
        assignedTo: "alex",
        assignedToName: "Alex Johnson",
        status: "COMPLETED",
        completedAt: "Sep 5, 4:10 PM",
        timeTaken: "5h 32m"
      },
      {
        id: "task-103",
        title: "Security & Penetration Testing",
        type: "Testing",
        priority: "HIGH",
        estimatedHours: 5,
        deadline: "September 14",
        assignedTo: "alex",
        assignedToName: "Alex Johnson",
        status: "TODO",
        completedAt: null,
        timeTaken: null
      },
      {
        id: "task-104",
        title: "Design System Token Audit",
        type: "Design",
        priority: "MEDIUM",
        estimatedHours: 4,
        deadline: "September 12",
        assignedTo: "sarah",
        assignedToName: "Sarah Patel",
        status: "IN PROGRESS",
        completedAt: null,
        timeTaken: null
      }
    ],
    applications: [
      { name: "VS Code", duration: "3h 24m", minutes: 204, lastActive: "4:42 PM", category: "Code" },
      { name: "Chrome", duration: "1h 18m", minutes: 78, lastActive: "3:51 PM", category: "Research & Docs" },
      { name: "Microsoft Teams", duration: "42m", minutes: 42, lastActive: "2:30 PM", category: "Communication" },
      { name: "Excel", duration: "35m", minutes: 35, lastActive: "1:45 PM", category: "Planning" }
    ],
    workPulse: [
      { app: "Chrome", start: "09:00 AM", end: "10:12 AM", duration: "1h 12m", type: "active-work", width: "13%" },
      { app: "VS Code", start: "10:12 AM", end: "11:36 AM", duration: "1h 24m", type: "session-work", width: "16%" },
      { app: "Idle / Break", start: "11:36 AM", end: "12:00 PM", duration: "24m", type: "idle", width: "5%" },
      { app: "VS Code", start: "12:00 PM", end: "01:15 PM", duration: "1h 15m", type: "session-work", width: "14%" },
      { app: "Lunch / Idle", start: "01:15 PM", end: "01:50 PM", duration: "35m", type: "idle", width: "7%" },
      { app: "Microsoft Teams", start: "01:50 PM", end: "02:32 PM", duration: "42m", type: "active-work", width: "8%" },
      { app: "VS Code", start: "02:32 PM", end: "04:00 PM", duration: "1h 28m", type: "session-work", width: "17%" },
      { app: "Excel", start: "04:00 PM", end: "04:20 PM", duration: "20m", type: "active-work", width: "4%" },
      { app: "VS Code", start: "04:20 PM", end: "05:35 PM", duration: "1h 15m", type: "session-work", width: "14%" },
      { app: "Documentation", start: "05:35 PM", end: "06:00 PM", duration: "25m", type: "active-work", width: "5%" }
    ]
  };

  function getState() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) {
      console.warn("Could not read TICK state:", e);
    }
    saveState(INITIAL_STATE);
    return JSON.parse(JSON.stringify(INITIAL_STATE));
  }

  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Could not save TICK state:", e);
    }
  }

  function showToast(message) {
    let toast = document.querySelector('.tick-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'tick-toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.display = 'flex';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
  }

  window.TICK = {
    getState,
    saveState,
    showToast,
    resetState: () => {
      saveState(INITIAL_STATE);
      return JSON.parse(JSON.stringify(INITIAL_STATE));
    }
  };

})(window);
