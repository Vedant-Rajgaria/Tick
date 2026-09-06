/**
 * TICK - Employee Detail Controller
 * Handles interactive Work Pulse timeline, useful work graph, application statistics,
 * and multi-timeframe switching (Daily / Specific Days / Weekly / Monthly).
 */

(function() {
  'use strict';

  let usefulWorkChart = null;

  // Timeframe datasets for Alex Johnson (and baseline for others)
  const TIMEFRAME_DATA = {
    today: {
      badge: "Daily Resolution",
      rangeText: "Today — 09:00 to 18:00 Cadence",
      workload: 72,
      activeTime: "5h 42m",
      idleTime: "48m",
      totalSession: "6h 30m",
      activeRatio: "87.6%",
      tasksCount: 4,
      timelineLabels: ['09:00', '11:00', '13:00', '15:00', '17:00', '18:00'],
      obsNote: "Work sessions were steady throughout the morning, with concentrated input bursts on payment endpoints.",
      pulse: [
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
      ],
      chartLabels: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
      chartData: [45, 78, 85, 40, 20, 75, 88, 70, 82, 35],
      chartUnit: '% intensity',
      apps: [
        { name: "VS Code", duration: "3h 24m", lastActive: "4:42 PM", category: "Code" },
        { name: "Chrome", duration: "1h 18m", lastActive: "3:51 PM", category: "Research & Docs" },
        { name: "Microsoft Teams", duration: "42m", lastActive: "2:30 PM", category: "Communication" },
        { name: "Excel", duration: "35m", lastActive: "1:45 PM", category: "Planning" }
      ]
    },

    yesterday: {
      badge: "Daily Resolution",
      rangeText: "Yesterday (Sep 5) — 09:00 to 18:00 Cadence",
      workload: 68,
      activeTime: "6h 15m",
      idleTime: "35m",
      totalSession: "6h 50m",
      activeRatio: "91.5%",
      tasksCount: 4,
      timelineLabels: ['09:00', '11:00', '13:00', '15:00', '17:00', '18:00'],
      obsNote: "High sustained input during database schema migration; fewer context switches than recent baseline.",
      pulse: [
        { app: "pgAdmin / DB", start: "09:00 AM", end: "10:30 AM", duration: "1h 30m", type: "session-work", width: "17%" },
        { app: "VS Code", start: "10:30 AM", end: "12:15 PM", duration: "1h 45m", type: "session-work", width: "20%" },
        { app: "Idle / Break", start: "12:15 PM", end: "12:35 PM", duration: "20m", type: "idle", width: "4%" },
        { app: "VS Code", start: "12:35 PM", end: "01:30 PM", duration: "55m", type: "session-work", width: "10%" },
        { app: "Lunch", start: "01:30 PM", end: "01:45 PM", duration: "15m", type: "idle", width: "3%" },
        { app: "Chrome", start: "01:45 PM", end: "02:30 PM", duration: "45m", type: "active-work", width: "8%" },
        { app: "VS Code", start: "02:30 PM", end: "04:30 PM", duration: "2h 00m", type: "session-work", width: "22%" },
        { app: "Microsoft Teams", start: "04:30 PM", end: "04:45 PM", duration: "15m", type: "active-work", width: "3%" },
        { app: "VS Code", start: "04:45 PM", end: "06:00 PM", duration: "1h 15m", type: "session-work", width: "13%" }
      ],
      chartLabels: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
      chartData: [55, 85, 92, 60, 25, 80, 85, 88, 75, 40],
      chartUnit: '% intensity',
      apps: [
        { name: "VS Code", duration: "4h 10m", lastActive: "5:58 PM", category: "Code" },
        { name: "pgAdmin / DB", duration: "1h 05m", lastActive: "10:30 AM", category: "Database" },
        { name: "Chrome", duration: "45m", lastActive: "2:30 PM", category: "Research & Docs" },
        { name: "Microsoft Teams", duration: "15m", lastActive: "4:45 PM", category: "Communication" }
      ]
    },

    sep4: {
      badge: "Daily Resolution",
      rangeText: "Sep 4, 2026 — Architecture & Design Sync",
      workload: 64,
      activeTime: "5h 10m",
      idleTime: "1h 10m",
      totalSession: "6h 20m",
      activeRatio: "81.6%",
      tasksCount: 3,
      timelineLabels: ['09:00', '11:00', '13:00', '15:00', '17:00', '18:00'],
      obsNote: "Higher documentation reading and meeting time; input activity lower due to architectural planning.",
      pulse: [
        { app: "Chrome (OpenAPI)", start: "09:00 AM", end: "10:45 AM", duration: "1h 45m", type: "active-work", width: "20%" },
        { app: "Notion", start: "10:45 AM", end: "11:15 AM", duration: "30m", type: "active-work", width: "6%" },
        { app: "Idle / Reading", start: "11:15 AM", end: "11:55 AM", duration: "40m", type: "idle", width: "8%" },
        { app: "VS Code", start: "11:55 AM", end: "01:10 PM", duration: "1h 15m", type: "session-work", width: "14%" },
        { app: "Lunch / Break", start: "01:10 PM", end: "01:40 PM", duration: "30m", type: "idle", width: "6%" },
        { app: "Microsoft Teams", start: "01:40 PM", end: "02:30 PM", duration: "50m", type: "active-work", width: "10%" },
        { app: "Chrome (Docs)", start: "02:30 PM", end: "03:05 PM", duration: "35m", type: "active-work", width: "7%" },
        { app: "VS Code", start: "03:05 PM", end: "04:40 PM", duration: "1h 35m", type: "session-work", width: "18%" },
        { app: "Slack / Teams", start: "04:40 PM", end: "05:10 PM", duration: "30m", type: "active-work", width: "6%" },
        { app: "Wrap-up", start: "05:10 PM", end: "06:00 PM", duration: "50m", type: "active-work", width: "5%" }
      ],
      chartLabels: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
      chartData: [40, 65, 70, 50, 30, 60, 72, 68, 70, 30],
      chartUnit: '% intensity',
      apps: [
        { name: "Chrome (Docs)", duration: "2h 20m", lastActive: "3:05 PM", category: "Research & Docs" },
        { name: "VS Code", duration: "1h 50m", lastActive: "4:40 PM", category: "Code" },
        { name: "Microsoft Teams", duration: "50m", lastActive: "2:30 PM", category: "Communication" },
        { name: "Notion", duration: "30m", lastActive: "11:15 AM", category: "Planning" }
      ]
    },

    sep3: {
      badge: "Daily Resolution",
      rangeText: "Sep 3, 2026 — Sprint Kickoff",
      workload: 60,
      activeTime: "5h 30m",
      idleTime: "55m",
      totalSession: "6h 25m",
      activeRatio: "85.7%",
      tasksCount: 3,
      timelineLabels: ['09:00', '11:00', '13:00', '15:00', '17:00', '18:00'],
      obsNote: "Normal sprint kickoff cadence with steady task distribution and initial environment setup.",
      pulse: [
        { app: "VS Code", start: "09:00 AM", end: "10:30 AM", duration: "1h 30m", type: "session-work", width: "17%" },
        { app: "Chrome", start: "10:30 AM", end: "11:45 AM", duration: "1h 15m", type: "active-work", width: "14%" },
        { app: "Idle", start: "11:45 AM", end: "12:15 PM", duration: "30m", type: "idle", width: "6%" },
        { app: "VS Code", start: "12:15 PM", end: "01:30 PM", duration: "1h 15m", type: "session-work", width: "14%" },
        { app: "Break", start: "01:30 PM", end: "01:55 PM", duration: "25m", type: "idle", width: "5%" },
        { app: "Microsoft Teams", start: "01:55 PM", end: "02:25 PM", duration: "30m", type: "active-work", width: "6%" },
        { app: "VS Code", start: "02:25 PM", end: "04:30 PM", duration: "2h 05m", type: "session-work", width: "23%" },
        { app: "Terminal", start: "04:30 PM", end: "04:45 PM", duration: "15m", type: "active-work", width: "3%" },
        { app: "Review", start: "04:45 PM", end: "06:00 PM", duration: "1h 15m", type: "active-work", width: "12%" }
      ],
      chartLabels: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
      chartData: [50, 70, 75, 45, 20, 70, 80, 75, 65, 35],
      chartUnit: '% intensity',
      apps: [
        { name: "VS Code", duration: "3h 10m", lastActive: "4:30 PM", category: "Code" },
        { name: "Chrome", duration: "1h 35m", lastActive: "11:45 AM", category: "Research & Docs" },
        { name: "Microsoft Teams", duration: "30m", lastActive: "2:25 PM", category: "Communication" },
        { name: "Terminal", duration: "15m", lastActive: "4:45 PM", category: "System" }
      ]
    },

    this_week: {
      badge: "Weekly Resolution",
      rangeText: "Sprint Iteration (Aug 31 – Sep 6, 2026)",
      workload: 72,
      activeTime: "27h 45m",
      idleTime: "3h 40m",
      totalSession: "31h 25m",
      activeRatio: "88.3%",
      tasksCount: 5,
      timelineLabels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Weekend'],
      obsNote: "Weekly capacity utilization remained balanced. Thursday saw highest focus blocks on Stripe webhooks.",
      pulse: [
        { app: "Monday: Sprint Setup", start: "09:00", end: "18:00", duration: "5.5h Active", type: "session-work", width: "19%" },
        { app: "Break / EOD", start: "Mon", end: "Tue", duration: "Rest", type: "idle", width: "2%" },
        { app: "Tuesday: API Models", start: "09:00", end: "18:00", duration: "5.8h Active", type: "session-work", width: "20%" },
        { app: "Break / EOD", start: "Tue", end: "Wed", duration: "Rest", type: "idle", width: "2%" },
        { app: "Wednesday: Arch Sync", start: "09:00", end: "18:00", duration: "5.2h Active", type: "active-work", width: "18%" },
        { app: "Break / EOD", start: "Wed", end: "Thu", duration: "Rest", type: "idle", width: "2%" },
        { app: "Thursday: Schema Migrations", start: "09:00", end: "18:00", duration: "6.2h Active", type: "session-work", width: "21%" },
        { app: "Break / EOD", start: "Thu", end: "Fri", duration: "Rest", type: "idle", width: "2%" },
        { app: "Friday: Payment Handlers", start: "09:00", end: "18:00", duration: "5.1h Active", type: "session-work", width: "14%" }
      ],
      chartLabels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      chartData: [5.5, 5.8, 5.2, 6.2, 5.1],
      chartUnit: 'hours active',
      apps: [
        { name: "VS Code", duration: "16h 30m", lastActive: "Today 4:42 PM", category: "Code (60%)" },
        { name: "Chrome", duration: "6h 15m", lastActive: "Today 3:51 PM", category: "Research (22%)" },
        { name: "Microsoft Teams", duration: "3h 20m", lastActive: "Today 2:30 PM", category: "Sync (12%)" },
        { name: "Excel & Sheets", duration: "1h 40m", lastActive: "Today 1:45 PM", category: "Planning (6%)" }
      ]
    },

    last_week: {
      badge: "Weekly Resolution",
      rangeText: "Sprint Iteration (Aug 24 – Aug 30, 2026)",
      workload: 65,
      activeTime: "26h 10m",
      idleTime: "4h 15m",
      totalSession: "30h 25m",
      activeRatio: "86.0%",
      tasksCount: 4,
      timelineLabels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Weekend'],
      obsNote: "Consistent pacing across sprint closing; all deliverables reached completion within initial estimates.",
      pulse: [
        { app: "Monday: Auth Refactor", start: "09:00", end: "18:00", duration: "5.2h Active", type: "session-work", width: "19%" },
        { app: "Rest", start: "Mon", end: "Tue", duration: "Rest", type: "idle", width: "2%" },
        { app: "Tuesday: Unit Tests", start: "09:00", end: "18:00", duration: "5.4h Active", type: "session-work", width: "19%" },
        { app: "Rest", start: "Tue", end: "Wed", duration: "Rest", type: "idle", width: "2%" },
        { app: "Wednesday: Review", start: "09:00", end: "18:00", duration: "5.0h Active", type: "active-work", width: "18%" },
        { app: "Rest", start: "Wed", end: "Thu", duration: "Rest", type: "idle", width: "2%" },
        { app: "Thursday: Bug Fixes", start: "09:00", end: "18:00", duration: "5.6h Active", type: "session-work", width: "20%" },
        { app: "Rest", start: "Thu", end: "Fri", duration: "Rest", type: "idle", width: "2%" },
        { app: "Friday: Sprint Retro", start: "09:00", end: "18:00", duration: "4.9h Active", type: "active-work", width: "16%" }
      ],
      chartLabels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      chartData: [5.2, 5.4, 5.0, 5.6, 4.9],
      chartUnit: 'hours active',
      apps: [
        { name: "VS Code", duration: "15h 10m", lastActive: "Aug 30", category: "Code (58%)" },
        { name: "Chrome", duration: "7h 00m", lastActive: "Aug 30", category: "Research (27%)" },
        { name: "Microsoft Teams", duration: "2h 45m", lastActive: "Aug 29", category: "Communication (11%)" },
        { name: "Terminal", duration: "1h 15m", lastActive: "Aug 28", category: "Infrastructure (4%)" }
      ]
    },

    this_month: {
      badge: "Monthly Resolution",
      rangeText: "Month-to-Date (September 2026)",
      workload: 70,
      activeTime: "34h 15m",
      idleTime: "4h 30m",
      totalSession: "38h 45m",
      activeRatio: "88.4%",
      tasksCount: 7,
      timelineLabels: ['Week 1 (Current)', 'Week 2 (Forecast)', 'Week 3 (Forecast)', 'Week 4 (Forecast)'],
      obsNote: "Sprint pacing is well-calibrated; no overload conditions detected month-to-date.",
      pulse: [
        { app: "Week 1 (Payment & DB)", start: "Sep 1", end: "Sep 6", duration: "34.2h Logged", type: "session-work", width: "35%" },
        { app: "Planned buffer", start: "Sep 7", end: "Sep 13", duration: "36.0h Planned", type: "active-work", width: "25%" },
        { app: "Planned sprint 2", start: "Sep 14", end: "Sep 20", duration: "38.0h Planned", type: "active-work", width: "22%" },
        { app: "Sprint closing", start: "Sep 21", end: "Sep 30", duration: "32.0h Planned", type: "active-work", width: "18%" }
      ],
      chartLabels: ['Week 1 (Actual)', 'Week 2 (Target)', 'Week 3 (Target)', 'Week 4 (Target)'],
      chartData: [34.2, 36.0, 38.0, 32.0],
      chartUnit: 'hours committed',
      apps: [
        { name: "VS Code", duration: "21h 10m", lastActive: "Today 4:42 PM", category: "Code (62%)" },
        { name: "Chrome", duration: "8h 05m", lastActive: "Today 3:51 PM", category: "Research (23%)" },
        { name: "Microsoft Teams", duration: "4h 10m", lastActive: "Today 2:30 PM", category: "Sync (11%)" },
        { name: "Excel & Planning", duration: "2h 15m", lastActive: "Today 1:45 PM", category: "Planning (4%)" }
      ]
    },

    last_month: {
      badge: "Monthly Resolution",
      rangeText: "Full Month (August 2026)",
      workload: 68,
      activeTime: "112h 40m",
      idleTime: "16h 20m",
      totalSession: "129h 00m",
      activeRatio: "87.3%",
      tasksCount: 14,
      timelineLabels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      obsNote: "Monthly delivery velocity was 104% of historical team baseline with zero overdue milestones.",
      pulse: [
        { app: "Week 1: Core Engine", start: "Aug 1", end: "Aug 7", duration: "28.5h", type: "session-work", width: "25%" },
        { app: "Week 2: Integrations", start: "Aug 8", end: "Aug 14", duration: "27.8h", type: "session-work", width: "25%" },
        { app: "Week 3: Testing & Security", start: "Aug 15", end: "Aug 21", duration: "29.2h", type: "session-work", width: "25%" },
        { app: "Week 4: Release Cadence", start: "Aug 22", end: "Aug 31", duration: "27.2h", type: "session-work", width: "25%" }
      ],
      chartLabels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
      chartData: [28.5, 27.8, 29.2, 27.2],
      chartUnit: 'hours active',
      apps: [
        { name: "VS Code", duration: "68h 30m", lastActive: "Aug 31", category: "Code (61%)" },
        { name: "Chrome", duration: "26h 10m", lastActive: "Aug 31", category: "Research (23%)" },
        { name: "Microsoft Teams", duration: "12h 40m", lastActive: "Aug 30", category: "Communication (11%)" },
        { name: "Terminal / Tools", duration: "5h 20m", lastActive: "Aug 29", category: "System (5%)" }
      ]
    },

    year_2026: {
      isFuture: false,
      badge: "Annual Aggregate",
      rangeText: "Year-to-Date (January – September 2026)",
      workload: 71,
      workloadLabel: "Annual Workload",
      activeTime: "1,120h",
      idleTime: "162h",
      totalSession: "1,282h",
      activeRatio: "87.4%",
      tasksCount: 112,
      timelineLabels: ['Q1 (Jan–Mar)', 'Q2 (Apr–Jun)', 'Q3 (Jul–Sep)', 'Q4 (Forecast)'],
      obsNote: "Year-to-date velocity is consistent with senior engineering expectations; quarterly output balanced across feature and stability sprints.",
      pulse: [
        { app: "Q1: Architecture & Foundations", start: "Jan 1", end: "Mar 31", duration: "384h Active", type: "session-work", width: "26%" },
        { app: "Q2: Core Platform & Integrations", start: "Apr 1", end: "Jun 30", duration: "392h Active", type: "session-work", width: "26%" },
        { app: "Q3: Payments & Infrastructure", start: "Jul 1", end: "Sep 6", duration: "344h Active", type: "session-work", width: "23%" },
        { app: "Q4: Planned Enterprise Releases", start: "Sep 7", end: "Dec 31", duration: "Pending Telemetry", type: "idle", width: "25%" }
      ],
      chartLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'],
      chartData: [124, 128, 135, 120, 130, 126, 132, 112, 113],
      chartUnit: 'hours active',
      apps: [
        { name: "VS Code", duration: "684h", lastActive: "Sep 6", category: "Code (61%)" },
        { name: "Chrome", duration: "242h", lastActive: "Sep 6", category: "Research (22%)" },
        { name: "Microsoft Teams", duration: "128h", lastActive: "Sep 6", category: "Sync (11%)" },
        { name: "Terminal / Tools", duration: "66h", lastActive: "Sep 5", category: "System (6%)" }
      ]
    },

    year_2025: {
      isFuture: false,
      badge: "Annual Archive",
      rangeText: "Full Year Archive (Jan 1 – Dec 31, 2025)",
      workload: 68,
      workloadLabel: "Annual Workload",
      activeTime: "1,640h",
      idleTime: "210h",
      totalSession: "1,850h",
      activeRatio: "88.6%",
      tasksCount: 164,
      timelineLabels: ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'],
      obsNote: "Completed 2025 performance record. 100% on-time milestone delivery across 4 release cycles.",
      pulse: [
        { app: "Q1 2025", start: "Jan", end: "Mar", duration: "410h", type: "session-work", width: "25%" },
        { app: "Q2 2025", start: "Apr", end: "Jun", duration: "415h", type: "session-work", width: "25%" },
        { app: "Q3 2025", start: "Jul", end: "Sep", duration: "405h", type: "session-work", width: "25%" },
        { app: "Q4 2025", start: "Oct", end: "Dec", duration: "410h", type: "session-work", width: "25%" }
      ],
      chartLabels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      chartData: [132, 130, 140, 138, 142, 135, 145, 128, 136, 140, 134, 140],
      chartUnit: 'hours active',
      apps: [
        { name: "VS Code", duration: "1,015h", lastActive: "Dec 31, 2025", category: "Code (62%)" },
        { name: "Chrome", duration: "360h", lastActive: "Dec 31, 2025", category: "Research (22%)" },
        { name: "Microsoft Teams", duration: "185h", lastActive: "Dec 30, 2025", category: "Sync (11%)" },
        { name: "Terminal / Tools", duration: "80h", lastActive: "Dec 29, 2025", category: "System (5%)" }
      ]
    }
  };

  // State Management
  let currentMode = 'date'; // 'date' | 'week' | 'year'
  const ANCHOR_DATE = '2026-09-06';
  const ANCHOR_WEEK = '2026-W36';
  const ANCHOR_YEAR = 2026;

  document.addEventListener('DOMContentLoaded', () => {
    initEmployeeDetail();
    setupTimeframeListener();
  });

  function initEmployeeDetail() {
    const state = window.TICK.getState();
    const urlParams = new URLSearchParams(window.location.search);
    const empId = urlParams.get('id') || 'alex';

    const emp = state.employees.find(e => e.id === empId) || state.employees[0];

    // Populate Header & Meta
    const nameEl = document.getElementById('profileName');
    const headerNameEl = document.getElementById('headerEmpName');
    const roleDeptEl = document.getElementById('profileRoleDept');
    const empIdEl = document.getElementById('profileEmpId');
    const statusBadge = document.getElementById('profileStatusBadge');

    if (nameEl) nameEl.textContent = emp.name;
    if (headerNameEl) headerNameEl.textContent = emp.name;
    if (roleDeptEl) roleDeptEl.textContent = `${emp.role} • ${emp.department}`;
    if (empIdEl) empIdEl.textContent = `ID: ${emp.empId || 'EMP-1024'}`;
    if (statusBadge) {
      statusBadge.textContent = emp.status || 'Active';
      statusBadge.className = `status-pill ${emp.statusClass || 'normal'}`;
    }

    // Default to 'today' (2026-09-06)
    handleTimeframeChange(false);

    // Assigned Tasks Table
    renderTasks(state.tasks.filter(t => t.assignedTo === emp.id || emp.id === 'alex'));
  }

  function setupTimeframeListener() {
    // Mode Switcher Tabs
    const modeBtnDate = document.getElementById('modeBtnDate');
    const modeBtnWeek = document.getElementById('modeBtnWeek');
    const modeBtnYear = document.getElementById('modeBtnYear');

    const dateGroup = document.getElementById('dateInputGroup');
    const weekGroup = document.getElementById('weekInputGroup');
    const yearGroup = document.getElementById('yearInputGroup');

    function setMode(mode) {
      currentMode = mode;
      [modeBtnDate, modeBtnWeek, modeBtnYear].forEach(btn => {
        if (btn) btn.classList.toggle('active', btn.dataset.mode === mode);
      });

      if (dateGroup) dateGroup.style.display = (mode === 'date') ? 'flex' : 'none';
      if (weekGroup) weekGroup.style.display = (mode === 'week') ? 'flex' : 'none';
      if (yearGroup) yearGroup.style.display = (mode === 'year') ? 'flex' : 'none';

      handleTimeframeChange(true);
    }

    if (modeBtnDate) modeBtnDate.addEventListener('click', () => setMode('date'));
    if (modeBtnWeek) modeBtnWeek.addEventListener('click', () => setMode('week'));
    if (modeBtnYear) modeBtnYear.addEventListener('click', () => setMode('year'));

    // Date Controls (Calendar with infinity support)
    const dateInput = document.getElementById('calendarDateInput');
    const prevDayBtn = document.getElementById('prevDayBtn');
    const nextDayBtn = document.getElementById('nextDayBtn');
    const btnToday = document.getElementById('btnToday');
    const btnYesterday = document.getElementById('btnYesterday');

    if (dateInput) {
      dateInput.addEventListener('change', () => handleTimeframeChange(true));
    }
    if (prevDayBtn) {
      prevDayBtn.addEventListener('click', () => stepDate(-1));
    }
    if (nextDayBtn) {
      nextDayBtn.addEventListener('click', () => stepDate(1));
    }
    if (btnToday) {
      btnToday.addEventListener('click', () => {
        if (dateInput) dateInput.value = ANCHOR_DATE;
        handleTimeframeChange(true);
      });
    }
    if (btnYesterday) {
      btnYesterday.addEventListener('click', () => {
        if (dateInput) dateInput.value = '2026-09-05';
        handleTimeframeChange(true);
      });
    }

    // Weekly Controls (With infinity support)
    const weekInput = document.getElementById('calendarWeekInput');
    const prevWeekBtn = document.getElementById('prevWeekBtn');
    const nextWeekBtn = document.getElementById('nextWeekBtn');
    const btnThisWeek = document.getElementById('btnThisWeek');
    const btnLastWeek = document.getElementById('btnLastWeek');

    if (weekInput) {
      weekInput.addEventListener('change', () => handleTimeframeChange(true));
    }
    if (prevWeekBtn) {
      prevWeekBtn.addEventListener('click', () => stepWeek(-1));
    }
    if (nextWeekBtn) {
      nextWeekBtn.addEventListener('click', () => stepWeek(1));
    }
    if (btnThisWeek) {
      btnThisWeek.addEventListener('click', () => {
        if (weekInput) weekInput.value = ANCHOR_WEEK;
        handleTimeframeChange(true);
      });
    }
    if (btnLastWeek) {
      btnLastWeek.addEventListener('click', () => {
        if (weekInput) weekInput.value = '2026-W35';
        handleTimeframeChange(true);
      });
    }

    // Yearly Controls (With infinity support)
    const yearInput = document.getElementById('calendarYearInput');
    const prevYearBtn = document.getElementById('prevYearBtn');
    const nextYearBtn = document.getElementById('nextYearBtn');
    const btnCurrentYear = document.getElementById('btnCurrentYear');
    const btnPastYear = document.getElementById('btnPastYear');

    if (yearInput) {
      yearInput.addEventListener('input', () => handleTimeframeChange(true));
      yearInput.addEventListener('change', () => handleTimeframeChange(true));
    }
    if (prevYearBtn) {
      prevYearBtn.addEventListener('click', () => stepYear(-1));
    }
    if (nextYearBtn) {
      nextYearBtn.addEventListener('click', () => stepYear(1));
    }
    if (btnCurrentYear) {
      btnCurrentYear.addEventListener('click', () => {
        if (yearInput) yearInput.value = ANCHOR_YEAR;
        handleTimeframeChange(true);
      });
    }
    if (btnPastYear) {
      btnPastYear.addEventListener('click', () => {
        if (yearInput) yearInput.value = 2025;
        handleTimeframeChange(true);
      });
    }
  }

  function stepDate(days) {
    const input = document.getElementById('calendarDateInput');
    if (!input || !input.value) return;
    const parts = input.value.split('-');
    if (parts.length !== 3) return;
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    d.setDate(d.getDate() + days);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    input.value = `${y}-${m}-${day}`;
    handleTimeframeChange(true);
  }

  function stepWeek(delta) {
    const input = document.getElementById('calendarWeekInput');
    if (!input || !input.value) return;
    const match = input.value.match(/^(\d{4})-W(\d{2})$/);
    if (!match) return;
    let year = parseInt(match[1], 10);
    let week = parseInt(match[2], 10) + delta;
    if (week > 52) {
      year += Math.floor((week - 1) / 52);
      week = ((week - 1) % 52) + 1;
    } else if (week < 1) {
      year += Math.floor((week - 1) / 52);
      week = 52 + (week % 52);
      if (week === 0) week = 52;
    }
    input.value = `${year}-W${String(week).padStart(2, '0')}`;
    handleTimeframeChange(true);
  }

  function stepYear(delta) {
    const input = document.getElementById('calendarYearInput');
    if (!input || !input.value) return;
    let y = parseInt(input.value, 10) + delta;
    if (y < 2020) y = 2020;
    input.value = y;
    handleTimeframeChange(true);
  }

  function handleTimeframeChange(showNotification) {
    let tfData = null;

    if (currentMode === 'date') {
      const dateInput = document.getElementById('calendarDateInput');
      const val = dateInput ? dateInput.value : ANCHOR_DATE;

      // Check if FUTURE
      if (val > ANCHOR_DATE) {
        tfData = getEmptyStateData('date', val);
        if (showNotification) window.TICK.showToast(`Future date selected (${val}) — No activity data recorded.`);
      } else if (val === '2026-09-06') {
        tfData = TIMEFRAME_DATA.today;
        if (showNotification) window.TICK.showToast(`Loaded Today's active records (Sep 6, 2026)`);
      } else if (val === '2026-09-05') {
        tfData = TIMEFRAME_DATA.yesterday;
        if (showNotification) window.TICK.showToast(`Loaded Yesterday's records (Sep 5, 2026)`);
      } else if (val === '2026-09-04') {
        tfData = TIMEFRAME_DATA.sep4;
        if (showNotification) window.TICK.showToast(`Loaded Sep 4, 2026 records`);
      } else if (val === '2026-09-03') {
        tfData = TIMEFRAME_DATA.sep3;
        if (showNotification) window.TICK.showToast(`Loaded Sep 3, 2026 records`);
      } else {
        tfData = generatePastDateData(val);
        if (showNotification) window.TICK.showToast(`Loaded historical records for ${val}`);
      }
    } else if (currentMode === 'week') {
      const weekInput = document.getElementById('calendarWeekInput');
      const val = weekInput ? weekInput.value : ANCHOR_WEEK;

      // Check if FUTURE
      if (val > ANCHOR_WEEK) {
        tfData = getEmptyStateData('week', val);
        if (showNotification) window.TICK.showToast(`Future week selected (${val}) — No activity data recorded.`);
      } else if (val === '2026-W36') {
        tfData = TIMEFRAME_DATA.this_week;
        if (showNotification) window.TICK.showToast(`Loaded Current Week records (W36)`);
      } else if (val === '2026-W35') {
        tfData = TIMEFRAME_DATA.last_week;
        if (showNotification) window.TICK.showToast(`Loaded Last Week records (W35)`);
      } else {
        tfData = generatePastWeekData(val);
        if (showNotification) window.TICK.showToast(`Loaded historical week records (${val})`);
      }
    } else if (currentMode === 'year') {
      const yearInput = document.getElementById('calendarYearInput');
      const val = yearInput ? parseInt(yearInput.value, 10) : ANCHOR_YEAR;

      // Check if FUTURE
      if (val > ANCHOR_YEAR) {
        tfData = getEmptyStateData('year', val);
        if (showNotification) window.TICK.showToast(`Future year selected (${val}) — No annual records available.`);
      } else if (val === 2026) {
        tfData = TIMEFRAME_DATA.year_2026;
        if (showNotification) window.TICK.showToast(`Loaded 2026 Year-to-Date records`);
      } else if (val === 2025) {
        tfData = TIMEFRAME_DATA.year_2025;
        if (showNotification) window.TICK.showToast(`Loaded 2025 Annual Archive`);
      } else {
        tfData = generatePastYearData(val);
        if (showNotification) window.TICK.showToast(`Loaded historical archive for year ${val}`);
      }
    }

    if (tfData) {
      applyTimeframeData(tfData);
    }
  }

  function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    const dateObj = new Date(y, m, d);
    const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    let formatted = dateObj.toLocaleDateString('en-US', options);
    if (dateStr === ANCHOR_DATE) formatted += ' (Today)';
    else if (dateStr === '2026-09-05') formatted += ' (Yesterday)';
    return formatted;
  }

  function getEmptyStateData(mode, val) {
    let rangeText = '';
    if (mode === 'date') {
      const formatted = formatDateLabel(val);
      rangeText = `Future Date (${formatted}) — Telemetry has not occurred yet`;
    } else if (mode === 'week') {
      rangeText = `Future Week (${val}) — Telemetry has not occurred yet`;
    } else if (mode === 'year') {
      rangeText = `Future Year (${val}) — No annual records available`;
    }

    return {
      isFuture: true,
      badge: "No Data Available",
      badgeClass: "attention",
      rangeText: rangeText,
      workload: "—",
      workloadLabel: "Projected Workload",
      activeTime: "0h 00m",
      idleTime: "0m",
      totalSession: "0h 00m",
      activeRatio: "0.0%",
      tasksCount: 0,
      obsNote: "No telemetry signals detected. Future timeframes do not contain logged observational sessions.",
      pulse: [],
      chartLabels: [],
      chartData: [],
      chartUnit: '% intensity',
      apps: []
    };
  }

  function generatePastDateData(dateStr) {
    const parts = dateStr.split('-');
    const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);
    const formatted = formatDateLabel(dateStr);

    if (dateStr < '2025-01-15') {
      return {
        isFuture: false,
        badge: "Archived Baseline",
        rangeText: `${formatted} — Pre-Onboarding Archive`,
        workload: "—",
        workloadLabel: "Status",
        activeTime: "0h 00m",
        idleTime: "0m",
        totalSession: "0h 00m",
        activeRatio: "0.0%",
        tasksCount: 0,
        obsNote: "Employee onboarded on January 15, 2025. No observational telemetry recorded prior to this date.",
        timelineLabels: ['09:00', '11:00', '13:00', '15:00', '17:00', '18:00'],
        pulse: [],
        chartLabels: ['09:00', '11:00', '13:00', '15:00', '17:00', '18:00'],
        chartData: [0, 0, 0, 0, 0, 0],
        chartUnit: '% intensity',
        apps: []
      };
    }

    if (isWeekend) {
      return {
        isFuture: false,
        badge: "Weekend Cadence",
        rangeText: `${formatted} — Non-Working Day Telemetry`,
        workload: 18,
        workloadLabel: "Workload",
        activeTime: "1h 15m",
        idleTime: "25m",
        totalSession: "1h 40m",
        activeRatio: "75.0%",
        tasksCount: 0,
        obsNote: "Weekend activity; minimal non-scheduled documentation review recorded.",
        timelineLabels: ['09:00', '11:00', '13:00', '15:00', '17:00', '18:00'],
        pulse: [
          { app: "Idle / Offline", start: "09:00 AM", end: "01:00 PM", duration: "4h 00m", type: "idle", width: "45%" },
          { app: "Chrome (Docs)", start: "01:00 PM", end: "02:15 PM", duration: "1h 15m", type: "active-work", width: "20%" },
          { app: "Idle / Offline", start: "02:15 PM", end: "06:00 PM", duration: "3h 45m", type: "idle", width: "35%" }
        ],
        chartLabels: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
        chartData: [0, 0, 0, 0, 45, 50, 0, 0, 0, 0],
        chartUnit: '% intensity',
        apps: [
          { name: "Chrome (Docs)", duration: "1h 15m", lastActive: "2:15 PM", category: "Research" }
        ]
      };
    }

    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = (hash << 5) - hash + dateStr.charCodeAt(i);
      hash |= 0;
    }
    const absHash = Math.abs(hash);
    const workload = 60 + (absHash % 22);
    const activeMinutes = 310 + (absHash % 85);
    const idleMinutes = 30 + (absHash % 25);
    const totalMinutes = activeMinutes + idleMinutes;
    const activeHours = Math.floor(activeMinutes / 60);
    const activeMins = activeMinutes % 60;
    const ratio = ((activeMinutes / totalMinutes) * 100).toFixed(1) + '%';

    return {
      isFuture: false,
      badge: "Daily Resolution",
      rangeText: `${formatted} — 09:00 to 18:00 Workday Cadence`,
      workload: workload,
      workloadLabel: "Current Workload",
      activeTime: `${activeHours}h ${activeMins}m`,
      idleTime: `${idleMinutes}m`,
      totalSession: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
      activeRatio: ratio,
      tasksCount: 3 + (absHash % 2),
      obsNote: "Consistent input density observed during development blocks; healthy break cadence.",
      timelineLabels: ['09:00', '11:00', '13:00', '15:00', '17:00', '18:00'],
      pulse: [
        { app: "VS Code", start: "09:00 AM", end: "10:45 AM", duration: "1h 45m", type: "session-work", width: "19%" },
        { app: "Chrome", start: "10:45 AM", end: "11:30 AM", duration: "45m", type: "active-work", width: "8%" },
        { app: "Break", start: "11:30 AM", end: "12:00 PM", duration: "30m", type: "idle", width: "6%" },
        { app: "VS Code", start: "12:00 PM", end: "01:30 PM", duration: "1h 30m", type: "session-work", width: "17%" },
        { app: "Lunch", start: "01:30 PM", end: "02:05 PM", duration: "35m", type: "idle", width: "6%" },
        { app: "Microsoft Teams", start: "02:05 PM", end: "02:45 PM", duration: "40m", type: "active-work", width: "7%" },
        { app: "VS Code", start: "02:45 PM", end: "04:30 PM", duration: "1h 45m", type: "session-work", width: "19%" },
        { app: "Terminal / Review", start: "04:30 PM", end: "05:15 PM", duration: "45m", type: "active-work", width: "8%" },
        { app: "Wrap-up", start: "05:15 PM", end: "06:00 PM", duration: "45m", type: "active-work", width: "10%" }
      ],
      chartLabels: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
      chartData: [45, 75, 70, 45, 25, 70, 85, 78, 65, 30],
      chartUnit: '% intensity',
      apps: [
        { name: "VS Code", duration: "3h 45m", lastActive: "4:30 PM", category: "Code" },
        { name: "Chrome", duration: "1h 15m", lastActive: "11:30 AM", category: "Research & Docs" },
        { name: "Microsoft Teams", duration: "40m", lastActive: "2:45 PM", category: "Communication" },
        { name: "Terminal", duration: "30m", lastActive: "5:15 PM", category: "System" }
      ]
    };
  }

  function generatePastWeekData(weekStr) {
    return {
      isFuture: false,
      badge: "Weekly Resolution",
      rangeText: `Historical Sprint (${weekStr})`,
      workload: 67,
      workloadLabel: "Sprint Workload",
      activeTime: "26h 45m",
      idleTime: "3h 50m",
      totalSession: "30h 35m",
      activeRatio: "87.5%",
      tasksCount: 4,
      timelineLabels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      obsNote: "All deliverables met scheduled velocity with normal distribution across development blocks.",
      pulse: [
        { app: "Monday: Architecture", start: "09:00", end: "18:00", duration: "5.4h Active", type: "session-work", width: "20%" },
        { app: "Tuesday: Implementation", start: "09:00", end: "18:00", duration: "5.6h Active", type: "session-work", width: "20%" },
        { app: "Wednesday: Review", start: "09:00", end: "18:00", duration: "5.1h Active", type: "active-work", width: "20%" },
        { app: "Thursday: Testing", start: "09:00", end: "18:00", duration: "5.5h Active", type: "session-work", width: "20%" },
        { app: "Friday: Deployment", start: "09:00", end: "18:00", duration: "5.0h Active", type: "active-work", width: "20%" }
      ],
      chartLabels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      chartData: [5.4, 5.6, 5.1, 5.5, 5.0],
      chartUnit: 'hours active',
      apps: [
        { name: "VS Code", duration: "15h 45m", lastActive: "Friday 5:30 PM", category: "Code (59%)" },
        { name: "Chrome", duration: "6h 20m", lastActive: "Friday 3:15 PM", category: "Research (24%)" },
        { name: "Microsoft Teams", duration: "3h 10m", lastActive: "Friday 2:00 PM", category: "Sync (12%)" },
        { name: "Terminal", duration: "1h 30m", lastActive: "Thursday 4:45 PM", category: "Infrastructure (5%)" }
      ]
    };
  }

  function generatePastYearData(yearVal) {
    if (yearVal < 2025) {
      return {
        isFuture: false,
        badge: "Pre-Onboarding Archive",
        rangeText: `Year ${yearVal} — Prior Organization System`,
        workload: "—",
        workloadLabel: "Status",
        activeTime: "0h 00m",
        idleTime: "0m",
        totalSession: "0h 00m",
        activeRatio: "0.0%",
        tasksCount: 0,
        obsNote: `No observational telemetry logged in TICK prior to employee onboarding (January 2025).`,
        timelineLabels: ['Q1', 'Q2', 'Q3', 'Q4'],
        pulse: [],
        chartLabels: ['Q1', 'Q2', 'Q3', 'Q4'],
        chartData: [0, 0, 0, 0],
        chartUnit: 'hours active',
        apps: []
      };
    }
    return TIMEFRAME_DATA.year_2025;
  }

  function applyTimeframeData(tf) {
    const isFuture = !!tf.isFuture;

    // Update Timeframe bar badge & range label
    const badgeEl = document.getElementById('timeframeBadge');
    const rangeTextEl = document.getElementById('timeframeRangeText');
    if (badgeEl) {
      badgeEl.textContent = tf.badge;
      badgeEl.className = `status-pill ${tf.badgeClass || 'normal'}`;
      if (isFuture) {
        badgeEl.style.backgroundColor = '#FEF3C7';
        badgeEl.style.color = '#92400E';
        badgeEl.style.borderColor = '#FDE68A';
      } else {
        badgeEl.style.backgroundColor = '';
        badgeEl.style.color = '';
        badgeEl.style.borderColor = '';
      }
    }
    if (rangeTextEl) {
      rangeTextEl.textContent = tf.rangeText;
      rangeTextEl.style.color = isFuture ? '#92400E' : '#6B7280';
    }

    // Update Summary Metrics
    const wlEl = document.getElementById('detailWorkload');
    const wlLabelEl = document.getElementById('detailWorkloadLabel');
    const actEl = document.getElementById('detailActiveTime');
    const idleEl = document.getElementById('detailIdleTime');
    const tasksEl = document.getElementById('detailTasksCount');

    if (wlEl) wlEl.textContent = tf.workload === '—' ? '—' : `${tf.workload}%`;
    if (wlLabelEl) wlLabelEl.textContent = tf.workloadLabel || 'Current Workload';
    if (actEl) actEl.textContent = tf.activeTime;
    if (idleEl) idleEl.textContent = tf.idleTime;
    if (tasksEl) tasksEl.textContent = tf.tasksCount;

    // Update Active & Idle Breakdown Card
    const brkAct = document.getElementById('breakdownActiveTime');
    const brkIdle = document.getElementById('breakdownIdleTime');
    const brkTotal = document.getElementById('breakdownTotalSession');
    const brkRatio = document.getElementById('breakdownActiveRatio');
    const brkNote = document.getElementById('breakdownObsNote');

    if (brkAct) brkAct.textContent = tf.activeTime;
    if (brkIdle) brkIdle.textContent = tf.idleTime;
    if (brkTotal) brkTotal.textContent = tf.totalSession;
    if (brkRatio) brkRatio.textContent = tf.activeRatio;
    if (brkNote) brkNote.textContent = `Observational note: ${tf.obsNote}`;

    // Work Pulse Timeline Display / Empty State
    const pulseContainer = document.getElementById('workPulseContainer');
    const pulseEmpty = document.getElementById('workPulseEmptyState');

    if (isFuture) {
      if (pulseContainer) pulseContainer.style.display = 'none';
      if (pulseEmpty) pulseEmpty.style.display = 'flex';
    } else {
      if (pulseContainer) pulseContainer.style.display = 'block';
      if (pulseEmpty) pulseEmpty.style.display = 'none';

      const labelsContainer = document.getElementById('workPulseTimelineLabels');
      if (labelsContainer && tf.timelineLabels) {
        labelsContainer.innerHTML = tf.timelineLabels.map(lbl => `<span>${lbl}</span>`).join('');
      }
      renderWorkPulse(tf.pulse);
    }

    // Useful Work Graph Display / Empty State
    const chartContainer = document.getElementById('usefulWorkChartContainer');
    const chartEmpty = document.getElementById('usefulWorkEmptyState');

    if (isFuture) {
      if (chartContainer) chartContainer.style.display = 'none';
      if (chartEmpty) chartEmpty.style.display = 'flex';
      if (usefulWorkChart) {
        usefulWorkChart.destroy();
        usefulWorkChart = null;
      }
    } else {
      if (chartContainer) chartContainer.style.display = 'block';
      if (chartEmpty) chartEmpty.style.display = 'none';
      renderUsefulWorkGraph(tf.chartLabels, tf.chartData, tf.chartUnit);
    }

    // Application Usage Table
    renderAppUsage(tf.apps, isFuture);
  }

  function renderWorkPulse(segments) {
    const container = document.getElementById('workPulseBar');
    const tooltip = document.getElementById('pulseTooltip');
    const tooltipApp = document.getElementById('tooltipApp');
    const tooltipMeta = document.getElementById('tooltipMeta');

    if (!container) return;

    if (!segments || segments.length === 0) {
      container.innerHTML = `
        <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; color: #9CA3AF;">
          No session blocks recorded
        </div>
      `;
      return;
    }

    container.innerHTML = segments.map((seg, idx) => {
      return `
        <div class="pulse-segment ${seg.type}" 
             data-index="${idx}"
             style="width: ${seg.width};"
             title="${seg.app} (${seg.duration})">
        </div>
      `;
    }).join('');

    // Attach interactive hover & click listeners
    const segEls = container.querySelectorAll('.pulse-segment');
    segEls.forEach(el => {
      el.addEventListener('mouseenter', () => {
        const idx = parseInt(el.getAttribute('data-index'), 10);
        const seg = segments[idx];
        if (!seg || !tooltip || !tooltipApp || !tooltipMeta) return;

        tooltipApp.textContent = `Block: ${seg.app}`;
        tooltipMeta.textContent = `Period: ${seg.start} – ${seg.end} • Duration: ${seg.duration}`;
        
        const rect = el.getBoundingClientRect();
        const parentRect = container.getBoundingClientRect();
        const leftPos = rect.left - parentRect.left + (rect.width / 2) - 80;
        
        tooltip.style.left = `${Math.max(10, Math.min(leftPos, parentRect.width - 240))}px`;
        tooltip.classList.add('visible');
      });

      el.addEventListener('mouseleave', () => {
        if (tooltip) tooltip.classList.remove('visible');
      });

      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-index'), 10);
        const seg = segments[idx];
        if (seg) window.TICK.showToast(`Inspecting: ${seg.app} (${seg.duration})`);
      });
    });
  }

  function renderUsefulWorkGraph(labels, dataPoints, unitLabel) {
    const canvas = document.getElementById('usefulWorkChart');
    if (!canvas || typeof Chart === 'undefined') return;

    if (usefulWorkChart) usefulWorkChart.destroy();

    if (!labels || labels.length === 0 || !dataPoints || dataPoints.length === 0) {
      return;
    }

    const isHourly = labels[0] && labels[0].includes(':');
    const maxVal = Math.max(...dataPoints, 10);
    const maxY = isHourly ? 100 : Math.ceil(maxVal * 1.25);

    usefulWorkChart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: `Activity (${unitLabel || 'Intensity'})`,
          data: dataPoints,
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37, 99, 235, 0.04)',
          borderWidth: 2,
          pointRadius: 3.5,
          pointBackgroundColor: '#2563EB',
          fill: true,
          tension: 0.25
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => `Recorded: ${ctx.raw} ${unitLabel || ''}`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 11, family: 'inherit' } }
          },
          y: {
            min: 0,
            max: maxY,
            ticks: {
              callback: v => isHourly ? `${v}%` : `${v}h`,
              font: { size: 10 }
            },
            grid: { color: '#F3F4F6' }
          }
        }
      }
    });
  }

  function renderAppUsage(apps, isFuture) {
    const tbody = document.getElementById('appUsageTableBody');
    if (!tbody) return;

    if (isFuture || !apps || apps.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; color: #9CA3AF; padding: 2.5rem 1rem; font-size: 0.875rem;">
            No application usage logged for this future period.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = apps.map(app => {
      return `
        <tr>
          <td>
            <strong style="color: #111827;">${app.name}</strong>
            <span style="font-size: 0.75rem; color: #9CA3AF; margin-left: 6px;">${app.category}</span>
          </td>
          <td><strong>${app.duration}</strong></td>
          <td style="color: #6B7280; font-size: 0.8125rem;">Last active ${app.lastActive}</td>
        </tr>
      `;
    }).join('');
  }

  function renderTasks(tasks) {
    const tbody = document.getElementById('employeeTasksTableBody');
    if (!tbody || !tasks) return;

    if (tasks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #6B7280; padding: 1.5rem;">No tasks currently assigned.</td></tr>`;
      return;
    }

    tbody.innerHTML = tasks.map(task => {
      const isCompleted = task.status === 'COMPLETED';
      return `
        <tr>
          <td>
            <strong style="color: #111827;">${task.title}</strong>
            <div style="font-size: 0.75rem; color: #6B7280;">Type: ${task.type || 'Development'}</div>
          </td>
          <td><span class="priority-tag ${task.priority.toLowerCase()}">${task.priority}</span></td>
          <td>${task.estimatedHours}h</td>
          <td>${task.deadline}</td>
          <td>
            <span class="status-pill ${isCompleted ? 'completed' : 'normal'}">
              ${task.status}
            </span>
            ${task.timeTaken ? `<span style="font-size: 0.75rem; color: #059669; margin-left: 6px;">(${task.timeTaken})</span>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  }

})();

