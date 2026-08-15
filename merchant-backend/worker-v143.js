import app from './worker-v142.js';
import {reconcileAll,expireStale,advanceScheduleDate} from './anticipation-engine-v143.js';

const H={'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','x-content-type-options':'nosniff'};
const json=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:H});
const now=()=>new Date().toISOString();
const clean=(v,n=1000)=>String(v??'').replace(/\0/g,'').trim().slice(0,n);
const normalized=v=>clean(v,180).toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const uid=p=>`${p}${crypto.randomUUID().replaceAll('-','')}`;
const publicId=p=>`${p}-${crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase()}`;
const safeJson=(v,f={})=>{try{return JSON.parse(v||'')}catch{return f}};

function log(event,fields={}){console.log(JSON.stringify({scope:'still_anticipation',event,at:now(),...fields}))}
function cookie(r,n){for(const p of(r.headers.get('cookie')||'').split(';')){const[k,...v]=p.trim().split('=');if(k===n)return decodeURIComponent(v.join('='))}return''}
async function sha(v){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(v)));return[...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function buyer(r,e){const t=cookie(r,'still_buyer');if(!t)return null;return e.DB.prepare(`SELECT a.id owner_user_id FROM buyer_sessions s JOIN buyer_accounts a ON a.id=s.buyer_account_id WHERE s.token_hash=? AND s.expires_at>? AND a.status='active'`).bind(await sha(t),now()).first()}
async function body(r){return r.json().catch(()=>({}))}
async function candidate(e,owner,id){return e.DB.prepare(`SELECT * FROM anticipation_candidates WHERE public_id=? AND owner_user_id=?`).bind(id,owner).first()}
async function feedback(e,owner,candidateId,action,reason=null){await e.DB.prepare(`INSERT INTO anticipation_feedback(id,owner_user_id,candidate_id,action,reason,created_at) VALUES(?,?,?,?,?,?)`).bind(`af_${crypto.randomUUID()}`,owner,candidateId,action,reason,now()).run()}

function candidateJson(row){return row?{publicId:row.public_id,candidateType:row.candidate_type,title:row.title,explanation:row.explanation,whyNow:row.why_now,confidence:row.confidence,status:row.status,snoozedUntil:row.snoozed_until||null,linkedNeedId:row.linked_need_id||null,evidence:safeJson(row.evidence_json,[]),createdAt:row.created_at,updatedAt:row.updated_at}:null}

async function list(r,e,b){
  const u=new URL(r.url),status=clean(u.searchParams.get('status')||'PENDING',30).toUpperCase();
  const allowed=new Set(['PENDING','CONFIRMED','DISMISSED','SNOOZED','EXPIRED']);
  if(!allowed.has(status))return json({error:'invalid_status'},422);
  const q=await e.DB.prepare(`SELECT * FROM anticipation_candidates WHERE owner_user_id=? AND status=? ORDER BY CASE confidence WHEN 'HIGH' THEN 3 WHEN 'MEDIUM' THEN 2 ELSE 1 END DESC, created_at DESC LIMIT 50`).bind(b.owner_user_id,status).all();
  return json({candidates:(q.results||[]).map(candidateJson)});
}

async function one(e,b,id){
  const c=await candidate(e,b.owner_user_id,id);
  if(!c)return json({error:'not_found'},404);
  const signals=await e.DB.prepare(`SELECT s.public_id,s.signal_type,s.source_entity_type,s.source_entity_id,s.observed_at,s.effective_at,s.expires_at,s.confidence,s.source_json FROM anticipation_candidate_signals cs JOIN anticipation_signals s ON s.id=cs.signal_id WHERE cs.candidate_id=? ORDER BY s.observed_at DESC`).bind(c.id).all();
  return json({candidate:candidateJson(c),signals:(signals.results||[]).map(s=>({publicId:s.public_id,signalType:s.signal_type,sourceEntityType:s.source_entity_type,sourceEntityId:s.source_entity_id,observedAt:s.observed_at,effectiveAt:s.effective_at,expiresAt:s.expires_at,confidence:s.confidence,source:safeJson(s.source_json,{})}))});
}

async function attention(e,b){
  const q=await e.DB.prepare(`SELECT public_id,attention_type,title,explanation,why_now,priority,source_entity_type,source_entity_id,effective_at,expires_at FROM attention_items WHERE owner_user_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at>?) ORDER BY priority DESC,effective_at ASC LIMIT 20`).bind(b.owner_user_id,now()).all();
  return json({attention:(q.results||[]).map(x=>({publicId:x.public_id,type:x.attention_type,title:x.title,explanation:x.explanation,whyNow:x.why_now,priority:x.priority,sourceEntityType:x.source_entity_type,sourceEntityId:x.source_entity_id,effectiveAt:x.effective_at,expiresAt:x.expires_at}))});
}

async function ensureNeed(e,b,c){
  if(c.linked_need_id){
    const linked=await e.DB.prepare(`SELECT public_id FROM world_needs WHERE id=? AND buyer_account_id=?`).bind(c.linked_need_id,b.owner_user_id).first();
    if(linked)return linked.public_id;
  }
  const payload=safeJson(c.proposed_need_payload_json,{}),type=clean(c.proposed_need_type||'FOLLOW_UP',30).toUpperCase();
  const allowed=new Set(['REPAIR','REPLACE','BUY','SELL','SERVICE','HIRE','LEARN','DECIDE','FOLLOW_UP','RENEW','MAINTAIN','FIND','BOOK','BORROW','RENT','OTHER']);
  const needType=allowed.has(type)?type:'OTHER',t=now(),id=uid('wnd_'),pid=publicId('NED'),title=clean(c.title,180),norm=normalized(title);
  let thing=null,situation=null;
  if(payload.thingId)thing=await e.DB.prepare(`SELECT id,public_id FROM ownership_passports WHERE buyer_account_id=? AND public_id=? AND status<>'archived'`).bind(b.owner_user_id,clean(payload.thingId,80)).first();
  if(payload.situationId)situation=await e.DB.prepare(`SELECT id,public_id FROM world_situations WHERE buyer_account_id=? AND public_id=? AND archived_at IS NULL`).bind(b.owner_user_id,clean(payload.situationId,80)).first();
  const sourceEntityId=payload.openLoopId||payload.thingId||payload.orderId||payload.entityId||c.public_id;
  await e.DB.prepare(`INSERT INTO world_needs(id,public_id,buyer_account_id,title,normalized_title,description,need_type,status,source_type,source_entity_type,source_entity_public_id,situation_id,thing_passport_id,urgency,confidence,due_at,desired_outcome,required_capabilities_json,desired_attributes_json,shareable_brief_json,detected_at,confirmed_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'ACTIVE','DATE_RULE','anticipation_candidate',?,?,?,?, 'NORMAL','CONFIRMED',NULL,?,'[]','[]','{}',?,?,?,?)`)
    .bind(id,pid,b.owner_user_id,title,norm,clean(c.explanation,3000),needType,sourceEntityId,situation?.id||null,thing?.id||null,clean(c.why_now,1000),t,t,t,t).run();
  await e.DB.prepare(`UPDATE anticipation_candidates SET linked_need_id=?,status='CONFIRMED',reviewed_at=?,updated_at=? WHERE id=? AND owner_user_id=?`).bind(id,t,t,c.id,b.owner_user_id).run();
  await e.DB.prepare(`INSERT INTO world_history_events(id,public_id,buyer_account_id,entity_type,entity_public_id,event_type,title,details_json,source_type,source_public_id,occurred_at,created_at) VALUES(?,?,?,?,?,'anticipation_need_created',?,?, 'anticipation',?,?,?)`).bind(uid('whe_'),publicId('HIS'),b.owner_user_id,'need',pid,title,JSON.stringify({candidateId:c.public_id,whyNow:c.why_now}),c.public_id,t,t).run();
  log('anticipation_need_created',{ownerUserId:b.owner_user_id,candidateId:c.public_id,needId:pid});
  return pid;
}

async function review(r,e,b,id,action){
  const c=await candidate(e,b.owner_user_id,id);if(!c)return json({error:'not_found'},404);
  const t=now(),data=await body(r);
  if(action==='dismiss'){
    await e.DB.prepare(`UPDATE anticipation_candidates SET status='DISMISSED',reviewed_at=?,updated_at=? WHERE id=? AND owner_user_id=?`).bind(t,t,c.id,b.owner_user_id).run();
    await feedback(e,b.owner_user_id,c.id,'DISMISSED',clean(data.reason,500)||null);log('anticipation_candidate_dismissed',{ownerUserId:b.owner_user_id,candidateId:c.public_id});return json({ok:true,status:'DISMISSED'});
  }
  if(action==='snooze'){
    const until=data.until;if(!until||Number.isNaN(new Date(until).getTime())||new Date(until)<=new Date())return json({error:'valid_future_until_required'},422);
    const future=new Date(until).toISOString();await e.DB.prepare(`UPDATE anticipation_candidates SET status='SNOOZED',snoozed_until=?,reviewed_at=?,updated_at=? WHERE id=? AND owner_user_id=?`).bind(future,t,t,c.id,b.owner_user_id).run();
    await feedback(e,b.owner_user_id,c.id,'SNOOZED');log('anticipation_candidate_snoozed',{ownerUserId:b.owner_user_id,candidateId:c.public_id});return json({ok:true,status:'SNOOZED',until:future});
  }
  if(action==='already-handled'){
    await e.DB.prepare(`UPDATE anticipation_candidates SET status='CONFIRMED',reviewed_at=?,updated_at=? WHERE id=? AND owner_user_id=?`).bind(t,t,c.id,b.owner_user_id).run();
    const p=safeJson(c.proposed_need_payload_json,{});if(p.openLoopId)await e.DB.prepare(`UPDATE world_open_loops SET status='COMPLETED',completed_at=?,updated_at=? WHERE buyer_account_id=? AND public_id=? AND status IN ('OPEN','WAITING')`).bind(t,t,b.owner_user_id,p.openLoopId).run();
    await feedback(e,b.owner_user_id,c.id,'ALREADY_HANDLED',clean(data.reason,500)||null);log('anticipation_candidate_confirmed',{ownerUserId:b.owner_user_id,candidateId:c.public_id,action:'already_handled'});return json({ok:true,status:'ALREADY_HANDLED'});
  }
  if(action==='confirm'){
    const needId=await ensureNeed(e,b,c);await feedback(e,b.owner_user_id,c.id,'CONFIRMED');log('anticipation_candidate_confirmed',{ownerUserId:b.owner_user_id,candidateId:c.public_id,needId});return json({ok:true,status:'CONFIRMED',needId,candidateId:c.public_id});
  }
  return json({error:'invalid_action'},400);
}

async function schedules(r,e,b,id=null){
  if(r.method==='GET'){
    const q=await e.DB.prepare(`SELECT public_id,entity_type,entity_id,schedule_type,interval_unit,interval_value,next_due_at,active,title,created_at,updated_at FROM user_world_schedules WHERE owner_user_id=? ORDER BY active DESC,next_due_at ASC`).bind(b.owner_user_id).all();return json({schedules:q.results||[]});
  }
  const d=await body(r),t=now();
  if(r.method==='POST'){
    if(!d.entityType||!d.entityId||!d.scheduleType||!['DAYS','WEEKS','MONTHS','YEARS'].includes(d.intervalUnit)||!Number.isInteger(Number(d.intervalValue))||Number(d.intervalValue)<1||!d.nextDueAt||Number.isNaN(new Date(d.nextDueAt).getTime()))return json({error:'invalid_schedule'},422);
    const sid=`sch_${crypto.randomUUID()}`;await e.DB.prepare(`INSERT INTO user_world_schedules(id,public_id,owner_user_id,entity_type,entity_id,schedule_type,interval_unit,interval_value,next_due_at,active,title,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?)`).bind(sid,sid,b.owner_user_id,clean(d.entityType,40),clean(d.entityId,100),clean(d.scheduleType,40).toUpperCase(),d.intervalUnit,Number(d.intervalValue),new Date(d.nextDueAt).toISOString(),clean(d.title,180)||null,t,t).run();log('schedule_created',{ownerUserId:b.owner_user_id,scheduleId:sid});return json({ok:true,id:sid},201);
  }
  if(r.method==='PATCH'&&id){
    const s=await e.DB.prepare(`SELECT * FROM user_world_schedules WHERE public_id=? AND owner_user_id=?`).bind(id,b.owner_user_id).first();if(!s)return json({error:'not_found'},404);
    if(d.complete===true){const next=advanceScheduleDate(s);await e.DB.prepare(`UPDATE user_world_schedules SET next_due_at=?,updated_at=? WHERE id=? AND owner_user_id=?`).bind(next,t,s.id,b.owner_user_id).run();await e.DB.prepare(`UPDATE anticipation_candidates SET status='CONFIRMED',reviewed_at=?,updated_at=? WHERE owner_user_id=? AND status IN ('PENDING','SNOOZED') AND proposed_need_payload_json LIKE ?`).bind(t,t,b.owner_user_id,`%${s.public_id}%`).run();log('schedule_completed',{ownerUserId:b.owner_user_id,scheduleId:s.public_id,nextDueAt:next});return json({ok:true,nextDueAt:next});}
    if(typeof d.active==='boolean'){await e.DB.prepare(`UPDATE user_world_schedules SET active=?,updated_at=? WHERE id=? AND owner_user_id=?`).bind(d.active?1:0,t,s.id,b.owner_user_id).run();return json({ok:true,active:d.active});}
    return json({error:'no_supported_change'},422);
  }
  if(r.method==='DELETE'&&id){const result=await e.DB.prepare(`DELETE FROM user_world_schedules WHERE public_id=? AND owner_user_id=?`).bind(id,b.owner_user_id).run();return json({ok:true,deleted:Number(result.meta?.changes||0)>0});}
  return json({error:'method_not_allowed'},405);
}

async function preferences(r,e,b){
  if(r.method==='GET'){
    const p=await e.DB.prepare(`SELECT * FROM anticipation_preferences WHERE owner_user_id=?`).bind(b.owner_user_id).first();return json({preferences:p||{owner_user_id:b.owner_user_id,proactive_enabled:1,warranty_enabled:1,returns_enabled:1,service_enabled:1,open_loops_enabled:1,market_wants_enabled:1,product_notices_enabled:1,user_schedules_enabled:1,quiet_start:null,quiet_end:null,lead_times_json:'{}'}});
  }
  const d=await body(r),allowed=['proactive_enabled','warranty_enabled','returns_enabled','service_enabled','open_loops_enabled','market_wants_enabled','product_notices_enabled','user_schedules_enabled'];
  const current=await e.DB.prepare(`SELECT * FROM anticipation_preferences WHERE owner_user_id=?`).bind(b.owner_user_id).first()||{};
  const v=Object.fromEntries(allowed.map(k=>[k,d[k]===undefined?(current[k]??1):(d[k]?1:0)]));
  const quietStart=d.quietStart===undefined?(current.quiet_start??null):(clean(d.quietStart,5)||null),quietEnd=d.quietEnd===undefined?(current.quiet_end??null):(clean(d.quietEnd,5)||null);
  if((quietStart&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(quietStart))||(quietEnd&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(quietEnd)))return json({error:'invalid_quiet_time'},422);
  await e.DB.prepare(`INSERT INTO anticipation_preferences(owner_user_id,proactive_enabled,warranty_enabled,returns_enabled,service_enabled,open_loops_enabled,market_wants_enabled,product_notices_enabled,user_schedules_enabled,quiet_start,quiet_end,lead_times_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_user_id) DO UPDATE SET proactive_enabled=excluded.proactive_enabled,warranty_enabled=excluded.warranty_enabled,returns_enabled=excluded.returns_enabled,service_enabled=excluded.service_enabled,open_loops_enabled=excluded.open_loops_enabled,market_wants_enabled=excluded.market_wants_enabled,product_notices_enabled=excluded.product_notices_enabled,user_schedules_enabled=excluded.user_schedules_enabled,quiet_start=excluded.quiet_start,quiet_end=excluded.quiet_end,lead_times_json=excluded.lead_times_json,updated_at=excluded.updated_at`).bind(b.owner_user_id,...allowed.map(k=>v[k]),quietStart,quietEnd,JSON.stringify(d.leadTimes||safeJson(current.lead_times_json,{})),now()).run();
  return json({ok:true});
}

async function useful(r,e,b,id){const c=await candidate(e,b.owner_user_id,id);if(!c)return json({error:'not_found'},404);const d=await body(r),value=d.helpful===true?'HELPFUL':d.helpful===false?'NOT_USEFUL':null;if(!value)return json({error:'helpful_boolean_required'},422);await feedback(e,b.owner_user_id,c.id,value,clean(d.reason,500)||null);return json({ok:true});}

export default{
  async fetch(r,e,c){
    const u=new URL(r.url);
    if(!u.pathname.startsWith('/api/v1/world/anticipation')&&!u.pathname.startsWith('/api/v1/world/attention')&&!u.pathname.startsWith('/api/v1/world/schedules'))return app.fetch(r,e,c);
    try{
      const b=await buyer(r,e);if(!b)return json({error:'unauthorized'},401);
      if(u.pathname==='/api/v1/world/anticipation'&&r.method==='GET')return list(r,e,b);
      if(u.pathname==='/api/v1/world/attention'&&r.method==='GET')return attention(e,b);
      if(u.pathname==='/api/v1/world/anticipation/preferences'&&['GET','PATCH'].includes(r.method))return preferences(r,e,b);
      let m=u.pathname.match(/^\/api\/v1\/world\/anticipation\/([^/]+)$/);if(m&&r.method==='GET')return one(e,b,decodeURIComponent(m[1]));
      m=u.pathname.match(/^\/api\/v1\/world\/anticipation\/([^/]+)\/(confirm|dismiss|snooze|already-handled)$/);if(m&&r.method==='POST')return review(r,e,b,decodeURIComponent(m[1]),m[2]);
      m=u.pathname.match(/^\/api\/v1\/world\/anticipation\/([^/]+)\/feedback$/);if(m&&r.method==='POST')return useful(r,e,b,decodeURIComponent(m[1]));
      if(u.pathname==='/api/v1/world/schedules')return schedules(r,e,b);
      m=u.pathname.match(/^\/api\/v1\/world\/schedules\/([^/]+)$/);if(m)return schedules(r,e,b,decodeURIComponent(m[1]));
      return json({error:'not_found'},404);
    }catch(x){console.error('anticipation_v143',x);return json({error:'anticipation_unavailable'},500)}
  },
  async scheduled(controller,e,c){
    c.waitUntil((async()=>{await expireStale(e.DB);await reconcileAll(e.DB)})());
    if(typeof app.scheduled==='function')return app.scheduled(controller,e,c);
  }
};
