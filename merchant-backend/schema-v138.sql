CREATE TABLE IF NOT EXISTS company_network_public_profiles(
  organization_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  description TEXT,
  support_email TEXT,
  website_url TEXT,
  country_code TEXT NOT NULL DEFAULT 'hr',
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_network_products(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  category TEXT,
  description TEXT,
  gtin TEXT,
  manufacturer_part_number TEXT,
  specifications_json TEXT NOT NULL DEFAULT '{}',
  provenance_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','ACTIVE','ARCHIVED')),
  created_by_member_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id,gtin)
);

CREATE TABLE IF NOT EXISTS company_network_variants(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  product_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sku TEXT,
  gtin TEXT,
  attributes_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','ARCHIVED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id,sku)
);

CREATE TABLE IF NOT EXISTS company_network_policies(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  policy_type TEXT NOT NULL CHECK(policy_type IN ('WARRANTY','RETURN','SUPPORT')),
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  duration_days INTEGER,
  terms_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_network_offers(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  inventory_item_id TEXT,
  inventory_location_id TEXT,
  condition TEXT NOT NULL CHECK(condition IN ('NEW','REFURBISHED')),
  price_cents INTEGER NOT NULL CHECK(price_cents>=0),
  currency TEXT NOT NULL DEFAULT 'EUR',
  checkout_mode TEXT NOT NULL CHECK(checkout_mode IN ('EXTERNAL','STILL_PROVIDER')),
  external_checkout_url TEXT,
  warranty_policy_id TEXT,
  return_policy_id TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(organization_id,product_id,variant_id,condition)
);

CREATE TABLE IF NOT EXISTS company_network_orders(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('INTENT','AWAITING_EXTERNAL_CONFIRMATION','CONFIRMED','CANCELLED','EXPIRED','FULFILLED')),
  payment_mode TEXT NOT NULL CHECK(payment_mode IN ('EXTERNAL','STILL_PROVIDER')),
  payment_status TEXT NOT NULL CHECK(payment_status IN ('NOT_RECORDED','PENDING','CONFIRMED','FAILED','REFUNDED')),
  payment_reference TEXT,
  external_checkout_url TEXT,
  total_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  reservation_expires_at TEXT,
  confirmed_at TEXT,
  cancelled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_network_order_items(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  order_id TEXT NOT NULL,
  offer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  inventory_item_id TEXT,
  inventory_location_id TEXT,
  quantity INTEGER NOT NULL CHECK(quantity>0),
  unit_price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  thing_passport_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_network_relationships(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  thing_passport_id TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('ORDER','QR_CLAIM','RECEIPT_MATCH','MANUAL')),
  support_access INTEGER NOT NULL DEFAULT 1,
  warranty_access INTEGER NOT NULL DEFAULT 1,
  service_history_access INTEGER NOT NULL DEFAULT 0,
  product_update_access INTEGER NOT NULL DEFAULT 1,
  revoked_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(buyer_account_id,organization_id,thing_passport_id)
);

CREATE TABLE IF NOT EXISTS company_network_marketing_consents(
  buyer_account_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  granted INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(buyer_account_id,organization_id)
);

CREATE TABLE IF NOT EXISTS company_network_claim_tokens(
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  variant_id TEXT,
  order_item_id TEXT,
  serial_number TEXT,
  expires_at TEXT NOT NULL,
  claimed_by_buyer_account_id TEXT,
  claimed_thing_passport_id TEXT,
  claimed_at TEXT,
  created_by_member_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_network_support_requests(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  buyer_account_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  thing_passport_id TEXT NOT NULL,
  request_type TEXT NOT NULL CHECK(request_type IN ('SUPPORT','WARRANTY','RETURN')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','IN_PROGRESS','WAITING','RESOLVED','REJECTED','CANCELLED')),
  company_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_network_notices(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  organization_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'INFO' CHECK(severity IN ('INFO','IMPORTANT','SAFETY')),
  published_at TEXT,
  created_by_member_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_network_events(
  id TEXT PRIMARY KEY,
  public_id TEXT NOT NULL UNIQUE,
  organization_id TEXT,
  buyer_account_id TEXT,
  entity_type TEXT NOT NULL,
  entity_public_id TEXT,
  event_type TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_network_plan_config(
  plan_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  monthly_price_cents INTEGER,
  currency TEXT NOT NULL DEFAULT 'EUR',
  billing_available INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO company_network_plan_config(plan_key,display_name,monthly_price_cents,currency,billing_available,updated_at)
VALUES('BUSINESS_STANDARD','Still for Business',7900,'EUR',0,'2026-08-13T00:00:00.000Z');

CREATE INDEX IF NOT EXISTS idx_cn_products_org ON company_network_products(organization_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cn_products_match ON company_network_products(status,gtin,brand,model);
CREATE INDEX IF NOT EXISTS idx_cn_variants_product ON company_network_variants(product_id,status);
CREATE INDEX IF NOT EXISTS idx_cn_offers_product ON company_network_offers(product_id,active,price_cents);
CREATE INDEX IF NOT EXISTS idx_cn_offers_inventory ON company_network_offers(organization_id,inventory_item_id,inventory_location_id,active);
CREATE INDEX IF NOT EXISTS idx_cn_orders_buyer ON company_network_orders(buyer_account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cn_orders_company ON company_network_orders(organization_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cn_order_items_order ON company_network_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_cn_relationships_company ON company_network_relationships(organization_id,revoked_at,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cn_claim_expiry ON company_network_claim_tokens(token_hash,expires_at,claimed_at);
CREATE INDEX IF NOT EXISTS idx_cn_support_company ON company_network_support_requests(organization_id,status,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cn_notices_product ON company_network_notices(product_id,published_at DESC);
CREATE INDEX IF NOT EXISTS idx_cn_events_entity ON company_network_events(entity_type,entity_public_id,created_at DESC);
PRAGMA optimize;
