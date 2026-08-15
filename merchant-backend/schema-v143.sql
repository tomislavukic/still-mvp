-- Phase 8 Anticipation Engine. Additive Buyer-private persistence.
CREATE TABLE IF NOT EXISTS world_events(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  provenance_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anticipation_signals(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  effective_at TEXT,
  expires_at TEXT,
  confidence TEXT NOT NULL CHECK(confidence IN ('HIGH','MEDIUM','LOW')),
  payload_json TEXT NOT NULL DEFAULT '{}',
  source_json TEXT NOT NULL DEFAULT '{}',
  dedupe_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anticipation_candidates(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  candidate_type TEXT NOT NULL,
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  why_now TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK(confidence IN ('HIGH','MEDIUM','LOW')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','CONFIRMED','DISMISSED','SNOOZED','EXPIRED','AUTO_CONFIRMED_ALLOWED')),
  proposed_need_type TEXT,
  proposed_need_payload_json TEXT NOT NULL DEFAULT '{}',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  dedupe_key TEXT NOT NULL UNIQUE,
  snoozed_until TEXT,
  reviewed_at TEXT,
  linked_need_id TEXT,
  last_notified_at TEXT,
  notification_count INTEGER NOT NULL DEFAULT 0,
  next_allowed_notification_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anticipation_candidate_signals(
  candidate_id TEXT NOT NULL,
  signal_id TEXT NOT NULL,
  PRIMARY KEY(candidate_id, signal_id)
);

CREATE TABLE IF NOT EXISTS attention_items(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  attention_type TEXT NOT NULL,
  title TEXT NOT NULL,
  explanation TEXT NOT NULL,
  why_now TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  source_entity_type TEXT NOT NULL,
  source_entity_id TEXT NOT NULL,
  evidence_json TEXT NOT NULL DEFAULT '[]',
  effective_at TEXT,
  expires_at TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  dedupe_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anticipation_feedback(
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  action TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_world_schedules(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  owner_user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  schedule_type TEXT NOT NULL,
  interval_unit TEXT NOT NULL,
  interval_value INTEGER NOT NULL CHECK(interval_value > 0),
  next_due_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS anticipation_preferences(
  owner_user_id TEXT PRIMARY KEY,
  proactive_enabled INTEGER NOT NULL DEFAULT 1,
  warranty_enabled INTEGER NOT NULL DEFAULT 1,
  returns_enabled INTEGER NOT NULL DEFAULT 1,
  service_enabled INTEGER NOT NULL DEFAULT 1,
  open_loops_enabled INTEGER NOT NULL DEFAULT 1,
  market_wants_enabled INTEGER NOT NULL DEFAULT 1,
  product_notices_enabled INTEGER NOT NULL DEFAULT 1,
  user_schedules_enabled INTEGER NOT NULL DEFAULT 1,
  quiet_start TEXT,
  quiet_end TEXT,
  lead_times_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_events_owner_time ON world_events(owner_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ant_signals_owner_status ON anticipation_signals(owner_user_id,status,effective_at);
CREATE INDEX IF NOT EXISTS idx_ant_candidates_owner_status ON anticipation_candidates(owner_user_id,status,snoozed_until,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attention_owner_status ON attention_items(owner_user_id,status,effective_at);
CREATE INDEX IF NOT EXISTS idx_ant_feedback_candidate ON anticipation_feedback(owner_user_id,candidate_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_schedules_due ON user_world_schedules(active,next_due_at,owner_user_id);
PRAGMA optimize;
