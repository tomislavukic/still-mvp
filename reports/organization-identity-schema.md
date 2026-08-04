# Organization Team & Identity Schema Audit

Generated: 2026-08-04T20:21:25.730Z

Total database tables: 74
Potentially relevant objects: 35

## Relevant schema objects

### index: `idx_buyer_sessions_account`

```sql
CREATE INDEX idx_buyer_sessions_account ON buyer_sessions(buyer_account_id,expires_at)
```

### index: `idx_merchant_sessions_member`

```sql
CREATE INDEX idx_merchant_sessions_member ON merchant_sessions(member_id, expires_at)
```

### index: `sqlite_autoindex_buyer_sessions_1`

```sql
Definition unavailable
```

### index: `sqlite_autoindex_buyer_sessions_2`

```sql
Definition unavailable
```

### index: `sqlite_autoindex_merchant_members_1`

```sql
Definition unavailable
```

### index: `sqlite_autoindex_merchant_members_2`

```sql
Definition unavailable
```

### index: `sqlite_autoindex_merchant_sessions_1`

```sql
Definition unavailable
```

### index: `sqlite_autoindex_merchant_sessions_2`

```sql
Definition unavailable
```

### table: `business_assets`

```sql
CREATE TABLE business_assets(
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,
        organization_id TEXT NOT NULL,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        supplier TEXT,
        reference TEXT,
        renewal_at TEXT,
        maintenance_at TEXT,
        seats INTEGER,
        cost_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'EUR',
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        created_by_member_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
```

### table: `buyer_accounts`

```sql
CREATE TABLE buyer_accounts(id TEXT PRIMARY KEY,google_sub TEXT UNIQUE,email TEXT NOT NULL,email_verified INTEGER NOT NULL DEFAULT 0,name TEXT,picture_url TEXT,status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disabled')),created_at TEXT NOT NULL,updated_at TEXT NOT NULL,last_login_at TEXT NOT NULL)
```

### table: `buyer_sessions`

```sql
CREATE TABLE buyer_sessions(id TEXT PRIMARY KEY,buyer_account_id TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL,expires_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,user_agent_hash TEXT,FOREIGN KEY(buyer_account_id) REFERENCES buyer_accounts(id) ON DELETE CASCADE)
```

### table: `case_decisions`

```sql
CREATE TABLE case_decisions (   id TEXT PRIMARY KEY,    case_id TEXT NOT NULL     REFERENCES consumer_cases(id) ON DELETE CASCADE,    organization_id TEXT     REFERENCES merchant_organizations(id) ON DELETE SET NULL,    decision_type TEXT NOT NULL     CHECK (       decision_type IN (         'accepted',         'need_more_info',         'bring_to_store',         'repair',         'replacement',         'refund',         'rejected',         'other'       )     ),    reason TEXT,   service_reference TEXT,   proposed_resolution TEXT,    created_by_member_id TEXT     REFERENCES merchant_members(id) ON DELETE SET NULL,    created_at TEXT NOT NULL )
```

### table: `case_messages`

```sql
CREATE TABLE case_messages (   id TEXT PRIMARY KEY,    case_id TEXT NOT NULL     REFERENCES consumer_cases(id) ON DELETE CASCADE,    actor_type TEXT NOT NULL     CHECK (actor_type IN ('consumer','merchant','system')),    actor_member_id TEXT     REFERENCES merchant_members(id) ON DELETE SET NULL,    message_type TEXT NOT NULL DEFAULT 'note'     CHECK (       message_type IN (         'note',         'request_info',         'decision',         'system'       )     ),    body TEXT NOT NULL,   created_at TEXT NOT NULL )
```

### table: `esl_connectors`

```sql
CREATE TABLE esl_connectors(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,name TEXT NOT NULL,vendor TEXT NOT NULL,transport TEXT NOT NULL,store_reference TEXT,payload_format TEXT NOT NULL DEFAULT 'still_json_v1',status TEXT NOT NULL DEFAULT 'configured',created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)
```

