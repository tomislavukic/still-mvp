CREATE TABLE IF NOT EXISTS esl_connectors (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  vendor TEXT NOT NULL,
  transport TEXT NOT NULL,
  store_reference TEXT,
  payload_format TEXT NOT NULL DEFAULT 'still_json_v1',
  status TEXT NOT NULL DEFAULT 'configured',
  created_by_member_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS esl_labels (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  product_id TEXT,
  connector_id TEXT,
  sku TEXT NOT NULL,
  gtin TEXT,
  product_name TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  original_price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  unit_text TEXT,
  promo_text TEXT,
  legal_text TEXT,
  template TEXT NOT NULL DEFAULT 'retail',
  width_mm REAL NOT NULL,
  height_mm REAL NOT NULL,
  width_px INTEGER NOT NULL,
  height_px INTEGER NOT NULL,
  orientation TEXT NOT NULL DEFAULT 'landscape',
  color_mode TEXT NOT NULL DEFAULT 'mono',
  qr_url TEXT,
  barcode_value TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  last_synced_at TEXT,
  created_by_member_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS esl_price_updates (
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  label_id TEXT NOT NULL,
  old_price_cents INTEGER NOT NULL,
  new_price_cents INTEGER NOT NULL,
  reason TEXT,
  effective_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'export_ready',
  payload_json TEXT NOT NULL,
  created_by_member_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  applied_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_esl_connectors_org_updated
ON esl_connectors(organization_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_esl_labels_org_updated
ON esl_labels(organization_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_esl_updates_org_created
ON esl_price_updates(organization_id, created_at DESC);

PRAGMA optimize;
