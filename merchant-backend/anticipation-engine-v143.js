const SIGNAL_TYPES = new Set([
  'DATE_APPROACHING','DATE_PASSED','WARRANTY_EXPIRING','RETURN_WINDOW_CLOSING','SERVICE_DUE',
  'OPEN_LOOP_OVERDUE','WAITING_EXPECTATION_PASSED','ORDER_DELAYED','BOOKING_APPROACHING',
  'PROJECT_DEADLINE_APPROACHING','WANTED_MATCH_AVAILABLE','PRODUCT_NOTICE',
  'REPLACEMENT_INTERVAL_REACHED','PRICE_THRESHOLD','OTHER'
]);
const CONFIDENCE = new Set(['HIGH','MEDIUM','LOW']);
const DAY = 86400000;
const iso = (d = new Date()) => d.toISOString();
const uid = prefix => `${prefix}_${crypto.randomUUID()}`;
const parse = value => { try { return value ? JSON.parse(value) : {}; } catch { return {}; } };
const daysUntil = (date, now) => Math.ceil((new Date(date).getTime() - now.getTime()) / DAY);
const addDays = (value, days) => new Date(new Date(value).getTime() + Number(days || 0) * DAY).toISOString();
const validDate = value => value && !Number.isNaN(new Date(value).getTime());

function log(event, fields = {}) {
  console.log(JSON.stringify({ scope: 'still_anticipation', event, at: iso(), ...fields }));
}

async function safeAll(db, sql, bindings = []) {
  try {
    const result = await db.prepare(sql).bind(...bindings).all();
    return result.results || [];
  } catch (error) {
    log('anticipation_rule_failed', { reason: error?.message || 'query_failed' });
    return [];
  }
}

async function preference(db, ownerUserId, key, { critical = false } = {}) {
  if (critical) return true;
  const allowed = new Set(['warranty_enabled','returns_enabled','service_enabled','open_loops_enabled','market_wants_enabled','product_notices_enabled','user_schedules_enabled']);
  if (!allowed.has(key)) return false;
  const row = await db.prepare(`SELECT proactive_enabled,${key} value FROM anticipation_preferences WHERE owner_user_id=?`).bind(ownerUserId).first().catch(() => null);
  if (!row) return true;
  return Number(row.proactive_enabled) !== 0 && Number(row.value) !== 0;
}

