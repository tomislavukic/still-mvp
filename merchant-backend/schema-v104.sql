CREATE TABLE IF NOT EXISTS buyer_contact_profiles (
  buyer_account_id TEXT PRIMARY KEY,
  phone TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  country_code TEXT,
  delivery_instructions TEXT,
  preferred_contact TEXT NOT NULL DEFAULT 'email',
  share_with_connected_businesses INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS organization_contact_profiles (
  organization_id TEXT PRIMARY KEY,
  contact_name TEXT,
  phone TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  country_code TEXT,
  business_hours TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS commerce_order_parties (
  order_id TEXT PRIMARY KEY,
  order_public_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  buyer_account_id TEXT NOT NULL,
  buyer_json TEXT NOT NULL,
  seller_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_parties_organization_created
ON commerce_order_parties(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_parties_buyer_created
ON commerce_order_parties(buyer_account_id, created_at DESC);

PRAGMA optimize;