### table: `esl_labels`

```sql
CREATE TABLE esl_labels(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,product_id TEXT,connector_id TEXT,sku TEXT NOT NULL,gtin TEXT,product_name TEXT NOT NULL,price_cents INTEGER NOT NULL,original_price_cents INTEGER,currency TEXT NOT NULL DEFAULT 'EUR',unit_text TEXT,promo_text TEXT,legal_text TEXT,template TEXT NOT NULL DEFAULT 'retail',width_mm REAL NOT NULL,height_mm REAL NOT NULL,width_px INTEGER NOT NULL,height_px INTEGER NOT NULL,orientation TEXT NOT NULL DEFAULT 'landscape',color_mode TEXT NOT NULL DEFAULT 'mono',qr_url TEXT,barcode_value TEXT,status TEXT NOT NULL DEFAULT 'draft',version INTEGER NOT NULL DEFAULT 1,last_synced_at TEXT,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)
```

### table: `esl_price_updates`

```sql
CREATE TABLE esl_price_updates(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,label_id TEXT NOT NULL,old_price_cents INTEGER NOT NULL,new_price_cents INTEGER NOT NULL,reason TEXT,effective_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'export_ready',payload_json TEXT NOT NULL,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,applied_at TEXT)
```

### table: `merchant_api_tokens`

```sql
CREATE TABLE merchant_api_tokens (   id TEXT PRIMARY KEY,   organization_id TEXT NOT NULL     REFERENCES merchant_organizations(id) ON DELETE CASCADE,   member_id TEXT     REFERENCES merchant_members(id) ON DELETE SET NULL,   token_hash TEXT NOT NULL UNIQUE,   label TEXT NOT NULL DEFAULT 'default',   last_used_at TEXT,   expires_at TEXT,   revoked_at TEXT,   created_at TEXT NOT NULL )
```

### table: `merchant_members`

```sql
CREATE TABLE merchant_members (   id TEXT PRIMARY KEY,   organization_id TEXT NOT NULL     REFERENCES merchant_organizations(id) ON DELETE CASCADE,   email TEXT NOT NULL UNIQUE,   password_hash TEXT NOT NULL,   password_salt TEXT NOT NULL,   password_iterations INTEGER NOT NULL DEFAULT 210000,   role TEXT NOT NULL DEFAULT 'agent'     CHECK (role IN ('owner','admin','agent','viewer')),   status TEXT NOT NULL DEFAULT 'active'     CHECK (status IN ('active','disabled')),   created_at TEXT NOT NULL,   updated_at TEXT NOT NULL )
```

### table: `merchant_sessions`

```sql
CREATE TABLE merchant_sessions (   id TEXT PRIMARY KEY,   member_id TEXT NOT NULL     REFERENCES merchant_members(id) ON DELETE CASCADE,   token_hash TEXT NOT NULL UNIQUE,   expires_at TEXT NOT NULL,   last_seen_at TEXT NOT NULL,   created_at TEXT NOT NULL )
```

### table: `ops_agreements`

```sql
CREATE TABLE ops_agreements(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,agreement_type TEXT NOT NULL,passport_id TEXT,product_id TEXT,title TEXT NOT NULL,customer_label TEXT,start_on TEXT,end_on TEXT,renewal_on TEXT,quantity INTEGER NOT NULL DEFAULT 1,recurring_cents INTEGER NOT NULL DEFAULT 0,deposit_cents INTEGER NOT NULL DEFAULT 0,usage_limit INTEGER,condition_notes TEXT,status TEXT NOT NULL DEFAULT 'active',created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)
```

### table: `ops_appointments`

```sql
CREATE TABLE ops_appointments(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,staff_id TEXT,passport_id TEXT,repair_job_id TEXT,title TEXT NOT NULL,starts_at TEXT NOT NULL,ends_at TEXT NOT NULL,location_text TEXT,status TEXT NOT NULL DEFAULT 'scheduled',created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)
```