export async function publishWorldEvent(db, event) {
  if (!event?.ownerUserId || !event?.eventType || !event?.sourceEntityType || !event?.sourceEntityId || !event?.idempotencyKey) throw new Error('INVALID_WORLD_EVENT');
  const observed = iso();
  const id = uid('wev');
  await db.prepare(`INSERT OR IGNORE INTO world_events(id,public_id,owner_user_id,event_type,source_entity_type,source_entity_id,occurred_at,payload_json,provenance_json,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,id,event.ownerUserId,event.eventType,event.sourceEntityType,event.sourceEntityId,event.occurredAt || observed,JSON.stringify(event.payload || {}),JSON.stringify(event.provenance || {}),event.idempotencyKey,observed).run();
  log('world_event_recorded', { ownerUserId: event.ownerUserId, eventType: event.eventType, sourceEntityType: event.sourceEntityType });
}

export async function upsertSignal(db, input) {
  if (!input?.ownerUserId || !input?.sourceEntityType || !input?.sourceEntityId || !input?.dedupeKey) throw new Error('INVALID_ANTICIPATION_SIGNAL');
  if (!SIGNAL_TYPES.has(input.signalType) || !CONFIDENCE.has(input.confidence)) throw new Error('INVALID_ANTICIPATION_SIGNAL');
  const observed = iso();
  const id = uid('sig');
  await db.prepare(`INSERT INTO anticipation_signals(id,public_id,owner_user_id,signal_type,source_entity_type,source_entity_id,observed_at,effective_at,expires_at,confidence,payload_json,source_json,dedupe_key,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?) ON CONFLICT(dedupe_key) DO UPDATE SET observed_at=excluded.observed_at,effective_at=excluded.effective_at,expires_at=excluded.expires_at,confidence=excluded.confidence,payload_json=excluded.payload_json,source_json=excluded.source_json,status='ACTIVE',updated_at=excluded.updated_at`)
    .bind(id,id,input.ownerUserId,input.signalType,input.sourceEntityType,input.sourceEntityId,observed,input.effectiveAt || null,input.expiresAt || null,input.confidence,JSON.stringify(input.payload || {}),JSON.stringify(input.source || {}),input.dedupeKey,observed,observed).run();
  const row = await db.prepare(`SELECT * FROM anticipation_signals WHERE dedupe_key=?`).bind(input.dedupeKey).first();
  if (row?.created_at === row?.updated_at) log('anticipation_signal_created', { ownerUserId: input.ownerUserId, signalType: input.signalType });
  return row;
}

export async function upsertCandidate(db, signal, candidate) {
  const existing = await db.prepare(`SELECT * FROM anticipation_candidates WHERE dedupe_key=?`).bind(candidate.dedupeKey).first();
  if (existing && ['DISMISSED','CONFIRMED'].includes(existing.status)) return existing;
  if (existing?.status === 'SNOOZED' && existing.snoozed_until && new Date(existing.snoozed_until) > new Date()) return existing;
  const observed = iso();
  const id = existing?.id || uid('cand');
  await db.prepare(`INSERT INTO anticipation_candidates(id,public_id,owner_user_id,candidate_type,title,explanation,why_now,confidence,status,proposed_need_type,proposed_need_payload_json,evidence_json,dedupe_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'PENDING',?,?,?,?,?,?) ON CONFLICT(dedupe_key) DO UPDATE SET title=excluded.title,explanation=excluded.explanation,why_now=excluded.why_now,confidence=excluded.confidence,evidence_json=excluded.evidence_json,updated_at=excluded.updated_at`)
    .bind(id,id,signal.owner_user_id,candidate.candidateType,candidate.title,candidate.explanation,candidate.whyNow,signal.confidence,candidate.proposedNeedType || null,JSON.stringify(candidate.proposedNeedPayload || {}),JSON.stringify(candidate.evidence || []),candidate.dedupeKey,observed,observed).run();
  const row = await db.prepare(`SELECT * FROM anticipation_candidates WHERE dedupe_key=?`).bind(candidate.dedupeKey).first();
  await db.prepare(`INSERT OR IGNORE INTO anticipation_candidate_signals(candidate_id,signal_id) VALUES(?,?)`).bind(row.id,signal.id).run();
  if (!existing) log('anticipation_candidate_created', { ownerUserId: signal.owner_user_id, candidateType: candidate.candidateType, confidence: signal.confidence });
  return row;
}

export async function upsertAttention(db, signal, item) {
  const observed = iso();
  const id = uid('attn');
  await db.prepare(`INSERT INTO attention_items(id,public_id,owner_user_id,attention_type,title,explanation,why_now,priority,source_entity_type,source_entity_id,evidence_json,effective_at,expires_at,status,dedupe_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?,?) ON CONFLICT(dedupe_key) DO UPDATE SET title=excluded.title,explanation=excluded.explanation,why_now=excluded.why_now,priority=excluded.priority,effective_at=excluded.effective_at,expires_at=excluded.expires_at,status='ACTIVE',updated_at=excluded.updated_at`)
    .bind(id,id,signal.owner_user_id,item.attentionType,item.title,item.explanation,item.whyNow,item.priority || 0,signal.source_entity_type,signal.source_entity_id,JSON.stringify(item.evidence || []),signal.effective_at,signal.expires_at,item.dedupeKey,observed,observed).run();
}

export async function evaluateSignal(db, signal) {
  const p = parse(signal.payload_json);
  const evidence = [{
    signalId: signal.public_id,
    sourceEntityType: signal.source_entity_type,
    sourceEntityId: signal.source_entity_id,
    source: parse(signal.source_json)
  }];

  if (signal.signal_type === 'WARRANTY_EXPIRING') {
    return upsertCandidate(db, signal, {
      candidateType: 'WARRANTY',
      title: `Jamstvo uskoro istječe${p.thingName ? ` · ${p.thingName}` : ''}`,
      explanation: 'Ovo možda treba tvoju pažnju prije isteka jamstva.',
      whyNow: p.daysLeft != null ? `Jamstvo istječe za ${p.daysLeft} dana.` : 'Datum isteka jamstva se približava.',
      proposedNeedType: 'FOLLOW_UP',
      proposedNeedPayload: { thingId: signal.source_entity_id, warrantyEnd: p.warrantyEnd || signal.effective_at },
      evidence,
      dedupeKey: `warranty:${signal.owner_user_id}:${signal.source_entity_id}:${p.warrantyEnd || signal.effective_at}`
    });
  }

  if (signal.signal_type === 'RETURN_WINDOW_CLOSING') {
    return upsertCandidate(db, signal, {
      candidateType: 'RETURN_WINDOW',
      title: p.thingName ? `Rok za povrat uskoro završava · ${p.thingName}` : 'Rok za povrat uskoro završava',
      explanation: 'Still je ovo izračunao iz stvarnog datuma kupnje i spremljene politike povrata.',
      whyNow: p.daysLeft != null ? `Rok za povrat završava za ${p.daysLeft} dana.` : 'Rok za povrat se približava.',
      proposedNeedType: 'DECIDE',
      proposedNeedPayload: { orderId: p.orderId || signal.source_entity_id, thingId: p.thingId || null, returnEnd: p.returnEnd || signal.effective_at },
      evidence,
      dedupeKey: `return:${signal.owner_user_id}:${signal.source_entity_id}:${p.returnEnd || signal.effective_at}`
    });
  }

  if (signal.signal_type === 'OPEN_LOOP_OVERDUE' || signal.signal_type === 'WAITING_EXPECTATION_PASSED') {
    return upsertCandidate(db, signal, {
      candidateType: 'WAITING',
      title: p.title || 'Ovo još čeka.',
      explanation: signal.signal_type === 'WAITING_EXPECTATION_PASSED' ? 'U Stillu nije zabilježen završetak ili odgovor.' : 'Rok koji si zabilježio je prošao.',
      whyNow: p.expectedAt ? `Očekivani datum bio je ${p.expectedAt}.` : 'Zabilježeni rok je prošao.',
      proposedNeedType: 'FOLLOW_UP',
      proposedNeedPayload: { openLoopId: signal.source_entity_id },
      evidence,
      dedupeKey: `waiting:${signal.owner_user_id}:${signal.source_entity_id}:${p.expectedAt || signal.effective_at}`
    });
  }

  if (signal.signal_type === 'REPLACEMENT_INTERVAL_REACHED' || signal.signal_type === 'SERVICE_DUE') {
    return upsertCandidate(db, signal, {
      candidateType: 'SERVICE_DUE',
      title: p.title || 'Možda je vrijeme za održavanje.',
      explanation: 'Ovo se temelji na stvarnom rasporedu koji je spremljen u Still.',
      whyNow: `Sljedeći spremljeni termin je ${p.dueAt || signal.effective_at}.`,
      proposedNeedType: 'SERVICE',
      proposedNeedPayload: { entityId: signal.source_entity_id, scheduleId: p.scheduleId },
      evidence,
      dedupeKey: `schedule:${signal.owner_user_id}:${p.scheduleId || signal.source_entity_id}:${p.dueAt || signal.effective_at}`
    });
  }

  if (['BOOKING_APPROACHING','PROJECT_DEADLINE_APPROACHING'].includes(signal.signal_type)) {
    return upsertAttention(db, signal, {
      attentionType: signal.signal_type,
      title: p.title || 'Uskoro',
      explanation: p.explanation || 'Ovo je već dogovoreno i ne stvara novu potrebu.',
      whyNow: p.whyNow || `Vrijeme: ${signal.effective_at}.`,
      priority: p.priority || 40,
      evidence,
      dedupeKey: `attention:${signal.owner_user_id}:${signal.signal_type}:${signal.source_entity_id}:${signal.effective_at}`
    });
  }

  if (signal.signal_type === 'ORDER_DELAYED') {
    return upsertAttention(db, signal, {
      attentionType: 'ORDER_DELAYED',
      title: p.title || 'Narudžba kasni',
      explanation: 'Procijenjeni rok isporuke spremljen uz ovu narudžbu je prošao, a isporuka još nije zabilježena.',
      whyNow: p.expectedBy ? `Procijenjeni krajnji rok bio je ${p.expectedBy}.` : 'Procijenjeni rok je prošao.',
      priority: 70,
      evidence,
      dedupeKey: `order-delay:${signal.owner_user_id}:${signal.source_entity_id}:${p.expectedBy || signal.effective_at}`
    });
  }

  if (signal.signal_type === 'WANTED_MATCH_AVAILABLE') {
    return upsertAttention(db, signal, {
      attentionType: 'WANTED_MATCH',
      title: 'Nešto što tražiš je dostupno.',
      explanation: 'Pronađeno je stvarno podudaranje s aktivnim Wanted zapisom.',
      whyNow: p.priceHit ? 'Novo podudaranje je dostupno i zadovoljava tvoju spremljenu cjenovnu granicu.' : 'Novo podudaranje je upravo postalo dostupno.',
      priority: 55,
      evidence,
      dedupeKey: `wanted:${signal.owner_user_id}:${signal.source_entity_id}:${p.matchId || signal.effective_at}`
    });
  }

  if (signal.signal_type === 'PRODUCT_NOTICE' && p.noticeType === 'SAFETY') {
    return upsertAttention(db, signal, {
      attentionType: 'SAFETY',
      title: p.title || 'Važna sigurnosna obavijest',
      explanation: p.explanation || 'Postoji službena sigurnosna obavijest za povezani proizvod.',
      whyNow: 'Sigurnosne obavijesti imaju prednost.',
      priority: 100,
      evidence,
      dedupeKey: `safety:${signal.owner_user_id}:${signal.source_entity_id}:${p.noticeId}`
    });
  }

  return null;
}

async function reconcileOpenLoops(db, now = new Date()) {
  const rows = await safeAll(db, `SELECT public_id,buyer_account_id,title,status,due_at,waiting_on FROM world_open_loops WHERE status IN ('OPEN','WAITING') AND due_at IS NOT NULL AND due_at<=?`, [iso(now)]);
  let count = 0;
  for (const row of rows) {
    if (!(await preference(db,row.buyer_account_id,'open_loops_enabled'))) continue;
    const waiting = row.status === 'WAITING';
    const signal = await upsertSignal(db, {
      ownerUserId: row.buyer_account_id,
      signalType: waiting ? 'WAITING_EXPECTATION_PASSED' : 'OPEN_LOOP_OVERDUE',
      sourceEntityType: 'OPEN_LOOP',
      sourceEntityId: row.public_id,
      effectiveAt: row.due_at,
      confidence: 'HIGH',
      payload: { title: row.title, expectedAt: row.due_at, waitingOn: row.waiting_on || null },
      source: { type: 'WORLD_OPEN_LOOP', dueAt: row.due_at },
      dedupeKey: `loop-signal:${row.buyer_account_id}:${row.public_id}:${row.due_at}`
    });
    await evaluateSignal(db, signal);
    count += 1;
  }
  try {
    await db.prepare(`UPDATE anticipation_signals SET status='EXPIRED',updated_at=? WHERE status='ACTIVE' AND signal_type IN ('OPEN_LOOP_OVERDUE','WAITING_EXPECTATION_PASSED') AND source_entity_type='OPEN_LOOP' AND NOT EXISTS (SELECT 1 FROM world_open_loops l WHERE l.buyer_account_id=anticipation_signals.owner_user_id AND l.public_id=anticipation_signals.source_entity_id AND l.status IN ('OPEN','WAITING'))`).bind(iso(now)).run();
    await db.prepare(`UPDATE anticipation_candidates SET status='EXPIRED',updated_at=? WHERE status IN ('PENDING','SNOOZED') AND EXISTS (SELECT 1 FROM anticipation_candidate_signals cs JOIN anticipation_signals s ON s.id=cs.signal_id WHERE cs.candidate_id=anticipation_candidates.id AND s.status='EXPIRED')`).bind(iso(now)).run();
  } catch (error) {
    log('anticipation_rule_failed', { rule: 'open_loop_cleanup', reason: error?.message || 'cleanup_failed' });
  }
  return count;
}

async function reconcileWarrantyAndReturns(db, now = new Date()) {
  const rows = await safeAll(db, `SELECT o.buyer_account_id,o.public_id order_public_id,o.confirmed_at,oi.thing_passport_id,p.public_id thing_public_id,p.title thing_title,wp.public_id warranty_policy_id,wp.duration_days warranty_days,rp.public_id return_policy_id,rp.duration_days return_days FROM company_network_orders o JOIN company_network_order_items oi ON oi.order_id=o.id JOIN company_network_offers f ON f.id=oi.offer_id LEFT JOIN company_network_policies wp ON wp.id=f.warranty_policy_id AND wp.active=1 LEFT JOIN company_network_policies rp ON rp.id=f.return_policy_id AND rp.active=1 LEFT JOIN ownership_passports p ON p.id=oi.thing_passport_id WHERE o.status IN ('CONFIRMED','FULFILLED') AND o.confirmed_at IS NOT NULL AND (wp.duration_days IS NOT NULL OR rp.duration_days IS NOT NULL)`);
  let count = 0;
  for (const row of rows) {
    if (row.warranty_days && row.thing_public_id && await preference(db,row.buyer_account_id,'warranty_enabled')) {
      const end = addDays(row.confirmed_at,row.warranty_days);
      const left = daysUntil(end,now);
      if (left >= 0 && left <= 30) {
        const signal = await upsertSignal(db, {
          ownerUserId: row.buyer_account_id,
          signalType: 'WARRANTY_EXPIRING',
          sourceEntityType: 'THING',
          sourceEntityId: row.thing_public_id,
          effectiveAt: end,
          confidence: 'HIGH',
          payload: { thingName: row.thing_title || null, warrantyEnd: end, daysLeft: left, orderId: row.order_public_id },
          source: { type: 'COMPANY_POLICY', policyId: row.warranty_policy_id, purchaseDate: row.confirmed_at },
          dedupeKey: `warranty-signal:${row.buyer_account_id}:${row.thing_public_id}:${end}`
        });
        await evaluateSignal(db, signal);
        count += 1;
      }
    }
    if (row.return_days && await preference(db,row.buyer_account_id,'returns_enabled')) {
      const end = addDays(row.confirmed_at,row.return_days);
      const left = daysUntil(end,now);
      if (left >= 0 && left <= 7) {
        const sourceId = row.thing_public_id || row.order_public_id;
        const signal = await upsertSignal(db, {
          ownerUserId: row.buyer_account_id,
          signalType: 'RETURN_WINDOW_CLOSING',
          sourceEntityType: row.thing_public_id ? 'THING' : 'ORDER',
          sourceEntityId: sourceId,
          effectiveAt: end,
          confidence: 'HIGH',
          payload: { thingName: row.thing_title || null, thingId: row.thing_public_id || null, orderId: row.order_public_id, returnEnd: end, daysLeft: left },
          source: { type: 'COMPANY_POLICY', policyId: row.return_policy_id, purchaseDate: row.confirmed_at },
          dedupeKey: `return-signal:${row.buyer_account_id}:${sourceId}:${end}`
        });
        await evaluateSignal(db, signal);
        count += 1;
      }
    }
  }
  return count;
}

async function reconcileBookings(db, now = new Date()) {
  const end = new Date(now.getTime() + DAY);
  const rows = await safeAll(db, `SELECT b.public_id,b.buyer_account_id,b.scheduled_start,b.scheduled_end,b.status,p.display_name provider_name,c.name capability_name FROM service_network_bookings b LEFT JOIN service_network_providers p ON p.id=b.provider_id LEFT JOIN service_network_capabilities c ON c.id=b.capability_id WHERE b.scheduled_start IS NOT NULL AND b.scheduled_start>=? AND b.scheduled_start<=? AND b.status NOT IN ('COMPLETED','CANCELLED','DECLINED','NO_SHOW')`, [iso(now),iso(end)]);
  let count = 0;
  for (const row of rows) {
    if (!(await preference(db,row.buyer_account_id,'service_enabled'))) continue;
    const signal = await upsertSignal(db, {
      ownerUserId: row.buyer_account_id,
      signalType: 'BOOKING_APPROACHING',
      sourceEntityType: 'BOOKING',
      sourceEntityId: row.public_id,
      effectiveAt: row.scheduled_start,
      expiresAt: row.scheduled_end || addDays(row.scheduled_start,1),
      confidence: 'HIGH',
      payload: {
        title: row.capability_name ? `${row.capability_name}${row.provider_name ? ` · ${row.provider_name}` : ''}` : 'Dogovorena usluga uskoro počinje',
        whyNow: `Termin počinje ${row.scheduled_start}.`,
        explanation: 'Ovo je postojeći termin, zato se prikazuje kao pažnja, a ne nova potreba.',
        priority: 65
      },
      source: { type: 'SERVICE_BOOKING' },
      dedupeKey: `booking-signal:${row.buyer_account_id}:${row.public_id}:${row.scheduled_start}`
    });
    await evaluateSignal(db, signal);
    count += 1;
  }
  return count;
}

async function reconcileProjects(db, now = new Date()) {
  const end = new Date(now.getTime() + 3 * DAY);
  const rows = await safeAll(db, `SELECT public_id,title,due_at,client_buyer_account_id,professional_buyer_account_id,status FROM professional_projects WHERE due_at IS NOT NULL AND due_at>=? AND due_at<=? AND status='ACTIVE'`, [iso(now),iso(end)]);
  let count = 0;
  for (const row of rows) {
    for (const owner of [...new Set([row.client_buyer_account_id,row.professional_buyer_account_id].filter(Boolean))]) {
      const signal = await upsertSignal(db, {
        ownerUserId: owner,
        signalType: 'PROJECT_DEADLINE_APPROACHING',
        sourceEntityType: 'PROJECT',
        sourceEntityId: row.public_id,
        effectiveAt: row.due_at,
        expiresAt: addDays(row.due_at,1),
        confidence: 'HIGH',
        payload: { title: row.title || 'Rok projekta se približava', whyNow: `Rok je ${row.due_at}.`, priority: 60 },
        source: { type: 'PROFESSIONAL_PROJECT' },
        dedupeKey: `project-signal:${owner}:${row.public_id}:${row.due_at}`
      });
      await evaluateSignal(db, signal);
      count += 1;
    }
  }
  return count;
}

async function reconcileWantedMatches(db) {
  const rows = await safeAll(db, `SELECT m.public_id match_id,m.updated_at,w.public_id wanted_public_id,w.buyer_account_id,w.max_price_cents,l.asking_price_cents,l.currency,l.public_id listing_public_id FROM market_matches m JOIN market_wanted w ON w.id=m.wanted_id JOIN market_listings l ON l.id=m.listing_id WHERE w.status='ACTIVE' AND l.status='ACTIVE'`);
  let count = 0;
  for (const row of rows) {
    if (!(await preference(db,row.buyer_account_id,'market_wants_enabled'))) continue;
    const priceHit = row.max_price_cents != null && row.asking_price_cents != null && Number(row.asking_price_cents) <= Number(row.max_price_cents);
    const signal = await upsertSignal(db, {
      ownerUserId: row.buyer_account_id,
      signalType: 'WANTED_MATCH_AVAILABLE',
      sourceEntityType: 'WANTED',
      sourceEntityId: row.wanted_public_id,
      effectiveAt: row.updated_at,
      confidence: 'HIGH',
      payload: { matchId: row.match_id, listingId: row.listing_public_id, priceHit, askingPriceCents: row.asking_price_cents, currency: row.currency },
      source: { type: 'MARKET_MATCH' },
      dedupeKey: `wanted-signal:${row.buyer_account_id}:${row.match_id}`
    });
    await evaluateSignal(db, signal);
    count += 1;
  }
  return count;
}

async function reconcileSafetyNotices(db) {
  const rows = await safeAll(db, `SELECT DISTINCT tp.buyer_account_id,n.public_id notice_id,n.title,n.body,n.published_at,tp.thing_passport_id,p.public_id thing_public_id FROM company_network_notices n JOIN company_network_thing_products tp ON tp.product_id=n.product_id AND tp.status='CONFIRMED' JOIN company_network_relationships r ON r.buyer_account_id=tp.buyer_account_id AND r.thing_passport_id=tp.thing_passport_id AND r.organization_id=n.organization_id AND r.revoked_at IS NULL LEFT JOIN ownership_passports p ON p.id=tp.thing_passport_id WHERE n.severity='SAFETY' AND n.published_at IS NOT NULL AND COALESCE(r.safety_notice_access,1)=1`);
  let count = 0;
  for (const row of rows) {
    const sourceId = row.thing_public_id || row.notice_id;
    const signal = await upsertSignal(db, {
      ownerUserId: row.buyer_account_id,
      signalType: 'PRODUCT_NOTICE',
      sourceEntityType: row.thing_public_id ? 'THING' : 'PRODUCT_NOTICE',
      sourceEntityId: sourceId,
      effectiveAt: row.published_at,
      confidence: 'HIGH',
      payload: { noticeType: 'SAFETY', noticeId: row.notice_id, title: row.title, explanation: row.body },
      source: { type: 'COMPANY_SAFETY_NOTICE', noticeId: row.notice_id },
      dedupeKey: `safety-signal:${row.buyer_account_id}:${row.notice_id}`
    });
    await evaluateSignal(db, signal);
    count += 1;
  }
  return count;
}

async function reconcileOrderDelays(db, now = new Date()) {
  const rows = await safeAll(db, `SELECT o.public_id,o.buyer_account_id,o.confirmed_at,o.fulfillment_status,MAX(f.estimated_delivery_max_days) max_days FROM company_network_orders o JOIN company_network_order_items oi ON oi.order_id=o.id JOIN company_network_offers f ON f.id=oi.offer_id WHERE o.confirmed_at IS NOT NULL AND o.status IN ('CONFIRMED','FULFILLED') AND COALESCE(o.fulfillment_status,'UNFULFILLED') NOT IN ('DELIVERED','PICKED_UP') AND f.estimated_delivery_max_days IS NOT NULL GROUP BY o.id`);
  let count = 0;
  for (const row of rows) {
    const expectedBy = addDays(row.confirmed_at,row.max_days);
    if (new Date(expectedBy) >= now) continue;
    const signal = await upsertSignal(db, {
      ownerUserId: row.buyer_account_id,
      signalType: 'ORDER_DELAYED',
      sourceEntityType: 'ORDER',
      sourceEntityId: row.public_id,
      effectiveAt: expectedBy,
      confidence: 'HIGH',
      payload: { title: 'Narudžba možda kasni', expectedBy },
      source: { type: 'ORDER_ESTIMATE', confirmedAt: row.confirmed_at, maxDeliveryDays: row.max_days },
      dedupeKey: `order-delay-signal:${row.buyer_account_id}:${row.public_id}:${expectedBy}`
    });
    await evaluateSignal(db, signal);
    count += 1;
  }
  return count;
}

export async function reconcileSchedules(db, now = new Date()) {
  const rows = await safeAll(db, `SELECT * FROM user_world_schedules WHERE active=1 AND next_due_at<=?`, [iso(now)]);
  let count = 0;
  for (const schedule of rows) {
    if (!(await preference(db,schedule.owner_user_id,'user_schedules_enabled')) || !(await preference(db,schedule.owner_user_id,'service_enabled'))) continue;
    const signal = await upsertSignal(db, {
      ownerUserId: schedule.owner_user_id,
      signalType: schedule.schedule_type === 'SERVICE' ? 'SERVICE_DUE' : 'REPLACEMENT_INTERVAL_REACHED',
      sourceEntityType: schedule.entity_type,
      sourceEntityId: schedule.entity_id,
      effectiveAt: schedule.next_due_at,
      confidence: 'HIGH',
      payload: { scheduleId: schedule.public_id, title: schedule.title, dueAt: schedule.next_due_at },
      source: { type: 'USER_SCHEDULE' },
      dedupeKey: `schedule-signal:${schedule.owner_user_id}:${schedule.id}:${schedule.next_due_at}`
    });
    await evaluateSignal(db, signal);
    count += 1;
  }
  return count;
}

export async function reconcileAll(db, now = new Date()) {
  const results = {};
  results.openLoops = await reconcileOpenLoops(db,now);
  results.lifecycle = await reconcileWarrantyAndReturns(db,now);
  results.bookings = await reconcileBookings(db,now);
  results.projects = await reconcileProjects(db,now);
  results.wanted = await reconcileWantedMatches(db);
  results.safety = await reconcileSafetyNotices(db);
  results.orders = await reconcileOrderDelays(db,now);
  results.schedules = await reconcileSchedules(db,now);
  log('anticipation_reconciliation_completed', results);
  return results;
}

export async function expireStale(db, now = new Date()) {
  const current = iso(now);
  await db.prepare(`UPDATE anticipation_signals SET status='EXPIRED',updated_at=? WHERE status='ACTIVE' AND expires_at IS NOT NULL AND expires_at<?`).bind(current,current).run();
  await db.prepare(`UPDATE attention_items SET status='EXPIRED',updated_at=? WHERE status='ACTIVE' AND expires_at IS NOT NULL AND expires_at<?`).bind(current,current).run();
  await db.prepare(`UPDATE anticipation_candidates SET status='PENDING',snoozed_until=NULL,updated_at=? WHERE status='SNOOZED' AND snoozed_until<=?`).bind(current,current).run();
}

export function advanceScheduleDate(schedule) {
  const date = new Date(schedule.next_due_at);
  const amount = Number(schedule.interval_value);
  if (schedule.interval_unit === 'DAYS') date.setUTCDate(date.getUTCDate() + amount);
  else if (schedule.interval_unit === 'WEEKS') date.setUTCDate(date.getUTCDate() + 7 * amount);
  else if (schedule.interval_unit === 'MONTHS') date.setUTCMonth(date.getUTCMonth() + amount);
  else if (schedule.interval_unit === 'YEARS') date.setUTCFullYear(date.getUTCFullYear() + amount);
  else throw new Error('INVALID_INTERVAL_UNIT');
  return iso(date);
}

export function warrantyRule({ ownerUserId, thingId, thingName, warrantyEnd, source }, now = new Date(), leadDays = 30) {
  if (!warrantyEnd || !validDate(warrantyEnd)) return null;
  const left = daysUntil(warrantyEnd,now);
  if (left < 0 || left > leadDays) return null;
  return {
    ownerUserId,
    signalType: 'WARRANTY_EXPIRING',
    sourceEntityType: 'THING',
    sourceEntityId: thingId,
    effectiveAt: warrantyEnd,
    confidence: 'HIGH',
    payload: { thingName, warrantyEnd, daysLeft: left },
    source,
    dedupeKey: `warranty-signal:${ownerUserId}:${thingId}:${warrantyEnd}`
  };
}
