CREATE TABLE IF NOT EXISTS world_thing_profiles(
  passport_id TEXT PRIMARY KEY,
  buyer_account_id TEXT NOT NULL,
  thing_type TEXT NOT NULL DEFAULT 'product',
  category TEXT,
  manufacturer TEXT,
  model TEXT,
  serial_number TEXT,
  gtin TEXT,
  purchase_price_cents INTEGER,
  currency TEXT,
  lifecycle_state TEXT NOT NULL DEFAULT 'OWNED',
  source TEXT NOT NULL DEFAULT 'manual',
  review_status TEXT NOT NULL DEFAULT 'CONFIRMED',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_receipts(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  merchant TEXT,
  purchase_date TEXT,
  currency TEXT,
  subtotal_cents INTEGER,
  tax_cents INTEGER,
  total_cents INTEGER,
  reference TEXT,
  raw_ocr_text TEXT,
  processing_status TEXT NOT NULL,
  processing_error_code TEXT,
  processing_error_message TEXT,
  source_image_key TEXT NOT NULL,
  source_mime_type TEXT NOT NULL,
  source_file_name TEXT NOT NULL,
  source_file_hash TEXT NOT NULL,
  source_file_bytes INTEGER NOT NULL,
  confidence_json TEXT NOT NULL DEFAULT '{}',
  confirmed_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_receipt_items(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  receipt_id TEXT NOT NULL,
  buyer_account_id TEXT NOT NULL,
  raw_label TEXT NOT NULL,
  title TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price_cents INTEGER,
  total_cents INTEGER,
  currency TEXT,
  sku TEXT,
  gtin TEXT,
  manufacturer_candidate TEXT,
  model_candidate TEXT,
  confidence REAL NOT NULL DEFAULT 0,
  disposition TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',
  thing_passport_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_documents(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL DEFAULT 'other',
  mime_type TEXT NOT NULL,
  object_key TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  file_bytes INTEGER NOT NULL,
  extracted_text TEXT,
  processing_status TEXT NOT NULL DEFAULT 'READY',
  processing_error_code TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_knowledge_items(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'note',
  body TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'USER_TEXT',
  source_url TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  source_document_id TEXT,
  thing_passport_id TEXT,
  situation_id TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_situations(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  start_date TEXT,
  due_at TEXT,
  resolved_at TEXT,
  archived_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_open_loops(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  situation_id TEXT,
  thing_passport_id TEXT,
  title TEXT NOT NULL,
  loop_type TEXT NOT NULL DEFAULT 'ACTION',
  status TEXT NOT NULL DEFAULT 'OPEN',
  waiting_on TEXT,
  due_at TEXT,
  notes TEXT,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_relationships(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  from_type TEXT NOT NULL,
  from_public_id TEXT NOT NULL,
  to_type TEXT NOT NULL,
  to_public_id TEXT NOT NULL,
  relationship TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(buyer_account_id,from_type,from_public_id,to_type,to_public_id,relationship)
);

CREATE TABLE IF NOT EXISTS world_evidence(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_public_id TEXT NOT NULL,
  thing_passport_id TEXT,
  receipt_id TEXT,
  document_id TEXT,
  field_name TEXT,
  value_json TEXT,
  provenance TEXT NOT NULL,
  confidence REAL,
  verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_history_events(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_public_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  source_type TEXT,
  source_public_id TEXT,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS world_migrations(
  buyer_account_id TEXT NOT NULL,
  source TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  imported_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at TEXT NOT NULL,
  PRIMARY KEY(buyer_account_id,source,fingerprint)
);

CREATE TABLE IF NOT EXISTS world_rate_limits(
  bucket TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_world_thing_owner ON world_thing_profiles(buyer_account_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_thing_serial ON world_thing_profiles(buyer_account_id,serial_number);
CREATE INDEX IF NOT EXISTS idx_world_thing_gtin ON world_thing_profiles(buyer_account_id,gtin);
CREATE INDEX IF NOT EXISTS idx_world_receipt_owner ON world_receipts(buyer_account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_receipt_hash ON world_receipts(buyer_account_id,source_file_hash);
CREATE INDEX IF NOT EXISTS idx_world_receipt_items_receipt ON world_receipt_items(receipt_id,created_at);
CREATE INDEX IF NOT EXISTS idx_world_documents_owner ON world_documents(buyer_account_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_knowledge_owner ON world_knowledge_items(buyer_account_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_situations_owner ON world_situations(buyer_account_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_loops_owner ON world_open_loops(buyer_account_id,status,due_at);
CREATE INDEX IF NOT EXISTS idx_world_relationships_from ON world_relationships(buyer_account_id,from_type,from_public_id);
CREATE INDEX IF NOT EXISTS idx_world_relationships_to ON world_relationships(buyer_account_id,to_type,to_public_id);
CREATE INDEX IF NOT EXISTS idx_world_evidence_thing ON world_evidence(buyer_account_id,thing_passport_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_history_owner ON world_history_events(buyer_account_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_world_history_entity ON world_history_events(buyer_account_id,entity_type,entity_public_id,occurred_at DESC);
PRAGMA optimize;
