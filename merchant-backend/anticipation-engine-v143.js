const SIGNAL_TYPES = new Set(['DATE_APPROACHING','DATE_PASSED','WARRANTY_EXPIRING','RETURN_WINDOW_CLOSING','SERVICE_DUE','OPEN_LOOP_OVERDUE','WAITING_EXPECTATION_PASSED','ORDER_DELAYED','BOOKING_APPROACHING','PROJECT_DEADLINE_APPROACHING','WANTED_MATCH_AVAILABLE','PRODUCT_NOTICE','REPLACEMENT_INTERVAL_REACHED','PRICE_THRESHOLD','OTHER']);
const CONFIDENCE = new Set(['HIGH','MEDIUM','LOW']);
const DAY = 86400000;
const iso = (d = new Date()) => d.toISOString();
const uid = (prefix) => `${prefix}_${crypto.randomUUID()}`;
const parse = (v) => { try { return v ? JSON.parse(v) : {}; } catch { return {}; } };
const daysUntil = (date, now) => Math.ceil((new Date(date).getTime() - now.getTime()) / DAY);

export async function publishWorldEvent(db, event) {
  if (!event?.ownerUserId || !event?.eventType || !event?.sourceEntityType || !event?.sourceEntityId || !event?.idempotencyKey) throw new Error('INVALID_WORLD_EVENT');
  const now = iso();
  const id = uid('wev');
  await db.prepare(`INSERT OR IGNORE INTO world_events(id,public_id,owner_user_id,event_type,source_entity_type,source_entity_id,occurred_at,payload_json,provenance_json,idempotency_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id,id,event.ownerUserId,event.eventType,event.sourceEntityType,event.sourceEntityId,event.occurredAt || now,JSON.stringify(event.payload || {}),JSON.stringify(event.provenance || {}),event.idempotencyKey,now).run();
}

export async function upsertSignal(db, input) {
  if (!SIGNAL_TYPES.has(input.signalType) || !CONFIDENCE.has(input.confidence)) throw new Error('INVALID_ANTICIPATION_SIGNAL');
  const now = iso(); const id = uid('sig');
  await db.prepare(`INSERT INTO anticipation_signals(id,public_id,owner_user_id,signal_type,source_entity_type,source_entity_id,observed_at,effective_at,expires_at,confidence,payload_json,source_json,dedupe_key,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?) ON CONFLICT(dedupe_key) DO UPDATE SET observed_at=excluded.observed_at,effective_at=excluded.effective_at,expires_at=excluded.expires_at,confidence=excluded.confidence,payload_json=excluded.payload_json,source_json=excluded.source_json,status='ACTIVE',updated_at=excluded.updated_at`)
    .bind(id,id,input.ownerUserId,input.signalType,input.sourceEntityType,input.sourceEntityId,now,input.effectiveAt || null,input.expiresAt || null,input.confidence,JSON.stringify(input.payload || {}),JSON.stringify(input.source || {}),input.dedupeKey,now,now).run();
  return db.prepare(`SELECT * FROM anticipation_signals WHERE dedupe_key=?`).bind(input.dedupeKey).first();
}

export async function upsertCandidate(db, signal, candidate) {
  const existing = await db.prepare(`SELECT * FROM anticipation_candidates WHERE dedupe_key=?`).bind(candidate.dedupeKey).first();
  if (existing && ['DISMISSED','CONFIRMED'].includes(existing.status)) return existing;
  if (existing?.status === 'SNOOZED' && existing.snoozed_until && new Date(existing.snoozed_until) > new Date()) return existing;
  const now = iso(); const id = existing?.id || uid('cand');
  await db.prepare(`INSERT INTO anticipation_candidates(id,public_id,owner_user_id,candidate_type,title,explanation,why_now,confidence,status,proposed_need_type,proposed_need_payload_json,evidence_json,dedupe_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'PENDING',?,?,?,?,?,?) ON CONFLICT(dedupe_key) DO UPDATE SET title=excluded.title,explanation=excluded.explanation,why_now=excluded.why_now,confidence=excluded.confidence,evidence_json=excluded.evidence_json,updated_at=excluded.updated_at`)
    .bind(id,id,signal.owner_user_id,candidate.candidateType,candidate.title,candidate.explanation,candidate.whyNow,signal.confidence,candidate.proposedNeedType || null,JSON.stringify(candidate.proposedNeedPayload || {}),JSON.stringify(candidate.evidence || []),candidate.dedupeKey,now,now).run();
  const row = await db.prepare(`SELECT * FROM anticipation_candidates WHERE dedupe_key=?`).bind(candidate.dedupeKey).first();
  await db.prepare(`INSERT OR IGNORE INTO anticipation_candidate_signals(candidate_id,signal_id) VALUES(?,?)`).bind(row.id,signal.id).run();
  return row;
}

export async function upsertAttention(db, signal, item) {
  const now=iso(); const id=uid('attn');
  await db.prepare(`INSERT INTO attention_items(id,public_id,owner_user_id,attention_type,title,explanation,why_now,priority,source_entity_type,source_entity_id,evidence_json,effective_at,expires_at,status,dedupe_key,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,'ACTIVE',?,?,?) ON CONFLICT(dedupe_key) DO UPDATE SET title=excluded.title,explanation=excluded.explanation,why_now=excluded.why_now,priority=excluded.priority,effective_at=excluded.effective_at,expires_at=excluded.expires_at,status='ACTIVE',updated_at=excluded.updated_at`)
    .bind(id,id,signal.owner_user_id,item.attentionType,item.title,item.explanation,item.whyNow,item.priority || 0,signal.source_entity_type,signal.source_entity_id,JSON.stringify(item.evidence || []),signal.effective_at,signal.expires_at,item.dedupeKey,now,now).run();
}

export async function evaluateSignal(db, signal) {
  const p=parse(signal.payload_json); const evidence=[{signalId:signal.public_id,sourceEntityType:signal.source_entity_type,sourceEntityId:signal.source_entity_id,source:parse(signal.source_json)}];
  if (signal.signal_type === 'WARRANTY_EXPIRING') return upsertCandidate(db,signal,{candidateType:'WARRANTY',title:`Jamstvo uskoro istječe${p.thingName ? ` · ${p.thingName}`:''}`,explanation:'Ovo možda treba tvoju pažnju prije isteka jamstva.',whyNow:p.daysLeft != null ? `Jamstvo istječe za ${p.daysLeft} dana.` : 'Datum isteka jamstva se približava.',proposedNeedType:'WARRANTY',proposedNeedPayload:{thingId:signal.source_entity_id},evidence,dedupeKey:`warranty:${signal.owner_user_id}:${signal.source_entity_id}:${p.warrantyEnd || signal.effective_at}`});
  if (signal.signal_type === 'OPEN_LOOP_OVERDUE' || signal.signal_type === 'WAITING_EXPECTATION_PASSED') return upsertCandidate(db,signal,{candidateType:'WAITING',title:p.title || 'Ovo još čeka.',explanation:signal.signal_type === 'WAITING_EXPECTATION_PASSED' ? 'U Stillu nije zabilježen završetak ili odgovor.' : 'Rok koji si zabilježio je prošao.',whyNow:p.expectedAt ? `Očekivani datum bio je ${p.expectedAt}.` : 'Zabilježeni rok je prošao.',proposedNeedType:'FOLLOW_UP',proposedNeedPayload:{openLoopId:signal.source_entity_id},evidence,dedupeKey:`waiting:${signal.owner_user_id}:${signal.source_entity_id}:${p.expectedAt || signal.effective_at}`});
  if (signal.signal_type === 'REPLACEMENT_INTERVAL_REACHED' || signal.signal_type === 'SERVICE_DUE') return upsertCandidate(db,signal,{candidateType:'SERVICE_DUE',title:p.title || 'Možda je vrijeme za održavanje.',explanation:'Ovo se temelji na stvarnom rasporedu koji je spremljen u Still.',whyNow:`Sljedeći spremljeni termin je ${p.dueAt || signal.effective_at}.`,proposedNeedType:'SERVICE',proposedNeedPayload:{entityId:signal.source_entity_id,scheduleId:p.scheduleId},evidence,dedupeKey:`schedule:${signal.owner_user_id}:${p.scheduleId || signal.source_entity_id}:${p.dueAt || signal.effective_at}`});
  if (['BOOKING_APPROACHING','PROJECT_DEADLINE_APPROACHING'].includes(signal.signal_type)) return upsertAttention(db,signal,{attentionType:signal.signal_type,title:p.title || 'Uskoro',explanation:p.explanation || 'Ovo je već dogovoreno i ne stvara novu potrebu.',whyNow:p.whyNow || `Vrijeme: ${signal.effective_at}.`,priority:p.priority || 40,evidence,dedupeKey:`attention:${signal.owner_user_id}:${signal.signal_type}:${signal.source_entity_id}:${signal.effective_at}`});
  if (signal.signal_type === 'WANTED_MATCH_AVAILABLE') return upsertAttention(db,signal,{attentionType:'WANTED_MATCH',title:'Nešto što tražiš je dostupno.',explanation:'Pronađeno je stvarno podudaranje s aktivnim Wanted zapisom.',whyNow:'Novo podudaranje je upravo postalo dostupno.',priority:55,evidence,dedupeKey:`wanted:${signal.owner_user_id}:${signal.source_entity_id}:${p.matchId || signal.effective_at}`});
  if (signal.signal_type === 'PRODUCT_NOTICE' && p.noticeType === 'SAFETY') return upsertAttention(db,signal,{attentionType:'SAFETY',title:p.title || 'Važna sigurnosna obavijest',explanation:p.explanation || 'Postoji službena sigurnosna obavijest za povezani proizvod.',whyNow:'Sigurnosne obavijesti imaju prednost.',priority:100,evidence,dedupeKey:`safety:${signal.owner_user_id}:${signal.source_entity_id}:${p.noticeId}`});
  return null;
}

export async function reconcileSchedules(db, now = new Date()) {
  const {results=[]}=await db.prepare(`SELECT * FROM user_world_schedules WHERE active=1 AND next_due_at<=?`).bind(iso(now)).all();
  for (const s of results) { const sig=await upsertSignal(db,{ownerUserId:s.owner_user_id,signalType:'REPLACEMENT_INTERVAL_REACHED',sourceEntityType:s.entity_type,sourceEntityId:s.entity_id,effectiveAt:s.next_due_at,confidence:'HIGH',payload:{scheduleId:s.public_id,title:s.title,dueAt:s.next_due_at},source:{type:'USER_SCHEDULE'},dedupeKey:`schedule-signal:${s.owner_user_id}:${s.id}:${s.next_due_at}`}); await evaluateSignal(db,sig); }
  return results.length;
}

export async function expireStale(db, now = new Date()) {
  const t=iso(now); await db.prepare(`UPDATE anticipation_signals SET status='EXPIRED',updated_at=? WHERE status='ACTIVE' AND expires_at IS NOT NULL AND expires_at<?`).bind(t,t).run();
  await db.prepare(`UPDATE attention_items SET status='EXPIRED',updated_at=? WHERE status='ACTIVE' AND expires_at IS NOT NULL AND expires_at<?`).bind(t,t).run();
  await db.prepare(`UPDATE anticipation_candidates SET status='PENDING',snoozed_until=NULL,updated_at=? WHERE status='SNOOZED' AND snoozed_until<=?`).bind(t,t).run();
}

export function advanceScheduleDate(schedule) {
  const d=new Date(schedule.next_due_at); const n=Number(schedule.interval_value);
  if (schedule.interval_unit==='DAYS') d.setUTCDate(d.getUTCDate()+n); else if(schedule.interval_unit==='WEEKS') d.setUTCDate(d.getUTCDate()+7*n); else if(schedule.interval_unit==='MONTHS') d.setUTCMonth(d.getUTCMonth()+n); else if(schedule.interval_unit==='YEARS') d.setUTCFullYear(d.getUTCFullYear()+n); else throw new Error('INVALID_INTERVAL_UNIT');
  return iso(d);
}

export function warrantyRule({ownerUserId,thingId,thingName,warrantyEnd,source}, now=new Date(), leadDays=30) {
  if (!warrantyEnd) return null; const left=daysUntil(warrantyEnd,now); if(left<0 || left>leadDays) return null;
  return {ownerUserId,signalType:'WARRANTY_EXPIRING',sourceEntityType:'THING',sourceEntityId:thingId,effectiveAt:warrantyEnd,confidence:'HIGH',payload:{thingName,warrantyEnd,daysLeft:left},source,dedupeKey:`warranty-signal:${ownerUserId}:${thingId}:${warrantyEnd}`};
}
