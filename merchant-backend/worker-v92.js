import app from './worker-v83.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
};
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { ...JSON_HEADERS, ...headers } });
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const uid = prefix => `${prefix}${crypto.randomUUID().replaceAll('-', '')}`;
const clean = (value, max = 1000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const kinds = new Set(['product', 'service', 'subscription', 'booking', 'rental', 'project']);
const fulfillmentTypes = new Set(['delivery', 'pickup', 'appointment', 'on_site', 'digital', 'agreed']);
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

function slug(value) {
  return clean(value, 80).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `business-${crypto.randomUUID().slice(0, 8)}`;
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(50, Math.min(50000000, Math.round(number))) : 0;
}

function safeDate(value) {
  const date = clean(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

async function ensureSchema(env) {
  if (!schemaReady) {
    schemaReady = env.DB.batch([
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS commerce_business_profiles(
        organization_id TEXT PRIMARY KEY,
        public_slug TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        summary TEXT,
        support_email TEXT,
        stripe_account_id TEXT,
        charges_enabled INTEGER NOT NULL DEFAULT 0,
        payouts_enabled INTEGER NOT NULL DEFAULT 0,
        onboarding_status TEXT NOT NULL DEFAULT 'not_connected',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS commerce_offers(
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,
        organization_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EUR',
        tax_included INTEGER NOT NULL DEFAULT 1,
        quantity_available INTEGER,
        fulfillment_type TEXT NOT NULL DEFAULT 'agreed',
        fulfillment_details TEXT,
        includes_text TEXT,
        exclusions_text TEXT,
        cancellation_terms TEXT NOT NULL,
        warranty_terms TEXT,
        estimated_duration TEXT,
        reward_points INTEGER NOT NULL DEFAULT 10,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS commerce_orders(
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,
        offer_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        buyer_account_id TEXT NOT NULL,
        buyer_email_hint TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL,
        platform_fee_cents INTEGER NOT NULL DEFAULT 0,
        provider TEXT NOT NULL DEFAULT 'demo',
        provider_payment_id TEXT,
        status TEXT NOT NULL DEFAULT 'awaiting_payment',
        buyer_message TEXT,
        terms_snapshot TEXT NOT NULL,
        passport_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        paid_at TEXT,
        completed_at TEXT
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS commerce_requests(
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,
        buyer_account_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        location TEXT,
        budget_min_cents INTEGER,
        budget_max_cents INTEGER,
        desired_by TEXT,
        must_haves TEXT,
        status TEXT NOT NULL DEFAULT 'open',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS commerce_quotes(
        id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL UNIQUE,
        request_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        offer_id TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'EUR',
        tax_included INTEGER NOT NULL DEFAULT 1,
        fulfillment_type TEXT NOT NULL DEFAULT 'agreed',
        fulfillment_details TEXT,
        cancellation_terms TEXT NOT NULL,
        warranty_terms TEXT,
        estimated_duration TEXT,
        reward_points INTEGER NOT NULL DEFAULT 10,
        status TEXT NOT NULL DEFAULT 'submitted',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS ownership_passports(
        id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,buyer_account_id TEXT,organization_id TEXT,invited_email_hash TEXT,invited_email_hint TEXT,connection_code_hash TEXT UNIQUE,created_by TEXT NOT NULL,kind TEXT NOT NULL,title TEXT NOT NULL,business_name TEXT,reference TEXT,purchased_on TEXT,return_by TEXT,warranty_until TEXT,renewal_at TEXT,next_action_at TEXT,notes TEXT,status TEXT NOT NULL DEFAULT 'invited',created_at TEXT NOT NULL,updated_at TEXT NOT NULL
      )`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS passport_commitments(
        id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,passport_id TEXT NOT NULL,buyer_account_id TEXT,organization_id TEXT NOT NULL,commitment_type TEXT NOT NULL,title TEXT NOT NULL,due_at TEXT,status TEXT NOT NULL DEFAULT 'promised',evidence_note TEXT,created_by_member_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL
      )`),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_commerce_offer_org ON commerce_offers(organization_id,status,updated_at DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_commerce_order_buyer ON commerce_orders(buyer_account_id,created_at DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_commerce_order_org ON commerce_orders(organization_id,created_at DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_commerce_request_buyer ON commerce_requests(buyer_account_id,updated_at DESC)'),
      env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_commerce_request_status ON commerce_requests(status,updated_at DESC)'),
      env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_commerce_quote_request_org ON commerce_quotes(request_id,organization_id)'),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS buyer_reward_accounts(id TEXT PRIMARY KEY,email_hash TEXT NOT NULL UNIQUE,email_display TEXT,points_balance INTEGER NOT NULL DEFAULT 0,lifetime_points INTEGER NOT NULL DEFAULT 0,reputation_score INTEGER NOT NULL DEFAULT 50,reputation_level TEXT NOT NULL DEFAULT 'participant',created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS buyer_reward_ledger(id TEXT PRIMARY KEY,account_id TEXT NOT NULL,source_key TEXT NOT NULL UNIQUE,event_type TEXT NOT NULL,points_delta INTEGER NOT NULL,description TEXT,case_id TEXT,organization_id TEXT,created_at TEXT NOT NULL)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS business_reward_accounts(organization_id TEXT PRIMARY KEY,credits_balance INTEGER NOT NULL DEFAULT 0,lifetime_credits INTEGER NOT NULL DEFAULT 0,reputation_score INTEGER NOT NULL DEFAULT 50,reputation_level TEXT NOT NULL DEFAULT 'verified',platform_credit_cents INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL)`),
      env.DB.prepare(`CREATE TABLE IF NOT EXISTS business_reward_ledger(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,source_key TEXT NOT NULL UNIQUE,event_type TEXT NOT NULL,credits_delta INTEGER NOT NULL,description TEXT,created_at TEXT NOT NULL)`)
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
  return env.DB.prepare(`SELECT a.id buyer_account_id,a.email,a.name
    FROM buyer_sessions s JOIN buyer_accounts a ON a.id=s.buyer_account_id
    WHERE s.token_hash=? AND s.expires_at>? AND a.status='active'`)
    .bind(await sha(raw), now()).first();
}

async function companySession(request, env) {
  const raw = cookie(request, 'still_company');
  if (!raw) return null;
  return env.DB.prepare(`SELECT m.id member_id,m.email,m.role,o.id organization_id,o.name organization_name,o.status organization_status
    FROM merchant_sessions s JOIN merchant_members m ON m.id=s.member_id
    JOIN merchant_organizations o ON o.id=m.organization_id
    WHERE s.token_hash=? AND s.expires_at>? AND m.status='active'`)
    .bind(await sha(raw), now()).first();
}

function offerJson(row, seller = {}) {
  return {
    publicId: row.public_id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    amountCents: row.amount_cents,
    currency: row.currency,
    taxIncluded: !!row.tax_included,
    quantityAvailable: row.quantity_available,
    fulfillmentType: row.fulfillment_type,
    fulfillmentDetails: row.fulfillment_details,
    includes: row.includes_text,
    exclusions: row.exclusions_text,
    cancellationTerms: row.cancellation_terms,
    warrantyTerms: row.warranty_terms,
    estimatedDuration: row.estimated_duration,
    rewardPoints: row.reward_points,
    status: row.status,
    seller: {
      name: seller.display_name || seller.organization_name || seller.seller_name || row.seller_name || 'Verified business',
      slug: seller.public_slug || row.public_slug || null,
      summary: seller.summary || seller.seller_summary || row.seller_summary || null,
      supportEmail: seller.support_email || row.support_email || null,
      verified: true,
      paymentsConnected: !!(seller.charges_enabled ?? row.charges_enabled)
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function orderJson(row) {
  return {
    publicId: row.public_id,
    status: row.status,
    quantity: row.quantity,
    amountCents: row.amount_cents,
    currency: row.currency,
    platformFeeCents: row.platform_fee_cents,
    provider: row.provider,
    buyerMessage: row.buyer_message,
    passportId: row.passport_public_id || null,
    offer: row.offer_public_id ? {
      publicId: row.offer_public_id,
      title: row.offer_title,
      kind: row.offer_kind,
      fulfillmentType: row.fulfillment_type,
      sellerName: row.seller_name
    } : null,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    completedAt: row.completed_at,
    updatedAt: row.updated_at
  };
}

function quoteJson(row) {
  return {
    publicId: row.public_id,
    title: row.title,
    description: row.description,
    amountCents: row.amount_cents,
    currency: row.currency,
    taxIncluded: !!row.tax_included,
    fulfillmentType: row.fulfillment_type,
    fulfillmentDetails: row.fulfillment_details,
    cancellationTerms: row.cancellation_terms,
    warrantyTerms: row.warranty_terms,
    estimatedDuration: row.estimated_duration,
    rewardPoints: row.reward_points,
    status: row.status,
    offerPublicId: row.offer_public_id || null,
    seller: row.seller_name ? { name: row.seller_name, summary: row.seller_summary || null, verified: true, paymentsConnected: !!row.charges_enabled } : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function requestJson(row, quotes = []) {
  return {
    publicId: row.public_id,
    kind: row.kind,
    title: row.title,
    description: row.description,
    location: row.location,
    budgetMinCents: row.budget_min_cents,
    budgetMaxCents: row.budget_max_cents,
    desiredBy: row.desired_by,
    mustHaves: row.must_haves,
    status: row.status,
    quoteCount: Number(row.quote_count || quotes.length || 0),
    quotes,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function ensureProfile(env, company) {
  const timestamp = now();
  let profile = await env.DB.prepare('SELECT * FROM commerce_business_profiles WHERE organization_id=?').bind(company.organization_id).first();
  if (!profile) {
    let publicSlug = slug(company.organization_name);
    const existing = await env.DB.prepare('SELECT organization_id FROM commerce_business_profiles WHERE public_slug=?').bind(publicSlug).first();
    if (existing) publicSlug += `-${crypto.randomUUID().slice(0, 6)}`;
    await env.DB.prepare(`INSERT INTO commerce_business_profiles(organization_id,public_slug,display_name,support_email,created_at,updated_at) VALUES(?,?,?,?,?,?)`)
      .bind(company.organization_id, publicSlug, company.organization_name, company.email, timestamp, timestamp).run();
    profile = await env.DB.prepare('SELECT * FROM commerce_business_profiles WHERE organization_id=?').bind(company.organization_id).first();
  }
  return profile;
}

async function stripeRequest(env, path, body = null, accountId = null, idempotencyKey = null) {
  if (!env.STRIPE_SECRET_KEY) throw Object.assign(new Error('payment_provider_not_configured'), { status: 503 });
  const headers = { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` };
  if (body) headers['content-type'] = 'application/x-www-form-urlencoded';
  if (accountId) headers['stripe-account'] = accountId;
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  const response = await fetch(`https://api.stripe.com/v1${path}`, { method: body ? 'POST' : 'GET', headers, body: body ? new URLSearchParams(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error?.message || 'payment_provider_error'), { status: response.status, code: data.error?.code });
  return data;
}

async function refreshStripeProfile(env, profile) {
  if (!env.STRIPE_SECRET_KEY || !profile.stripe_account_id) return profile;
  try {
    const account = await stripeRequest(env, `/accounts/${encodeURIComponent(profile.stripe_account_id)}`);
    const status = account.charges_enabled && account.payouts_enabled ? 'ready' : account.details_submitted ? 'review' : 'incomplete';
    await env.DB.prepare('UPDATE commerce_business_profiles SET charges_enabled=?,payouts_enabled=?,onboarding_status=?,updated_at=? WHERE organization_id=?')
      .bind(account.charges_enabled ? 1 : 0, account.payouts_enabled ? 1 : 0, status, now(), profile.organization_id).run();
    return { ...profile, charges_enabled: account.charges_enabled ? 1 : 0, payouts_enabled: account.payouts_enabled ? 1 : 0, onboarding_status: status };
  } catch {
    return profile;
  }
}

async function buyerRequests(request, env) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'buyer_sign_in_required' }, 401);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(`SELECT r.*,(SELECT COUNT(*) FROM commerce_quotes q WHERE q.request_id=r.id AND q.status<>'withdrawn') quote_count
      FROM commerce_requests r WHERE r.buyer_account_id=? ORDER BY r.updated_at DESC LIMIT 100`).bind(buyer.buyer_account_id).all();
    const requestRows = rows.results || [];
    if (!requestRows.length) return json({ requests: [] });
    const quotes = await env.DB.prepare(`SELECT q.*,p.display_name seller_name,p.summary seller_summary,p.charges_enabled,o.public_id offer_public_id
      FROM commerce_quotes q JOIN commerce_requests r ON r.id=q.request_id JOIN commerce_business_profiles p ON p.organization_id=q.organization_id
      LEFT JOIN commerce_offers o ON o.id=q.offer_id WHERE r.buyer_account_id=? ORDER BY q.created_at DESC`).bind(buyer.buyer_account_id).all();
    const grouped = new Map();
    for (const row of quotes.results || []) {
      if (!grouped.has(row.request_id)) grouped.set(row.request_id, []);
      grouped.get(row.request_id).push(quoteJson(row));
    }
    return json({ requests: requestRows.map(row => requestJson(row, grouped.get(row.id) || [])) });
  }
  const body = await request.json().catch(() => ({}));
  const kind = kinds.has(body.kind) ? body.kind : 'service';
  const title = clean(body.title, 180);
  const description = clean(body.description, 3000);
  const mustHaves = clean(body.mustHaves, 2000);
  if (title.length < 3 || description.length < 20) return json({ error: 'invalid_request', message: 'A clear title and description are required.' }, 422);
  const min = body.budgetMinCents === '' || body.budgetMinCents == null ? null : money(body.budgetMinCents);
  const max = body.budgetMaxCents === '' || body.budgetMaxCents == null ? null : money(body.budgetMaxCents);
  if (min !== null && max !== null && min > max) return json({ error: 'invalid_budget' }, 422);
  const timestamp = now();
  const rowId = uid('crq_');
  const publicId = `REQUEST-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  await env.DB.prepare(`INSERT INTO commerce_requests(id,public_id,buyer_account_id,kind,title,description,location,budget_min_cents,budget_max_cents,desired_by,must_haves,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,'open',?,?)`).bind(rowId, publicId, buyer.buyer_account_id, kind, title, description, clean(body.location, 180) || null, min, max, safeDate(body.desiredBy), mustHaves || null, timestamp, timestamp).run();
  const row = await env.DB.prepare('SELECT * FROM commerce_requests WHERE id=?').bind(rowId).first();
  return json({ ok: true, request: requestJson(row) }, 201);
}

async function buyerRequestUpdate(request, env, publicId) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'buyer_sign_in_required' }, 401);
  const row = await env.DB.prepare('SELECT * FROM commerce_requests WHERE public_id=? AND buyer_account_id=?').bind(publicId, buyer.buyer_account_id).first();
  if (!row) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  if (!['open', 'closed', 'cancelled'].includes(body.status)) return json({ error: 'invalid_status' }, 422);
  if (row.status === 'accepted' && body.status === 'open') return json({ error: 'accepted_request_locked' }, 409);
  await env.DB.prepare('UPDATE commerce_requests SET status=?,updated_at=? WHERE id=?').bind(body.status, now(), row.id).run();
  return json({ ok: true, status: body.status });
}

async function companyRequests(request, env) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const rows = await env.DB.prepare(`SELECT r.*,q.public_id own_quote_id,q.status own_quote_status
    FROM commerce_requests r LEFT JOIN commerce_quotes q ON q.request_id=r.id AND q.organization_id=?
    WHERE r.status='open' ORDER BY r.updated_at DESC LIMIT 150`).bind(company.organization_id).all();
  return json({ requests: (rows.results || []).map(row => ({ ...requestJson(row), ownQuote: row.own_quote_id ? { publicId: row.own_quote_id, status: row.own_quote_status } : null })) });
}

async function companyQuote(request, env, requestPublicId) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified' || !['owner', 'admin', 'manager', 'agent'].includes(company.role)) return json({ error: 'forbidden' }, 403);
  const profile = await ensureProfile(env, company);
  const buyerRequest = await env.DB.prepare("SELECT * FROM commerce_requests WHERE public_id=? AND status='open'").bind(requestPublicId).first();
  if (!buyerRequest) return json({ error: 'request_not_available' }, 404);
  const existing = await env.DB.prepare('SELECT public_id FROM commerce_quotes WHERE request_id=? AND organization_id=?').bind(buyerRequest.id, company.organization_id).first();
  if (existing) return json({ error: 'quote_already_submitted', publicId: existing.public_id }, 409);
  const body = await request.json().catch(() => ({}));
  const title = clean(body.title, 180) || buyerRequest.title;
  const description = clean(body.description, 3000);
  const amount = money(body.amountCents);
  const cancellation = clean(body.cancellationTerms, 3000);
  if (description.length < 10 || !amount || cancellation.length < 5) return json({ error: 'invalid_quote', message: 'Description, price and cancellation terms are required.' }, 422);
  const timestamp = now();
  const rowId = uid('cqt_');
  const publicId = `QUOTE-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  await env.DB.prepare(`INSERT INTO commerce_quotes(id,public_id,request_id,organization_id,title,description,amount_cents,currency,tax_included,fulfillment_type,fulfillment_details,cancellation_terms,warranty_terms,estimated_duration,reward_points,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'submitted',?,?)`).bind(rowId, publicId, buyerRequest.id, company.organization_id, title, description, amount, clean(body.currency, 3).toUpperCase() || 'EUR', body.taxIncluded === false ? 0 : 1, fulfillmentTypes.has(body.fulfillmentType) ? body.fulfillmentType : 'agreed', clean(body.fulfillmentDetails, 2000) || null, cancellation, clean(body.warrantyTerms, 2000) || null, clean(body.estimatedDuration, 120) || null, Math.max(0, Math.min(1000, Math.floor(Number(body.rewardPoints) || 10))), timestamp, timestamp).run();
  await env.DB.prepare('UPDATE commerce_requests SET updated_at=? WHERE id=?').bind(timestamp, buyerRequest.id).run();
  const row = await env.DB.prepare('SELECT * FROM commerce_quotes WHERE id=?').bind(rowId).first();
  return json({ ok: true, quote: quoteJson({ ...row, seller_name: profile.display_name, seller_summary: profile.summary, charges_enabled: profile.charges_enabled }) }, 201);
}

async function acceptQuote(request, env, requestPublicId, quotePublicId) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'buyer_sign_in_required' }, 401);
  const buyerRequest = await env.DB.prepare('SELECT * FROM commerce_requests WHERE public_id=? AND buyer_account_id=?').bind(requestPublicId, buyer.buyer_account_id).first();
  if (!buyerRequest) return json({ error: 'not_found' }, 404);
  const quote = await env.DB.prepare(`SELECT q.*,p.display_name seller_name,p.summary seller_summary,p.support_email,p.charges_enabled,p.public_slug
    FROM commerce_quotes q JOIN commerce_business_profiles p ON p.organization_id=q.organization_id WHERE q.public_id=? AND q.request_id=?`).bind(quotePublicId, buyerRequest.id).first();
  if (!quote || !['submitted', 'accepted'].includes(quote.status)) return json({ error: 'quote_not_available' }, 404);
  if (quote.offer_id) {
    const existing = await env.DB.prepare('SELECT * FROM commerce_offers WHERE id=?').bind(quote.offer_id).first();
    return json({ ok: true, offer: offerJson(existing, quote), alreadyAccepted: true });
  }
  if (buyerRequest.status !== 'open') return json({ error: 'request_not_open' }, 409);
  const timestamp = now();
  const offerId = uid('cof_');
  const offerPublicId = `OFFER-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO commerce_offers(id,public_id,organization_id,kind,title,description,amount_cents,currency,tax_included,quantity_available,fulfillment_type,fulfillment_details,includes_text,cancellation_terms,warranty_terms,estimated_duration,reward_points,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?,?,?,?,'private',?,?)`).bind(offerId, offerPublicId, quote.organization_id, buyerRequest.kind, quote.title, quote.description, quote.amount_cents, quote.currency, quote.tax_included, quote.fulfillment_type, quote.fulfillment_details, buyerRequest.must_haves, quote.cancellation_terms, quote.warranty_terms, quote.estimated_duration, quote.reward_points, timestamp, timestamp),
    env.DB.prepare("UPDATE commerce_quotes SET status='accepted',offer_id=?,updated_at=? WHERE id=?").bind(offerId, timestamp, quote.id),
    env.DB.prepare("UPDATE commerce_quotes SET status='rejected',updated_at=? WHERE request_id=? AND id<>? AND status='submitted'").bind(timestamp, buyerRequest.id, quote.id),
    env.DB.prepare("UPDATE commerce_requests SET status='accepted',updated_at=? WHERE id=?").bind(timestamp, buyerRequest.id)
  ]);
  const offer = await env.DB.prepare('SELECT * FROM commerce_offers WHERE id=?').bind(offerId).first();
  return json({ ok: true, offer: offerJson(offer, quote) });
}

async function buyerCanAccessOffer(env, buyerId, offerId) {
  const row = await env.DB.prepare(`SELECT q.id FROM commerce_quotes q JOIN commerce_requests r ON r.id=q.request_id
    WHERE q.offer_id=? AND r.buyer_account_id=? AND q.status='accepted'`).bind(offerId, buyerId).first();
  return !!row;
}

async function publicOffers(request, env) {
  const url = new URL(request.url);
  const kind = kinds.has(url.searchParams.get('kind')) ? url.searchParams.get('kind') : '';
  const q = clean(url.searchParams.get('q'), 100).toLowerCase();
  const params = [];
  let where = "o.status='published'";
  if (kind) { where += ' AND o.kind=?'; params.push(kind); }
  if (q) { where += ' AND (lower(o.title) LIKE ? OR lower(o.description) LIKE ? OR lower(p.display_name) LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  const rows = await env.DB.prepare(`SELECT o.*,p.display_name seller_name,p.public_slug,p.summary seller_summary,p.support_email,p.charges_enabled
    FROM commerce_offers o JOIN commerce_business_profiles p ON p.organization_id=o.organization_id
    WHERE ${where} ORDER BY o.updated_at DESC LIMIT 120`).bind(...params).all();
  return json({ offers: (rows.results || []).map(row => offerJson(row)) });
}

async function publicOffer(request, env, publicId) {
  const row = await env.DB.prepare(`SELECT o.*,p.display_name seller_name,p.public_slug,p.summary seller_summary,p.support_email,p.charges_enabled
    FROM commerce_offers o JOIN commerce_business_profiles p ON p.organization_id=o.organization_id
    WHERE o.public_id=? AND o.status IN ('published','private')`).bind(publicId).first();
  if (!row) return json({ error: 'not_found' }, 404);
  if (row.status === 'private') {
    const buyer = await buyerSession(request, env);
    if (!buyer || !await buyerCanAccessOffer(env, buyer.buyer_account_id, row.id)) return json({ error: 'not_found' }, 404);
  }
  return json({ offer: offerJson(row) });
}

async function companyProfile(request, env) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  let profile = await ensureProfile(env, company);
  if (request.method === 'PATCH') {
    const body = await request.json().catch(() => ({}));
    await env.DB.prepare('UPDATE commerce_business_profiles SET display_name=?,summary=?,support_email=?,updated_at=? WHERE organization_id=?')
      .bind(clean(body.displayName, 180) || company.organization_name, clean(body.summary, 1000) || null, clean(body.supportEmail, 254) || company.email, now(), company.organization_id).run();
    profile = await env.DB.prepare('SELECT * FROM commerce_business_profiles WHERE organization_id=?').bind(company.organization_id).first();
  }
  profile = await refreshStripeProfile(env, profile);
  return json({
    profile: {
      publicSlug: profile.public_slug,
      displayName: profile.display_name,
      summary: profile.summary,
      supportEmail: profile.support_email,
      onboardingStatus: profile.onboarding_status,
      chargesEnabled: !!profile.charges_enabled,
      payoutsEnabled: !!profile.payouts_enabled
    },
    payments: {
      provider: 'Stripe Connect',
      configured: !!env.STRIPE_SECRET_KEY,
      publishableKeyConfigured: !!env.STRIPE_PUBLISHABLE_KEY,
      country: env.STRIPE_CONNECTED_ACCOUNT_COUNTRY || 'HR',
      note: env.STRIPE_SECRET_KEY ? 'Provider credentials are configured.' : 'Provider credentials are not configured. Offers use an explicitly labelled demo checkout.'
    }
  });
}

async function companyOnboard(request, env) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified' || !['owner', 'admin'].includes(company.role)) return json({ error: 'forbidden' }, 403);
  let profile = await ensureProfile(env, company);
  if (!env.STRIPE_SECRET_KEY) return json({ error: 'payment_provider_not_configured', message: 'Add Stripe platform credentials before onboarding businesses.' }, 503);
  if (!profile.stripe_account_id) {
    const account = await stripeRequest(env, '/accounts', {
      type: 'express',
      country: env.STRIPE_CONNECTED_ACCOUNT_COUNTRY || 'HR',
      email: company.email,
      'business_profile[name]': company.organization_name,
      'business_profile[product_description]': 'Products and services sold by this verified business through Still? Passport Commerce.',
      'capabilities[card_payments][requested]': 'true',
      'capabilities[transfers][requested]': 'true',
      'metadata[still_organization_id]': company.organization_id
    }, null, `still-connect-${company.organization_id}`);
    await env.DB.prepare("UPDATE commerce_business_profiles SET stripe_account_id=?,onboarding_status='incomplete',updated_at=? WHERE organization_id=?")
      .bind(account.id, now(), company.organization_id).run();
    profile = { ...profile, stripe_account_id: account.id };
  }
  const origin = new URL(request.url).origin;
  const link = await stripeRequest(env, '/account_links', {
    account: profile.stripe_account_id,
    refresh_url: `${origin}/company.html#passportCommerceV92`,
    return_url: `${origin}/company.html#passportCommerceV92`,
    type: 'account_onboarding'
  });
  return json({ ok: true, onboardingUrl: link.url });
}

async function companyOffers(request, env) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const profile = await ensureProfile(env, company);
  if (request.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM commerce_offers WHERE organization_id=? ORDER BY updated_at DESC LIMIT 200').bind(company.organization_id).all();
    return json({ offers: (rows.results || []).map(row => offerJson(row, profile)) });
  }
  if (!['owner', 'admin', 'manager'].includes(company.role)) return json({ error: 'forbidden' }, 403);
  const body = await request.json().catch(() => ({}));
  const kind = kinds.has(body.kind) ? body.kind : 'service';
  const title = clean(body.title, 180);
  const description = clean(body.description, 3000);
  const amountCents = money(body.amountCents);
  const cancellationTerms = clean(body.cancellationTerms, 3000);
  if (title.length < 3 || description.length < 10 || !amountCents || cancellationTerms.length < 5) return json({ error: 'invalid_offer', message: 'Title, description, price and cancellation terms are required.' }, 422);
  const timestamp = now();
  const rowId = uid('cof_');
  const publicId = `OFFER-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const quantity = body.quantityAvailable === '' || body.quantityAvailable == null ? null : Math.max(0, Math.min(100000, Math.floor(Number(body.quantityAvailable) || 0)));
  const status = body.status === 'published' ? 'published' : 'draft';
  await env.DB.prepare(`INSERT INTO commerce_offers(id,public_id,organization_id,kind,title,description,amount_cents,currency,tax_included,quantity_available,fulfillment_type,fulfillment_details,includes_text,exclusions_text,cancellation_terms,warranty_terms,estimated_duration,reward_points,status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      rowId, publicId, company.organization_id, kind, title, description, amountCents, clean(body.currency, 3).toUpperCase() || 'EUR', body.taxIncluded === false ? 0 : 1,
      quantity, fulfillmentTypes.has(body.fulfillmentType) ? body.fulfillmentType : 'agreed', clean(body.fulfillmentDetails, 2000) || null,
      clean(body.includes, 2000) || null, clean(body.exclusions, 2000) || null, cancellationTerms, clean(body.warrantyTerms, 2000) || null,
      clean(body.estimatedDuration, 120) || null, Math.max(0, Math.min(1000, Math.floor(Number(body.rewardPoints) || 10))), status, timestamp, timestamp
    ).run();
  const row = await env.DB.prepare('SELECT * FROM commerce_offers WHERE id=?').bind(rowId).first();
  return json({ ok: true, offer: offerJson(row, profile) }, 201);
}

async function companyOfferUpdate(request, env, publicId) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified' || !['owner', 'admin', 'manager'].includes(company.role)) return json({ error: 'forbidden' }, 403);
  const current = await env.DB.prepare('SELECT * FROM commerce_offers WHERE public_id=? AND organization_id=?').bind(publicId, company.organization_id).first();
  if (!current) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  const status = ['draft', 'published', 'paused', 'archived'].includes(body.status) ? body.status : current.status;
  const quantity = body.quantityAvailable === undefined ? current.quantity_available : body.quantityAvailable === '' || body.quantityAvailable === null ? null : Math.max(0, Math.floor(Number(body.quantityAvailable) || 0));
  await env.DB.prepare('UPDATE commerce_offers SET status=?,quantity_available=?,updated_at=? WHERE id=?').bind(status, quantity, now(), current.id).run();
  const row = await env.DB.prepare('SELECT * FROM commerce_offers WHERE id=?').bind(current.id).first();
  return json({ ok: true, offer: offerJson(row, await ensureProfile(env, company)) });
}

function snapshot(offer, seller) {
  return JSON.stringify({
    seller: { name: seller.display_name, organizationId: offer.organization_id, supportEmail: seller.support_email },
    offer: offerJson(offer, seller),
    acceptedAt: now(),
    platformRole: 'Still? provides verified identity, checkout orchestration, passport activation and an evidence timeline. The verified business remains the seller or service provider.'
  });
}

async function checkout(request, env, publicId) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'buyer_sign_in_required' }, 401);
  const offer = await env.DB.prepare("SELECT * FROM commerce_offers WHERE public_id=? AND status IN ('published','private')").bind(publicId).first();
  if (!offer) return json({ error: 'offer_not_available' }, 404);
  if (offer.status === 'private' && !await buyerCanAccessOffer(env, buyer.buyer_account_id, offer.id)) return json({ error: 'offer_not_available' }, 404);
  if (offer.quantity_available !== null && offer.quantity_available <= 0) return json({ error: 'sold_out' }, 409);
  const seller = await env.DB.prepare('SELECT * FROM commerce_business_profiles WHERE organization_id=?').bind(offer.organization_id).first();
  const body = await request.json().catch(() => ({}));
  const quantity = Math.max(1, Math.min(10, Math.floor(Number(body.quantity) || 1)));
  if (offer.quantity_available !== null && quantity > offer.quantity_available) return json({ error: 'insufficient_availability' }, 409);
  const amount = offer.amount_cents * quantity;
  const feeBps = Math.max(0, Math.min(2000, Number(env.COMMERCE_FEE_BPS) || 500));
  const fee = Math.floor(amount * feeBps / 10000);
  const orderId = uid('cor_');
  const publicOrderId = `ORDER-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const timestamp = now();
  const provider = env.STRIPE_SECRET_KEY && seller?.charges_enabled ? 'stripe' : 'demo';
  await env.DB.prepare(`INSERT INTO commerce_orders(id,public_id,offer_id,organization_id,buyer_account_id,buyer_email_hint,quantity,amount_cents,currency,platform_fee_cents,provider,status,buyer_message,terms_snapshot,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      orderId, publicOrderId, offer.id, offer.organization_id, buyer.buyer_account_id, buyer.email.replace(/^(.{2}).*(@.*)$/, '$1***$2'), quantity, amount,
      offer.currency, fee, provider, 'awaiting_payment', clean(body.buyerMessage, 1000) || null, snapshot(offer, seller), timestamp, timestamp
    ).run();
  if (provider === 'stripe') {
    try {
      const intent = await stripeRequest(env, '/payment_intents', {
        amount: String(amount),
        currency: offer.currency.toLowerCase(),
        'automatic_payment_methods[enabled]': 'true',
        application_fee_amount: String(fee),
        receipt_email: buyer.email,
        description: `${offer.title} · ${publicOrderId}`,
        'metadata[still_order_id]': orderId,
        'metadata[still_order_public_id]': publicOrderId,
        'metadata[still_offer_public_id]': offer.public_id
      }, seller.stripe_account_id, `still-order-${orderId}`);
      await env.DB.prepare('UPDATE commerce_orders SET provider_payment_id=?,updated_at=? WHERE id=?').bind(intent.id, now(), orderId).run();
      return json({
        order: { publicId: publicOrderId, amountCents: amount, currency: offer.currency, provider: 'stripe', status: 'awaiting_payment' },
        payment: { provider: 'stripe', clientSecret: intent.client_secret, publishableKey: env.STRIPE_PUBLISHABLE_KEY, connectedAccountId: seller.stripe_account_id },
        seller: { name: seller.display_name, verified: true }
      }, 201);
    } catch (error) {
      await env.DB.prepare("UPDATE commerce_orders SET status='cancelled',updated_at=? WHERE id=?").bind(now(), orderId).run();
      return json({ error: 'payment_initialization_failed', message: error.message }, 502);
    }
  }
  return json({
    order: { publicId: publicOrderId, amountCents: amount, currency: offer.currency, provider: 'demo', status: 'awaiting_payment' },
    payment: { provider: 'demo', liveCharge: false, reason: env.STRIPE_SECRET_KEY ? 'This business has not completed payment onboarding.' : 'The platform payment provider has not been configured.' },
    seller: { name: seller.display_name, verified: true }
  }, 201);
}

async function award(env, buyerId, organizationId, email, order, stage, points, credits) {
  const timestamp = now();
  const emailHash = await sha(email.toLowerCase());
  let account = await env.DB.prepare('SELECT * FROM buyer_reward_accounts WHERE email_hash=?').bind(emailHash).first();
  if (!account) {
    const accountId = uid('bra_');
    await env.DB.prepare('INSERT INTO buyer_reward_accounts(id,email_hash,email_display,created_at,updated_at) VALUES(?,?,?,?,?)')
      .bind(accountId, emailHash, email.replace(/^(.{2}).*(@.*)$/, '$1***$2'), timestamp, timestamp).run();
    account = { id: accountId };
  }
  const buyerInsert = await env.DB.prepare('INSERT OR IGNORE INTO buyer_reward_ledger(id,account_id,source_key,event_type,points_delta,description,organization_id,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .bind(uid('brl_'), account.id, `commerce:${stage}:${order.id}`, `passport_commerce_${stage}`, points, stage === 'paid' ? 'Paid a verified Passport Offer.' : 'Completed a verified Passport Commerce order.', organizationId, timestamp).run();
  if ((buyerInsert.meta?.changes || 0) > 0) await env.DB.prepare('UPDATE buyer_reward_accounts SET points_balance=points_balance+?,lifetime_points=lifetime_points+?,updated_at=? WHERE id=?').bind(points, Math.max(0, points), timestamp, account.id).run();
  await env.DB.prepare('INSERT OR IGNORE INTO business_reward_accounts(organization_id,updated_at) VALUES(?,?)').bind(organizationId, timestamp).run();
  const businessInsert = await env.DB.prepare('INSERT OR IGNORE INTO business_reward_ledger(id,organization_id,source_key,event_type,credits_delta,description,created_at) VALUES(?,?,?,?,?,?,?)')
    .bind(uid('bcl_'), organizationId, `commerce:${stage}:${order.id}`, `passport_commerce_${stage}`, credits, stage === 'paid' ? 'Received a verified Passport Commerce order.' : 'Completed a Passport Commerce commitment.', timestamp).run();
  if ((businessInsert.meta?.changes || 0) > 0) await env.DB.prepare('UPDATE business_reward_accounts SET credits_balance=credits_balance+?,lifetime_credits=lifetime_credits+?,updated_at=? WHERE organization_id=?').bind(credits, Math.max(0, credits), timestamp, organizationId).run();
}

async function activateOrder(env, orderId, providerPaymentId = null, demonstration = false) {
  const order = await env.DB.prepare('SELECT * FROM commerce_orders WHERE id=?').bind(orderId).first();
  if (!order) return null;
  if (order.passport_id) {
    const existing = await env.DB.prepare('SELECT * FROM ownership_passports WHERE id=?').bind(order.passport_id).first();
    return { order, passport: existing };
  }
  const offer = await env.DB.prepare('SELECT * FROM commerce_offers WHERE id=?').bind(order.offer_id).first();
  const seller = await env.DB.prepare('SELECT * FROM commerce_business_profiles WHERE organization_id=?').bind(order.organization_id).first();
  const buyer = await env.DB.prepare('SELECT * FROM buyer_accounts WHERE id=?').bind(order.buyer_account_id).first();
  if (!offer || !seller || !buyer) throw new Error('order_activation_data_missing');
  const passportId = uid('opp_');
  const passportPublicId = `STP-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const timestamp = now();
  const commitmentId = uid('pcm_');
  const commitmentPublicId = `COM-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
  const orderStatus = demonstration ? 'demo_activated' : 'paid';
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO ownership_passports(id,public_id,buyer_account_id,organization_id,created_by,kind,title,business_name,reference,purchased_on,notes,status,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(passportId, passportPublicId, order.buyer_account_id, order.organization_id, 'company', offer.kind, offer.title, seller.display_name, order.public_id, today(), `Passport Commerce purchase. Seller terms are preserved in order ${order.public_id}.`, 'connected', timestamp, timestamp),
    env.DB.prepare(`INSERT INTO passport_commitments(id,public_id,passport_id,buyer_account_id,organization_id,commitment_type,title,status,evidence_note,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(commitmentId, commitmentPublicId, passportId, order.buyer_account_id, order.organization_id, offer.kind === 'product' ? 'delivery' : 'service', offer.fulfillment_details || `Fulfil ${offer.title} as described in the accepted Passport Offer.`, 'promised', offer.warranty_terms || null, timestamp, timestamp),
    env.DB.prepare('UPDATE commerce_orders SET status=?,passport_id=?,provider_payment_id=COALESCE(?,provider_payment_id),paid_at=?,updated_at=? WHERE id=?').bind(orderStatus, passportId, providerPaymentId, demonstration ? null : timestamp, timestamp, order.id),
    ...(demonstration || offer.quantity_available === null ? [] : [env.DB.prepare('UPDATE commerce_offers SET quantity_available=MAX(0,quantity_available-?),updated_at=? WHERE id=?').bind(order.quantity, timestamp, offer.id)])
  ]);
  if (!demonstration) await award(env, order.buyer_account_id, order.organization_id, buyer.email, order, 'paid', offer.reward_points, 10);
  return { order: await env.DB.prepare('SELECT * FROM commerce_orders WHERE id=?').bind(order.id).first(), passport: await env.DB.prepare('SELECT * FROM ownership_passports WHERE id=?').bind(passportId).first() };
}

function passportJson(row) {
  return row ? {
    publicId: row.public_id,
    organizationId: row.organization_id,
    kind: row.kind,
    title: row.title,
    businessName: row.business_name,
    reference: row.reference,
    purchasedOn: row.purchased_on,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    commitments: []
  } : null;
}

async function demoComplete(request, env, publicId) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'buyer_sign_in_required' }, 401);
  const order = await env.DB.prepare('SELECT * FROM commerce_orders WHERE public_id=? AND buyer_account_id=?').bind(publicId, buyer.buyer_account_id).first();
  if (!order) return json({ error: 'not_found' }, 404);
  if (order.provider !== 'demo') return json({ error: 'live_payment_required' }, 409);
  const body = await request.json().catch(() => ({}));
  if (body.confirmDemo !== true) return json({ error: 'demo_confirmation_required' }, 422);
  const activated = await activateOrder(env, order.id, `demo_${crypto.randomUUID()}`, true);
  return json({ ok: true, demo: true, liveCharge: false, rewardsAwarded: false, order: { publicId, status: 'demo_activated' }, passport: passportJson(activated.passport) });
}

async function confirmStripeOrder(request, env, publicId) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'buyer_sign_in_required' }, 401);
  const order = await env.DB.prepare('SELECT * FROM commerce_orders WHERE public_id=? AND buyer_account_id=?').bind(publicId, buyer.buyer_account_id).first();
  if (!order) return json({ error: 'not_found' }, 404);
  if (order.passport_id) {
    const passport = await env.DB.prepare('SELECT * FROM ownership_passports WHERE id=?').bind(order.passport_id).first();
    return json({ ok: true, order: { publicId, status: order.status }, passport: passportJson(passport) });
  }
  if (order.provider !== 'stripe' || !order.provider_payment_id) return json({ error: 'live_payment_not_found' }, 409);
  const profile = await env.DB.prepare('SELECT * FROM commerce_business_profiles WHERE organization_id=?').bind(order.organization_id).first();
  const intent = await stripeRequest(env, `/payment_intents/${encodeURIComponent(order.provider_payment_id)}`, null, profile?.stripe_account_id);
  if (intent.status !== 'succeeded') return json({ error: 'payment_not_confirmed', paymentStatus: intent.status }, 409);
  const activated = await activateOrder(env, order.id, intent.id);
  return json({ ok: true, order: { publicId, status: 'paid' }, passport: passportJson(activated.passport) });
}

async function buyerOrders(request, env) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'buyer_sign_in_required' }, 401);
  const rows = await env.DB.prepare(`SELECT r.*,o.public_id offer_public_id,o.title offer_title,o.kind offer_kind,o.fulfillment_type,p.display_name seller_name,op.public_id passport_public_id
    FROM commerce_orders r JOIN commerce_offers o ON o.id=r.offer_id JOIN commerce_business_profiles p ON p.organization_id=r.organization_id
    LEFT JOIN ownership_passports op ON op.id=r.passport_id WHERE r.buyer_account_id=? ORDER BY r.created_at DESC LIMIT 200`).bind(buyer.buyer_account_id).all();
  return json({ orders: (rows.results || []).map(orderJson) });
}

async function businessOrders(request, env) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const rows = await env.DB.prepare(`SELECT r.*,o.public_id offer_public_id,o.title offer_title,o.kind offer_kind,o.fulfillment_type,p.display_name seller_name,op.public_id passport_public_id
    FROM commerce_orders r JOIN commerce_offers o ON o.id=r.offer_id JOIN commerce_business_profiles p ON p.organization_id=r.organization_id
    LEFT JOIN ownership_passports op ON op.id=r.passport_id WHERE r.organization_id=? ORDER BY r.created_at DESC LIMIT 300`).bind(company.organization_id).all();
  return json({ orders: (rows.results || []).map(orderJson) });
}

async function updateBusinessOrder(request, env, publicId) {
  const company = await companySession(request, env);
  if (!company) return json({ error: 'unauthorized' }, 401);
  if (company.organization_status !== 'verified') return json({ error: 'verification_required' }, 403);
  const order = await env.DB.prepare('SELECT * FROM commerce_orders WHERE public_id=? AND organization_id=?').bind(publicId, company.organization_id).first();
  if (!order) return json({ error: 'not_found' }, 404);
  const body = await request.json().catch(() => ({}));
  const allowed = ['accepted', 'in_progress', 'completed', 'cancelled', 'refunded', 'disputed'];
  if (!allowed.includes(body.status)) return json({ error: 'invalid_status' }, 422);
  if (['accepted', 'in_progress', 'completed'].includes(body.status) && !['paid', 'accepted', 'in_progress'].includes(order.status)) return json({ error: 'invalid_transition' }, 409);
  const timestamp = now();
  await env.DB.prepare('UPDATE commerce_orders SET status=?,completed_at=?,updated_at=? WHERE id=?').bind(body.status, body.status === 'completed' ? timestamp : order.completed_at, timestamp, order.id).run();
  if (order.passport_id && body.status === 'completed') {
    await env.DB.prepare("UPDATE passport_commitments SET status='completed',updated_at=? WHERE passport_id=? AND status IN ('promised','in_progress')").bind(timestamp, order.passport_id).run();
    const buyer = await env.DB.prepare('SELECT email FROM buyer_accounts WHERE id=?').bind(order.buyer_account_id).first();
    if (buyer) await award(env, order.buyer_account_id, order.organization_id, buyer.email, order, 'completed', 20, 20);
  } else if (order.passport_id && body.status === 'in_progress') {
    await env.DB.prepare("UPDATE passport_commitments SET status='in_progress',updated_at=? WHERE passport_id=? AND status='promised'").bind(timestamp, order.passport_id).run();
  }
  return json({ ok: true, status: body.status });
}

async function verifyStripeSignature(raw, signature, secret) {
  if (!signature || !secret) return false;
  const entries = Object.fromEntries(signature.split(',').map(part => part.split('=')));
  if (!entries.t || !entries.v1 || Math.abs(Date.now() / 1000 - Number(entries.t)) > 300) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${entries.t}.${raw}`));
  const expected = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (expected.length !== entries.v1.length) return false;
  let result = 0;
  for (let index = 0; index < expected.length; index += 1) result |= expected.charCodeAt(index) ^ entries.v1.charCodeAt(index);
  return result === 0;
}

async function stripeWebhook(request, env) {
  const raw = await request.text();
  if (!await verifyStripeSignature(raw, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET)) return json({ error: 'invalid_signature' }, 400);
  const event = JSON.parse(raw);
  const intent = event.data?.object;
  const orderId = intent?.metadata?.still_order_id;
  if (event.type === 'payment_intent.succeeded' && orderId) await activateOrder(env, orderId, intent.id);
  if (event.type === 'payment_intent.payment_failed' && orderId) await env.DB.prepare("UPDATE commerce_orders SET status='payment_failed',updated_at=? WHERE id=? AND status='awaiting_payment'").bind(now(), orderId).run();
  if (event.type === 'charge.refunded' && intent?.payment_intent) await env.DB.prepare("UPDATE commerce_orders SET status='refunded',updated_at=? WHERE provider_payment_id=?").bind(now(), intent.payment_intent).run();
  return json({ received: true });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const commerceRoute = path.startsWith('/api/v1/commerce/');
    const businessRoute = path.startsWith('/api/v1/business/commerce/');
    if (!commerceRoute && !businessRoute) return app.fetch(request, env);
    if (!env.DB) return json({ error: 'database_not_configured' }, 503);
    try {
      await ensureSchema(env);
      if (path === '/api/v1/commerce/offers' && request.method === 'GET') return publicOffers(request, env);
      if (path === '/api/v1/commerce/requests' && ['GET', 'POST'].includes(request.method)) return buyerRequests(request, env);
      let match = path.match(/^\/api\/v1\/commerce\/offers\/([^/]+)$/);
      if (match && request.method === 'GET') return publicOffer(request, env, decodeURIComponent(match[1]));
      match = path.match(/^\/api\/v1\/commerce\/requests\/([^/]+)$/);
      if (match && request.method === 'PATCH') return buyerRequestUpdate(request, env, decodeURIComponent(match[1]));
      match = path.match(/^\/api\/v1\/commerce\/requests\/([^/]+)\/quotes\/([^/]+)\/accept$/);
      if (match && request.method === 'POST') return acceptQuote(request, env, decodeURIComponent(match[1]), decodeURIComponent(match[2]));
      match = path.match(/^\/api\/v1\/commerce\/offers\/([^/]+)\/checkout$/);
      if (match && request.method === 'POST') return checkout(request, env, decodeURIComponent(match[1]));
      match = path.match(/^\/api\/v1\/commerce\/orders\/([^/]+)\/demo-complete$/);
      if (match && request.method === 'POST') return demoComplete(request, env, decodeURIComponent(match[1]));
      match = path.match(/^\/api\/v1\/commerce\/orders\/([^/]+)\/confirm$/);
      if (match && request.method === 'POST') return confirmStripeOrder(request, env, decodeURIComponent(match[1]));
      if (path === '/api/v1/commerce/orders' && request.method === 'GET') return buyerOrders(request, env);
      if (path === '/api/v1/commerce/webhooks/stripe' && request.method === 'POST') return stripeWebhook(request, env);
      if (path === '/api/v1/business/commerce/profile' && ['GET', 'PATCH'].includes(request.method)) return companyProfile(request, env);
      if (path === '/api/v1/business/commerce/onboarding' && request.method === 'POST') return companyOnboard(request, env);
      if (path === '/api/v1/business/commerce/offers' && ['GET', 'POST'].includes(request.method)) return companyOffers(request, env);
      if (path === '/api/v1/business/commerce/requests' && request.method === 'GET') return companyRequests(request, env);
      match = path.match(/^\/api\/v1\/business\/commerce\/requests\/([^/]+)\/quotes$/);
      if (match && request.method === 'POST') return companyQuote(request, env, decodeURIComponent(match[1]));
      match = path.match(/^\/api\/v1\/business\/commerce\/offers\/([^/]+)$/);
      if (match && request.method === 'PATCH') return companyOfferUpdate(request, env, decodeURIComponent(match[1]));
      if (path === '/api/v1/business/commerce/orders' && request.method === 'GET') return businessOrders(request, env);
      match = path.match(/^\/api\/v1\/business\/commerce\/orders\/([^/]+)$/);
      if (match && request.method === 'PATCH') return updateBusinessOrder(request, env, decodeURIComponent(match[1]));
      return json({ error: 'not_found' }, 404);
    } catch (error) {
      console.error('passport_commerce_error', error);
      return json({ error: error.message || 'internal_error' }, error.status && error.status >= 400 && error.status < 600 ? error.status : 500);
    }
  }
};
