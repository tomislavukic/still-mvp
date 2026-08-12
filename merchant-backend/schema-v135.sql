CREATE TABLE IF NOT EXISTS market_listings(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  seller_buyer_account_id TEXT NOT NULL,
  thing_passport_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT',
  asking_price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  description TEXT,
  condition_grade TEXT,
  known_defects TEXT,
  functional_issues TEXT,
  cosmetic_issues TEXT,
  included_accessories_json TEXT NOT NULL DEFAULT '[]',
  seller_notes TEXT,
  category TEXT,
  location_mode TEXT NOT NULL DEFAULT 'COARSE',
  coarse_location TEXT,
  shipping_available INTEGER NOT NULL DEFAULT 0,
  pickup_available INTEGER NOT NULL DEFAULT 1,
  sell_need_id TEXT,
  created_at TEXT NOT NULL,
  published_at TEXT,
  reserved_at TEXT,
  sold_at TEXT,
  withdrawn_at TEXT,
  expired_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_thing_preferences(
  buyer_account_id TEXT NOT NULL,
  thing_passport_id TEXT NOT NULL,
  private_matching_enabled INTEGER NOT NULL DEFAULT 0,
  consider_price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  updated_at TEXT NOT NULL,
  PRIMARY KEY(buyer_account_id,thing_passport_id)
);

CREATE TABLE IF NOT EXISTS market_wanted(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  need_id TEXT,
  title TEXT NOT NULL,
  normalized_title TEXT NOT NULL,
  category TEXT,
  manufacturer TEXT,
  model TEXT,
  requirements_json TEXT NOT NULL DEFAULT '[]',
  max_price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  min_condition TEXT,
  location_preference TEXT,
  shipping_allowed INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_matches(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  wanted_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  failed_constraints_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(wanted_id,listing_id)
);

CREATE TABLE IF NOT EXISTS market_offers(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  listing_id TEXT NOT NULL,
  buyer_account_id TEXT NOT NULL,
  current_amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  message TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_offer_events(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  offer_id TEXT NOT NULL,
  actor_buyer_account_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  amount_cents INTEGER,
  message TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_deals(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  listing_id TEXT NOT NULL UNIQUE,
  accepted_offer_id TEXT NOT NULL UNIQUE,
  seller_buyer_account_id TEXT NOT NULL,
  buyer_buyer_account_id TEXT NOT NULL,
  agreed_amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AGREED',
  payment_mode TEXT NOT NULL DEFAULT 'EXTERNAL_MANUAL',
  delivery_mode TEXT NOT NULL,
  external_payment_confirmed_by_buyer_at TEXT,
  seller_handed_over_at TEXT,
  buyer_received_at TEXT,
  cancelled_at TEXT,
  disputed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_transfers(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  deal_id TEXT NOT NULL UNIQUE,
  thing_passport_id TEXT NOT NULL,
  from_buyer_account_id TEXT NOT NULL,
  to_buyer_account_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  seller_confirmed_at TEXT,
  buyer_confirmed_at TEXT,
  initiated_at TEXT NOT NULL,
  completed_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_transfer_snapshots(
  transfer_id TEXT PRIMARY KEY,
  safe_product_json TEXT NOT NULL,
  privacy_filter_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_transfer_seller_private(
  transfer_id TEXT PRIMARY KEY,
  seller_buyer_account_id TEXT NOT NULL,
  private_notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_need_resolutions(
  need_id TEXT NOT NULL,
  deal_id TEXT NOT NULL,
  outcome_id TEXT NOT NULL,
  buyer_account_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(need_id,deal_id)
);

CREATE TABLE IF NOT EXISTS market_messages(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  deal_id TEXT NOT NULL,
  author_buyer_account_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_notifications(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  source_key TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  href TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT,
  UNIQUE(buyer_account_id,source_key)
);

CREATE TABLE IF NOT EXISTS market_reports(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  reporter_buyer_account_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_public_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_blocks(
  blocker_buyer_account_id TEXT NOT NULL,
  blocked_buyer_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(blocker_buyer_account_id,blocked_buyer_account_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_market_one_open_listing ON market_listings(thing_passport_id) WHERE status IN ('DRAFT','ACTIVE','RESERVED','TRANSFER_PENDING');
CREATE INDEX IF NOT EXISTS idx_market_listing_search ON market_listings(status,category,asking_price_cents,published_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_listing_seller ON market_listings(seller_buyer_account_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_wanted_owner ON market_wanted(buyer_account_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_wanted_search ON market_wanted(status,category,max_price_cents,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_matches_wanted ON market_matches(wanted_id,score DESC,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_matches_listing ON market_matches(listing_id,score DESC,updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_market_open_offer ON market_offers(listing_id,buyer_account_id) WHERE status IN ('PENDING','COUNTERED','ACCEPTED');
CREATE INDEX IF NOT EXISTS idx_market_offer_listing ON market_offers(listing_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_offer_buyer ON market_offers(buyer_account_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_deal_parties ON market_deals(seller_buyer_account_id,buyer_buyer_account_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_messages_deal ON market_messages(deal_id,created_at);
CREATE INDEX IF NOT EXISTS idx_market_notifications_owner ON market_notifications(buyer_account_id,read_at,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_reports_target ON market_reports(target_type,target_public_id,status,created_at DESC);
PRAGMA optimize;
