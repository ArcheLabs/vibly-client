-- Local event cache
CREATE TABLE IF NOT EXISTS local_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  actor_id TEXT,
  correlation_id TEXT,
  envelope_json TEXT NOT NULL,
  synced_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_events_type ON local_events(type);
CREATE INDEX IF NOT EXISTS idx_local_events_timestamp ON local_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_local_events_correlation ON local_events(correlation_id);

-- Generic entity cache (projects, agents, work orders, etc.)
CREATE TABLE IF NOT EXISTS local_entities (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);

CREATE INDEX IF NOT EXISTS idx_local_entities_kind ON local_entities(kind);

-- Sync cursors
CREATE TABLE IF NOT EXISTS sync_state (
  scope TEXT PRIMARY KEY,
  cursor TEXT,
  last_synced_at TEXT,
  metadata_json TEXT
);

-- Runtime execution history
CREATE TABLE IF NOT EXISTS runtime_runs (
  id TEXT PRIMARY KEY,
  work_order_id TEXT,
  runtime_binding_id TEXT,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  input_json TEXT,
  output_json TEXT,
  execution_receipt_json TEXT,
  logs_path TEXT,
  error_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_runtime_runs_work_order ON runtime_runs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_runtime_runs_status ON runtime_runs(status);

-- Local runtime registry
CREATE TABLE IF NOT EXISTS local_runtimes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  runtime_type TEXT NOT NULL,
  command TEXT,
  env_json TEXT,
  timeout_ms INTEGER,
  capabilities_json TEXT,
  agent_id TEXT,
  runtime_binding_id TEXT,
  registered_at TEXT NOT NULL
);

-- v0.2: Organization cache
CREATE TABLE IF NOT EXISTS local_organizations (
  id TEXT PRIMARY KEY,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- v0.2: Handbook cache (per project)
CREATE TABLE IF NOT EXISTS local_handbooks (
  scope TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (scope, scope_id)
);

-- v0.2: Mechanism cache
CREATE TABLE IF NOT EXISTS local_mechanisms (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_mechanisms_org ON local_mechanisms(organization_id);

-- v0.2: Queue items (obligations, observations, discussions, tasks, reviews, votes)
CREATE TABLE IF NOT EXISTS local_queue_items (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  payload_json TEXT NOT NULL,
  assigned_at TEXT,
  deadline TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_local_queue_items_kind ON local_queue_items(kind, status);
