-- Phase 7 completion migration. Additive only; schema-v138 remains the base.
ALTER TABLE company_network_public_profiles ADD COLUMN logo_url TEXT;
ALTER TABLE company_network_public_profiles ADD COLUMN public_address TEXT;
ALTER TABLE company_network_public_profiles ADD COLUMN service_regions_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE company_network_public_profiles ADD COLUMN support_channels_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE company_network_public_profiles ADD COLUMN fulfillment_modes_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE company_network_public_profiles ADD COLUMN onboarding_level INTEGER NOT NULL DEFAULT 1;

ALTER TABLE company_network_products ADD COLUMN manufacturer TEXT;
ALTER TABLE company_network_products ADD COLUMN media_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE company_network_products ADD COLUMN support_policy_id TEXT;
ALTER TABLE company_network_products ADD COLUMN interoperability_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE company_network_offers ADD COLUMN shipping_modes_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE company_network_offers ADD COLUMN pickup_locations_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE company_network_offers ADD COLUMN estimated_delivery_min_days INTEGER;
ALTER TABLE company_network_offers ADD COLUMN estimated_delivery_max_days INTEGER;
ALTER TABLE company_network_offers ADD COLUMN tax_included INTEGER;
ALTER TABLE company_network_offers ADD COLUMN refurbished_grade TEXT;
ALTER TABLE company_network_offers ADD COLUMN refurbisher_name TEXT;
ALTER TABLE company_network_offers ADD COLUMN refurbishment_policy TEXT;
ALTER TABLE company_network_offers ADD COLUMN condition_evidence_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE company_network_orders ADD COLUMN subtotal_cents INTEGER;
ALTER TABLE company_network_orders ADD COLUMN fees_cents INTEGER;
ALTER TABLE company_network_orders ADD COLUMN shipping_cents INTEGER;
ALTER TABLE company_network_orders ADD COLUMN tax_cents INTEGER;
ALTER TABLE company_network_orders ADD COLUMN fulfillment_status TEXT NOT NULL DEFAULT 'UNFULFILLED';
ALTER TABLE company_network_orders ADD COLUMN delivery_method TEXT;
ALTER TABLE company_network_orders ADD COLUMN pickup_location TEXT;
ALTER TABLE company_network_orders ADD COLUMN shipping_address_json TEXT;
ALTER TABLE company_network_orders ADD COLUMN fulfillment_provider TEXT;
ALTER TABLE company_network_orders ADD COLUMN tracking_reference TEXT;
ALTER TABLE company_network_orders ADD COLUMN tracking_url TEXT;
ALTER TABLE company_network_orders ADD COLUMN shipped_at TEXT;
ALTER TABLE company_network_orders ADD COLUMN delivered_at TEXT;
ALTER TABLE company_network_orders ADD COLUMN refunded_at TEXT;

ALTER TABLE company_network_order_items ADD COLUMN total_price_cents INTEGER;
ALTER TABLE company_network_order_items ADD COLUMN passport_creation_policy TEXT NOT NULL DEFAULT 'ON_CONFIRMED_PURCHASE';
ALTER TABLE company_network_order_items ADD COLUMN purchase_snapshot_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE company_network_relationships ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE company_network_relationships ADD COLUMN repair_access INTEGER NOT NULL DEFAULT 0;
ALTER TABLE company_network_relationships ADD COLUMN safety_notice_access INTEGER NOT NULL DEFAULT 1;
ALTER TABLE company_network_relationships ADD COLUMN accessory_compatibility_access INTEGER NOT NULL DEFAULT 0;

ALTER TABLE company_network_support_requests ADD COLUMN shared_fields_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE company_network_support_requests ADD COLUMN evidence_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE company_network_support_requests ADD COLUMN resolution_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE company_network_support_requests ADD COLUMN refund_status TEXT;

CREATE TABLE IF NOT EXISTS company_network_thing_products(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  thing_passport_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  source_type TEXT NOT NULL,
  source_public_id TEXT,
  provenance_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(buyer_account_id,thing_passport_id,product_id)
);

CREATE TABLE IF NOT EXISTS company_network_fulfillment_events(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  fulfillment_status TEXT NOT NULL,
  evidence_reference TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_by_member_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_network_rate_limits(
  rate_key TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  window_started_at TEXT NOT NULL,
  request_count INTEGER NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cn_thing_products_owner ON company_network_thing_products(buyer_account_id,thing_passport_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cn_thing_products_product ON company_network_thing_products(product_id,status);
CREATE INDEX IF NOT EXISTS idx_cn_fulfillment_order ON company_network_fulfillment_events(order_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cn_rate_expiry ON company_network_rate_limits(expires_at);
PRAGMA optimize;