### table: `ops_audit_log`

```sql
CREATE TABLE ops_audit_log(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,member_id TEXT NOT NULL,action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,details_json TEXT,created_at TEXT NOT NULL)
```

### table: `ops_passport_inventory`

```sql
CREATE TABLE ops_passport_inventory(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,passport_id TEXT NOT NULL,product_id TEXT NOT NULL,lot_id TEXT,quantity INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'assigned',assigned_by_member_id TEXT NOT NULL,assigned_at TEXT NOT NULL,UNIQUE(passport_id,product_id,lot_id))
```

### table: `ops_purchase_orders`

```sql
CREATE TABLE ops_purchase_orders(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,supplier_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'ordered',expected_on TEXT,received_on TEXT,notes TEXT,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)
```

### table: `ops_quotes`

```sql
CREATE TABLE ops_quotes(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,contact_id TEXT,title TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'draft',valid_until TEXT,currency TEXT NOT NULL DEFAULT 'EUR',total_cents INTEGER NOT NULL DEFAULT 0,terms TEXT,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)
```

### table: `ops_recall_campaigns`

```sql
CREATE TABLE ops_recall_campaigns(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,product_id TEXT NOT NULL,batch_no TEXT,serial_no TEXT,severity TEXT NOT NULL DEFAULT 'critical',title TEXT NOT NULL,detail TEXT NOT NULL,action_url TEXT,status TEXT NOT NULL DEFAULT 'active',created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)
```

### table: `ops_repair_jobs`

```sql
CREATE TABLE ops_repair_jobs(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,passport_id TEXT,product_id TEXT,subject TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'received',priority TEXT NOT NULL DEFAULT 'normal',diagnosis TEXT,estimate_cents INTEGER NOT NULL DEFAULT 0,actual_cost_cents INTEGER NOT NULL DEFAULT 0,scheduled_on TEXT,completed_on TEXT,technician_member_id TEXT,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)
```

### table: `ops_reservations`

```sql
CREATE TABLE ops_reservations(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,product_id TEXT NOT NULL,location_id TEXT NOT NULL,passport_id TEXT,order_reference TEXT,quantity INTEGER NOT NULL,fulfillment_method TEXT,tracking_number TEXT,status TEXT NOT NULL DEFAULT 'reserved',created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)
```

### table: `ops_rmas`

```sql
CREATE TABLE ops_rmas(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,passport_id TEXT,product_id TEXT,lot_id TEXT,status TEXT NOT NULL DEFAULT 'requested',reason TEXT NOT NULL,condition_grade TEXT,disposition TEXT,refund_cents INTEGER NOT NULL DEFAULT 0,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)
```

### table: `ops_stock_movements`

```sql
CREATE TABLE ops_stock_movements(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,product_id TEXT NOT NULL,location_id TEXT NOT NULL,lot_id TEXT,quantity_delta INTEGER NOT NULL,reason TEXT NOT NULL,reference_type TEXT,reference_id TEXT,actor_member_id TEXT NOT NULL,created_at TEXT NOT NULL)
```

### table: `ownership_passports`

```sql
CREATE TABLE ownership_passports(
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
)
```

### table: `passport_alerts`

```sql
CREATE TABLE passport_alerts(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,passport_id TEXT NOT NULL,organization_id TEXT NOT NULL,severity TEXT NOT NULL,title TEXT NOT NULL,detail TEXT NOT NULL,action_url TEXT,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL)
```

### table: `passport_commitments`

```sql
CREATE TABLE passport_commitments(
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
)
```

### table: `passport_messages`

```sql
CREATE TABLE passport_messages(
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,
        thread_id TEXT NOT NULL,
        author_type TEXT NOT NULL,
        author_id TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
```

### table: `platform_audit_events`

```sql
CREATE TABLE platform_audit_events(
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status INTEGER NOT NULL,
      outcome TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    )
```


## Safety conclusion

No Team or Identity interface should be connected until each displayed
field maps to an existing database column or an approved migration.