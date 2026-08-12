import app from './worker-v120.js';
import {
  clean,
  duplicateCandidates,
  normalizeText,
  parseMoneyToCents,
  parseReceiptText,
  rankNow,
  safeDate,
  safeSearchTerm,
  validLoopTransition,
  validateImageBytes
} from './world-core-v131.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
};
const MAX_RECEIPT_BYTES = 12 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 150000;
const THING_KINDS = new Set(['product', 'service', 'subscription', 'booking', 'rental', 'project']);
const LIFECYCLE_STATES = new Set(['OWNED', 'IN_SERVICE', 'LENT', 'SOLD', 'DISPOSED', 'ARCHIVED']);
const SITUATION_STATUSES = new Set(['ACTIVE', 'WAITING', 'RESOLVED']);
const LOOP_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'WAITING', 'COMPLETED', 'CANCELLED']);
const LOOP_TYPES = new Set(['ACTION', 'WAITING', 'DECISION', 'PROMISE', 'PAYMENT', 'FOLLOW_UP', 'WAITING_FOR_PERSON', 'WAITING_FOR_BUSINESS', 'DEADLINE']);
const DOCUMENT_MIMES = new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain', 'text/csv',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
]);
let schemaReady;

const now = () => new Date().toISOString();
const uid = prefix => `${prefix}${crypto.randomUUID().replaceAll('-', '')}`;
const publicId = prefix => `${prefix}-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
const safeJson = (value, fallback = {}) => { try { return JSON.parse(value || ''); } catch { return fallback; } };
const has = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);

function log(event, fields = {}) {
  console.log(JSON.stringify({ scope: 'buyer_world', event, at: now(), ...fields }));
}

async function sha(value) {
  const input = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function cookie(request, name) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

async function buyerSession(request, env) {
  const token = cookie(request, 'still_buyer');
  if (!token) return null;
  return env.DB.prepare(`SELECT a.id buyer_account_id,a.email,a.name
    FROM buyer_sessions s JOIN buyer_accounts a ON a.id=s.buyer_account_id
    WHERE s.token_hash=? AND s.expires_at>? AND a.status='active'`)
    .bind(await sha(token), now()).first();
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS world_thing_profiles(passport_id TEXT PRIMARY KEY,buyer_account_id TEXT NOT NULL,thing_type TEXT NOT NULL DEFAULT 'product',category TEXT,manufacturer TEXT,model TEXT,serial_number TEXT,gtin TEXT,purchase_price_cents INTEGER,currency TEXT,lifecycle_state TEXT NOT NULL DEFAULT 'OWNED',source TEXT NOT NULL DEFAULT 'manual',review_status TEXT NOT NULL DEFAULT 'CONFIRMED',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS world_receipts(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,buyer_account_id TEXT NOT NULL,merchant TEXT,purchase_date TEXT,currency TEXT,subtotal_cents INTEGER,tax_cents INTEGER,total_cents INTEGER,reference TEXT,raw_ocr_text TEXT,processing_status TEXT NOT NULL,processing_error_code TEXT,processing_error_message TEXT,source_image_key TEXT NOT NULL,source_mime_type TEXT NOT NULL,source_file_name TEXT NOT NULL,source_file_hash TEXT NOT NULL,source_file_bytes INTEGER NOT NULL,confidence_json TEXT NOT NULL DEFAULT '{}',confirmed_at TEXT,archived_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS world_receipt_items(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,receipt_id TEXT NOT NULL,buyer_account_id TEXT NOT NULL,raw_label TEXT NOT NULL,title TEXT NOT NULL,quantity REAL NOT NULL DEFAULT 1,unit_price_cents INTEGER,total_cents INTEGER,currency TEXT,sku TEXT,gtin TEXT,manufacturer_candidate TEXT,model_candidate TEXT,confidence REAL NOT NULL DEFAULT 0,disposition TEXT NOT NULL DEFAULT 'NEEDS_REVIEW',thing_passport_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS world_documents(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,buyer_account_id TEXT NOT NULL,title TEXT NOT NULL,document_type TEXT NOT NULL DEFAULT 'other',mime_type TEXT NOT NULL,object_key TEXT NOT NULL,original_file_name TEXT NOT NULL,file_hash TEXT NOT NULL,file_bytes INTEGER NOT NULL,extracted_text TEXT,processing_status TEXT NOT NULL DEFAULT 'READY',processing_error_code TEXT,archived_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS world_knowledge_items(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,buyer_account_id TEXT NOT NULL,title TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'note',body TEXT NOT NULL,source_type TEXT NOT NULL DEFAULT 'USER_TEXT',source_url TEXT,tags_json TEXT NOT NULL DEFAULT '[]',source_document_id TEXT,thing_passport_id TEXT,situation_id TEXT,status TEXT NOT NULL DEFAULT 'ACTIVE',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS world_situations(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,buyer_account_id TEXT NOT NULL,title TEXT NOT NULL,description TEXT,status TEXT NOT NULL DEFAULT 'ACTIVE',priority TEXT NOT NULL DEFAULT 'NORMAL',start_date TEXT,due_at TEXT,resolved_at TEXT,archived_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS world_open_loops(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,buyer_account_id TEXT NOT NULL,situation_id TEXT,thing_passport_id TEXT,title TEXT NOT NULL,loop_type TEXT NOT NULL DEFAULT 'ACTION',status TEXT NOT NULL DEFAULT 'OPEN',waiting_on TEXT,due_at TEXT,notes TEXT,completed_at TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS world_relationships(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,buyer_account_id TEXT NOT NULL,from_type TEXT NOT NULL,from_public_id TEXT NOT NULL,to_type TEXT NOT NULL,to_public_id TEXT NOT NULL,relationship TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(buyer_account_id,from_type,from_public_id,to_type,to_public_id,relationship))`,
  `CREATE TABLE IF NOT EXISTS world_evidence(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,buyer_account_id TEXT NOT NULL,evidence_type TEXT NOT NULL,source_type TEXT NOT NULL,source_public_id TEXT NOT NULL,thing_passport_id TEXT,receipt_id TEXT,document_id TEXT,field_name TEXT,value_json TEXT,provenance TEXT NOT NULL,confidence REAL,verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED',created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS world_history_events(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,buyer_account_id TEXT NOT NULL,entity_type TEXT NOT NULL,entity_public_id TEXT NOT NULL,event_type TEXT NOT NULL,title TEXT NOT NULL,details_json TEXT NOT NULL DEFAULT '{}',source_type TEXT,source_public_id TEXT,occurred_at TEXT NOT NULL,created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS world_migrations(buyer_account_id TEXT NOT NULL,source TEXT NOT NULL,fingerprint TEXT NOT NULL,imported_count INTEGER NOT NULL DEFAULT 0,skipped_count INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'COMPLETED',created_at TEXT NOT NULL,PRIMARY KEY(buyer_account_id,source,fingerprint))`,
  `CREATE TABLE IF NOT EXISTS world_rate_limits(bucket TEXT PRIMARY KEY,request_count INTEGER NOT NULL DEFAULT 1,expires_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_world_thing_owner ON world_thing_profiles(buyer_account_id,updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_world_thing_serial ON world_thing_profiles(buyer_account_id,serial_number)`,
  `CREATE INDEX IF NOT EXISTS idx_world_thing_gtin ON world_thing_profiles(buyer_account_id,gtin)`,
  `CREATE INDEX IF NOT EXISTS idx_world_receipt_owner ON world_receipts(buyer_account_id,created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_world_receipt_hash ON world_receipts(buyer_account_id,source_file_hash)`,
  `CREATE INDEX IF NOT EXISTS idx_world_receipt_items_receipt ON world_receipt_items(receipt_id,created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_world_documents_owner ON world_documents(buyer_account_id,updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_world_knowledge_owner ON world_knowledge_items(buyer_account_id,updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_world_situations_owner ON world_situations(buyer_account_id,status,updated_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_world_loops_owner ON world_open_loops(buyer_account_id,status,due_at)`,
  `CREATE INDEX IF NOT EXISTS idx_world_relationships_from ON world_relationships(buyer_account_id,from_type,from_public_id)`,
  `CREATE INDEX IF NOT EXISTS idx_world_relationships_to ON world_relationships(buyer_account_id,to_type,to_public_id)`,
  `CREATE INDEX IF NOT EXISTS idx_world_evidence_thing ON world_evidence(buyer_account_id,thing_passport_id,created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_world_history_owner ON world_history_events(buyer_account_id,occurred_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_world_history_entity ON world_history_events(buyer_account_id,entity_type,entity_public_id,occurred_at DESC)`,
  `DELETE FROM world_rate_limits WHERE expires_at<datetime('now')`,
  `PRAGMA optimize`
];

async function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = (async () => {
      await env.DB.batch(SCHEMA.map(statement => env.DB.prepare(statement)));
      const columns = [
        ['world_receipt_items', 'sku', 'TEXT'],
        ['world_receipt_items', 'gtin', 'TEXT'],
        ['world_receipt_items', 'manufacturer_candidate', 'TEXT'],
        ['world_receipt_items', 'model_candidate', 'TEXT'],
        ['world_knowledge_items', 'source_type', "TEXT NOT NULL DEFAULT 'USER_TEXT'"],
        ['world_knowledge_items', 'source_url', 'TEXT'],
        ['world_knowledge_items', 'tags_json', "TEXT NOT NULL DEFAULT '[]'"],
        ['world_situations', 'start_date', 'TEXT'],
        ['world_open_loops', 'notes', 'TEXT']
      ];
      for (const [table, column, definition] of columns) {
        const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
        if (!(info.results || []).some(item => item.name === column)) await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
      }
    })().catch(error => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}

function privateSourceUrl(value) {
  const candidate = clean(value, 1000);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString().slice(0, 1000) : null;
  } catch { return null; }
}

function knowledgeTags(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(raw.map(tag => clean(tag, 40).toLocaleLowerCase()).filter(Boolean))].slice(0, 20);
}

async function rateLimit(env, buyer, category = 'general') {
  const window = now().slice(0, 16);
  const limit = category === 'ocr' ? 15 : 180;
  const bucket = await sha(`${buyer.buyer_account_id}:${category}:${window}`);
  const expiresAt = new Date(Date.now() + 120000).toISOString();
  await env.DB.prepare(`INSERT INTO world_rate_limits(bucket,request_count,expires_at) VALUES(?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET request_count=request_count+1,expires_at=excluded.expires_at`).bind(bucket, expiresAt).run();
  const row = await env.DB.prepare('SELECT request_count FROM world_rate_limits WHERE bucket=?').bind(bucket).first();
  return Number(row?.request_count || 0) <= limit;
}

