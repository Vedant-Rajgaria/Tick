-- Minimal seed data for local dev / Module D (analytics) / Module E (dashboards).
-- Loaded automatically by docker-compose (postgres init scripts) on first `docker compose up`.
-- IDs are hardcoded intentionally so fixture JSON and this file can cross-reference each other.

INSERT INTO organizations (id, name, created_at) VALUES
  (1, 'Acme Corp', now());

INSERT INTO departments (id, organization_id, name) VALUES
  (1, 1, 'Engineering');

INSERT INTO users (id, organization_id, department_id, manager_id, name, email, password_hash, role, status, created_at) VALUES
  (1, 1, 1, NULL, 'Priya Manager', 'priya@acme.test', 'dev_only_not_a_real_hash', 'MANAGER', 'ACTIVE', now()),
  (2, 1, 1, 1,    'Employee A',    'employee.a@acme.test', 'dev_only_not_a_real_hash', 'EMPLOYEE', 'ACTIVE', now()),
  (3, 1, 1, 1,    'Employee B',    'employee.b@acme.test', 'dev_only_not_a_real_hash', 'EMPLOYEE', 'ACTIVE', now());

INSERT INTO devices (id, user_id, device_name, os, agent_version, last_seen, status) VALUES
  (42, 2, 'DESKTOP-001', 'WINDOWS', '0.1.0', now(), 'ACTIVE'),
  (43, 3, 'LAPTOP-002',  'MACOS',   '0.1.0', now(), 'ACTIVE');

INSERT INTO applications (id, name, process_name, category) VALUES
  (1, 'VS Code', 'Code.exe',   'development'),
  (2, 'Chrome',  'chrome.exe', 'browser'),
  (3, 'Teams',   'Teams.exe',  'communication');

INSERT INTO tasks (id, organization_id, assigned_to, created_by, title, description, complexity, estimated_hours, actual_hours, status, priority, deadline, created_at, completed_at) VALUES
  (1, 1, 2, 1, 'Build payment API', 'Implement payment service', 'HIGH', 8, 5.5, 'IN_PROGRESS', 'HIGH', '2026-09-10', now(), NULL),
  (2, 1, 2, 1, 'Database schema',   'Design initial schema',     'MEDIUM', 4, 4,   'COMPLETED',   'MEDIUM', '2026-09-05', now(), now()),
  (3, 1, 3, 1, 'Write tests',       'Cover payment API',          'LOW', 3, NULL, 'TODO',        'MEDIUM', '2026-09-12', now(), NULL);

INSERT INTO work_sessions (id, user_id, device_id, start_time, end_time, active_seconds, idle_seconds) VALUES
  (1, 2, 42, '2026-09-06T09:00:00Z', '2026-09-06T10:15:00Z', 4020, 480);

INSERT INTO application_sessions (id, user_id, device_id, application_id, start_time, end_time, duration_seconds, work_session_id) VALUES
  (1, 2, 42, 1, '2026-09-06T09:00:00Z', '2026-09-06T09:06:30Z', 390, 1),
  (2, 2, 42, 2, '2026-09-06T09:06:30Z', '2026-09-06T09:10:00Z', 210, 1);

INSERT INTO process_resource_metrics (id, application_session_id, user_id, device_id, window_start, window_end, avg_cpu_percent, max_cpu_percent, avg_gpu_percent, max_gpu_percent, sample_count) VALUES
  (1, 1, 2, 42, '2026-09-06T09:00:00Z', '2026-09-06T09:06:30Z', 11.2, 30.0, 1.2, 4.0, 39),
  (2, 2, 2, 42, '2026-09-06T09:06:30Z', '2026-09-06T09:10:00Z', 9.5,  22.0, 4.0, 12.0, 21);

INSERT INTO browser_tab_sessions (id, application_session_id, user_id, device_id, domain, start_time, end_time, duration_seconds) VALUES
  (1, 2, 2, 42, 'github.com',        '2026-09-06T09:06:30Z', '2026-09-06T09:08:45Z', 135),
  (2, 2, 2, 42, 'stackoverflow.com', '2026-09-06T09:08:45Z', '2026-09-06T09:09:30Z', 45),
  (3, 2, 2, 42, 'docs.google.com',   '2026-09-06T09:09:30Z', '2026-09-06T09:10:00Z', 30);

INSERT INTO context_switch_events (id, user_id, device_id, work_session_id, switch_type, from_context, to_context, timestamp) VALUES
  (1, 2, 42, 1, 'APP', 'VS Code', 'Chrome', '2026-09-06T09:06:30Z'),
  (2, 2, 42, 1, 'TAB', 'github.com', 'stackoverflow.com', '2026-09-06T09:08:45Z'),
  (3, 2, 42, 1, 'TAB', 'stackoverflow.com', 'docs.google.com', '2026-09-06T09:09:30Z');

INSERT INTO input_activity_windows (id, user_id, device_id, window_start, window_end, keystroke_count, mouse_event_count, active_seconds, idle_seconds) VALUES
  (1, 2, 42, '2026-09-06T09:00:00Z', '2026-09-06T09:10:00Z', 750, 205, 530, 70);

INSERT INTO work_metrics (id, user_id, date, active_seconds, idle_seconds, total_work_seconds, app_switch_count, tab_switch_count, keystroke_count, mouse_event_count, avg_cpu_percent, avg_gpu_percent, session_count, average_session_seconds, tasks_completed, tasks_overdue) VALUES
  (1, 2, '2026-09-06', 4020, 480, 4500, 1, 2, 750, 205, 10.4, 2.6, 1, 4500, 1, 0);

INSERT INTO employee_baselines (id, user_id, metric, baseline_value, standard_deviation, calculated_at) VALUES
  (1, 2, 'active_ratio', 0.88, 0.06, now());

INSERT INTO workload_snapshots (id, user_id, timestamp, assigned_hours, remaining_hours, available_hours, workload_percentage) VALUES
  (1, 2, now(), 15, 6.5, 20, 32.5);
