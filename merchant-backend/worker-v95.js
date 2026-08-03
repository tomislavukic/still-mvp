import app from './worker-v92.js';

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
};
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: HEADERS });
const now = () => new Date().toISOString();
const uid = prefix => `${prefix}${crypto.randomUUID().replaceAll('-', '')}`;
const clean = (value, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const safeDate = value => /^\d{4}-\d{2}-\d{2}$/.test(clean(value, 10)) ? clean(value, 10) : null;
const cents = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(1000000000, Math.round(Number(value)))) : 0;
let schemaReady;

async function sha(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function cookie(request, name) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

async function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS lifecycle_preferences(
        id TEXT PRIMARY KEY,
        buyer_account_id TEXT NOT NULL,
        event_key TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        snoozed_until TEXT,
        updated_at TEXT NOT NULL,
        UNIQUE(buyer_account_id,event_key)
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS promise_templates(
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        commitment_type TEXT NOT NULL,
        title TEXT NOT NULL,
        default_days INTEGER NOT NULL DEFAULT 7,
        is_public INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS passport_service_events(
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,
        passport_id TEXT NOT NULL,
        organization_id TEXT,
        buyer_account_id TEXT,
        event_type TEXT NOT NULL,
        title TEXT NOT NULL,
        provider_name TEXT,
        occurred_on TEXT NOT NULL,
        cost_cents INTEGER NOT NULL DEFAULT 0,
        notes TEXT,
        is_public INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS passport_alerts(
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,
        passport_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'notice',
        title TEXT NOT NULL,
        detail TEXT NOT NULL,
        action_url TEXT,
        expires_at TEXT,
        created_by_member_id TEXT,
        created_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS passport_threads(
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,
        passport_id TEXT NOT NULL UNIQUE,
        buyer_account_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        subject TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS passport_messages(
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,
        thread_id TEXT NOT NULL,
        author_type TEXT NOT NULL,
        author_id TEXT NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS business_assets(
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
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_lifecycle_buyer_status ON lifecycle_preferences(buyer_account_id,status,updated_at DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_templates_org ON promise_templates(organization_id,updated_at DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_service_passport ON passport_service_events(passport_id,occurred_on DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_alert_passport ON passport_alerts(passport_id,created_at DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_threads_buyer ON passport_threads(buyer_account_id,updated_at DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_threads_org ON passport_threads(organization_id,updated_at DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_messages_thread ON passport_messages(thread_id,created_at)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_assets_org_status ON business_assets(organization_id,status,updated_at DESC)'),
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
  return await env.DB.prepare(`SELECT a.id buyer_account_id,a.email,a.name
    FROM buyer_sessions s JOIN buyer_accounts a ON a.id=s.buyer_account_id
    WHERE s.token_hash=? AND s.expires_at>? AND a.status='active'`)
    .bind(await sha(raw), now()).first() || null;
}

async function companySession(request, env) {
  const raw = cookie(request, 'still_company');
  if (!raw) return null;
  return await env.DB.prepare(`SELECT m.id member_id,m.role,o.id organization_id,o.name organization_name,o.status organization_status
    FROM merchant_sessions s JOIN merchant_members m ON m.id=s.member_id
    JOIN merchant_organizations o ON o.id=m.organization_id
    WHERE s.token_hash=? AND s.expires_at>? AND m.status='active'`)
    .bind(await sha(raw), now()).first() || null;
}

function historyJson(row, includePrivate = false) {
  return {
    publicId: row.public_id,
    passportPublicId: row.passport_public_id || null,
    passportTitle: row.passport_title || null,
    type: row.event_type,
    title: row.title,
    providerName: row.provider_name || null,
    occurredOn: row.occurred_on,
    costCents: includePrivate ? Number(row.cost_cents || 0) : undefined,
    notes: includePrivate ? row.notes || null : undefined,
    isPublic: !!row.is_public,
    createdBy: row.created_by,
    createdAt: row.created_at
  };
}

function threadJson(row) {
  return {
    publicId: row.public_id,
    passportPublicId: row.passport_public_id || null,
    passportTitle: row.passport_title || null,
    businessName: row.business_name || row.organization_name || null,
    subject: row.subject,
    status: row.status,
    updatedAt: row.updated_at,
    messageCount: Number(row.message_count || 0)
  };
}

async function reputation(env, organizationId) {
  const [organization, outcomes, support] = await Promise.all([
    env.DB.prepare('SELECT id,name,status FROM merchant_organizations WHERE id=?').bind(organizationId).first(),
    env.DB.prepare(`SELECT
      SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) completed,
      SUM(CASE WHEN status='missed' THEN 1 ELSE 0 END) missed,
      SUM(CASE WHEN status='disputed' THEN 1 ELSE 0 END) disputed,
      SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) cancelled
      FROM passport_commitments WHERE organization_id=?`).bind(organizationId).first(),
    env.DB.prepare(`SELECT
      SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END) resolved,
      COUNT(*) total
      FROM passport_threads WHERE organization_id=?`).bind(organizationId).first()
  ]);
  if (!organization) return null;
  const completed = Number(outcomes?.completed || 0);
  const missed = Number(outcomes?.missed || 0);
  const disputed = Number(outcomes?.disputed || 0);
  const cancelled = Number(outcomes?.cancelled || 0);
  const outcomeTotal = completed + missed + disputed + cancelled;
  const resolved = Number(support?.resolved || 0);
  const supportTotal = Number(support?.total || 0);
  const outcomeScore = outcomeTotal ? Math.round((completed + cancelled * .35) / outcomeTotal * 100) : 50;
  const supportScore = supportTotal ? Math.round(resolved / supportTotal * 100) : 50;
  const score = Math.max(0, Math.min(100, Math.round(outcomeScore * .75 + supportScore * .25)));
  return { organizationId, name: organization.name, verified: organization.status === 'verified', score, completed, missed, disputed, cancelled, resolvedThreads: resolved, totalThreads: supportTotal, outcomeSample: outcomeTotal };
}

function lifecycleEvents(passports, commitments, preferences) {
  const labels = [
    ['return_by', 'return', 'Return or cancellation deadline'],
    ['next_action_at', 'maintenance', 'Maintenance or next action'],
    ['renewal_at', 'renewal', 'Renewal or next payment'],
    ['warranty_until', 'warranty', 'Warranty or guarantee ending']
  ];
  const preferenceMap = new Map(preferences.map(item => [item.event_key, item]));
  const events = [];
  for (const passport of passports) {
    for (const [field, type, title] of labels) {
      if (!passport[field]) continue;
      const key = `${type}:${passport.public_id}`;
      const preference = preferenceMap.get(key);
      events.push({ key, type, title, date: passport[field], passportPublicId: passport.public_id, passportTitle: passport.title, businessName: passport.business_name || null, status: preference?.status || 'open', snoozedUntil: preference?.snoozed_until || null });
    }
  }
  for (const item of commitments) {
    if (!item.due_at || !['promised', 'in_progress'].includes(item.status)) continue;
    const key = `commitment:${item.public_id}`;
    const preference = preferenceMap.get(key);
    events.push({ key, type: 'commitment', title: item.title, date: item.due_at, passportPublicId: item.passport_public_id, passportTitle: item.passport_title, businessName: item.business_name || null, status: preference?.status || 'open', snoozedUntil: preference?.snoozed_until || null, companyStatus: item.status });
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

async function buyerDashboard(request, env) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'unauthorized' }, 401);
  const [passportResult, commitmentResult, preferenceResult, historyResult, alertResult, threadResult] = await Promise.all([
    env.DB.prepare("SELECT * FROM ownership_passports WHERE buyer_account_id=? AND status<>'archived' ORDER BY updated_at DESC LIMIT 300").bind(buyer.buyer_account_id).all(),
    env.DB.prepare(`SELECT c.*,p.public_id passport_public_id,p.title passport_title,p.business_name
      FROM passport_commitments c JOIN ownership_passports p ON p.id=c.passport_id
      WHERE p.buyer_account_id=? ORDER BY c.due_at,c.created_at`).bind(buyer.buyer_account_id).all(),
    env.DB.prepare('SELECT * FROM lifecycle_preferences WHERE buyer_account_id=?').bind(buyer.buyer_account_id).all(),
    env.DB.prepare(`SELECT h.*,p.public_id passport_public_id,p.title passport_title
      FROM passport_service_events h JOIN ownership_passports p ON p.id=h.passport_id
      WHERE p.buyer_account_id=? ORDER BY h.occurred_on DESC,h.created_at DESC LIMIT 500`).bind(buyer.buyer_account_id).all(),
    env.DB.prepare(`SELECT a.*,p.public_id passport_public_id,p.title passport_title,o.name organization_name
      FROM passport_alerts a JOIN ownership_passports p ON p.id=a.passport_id
      LEFT JOIN merchant_organizations o ON o.id=a.organization_id
      WHERE p.buyer_account_id=? AND (a.expires_at IS NULL OR a.expires_at>?)
      ORDER BY CASE a.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,a.created_at DESC`).bind(buyer.buyer_account_id, now()).all(),
    env.DB.prepare(`SELECT t.*,p.public_id passport_public_id,p.title passport_title,p.business_name,o.name organization_name,
      (SELECT COUNT(*) FROM passport_messages m WHERE m.thread_id=t.id) message_count
      FROM passport_threads t JOIN ownership_passports p ON p.id=t.passport_id
      LEFT JOIN merchant_organizations o ON o.id=t.organization_id
      WHERE t.buyer_account_id=? ORDER BY t.updated_at DESC`).bind(buyer.buyer_account_id).all()
  ]);
  const passports = passportResult.results || [];
  const organizationIds = [...new Set(passports.map(item => item.organization_id).filter(Boolean))];
  const reputations = (await Promise.all(organizationIds.map(id => reputation(env, id)))).filter(Boolean);
  return json({
    events: lifecycleEvents(passports, commitmentResult.results || [], preferenceResult.results || []),
    history: (historyResult.results || []).map(row => historyJson(row, true)),
    alerts: (alertResult.results || []).map(row => ({ publicId: row.public_id, passportPublicId: row.passport_public_id, passportTitle: row.passport_title, businessName: row.organization_name, severity: row.severity, title: row.title, detail: row.detail, actionUrl: row.action_url || null, expiresAt: row.expires_at, createdAt: row.created_at })),
    threads: (threadResult.results || []).map(threadJson),
    reputations
  });
}

async function updateLifecycleAction(request, env) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'unauthorized' }, 401);
  const body = await request.json().catch(() => ({}));
  const eventKey = clean(body.eventKey, 180);
  const status = ['open', 'done', 'snoozed'].includes(body.status) ? body.status : '';
  if (!eventKey || !status) return json({ error: 'invalid_action' }, 422);
  const timestamp = now();
  await env.DB.prepare(`INSERT INTO lifecycle_preferences(id,buyer_account_id,event_key,status,snoozed_until,updated_at)
    VALUES(?,?,?,?,?,?) ON CONFLICT(buyer_account_id,event_key) DO UPDATE SET status=excluded.status,snoozed_until=excluded.snoozed_until,updated_at=excluded.updated_at`)
    .bind(uid('lcp_'), buyer.buyer_account_id, eventKey, status, status === 'snoozed' ? safeDate(body.snoozedUntil) : null, timestamp).run();
  return json({ ok: true, eventKey, status });
}

async function passportForBuyer(env, buyerId, publicId) {
  return await env.DB.prepare("SELECT * FROM ownership_passports WHERE public_id=? AND buyer_account_id=? AND status<>'archived'").bind(publicId, buyerId).first() || null;
}

async function passportForCompany(env, organizationId, publicId) {
  return await env.DB.prepare("SELECT * FROM ownership_passports WHERE public_id=? AND organization_id=? AND status<>'archived'").bind(publicId, organizationId).first() || null;
}

async function addBuyerHistory(request, env, publicId) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'unauthorized' }, 401);
  const passport = await passportForBuyer(env, buyer.buyer_account_id, publicId);
  if (!passport) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  const title = clean(body.title, 180);
  const occurredOn = safeDate(body.occurredOn);
  if (title.length < 2 || !occurredOn) return json({ error: 'invalid_history' }, 422);
  const timestamp = now();
  const row = { id: uid('pse_'), publicId: `HIS-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}` };
  await env.DB.prepare(`INSERT INTO passport_service_events(id,public_id,passport_id,organization_id,buyer_account_id,event_type,title,provider_name,occurred_on,cost_cents,notes,is_public,created_by,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(row.id, row.publicId, passport.id, passport.organization_id, buyer.buyer_account_id, ['service', 'repair', 'inspection', 'upgrade', 'transfer'].includes(body.type) ? body.type : 'service', title, clean(body.providerName, 160) || null, occurredOn, cents(body.costCents), clean(body.notes, 1500) || null, body.isPublic ? 1 : 0, 'buyer', timestamp).run();
  return json({ ok: true, history: historyJson({ public_id: row.publicId, event_type: body.type || 'service', title, provider_name: clean(body.providerName, 160), occurred_on: occurredOn, cost_cents: cents(body.costCents), notes: clean(body.notes, 1500), is_public: body.isPublic ? 1 : 0, created_by: 'buyer', created_at: timestamp }, true) }, 201);
}

async function buyerSupport(request, env, publicId) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'unauthorized' }, 401);
  const passport = await passportForBuyer(env, buyer.buyer_account_id, publicId);
  if (!passport) return json({ error: 'not_found' }, 404);
  if (!passport.organization_id) return json({ error: 'company_not_connected' }, 409);
  let thread = await env.DB.prepare('SELECT * FROM passport_threads WHERE passport_id=?').bind(passport.id).first();
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const message = clean(body.message, 3000);
    if (message.length < 2) return json({ error: 'message_required' }, 422);
    const timestamp = now();
    if (!thread) {
      const threadId = uid('pth_');
      await env.DB.prepare('INSERT INTO passport_threads(id,public_id,passport_id,buyer_account_id,organization_id,subject,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)')
        .bind(threadId, `SUP-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`, passport.id, buyer.buyer_account_id, passport.organization_id, clean(body.subject, 160) || passport.title, 'open', timestamp, timestamp).run();
      thread = await env.DB.prepare('SELECT * FROM passport_threads WHERE id=?').bind(threadId).first();
    }
    await env.DB.batch([
      env.DB.prepare('INSERT INTO passport_messages(id,public_id,thread_id,author_type,author_id,body,created_at) VALUES(?,?,?,?,?,?,?)').bind(uid('pme_'), `MSG-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`, thread.id, 'buyer', buyer.buyer_account_id, message, timestamp),
      env.DB.prepare("UPDATE passport_threads SET status='open',updated_at=? WHERE id=?").bind(timestamp, thread.id)
    ]);
  }
  thread = await env.DB.prepare('SELECT * FROM passport_threads WHERE passport_id=?').bind(passport.id).first();
  if (!thread) return json({ thread: null, messages: [] });
  const messages = await env.DB.prepare('SELECT public_id,author_type,body,created_at FROM passport_messages WHERE thread_id=? ORDER BY created_at LIMIT 300').bind(thread.id).all();
  return json({ thread: threadJson({ ...thread, passport_public_id: passport.public_id, passport_title: passport.title, business_name: passport.business_name }), messages: messages.results || [] }, request.method === 'POST' ? 201 : 200);
}

async function companyDashboard(request, env) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const [passports, templates, commitments, alerts, threads, history, assets] = await Promise.all([
    env.DB.prepare("SELECT public_id,title,kind,status,buyer_account_id FROM ownership_passports WHERE organization_id=? AND status<>'archived' ORDER BY updated_at DESC LIMIT 300").bind(company.organization_id).all(),
    env.DB.prepare('SELECT * FROM promise_templates WHERE organization_id=? ORDER BY updated_at DESC').bind(company.organization_id).all(),
    env.DB.prepare(`SELECT c.public_id,c.title,c.commitment_type,c.due_at,c.status,p.public_id passport_public_id,p.title passport_title
      FROM passport_commitments c JOIN ownership_passports p ON p.id=c.passport_id
      WHERE c.organization_id=? ORDER BY c.due_at IS NULL,c.due_at,c.created_at DESC LIMIT 500`).bind(company.organization_id).all(),
    env.DB.prepare(`SELECT a.*,p.public_id passport_public_id,p.title passport_title FROM passport_alerts a JOIN ownership_passports p ON p.id=a.passport_id WHERE a.organization_id=? ORDER BY a.created_at DESC LIMIT 300`).bind(company.organization_id).all(),
    env.DB.prepare(`SELECT t.*,p.public_id passport_public_id,p.title passport_title,
      (SELECT COUNT(*) FROM passport_messages m WHERE m.thread_id=t.id) message_count
      FROM passport_threads t JOIN ownership_passports p ON p.id=t.passport_id
      WHERE t.organization_id=? ORDER BY t.updated_at DESC`).bind(company.organization_id).all(),
    env.DB.prepare(`SELECT h.*,p.public_id passport_public_id,p.title passport_title FROM passport_service_events h JOIN ownership_passports p ON p.id=h.passport_id WHERE h.organization_id=? ORDER BY h.occurred_on DESC LIMIT 500`).bind(company.organization_id).all(),
    env.DB.prepare('SELECT * FROM business_assets WHERE organization_id=? ORDER BY status,COALESCE(renewal_at,maintenance_at),updated_at DESC LIMIT 500').bind(company.organization_id).all()
  ]);
  return json({
    organization: { name: company.organization_name },
    reputation: await reputation(env, company.organization_id),
    passports: passports.results || [],
    templates: (templates.results || []).map(row => ({ publicId: row.public_id, name: row.name, type: row.commitment_type, title: row.title, defaultDays: row.default_days, isPublic: !!row.is_public })),
    commitments: (commitments.results || []).map(row => ({ publicId: row.public_id, title: row.title, type: row.commitment_type, dueAt: row.due_at, status: row.status, passportPublicId: row.passport_public_id, passportTitle: row.passport_title })),
    alerts: (alerts.results || []).map(row => ({ publicId: row.public_id, passportPublicId: row.passport_public_id, passportTitle: row.passport_title, severity: row.severity, title: row.title, detail: row.detail, expiresAt: row.expires_at, createdAt: row.created_at })),
    threads: (threads.results || []).map(threadJson),
    history: (history.results || []).map(row => historyJson(row, true)),
    assets: (assets.results || []).map(row => ({ publicId: row.public_id, category: row.category, title: row.title, supplier: row.supplier, reference: row.reference, renewalAt: row.renewal_at, maintenanceAt: row.maintenance_at, seats: row.seats, costCents: row.cost_cents, currency: row.currency, status: row.status, notes: row.notes }))
  });
}

async function createTemplate(request, env) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const body = await request.json().catch(() => ({}));
  const name = clean(body.name, 100);
  const title = clean(body.title, 180);
  const type = ['delivery', 'service', 'repair', 'response', 'renewal', 'refund', 'other'].includes(body.type) ? body.type : 'other';
  if (name.length < 2 || title.length < 2) return json({ error: 'invalid_template' }, 422);
  const timestamp = now();
  const publicId = `TPL-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  await env.DB.prepare('INSERT INTO promise_templates(id,public_id,organization_id,name,commitment_type,title,default_days,is_public,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(uid('ptm_'), publicId, company.organization_id, name, type, title, Math.max(0, Math.min(3650, Math.round(Number(body.defaultDays) || 7))), body.isPublic === false ? 0 : 1, timestamp, timestamp).run();
  return json({ ok: true, publicId }, 201);
}

async function applyTemplate(request, env, passportPublicId, templatePublicId) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const [passport, template] = await Promise.all([passportForCompany(env, company.organization_id, passportPublicId), env.DB.prepare('SELECT * FROM promise_templates WHERE public_id=? AND organization_id=?').bind(templatePublicId, company.organization_id).first()]);
  if (!passport || !template) return json({ error: 'not_found' }, 404);
  const timestamp = now();
  const dueAt = new Date(Date.now() + Number(template.default_days || 0) * 86400000).toISOString().slice(0, 10);
  await env.DB.prepare('INSERT INTO passport_commitments(id,public_id,passport_id,buyer_account_id,organization_id,commitment_type,title,due_at,status,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(uid('pcm_'), `COM-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`, passport.id, passport.buyer_account_id, company.organization_id, template.commitment_type, template.title, dueAt, 'promised', company.member_id, timestamp, timestamp).run();
  return json({ ok: true, dueAt }, 201);
}

async function updateCommitment(request, env, publicId) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const body = await request.json().catch(() => ({}));
  if (!['promised', 'in_progress', 'completed', 'missed', 'cancelled', 'disputed'].includes(body.status)) return json({ error: 'invalid_status' }, 422);
  const result = await env.DB.prepare('UPDATE passport_commitments SET status=?,updated_at=? WHERE public_id=? AND organization_id=?').bind(body.status, now(), publicId, company.organization_id).run();
  return result.meta?.changes ? json({ ok: true, status: body.status }) : json({ error: 'not_found' }, 404);
}

function safeActionUrl(value) {
  const raw = clean(value, 500);
  if (!raw) return null;
  try { const url = new URL(raw); return ['https:', 'http:'].includes(url.protocol) ? url.toString() : null; } catch { return null; }
}

async function createCompanyAlert(request, env, passportPublicId) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const passport = await passportForCompany(env, company.organization_id, passportPublicId);
  if (!passport) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  const title = clean(body.title, 180);
  const detail = clean(body.detail, 2000);
  if (title.length < 2 || detail.length < 2) return json({ error: 'invalid_alert' }, 422);
  const publicId = `ALT-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  await env.DB.prepare('INSERT INTO passport_alerts(id,public_id,passport_id,organization_id,severity,title,detail,action_url,expires_at,created_by_member_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
    .bind(uid('pal_'), publicId, passport.id, company.organization_id, ['notice', 'warning', 'critical'].includes(body.severity) ? body.severity : 'notice', title, detail, safeActionUrl(body.actionUrl), safeDate(body.expiresAt), company.member_id, now()).run();
  return json({ ok: true, publicId }, 201);
}

async function addCompanyHistory(request, env, passportPublicId) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const passport = await passportForCompany(env, company.organization_id, passportPublicId);
  if (!passport) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  const title = clean(body.title, 180);
  const occurredOn = safeDate(body.occurredOn);
  if (title.length < 2 || !occurredOn) return json({ error: 'invalid_history' }, 422);
  const publicId = `HIS-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  await env.DB.prepare('INSERT INTO passport_service_events(id,public_id,passport_id,organization_id,buyer_account_id,event_type,title,provider_name,occurred_on,cost_cents,notes,is_public,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(uid('pse_'), publicId, passport.id, company.organization_id, passport.buyer_account_id, ['service', 'repair', 'inspection', 'upgrade', 'transfer'].includes(body.type) ? body.type : 'service', title, company.organization_name, occurredOn, cents(body.costCents), clean(body.notes, 1500) || null, body.isPublic === false ? 0 : 1, 'company', now()).run();
  return json({ ok: true, publicId }, 201);
}

async function companySupport(request, env, threadPublicId) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const thread = await env.DB.prepare(`SELECT t.*,p.public_id passport_public_id,p.title passport_title FROM passport_threads t JOIN ownership_passports p ON p.id=t.passport_id WHERE t.public_id=? AND t.organization_id=?`).bind(threadPublicId, company.organization_id).first();
  if (!thread) return json({ error: 'not_found' }, 404);
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const message = clean(body.message, 3000);
    if (message.length < 2) return json({ error: 'message_required' }, 422);
    const timestamp = now();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO passport_messages(id,public_id,thread_id,author_type,author_id,body,created_at) VALUES(?,?,?,?,?,?,?)').bind(uid('pme_'), `MSG-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`, thread.id, 'company', company.member_id, message, timestamp),
      env.DB.prepare("UPDATE passport_threads SET status='waiting_buyer',updated_at=? WHERE id=?").bind(timestamp, thread.id)
    ]);
  } else if (request.method === 'PATCH') {
    const body = await request.json().catch(() => ({}));
    if (!['open', 'waiting_buyer', 'resolved'].includes(body.status)) return json({ error: 'invalid_status' }, 422);
    await env.DB.prepare('UPDATE passport_threads SET status=?,updated_at=? WHERE id=?').bind(body.status, now(), thread.id).run();
  }
  const updated = await env.DB.prepare('SELECT * FROM passport_threads WHERE id=?').bind(thread.id).first();
  const messages = await env.DB.prepare('SELECT public_id,author_type,body,created_at FROM passport_messages WHERE thread_id=? ORDER BY created_at LIMIT 300').bind(thread.id).all();
  return json({ thread: threadJson({ ...updated, passport_public_id: thread.passport_public_id, passport_title: thread.passport_title }), messages: messages.results || [] });
}

async function createAsset(request, env) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const body = await request.json().catch(() => ({}));
  const title = clean(body.title, 180);
  if (title.length < 2) return json({ error: 'invalid_asset' }, 422);
  const publicId = `B2B-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const timestamp = now();
  await env.DB.prepare('INSERT INTO business_assets(id,public_id,organization_id,category,title,supplier,reference,renewal_at,maintenance_at,seats,cost_cents,currency,status,notes,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(uid('bas_'), publicId, company.organization_id, ['asset', 'license', 'rental', 'contract', 'vendor'].includes(body.category) ? body.category : 'asset', title, clean(body.supplier, 160) || null, clean(body.reference, 120) || null, safeDate(body.renewalAt), safeDate(body.maintenanceAt), Math.max(0, Math.min(1000000, Math.round(Number(body.seats) || 0))) || null, cents(body.costCents), clean(body.currency, 3).toUpperCase() || 'EUR', 'active', clean(body.notes, 1500) || null, company.member_id, timestamp, timestamp).run();
  return json({ ok: true, publicId }, 201);
}

async function updateAsset(request, env, publicId) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const body = await request.json().catch(() => ({}));
  if (!['active', 'paused', 'retired'].includes(body.status)) return json({ error: 'invalid_status' }, 422);
  const result = await env.DB.prepare('UPDATE business_assets SET status=?,updated_at=? WHERE public_id=? AND organization_id=?').bind(body.status, now(), publicId, company.organization_id).run();
  return result.meta?.changes ? json({ ok: true, status: body.status }) : json({ error: 'not_found' }, 404);
}

async function verifiedPassport(request, env, token) {
  if (!/^[a-f0-9]{64}$/i.test(token)) return json({ error: 'not_found' }, 404);
  const row = await env.DB.prepare(`SELECT p.*,s.created_at share_created_at,s.expires_at share_expires_at,o.name organization_name,o.status organization_status
    FROM passport_public_shares s JOIN ownership_passports p ON p.id=s.passport_id
    LEFT JOIN merchant_organizations o ON o.id=p.organization_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND p.status<>'archived'`).bind(await sha(token), now()).first();
  if (!row) return json({ error: 'not_found' }, 404);
  const [commitments, history] = await Promise.all([
    env.DB.prepare('SELECT public_id,commitment_type,title,due_at,status FROM passport_commitments WHERE passport_id=? ORDER BY due_at,created_at').bind(row.id).all(),
    env.DB.prepare('SELECT * FROM passport_service_events WHERE passport_id=? AND is_public=1 ORDER BY occurred_on DESC LIMIT 30').bind(row.id).all()
  ]);
  return json({ passport: {
    verification: 'still_server_record', publicId: row.public_id, kind: row.kind, title: row.title,
    businessName: row.business_name || null, purchasedOn: row.purchased_on || null,
    warrantyUntil: row.warranty_until || null, nextActionAt: row.next_action_at || null,
    issuer: row.organization_id ? { type: row.organization_status === 'verified' ? 'verified_business' : 'business', name: row.organization_name || row.business_name || null, verified: row.organization_status === 'verified' } : { type: 'buyer_record', name: null, verified: false },
    commitments: (commitments.results || []).map(item => ({ publicId: item.public_id, type: item.commitment_type, title: item.title, dueAt: item.due_at, status: item.status })),
    serviceHistory: (history.results || []).map(item => historyJson(item, false)),
    sharedAt: row.share_created_at, expiresAt: row.share_expires_at, updatedAt: row.updated_at,
    privacy: 'Buyer identity, private notes, order references, service costs and internal evidence are excluded.'
  }});
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const lifecycleRoute = path.startsWith('/api/v1/lifecycle/');
    const businessRoute = path.startsWith('/api/v1/business/lifecycle/');
    const verificationMatch = path.match(/^\/api\/v1\/ownership\/verify\/([^/]+)$/);
    if (!lifecycleRoute && !businessRoute && !verificationMatch) return app.fetch(request, env);
    if (!env.DB) return json({ error: 'database_not_configured' }, 503);
    try {
      await ensureSchema(env);
      if (verificationMatch && request.method === 'GET') return verifiedPassport(request, env, decodeURIComponent(verificationMatch[1]));
      if (path === '/api/v1/lifecycle/dashboard' && request.method === 'GET') return buyerDashboard(request, env);
      if (path === '/api/v1/lifecycle/actions' && request.method === 'POST') return updateLifecycleAction(request, env);
      let match = path.match(/^\/api\/v1\/lifecycle\/passports\/([^/]+)\/history$/);
      if (match && request.method === 'POST') return addBuyerHistory(request, env, decodeURIComponent(match[1]));
      match = path.match(/^\/api\/v1\/lifecycle\/passports\/([^/]+)\/support$/);
      if (match && ['GET', 'POST'].includes(request.method)) return buyerSupport(request, env, decodeURIComponent(match[1]));
      if (path === '/api/v1/business/lifecycle/dashboard' && request.method === 'GET') return companyDashboard(request, env);
      if (path === '/api/v1/business/lifecycle/templates' && request.method === 'POST') return createTemplate(request, env);
      match = path.match(/^\/api\/v1\/business\/lifecycle\/passports\/([^/]+)\/templates\/([^/]+)\/apply$/);
      if (match && request.method === 'POST') return applyTemplate(request, env, decodeURIComponent(match[1]), decodeURIComponent(match[2]));
      match = path.match(/^\/api\/v1\/business\/lifecycle\/commitments\/([^/]+)$/);
      if (match && request.method === 'PATCH') return updateCommitment(request, env, decodeURIComponent(match[1]));
      match = path.match(/^\/api\/v1\/business\/lifecycle\/passports\/([^/]+)\/alerts$/);
      if (match && request.method === 'POST') return createCompanyAlert(request, env, decodeURIComponent(match[1]));
      match = path.match(/^\/api\/v1\/business\/lifecycle\/passports\/([^/]+)\/history$/);
      if (match && request.method === 'POST') return addCompanyHistory(request, env, decodeURIComponent(match[1]));
      match = path.match(/^\/api\/v1\/business\/lifecycle\/support\/([^/]+)$/);
      if (match && ['GET', 'POST', 'PATCH'].includes(request.method)) return companySupport(request, env, decodeURIComponent(match[1]));
      if (path === '/api/v1/business/lifecycle/assets' && request.method === 'POST') return createAsset(request, env);
      match = path.match(/^\/api\/v1\/business\/lifecycle\/assets\/([^/]+)$/);
      if (match && request.method === 'PATCH') return updateAsset(request, env, decodeURIComponent(match[1]));
      return json({ error: 'not_found' }, 404);
    } catch (error) {
      console.error('lifecycle_platform_error', error);
      return json({ error: error.message || 'internal_error' }, error.status && error.status >= 400 && error.status < 600 ? error.status : 500);
    }
  }
};
