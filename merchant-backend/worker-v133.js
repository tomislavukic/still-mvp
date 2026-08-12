import app from './worker-v131.js';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
};
const CONTEXT_TYPES = new Set(['thing', 'situation', 'knowledge', 'receipt', 'open_loop']);
const INPUT_TYPES = new Set(['thing', 'situation', 'knowledge', 'open_loop']);
const nowIso = () => new Date().toISOString();
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { ...JSON_HEADERS, ...headers } });
const clean = (value, max = 5000) => String(value ?? '').replace(/\0/g, '').trim().slice(0, max);
const safeJson = (value, fallback = {}) => { try { return JSON.parse(value || ''); } catch { return fallback; } };

function log(event, fields = {}) {
  console.log(JSON.stringify({ scope: 'still_os', event, at: nowIso(), ...fields }));
}

async function sha(value) {
  const bytes = new TextEncoder().encode(String(value));
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

async function buyerSession(request, env) {
  const token = cookie(request, 'still_buyer');
  if (!token || !env.DB) return null;
  return env.DB.prepare(`SELECT a.id buyer_account_id,a.email,a.name
    FROM buyer_sessions s JOIN buyer_accounts a ON a.id=s.buyer_account_id
    WHERE s.token_hash=? AND s.expires_at>? AND a.status='active'`)
    .bind(await sha(token), nowIso()).first();
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}

function delegatedRequest(request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  url.search = '';
  return new Request(url, { method: 'GET', headers: request.headers });
}

async function delegatedJson(request, env, ctx, pathname) {
  const response = await app.fetch(delegatedRequest(request, pathname), env, ctx);
  const data = await response.clone().json().catch(() => null);
  return { response, data };
}

function publicAttentionItem(item) {
  const type = item.kind === 'thing_deadline' ? 'thing' : item.kind;
  return {
    id: item.entityId || item.publicId,
    type,
    title: item.title,
    status: item.status,
    dueAt: item.dueAt || null,
    waitingOn: item.waitingOn || null,
    situationId: item.situationId || null,
    thingId: item.thingId || null,
    overdue: Boolean(item.overdue),
    dueSoon: Boolean(item.dueSoon),
    priority: Number(item.priority ?? 9)
  };
}

async function phase2Now(request, env, ctx) {
  const started = Date.now();
  const base = await app.fetch(request, env, ctx);
  if (!base.ok) {
    log('now_load_failure', { status: base.status, durationMs: Date.now() - started });
    return base;
  }
  const payload = await base.json();
  const buyer = await buyerSession(request, env);
  const attentionItems = (payload.attention || []).map(publicAttentionItem);
  const dominant = attentionItems.find(item => item.overdue || item.dueSoon || item.status === 'WAITING' || item.type === 'situation') || null;
  const recentItems = (payload.recent || []).slice(0, 8).map(item => ({
    id: item.entity_public_id || item.public_id,
    historyId: item.public_id,
    type: clean(item.entity_type, 30),
    eventType: clean(item.event_type, 80),
    title: clean(item.title, 180),
    occurredAt: item.occurred_at
  }));
  return json({
    generatedAt: payload.generatedAt || nowIso(),
    method: 'deterministic_priority',
    owner: { name: buyer?.name || null },
    dominantContext: dominant,
    attentionCount: attentionItems.length,
    attentionItems: attentionItems.slice(0, 12),
    recentItems,
    quietState: attentionItems.length === 0
  });
}

function normalizedType(value) {
  return clean(value, 30).toLocaleLowerCase().replaceAll('-', '_');
}

function endpointFor(type, id) {
  const safeId = encodeURIComponent(id);
  if (type === 'thing') return `/api/v1/world/things/${safeId}`;
  if (type === 'situation') return `/api/v1/world/situations/${safeId}`;
  if (type === 'receipt') return `/api/v1/world/receipts/${safeId}`;
  if (type === 'open_loop') return `/api/v1/world/open-loops/${safeId}`;
  return null;
}

function relationTarget(relation, type, id) {
  if (relation.from_type === type && relation.from_public_id === id) return { type: normalizedType(relation.to_type), id: relation.to_public_id };
  return { type: normalizedType(relation.from_type), id: relation.from_public_id };
}

async function selectRelated(env, buyerId, type, ids) {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 60);
  if (!unique.length) return [];
  const placeholders = unique.map(() => '?').join(',');
  let sql;
  if (type === 'thing') sql = `SELECT public_id,title,kind subtype,status,updated_at FROM ownership_passports WHERE buyer_account_id=? AND status<>'archived' AND public_id IN (${placeholders})`;
  if (type === 'knowledge') sql = `SELECT public_id,title,kind subtype,status,updated_at FROM world_knowledge_items WHERE buyer_account_id=? AND status='ACTIVE' AND public_id IN (${placeholders})`;
  if (type === 'situation') sql = `SELECT public_id,title,status subtype,status,updated_at FROM world_situations WHERE buyer_account_id=? AND archived_at IS NULL AND public_id IN (${placeholders})`;
  if (type === 'document') sql = `SELECT public_id,title,document_type subtype,processing_status status,updated_at FROM world_documents WHERE buyer_account_id=? AND archived_at IS NULL AND public_id IN (${placeholders})`;
  if (type === 'receipt') sql = `SELECT public_id,COALESCE(merchant,'Receipt') title,processing_status subtype,processing_status status,updated_at FROM world_receipts WHERE buyer_account_id=? AND archived_at IS NULL AND public_id IN (${placeholders})`;
  if (!sql) return [];
  const result = await env.DB.prepare(sql).bind(buyerId, ...unique).all();
  return (result.results || []).map(row => ({ publicId: row.public_id, title: row.title, subtype: row.subtype, status: row.status, updatedAt: row.updated_at }));
}

