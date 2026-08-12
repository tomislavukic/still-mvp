CREATE TABLE IF NOT EXISTS buyer_accounts(
  id TEXT PRIMARY KEY,
  google_sub TEXT UNIQUE,
  email TEXT NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  picture_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS buyer_sessions(
  id TEXT PRIMARY KEY,
  buyer_account_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  user_agent_hash TEXT
);

INSERT OR REPLACE INTO buyer_accounts(id,google_sub,email,email_verified,name,status,created_at,updated_at,last_login_at)
VALUES('ba_world_test_one','world-test-one','world-one@example.invalid',1,'World Test One','active','2026-08-12T00:00:00.000Z','2026-08-12T00:00:00.000Z','2026-08-12T00:00:00.000Z');

INSERT OR REPLACE INTO buyer_accounts(id,google_sub,email,email_verified,name,status,created_at,updated_at,last_login_at)
VALUES('ba_world_test_two','world-test-two','world-two@example.invalid',1,'World Test Two','active','2026-08-12T00:00:00.000Z','2026-08-12T00:00:00.000Z','2026-08-12T00:00:00.000Z');

INSERT OR REPLACE INTO buyer_accounts(id,google_sub,email,email_verified,name,status,created_at,updated_at,last_login_at)
VALUES('ba_world_test_three','world-test-three','world-three@example.invalid',1,'World Test Three','active','2026-08-12T00:00:00.000Z','2026-08-12T00:00:00.000Z','2026-08-12T00:00:00.000Z');

INSERT OR REPLACE INTO buyer_sessions(id,buyer_account_id,token_hash,created_at,expires_at,last_seen_at)
VALUES('bs_world_test_one','ba_world_test_one','3da88f09d362e870c9dbab11ab313dc5909a3b1678f1478d1460bca2ef9b52c3','2026-08-12T00:00:00.000Z','2099-01-01T00:00:00.000Z','2026-08-12T00:00:00.000Z');

INSERT OR REPLACE INTO buyer_sessions(id,buyer_account_id,token_hash,created_at,expires_at,last_seen_at)
VALUES('bs_world_test_two','ba_world_test_two','f397653913df2a792f202e172d996d662cf35207cbc6532b18aeb392fd9daa2f','2026-08-12T00:00:00.000Z','2099-01-01T00:00:00.000Z','2026-08-12T00:00:00.000Z');

INSERT OR REPLACE INTO buyer_sessions(id,buyer_account_id,token_hash,created_at,expires_at,last_seen_at)
VALUES('bs_world_test_three','ba_world_test_three','1655f7abccaac57cdabed69160527445335511c6f45b2f341331894e86d7234c','2026-08-12T00:00:00.000Z','2099-01-01T00:00:00.000Z','2026-08-12T00:00:00.000Z');

INSERT OR REPLACE INTO ownership_passports(id,public_id,buyer_account_id,created_by,kind,title,status,created_at,updated_at)
VALUES('opp_world_fixture','STP-WORLD-FIXTURE','ba_world_test_one','buyer','product','Fixture Existing Thing','connected','2026-08-12T00:00:00.000Z','2026-08-12T00:00:00.000Z');

INSERT OR REPLACE INTO world_thing_profiles(passport_id,buyer_account_id,thing_type,lifecycle_state,source,review_status,created_at,updated_at)
VALUES('opp_world_fixture','ba_world_test_one','product','OWNED','test_fixture','CONFIRMED','2026-08-12T00:00:00.000Z','2026-08-12T00:00:00.000Z');

INSERT OR REPLACE INTO world_receipts(id,public_id,buyer_account_id,merchant,purchase_date,currency,total_cents,raw_ocr_text,processing_status,source_image_key,source_mime_type,source_file_name,source_file_hash,source_file_bytes,confidence_json,created_at,updated_at)
VALUES('wrc_world_fixture','RCP-WORLD-FIXTURE','ba_world_test_one','Fixture Store','2026-08-12','EUR',30000,'Fixture Camera 200.00 EUR\nFixture Existing Thing 100.00 EUR','NEEDS_REVIEW','test/fixture.jpg','image/jpeg','fixture.jpg','world-fixture-hash',128,'{"merchant":1,"purchaseDate":1,"total":1}','2026-08-12T00:00:00.000Z','2026-08-12T00:00:00.000Z');

INSERT OR REPLACE INTO world_receipt_items(id,public_id,receipt_id,buyer_account_id,raw_label,title,quantity,total_cents,currency,confidence,disposition,created_at,updated_at)
VALUES('wri_world_fixture_create','RLI-WORLD-CREATE','wrc_world_fixture','ba_world_test_one','Fixture Camera 200.00 EUR','Fixture Camera',1,20000,'EUR',0.94,'NEEDS_REVIEW','2026-08-12T00:00:00.000Z','2026-08-12T00:00:00.000Z');

INSERT OR REPLACE INTO world_receipt_items(id,public_id,receipt_id,buyer_account_id,raw_label,title,quantity,total_cents,currency,confidence,disposition,created_at,updated_at)
VALUES('wri_world_fixture_link','RLI-WORLD-LINK','wrc_world_fixture','ba_world_test_one','Fixture Existing Thing 100.00 EUR','Fixture Existing Thing',1,10000,'EUR',0.92,'NEEDS_REVIEW','2026-08-12T00:00:00.000Z','2026-08-12T00:00:00.000Z');