function historyStatement(env, buyerId, entityType, entityId, eventType, title, details = {}, sourceType = null, sourceId = null, occurredAt = now()) {
  return env.DB.prepare(`INSERT INTO world_history_events(id,public_id,buyer_account_id,entity_type,entity_public_id,event_type,title,details_json,source_type,source_public_id,occurred_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(uid('whe_'), publicId('HIS'), buyerId, entityType, entityId, eventType, clean(title, 180), JSON.stringify(details).slice(0, 8000), sourceType, sourceId, occurredAt, now());
}

function relationshipStatement(env, buyerId, fromType, fromId, toType, toId, relationship) {
  return env.DB.prepare(`INSERT OR IGNORE INTO world_relationships(id,public_id,buyer_account_id,from_type,from_public_id,to_type,to_public_id,relationship,created_at) VALUES(?,?,?,?,?,?,?,?,?)`)
    .bind(uid('wrl_'), publicId('REL'), buyerId, fromType, fromId, toType, toId, relationship, now());
}

function thingJson(row, evidence = [], receiptIds = []) {
  const provenance = {};
  for (const item of evidence) {
    if (!item.field_name || provenance[item.field_name]) continue;
    provenance[item.field_name] = {
      source: item.provenance,
      verification: item.verification_status,
      confidence: item.confidence,
      evidenceId: item.public_id,
      sourceType: item.source_type,
      sourceId: item.source_public_id
    };
  }
  const defaults = {
    title: row.title,
    businessName: row.business_name,
    reference: row.reference,
    purchaseDate: row.purchased_on,
    returnBy: row.return_by,
    warrantyUntil: row.warranty_until,
    renewalAt: row.renewal_at,
    nextActionAt: row.next_action_at,
    category: row.category,
    manufacturer: row.manufacturer,
    model: row.model,
    serialNumber: row.serial_number,
    gtin: row.gtin,
    purchasePriceCents: row.purchase_price_cents
  };
  for (const [field, value] of Object.entries(defaults)) {
    if (value !== null && value !== undefined && value !== '' && !provenance[field]) provenance[field] = { source: row.created_by === 'company' ? 'COMPANY_ISSUED_RECORD' : 'EXISTING_BUYER_RECORD', verification: 'UNVERIFIED', confidence: null, evidenceId: null, sourceType: row.created_by, sourceId: row.public_id };
  }
  return {
    publicId: row.public_id,
    passportId: row.public_id,
    type: row.thing_type || row.kind,
    kind: row.kind,
    title: row.title,
    category: row.category || null,
    manufacturer: row.manufacturer || null,
    model: row.model || null,
    serialNumber: row.serial_number || null,
    gtin: row.gtin || null,
    businessName: row.business_name || null,
    reference: row.reference || null,
    purchaseDate: row.purchased_on || null,
    purchasePriceCents: row.purchase_price_cents ?? null,
    currency: row.currency || null,
    returnBy: row.return_by || null,
    warrantyUntil: row.warranty_until || null,
    renewalAt: row.renewal_at || null,
    nextActionAt: row.next_action_at || null,
    notes: row.notes || null,
    lifecycleState: row.lifecycle_state || (row.status === 'archived' ? 'ARCHIVED' : 'OWNED'),
    source: row.source || row.created_by,
    reviewStatus: row.review_status || 'CONFIRMED',
    issuer: row.organization_id ? { type: 'business', organizationId: row.organization_id } : { type: 'buyer' },
    receiptIds,
    provenance,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function confirmedThingEvidence(env, buyerId, thingId, thingPublicId, input, sourceType = 'user', sourceId = null) {
  const fields = {
    title: input.title,
    category: input.category,
    manufacturer: input.manufacturer,
    model: input.model,
    serialNumber: input.serialNumber,
    gtin: input.gtin,
    businessName: input.businessName,
    reference: input.reference,
    purchaseDate: input.purchasedOn,
    purchasePriceCents: input.purchasePriceCents,
    currency: input.currency,
    returnBy: input.returnBy,
    warrantyUntil: input.warrantyUntil,
    renewalAt: input.renewalAt,
    nextActionAt: input.nextActionAt
  };
  return Object.entries(fields).filter(([, value]) => value !== null && value !== undefined && value !== '').map(([field, value]) => evidenceStatement(env, buyerId, { type: 'field_assertion', sourceType, sourceId: sourceId || thingPublicId, thingId, field, value, provenance: sourceType === 'migration' ? 'IMPORTED' : 'USER_CONFIRMED', verification: 'UNVERIFIED' }));
}

async function thingRows(env, buyerId, includeArchived = false) {
  const result = await env.DB.prepare(`SELECT p.*,tp.thing_type,tp.category,tp.manufacturer,tp.model,tp.serial_number,tp.gtin,tp.purchase_price_cents,tp.currency,tp.lifecycle_state,tp.source,tp.review_status
    FROM ownership_passports p LEFT JOIN world_thing_profiles tp ON tp.passport_id=p.id AND tp.buyer_account_id=p.buyer_account_id
    WHERE p.buyer_account_id=? ${includeArchived ? '' : "AND p.status<>'archived'"} ORDER BY p.updated_at DESC LIMIT 500`).bind(buyerId).all();
  return result.results || [];
}

async function thingForOwner(env, buyerId, id, includeArchived = false) {
  return env.DB.prepare(`SELECT p.*,tp.thing_type,tp.category,tp.manufacturer,tp.model,tp.serial_number,tp.gtin,tp.purchase_price_cents,tp.currency,tp.lifecycle_state,tp.source,tp.review_status
    FROM ownership_passports p LEFT JOIN world_thing_profiles tp ON tp.passport_id=p.id AND tp.buyer_account_id=p.buyer_account_id
    WHERE p.buyer_account_id=? AND p.public_id=? ${includeArchived ? '' : "AND p.status<>'archived'"}`).bind(buyerId, id).first();
}

async function evidenceForThing(env, buyerId, passportInternalId) {
  const rows = await env.DB.prepare(`SELECT * FROM world_evidence WHERE buyer_account_id=? AND thing_passport_id=? ORDER BY created_at DESC LIMIT 300`).bind(buyerId, passportInternalId).all();
  return rows.results || [];
}

async function listThings(env, buyer) {
  const rows = await thingRows(env, buyer.buyer_account_id);
  return json({ things: rows.map(row => thingJson(row)), source: 'authenticated_world' });
}

function thingInput(body, current = {}) {
  const kindCandidate = clean(has(body, 'kind') ? body.kind : has(body, 'type') ? body.type : current.kind, 40);
  const kind = THING_KINDS.has(kindCandidate) ? kindCandidate : current.kind || 'product';
  const lifecycleCandidate = clean(has(body, 'lifecycleState') ? body.lifecycleState : current.lifecycle_state, 30).toUpperCase();
  const currency = clean(has(body, 'currency') ? body.currency : current.currency, 3).toUpperCase();
  return {
    kind,
    title: clean(has(body, 'title') ? body.title : current.title, 180),
    businessName: clean(has(body, 'businessName') ? body.businessName : has(body, 'business') ? body.business : current.business_name, 180) || null,
    reference: clean(has(body, 'reference') ? body.reference : current.reference, 120) || null,
    purchasedOn: safeDate(has(body, 'purchaseDate') ? body.purchaseDate : has(body, 'purchasedOn') ? body.purchasedOn : current.purchased_on),
    returnBy: safeDate(has(body, 'returnBy') ? body.returnBy : current.return_by),
    warrantyUntil: safeDate(has(body, 'warrantyUntil') ? body.warrantyUntil : current.warranty_until),
    renewalAt: safeDate(has(body, 'renewalAt') ? body.renewalAt : current.renewal_at),
    nextActionAt: safeDate(has(body, 'nextActionAt') ? body.nextActionAt : current.next_action_at),
    notes: clean(has(body, 'notes') ? body.notes : current.notes, 3000) || null,
    category: clean(has(body, 'category') ? body.category : current.category, 120) || null,
    manufacturer: clean(has(body, 'manufacturer') ? body.manufacturer : current.manufacturer, 120) || null,
    model: clean(has(body, 'model') ? body.model : current.model, 120) || null,
    serialNumber: clean(has(body, 'serialNumber') ? body.serialNumber : current.serial_number, 120) || null,
    gtin: clean(has(body, 'gtin') ? body.gtin : current.gtin, 32) || null,
    purchasePriceCents: has(body, 'purchasePriceCents') ? Math.max(0, Math.round(Number(body.purchasePriceCents))) : has(body, 'purchasePrice') ? parseMoneyToCents(body.purchasePrice) : current.purchase_price_cents ?? null,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : null,
    lifecycleState: LIFECYCLE_STATES.has(lifecycleCandidate) ? lifecycleCandidate : current.lifecycle_state || 'OWNED',
    source: clean(body.source || current.source || 'manual', 40) || 'manual',
    reviewStatus: clean(body.reviewStatus || current.review_status || 'CONFIRMED', 30).toUpperCase() === 'NEEDS_REVIEW' ? 'NEEDS_REVIEW' : 'CONFIRMED'
  };
}

async function createThing(request, env, buyer) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const input = thingInput(body);
  if (input.title.length < 2) return json({ error: 'title_required', fields: { title: 'Enter at least two characters.' } }, 422);
  const existing = (await thingRows(env, buyer.buyer_account_id)).map(row => thingJson(row));
  const candidates = duplicateCandidates(existing, input);
  if (candidates.length && body.allowDuplicate !== true) {
    log('duplicate_candidate', { buyerId: buyer.buyer_account_id, count: candidates.length });
    return json({ error: 'duplicate_review_required', candidates, canCreateSeparate: true }, 409);
  }
  const timestamp = now(), passportId = uid('opp_'), pid = publicId('STP');
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO ownership_passports(id,public_id,buyer_account_id,created_by,kind,title,business_name,reference,purchased_on,return_by,warranty_until,renewal_at,next_action_at,notes,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(passportId, pid, buyer.buyer_account_id, 'buyer', input.kind, input.title, input.businessName, input.reference, input.purchasedOn, input.returnBy, input.warrantyUntil, input.renewalAt, input.nextActionAt, input.notes, 'connected', timestamp, timestamp),
    env.DB.prepare(`INSERT INTO world_thing_profiles(passport_id,buyer_account_id,thing_type,category,manufacturer,model,serial_number,gtin,purchase_price_cents,currency,lifecycle_state,source,review_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(passportId, buyer.buyer_account_id, input.kind, input.category, input.manufacturer, input.model, input.serialNumber, input.gtin, input.purchasePriceCents, input.currency, input.lifecycleState, input.source, input.reviewStatus, timestamp, timestamp),
    historyStatement(env, buyer.buyer_account_id, 'thing', pid, 'thing.created', 'Thing added to Still', { source: input.source, kind: input.kind }),
    ...confirmedThingEvidence(env, buyer.buyer_account_id, passportId, pid, input)
  ]);
  log('thing_creation', { buyerId: buyer.buyer_account_id, thingId: pid, source: input.source });
  const row = await thingForOwner(env, buyer.buyer_account_id, pid);
  return json({ ok: true, thing: thingJson(row) }, 201);
}

async function thingDetail(env, buyer, id) {
  const row = await thingForOwner(env, buyer.buyer_account_id, id);
  if (!row) return json({ error: 'not_found' }, 404);
  const [evidence, history, links] = await Promise.all([
    evidenceForThing(env, buyer.buyer_account_id, row.id),
    env.DB.prepare(`SELECT public_id,event_type,title,details_json,source_type,source_public_id,occurred_at FROM world_history_events WHERE buyer_account_id=? AND entity_type='thing' AND entity_public_id=? ORDER BY occurred_at DESC LIMIT 300`).bind(buyer.buyer_account_id, id).all(),
    env.DB.prepare(`SELECT * FROM world_relationships WHERE buyer_account_id=? AND ((from_type='thing' AND from_public_id=?) OR (to_type='thing' AND to_public_id=?)) ORDER BY created_at DESC`).bind(buyer.buyer_account_id, id, id).all()
  ]);
  const receipts = [...new Set(evidence.filter(item => item.receipt_id).map(item => item.source_public_id))];
  return json({
    thing: thingJson(row, evidence, receipts),
    passport: thingJson(row, evidence, receipts),
    evidence: evidence.map(item => ({ publicId: item.public_id, type: item.evidence_type, sourceType: item.source_type, sourceId: item.source_public_id, field: item.field_name, value: safeJson(item.value_json, null), provenance: item.provenance, confidence: item.confidence, verification: item.verification_status, createdAt: item.created_at })),
    history: (history.results || []).map(item => ({ ...item, details: safeJson(item.details_json), details_json: undefined })),
    relationships: links.results || []
  });
}

async function updateThing(request, env, buyer, id) {
  const current = await thingForOwner(env, buyer.buyer_account_id, id);
  if (!current) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const input = thingInput(body, current);
  if (input.title.length < 2) return json({ error: 'title_required' }, 422);
  const timestamp = now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE ownership_passports SET kind=?,title=?,business_name=?,reference=?,purchased_on=?,return_by=?,warranty_until=?,renewal_at=?,next_action_at=?,notes=?,updated_at=? WHERE id=? AND buyer_account_id=?`)
      .bind(input.kind, input.title, input.businessName, input.reference, input.purchasedOn, input.returnBy, input.warrantyUntil, input.renewalAt, input.nextActionAt, input.notes, timestamp, current.id, buyer.buyer_account_id),
    env.DB.prepare(`INSERT INTO world_thing_profiles(passport_id,buyer_account_id,thing_type,category,manufacturer,model,serial_number,gtin,purchase_price_cents,currency,lifecycle_state,source,review_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(passport_id) DO UPDATE SET thing_type=excluded.thing_type,category=excluded.category,manufacturer=excluded.manufacturer,model=excluded.model,serial_number=excluded.serial_number,gtin=excluded.gtin,purchase_price_cents=excluded.purchase_price_cents,currency=excluded.currency,lifecycle_state=excluded.lifecycle_state,review_status=excluded.review_status,updated_at=excluded.updated_at`)
      .bind(current.id, buyer.buyer_account_id, input.kind, input.category, input.manufacturer, input.model, input.serialNumber, input.gtin, input.purchasePriceCents, input.currency, input.lifecycleState, input.source, input.reviewStatus, current.created_at, timestamp),
    historyStatement(env, buyer.buyer_account_id, 'thing', id, 'thing.updated', 'Thing details updated', { fields: Object.keys(body).slice(0, 30) }, 'user', buyer.buyer_account_id),
    ...confirmedThingEvidence(env, buyer.buyer_account_id, current.id, id, input)
  ]);
  return thingDetail(env, buyer, id);
}

async function archiveThing(request, env, buyer, id) {
  const row = await thingForOwner(env, buyer.buyer_account_id, id);
  if (!row) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  const counts = await env.DB.prepare(`SELECT
    (SELECT COUNT(*) FROM world_evidence WHERE buyer_account_id=? AND thing_passport_id=?) evidence_count,
    (SELECT COUNT(*) FROM world_relationships WHERE buyer_account_id=? AND ((from_type='thing' AND from_public_id=?) OR (to_type='thing' AND to_public_id=?))) relationship_count`).bind(buyer.buyer_account_id, row.id, buyer.buyer_account_id, id, id).first();
  if (clean(body.confirmTitle, 180) !== row.title) return json({ error: 'deletion_confirmation_required', confirmTitle: row.title, linkedEvidence: Number(counts?.evidence_count || 0), linkedRelationships: Number(counts?.relationship_count || 0), action: 'archive' }, 409);
  const timestamp = now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE ownership_passports SET status='archived',updated_at=? WHERE id=? AND buyer_account_id=?`).bind(timestamp, row.id, buyer.buyer_account_id),
    env.DB.prepare(`UPDATE world_thing_profiles SET lifecycle_state='ARCHIVED',updated_at=? WHERE passport_id=? AND buyer_account_id=?`).bind(timestamp, row.id, buyer.buyer_account_id),
    historyStatement(env, buyer.buyer_account_id, 'thing', id, 'thing.archived', 'Thing archived', { evidencePreserved: Number(counts?.evidence_count || 0) })
  ]);
  return json({ ok: true, archived: true, evidencePreserved: true });
}

