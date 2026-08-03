CREATE TABLE IF NOT EXISTS ownership_passports(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT,
  organization_id TEXT,
  invited_email_hash TEXT,
  invited_email_hint TEXT,
  connection_code_hash TEXT UNIQUE,
  created_by TEXT NOT NULL CHECK(created_by IN ('buyer','company')),
  kind TEXT NOT NULL CHECK(kind IN ('product','service','subscription','booking','rental','project')),
  title TEXT NOT NULL,
  business_name TEXT,
  reference TEXT,
  purchased_on TEXT,
  return_by TEXT,
  warranty_until TEXT,
  renewal_at TEXT,
  next_action_at TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK(status IN ('draft','invited','connected','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS passport_commitments(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  passport_id TEXT NOT NULL,
  buyer_account_id TEXT,
  organization_id TEXT NOT NULL,
  commitment_type TEXT NOT NULL,
  title TEXT NOT NULL,
  due_at TEXT,
  status TEXT NOT NULL DEFAULT 'promised' CHECK(status IN ('promised','in_progress','completed','missed','cancelled','disputed')),
  evidence_note TEXT,
  created_by_member_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS passport_public_shares(
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  passport_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ownership_buyer ON ownership_passports(buyer_account_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ownership_org ON ownership_passports(organization_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_commitment_passport ON passport_commitments(passport_id,created_at);
CREATE INDEX IF NOT EXISTS idx_commitment_buyer ON passport_commitments(buyer_account_id,due_at);
CREATE INDEX IF NOT EXISTS idx_passport_share_passport ON passport_public_shares(passport_id,created_at DESC);
PRAGMA optimize;
