PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS merchant_organizations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  retailer_key TEXT,
  website_url TEXT,
  support_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','suspended')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merchant_members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES merchant_organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL DEFAULT 210000,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('owner','admin','agent','viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merchant_sessions (
  id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL REFERENCES merchant_members(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_merchant_sessions_member ON merchant_sessions(member_id,expires_at);

CREATE TABLE IF NOT EXISTS merchant_api_tokens (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES merchant_organizations(id) ON DELETE CASCADE,
  member_id TEXT REFERENCES merchant_members(id) ON DELETE SET NULL,
  token_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL DEFAULT 'default',
  last_used_at TEXT,
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS consumer_cases (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  organization_id TEXT REFERENCES merchant_organizations(id) ON DELETE SET NULL,
  retailer_key TEXT,
  retailer_name TEXT NOT NULL,
  country_code TEXT NOT NULL,
  purchase_mode TEXT NOT NULL CHECK (purchase_mode IN ('online','store')),
  case_type TEXT NOT NULL CHECK (case_type IN ('return','warranty')),
  purchase_date TEXT NOT NULL,
  product_name TEXT NOT NULL,
  order_reference TEXT,
  serial_number TEXT,
  consumer_email TEXT,
  issue_summary TEXT,
  requested_resolution TEXT,
  proof_type TEXT,
  official_source_url TEXT,
  still_result TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','in_review','waiting_consumer','approved','rejected','repair','replacement','refund','resolved','closed')),
  consumer_access_hash TEXT NOT NULL,
  merchant_last_viewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_cases_org_status ON consumer_cases(organization_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_retailer_status ON consumer_cases(retailer_key,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_consumer_email ON consumer_cases(consumer_email,updated_at DESC);

CREATE TABLE IF NOT EXISTS case_messages (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES consumer_cases(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('consumer','merchant','system')),
  actor_member_id TEXT REFERENCES merchant_members(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL DEFAULT 'note' CHECK (message_type IN ('note','request_info','decision','system')),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_case_messages_case ON case_messages(case_id,created_at ASC);

CREATE TABLE IF NOT EXISTS case_decisions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES consumer_cases(id) ON DELETE CASCADE,
  organization_id TEXT REFERENCES merchant_organizations(id) ON DELETE SET NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN ('accepted','need_more_info','bring_to_store','repair','replacement','refund','rejected','other')),
  reason TEXT,
  service_reference TEXT,
  proposed_resolution TEXT,
  created_by_member_id TEXT REFERENCES merchant_members(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_case_decisions_case ON case_decisions(case_id,created_at DESC);

CREATE TABLE IF NOT EXISTS case_resolutions (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES consumer_cases(id) ON DELETE CASCADE,
  decision_id TEXT REFERENCES case_decisions(id) ON DELETE SET NULL,
  consumer_status TEXT NOT NULL CHECK (consumer_status IN ('accepted','declined','completed')),
  consumer_note TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_case_resolutions_case ON case_resolutions(case_id,created_at DESC);

CREATE TABLE IF NOT EXISTS case_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES consumer_cases(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('consumer','merchant','system')),
  actor_id TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_case_events_case ON case_events(case_id,created_at ASC);

CREATE TABLE IF NOT EXISTS merchant_profiles (
  organization_id TEXT PRIMARY KEY REFERENCES merchant_organizations(id) ON DELETE CASCADE,
  returns_summary TEXT,
  warranty_summary TEXT,
  returns_url TEXT,
  warranty_url TEXT,
  complaint_url TEXT,
  return_address TEXT,
  required_evidence_json TEXT,
  verified_at TEXT,
  verified_by TEXT,
  updated_at TEXT NOT NULL
);