function receiptJson(row, items = [], candidates = {}) {
  return {
    publicId: row.public_id,
    merchant: row.merchant || null,
    purchaseDate: row.purchase_date || null,
    currency: row.currency || null,
    subtotalCents: row.subtotal_cents ?? null,
    taxCents: row.tax_cents ?? null,
    totalCents: row.total_cents ?? null,
    reference: row.reference || null,
    processingStatus: row.processing_status,
    processingError: row.processing_error_code ? { code: row.processing_error_code, message: row.processing_error_message || null } : null,
    confidence: safeJson(row.confidence_json),
    original: { available: true, mimeType: row.source_mime_type, fileName: row.source_file_name, bytes: Number(row.source_file_bytes), url: `/api/v1/world/receipts/${encodeURIComponent(row.public_id)}/original` },
    items: items.map(item => ({
      publicId: item.public_id,
      rawLabel: item.raw_label,
      title: item.title,
      quantity: Number(item.quantity || 1),
      unitPriceCents: item.unit_price_cents ?? null,
      totalCents: item.total_cents ?? null,
      currency: item.currency || row.currency || null,
      sku: item.sku || null,
      gtin: item.gtin || null,
      manufacturerCandidate: item.manufacturer_candidate || null,
      modelCandidate: item.model_candidate || null,
      confidence: Number(item.confidence || 0),
      disposition: item.disposition,
      thingPublicId: item.thing_public_id || null,
      duplicateCandidates: candidates[item.public_id] || []
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at || null
  };
}

async function receiptForOwner(env, buyerId, id, includeArchived = false) {
  return env.DB.prepare(`SELECT * FROM world_receipts WHERE buyer_account_id=? AND public_id=? ${includeArchived ? '' : 'AND archived_at IS NULL'}`).bind(buyerId, id).first();
}

async function receiptItems(env, buyerId, receiptId) {
  const rows = await env.DB.prepare(`SELECT i.*,p.public_id thing_public_id FROM world_receipt_items i LEFT JOIN ownership_passports p ON p.id=i.thing_passport_id WHERE i.buyer_account_id=? AND i.receipt_id=? ORDER BY i.created_at,i.public_id`).bind(buyerId, receiptId).all();
  return rows.results || [];
}

async function receiptWithCandidates(env, buyer, row) {
  const [items, things] = await Promise.all([receiptItems(env, buyer.buyer_account_id, row.id), thingRows(env, buyer.buyer_account_id)]);
  const thingData = things.map(thing => thingJson(thing));
  const candidates = {};
  for (const item of items) candidates[item.public_id] = duplicateCandidates(thingData, { title: item.title, purchaseDate: row.purchase_date, receiptId: row.public_id });
  return receiptJson(row, items, candidates);
}

async function listReceipts(env, buyer) {
  const rows = await env.DB.prepare(`SELECT * FROM world_receipts WHERE buyer_account_id=? AND archived_at IS NULL ORDER BY created_at DESC LIMIT 300`).bind(buyer.buyer_account_id).all();
  return json({ receipts: (rows.results || []).map(row => receiptJson(row)) });
}

async function ocrBuffer(env, buffer, fileName, mimeType) {
  if (!env.AI?.toMarkdown) throw Object.assign(new Error('OCR service is not configured.'), { code: 'ocr_not_configured' });
  let converted;
  try {
    converted = await env.AI.toMarkdown({ name: fileName, blob: new Blob([buffer], { type: mimeType }) }, { conversionOptions: { output: { format: 'text' }, pdf: { metadata: false } } });
  } catch (error) {
    throw Object.assign(new Error('The receipt could not be read. Try a clearer image or enter the details manually.'), { code: 'ocr_provider_failed', cause: error });
  }
  const result = Array.isArray(converted) ? converted[0] : converted;
  if (!result || result.error) throw Object.assign(new Error(clean(result?.error, 240) || 'The receipt could not be read.'), { code: 'ocr_provider_failed' });
  const text = clean(String(result.data || ''), MAX_EXTRACTED_CHARS);
  if (!text) throw Object.assign(new Error('No readable text was found. Try another image.'), { code: 'no_text_extracted' });
  return { text, format: clean(result.format, 40) || 'text', parsed: parseReceiptText(text) };
}

async function processReceipt(env, buyer, row, buffer) {
  const timestamp = now();
  await env.DB.prepare(`UPDATE world_receipts SET processing_status='PROCESSING',processing_error_code=NULL,processing_error_message=NULL,updated_at=? WHERE id=? AND buyer_account_id=?`).bind(timestamp, row.id, buyer.buyer_account_id).run();
  log('ocr_start', { buyerId: buyer.buyer_account_id, receiptId: row.public_id });
  try {
    const result = await ocrBuffer(env, buffer, row.source_file_name, row.source_mime_type);
    const statements = [
      env.DB.prepare(`UPDATE world_receipts SET merchant=?,purchase_date=?,currency=?,subtotal_cents=?,tax_cents=?,total_cents=?,reference=?,raw_ocr_text=?,processing_status='NEEDS_REVIEW',confidence_json=?,processing_error_code=NULL,processing_error_message=NULL,updated_at=? WHERE id=? AND buyer_account_id=?`)
        .bind(result.parsed.merchant, result.parsed.purchaseDate, result.parsed.currency, result.parsed.subtotalCents, result.parsed.taxCents, result.parsed.totalCents, result.parsed.reference, result.text, JSON.stringify(result.parsed.confidence), now(), row.id, buyer.buyer_account_id),
      env.DB.prepare(`DELETE FROM world_receipt_items WHERE receipt_id=? AND buyer_account_id=? AND disposition='NEEDS_REVIEW'`).bind(row.id, buyer.buyer_account_id)
    ];
    for (const item of result.parsed.items) {
      statements.push(env.DB.prepare(`INSERT INTO world_receipt_items(id,public_id,receipt_id,buyer_account_id,raw_label,title,quantity,unit_price_cents,total_cents,currency,sku,gtin,manufacturer_candidate,model_candidate,confidence,disposition,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(uid('wri_'), publicId('RLI'), row.id, buyer.buyer_account_id, item.rawLabel, item.title, item.quantity, item.unitPriceCents, item.totalCents, item.currency, item.sku || null, item.gtin || null, item.manufacturerCandidate || null, item.modelCandidate || null, item.confidence, 'NEEDS_REVIEW', now(), now()));
    }
    statements.push(historyStatement(env, buyer.buyer_account_id, 'receipt', row.public_id, 'receipt.ocr_completed', 'Receipt ready to review', { itemCount: result.parsed.items.length, format: result.format }, 'ocr', row.public_id));
    await env.DB.batch(statements);
    log('ocr_complete', { buyerId: buyer.buyer_account_id, receiptId: row.public_id, itemCount: result.parsed.items.length });
    const updated = await receiptForOwner(env, buyer.buyer_account_id, row.public_id);
    return { ok: true, receipt: await receiptWithCandidates(env, buyer, updated) };
  } catch (error) {
    const code = clean(error.code, 80) || 'ocr_failed', message = clean(error.message, 280) || 'Receipt processing failed.';
    await env.DB.batch([
      env.DB.prepare(`UPDATE world_receipts SET processing_status='FAILED',processing_error_code=?,processing_error_message=?,updated_at=? WHERE id=? AND buyer_account_id=?`).bind(code, message, now(), row.id, buyer.buyer_account_id),
      historyStatement(env, buyer.buyer_account_id, 'receipt', row.public_id, 'receipt.ocr_failed', 'Receipt processing failed', { code }, 'ocr', row.public_id)
    ]);
    log('ocr_fail', { buyerId: buyer.buyer_account_id, receiptId: row.public_id, category: code });
    return { ok: false, error: code, message };
  }
}

async function captureReceipt(request, env, buyer) {
  if (!env.WORLD_FILES) return json({ error: 'private_storage_not_configured' }, 503);
  if (!await rateLimit(env, buyer, 'ocr')) return json({ error: 'ocr_rate_limited', retryAfterSeconds: 60 }, 429, { 'retry-after': '60' });
  const form = await request.formData().catch(() => null), file = form?.get('file');
  if (!form || !file || typeof file.arrayBuffer !== 'function') return json({ error: 'receipt_image_required' }, 422);
  if (file.size < 1 || file.size > MAX_RECEIPT_BYTES) return json({ error: 'file_size_not_supported', maxBytes: MAX_RECEIPT_BYTES }, 413);
  const buffer = await file.arrayBuffer(), validation = validateImageBytes(new Uint8Array(buffer), file.type);
  if (!validation.ok) {
    const status = validation.code === 'heic_not_supported' ? 415 : 422;
    return json({ error: validation.code, supportedTypes: ['image/jpeg', 'image/png', 'image/webp'], message: validation.code === 'heic_not_supported' ? 'HEIC is not supported yet. Export the photo as JPEG, PNG, or WebP and try again.' : 'The file content does not match a supported receipt image.' }, status);
  }
  const hash = await sha(buffer);
  const duplicate = await env.DB.prepare(`SELECT public_id,processing_status,created_at FROM world_receipts WHERE buyer_account_id=? AND source_file_hash=? AND archived_at IS NULL ORDER BY created_at DESC LIMIT 1`).bind(buyer.buyer_account_id, hash).first();
  if (duplicate) return json({ error: 'duplicate_receipt', existing: { publicId: duplicate.public_id, processingStatus: duplicate.processing_status, createdAt: duplicate.created_at } }, 409);
  const timestamp = now(), id = uid('wrc_'), pid = publicId('RCP');
  const extension = validation.mimeType === 'image/jpeg' ? 'jpg' : validation.mimeType === 'image/png' ? 'png' : 'webp';
  const objectKey = `${buyer.buyer_account_id}/receipts/${id}.${extension}`;
  const fileName = clean(file.name || `receipt.${extension}`, 180);
  await env.DB.prepare(`INSERT INTO world_receipts(id,public_id,buyer_account_id,processing_status,source_image_key,source_mime_type,source_file_name,source_file_hash,source_file_bytes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, pid, buyer.buyer_account_id, 'UPLOADING', objectKey, validation.mimeType, fileName, hash, file.size, timestamp, timestamp).run();
  log('receipt_upload', { buyerId: buyer.buyer_account_id, receiptId: pid, bytes: file.size, mimeType: validation.mimeType });
  try {
    await env.WORLD_FILES.put(objectKey, buffer, { httpMetadata: { contentType: validation.mimeType, contentDisposition: `inline; filename="${fileName.replace(/["\\]/g, '')}"` } });
  } catch (error) {
    await env.DB.prepare(`UPDATE world_receipts SET processing_status='FAILED',processing_error_code='storage_write_failed',processing_error_message='The receipt could not be stored. Try again.',updated_at=? WHERE id=?`).bind(now(), id).run();
    log('ocr_fail', { buyerId: buyer.buyer_account_id, receiptId: pid, category: 'storage_write_failed' });
    return json({ error: 'storage_write_failed', receiptId: pid }, 503);
  }
  const row = await receiptForOwner(env, buyer.buyer_account_id, pid);
  const result = await processReceipt(env, buyer, row, buffer);
  if (!result.ok) return json({ error: result.error, message: result.message, receipt: receiptJson(await receiptForOwner(env, buyer.buyer_account_id, pid)) }, 422);
  return json({ ok: true, receipt: result.receipt }, 201);
}

async function receiptDetail(env, buyer, id) {
  const row = await receiptForOwner(env, buyer.buyer_account_id, id);
  return row ? json({ receipt: await receiptWithCandidates(env, buyer, row) }) : json({ error: 'not_found' }, 404);
}

async function receiptOriginal(env, buyer, id, request) {
  if (!env.WORLD_FILES) return json({ error: 'private_storage_not_configured' }, 503);
  const row = await receiptForOwner(env, buyer.buyer_account_id, id);
  if (!row) return json({ error: 'not_found' }, 404);
  const object = await env.WORLD_FILES.get(row.source_image_key);
  if (!object) return json({ error: 'original_not_found' }, 404);
  const headers = new Headers({ 'content-type': row.source_mime_type, 'cache-control': 'private, no-store', 'content-disposition': `inline; filename="${row.source_file_name.replace(/["\\]/g, '')}"`, 'x-content-type-options': 'nosniff' });
  if (object.httpEtag) headers.set('etag', object.httpEtag);
  return new Response(request.method === 'HEAD' ? null : object.body, { status: 200, headers });
}

async function retryReceipt(env, buyer, id) {
  if (!env.WORLD_FILES) return json({ error: 'private_storage_not_configured' }, 503);
  if (!await rateLimit(env, buyer, 'ocr')) return json({ error: 'ocr_rate_limited' }, 429, { 'retry-after': '60' });
  const row = await receiptForOwner(env, buyer.buyer_account_id, id);
  if (!row) return json({ error: 'not_found' }, 404);
  if (!['FAILED', 'NEEDS_REVIEW'].includes(row.processing_status)) return json({ error: 'receipt_not_retryable', processingStatus: row.processing_status }, 409);
  const object = await env.WORLD_FILES.get(row.source_image_key);
  if (!object) return json({ error: 'original_not_found' }, 404);
  const result = await processReceipt(env, buyer, row, await object.arrayBuffer());
  return result.ok ? json({ ok: true, receipt: result.receipt }) : json({ error: result.error, message: result.message, receipt: receiptJson(await receiptForOwner(env, buyer.buyer_account_id, id)) }, 422);
}

async function reviewReceipt(request, env, buyer, id) {
  const row = await receiptForOwner(env, buyer.buyer_account_id, id);
  if (!row) return json({ error: 'not_found' }, 404);
  if (!['NEEDS_REVIEW', 'CONFIRMED'].includes(row.processing_status)) return json({ error: 'receipt_not_ready', processingStatus: row.processing_status }, 409);
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const timestamp = now(), currency = clean(has(body, 'currency') ? body.currency : row.currency, 3).toUpperCase();
  const fields = {
    merchant: clean(has(body, 'merchant') ? body.merchant : row.merchant, 180) || null,
    purchaseDate: safeDate(has(body, 'purchaseDate') ? body.purchaseDate : row.purchase_date),
    currency: /^[A-Z]{3}$/.test(currency) ? currency : null,
    subtotal: has(body, 'subtotalCents') ? Math.max(0, Math.round(Number(body.subtotalCents))) : row.subtotal_cents,
    tax: has(body, 'taxCents') ? Math.max(0, Math.round(Number(body.taxCents))) : row.tax_cents,
    total: has(body, 'totalCents') ? Math.max(0, Math.round(Number(body.totalCents))) : row.total_cents,
    reference: clean(has(body, 'reference') ? body.reference : row.reference, 120) || null
  };
  const existingItems = await receiptItems(env, buyer.buyer_account_id, row.id), existingMap = new Map(existingItems.map(item => [item.public_id, item]));
  const statements = [env.DB.prepare(`UPDATE world_receipts SET merchant=?,purchase_date=?,currency=?,subtotal_cents=?,tax_cents=?,total_cents=?,reference=?,processing_status='NEEDS_REVIEW',updated_at=? WHERE id=? AND buyer_account_id=?`)
    .bind(fields.merchant, fields.purchaseDate, fields.currency, fields.subtotal, fields.tax, fields.total, fields.reference, timestamp, row.id, buyer.buyer_account_id)];
  const validDispositions = new Set(['NEEDS_REVIEW', 'CREATE_THING', 'LINK_THING', 'IGNORE']);
  for (const item of Array.isArray(body.items) ? body.items.slice(0, 100) : []) {
    const itemId = clean(item.publicId, 40), title = clean(item.title, 180), disposition = validDispositions.has(item.disposition) ? item.disposition : 'NEEDS_REVIEW';
    if (title.length < 2) return json({ error: 'invalid_receipt_item', itemId: itemId || null }, 422);
    if (!itemId) {
      statements.push(env.DB.prepare(`INSERT INTO world_receipt_items(id,public_id,receipt_id,buyer_account_id,raw_label,title,quantity,unit_price_cents,total_cents,currency,sku,gtin,manufacturer_candidate,model_candidate,confidence,disposition,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
        .bind(uid('wri_'), publicId('RLI'), row.id, buyer.buyer_account_id, title, title, Math.max(0.001, Number(item.quantity) || 1), has(item, 'unitPriceCents') && item.unitPriceCents !== null ? Math.max(0, Math.round(Number(item.unitPriceCents))) : null, has(item, 'totalCents') && item.totalCents !== null ? Math.max(0, Math.round(Number(item.totalCents))) : null, clean(item.currency || fields.currency, 3).toUpperCase() || null, clean(item.sku, 80) || null, clean(item.gtin, 32) || null, clean(item.manufacturerCandidate, 120) || null, clean(item.modelCandidate, 120) || null, 1, disposition, timestamp, timestamp));
      continue;
    }
    const current = existingMap.get(itemId);
    if (!current) return json({ error: 'receipt_item_not_found', itemId }, 404);
    statements.push(env.DB.prepare(`UPDATE world_receipt_items SET title=?,quantity=?,unit_price_cents=?,total_cents=?,currency=?,sku=?,gtin=?,manufacturer_candidate=?,model_candidate=?,disposition=?,updated_at=? WHERE public_id=? AND receipt_id=? AND buyer_account_id=?`)
      .bind(title, has(item, 'quantity') ? Math.max(0.001, Number(item.quantity) || 1) : current.quantity, has(item, 'unitPriceCents') ? item.unitPriceCents === null ? null : Math.max(0, Math.round(Number(item.unitPriceCents))) : current.unit_price_cents, has(item, 'totalCents') ? item.totalCents === null ? null : Math.max(0, Math.round(Number(item.totalCents))) : current.total_cents, clean(item.currency || current.currency || fields.currency, 3).toUpperCase() || null, clean(has(item, 'sku') ? item.sku : current.sku, 80) || null, clean(has(item, 'gtin') ? item.gtin : current.gtin, 32) || null, clean(has(item, 'manufacturerCandidate') ? item.manufacturerCandidate : current.manufacturer_candidate, 120) || null, clean(has(item, 'modelCandidate') ? item.modelCandidate : current.model_candidate, 120) || null, disposition, timestamp, itemId, row.id, buyer.buyer_account_id));
  }
  statements.push(historyStatement(env, buyer.buyer_account_id, 'receipt', id, 'receipt.reviewed', 'Receipt details reviewed', { itemCount: Array.isArray(body.items) ? body.items.length : 0 }, 'user', buyer.buyer_account_id));
  await env.DB.batch(statements);
  log('receipt_review', { buyerId: buyer.buyer_account_id, receiptId: id });
  return receiptDetail(env, buyer, id);
}

function evidenceStatement(env, buyerId, evidence) {
  return env.DB.prepare(`INSERT INTO world_evidence(id,public_id,buyer_account_id,evidence_type,source_type,source_public_id,thing_passport_id,receipt_id,document_id,field_name,value_json,provenance,confidence,verification_status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(uid('wev_'), publicId('EVD'), buyerId, evidence.type, evidence.sourceType, evidence.sourceId, evidence.thingId || null, evidence.receiptId || null, evidence.documentId || null, evidence.field || null, evidence.value === undefined ? null : JSON.stringify(evidence.value).slice(0, 4000), evidence.provenance || 'USER_CONFIRMED', evidence.confidence ?? null, evidence.verification || 'UNVERIFIED', now());
}

async function confirmReceipt(request, env, buyer, id) {
  const receipt = await receiptForOwner(env, buyer.buyer_account_id, id);
  if (!receipt) return json({ error: 'not_found' }, 404);
  if (!['NEEDS_REVIEW', 'CONFIRMED'].includes(receipt.processing_status)) return json({ error: 'receipt_not_ready', processingStatus: receipt.processing_status }, 409);
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.items)) return json({ error: 'receipt_item_decisions_required' }, 422);
  const [items, existingRows] = await Promise.all([receiptItems(env, buyer.buyer_account_id, receipt.id), thingRows(env, buyer.buyer_account_id)]);
  const itemMap = new Map(items.map(item => [item.public_id, item]));
  const decidedIds = new Set(body.items.map(item => clean(item.publicId, 40)));
  const undecided = items.filter(item => item.disposition === 'NEEDS_REVIEW' && !decidedIds.has(item.public_id));
  if (undecided.length) return json({ error: 'receipt_items_still_need_review', itemIds: undecided.map(item => item.public_id) }, 422);
  const existing = existingRows.map(row => thingJson(row));
  const decisions = [];
  for (const decision of body.items.slice(0, 100)) {
    const item = itemMap.get(clean(decision.publicId, 40));
    const action = clean(decision.action, 20).toLocaleLowerCase();
    if (!item || !['create', 'link', 'ignore'].includes(action)) return json({ error: 'invalid_receipt_item_decision', itemId: decision.publicId || null }, 422);
    if (action === 'link') {
      const thing = await thingForOwner(env, buyer.buyer_account_id, clean(decision.thingPublicId, 40));
      if (!thing) return json({ error: 'thing_not_found', itemId: item.public_id }, 404);
      decisions.push({ action, item, thing, publicId: thing.public_id });
      continue;
    }
    if (action === 'create') {
      const draft = {
        title: clean(decision.title || item.title, 180),
        serialNumber: clean(decision.serialNumber, 120) || null,
        gtin: clean(decision.gtin, 32) || null,
        purchaseDate: receipt.purchase_date,
        receiptId: receipt.public_id
      };
      if (draft.title.length < 2) return json({ error: 'title_required', itemId: item.public_id }, 422);
      const candidates = duplicateCandidates(existing, draft);
      if (candidates.length && decision.allowDuplicate !== true) {
        log('duplicate_candidate', { buyerId: buyer.buyer_account_id, receiptId: id, itemId: item.public_id, count: candidates.length });
        return json({ error: 'duplicate_review_required', itemId: item.public_id, candidates, canCreateSeparate: true }, 409);
      }
      decisions.push({ action, item, draft, allowDuplicate: decision.allowDuplicate === true });
      continue;
    }
    decisions.push({ action, item });
  }
  if (!decisions.length) return json({ error: 'receipt_item_decisions_required' }, 422);
  const timestamp = now(), statements = [], results = [];
  for (const decision of decisions) {
    if (decision.action === 'ignore') {
      statements.push(env.DB.prepare(`UPDATE world_receipt_items SET disposition='IGNORE',thing_passport_id=NULL,updated_at=? WHERE id=? AND buyer_account_id=?`).bind(timestamp, decision.item.id, buyer.buyer_account_id));
      results.push({ itemPublicId: decision.item.public_id, action: 'ignored' });
      continue;
    }
    let thingInternalId, thingPid, created = false;
    if (decision.action === 'create') {
      thingInternalId = uid('opp_');
      thingPid = publicId('STP');
      created = true;
      const kind = THING_KINDS.has(clean(decision.draft.kind, 40)) ? decision.draft.kind : 'product';
      statements.push(
        env.DB.prepare(`INSERT INTO ownership_passports(id,public_id,buyer_account_id,created_by,kind,title,business_name,reference,purchased_on,notes,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(thingInternalId, thingPid, buyer.buyer_account_id, 'buyer', kind, decision.draft.title, receipt.merchant || null, receipt.reference || null, receipt.purchase_date || null, null, 'connected', timestamp, timestamp),
        env.DB.prepare(`INSERT INTO world_thing_profiles(passport_id,buyer_account_id,thing_type,category,manufacturer,model,serial_number,gtin,purchase_price_cents,currency,lifecycle_state,source,review_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
          .bind(thingInternalId, buyer.buyer_account_id, kind, clean(decision.draft.category, 120) || null, clean(decision.draft.manufacturer, 120) || null, clean(decision.draft.model, 120) || null, decision.draft.serialNumber, decision.draft.gtin, decision.item.total_cents, receipt.currency || decision.item.currency || null, 'OWNED', 'receipt_ocr', 'CONFIRMED', timestamp, timestamp),
        historyStatement(env, buyer.buyer_account_id, 'thing', thingPid, 'thing.created_from_receipt', 'Thing created from a confirmed receipt', { receiptId: receipt.public_id, receiptItemId: decision.item.public_id, allowDuplicate: decision.allowDuplicate }, 'receipt', receipt.public_id)
      );
      existing.push({ publicId: thingPid, title: decision.draft.title, serialNumber: decision.draft.serialNumber, gtin: decision.draft.gtin, purchaseDate: receipt.purchase_date, receiptIds: [receipt.public_id] });
      log('thing_creation', { buyerId: buyer.buyer_account_id, thingId: thingPid, source: 'receipt' });
    } else {
      thingInternalId = decision.thing.id;
      thingPid = decision.publicId;
      statements.push(
        env.DB.prepare(`UPDATE ownership_passports SET business_name=COALESCE(business_name,?),reference=COALESCE(reference,?),purchased_on=COALESCE(purchased_on,?),updated_at=? WHERE id=? AND buyer_account_id=?`)
          .bind(receipt.merchant || null, receipt.reference || null, receipt.purchase_date || null, timestamp, thingInternalId, buyer.buyer_account_id),
        env.DB.prepare(`INSERT INTO world_thing_profiles(passport_id,buyer_account_id,thing_type,purchase_price_cents,currency,lifecycle_state,source,review_status,created_at,updated_at) VALUES(?,?,?,?,?,'OWNED','receipt_link','CONFIRMED',?,?)
          ON CONFLICT(passport_id) DO UPDATE SET purchase_price_cents=COALESCE(world_thing_profiles.purchase_price_cents,excluded.purchase_price_cents),currency=COALESCE(world_thing_profiles.currency,excluded.currency),updated_at=excluded.updated_at`)
          .bind(thingInternalId, buyer.buyer_account_id, decision.thing.kind, decision.item.total_cents, receipt.currency || decision.item.currency || null, decision.thing.created_at, timestamp),
        historyStatement(env, buyer.buyer_account_id, 'thing', thingPid, 'thing.receipt_linked', 'Receipt linked to Thing', { receiptId: receipt.public_id, receiptItemId: decision.item.public_id }, 'receipt', receipt.public_id)
      );
      log('thing_link', { buyerId: buyer.buyer_account_id, thingId: thingPid, receiptId: receipt.public_id });
    }
    statements.push(
      env.DB.prepare(`UPDATE world_receipt_items SET disposition='CONFIRMED',thing_passport_id=?,updated_at=? WHERE id=? AND buyer_account_id=?`).bind(thingInternalId, timestamp, decision.item.id, buyer.buyer_account_id),
      relationshipStatement(env, buyer.buyer_account_id, 'receipt', receipt.public_id, 'thing', thingPid, 'evidence_for'),
      evidenceStatement(env, buyer.buyer_account_id, { type: 'purchase_receipt', sourceType: 'receipt', sourceId: receipt.public_id, thingId: thingInternalId, receiptId: receipt.id, field: 'title', value: decision.item.title, provenance: 'USER_CONFIRMED', confidence: decision.item.confidence }),
      evidenceStatement(env, buyer.buyer_account_id, { type: 'purchase_receipt', sourceType: 'receipt', sourceId: receipt.public_id, thingId: thingInternalId, receiptId: receipt.id, field: 'purchaseDate', value: receipt.purchase_date, provenance: 'USER_CONFIRMED', confidence: safeJson(receipt.confidence_json).purchaseDate ?? null }),
      evidenceStatement(env, buyer.buyer_account_id, { type: 'purchase_receipt', sourceType: 'receipt', sourceId: receipt.public_id, thingId: thingInternalId, receiptId: receipt.id, field: 'businessName', value: receipt.merchant, provenance: 'USER_CONFIRMED', confidence: safeJson(receipt.confidence_json).merchant ?? null }),
      evidenceStatement(env, buyer.buyer_account_id, { type: 'purchase_receipt', sourceType: 'receipt', sourceId: receipt.public_id, thingId: thingInternalId, receiptId: receipt.id, field: 'purchasePriceCents', value: decision.item.total_cents, provenance: 'USER_CONFIRMED', confidence: decision.item.confidence })
    );
    results.push({ itemPublicId: decision.item.public_id, action: created ? 'created' : 'linked', thingPublicId: thingPid });
  }
  statements.push(
    env.DB.prepare(`UPDATE world_receipts SET processing_status='CONFIRMED',confirmed_at=COALESCE(confirmed_at,?),updated_at=? WHERE id=? AND buyer_account_id=?`).bind(timestamp, timestamp, receipt.id, buyer.buyer_account_id),
    historyStatement(env, buyer.buyer_account_id, 'receipt', receipt.public_id, 'receipt.confirmed', 'Receipt confirmed', { decisions: results }, 'user', buyer.buyer_account_id)
  );
  await env.DB.batch(statements);
  return json({ ok: true, receipt: await receiptWithCandidates(env, buyer, await receiptForOwner(env, buyer.buyer_account_id, id)), results }, 200);
}

async function archiveReceipt(request, env, buyer, id) {
  const row = await receiptForOwner(env, buyer.buyer_account_id, id);
  if (!row) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  const linked = await env.DB.prepare(`SELECT COUNT(DISTINCT thing_passport_id) count FROM world_receipt_items WHERE receipt_id=? AND buyer_account_id=? AND thing_passport_id IS NOT NULL`).bind(row.id, buyer.buyer_account_id).first();
  if (clean(body.confirmReceiptId, 40) !== row.public_id) return json({ error: 'deletion_confirmation_required', confirmReceiptId: row.public_id, linkedThings: Number(linked?.count || 0), linkedThingsWillBePreserved: true, originalWillBeDeleted: true }, 409);
  if (env.WORLD_FILES) await env.WORLD_FILES.delete(row.source_image_key).catch(() => {});
  const timestamp = now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE world_receipts SET archived_at=?,raw_ocr_text=NULL,source_image_key=?,source_file_bytes=0,updated_at=? WHERE id=? AND buyer_account_id=?`).bind(timestamp, `deleted:${row.id}`, timestamp, row.id, buyer.buyer_account_id),
    historyStatement(env, buyer.buyer_account_id, 'receipt', id, 'receipt.deleted', 'Receipt deleted', { linkedThingsPreserved: Number(linked?.count || 0) }, 'user', buyer.buyer_account_id)
  ]);
  return json({ ok: true, deleted: true, linkedThingsPreserved: true });
}

function documentJson(row, full = false) {
  const value = {
    publicId: row.public_id,
    title: row.title,
    documentType: row.document_type,
    mimeType: row.mime_type,
    fileName: row.original_file_name,
    bytes: Number(row.file_bytes || 0),
    processingStatus: row.processing_status,
    processingError: row.processing_error_code || null,
    originalUrl: `/api/v1/world/documents/${encodeURIComponent(row.public_id)}/original`,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  if (full) value.extractedText = row.extracted_text || null;
  else value.excerpt = clean(String(row.extracted_text || '').replace(/\s+/g, ' '), 280) || null;
  return value;
}

function validateDocumentBytes(buffer, mimeType) {
  const bytes = new Uint8Array(buffer), mime = clean(mimeType, 120).toLocaleLowerCase();
  if (!DOCUMENT_MIMES.has(mime)) return { ok: false, code: mime.includes('heic') || mime.includes('heif') ? 'heic_not_supported' : 'document_type_not_supported' };
  if (mime.startsWith('image/')) return validateImageBytes(bytes, mime);
  if (mime === 'application/pdf' && String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') return { ok: false, code: 'invalid_document_content' };
  if (mime.includes('openxmlformats') && !(bytes[0] === 0x50 && bytes[1] === 0x4b)) return { ok: false, code: 'invalid_document_content' };
  return { ok: true, mimeType: mime };
}

async function extractDocument(env, buffer, fileName, mimeType) {
  if (mimeType === 'text/plain' || mimeType === 'text/csv') return clean(new TextDecoder().decode(buffer), MAX_EXTRACTED_CHARS);
  if (!env.AI?.toMarkdown) throw Object.assign(new Error('Document extraction is not configured.'), { code: 'document_ai_not_configured' });
  let converted;
  try { converted = await env.AI.toMarkdown({ name: fileName, blob: new Blob([buffer], { type: mimeType }) }, { conversionOptions: { output: { format: 'text' }, pdf: { metadata: false } } }); }
  catch (error) { throw Object.assign(new Error('The document could not be processed.'), { code: 'document_conversion_failed', cause: error }); }
  const result = Array.isArray(converted) ? converted[0] : converted;
  const text = clean(String(result?.data || ''), MAX_EXTRACTED_CHARS);
  if (!result || result.error || !text) throw Object.assign(new Error(clean(result?.error, 220) || 'No readable text was found.'), { code: 'document_conversion_failed' });
  return text;
}

async function listDocuments(env, buyer) {
  const rows = await env.DB.prepare(`SELECT * FROM world_documents WHERE buyer_account_id=? AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 300`).bind(buyer.buyer_account_id).all();
  return json({ documents: (rows.results || []).map(row => documentJson(row)) });
}

async function documentForOwner(env, buyerId, id) {
  return env.DB.prepare(`SELECT * FROM world_documents WHERE buyer_account_id=? AND public_id=? AND archived_at IS NULL`).bind(buyerId, id).first();
}

async function uploadDocument(request, env, buyer) {
  if (!env.WORLD_FILES) return json({ error: 'private_storage_not_configured' }, 503);
  if (!await rateLimit(env, buyer, 'ocr')) return json({ error: 'document_processing_rate_limited' }, 429, { 'retry-after': '60' });
  const form = await request.formData().catch(() => null), file = form?.get('file');
  if (!form || !file || typeof file.arrayBuffer !== 'function') return json({ error: 'document_required' }, 422);
  if (form.get('consent') !== 'true') return json({ error: 'processing_consent_required' }, 422);
  if (file.size < 1 || file.size > MAX_DOCUMENT_BYTES) return json({ error: 'file_size_not_supported', maxBytes: MAX_DOCUMENT_BYTES }, 413);
  const buffer = await file.arrayBuffer(), validation = validateDocumentBytes(buffer, file.type);
  if (!validation.ok) return json({ error: validation.code, supportedTypes: [...DOCUMENT_MIMES] }, validation.code === 'heic_not_supported' ? 415 : 422);
  const hash = await sha(buffer);
  const duplicate = await env.DB.prepare(`SELECT * FROM world_documents WHERE buyer_account_id=? AND file_hash=? AND archived_at IS NULL ORDER BY created_at DESC LIMIT 1`).bind(buyer.buyer_account_id, hash).first();
  if (duplicate) return json({ ok: true, deduplicated: true, document: documentJson(duplicate, true) });
  const timestamp = now(), internalId = uid('wdo_'), pid = publicId('DOC'), fileName = clean(file.name || 'document', 180);
  const objectKey = `${buyer.buyer_account_id}/documents/${internalId}`;
  const title = clean(form.get('title'), 180) || fileName.replace(/\.[^.]+$/, '');
  const documentType = clean(form.get('documentType'), 60) || 'other';
  await env.DB.prepare(`INSERT INTO world_documents(id,public_id,buyer_account_id,title,document_type,mime_type,object_key,original_file_name,file_hash,file_bytes,processing_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?, ?,?)`)
    .bind(internalId, pid, buyer.buyer_account_id, title, documentType, validation.mimeType, objectKey, fileName, hash, file.size, 'PROCESSING', timestamp, timestamp).run();
  try {
    await env.WORLD_FILES.put(objectKey, buffer, { httpMetadata: { contentType: validation.mimeType, contentDisposition: `inline; filename="${fileName.replace(/["\\]/g, '')}"` } });
  } catch {
    await env.DB.prepare(`UPDATE world_documents SET processing_status='FAILED',processing_error_code='storage_write_failed',updated_at=? WHERE id=?`).bind(now(), internalId).run();
    return json({ error: 'storage_write_failed', documentId: pid }, 503);
  }
  try {
    const extracted = await extractDocument(env, buffer, fileName, validation.mimeType);
    await env.DB.batch([
      env.DB.prepare(`UPDATE world_documents SET extracted_text=?,processing_status='READY',processing_error_code=NULL,updated_at=? WHERE id=? AND buyer_account_id=?`).bind(extracted, now(), internalId, buyer.buyer_account_id),
      historyStatement(env, buyer.buyer_account_id, 'document', pid, 'document.added', 'Document added to Knowledge', { documentType, mimeType: validation.mimeType }, 'document', pid)
    ]);
  } catch (error) {
    const code = clean(error.code, 80) || 'document_processing_failed';
    await env.DB.batch([
      env.DB.prepare(`UPDATE world_documents SET processing_status='FAILED',processing_error_code=?,updated_at=? WHERE id=? AND buyer_account_id=?`).bind(code, now(), internalId, buyer.buyer_account_id),
      historyStatement(env, buyer.buyer_account_id, 'document', pid, 'document.processing_failed', 'Document processing failed', { code }, 'document', pid)
    ]);
    return json({ error: code, document: documentJson(await documentForOwner(env, buyer.buyer_account_id, pid), true) }, 422);
  }
  const row = await documentForOwner(env, buyer.buyer_account_id, pid);
  return json({ ok: true, deduplicated: false, document: documentJson(row, true) }, 201);
}

async function documentDetail(env, buyer, id) {
  const row = await documentForOwner(env, buyer.buyer_account_id, id);
  if (!row) return json({ error: 'not_found' }, 404);
  const links = await env.DB.prepare(`SELECT * FROM world_relationships WHERE buyer_account_id=? AND ((from_type='document' AND from_public_id=?) OR (to_type='document' AND to_public_id=?)) ORDER BY created_at DESC`).bind(buyer.buyer_account_id, id, id).all();
  return json({ document: documentJson(row, true), relationships: links.results || [] });
}

async function documentOriginal(env, buyer, id, request) {
  if (!env.WORLD_FILES) return json({ error: 'private_storage_not_configured' }, 503);
  const row = await documentForOwner(env, buyer.buyer_account_id, id);
  if (!row) return json({ error: 'not_found' }, 404);
  const object = await env.WORLD_FILES.get(row.object_key);
  if (!object) return json({ error: 'original_not_found' }, 404);
  return new Response(request.method === 'HEAD' ? null : object.body, { headers: { 'content-type': row.mime_type, 'content-disposition': `inline; filename="${row.original_file_name.replace(/["\\]/g, '')}"`, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}

async function retryDocument(env, buyer, id) {
  if (!env.WORLD_FILES) return json({ error: 'private_storage_not_configured' }, 503);
  if (!await rateLimit(env, buyer, 'ocr')) return json({ error: 'document_processing_rate_limited' }, 429, { 'retry-after': '60' });
  const row = await documentForOwner(env, buyer.buyer_account_id, id);
  if (!row) return json({ error: 'not_found' }, 404);
  if (row.processing_status !== 'FAILED') return json({ error: 'document_not_retryable' }, 409);
  const object = await env.WORLD_FILES.get(row.object_key);
  if (!object) return json({ error: 'original_not_found' }, 404);
  try {
    const extracted = await extractDocument(env, await object.arrayBuffer(), row.original_file_name, row.mime_type);
    await env.DB.prepare(`UPDATE world_documents SET extracted_text=?,processing_status='READY',processing_error_code=NULL,updated_at=? WHERE id=? AND buyer_account_id=?`).bind(extracted, now(), row.id, buyer.buyer_account_id).run();
    return documentDetail(env, buyer, id);
  } catch (error) {
    const code = clean(error.code, 80) || 'document_processing_failed';
    await env.DB.prepare(`UPDATE world_documents SET processing_error_code=?,updated_at=? WHERE id=? AND buyer_account_id=?`).bind(code, now(), row.id, buyer.buyer_account_id).run();
    return json({ error: code }, 422);
  }
}

async function archiveDocument(request, env, buyer, id) {
  const row = await documentForOwner(env, buyer.buyer_account_id, id);
  if (!row) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  if (clean(body.confirmDocumentId, 40) !== id) return json({ error: 'deletion_confirmation_required', confirmDocumentId: id, originalWillBeDeleted: true }, 409);
  if (env.WORLD_FILES) await env.WORLD_FILES.delete(row.object_key).catch(() => {});
  const timestamp = now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE world_documents SET archived_at=?,extracted_text=NULL,object_key=?,file_bytes=0,updated_at=? WHERE id=? AND buyer_account_id=?`).bind(timestamp, `deleted:${row.id}`, timestamp, row.id, buyer.buyer_account_id),
    env.DB.prepare(`DELETE FROM world_relationships WHERE buyer_account_id=? AND ((from_type='document' AND from_public_id=?) OR (to_type='document' AND to_public_id=?))`).bind(buyer.buyer_account_id, id, id),
    historyStatement(env, buyer.buyer_account_id, 'document', id, 'document.deleted', 'Document deleted', {}, 'user', buyer.buyer_account_id)
  ]);
  return json({ ok: true, deleted: true });
}

function knowledgeJson(row) {
  return { publicId: row.public_id, title: row.title, kind: row.kind, body: row.body, sourceType: row.source_type || 'USER_TEXT', sourceUrl: row.source_url || null, tags: safeJson(row.tags_json, []), sourceDocumentId: row.source_document_public_id || null, thingId: row.thing_public_id || null, situationId: row.situation_public_id || null, status: row.status, createdAt: row.created_at, updatedAt: row.updated_at };
}

async function knowledgeRows(env, buyerId, query = '') {
  const term = query ? `%${safeSearchTerm(query)}%` : null;
  const result = term
    ? await env.DB.prepare(`SELECT k.*,d.public_id source_document_public_id,p.public_id thing_public_id,s.public_id situation_public_id FROM world_knowledge_items k LEFT JOIN world_documents d ON d.id=k.source_document_id LEFT JOIN ownership_passports p ON p.id=k.thing_passport_id LEFT JOIN world_situations s ON s.id=k.situation_id WHERE k.buyer_account_id=? AND k.status='ACTIVE' AND (k.title LIKE ? ESCAPE '\\' OR k.body LIKE ? ESCAPE '\\' OR COALESCE(k.source_url,'') LIKE ? ESCAPE '\\' OR COALESCE(k.tags_json,'') LIKE ? ESCAPE '\\') ORDER BY k.updated_at DESC LIMIT 300`).bind(buyerId, term, term, term, term).all()
    : await env.DB.prepare(`SELECT k.*,d.public_id source_document_public_id,p.public_id thing_public_id,s.public_id situation_public_id FROM world_knowledge_items k LEFT JOIN world_documents d ON d.id=k.source_document_id LEFT JOIN ownership_passports p ON p.id=k.thing_passport_id LEFT JOIN world_situations s ON s.id=k.situation_id WHERE k.buyer_account_id=? AND k.status='ACTIVE' ORDER BY k.updated_at DESC LIMIT 300`).bind(buyerId).all();
  return result.results || [];
}

async function resolveOptionalLinks(env, buyerId, body) {
  let thing = null, situation = null, document = null, receipt = null;
  if (clean(body.thingId, 40)) {
    thing = await thingForOwner(env, buyerId, clean(body.thingId, 40));
    if (!thing) return { error: 'thing_not_found' };
  }
  if (clean(body.situationId, 40)) {
    situation = await env.DB.prepare(`SELECT * FROM world_situations WHERE buyer_account_id=? AND public_id=? AND archived_at IS NULL`).bind(buyerId, clean(body.situationId, 40)).first();
    if (!situation) return { error: 'situation_not_found' };
  }
  if (clean(body.sourceDocumentId, 40)) {
    document = await documentForOwner(env, buyerId, clean(body.sourceDocumentId, 40));
    if (!document) return { error: 'document_not_found' };
  }
  if (clean(body.receiptId, 40)) {
    receipt = await receiptForOwner(env, buyerId, clean(body.receiptId, 40));
    if (!receipt) return { error: 'receipt_not_found' };
  }
  return { thing, situation, document, receipt };
}

async function listKnowledge(env, buyer, query) {
  return json({ knowledge: (await knowledgeRows(env, buyer.buyer_account_id, query)).map(knowledgeJson), searchMethod: 'deterministic_authorized_text' });
}

async function createKnowledge(request, env, buyer) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const links = await resolveOptionalLinks(env, buyer.buyer_account_id, body);
  if (links.error) return json({ error: links.error }, 404);
  const title = clean(body.title, 180), kind = clean(body.kind, 40) || 'note';
  const bodyText = clean(body.body || links.document?.extracted_text, 50000);
  const sourceUrl = privateSourceUrl(body.sourceUrl), tags = knowledgeTags(body.tags);
  if (clean(body.sourceUrl, 1000) && !sourceUrl) return json({ error: 'invalid_source_url' }, 422);
  const sourceType = links.document ? 'UPLOADED_DOCUMENT' : sourceUrl ? 'SAVED_URL' : clean(body.sourceType, 40).toUpperCase() === 'PASTED_CONTENT' ? 'PASTED_CONTENT' : 'USER_TEXT';
  if (title.length < 2 || bodyText.length < 1) return json({ error: 'invalid_knowledge', fields: { title: 'Required', body: 'Enter text or choose a processed document.' } }, 422);
  const timestamp = now(), internalId = uid('wkn_'), pid = publicId('KNW'), statements = [
    env.DB.prepare(`INSERT INTO world_knowledge_items(id,public_id,buyer_account_id,title,kind,body,source_type,source_url,tags_json,source_document_id,thing_passport_id,situation_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?)`)
      .bind(internalId, pid, buyer.buyer_account_id, title, kind, bodyText, sourceType, sourceUrl, JSON.stringify(tags), links.document?.id || null, links.thing?.id || null, links.situation?.id || null, timestamp, timestamp),
    historyStatement(env, buyer.buyer_account_id, 'knowledge', pid, 'knowledge.created', 'Knowledge saved', { kind, sourceType }, 'user', buyer.buyer_account_id)
  ];
  if (links.thing) statements.push(relationshipStatement(env, buyer.buyer_account_id, 'knowledge', pid, 'thing', links.thing.public_id, 'about'));
  if (links.situation) statements.push(relationshipStatement(env, buyer.buyer_account_id, 'knowledge', pid, 'situation', links.situation.public_id, 'supports'));
  if (links.document) statements.push(relationshipStatement(env, buyer.buyer_account_id, 'knowledge', pid, 'document', links.document.public_id, 'derived_from'));
  await env.DB.batch(statements);
  log('knowledge_creation', { buyerId: buyer.buyer_account_id, knowledgeId: pid, linkedThing: Boolean(links.thing), linkedSituation: Boolean(links.situation) });
  const row = (await knowledgeRows(env, buyer.buyer_account_id)).find(item => item.public_id === pid);
  return json({ ok: true, knowledge: knowledgeJson(row) }, 201);
}

async function updateKnowledge(request, env, buyer, id) {
  const current = await env.DB.prepare(`SELECT * FROM world_knowledge_items WHERE buyer_account_id=? AND public_id=? AND status='ACTIVE'`).bind(buyer.buyer_account_id, id).first();
  if (!current) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const [currentThing, currentSituation, currentDocument] = await Promise.all([
    current.thing_passport_id ? env.DB.prepare(`SELECT public_id FROM ownership_passports WHERE id=? AND buyer_account_id=?`).bind(current.thing_passport_id, buyer.buyer_account_id).first() : null,
    current.situation_id ? env.DB.prepare(`SELECT public_id FROM world_situations WHERE id=? AND buyer_account_id=?`).bind(current.situation_id, buyer.buyer_account_id).first() : null,
    current.source_document_id ? env.DB.prepare(`SELECT public_id FROM world_documents WHERE id=? AND buyer_account_id=?`).bind(current.source_document_id, buyer.buyer_account_id).first() : null
  ]);
  const links = await resolveOptionalLinks(env, buyer.buyer_account_id, {
    thingId: has(body, 'thingId') ? body.thingId : currentThing?.public_id || '',
    situationId: has(body, 'situationId') ? body.situationId : currentSituation?.public_id || '',
    sourceDocumentId: has(body, 'sourceDocumentId') ? body.sourceDocumentId : currentDocument?.public_id || ''
  });
  if (links.error) return json({ error: links.error }, 404);
  const title = clean(has(body, 'title') ? body.title : current.title, 180), text = clean(has(body, 'body') ? body.body : current.body, 50000), kind = clean(has(body, 'kind') ? body.kind : current.kind, 40) || 'note';
  const sourceUrl = has(body, 'sourceUrl') ? privateSourceUrl(body.sourceUrl) : current.source_url;
  if (has(body, 'sourceUrl') && clean(body.sourceUrl, 1000) && !sourceUrl) return json({ error: 'invalid_source_url' }, 422);
  const tags = has(body, 'tags') ? knowledgeTags(body.tags) : safeJson(current.tags_json, []);
  const sourceType = links.document ? 'UPLOADED_DOCUMENT' : sourceUrl ? 'SAVED_URL' : current.source_type || 'USER_TEXT';
  if (title.length < 2 || !text) return json({ error: 'invalid_knowledge' }, 422);
  const thingId = links.thing?.id || null;
  const situationId = links.situation?.id || null;
  const documentId = links.document?.id || null;
  const timestamp = now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE world_knowledge_items SET title=?,kind=?,body=?,source_type=?,source_url=?,tags_json=?,source_document_id=?,thing_passport_id=?,situation_id=?,updated_at=? WHERE id=? AND buyer_account_id=?`).bind(title, kind, text, sourceType, sourceUrl, JSON.stringify(tags), documentId, thingId, situationId, timestamp, current.id, buyer.buyer_account_id),
    env.DB.prepare(`DELETE FROM world_relationships WHERE buyer_account_id=? AND from_type='knowledge' AND from_public_id=?`).bind(buyer.buyer_account_id, id),
    ...(links.thing ? [relationshipStatement(env, buyer.buyer_account_id, 'knowledge', id, 'thing', links.thing.public_id, 'about')] : []),
    ...(links.situation ? [relationshipStatement(env, buyer.buyer_account_id, 'knowledge', id, 'situation', links.situation.public_id, 'supports')] : []),
    ...(links.document ? [relationshipStatement(env, buyer.buyer_account_id, 'knowledge', id, 'document', links.document.public_id, 'derived_from')] : []),
    historyStatement(env, buyer.buyer_account_id, 'knowledge', id, 'knowledge.updated', 'Knowledge updated', {}, 'user', buyer.buyer_account_id)
  ]);
  const row = (await knowledgeRows(env, buyer.buyer_account_id)).find(item => item.public_id === id);
  return json({ ok: true, knowledge: knowledgeJson(row) });
}

async function deleteKnowledge(request, env, buyer, id) {
  const current = await env.DB.prepare(`SELECT * FROM world_knowledge_items WHERE buyer_account_id=? AND public_id=? AND status='ACTIVE'`).bind(buyer.buyer_account_id, id).first();
  if (!current) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  if (clean(body.confirmKnowledgeId, 40) !== id) return json({ error: 'deletion_confirmation_required', confirmKnowledgeId: id }, 409);
  await env.DB.batch([
    env.DB.prepare(`UPDATE world_knowledge_items SET status='DELETED',updated_at=? WHERE id=? AND buyer_account_id=?`).bind(now(), current.id, buyer.buyer_account_id),
    env.DB.prepare(`DELETE FROM world_relationships WHERE buyer_account_id=? AND ((from_type='knowledge' AND from_public_id=?) OR (to_type='knowledge' AND to_public_id=?))`).bind(buyer.buyer_account_id, id, id),
    historyStatement(env, buyer.buyer_account_id, 'knowledge', id, 'knowledge.deleted', 'Knowledge deleted', {}, 'user', buyer.buyer_account_id)
  ]);
  return json({ ok: true, deleted: true, relationshipsRemoved: true });
}

function situationJson(row) {
  return { publicId: row.public_id, title: row.title, description: row.description || null, status: row.status, priority: row.priority, startDate: row.start_date || null, dueAt: row.due_at || null, resolvedAt: row.resolved_at || null, createdAt: row.created_at, updatedAt: row.updated_at };
}

function loopJson(row) {
  return { publicId: row.public_id, situationId: row.situation_public_id || null, thingId: row.thing_public_id || null, title: row.title, type: row.loop_type, status: row.status, waitingOn: row.waiting_on || null, dueAt: row.due_at || null, notes: row.notes || null, completedAt: row.completed_at || null, createdAt: row.created_at, updatedAt: row.updated_at };
}

async function situationForOwner(env, buyerId, id, includeArchived = false) {
  return env.DB.prepare(`SELECT * FROM world_situations WHERE buyer_account_id=? AND public_id=? ${includeArchived ? '' : 'AND archived_at IS NULL'}`).bind(buyerId, id).first();
}

async function loopForOwner(env, buyerId, id) {
  return env.DB.prepare(`SELECT l.*,s.public_id situation_public_id,p.public_id thing_public_id FROM world_open_loops l LEFT JOIN world_situations s ON s.id=l.situation_id LEFT JOIN ownership_passports p ON p.id=l.thing_passport_id WHERE l.buyer_account_id=? AND l.public_id=?`).bind(buyerId, id).first();
}

async function listSituations(env, buyer) {
  const rows = await env.DB.prepare(`SELECT * FROM world_situations WHERE buyer_account_id=? AND archived_at IS NULL ORDER BY CASE status WHEN 'ACTIVE' THEN 0 WHEN 'WAITING' THEN 1 WHEN 'RESOLVED' THEN 2 ELSE 3 END,due_at IS NULL,due_at,updated_at DESC LIMIT 300`).bind(buyer.buyer_account_id).all();
  return json({ situations: (rows.results || []).map(situationJson) });
}

async function situationDetail(env, buyer, id) {
  const row = await situationForOwner(env, buyer.buyer_account_id, id);
  if (!row) return json({ error: 'not_found' }, 404);
  const [loops, relationships, knowledge, history] = await Promise.all([
    env.DB.prepare(`SELECT l.*,s.public_id situation_public_id,p.public_id thing_public_id FROM world_open_loops l LEFT JOIN world_situations s ON s.id=l.situation_id LEFT JOIN ownership_passports p ON p.id=l.thing_passport_id WHERE l.buyer_account_id=? AND l.situation_id=? ORDER BY l.completed_at IS NOT NULL,l.due_at IS NULL,l.due_at,l.updated_at DESC`).bind(buyer.buyer_account_id, row.id).all(),
    env.DB.prepare(`SELECT * FROM world_relationships WHERE buyer_account_id=? AND ((from_type='situation' AND from_public_id=?) OR (to_type='situation' AND to_public_id=?)) ORDER BY created_at DESC`).bind(buyer.buyer_account_id, id, id).all(),
    env.DB.prepare(`SELECT k.*,d.public_id source_document_public_id,p.public_id thing_public_id,s.public_id situation_public_id FROM world_knowledge_items k LEFT JOIN world_documents d ON d.id=k.source_document_id LEFT JOIN ownership_passports p ON p.id=k.thing_passport_id LEFT JOIN world_situations s ON s.id=k.situation_id WHERE k.buyer_account_id=? AND k.situation_id=? AND k.status='ACTIVE' ORDER BY k.updated_at DESC`).bind(buyer.buyer_account_id, row.id).all(),
    env.DB.prepare(`SELECT public_id,event_type,title,details_json,source_type,source_public_id,occurred_at FROM world_history_events WHERE buyer_account_id=? AND entity_type='situation' AND entity_public_id=? ORDER BY occurred_at DESC LIMIT 300`).bind(buyer.buyer_account_id, id).all()
  ]);
  return json({ situation: situationJson(row), loops: (loops.results || []).map(loopJson), relationships: relationships.results || [], knowledge: (knowledge.results || []).map(knowledgeJson), history: (history.results || []).map(item => ({ ...item, details: safeJson(item.details_json), details_json: undefined })) });
}

async function createSituation(request, env, buyer) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const title = clean(body.title, 180), description = clean(body.description, 5000) || null;
  const priority = ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(clean(body.priority, 20).toUpperCase()) ? clean(body.priority, 20).toUpperCase() : 'NORMAL';
  if (title.length < 2) return json({ error: 'title_required' }, 422);
  const links = await resolveOptionalLinks(env, buyer.buyer_account_id, { thingId: body.thingId, sourceDocumentId: body.documentId, receiptId: body.receiptId });
  if (links.error) return json({ error: links.error }, 404);
  const timestamp = now(), internalId = uid('wsi_'), pid = publicId('SIT'), statements = [
    env.DB.prepare(`INSERT INTO world_situations(id,public_id,buyer_account_id,title,description,status,priority,start_date,due_at,created_at,updated_at) VALUES(?,?,?,?,?,'ACTIVE',?,?,?,?,?)`).bind(internalId, pid, buyer.buyer_account_id, title, description, priority, safeDate(body.startDate), safeDate(body.dueAt), timestamp, timestamp),
    historyStatement(env, buyer.buyer_account_id, 'situation', pid, 'situation.created', 'Situation created', { priority }, 'user', buyer.buyer_account_id)
  ];
  if (links.thing) statements.push(relationshipStatement(env, buyer.buyer_account_id, 'situation', pid, 'thing', links.thing.public_id, 'concerns'));
  if (links.document) statements.push(relationshipStatement(env, buyer.buyer_account_id, 'situation', pid, 'document', links.document.public_id, 'uses'));
  if (links.receipt) statements.push(relationshipStatement(env, buyer.buyer_account_id, 'situation', pid, 'receipt', links.receipt.public_id, 'uses'));
  await env.DB.batch(statements);
  log('situation_creation', { buyerId: buyer.buyer_account_id, situationId: pid });
  return json({ ok: true, situation: situationJson(await situationForOwner(env, buyer.buyer_account_id, pid)) }, 201);
}

async function updateSituation(request, env, buyer, id) {
  const current = await situationForOwner(env, buyer.buyer_account_id, id);
  if (!current) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const title = clean(has(body, 'title') ? body.title : current.title, 180), description = clean(has(body, 'description') ? body.description : current.description, 5000) || null;
  const statusCandidate = clean(has(body, 'status') ? body.status : current.status, 20).toUpperCase(), status = SITUATION_STATUSES.has(statusCandidate) ? statusCandidate : current.status;
  const priorityCandidate = clean(has(body, 'priority') ? body.priority : current.priority, 20).toUpperCase(), priority = ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(priorityCandidate) ? priorityCandidate : current.priority;
  if (title.length < 2) return json({ error: 'title_required' }, 422);
  const timestamp = now(), resolvedAt = status === 'RESOLVED' ? current.resolved_at || timestamp : null, archivedAt = current.archived_at || null;
  const statements = [env.DB.prepare(`UPDATE world_situations SET title=?,description=?,status=?,priority=?,start_date=?,due_at=?,resolved_at=?,archived_at=?,updated_at=? WHERE id=? AND buyer_account_id=?`).bind(title, description, status, priority, safeDate(has(body, 'startDate') ? body.startDate : current.start_date), safeDate(has(body, 'dueAt') ? body.dueAt : current.due_at), resolvedAt, archivedAt, timestamp, current.id, buyer.buyer_account_id)];
  if (status === 'RESOLVED' && current.status !== 'RESOLVED') {
    statements.push(historyStatement(env, buyer.buyer_account_id, 'situation', id, 'situation.resolved', 'Situation resolved', {}, 'user', buyer.buyer_account_id));
    log('situation_resolution', { buyerId: buyer.buyer_account_id, situationId: id });
  } else statements.push(historyStatement(env, buyer.buyer_account_id, 'situation', id, 'situation.updated', 'Situation updated', { status }, 'user', buyer.buyer_account_id));
  await env.DB.batch(statements);
  return situationDetail(env, buyer, id);
}

async function archiveSituation(request, env, buyer, id) {
  const current = await situationForOwner(env, buyer.buyer_account_id, id);
  if (!current) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  if (clean(body.confirmSituationId, 40) !== id) return json({ error: 'deletion_confirmation_required', confirmSituationId: id, action: 'archive' }, 409);
  const timestamp = now();
  await env.DB.batch([
    env.DB.prepare(`UPDATE world_situations SET status='ARCHIVED',archived_at=?,updated_at=? WHERE id=? AND buyer_account_id=?`).bind(timestamp, timestamp, current.id, buyer.buyer_account_id),
    env.DB.prepare(`UPDATE world_open_loops SET status='CANCELLED',updated_at=? WHERE buyer_account_id=? AND situation_id=? AND status NOT IN ('COMPLETED','CANCELLED')`).bind(timestamp, buyer.buyer_account_id, current.id),
    historyStatement(env, buyer.buyer_account_id, 'situation', id, 'situation.archived', 'Situation archived', {}, 'user', buyer.buyer_account_id)
  ]);
  return json({ ok: true, archived: true, openLoopsCancelled: true });
}

async function listLoops(env, buyer, url) {
  const activeOnly = url.searchParams.get('active') !== 'false';
  const rows = await env.DB.prepare(`SELECT l.*,s.public_id situation_public_id,p.public_id thing_public_id FROM world_open_loops l LEFT JOIN world_situations s ON s.id=l.situation_id LEFT JOIN ownership_passports p ON p.id=l.thing_passport_id WHERE l.buyer_account_id=? ${activeOnly ? "AND l.status NOT IN ('COMPLETED','CANCELLED')" : ''} ORDER BY CASE WHEN l.due_at<date('now') THEN 0 WHEN l.status='WAITING' THEN 1 ELSE 2 END,l.due_at IS NULL,l.due_at,l.updated_at DESC LIMIT 500`).bind(buyer.buyer_account_id).all();
  return json({ openLoops: (rows.results || []).map(loopJson) });
}

async function createLoop(request, env, buyer) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const title = clean(body.title, 180), typeCandidate = clean(body.type, 40).toUpperCase(), type = LOOP_TYPES.has(typeCandidate) ? typeCandidate : 'ACTION';
  const statusCandidate = clean(body.status, 30).toUpperCase(), status = LOOP_STATUSES.has(statusCandidate) ? statusCandidate : 'OPEN';
  const waitingOn = clean(body.waitingOn, 300) || null, notes = clean(body.notes, 3000) || null;
  if (title.length < 2) return json({ error: 'title_required' }, 422);
  if (status === 'WAITING' && !waitingOn) return json({ error: 'waiting_on_required' }, 422);
  let situation = null, thing = null;
  if (clean(body.situationId, 40)) {
    situation = await situationForOwner(env, buyer.buyer_account_id, clean(body.situationId, 40));
    if (!situation) return json({ error: 'situation_not_found' }, 404);
  }
  if (clean(body.thingId, 40)) {
    thing = await thingForOwner(env, buyer.buyer_account_id, clean(body.thingId, 40));
    if (!thing) return json({ error: 'thing_not_found' }, 404);
  }
  const timestamp = now(), internalId = uid('wlp_'), pid = publicId('LOP'), completedAt = status === 'COMPLETED' ? timestamp : null;
  const statements = [
    env.DB.prepare(`INSERT INTO world_open_loops(id,public_id,buyer_account_id,situation_id,thing_passport_id,title,loop_type,status,waiting_on,due_at,notes,completed_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(internalId, pid, buyer.buyer_account_id, situation?.id || null, thing?.id || null, title, type, status, waitingOn, safeDate(body.dueAt), notes, completedAt, timestamp, timestamp),
    historyStatement(env, buyer.buyer_account_id, 'open_loop', pid, 'open_loop.created', 'Open Loop created', { type, status }, 'user', buyer.buyer_account_id)
  ];
  if (situation) statements.push(relationshipStatement(env, buyer.buyer_account_id, 'open_loop', pid, 'situation', situation.public_id, 'belongs_to'));
  if (thing) statements.push(relationshipStatement(env, buyer.buyer_account_id, 'open_loop', pid, 'thing', thing.public_id, 'concerns'));
  await env.DB.batch(statements);
  log('open_loop_creation', { buyerId: buyer.buyer_account_id, openLoopId: pid, status });
  return json({ ok: true, openLoop: loopJson(await loopForOwner(env, buyer.buyer_account_id, pid)) }, 201);
}

async function updateLoop(request, env, buyer, id) {
  const current = await loopForOwner(env, buyer.buyer_account_id, id);
  if (!current) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const statusCandidate = clean(has(body, 'status') ? body.status : current.status, 30).toUpperCase(), status = LOOP_STATUSES.has(statusCandidate) ? statusCandidate : current.status;
  if (!validLoopTransition(current.status, status)) return json({ error: 'invalid_status_transition', from: current.status, to: status }, 409);
  const title = clean(has(body, 'title') ? body.title : current.title, 180), waitingOn = clean(has(body, 'waitingOn') ? body.waitingOn : current.waiting_on, 300) || null, notes = clean(has(body, 'notes') ? body.notes : current.notes, 3000) || null;
  const typeCandidate = clean(has(body, 'type') ? body.type : current.loop_type, 40).toUpperCase(), type = LOOP_TYPES.has(typeCandidate) ? typeCandidate : current.loop_type;
  if (title.length < 2 || (status === 'WAITING' && !waitingOn)) return json({ error: status === 'WAITING' ? 'waiting_on_required' : 'title_required' }, 422);
  const timestamp = now(), completedAt = status === 'COMPLETED' ? current.completed_at || timestamp : status === 'CANCELLED' ? current.completed_at : null;
  const statements = [env.DB.prepare(`UPDATE world_open_loops SET title=?,loop_type=?,status=?,waiting_on=?,due_at=?,notes=?,completed_at=?,updated_at=? WHERE id=? AND buyer_account_id=?`).bind(title, type, status, waitingOn, safeDate(has(body, 'dueAt') ? body.dueAt : current.due_at), notes, completedAt, timestamp, current.id, buyer.buyer_account_id)];
  if (status === 'COMPLETED' && current.status !== 'COMPLETED') {
    statements.push(historyStatement(env, buyer.buyer_account_id, 'open_loop', id, 'open_loop.completed', 'Open Loop completed', { situationId: current.situation_public_id || null }, 'user', buyer.buyer_account_id));
    if (current.situation_public_id) statements.push(historyStatement(env, buyer.buyer_account_id, 'situation', current.situation_public_id, 'situation.open_loop_completed', 'Open Loop completed', { openLoopId: id }, 'open_loop', id));
    log('open_loop_completion', { buyerId: buyer.buyer_account_id, openLoopId: id });
  } else statements.push(historyStatement(env, buyer.buyer_account_id, 'open_loop', id, 'open_loop.updated', 'Open Loop updated', { status }, 'user', buyer.buyer_account_id));
  await env.DB.batch(statements);
  return json({ ok: true, openLoop: loopJson(await loopForOwner(env, buyer.buyer_account_id, id)) });
}

async function entityForOwner(env, buyerId, type, id) {
  if (type === 'thing') return thingForOwner(env, buyerId, id);
  if (type === 'receipt') return receiptForOwner(env, buyerId, id);
  if (type === 'document') return documentForOwner(env, buyerId, id);
  if (type === 'situation') return situationForOwner(env, buyerId, id);
  if (type === 'open_loop') return loopForOwner(env, buyerId, id);
  if (type === 'knowledge') return env.DB.prepare(`SELECT * FROM world_knowledge_items WHERE buyer_account_id=? AND public_id=? AND status='ACTIVE'`).bind(buyerId, id).first();
  return null;
}

async function createRelationship(request, env, buyer) {
  const body = await request.json().catch(() => null);
  if (!body) return json({ error: 'invalid_json' }, 400);
  const fromType = clean(body.fromType, 30), fromId = clean(body.fromId, 40), toType = clean(body.toType, 30), toId = clean(body.toId, 40), relationship = clean(body.relationship, 60);
  const allowed = new Set(['thing', 'receipt', 'document', 'knowledge', 'situation', 'open_loop']);
  if (!allowed.has(fromType) || !allowed.has(toType) || !fromId || !toId || relationship.length < 2) return json({ error: 'invalid_relationship' }, 422);
  const [from, to] = await Promise.all([entityForOwner(env, buyer.buyer_account_id, fromType, fromId), entityForOwner(env, buyer.buyer_account_id, toType, toId)]);
  if (!from || !to) return json({ error: 'related_object_not_found' }, 404);
  await env.DB.batch([
    relationshipStatement(env, buyer.buyer_account_id, fromType, fromId, toType, toId, relationship),
    historyStatement(env, buyer.buyer_account_id, fromType, fromId, 'relationship.created', 'World relationship created', { toType, toId, relationship }, 'user', buyer.buyer_account_id)
  ]);
  const created = await env.DB.prepare(`SELECT public_id FROM world_relationships WHERE buyer_account_id=? AND from_type=? AND from_public_id=? AND to_type=? AND to_public_id=? AND relationship=?`).bind(buyer.buyer_account_id, fromType, fromId, toType, toId, relationship).first();
  return json({ ok: true, relationship: { publicId: created?.public_id || null, fromType, fromId, toType, toId, relationship } }, 201);
}

async function deleteRelationship(request, env, buyer, id) {
  const row = await env.DB.prepare(`SELECT * FROM world_relationships WHERE buyer_account_id=? AND public_id=?`).bind(buyer.buyer_account_id, id).first();
  if (!row) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  if (clean(body.confirmRelationshipId, 40) !== id) return json({ error: 'deletion_confirmation_required', confirmRelationshipId: id }, 409);
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM world_relationships WHERE buyer_account_id=? AND public_id=?`).bind(buyer.buyer_account_id, id),
    historyStatement(env, buyer.buyer_account_id, row.from_type, row.from_public_id, 'relationship.removed', 'World relationship removed', { toType: row.to_type, toId: row.to_public_id, relationship: row.relationship }, 'user', buyer.buyer_account_id)
  ]);
  return json({ ok: true, deleted: true });
}

async function historyList(env, buyer, url) {
  const entityType = clean(url.searchParams.get('entityType'), 30), entityId = clean(url.searchParams.get('entityId'), 40);
  let result;
  if (entityType && entityId) result = await env.DB.prepare(`SELECT * FROM world_history_events WHERE buyer_account_id=? AND entity_type=? AND entity_public_id=? ORDER BY occurred_at DESC LIMIT 500`).bind(buyer.buyer_account_id, entityType, entityId).all();
  else result = await env.DB.prepare(`SELECT * FROM world_history_events WHERE buyer_account_id=? ORDER BY occurred_at DESC LIMIT 500`).bind(buyer.buyer_account_id).all();
  return json({ history: (result.results || []).map(item => ({ publicId: item.public_id, entityType: item.entity_type, entityId: item.entity_public_id, eventType: item.event_type, title: item.title, details: safeJson(item.details_json), sourceType: item.source_type || null, sourceId: item.source_public_id || null, occurredAt: item.occurred_at })) });
}

async function nowView(env, buyer) {
  const [situations, loops, things, recent] = await Promise.all([
    env.DB.prepare(`SELECT * FROM world_situations WHERE buyer_account_id=? AND archived_at IS NULL AND status IN ('ACTIVE','WAITING') ORDER BY updated_at DESC LIMIT 200`).bind(buyer.buyer_account_id).all(),
    env.DB.prepare(`SELECT l.*,s.public_id situation_public_id,p.public_id thing_public_id FROM world_open_loops l LEFT JOIN world_situations s ON s.id=l.situation_id LEFT JOIN ownership_passports p ON p.id=l.thing_passport_id WHERE l.buyer_account_id=? AND l.status NOT IN ('COMPLETED','CANCELLED') ORDER BY l.updated_at DESC LIMIT 300`).bind(buyer.buyer_account_id).all(),
    thingRows(env, buyer.buyer_account_id),
    env.DB.prepare(`SELECT public_id,entity_type,entity_public_id,event_type,title,occurred_at FROM world_history_events WHERE buyer_account_id=? ORDER BY occurred_at DESC LIMIT 30`).bind(buyer.buyer_account_id).all()
  ]);
  const attention = [
    ...(situations.results || []).map(item => ({ publicId: item.public_id, kind: 'situation', title: item.title, status: item.status, dueAt: item.due_at, priorityLabel: item.priority, updatedAt: item.updated_at })),
    ...(loops.results || []).map(item => ({ publicId: item.public_id, kind: 'open_loop', title: item.title, status: item.status, dueAt: item.due_at, waitingOn: item.waiting_on, situationId: item.situation_public_id || null, thingId: item.thing_public_id || null, updatedAt: item.updated_at })),
    ...things.flatMap(item => [
      item.return_by ? { publicId: `${item.public_id}:return`, entityId: item.public_id, kind: 'thing_deadline', title: `Return deadline · ${item.title}`, status: 'OPEN', dueAt: item.return_by, updatedAt: item.updated_at } : null,
      item.warranty_until ? { publicId: `${item.public_id}:warranty`, entityId: item.public_id, kind: 'thing_deadline', title: `Warranty · ${item.title}`, status: 'OPEN', dueAt: item.warranty_until, updatedAt: item.updated_at } : null,
      item.renewal_at ? { publicId: `${item.public_id}:renewal`, entityId: item.public_id, kind: 'thing_deadline', title: `Renewal · ${item.title}`, status: 'OPEN', dueAt: item.renewal_at, updatedAt: item.updated_at } : null,
      item.next_action_at ? { publicId: `${item.public_id}:next`, entityId: item.public_id, kind: 'thing_deadline', title: `Next action · ${item.title}`, status: 'OPEN', dueAt: item.next_action_at, updatedAt: item.updated_at } : null
    ].filter(Boolean))
  ];
  const ranked = rankNow(attention, Date.now()).filter(item => !item.dueAt || new Date(item.dueAt).getTime() <= Date.now() + 90 * 86400000).slice(0, 100);
  return json({ generatedAt: now(), method: 'deterministic_priority', attention: ranked, recent: recent.results || [] });
}

async function worldSearch(env, buyer, query) {
  const q = clean(query, 120);
  if (q.length < 2) return json({ query: q, results: [], method: 'deterministic_authorized_text' });
  const term = `%${safeSearchTerm(q)}%`, owner = buyer.buyer_account_id;
  const [things, knowledge, situations, receipts, loops, documents] = await Promise.all([
    env.DB.prepare(`SELECT p.public_id,p.title,p.kind type,p.updated_at FROM ownership_passports p LEFT JOIN world_thing_profiles tp ON tp.passport_id=p.id WHERE p.buyer_account_id=? AND p.status<>'archived' AND (p.title LIKE ? ESCAPE '\\' OR COALESCE(p.business_name,'') LIKE ? ESCAPE '\\' OR COALESCE(tp.manufacturer,'') LIKE ? ESCAPE '\\' OR COALESCE(tp.model,'') LIKE ? ESCAPE '\\' OR COALESCE(tp.serial_number,'') LIKE ? ESCAPE '\\' OR COALESCE(tp.gtin,'') LIKE ? ESCAPE '\\') ORDER BY p.updated_at DESC LIMIT 80`).bind(owner, term, term, term, term, term, term).all(),
    env.DB.prepare(`SELECT public_id,title,kind type,updated_at FROM world_knowledge_items WHERE buyer_account_id=? AND status='ACTIVE' AND (title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\' OR COALESCE(source_url,'') LIKE ? ESCAPE '\\' OR COALESCE(tags_json,'') LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT 80`).bind(owner, term, term, term, term).all(),
    env.DB.prepare(`SELECT public_id,title,status type,updated_at FROM world_situations WHERE buyer_account_id=? AND archived_at IS NULL AND (title LIKE ? ESCAPE '\\' OR COALESCE(description,'') LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT 80`).bind(owner, term, term).all(),
    env.DB.prepare(`SELECT public_id,COALESCE(merchant,'Receipt') title,processing_status type,updated_at FROM world_receipts WHERE buyer_account_id=? AND archived_at IS NULL AND (COALESCE(merchant,'') LIKE ? ESCAPE '\\' OR COALESCE(reference,'') LIKE ? ESCAPE '\\' OR COALESCE(raw_ocr_text,'') LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT 80`).bind(owner, term, term, term).all(),
    env.DB.prepare(`SELECT public_id,title,status type,updated_at FROM world_open_loops WHERE buyer_account_id=? AND (title LIKE ? ESCAPE '\\' OR COALESCE(waiting_on,'') LIKE ? ESCAPE '\\' OR COALESCE(notes,'') LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT 80`).bind(owner, term, term, term).all(),
    env.DB.prepare(`SELECT public_id,title,document_type type,updated_at FROM world_documents WHERE buyer_account_id=? AND archived_at IS NULL AND (title LIKE ? ESCAPE '\\' OR COALESCE(extracted_text,'') LIKE ? ESCAPE '\\') ORDER BY updated_at DESC LIMIT 80`).bind(owner, term, term).all()
  ]);
  const label = (rows, resultType) => (rows.results || []).map(row => ({ resultType, publicId: row.public_id, title: row.title, subtype: row.type, updatedAt: row.updated_at }));
  const results = [...label(things, 'Thing'), ...label(knowledge, 'Knowledge'), ...label(situations, 'Situation'), ...label(receipts, 'Receipt'), ...label(loops, 'Open Loop'), ...label(documents, 'Document')]
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)) || a.resultType.localeCompare(b.resultType) || a.publicId.localeCompare(b.publicId)).slice(0, 150);
  return json({ query: q, results, method: 'deterministic_authorized_text' });
}

async function worldBootstrap(env, buyer) {
  const [things, knowledge, situations, loops, receipts, documents] = await Promise.all([
    thingRows(env, buyer.buyer_account_id),
    knowledgeRows(env, buyer.buyer_account_id),
    env.DB.prepare(`SELECT * FROM world_situations WHERE buyer_account_id=? AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 100`).bind(buyer.buyer_account_id).all(),
    env.DB.prepare(`SELECT l.*,s.public_id situation_public_id,p.public_id thing_public_id FROM world_open_loops l LEFT JOIN world_situations s ON s.id=l.situation_id LEFT JOIN ownership_passports p ON p.id=l.thing_passport_id WHERE l.buyer_account_id=? AND l.status NOT IN ('COMPLETED','CANCELLED') ORDER BY l.updated_at DESC LIMIT 100`).bind(buyer.buyer_account_id).all(),
    env.DB.prepare(`SELECT * FROM world_receipts WHERE buyer_account_id=? AND archived_at IS NULL ORDER BY created_at DESC LIMIT 50`).bind(buyer.buyer_account_id).all(),
    env.DB.prepare(`SELECT * FROM world_documents WHERE buyer_account_id=? AND archived_at IS NULL ORDER BY updated_at DESC LIMIT 50`).bind(buyer.buyer_account_id).all()
  ]);
  return json({
    world: { owner: { name: buyer.name || null }, persisted: true, source: 'authenticated_world' },
    things: things.map(row => thingJson(row)),
    knowledge: knowledge.map(knowledgeJson),
    situations: (situations.results || []).map(situationJson),
    openLoops: (loops.results || []).map(loopJson),
    receipts: (receipts.results || []).map(row => receiptJson(row)),
    documents: (documents.results || []).map(row => documentJson(row))
  });
}

async function migrateLegacy(request, env, buyer) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.records)) return json({ error: 'migration_records_required' }, 422);
  const source = clean(body.source, 80);
  if (!['still-ownership-passports-v83', 'still-saved-purchases-v1'].includes(source)) return json({ error: 'unsupported_migration_source' }, 422);
  const existingRows = await thingRows(env, buyer.buyer_account_id), existing = existingRows.map(row => thingJson(row));
  let imported = 0, skipped = 0;
  const results = [];
  for (const raw of body.records.slice(0, 300)) {
    const input = thingInput({
      kind: raw.kind || raw.type,
      title: raw.title || raw.item || raw.name,
      businessName: raw.businessName || raw.business || raw.store,
      reference: raw.reference || raw.id,
      purchasedOn: raw.purchasedOn || raw.purchaseDate,
      returnBy: raw.returnBy,
      warrantyUntil: raw.warrantyUntil,
      renewalAt: raw.renewalAt,
      nextActionAt: raw.nextActionAt,
      notes: raw.notes,
      category: raw.category,
      manufacturer: raw.manufacturer,
      model: raw.model,
      serialNumber: raw.serialNumber,
      gtin: raw.gtin,
      source: 'legacy_localstorage',
      reviewStatus: 'CONFIRMED'
    });
    const fingerprint = await sha(JSON.stringify({ source, legacyId: clean(raw.publicId || raw.id, 120), kind: input.kind, title: normalizeText(input.title), purchasedOn: input.purchasedOn, serial: normalizeText(input.serialNumber), gtin: input.gtin }));
    const migrated = await env.DB.prepare(`SELECT status FROM world_migrations WHERE buyer_account_id=? AND source=? AND fingerprint=?`).bind(buyer.buyer_account_id, source, fingerprint).first();
    if (migrated) { skipped++; results.push({ fingerprint, status: 'already_migrated' }); continue; }
    if (input.title.length < 2) {
      await env.DB.prepare(`INSERT INTO world_migrations(buyer_account_id,source,fingerprint,imported_count,skipped_count,status,created_at) VALUES(?,?,?,0,1,'SKIPPED_INVALID',?)`).bind(buyer.buyer_account_id, source, fingerprint, now()).run();
      skipped++; results.push({ fingerprint, status: 'skipped_invalid' }); continue;
    }
    const legacyPublicId = clean(raw.publicId, 40);
    const exactId = legacyPublicId && existing.find(item => item.publicId === legacyPublicId);
    const candidates = duplicateCandidates(existing, input);
    if (exactId || candidates.some(candidate => candidate.score >= 80)) {
      await env.DB.prepare(`INSERT INTO world_migrations(buyer_account_id,source,fingerprint,imported_count,skipped_count,status,created_at) VALUES(?,?,?,0,1,'MATCHED_EXISTING',?)`).bind(buyer.buyer_account_id, source, fingerprint, now()).run();
      skipped++; results.push({ fingerprint, status: 'matched_existing', thingPublicId: exactId?.publicId || candidates[0]?.publicId }); continue;
    }
    const timestamp = now(), passportId = uid('opp_'), pid = publicId('STP');
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO ownership_passports(id,public_id,buyer_account_id,created_by,kind,title,business_name,reference,purchased_on,return_by,warranty_until,renewal_at,next_action_at,notes,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(passportId, pid, buyer.buyer_account_id, 'buyer', input.kind, input.title, input.businessName, input.reference, input.purchasedOn, input.returnBy, input.warrantyUntil, input.renewalAt, input.nextActionAt, input.notes, 'connected', timestamp, timestamp),
      env.DB.prepare(`INSERT INTO world_thing_profiles(passport_id,buyer_account_id,thing_type,category,manufacturer,model,serial_number,gtin,purchase_price_cents,currency,lifecycle_state,source,review_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(passportId, buyer.buyer_account_id, input.kind, input.category, input.manufacturer, input.model, input.serialNumber, input.gtin, input.purchasePriceCents, input.currency, input.lifecycleState, 'legacy_localstorage', 'CONFIRMED', timestamp, timestamp),
      env.DB.prepare(`INSERT INTO world_migrations(buyer_account_id,source,fingerprint,imported_count,skipped_count,status,created_at) VALUES(?,?,?,1,0,'COMPLETED',?)`).bind(buyer.buyer_account_id, source, fingerprint, timestamp),
      historyStatement(env, buyer.buyer_account_id, 'thing', pid, 'thing.migrated', 'Thing migrated to authenticated World', { source }, 'migration', source),
      ...confirmedThingEvidence(env, buyer.buyer_account_id, passportId, pid, input, 'migration', source)
    ]);
    existing.push({ ...input, publicId: pid, receiptIds: [] });
    imported++; results.push({ fingerprint, status: 'imported', thingPublicId: pid });
  }
  log('migration', { buyerId: buyer.buyer_account_id, source, imported, skipped });
  return json({ ok: true, source, imported, skipped, results });
}

async function route(request, env, buyer, url) {
  const path = url.pathname;
  let match;
  if (path === '/api/v1/world/bootstrap' && request.method === 'GET') return worldBootstrap(env, buyer);
  if (path === '/api/v1/world/now' && request.method === 'GET') return nowView(env, buyer);
  if (path === '/api/v1/world/search' && request.method === 'GET') return worldSearch(env, buyer, url.searchParams.get('q'));
  if (path === '/api/v1/world/history' && request.method === 'GET') return historyList(env, buyer, url);
  if (path === '/api/v1/world/migrations/local-storage' && request.method === 'POST') return migrateLegacy(request, env, buyer);
  if (path === '/api/v1/world/relationships' && request.method === 'POST') return createRelationship(request, env, buyer);
  match = path.match(/^\/api\/v1\/world\/relationships\/([^/]+)$/);
  if (match && request.method === 'DELETE') return deleteRelationship(request, env, buyer, decodeURIComponent(match[1]));

  if (path === '/api/v1/world/things' && request.method === 'GET') return listThings(env, buyer);
  if (path === '/api/v1/world/things' && request.method === 'POST') return createThing(request, env, buyer);
  match = path.match(/^\/api\/v1\/world\/things\/([^/]+)$/);
  if (match && request.method === 'GET') return thingDetail(env, buyer, decodeURIComponent(match[1]));
  if (match && request.method === 'PATCH') return updateThing(request, env, buyer, decodeURIComponent(match[1]));
  if (match && request.method === 'DELETE') return archiveThing(request, env, buyer, decodeURIComponent(match[1]));

  if (path === '/api/v1/world/receipts' && request.method === 'GET') return listReceipts(env, buyer);
  if (path === '/api/v1/world/receipts/capture' && request.method === 'POST') return captureReceipt(request, env, buyer);
  match = path.match(/^\/api\/v1\/world\/receipts\/([^/]+)\/original$/);
  if (match && ['GET', 'HEAD'].includes(request.method)) return receiptOriginal(env, buyer, decodeURIComponent(match[1]), request);
  match = path.match(/^\/api\/v1\/world\/receipts\/([^/]+)\/retry$/);
  if (match && request.method === 'POST') return retryReceipt(env, buyer, decodeURIComponent(match[1]));
  match = path.match(/^\/api\/v1\/world\/receipts\/([^/]+)\/review$/);
  if (match && request.method === 'PATCH') return reviewReceipt(request, env, buyer, decodeURIComponent(match[1]));
  match = path.match(/^\/api\/v1\/world\/receipts\/([^/]+)\/confirm$/);
  if (match && request.method === 'POST') return confirmReceipt(request, env, buyer, decodeURIComponent(match[1]));
  match = path.match(/^\/api\/v1\/world\/receipts\/([^/]+)$/);
  if (match && request.method === 'GET') return receiptDetail(env, buyer, decodeURIComponent(match[1]));
  if (match && request.method === 'DELETE') return archiveReceipt(request, env, buyer, decodeURIComponent(match[1]));

  if (path === '/api/v1/world/documents' && request.method === 'GET') return listDocuments(env, buyer);
  if (path === '/api/v1/world/documents' && request.method === 'POST') return uploadDocument(request, env, buyer);
  match = path.match(/^\/api\/v1\/world\/documents\/([^/]+)\/original$/);
  if (match && ['GET', 'HEAD'].includes(request.method)) return documentOriginal(env, buyer, decodeURIComponent(match[1]), request);
  match = path.match(/^\/api\/v1\/world\/documents\/([^/]+)\/retry$/);
  if (match && request.method === 'POST') return retryDocument(env, buyer, decodeURIComponent(match[1]));
  match = path.match(/^\/api\/v1\/world\/documents\/([^/]+)$/);
  if (match && request.method === 'GET') return documentDetail(env, buyer, decodeURIComponent(match[1]));
  if (match && request.method === 'DELETE') return archiveDocument(request, env, buyer, decodeURIComponent(match[1]));

  if (path === '/api/v1/world/knowledge' && request.method === 'GET') return listKnowledge(env, buyer, url.searchParams.get('q'));
  if (path === '/api/v1/world/knowledge' && request.method === 'POST') return createKnowledge(request, env, buyer);
  match = path.match(/^\/api\/v1\/world\/knowledge\/([^/]+)$/);
  if (match && request.method === 'PATCH') return updateKnowledge(request, env, buyer, decodeURIComponent(match[1]));
  if (match && request.method === 'DELETE') return deleteKnowledge(request, env, buyer, decodeURIComponent(match[1]));

  if (path === '/api/v1/world/situations' && request.method === 'GET') return listSituations(env, buyer);
  if (path === '/api/v1/world/situations' && request.method === 'POST') return createSituation(request, env, buyer);
  match = path.match(/^\/api\/v1\/world\/situations\/([^/]+)$/);
  if (match && request.method === 'GET') return situationDetail(env, buyer, decodeURIComponent(match[1]));
  if (match && request.method === 'PATCH') return updateSituation(request, env, buyer, decodeURIComponent(match[1]));
  if (match && request.method === 'DELETE') return archiveSituation(request, env, buyer, decodeURIComponent(match[1]));

  if (path === '/api/v1/world/open-loops' && request.method === 'GET') return listLoops(env, buyer, url);
  if (path === '/api/v1/world/open-loops' && request.method === 'POST') return createLoop(request, env, buyer);
  match = path.match(/^\/api\/v1\/world\/open-loops\/([^/]+)$/);
  if (match && request.method === 'GET') {
    const row = await loopForOwner(env, buyer.buyer_account_id, decodeURIComponent(match[1]));
    return row ? json({ openLoop: loopJson(row) }) : json({ error: 'not_found' }, 404);
  }
  if (match && request.method === 'PATCH') return updateLoop(request, env, buyer, decodeURIComponent(match[1]));
  return json({ error: 'not_found' }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), path = url.pathname;
    if (!path.startsWith('/api/v1/world/')) return app.fetch(request, env, ctx);
    const requestId = crypto.randomUUID(), started = Date.now();
    if (!env.DB) return json({ error: 'database_not_configured', requestId }, 503, { 'x-request-id': requestId });
    let response;
    try {
      await ensureSchema(env);
      const buyer = await buyerSession(request, env);
      if (!buyer) {
        log('authorization_failure', { requestId, method: request.method, path, reason: 'buyer_session_required' });
        response = json({ error: 'unauthorized', message: 'Sign in with your buyer account to open your World.' }, 401);
      } else if (!['GET', 'HEAD'].includes(request.method) && !sameOrigin(request)) {
        log('authorization_failure', { requestId, method: request.method, path, reason: 'origin_not_allowed', buyerId: buyer.buyer_account_id });
        response = json({ error: 'origin_not_allowed' }, 403);
      } else if (!await rateLimit(env, buyer)) response = json({ error: 'rate_limited' }, 429, { 'retry-after': '60' });
      else response = await route(request, env, buyer, url);
    } catch (error) {
      console.error(JSON.stringify({ scope: 'buyer_world', event: 'request_error', requestId, method: request.method, path, category: clean(error?.name || 'error', 80), message: clean(error?.message, 200), durationMs: Date.now() - started }));
      response = json({ error: 'internal_error', requestId }, 500);
    }
    const headers = new Headers(response.headers);
    headers.set('x-request-id', requestId);
    return new Response(response.body, { status: response.status, headers });
  }
};
