-- TIC MVP schema. Run this before backend/fixtures/seed.sql.
-- Enum values enforced here (via CHECK) must stay in sync with shared/constants.json —
-- see docs/CONTRACT_CHANGE_PROCESS.md before changing any of them.

CREATE TABLE organizations (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE departments (
  id                SERIAL PRIMARY KEY,
  organization_id   INTEGER NOT NULL REFERENCES organizations(id),
  name              VARCHAR NOT NULL
);

CREATE TABLE users (
  id                SERIAL PRIMARY KEY,
  organization_id   INTEGER NOT NULL REFERENCES organizations(id),
  department_id     INTEGER REFERENCES departments(id),
  manager_id        INTEGER REFERENCES users(id),
  name              VARCHAR NOT NULL,
  email             VARCHAR NOT NULL UNIQUE,
  password_hash     VARCHAR NOT NULL,
  role              VARCHAR NOT NULL CHECK (role IN ('EMPLOYEE','MANAGER','ADMIN')),
  status            VARCHAR NOT NULL DEFAULT 'ACTIVE',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE devices (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  device_name     VARCHAR NOT NULL,
  os              VARCHAR NOT NULL CHECK (os IN ('WINDOWS','MACOS','LINUX')),
  agent_version   VARCHAR NOT NULL,
  last_seen       TIMESTAMPTZ,
  status          VARCHAR NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE applications (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR NOT NULL,
  process_name    VARCHAR NOT NULL,
  category        VARCHAR NOT NULL CHECK (category IN
                    ('development','browser','communication','data_office','documentation','presentation','other'))
);

CREATE TABLE work_sessions (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  device_id       INTEGER NOT NULL REFERENCES devices(id),
  start_time      TIMESTAMPTZ NOT NULL,
  end_time        TIMESTAMPTZ,
  active_seconds  INTEGER NOT NULL DEFAULT 0,
  idle_seconds    INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE application_sessions (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  device_id         INTEGER NOT NULL REFERENCES devices(id),
  application_id    INTEGER NOT NULL REFERENCES applications(id),
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ,
  duration_seconds  INTEGER NOT NULL DEFAULT 0,
  work_session_id   INTEGER REFERENCES work_sessions(id)
);

CREATE TABLE process_resource_metrics (
  id                        SERIAL PRIMARY KEY,
  application_session_id    INTEGER NOT NULL REFERENCES application_sessions(id),
  user_id                   INTEGER NOT NULL REFERENCES users(id),
  device_id                 INTEGER NOT NULL REFERENCES devices(id),
  window_start              TIMESTAMPTZ NOT NULL,
  window_end                TIMESTAMPTZ NOT NULL,
  avg_cpu_percent           NUMERIC(5,2) NOT NULL CHECK (avg_cpu_percent BETWEEN 0 AND 100),
  max_cpu_percent           NUMERIC(5,2) NOT NULL CHECK (max_cpu_percent BETWEEN 0 AND 100),
  avg_gpu_percent           NUMERIC(5,2) NOT NULL CHECK (avg_gpu_percent BETWEEN 0 AND 100),
  max_gpu_percent           NUMERIC(5,2) NOT NULL CHECK (max_gpu_percent BETWEEN 0 AND 100),
  sample_count              INTEGER NOT NULL CHECK (sample_count >= 1)
);

CREATE TABLE browser_tab_sessions (
  id                        SERIAL PRIMARY KEY,
  application_session_id    INTEGER NOT NULL REFERENCES application_sessions(id),
  user_id                   INTEGER NOT NULL REFERENCES users(id),
  device_id                 INTEGER NOT NULL REFERENCES devices(id),
  domain                    VARCHAR NOT NULL,
  start_time                TIMESTAMPTZ NOT NULL,
  end_time                  TIMESTAMPTZ NOT NULL,
  duration_seconds          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE context_switch_events (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  device_id         INTEGER NOT NULL REFERENCES devices(id),
  work_session_id   INTEGER REFERENCES work_sessions(id),
  switch_type       VARCHAR NOT NULL CHECK (switch_type IN ('APP','TAB')),
  from_context      VARCHAR NOT NULL,
  to_context        VARCHAR NOT NULL,
  timestamp         TIMESTAMPTZ NOT NULL
);

CREATE TABLE input_activity_windows (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users(id),
  device_id           INTEGER NOT NULL REFERENCES devices(id),
  window_start        TIMESTAMPTZ NOT NULL,
  window_end          TIMESTAMPTZ NOT NULL,
  keystroke_count     INTEGER NOT NULL DEFAULT 0,
  mouse_event_count   INTEGER NOT NULL DEFAULT 0,
  active_seconds      INTEGER NOT NULL DEFAULT 0,
  idle_seconds        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tasks (
  id                SERIAL PRIMARY KEY,
  organization_id   INTEGER NOT NULL REFERENCES organizations(id),
  assigned_to       INTEGER REFERENCES users(id),
  created_by        INTEGER NOT NULL REFERENCES users(id),
  title             VARCHAR NOT NULL,
  description       TEXT,
  complexity        VARCHAR CHECK (complexity IN ('LOW','MEDIUM','HIGH')),
  estimated_hours   NUMERIC(6,2) NOT NULL,
  actual_hours      NUMERIC(6,2),
  status            VARCHAR NOT NULL DEFAULT 'TODO'
                      CHECK (status IN ('TODO','IN_PROGRESS','COMPLETED','BLOCKED','OVERDUE')),
  priority          VARCHAR CHECK (priority IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  deadline          DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at      TIMESTAMPTZ
);

CREATE TABLE work_metrics (
  id                        SERIAL PRIMARY KEY,
  user_id                   INTEGER NOT NULL REFERENCES users(id),
  date                      DATE NOT NULL,
  active_seconds            INTEGER NOT NULL DEFAULT 0,
  idle_seconds              INTEGER NOT NULL DEFAULT 0,
  total_work_seconds        INTEGER NOT NULL DEFAULT 0,
  app_switch_count          INTEGER NOT NULL DEFAULT 0,
  tab_switch_count          INTEGER NOT NULL DEFAULT 0,
  keystroke_count           INTEGER NOT NULL DEFAULT 0,
  mouse_event_count         INTEGER NOT NULL DEFAULT 0,
  avg_cpu_percent           NUMERIC(5,2),
  avg_gpu_percent           NUMERIC(5,2),
  session_count             INTEGER NOT NULL DEFAULT 0,
  average_session_seconds   INTEGER NOT NULL DEFAULT 0,
  tasks_completed           INTEGER NOT NULL DEFAULT 0,
  tasks_overdue             INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, date)
);

CREATE TABLE employee_baselines (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES users(id),
  metric                VARCHAR NOT NULL,
  baseline_value        NUMERIC(10,4) NOT NULL,
  standard_deviation    NUMERIC(10,4),
  calculated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workload_snapshots (
  id                      SERIAL PRIMARY KEY,
  user_id                 INTEGER NOT NULL REFERENCES users(id),
  timestamp               TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_hours          NUMERIC(6,2) NOT NULL,
  remaining_hours         NUMERIC(6,2) NOT NULL,
  available_hours         NUMERIC(6,2) NOT NULL,
  workload_percentage     NUMERIC(6,2) NOT NULL
);

CREATE TABLE recommendations (
  id                    SERIAL PRIMARY KEY,
  task_id               INTEGER NOT NULL REFERENCES tasks(id),
  employee_id           INTEGER NOT NULL REFERENCES users(id),
  score                 NUMERIC(5,2) NOT NULL,
  skill_score           NUMERIC(5,2),
  availability_score    NUMERIC(5,2),
  efficiency_score      NUMERIC(5,2),
  workload_score        NUMERIC(5,2),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reports (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  generated_by    INTEGER NOT NULL REFERENCES users(id),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  report_data     JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  type          VARCHAR NOT NULL CHECK (type IN
                  ('WORKLOAD_HIGH','WORKLOAD_OVERLOADED','TASK_DEADLINE','TASK_ASSIGNED','TASK_COMPLETED')),
  message       VARCHAR NOT NULL,
  read          BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  action        VARCHAR NOT NULL,
  target_type   VARCHAR NOT NULL,
  target_id     INTEGER NOT NULL,
  timestamp     TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata      JSONB
);

-- Helpful indexes for the query patterns the dashboards will actually use
CREATE INDEX idx_work_metrics_user_date ON work_metrics(user_id, date);
CREATE INDEX idx_application_sessions_user ON application_sessions(user_id, start_time);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to, status);
CREATE INDEX idx_context_switch_events_user ON context_switch_events(user_id, timestamp);
