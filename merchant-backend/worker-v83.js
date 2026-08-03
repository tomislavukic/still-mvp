import app from './worker-v79.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
};
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
const now = () => new Date().toISOString();
const id = prefix => `${prefix}${crypto.randomUUID().replaceAll('-', '')}`;
const clean = (value, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const allowedKinds = new Set(['product', 'service', 'subscription', 'booking', 'rental', 'project']);
let schemaReady;

async function sha(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function cookie(request, name) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

function safeDate(value) {
  const date = clean(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function maskedEmail(email) {
  if (!email) return null;
  return email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
}

async function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS ownership_passports(
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
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS passport_commitments(
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
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS passport_public_shares(
        id TEXT PRIMARY KEY,
        token_hash TEXT NOT NULL UNIQUE,
        passport_id TEXT NOT NULL,
        created_by TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        created_at TEXT NOT NULL
      )`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ownership_buyer ON ownership_passports(buyer_account_id,updated_at DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_ownership_org ON ownership_passports(organization_id,updated_at DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_commitment_passport ON passport_commitments(passport_id,created_at)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_commitment_buyer ON passport_commitments(buyer_account_id,due_at)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_passport_share_passport ON passport_public_shares(passport_id,created_at DESC)'),
      env.DB.prepare('PRAGMA optimize')
    ]).catch(error => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
}

async function buyerSession(request, env) {
  const raw = cookie(request, 'still_buyer');
  if (!raw) return null;
  const session = await env.DB.prepare(`SELECT a.id buyer_account_id,a.email,a.name
    FROM buyer_sessions s JOIN buyer_accounts a ON a.id=s.buyer_account_id
    WHERE s.token_hash=? AND s.expires_at>? AND a.status='active'`)
    .bind(await sha(raw), now()).first();
  return session || null;
}

async function companySession(request, env) {
  const raw = cookie(request, 'still_company');
  if (!raw) return null;
  const session = await env.DB.prepare(`SELECT m.id member_id,m.email,m.role,o.id organization_id,o.name organization_name,o.status organization_status
    FROM merchant_sessions s JOIN merchant_members m ON m.id=s.member_id
    JOIN merchant_organizations o ON o.id=m.organization_id
    WHERE s.token_hash=? AND s.expires_at>? AND m.status='active'`)
    .bind(await sha(raw), now()).first();
  return session || null;
}

function passportJson(row, commitments = []) {
  return {
    publicId: row.public_id,
    buyerConnected: !!row.buyer_account_id,
    organizationId: row.organization_id || null,
    invitedEmailHint: row.invited_email_hint || null,
    createdBy: row.created_by,
    kind: row.kind,
    title: row.title,
    businessName: row.business_name || null,
    reference: row.reference || null,
    purchasedOn: row.purchased_on || null,
    returnBy: row.return_by || null,
    warrantyUntil: row.warranty_until || null,
    renewalAt: row.renewal_at || null,
    nextActionAt: row.next_action_at || null,
    notes: row.notes || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    commitments: commitments.map(commitmentJson)
  };
}

function commitmentJson(row) {
  return {
    publicId: row.public_id,
    type: row.commitment_type,
    title: row.title,
    dueAt: row.due_at || null,
    status: row.status,
    evidenceNote: row.evidence_note || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function groupCommitments(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.passport_id)) grouped.set(row.passport_id, []);
    grouped.get(row.passport_id).push(row);
  }
  return grouped;
}

async function buyerList(request, env) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'unauthorized' }, 401);
  const [passports, commitments] = await Promise.all([
    env.DB.prepare('SELECT * FROM ownership_passports WHERE buyer_account_id=? AND status<>\'archived\' ORDER BY updated_at DESC LIMIT 300').bind(buyer.buyer_account_id).all(),
    env.DB.prepare('SELECT * FROM passport_commitments WHERE buyer_account_id=? ORDER BY due_at,created_at').bind(buyer.buyer_account_id).all()
  ]);
  const grouped = groupCommitments(commitments.results || []);
  return json({ passports: (passports.results || []).map(row => passportJson(row, grouped.get(row.id) || [])) });
}

async function buyerCreate(request, env) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'unauthorized' }, 401);
  const body = await request.json().catch(() => ({}));
  const kind = allowedKinds.has(body.kind) ? body.kind : 'product';
  const title = clean(body.title, 180);
  if (title.length < 2) return json({ error: 'invalid_passport' }, 422);
  const timestamp = now();
  const rowId = id('opp_');
  const publicId = `STP-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  await env.DB.prepare(`INSERT INTO ownership_passports(
    id,public_id,buyer_account_id,created_by,kind,title,business_name,reference,purchased_on,return_by,warranty_until,renewal_at,next_action_at,notes,status,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    rowId, publicId, buyer.buyer_account_id, 'buyer', kind, title,
    clean(body.business || body.businessName, 180) || null,
    clean(body.reference, 120) || null,
    safeDate(body.purchasedOn), safeDate(body.returnBy), safeDate(body.warrantyUntil),
    safeDate(body.renewalAt), safeDate(body.nextActionAt), clean(body.notes, 3000) || null,
    'connected', timestamp, timestamp
  ).run();
  const row = await env.DB.prepare('SELECT * FROM ownership_passports WHERE id=?').bind(rowId).first();
  return json({ ok: true, passport: passportJson(row) }, 201);
}

async function buyerConnect(request, env) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'unauthorized' }, 401);
  const body = await request.json().catch(() => ({}));
  const code = clean(body.code, 40).toUpperCase();
  if (!code) return json({ error: 'connection_code_required' }, 422);
  const row = await env.DB.prepare('SELECT * FROM ownership_passports WHERE connection_code_hash=?').bind(await sha(code)).first();
  if (!row) return json({ error: 'not_found' }, 404);
  if (row.buyer_account_id && row.buyer_account_id !== buyer.buyer_account_id) return json({ error: 'already_connected' }, 409);
  if (row.invited_email_hash && row.invited_email_hash !== await sha(buyer.email.toLowerCase())) return json({ error: 'email_mismatch' }, 409);
  const timestamp = now();
  await env.DB.batch([
    env.DB.prepare("UPDATE ownership_passports SET buyer_account_id=?,status='connected',connection_code_hash=NULL,updated_at=? WHERE id=?").bind(buyer.buyer_account_id, timestamp, row.id),
    env.DB.prepare('UPDATE passport_commitments SET buyer_account_id=?,updated_at=? WHERE passport_id=?').bind(buyer.buyer_account_id, timestamp, row.id)
  ]);
  const updated = await env.DB.prepare('SELECT * FROM ownership_passports WHERE id=?').bind(row.id).first();
  const commitments = await env.DB.prepare('SELECT * FROM passport_commitments WHERE passport_id=? ORDER BY due_at,created_at').bind(row.id).all();
  return json({ ok: true, passport: passportJson(updated, commitments.results || []) });
}

async function buyerTimeline(request, env) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'unauthorized' }, 401);
  const commitments = await env.DB.prepare(`SELECT c.*,p.public_id passport_public_id,p.title passport_title,p.business_name
    FROM passport_commitments c JOIN ownership_passports p ON p.id=c.passport_id
    WHERE c.buyer_account_id=? AND c.status IN ('promised','in_progress')
    ORDER BY c.due_at IS NULL,c.due_at,c.created_at LIMIT 300`).bind(buyer.buyer_account_id).all();
  return json({ events: (commitments.results || []).map(row => ({ ...commitmentJson(row), passportPublicId: row.passport_public_id, passportTitle: row.passport_title, businessName: row.business_name })) });
}

function publicPassportJson(row, commitments, share) {
  return {
    verification: 'still_server_record',
    publicId: row.public_id,
    kind: row.kind,
    title: row.title,
    businessName: row.business_name || null,
    purchasedOn: row.purchased_on || null,
    warrantyUntil: row.warranty_until || null,
    nextActionAt: row.next_action_at || null,
    status: row.status,
    issuer: row.organization_id ? {
      type: row.organization_status === 'verified' ? 'verified_business' : 'business',
      name: row.organization_name || row.business_name || null,
      verified: row.organization_status === 'verified'
    } : { type: 'buyer_record', name: null, verified: false },
    commitments: (commitments || []).map(item => ({
      publicId: item.public_id,
      type: item.commitment_type,
      title: item.title,
      dueAt: item.due_at || null,
      status: item.status
    })),
    sharedAt: share.share_created_at,
    expiresAt: share.share_expires_at,
    updatedAt: row.updated_at,
    privacy: 'Buyer identity, private notes, order references and internal evidence are excluded.'
  };
}

async function createPassportShare(request, env, publicId) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'unauthorized' }, 401);
  const passport = await env.DB.prepare('SELECT * FROM ownership_passports WHERE public_id=? AND buyer_account_id=? AND status<>\'archived\'').bind(publicId, buyer.buyer_account_id).first();
  if (!passport) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  const days = Math.max(1, Math.min(365, Math.floor(Number(body.days) || 30)));
  const token = `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`;
  const timestamp = now();
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  await env.DB.prepare('INSERT INTO passport_public_shares(id,token_hash,passport_id,created_by,expires_at,created_at) VALUES(?,?,?,?,?,?)')
    .bind(id('pps_'), await sha(token), passport.id, buyer.buyer_account_id, expiresAt, timestamp).run();
  const origin = new URL(request.url).origin;
  return json({ ok: true, token, verifyUrl: `${origin}/#passportVerify=${encodeURIComponent(token)}`, expiresAt }, 201);
}

async function verifyPassportShare(request, env, token) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return json({ error: 'not_found' }, 404);
  const share = await env.DB.prepare(`SELECT p.*,s.passport_id,s.created_at share_created_at,s.expires_at share_expires_at,o.name organization_name,o.status organization_status
    FROM passport_public_shares s JOIN ownership_passports p ON p.id=s.passport_id
    LEFT JOIN merchant_organizations o ON o.id=p.organization_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND p.status<>'archived'`).bind(await sha(token), now()).first();
  if (!share) return json({ error: 'not_found' }, 404);
  const commitments = await env.DB.prepare('SELECT * FROM passport_commitments WHERE passport_id=? ORDER BY due_at,created_at').bind(share.passport_id).all();
  return json({ passport: publicPassportJson(share, commitments.results || [], share) });
}

async function revokePassportShare(request, env, publicId, token) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'unauthorized' }, 401);
  const passport = await env.DB.prepare('SELECT id FROM ownership_passports WHERE public_id=? AND buyer_account_id=?').bind(publicId, buyer.buyer_account_id).first();
  if (!passport) return json({ error: 'not_found' }, 404);
  await env.DB.prepare('UPDATE passport_public_shares SET revoked_at=? WHERE passport_id=? AND token_hash=? AND revoked_at IS NULL')
    .bind(now(), passport.id, await sha(token)).run();
  return json({ ok: true, revoked: true });
}

async function businessList(request, env) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const [passports, commitments] = await Promise.all([
    env.DB.prepare("SELECT * FROM ownership_passports WHERE organization_id=? AND status<>'archived' ORDER BY updated_at DESC LIMIT 300").bind(company.organization_id).all(),
    env.DB.prepare('SELECT * FROM passport_commitments WHERE organization_id=? ORDER BY due_at,created_at').bind(company.organization_id).all()
  ]);
  const grouped = groupCommitments(commitments.results || []);
  return json({ organization: { name: company.organization_name, verified: true }, passports: (passports.results || []).map(row => passportJson(row, grouped.get(row.id) || [])) });
}

async function businessCreate(request, env) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  if (!['owner', 'admin', 'manager', 'agent'].includes(company.role)) return json({ error: 'forbidden' }, 403);
  const body = await request.json().catch(() => ({}));
  const kind = allowedKinds.has(body.kind) ? body.kind : 'product';
  const title = clean(body.title, 180);
  const buyerEmail = clean(body.buyerEmail, 254).toLowerCase();
  if (title.length < 2 || (buyerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail))) return json({ error: 'invalid_passport' }, 422);
  const timestamp = now();
  const rowId = id('opp_');
  const publicId = `STP-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const connectionCode = `STILL-${crypto.randomUUID().replaceAll('-', '').slice(0, 4).toUpperCase()}-${crypto.randomUUID().replaceAll('-', '').slice(0, 4).toUpperCase()}`;
  await env.DB.prepare(`INSERT INTO ownership_passports(
    id,public_id,organization_id,invited_email_hash,invited_email_hint,connection_code_hash,created_by,kind,title,business_name,reference,purchased_on,return_by,warranty_until,renewal_at,next_action_at,notes,status,created_at,updated_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    rowId, publicId, company.organization_id,
    buyerEmail ? await sha(buyerEmail) : null, maskedEmail(buyerEmail), await sha(connectionCode),
    'company', kind, title, company.organization_name, clean(body.reference, 120) || null,
    safeDate(body.purchasedOn), safeDate(body.returnBy), safeDate(body.warrantyUntil), safeDate(body.renewalAt), safeDate(body.nextActionAt),
    clean(body.notes, 3000) || null, 'invited', timestamp, timestamp
  ).run();
  const commitmentTitle = clean(body.commitmentTitle, 180);
  if (commitmentTitle) {
    await env.DB.prepare(`INSERT INTO passport_commitments(id,public_id,passport_id,organization_id,commitment_type,title,due_at,status,created_by_member_id,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(
      id('pcm_'), `COM-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`, rowId,
      company.organization_id, 'other', commitmentTitle, safeDate(body.commitmentDueAt), 'promised', company.member_id, timestamp, timestamp
    ).run();
  }
  const row = await env.DB.prepare('SELECT * FROM ownership_passports WHERE id=?').bind(rowId).first();
  const commitments = await env.DB.prepare('SELECT * FROM passport_commitments WHERE passport_id=?').bind(rowId).all();
  return json({ ok: true, connectionCode, passport: passportJson(row, commitments.results || []) }, 201);
}

async function businessCommitment(request, env, publicId) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const passport = await env.DB.prepare('SELECT * FROM ownership_passports WHERE public_id=? AND organization_id=?').bind(publicId, company.organization_id).first();
  if (!passport) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  const title = clean(body.title, 180);
  const type = ['delivery', 'service', 'repair', 'response', 'renewal', 'refund', 'other'].includes(body.type) ? body.type : 'other';
  if (title.length < 2) return json({ error: 'invalid_commitment' }, 422);
  const timestamp = now();
  const commitmentId = id('pcm_');
  await env.DB.prepare(`INSERT INTO passport_commitments(id,public_id,passport_id,buyer_account_id,organization_id,commitment_type,title,due_at,status,evidence_note,created_by_member_id,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    commitmentId, `COM-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`,
    passport.id, passport.buyer_account_id || null, company.organization_id, type, title,
    safeDate(body.dueAt), 'promised', clean(body.evidenceNote, 2000) || null, company.member_id, timestamp, timestamp
  ).run();
  await env.DB.prepare('UPDATE ownership_passports SET updated_at=? WHERE id=?').bind(timestamp, passport.id).run();
  const row = await env.DB.prepare('SELECT * FROM passport_commitments WHERE id=?').bind(commitmentId).first();
  return json({ ok: true, commitment: commitmentJson(row) }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const ownershipRoute = path.startsWith('/api/v1/ownership/');
    const businessPassportRoute = path.startsWith('/api/v1/business/passports');
    if (!ownershipRoute && !businessPassportRoute) return app.fetch(request, env);
    if (!env.DB) return json({ error: 'database_not_configured' }, 503);
    try {
      await ensureSchema(env);
      if (path === '/api/v1/ownership/passports' && request.method === 'GET') return buyerList(request, env);
      if (path === '/api/v1/ownership/passports' && request.method === 'POST') return buyerCreate(request, env);
      if (path === '/api/v1/ownership/connect' && request.method === 'POST') return buyerConnect(request, env);
      if (path === '/api/v1/ownership/timeline' && request.method === 'GET') return buyerTimeline(request, env);
      let shareMatch = path.match(/^\/api\/v1\/ownership\/passports\/([^/]+)\/shares$/);
      if (shareMatch && request.method === 'POST') return createPassportShare(request, env, decodeURIComponent(shareMatch[1]));
      shareMatch = path.match(/^\/api\/v1\/ownership\/passports\/([^/]+)\/shares\/([^/]+)$/);
      if (shareMatch && request.method === 'DELETE') return revokePassportShare(request, env, decodeURIComponent(shareMatch[1]), decodeURIComponent(shareMatch[2]));
      const verification = path.match(/^\/api\/v1\/ownership\/verify\/([^/]+)$/);
      if (verification && request.method === 'GET') return verifyPassportShare(request, env, decodeURIComponent(verification[1]));
      if (path === '/api/v1/business/passports' && request.method === 'GET') return businessList(request, env);
      if (path === '/api/v1/business/passports' && request.method === 'POST') return businessCreate(request, env);
      const commitment = path.match(/^\/api\/v1\/business\/passports\/([^/]+)\/commitments$/);
      if (commitment && request.method === 'POST') return businessCommitment(request, env, decodeURIComponent(commitment[1]));
      return json({ error: 'not_found' }, 404);
    } catch (error) {
      console.error('ownership_platform_error', error);
      return json({ error: 'internal_error' }, 500);
    }
  }
};
