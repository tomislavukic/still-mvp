CREATE TABLE IF NOT EXISTS buyer_profiles(
  buyer_account_id TEXT PRIMARY KEY,
  display_name TEXT,
  picture_url TEXT,
  bio TEXT,
  share_with_connected_businesses INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS organization_profiles(
  organization_id TEXT PRIMARY KEY,
  display_name TEXT,
  logo_url TEXT,
  logo_source_url TEXT,
  description TEXT,
  website_url TEXT,
  support_email TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_buyer_profiles_updated ON buyer_profiles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_organization_profiles_updated ON organization_profiles(updated_at DESC);
PRAGMA optimize;