async function knowledgeDetail(env, buyer, id) {
  const row = await env.DB.prepare(`SELECT k.*,d.public_id source_document_public_id,p.public_id thing_public_id,s.public_id situation_public_id
    FROM world_knowledge_items k
    LEFT JOIN world_documents d ON d.id=k.source_document_id
    LEFT JOIN ownership_passports p ON p.id=k.thing_passport_id
    LEFT JOIN world_situations s ON s.id=k.situation_id
    WHERE k.buyer_account_id=? AND k.public_id=? AND k.status='ACTIVE'`).bind(buyer.buyer_account_id, id).first();
  if (!row) return null;
  return {
    publicId: row.public_id,
    title: row.title,
    kind: row.kind,
    body: row.body,
    sourceType: row.source_type,
    sourceUrl: row.source_url || null,
    tags: safeJson(row.tags_json, []),
    sourceDocumentId: row.source_document_public_id || null,
    thingId: row.thing_public_id || null,
    situationId: row.situation_public_id || null,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function phase2Context(request, env, ctx, typeValue, idValue) {
  const started = Date.now(), type = normalizedType(typeValue), id = clean(idValue, 80);
  if (!CONTEXT_TYPES.has(type) || !id) return json({ error: 'invalid_context' }, 422);
  const buyer = await buyerSession(request, env);
  if (!buyer) {
    log('unauthorized_context', { type, idLength: id.length });
    return json({ error: 'unauthorized' }, 401);
  }
  let detail = null;
  if (type === 'knowledge') {
    const ensured = await delegatedJson(request, env, ctx, '/api/v1/world/history');
    if (!ensured.response.ok) return ensured.response;
    const entity = await knowledgeDetail(env, buyer, id);
    if (!entity) return json({ error: 'not_found' }, 404);
    detail = { knowledge: entity, history: [] };
  } else {
    const delegated = await delegatedJson(request, env, ctx, endpointFor(type, id));
    if (!delegated.response.ok) return delegated.response;
    detail = delegated.data;
  }
  const entity = detail[type === 'open_loop' ? 'openLoop' : type] || detail.entity;
  if (!entity) return json({ error: 'not_found' }, 404);
  const relationshipResult = await env.DB.prepare(`SELECT * FROM world_relationships WHERE buyer_account_id=? AND ((from_type=? AND from_public_id=?) OR (to_type=? AND to_public_id=?)) ORDER BY created_at DESC LIMIT 120`)
    .bind(buyer.buyer_account_id, type, id, type, id).all();
  const relationships = relationshipResult.results || detail.relationships || [];
  const targets = relationships.map(relation => relationTarget(relation, type, id));
  if (entity.thingId) targets.push({ type: 'thing', id: entity.thingId });
  if (entity.situationId) targets.push({ type: 'situation', id: entity.situationId });
  if (entity.sourceDocumentId) targets.push({ type: 'document', id: entity.sourceDocumentId });
  const byType = typeName => targets.filter(target => target.type === typeName).map(target => target.id);
  const [things, knowledge, situations, documents, receipts, historyResult, thingLoops] = await Promise.all([
    selectRelated(env, buyer.buyer_account_id, 'thing', byType('thing')),
    selectRelated(env, buyer.buyer_account_id, 'knowledge', byType('knowledge')),
    selectRelated(env, buyer.buyer_account_id, 'situation', byType('situation')),
    selectRelated(env, buyer.buyer_account_id, 'document', byType('document')),
    selectRelated(env, buyer.buyer_account_id, 'receipt', byType('receipt')),
    env.DB.prepare(`SELECT public_id,event_type,title,details_json,source_type,source_public_id,occurred_at FROM world_history_events WHERE buyer_account_id=? AND entity_type=? AND entity_public_id=? ORDER BY occurred_at DESC LIMIT 80`).bind(buyer.buyer_account_id, type, id).all(),
    type === 'thing' ? env.DB.prepare(`SELECT l.public_id,l.title,l.loop_type,l.status,l.waiting_on,l.due_at,l.notes,l.completed_at,l.created_at,l.updated_at,s.public_id situation_public_id
      FROM world_open_loops l JOIN ownership_passports p ON p.id=l.thing_passport_id
      LEFT JOIN world_situations s ON s.id=l.situation_id
      WHERE l.buyer_account_id=? AND p.public_id=? ORDER BY l.completed_at IS NOT NULL,l.due_at IS NULL,l.due_at,l.updated_at DESC LIMIT 100`).bind(buyer.buyer_account_id, id).all() : Promise.resolve({ results: [] })
  ]);
  const openLoops = detail.loops || (thingLoops.results || []).map(row => ({
    publicId: row.public_id, situationId: row.situation_public_id || null, thingId: type === 'thing' ? id : null,
    title: row.title, type: row.loop_type, status: row.status, waitingOn: row.waiting_on || null,
    dueAt: row.due_at || null, notes: row.notes || null, completedAt: row.completed_at || null,
    createdAt: row.created_at, updatedAt: row.updated_at
  }));
  const contextualKnowledge = [...(type === 'knowledge' ? [] : detail.knowledge || []), ...knowledge].filter((item, index, all) => all.findIndex(other => (other.publicId || other.public_id) === (item.publicId || item.public_id)) === index);
  log('workspace_context_loaded', { buyerId: buyer.buyer_account_id, type, relationshipCount: relationships.length, durationMs: Date.now() - started });
  return json({
    entityType: type,
    entity,
    passport: detail.passport || null,
    evidence: detail.evidence || [],
    relationships: relationships.map(row => ({
      publicId: row.public_id, fromType: row.from_type, fromId: row.from_public_id,
      toType: row.to_type, toId: row.to_public_id, relationship: row.relationship, createdAt: row.created_at
    })),
    openLoops,
    history: (detail.history || historyResult.results || []).map(row => ({
      publicId: row.publicId || row.public_id, eventType: row.eventType || row.event_type,
      title: row.title, details: row.details || safeJson(row.details_json), occurredAt: row.occurredAt || row.occurred_at
    })),
    knowledge: contextualKnowledge,
    things,
    situations,
    documents,
    receipts,
    receipt: detail.receipt || null
  });
}

function classifyInput(content) {
  const text = clean(content, 50000), normalized = text.toLocaleLowerCase();
  const rules = [
    { type: 'situation', confidence: 0.9, pattern: /\b(need to|needs? repair|broken|damaged|problem|issue|trebam|moram|pokvar|poprav|oštećen|problem)\b/u },
    { type: 'open_loop', confidence: 0.88, pattern: /\b(remind me|waiting for|will answer|follow up|podsjeti|čekam|odgovorit|javit će|rok)\b/u },
    { type: 'knowledge', confidence: 0.84, pattern: /\b(save this|remember this|article|note|spremi ovo|zapamti ovo|članak|bilješka)\b/u },
    { type: 'thing', confidence: 0.8, pattern: /\b(add my|add a|this is my|dodaj moj|dodaj moju|dodaj novu|dodaj novi)\b/u }
  ];
  const match = rules.find(rule => rule.pattern.test(normalized));
  return match || { type: null, confidence: 0.25 };
}

async function routeInput(request, env) {
  const buyer = await buyerSession(request, env);
  if (!buyer) return json({ error: 'unauthorized' }, 401);
  if (!sameOrigin(request)) return json({ error: 'origin_not_allowed' }, 403);
  const body = await request.json().catch(() => null);
  const content = clean(body?.content, 50000), requestedType = normalizedType(body?.requestedType);
  if (content.length < 2) return json({ error: 'content_required' }, 422);
  const classification = INPUT_TYPES.has(requestedType) ? { type: requestedType, confidence: 1 } : classifyInput(content);
  const needsConfirmation = !classification.type || classification.confidence < 0.85 || !INPUT_TYPES.has(requestedType);
  log('universal_input_routed', { buyerId: buyer.buyer_account_id, type: classification.type || 'uncertain', confidence: classification.confidence, contentLength: content.length, needsConfirmation });
  return json({
    route: classification.type,
    confidence: classification.confidence,
    needsConfirmation,
    allowedRoutes: [...INPUT_TYPES],
    method: requestedType ? 'explicit_user_choice' : 'deterministic_language_rules',
    persisted: false
  });
}

async function serveStillOS(request, env) {
  const buyer = await buyerSession(request, env);
  if (!buyer) {
    const requested = new URL(request.url);
    const signIn = new URL('/', requested.origin);
    signIn.searchParams.set('signin', '1');
    signIn.searchParams.set('returnTo', `${requested.pathname}${requested.search}`);
    return Response.redirect(signIn, 302);
  }
  if (!env.ASSETS) return new Response('Still OS assets are unavailable.', { status: 503 });
  const assetUrl = new URL('/app.html', request.url);
  const response = await env.ASSETS.fetch(new Request(assetUrl, { method: request.method, headers: request.headers }));
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'private, no-cache');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url), path = url.pathname;
    if ((path === '/app' || path.startsWith('/app/')) && ['GET', 'HEAD'].includes(request.method)) return serveStillOS(request, env);
    if (path === '/api/v1/world/now' && request.method === 'GET') return phase2Now(request, env, ctx);
    const contextMatch = path.match(/^\/api\/v1\/world\/context\/([^/]+)\/([^/]+)$/);
    if (contextMatch && request.method === 'GET') {
      try { return await phase2Context(request, env, ctx, decodeURIComponent(contextMatch[1]), decodeURIComponent(contextMatch[2])); }
      catch (error) {
        log('workspace_context_failure', { type: clean(contextMatch[1], 30), category: clean(error?.name || 'error', 80), message: clean(error?.message, 180) });
        return json({ error: 'context_unavailable' }, 500);
      }
    }
    if (path === '/api/v1/world/input/route' && request.method === 'POST') return routeInput(request, env);
    return app.fetch(request, env, ctx);
  }
};
