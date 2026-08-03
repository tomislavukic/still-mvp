CREATE TABLE IF NOT EXISTS organization_setup_profiles (
  organization_id TEXT PRIMARY KEY,
  business_type TEXT NOT NULL DEFAULT 'mixed',
  team_size TEXT NOT NULL DEFAULT '1',
  offers_products INTEGER NOT NULL DEFAULT 1,
  offers_services INTEGER NOT NULL DEFAULT 1,
  fulfillment_modes TEXT NOT NULL DEFAULT '[]',
  operating_region TEXT,
  preferred_currency TEXT NOT NULL DEFAULT 'EUR',
  launch_goal TEXT,
  internal_notes TEXT,
  updated_at TEXT NOT NULL
);

PRAGMA optimize;
