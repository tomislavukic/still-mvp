CREATE TABLE IF NOT EXISTS world_needs(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  description TEXT,
  need_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  source_type TEXT NOT NULL,
  source_entity_type TEXT,
  source_entity_public_id TEXT,
  situation_id TEXT,
  thing_passport_id TEXT,
  urgency TEXT NOT NULL DEFAULT 'NORMAL',
  confidence TEXT NOT NULL DEFAULT 'CONFIRMED',
  due_at TEXT,
  desired_outcome TEXT,
  budget_min_cents INTEGER,
  budget_max_cents INTEGER,
  currency TEXT,
  deadline TEXT,
  location_mode TEXT,
  required_capabilities_json TEXT NOT NULL DEFAULT '[]',
  category TEXT,
  desired_attributes_json TEXT NOT NULL DEFAULT '[]',
  condition_preference TEXT,
  external_url TEXT,
  problem_description TEXT,
  shareable_brief_json TEXT NOT NULL DEFAULT '{}',
  detected_at TEXT NOT NULL,
  confirmed_at TEXT,
  handling_at TEXT,
  waiting_on TEXT,
  waiting_until TEXT,
  resolved_at TEXT,
  dismissed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_need_links(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  need_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_public_id TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'context',
  created_at TEXT NOT NULL,
  UNIQUE(buyer_account_id,need_id,entity_type,entity_public_id,relationship)
);

CREATE TABLE IF NOT EXISTS world_need_quotes(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  need_id TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  document_id TEXT,
  valid_until TEXT,
  selected_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_resolution_outcomes(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  need_id TEXT NOT NULL,
  resolution_type TEXT NOT NULL,
  summary TEXT NOT NULL,
  cost_cents INTEGER,
  currency TEXT,
  related_thing_passport_id TEXT,
  selected_quote_id TEXT,
  provider_name TEXT,
  feedback TEXT,
  resolved_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_needs_owner ON world_needs(buyer_account_id,status,due_at,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_needs_context ON world_needs(buyer_account_id,thing_passport_id,situation_id,status);
CREATE INDEX IF NOT EXISTS idx_world_needs_duplicate ON world_needs(buyer_account_id,normalized_title,need_type,status);
CREATE INDEX IF NOT EXISTS idx_world_need_links_owner ON world_need_links(buyer_account_id,need_id,entity_type);
CREATE INDEX IF NOT EXISTS idx_world_need_quotes_owner ON world_need_quotes(buyer_account_id,need_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_outcomes_owner ON world_resolution_outcomes(buyer_account_id,need_id,resolved_at DESC);
