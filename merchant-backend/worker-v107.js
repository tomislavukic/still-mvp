import app from './worker-v106.js';

const JSON_HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff'
};
const ADMIN_PREFIX='/api/v1/admin/';
const READ_ROLES=new Set(['owner','admin','reviewer','support','read_only']);
const REVIEW_ROLES=new Set(['owner','admin','reviewer']);
let schemaPromise;

const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...extra}});
const now=()=>new Date().toISOString();
const requestId=request=>request.headers.get('cf-ray')||crypto.randomUUID();
const bearer=request=>{
  const value=request.headers.get('authorization')||'';
  return value.startsWith('Bearer ')?value.slice(7):'';
};
const safeEqual=(a,b)=>{
  if(!a||!b||a.length!==b.length)return false;
  let result=0;
  for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);
  return result===0;
};
async function digest(value){
  if(!value)return null;
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,24);
}
async function ensureSchema(env){
  if(!env.DB)return;
  if(!schemaPromise)schemaPromise=env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS platform_audit_events(
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
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_platform_audit_created ON platform_audit_events(created_at DESC)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_platform_audit_action ON platform_audit_events(action,created_at DESC)')
  ]).catch(error=>{schemaPromise=undefined;throw error});
  await schemaPromise;
}
function resolveRole(request,env){
  const token=bearer(request);
  const candidates=[
    ['owner',env.VERIFICATION_ADMIN_TOKEN],
    ['admin',env.OPERATIONS_ADMIN_TOKEN],
    ['reviewer',env.OPERATIONS_REVIEWER_TOKEN],
    ['support',env.OPERATIONS_SUPPORT_TOKEN],
    ['read_only',env.OPERATIONS_READONLY_TOKEN]
  ];
  for(const[role,secret]of candidates)if(safeEqual(token,secret))return role;
  return null;
}
function actionFor(method,path){
  if(path==='/api/v1/admin/audit')return method==='GET'?'audit.read':'audit.unsupported';
  if(path==='/api/v1/admin/health')return method==='GET'?'operations.health.read':'operations.health.unsupported';
  if(path==='/api/v1/admin/intelligence')return method==='GET'?'platform.intelligence.read':'platform.intelligence.unsupported';
  if(path==='/api/v1/admin/session')return 'session.inspect';
  if(method==='GET'&&path==='/api/v1/admin/overview')return 'merchant.overview.read';
  if(method==='GET'&&/\/organizations\/[^/]+\/identity$/.test(path))return 'merchant.identity.read';
  if(method==='POST'&&/\/organizations\/[^/]+\/members\/[^/]+\/status$/.test(path))return 'merchant.member.status';
  if(method==='POST'&&/\/organizations\/[^/]+\/sessions\/[^/]+\/revoke$/.test(path))return 'merchant.session.revoke';
  if(method==='POST'&&/\/organizations\/[^/]+\/api-tokens\/[^/]+\/revoke$/.test(path))return 'merchant.api_token.revoke';
  if(method==='GET'&&/\/organizations\/[^/]+\/events$/.test(path))return 'merchant.audit.read';
  if(method==='POST'&&/\/verifications\/[^/]+\/review$/.test(path))return 'verification.review';
  if(method==='POST'&&/\/retailer-claims\/[^/]+\/review$/.test(path))return 'retailer_claim.review';
  return `admin.${method.toLowerCase()}`;
}
function allowed(role,method,path){
  if(!role)return false;
  if(method==='GET')return READ_ROLES.has(role);
  if(method==='POST'&&(/\/organizations\/[^/]+\/(members|sessions|api-tokens)\/[^/]+\/(status|revoke)$/.test(path)))return role==='owner';
  if(method==='POST'&&(/\/verifications\/[^/]+\/review$/.test(path)||/\/retailer-claims\/[^/]+\/review$/.test(path)))return REVIEW_ROLES.has(role);
  return role==='owner'||role==='admin';
}
function delegatedRequest(request,env,role){
  if(role==='owner')return request;
  const headers=new Headers(request.headers);
  headers.set('authorization',`Bearer ${env.VERIFICATION_ADMIN_TOKEN}`);
  headers.set('x-still-operations-role',role);
  return new Request(request,{headers});
}
async function writeAudit(env,event){
  if(!env.DB)return;
  await ensureSchema(env);
  await env.DB.prepare(`INSERT INTO platform_audit_events(
    id,request_id,actor_role,action,method,path,status,outcome,ip_hash,user_agent,metadata_json,created_at
  ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    `pae_${crypto.randomUUID().replaceAll('-','')}`,
    event.requestId,event.role,event.action,event.method,event.path,event.status,event.outcome,
    event.ipHash,event.userAgent,JSON.stringify(event.metadata||{}),event.createdAt
  ).run();
}
async function auditList(request,env,role,id){
  if(!READ_ROLES.has(role))return json({error:'forbidden'},403,{'x-request-id':id});
  await ensureSchema(env);
  const url=new URL(request.url);
  const limit=Math.max(1,Math.min(200,Number(url.searchParams.get('limit'))||100));
  const action=(url.searchParams.get('action')||'').trim().slice(0,100);
  const result=action
    ?await env.DB.prepare(`SELECT request_id,actor_role,action,method,path,status,outcome,ip_hash,user_agent,metadata_json,created_at FROM platform_audit_events WHERE action=? ORDER BY created_at DESC LIMIT ?`).bind(action,limit).all()
    :await env.DB.prepare(`SELECT request_id,actor_role,action,method,path,status,outcome,ip_hash,user_agent,metadata_json,created_at FROM platform_audit_events ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
  return json({events:(result.results||[]).map(row=>({...row,metadata:JSON.parse(row.metadata_json||'{}'),metadata_json:undefined}))},200,{'x-request-id':id});
}


function classifyOperationsIncidents(metrics){
  const incidents=[];

  if(!metrics.databaseHealthy){
    incidents.push({
      severity:'critical',
      code:'database_unavailable',
      title:'D1 database health check failed',
      detail:'The production Worker could not confirm database connectivity.'
    });
  }

  if(metrics.errors24h>0){
    incidents.push({
      severity:metrics.errors24h>=5?'critical':'warning',
      code:'server_errors',
      title:`${metrics.errors24h} server ${metrics.errors24h===1?'error':'errors'} recorded`,
      detail:'One or more protected admin requests returned HTTP 500 or higher.'
    });
  }

  if(metrics.averageLatencyMs>=500){
    incidents.push({
      severity:metrics.averageLatencyMs>=1000?'critical':'warning',
      code:'high_average_latency',
      title:'Average admin API latency is elevated',
      detail:`Average recorded latency is ${metrics.averageLatencyMs} ms.`
    });
  }

  if(metrics.maximumLatencyMs>=2000){
    incidents.push({
      severity:'warning',
      code:'latency_spike',
      title:'A slow protected request was detected',
      detail:`Maximum recorded latency reached ${metrics.maximumLatencyMs} ms.`
    });
  }

  if(metrics.denied24h>=20){
    incidents.push({
      severity:'warning',
      code:'authentication_denials',
      title:'Unusual authentication denial volume',
      detail:`${metrics.denied24h} security-relevant denied requests were recorded.`
    });
  }

  return incidents;
}


function clampScore(value){return Math.max(0,Math.min(100,Math.round(value)))}
function intelligenceBand(risk){
  if(risk>=70)return'critical';
  if(risk>=40)return'elevated';
  if(risk>=20)return'watch';
  return'low';
}
function addSignal(signals,{code,label,detail,weight,severity='info'}){
  signals.push({code,label,detail,weight,severity});
}
function scoreOrganizationIntelligence(org,counts){
  const signals=[];
  let risk=0;
  let trust=35;
  let readiness=10;
  let security=100;
  let engagement=0;

  const verified=org.organization_status==='verified'||org.verification_status==='approved';
  const routing=org.claim_status==='approved';

  if(!org.owner_email){
    risk+=15;trust-=15;
    addSignal(signals,{code:'owner_missing',label:'Owner contact missing',detail:'The organization has no recorded owner email.',weight:15,severity:'warning'});
  }else{trust+=10;readiness+=10}

  if(!org.verification_id){
    risk+=18;trust-=10;
    addSignal(signals,{code:'verification_missing',label:'Verification not submitted',detail:'Legal identity evidence has not been submitted.',weight:18,severity:'warning'});
  }else{readiness+=15}

  if(org.verification_status==='needs_changes'){
    risk+=18;trust-=12;
    addSignal(signals,{code:'verification_changes',label:'Verification needs changes',detail:'The merchant must correct submitted verification information.',weight:18,severity:'warning'});
  }
  if(org.verification_status==='rejected'){
    risk+=35;trust-=30;security-=10;
    addSignal(signals,{code:'verification_rejected',label:'Verification rejected',detail:'The current legal identity submission was rejected.',weight:35,severity:'critical'});
  }
  if(verified){trust+=25;readiness+=25}

  if(verified&&!org.claim_id){
    risk+=8;
    addSignal(signals,{code:'retailer_unclaimed',label:'Retailer identity not claimed',detail:'The verified company is not yet connected to a retailer identity.',weight:8,severity:'info'});
  }
  if(org.claim_status==='under_review'){
    risk+=10;
    addSignal(signals,{code:'claim_review',label:'Retailer claim awaiting review',detail:'Retailer ownership still requires a platform decision.',weight:10,severity:'warning'});
  }
  if(routing){readiness+=40;trust+=15}

  if(counts.activeOwners===0){
    risk+=35;security-=30;
    addSignal(signals,{code:'no_active_owner',label:'No active organization owner',detail:'No active owner account was found for this tenant.',weight:35,severity:'critical'});
  }else{security+=5}
  if(counts.disabledMembers>0){
    risk+=Math.min(12,counts.disabledMembers*4);
    addSignal(signals,{code:'disabled_members',label:'Disabled members present',detail:`${counts.disabledMembers} member account(s) are disabled.`,weight:Math.min(12,counts.disabledMembers*4),severity:'info'});
  }
  if(counts.recentDenied>0){
    const weight=Math.min(25,counts.recentDenied*3);
    risk+=weight;security-=weight;
    addSignal(signals,{code:'recent_denials',label:'Recent denied requests',detail:`${counts.recentDenied} security-relevant denied request(s) were recorded in the last 24 hours.`,weight,severity:counts.recentDenied>=5?'critical':'warning'});
  }
  if(counts.recentErrors>0){
    const weight=Math.min(20,counts.recentErrors*5);
    risk+=weight;
    addSignal(signals,{code:'recent_errors',label:'Recent server errors',detail:`${counts.recentErrors} protected request(s) returned HTTP 500 or higher.`,weight,severity:'warning'});
  }

  engagement+=Math.min(40,counts.activeMembers*12);
  engagement+=Math.min(30,counts.activeSessions*10);
  engagement+=Math.min(20,counts.activeTokens*5);
  if(counts.recentActivity>0)engagement+=10;
  if(counts.activeMembers===0){
    risk+=15;
    addSignal(signals,{code:'no_active_members',label:'No active members',detail:'The tenant currently has no active team members.',weight:15,severity:'critical'});
  }

  risk=clampScore(risk);
  trust=clampScore(trust);
  readiness=clampScore(readiness);
  security=clampScore(security);
  engagement=clampScore(engagement);
  const health=clampScore((trust+readiness+security+engagement+(100-risk))/5);

  const recommendations=[];
  if(!org.verification_id)recommendations.push({priority:1,action:'Request verification',reason:'Legal identity evidence is missing.'});
  if(org.verification_status==='needs_changes')recommendations.push({priority:1,action:'Follow up on corrections',reason:'Verification cannot progress until the merchant resubmits.'});
  if(org.verification_status==='rejected')recommendations.push({priority:1,action:'Keep routing disabled',reason:'The current identity submission is rejected.'});
  if(counts.activeOwners===0)recommendations.push({priority:1,action:'Restore an active owner',reason:'The tenant has no active owner account.'});
  if(counts.recentDenied>=5)recommendations.push({priority:1,action:'Review access activity',reason:'Denied request volume is elevated.'});
  if(verified&&!org.claim_id)recommendations.push({priority:2,action:'Complete retailer connection',reason:'The company is verified but cannot receive buyer routing yet.'});
  if(!recommendations.length)recommendations.push({priority:3,action:'Continue monitoring',reason:'No immediate intervention is indicated by current platform signals.'});

  return{health,risk,trust,readiness,security,engagement,band:intelligenceBand(risk),signals:signals.sort((a,b)=>b.weight-a.weight),recommendations:recommendations.sort((a,b)=>a.priority-b.priority)};
}

async function platformIntelligence(request,env,role,id){
  if(!READ_ROLES.has(role))return json({error:'forbidden'},403,{'x-request-id':id});
  await ensureSchema(env);

  const organizationsResult=await env.DB.prepare('SELECT * FROM merchant_organizations ORDER BY created_at DESC').all();
  const organizations=[];

  for(const org of organizationsResult.results||[]){
    const [members,sessions,tokens,audit]=await Promise.all([
      env.DB.prepare(`SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status='disabled' THEN 1 ELSE 0 END) AS disabled,
        SUM(CASE WHEN role='owner' AND status='active' THEN 1 ELSE 0 END) AS active_owners
        FROM merchant_members WHERE organization_id=?`).bind(org.id).first(),
      env.DB.prepare(`SELECT COUNT(*) AS active FROM merchant_sessions s JOIN merchant_members m ON m.id=s.member_id WHERE m.organization_id=? AND s.expires_at>datetime('now')`).bind(org.id).first(),
      env.DB.prepare(`SELECT COUNT(*) AS active FROM merchant_api_tokens WHERE organization_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>datetime('now'))`).bind(org.id).first(),
      env.DB.prepare(`SELECT
        SUM(CASE WHEN status IN(401,403) AND path!='/api/v1/admin/notifications' THEN 1 ELSE 0 END) AS denied,
        SUM(CASE WHEN status>=500 THEN 1 ELSE 0 END) AS errors,
        COUNT(*) AS activity
        FROM platform_audit_events WHERE created_at>=datetime('now','-24 hours') AND path LIKE ?`).bind(`%${org.id}%`).first()
    ]);

    const counts={
      totalMembers:Number(members?.total||0),
      activeMembers:Number(members?.active||0),
      disabledMembers:Number(members?.disabled||0),
      activeOwners:Number(members?.active_owners||0),
      activeSessions:Number(sessions?.active||0),
      activeTokens:Number(tokens?.active||0),
      recentDenied:Number(audit?.denied||0),
      recentErrors:Number(audit?.errors||0),
      recentActivity:Number(audit?.activity||0)
    };
    organizations.push({...org,counts,intelligence:scoreOrganizationIntelligence(org,counts)});
  }

  organizations.sort((a,b)=>b.intelligence.risk-a.intelligence.risk||a.intelligence.health-b.intelligence.health);
  const total=organizations.length;
  const critical=organizations.filter(item=>item.intelligence.band==='critical').length;
  const elevated=organizations.filter(item=>item.intelligence.band==='elevated').length;
  const averageHealth=total?Math.round(organizations.reduce((sum,item)=>sum+item.intelligence.health,0)/total):100;
  const averageRisk=total?Math.round(organizations.reduce((sum,item)=>sum+item.intelligence.risk,0)/total):0;

  return json({
    methodology:'deterministic-v1',
    generatedAt:now(),
    summary:{total,critical,elevated,averageHealth,averageRisk},
    organizations
  },200,{'x-request-id':id});
}

async function operationsHealth(request,env,role,id){
  if(!READ_ROLES.has(role)){
    return json({error:'forbidden'},403,{'x-request-id':id});
  }

  const started=Date.now();
  await ensureSchema(env);

  const databaseCheck=await env.DB.prepare('SELECT 1 AS healthy').first();

  const metrics=await env.DB.prepare(`
    SELECT
      COUNT(*) AS requests_24h,
      SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS errors_24h,

      SUM(CASE
        WHEN status IN (401,403)
         AND path != '/api/v1/admin/notifications'
        THEN 1 ELSE 0
      END) AS security_denied_24h,

      SUM(CASE
        WHEN status IN (401,403)
         AND path = '/api/v1/admin/notifications'
        THEN 1 ELSE 0
      END) AS notification_poll_denied_24h,

      ROUND(AVG(
        CAST(json_extract(metadata_json,'$.durationMs') AS REAL)
      ),1) AS average_latency_ms,

      MAX(CAST(json_extract(metadata_json,'$.durationMs') AS REAL))
        AS maximum_latency_ms,

      MAX(created_at) AS latest_activity_at
    FROM platform_audit_events
    WHERE created_at >= datetime('now','-24 hours')
  `).first();

  const recent=await env.DB.prepare(`
    SELECT
      action,
      status,
      outcome,
      actor_role,
      method,
      path,
      created_at
    FROM platform_audit_events
    WHERE NOT (
      actor_role = 'anonymous'
      AND status = 401
      AND path = '/api/v1/admin/notifications'
    )
    ORDER BY created_at DESC
    LIMIT 10
  `).all();

  return json({
    status:'healthy',
    worker:{
      build:107,
      baseBuild:106,
      environment:'production',
      colo:request.cf?.colo||null
    },
    database:{
      status:databaseCheck?.healthy===1?'healthy':'unknown',
      binding:'DB',
      responseMs:Date.now()-started
    },
    metrics:{
      requests24h:Number(metrics?.requests_24h||0),
      errors24h:Number(metrics?.errors_24h||0),
      denied24h:Number(metrics?.security_denied_24h||0),
      notificationPollDenied24h:
        Number(metrics?.notification_poll_denied_24h||0),
      averageLatencyMs:Number(metrics?.average_latency_ms||0),
      maximumLatencyMs:Number(metrics?.maximum_latency_ms||0),
      latestActivityAt:metrics?.latest_activity_at||null
    },
    incidents:classifyOperationsIncidents({
      requests24h:Number(metrics?.requests_24h||0),
      errors24h:Number(metrics?.errors_24h||0),
      denied24h:Number(metrics?.security_denied_24h||0),
      averageLatencyMs:Number(metrics?.average_latency_ms||0),
      maximumLatencyMs:Number(metrics?.maximum_latency_ms||0),
      databaseHealthy:databaseCheck?.healthy===1
    }),
    recentActivity:recent.results||[],
    checkedAt:now()
  },200,{'x-request-id':id});
}



async function readJsonBody(request){
  try{return await request.json()}catch{return{}}
}

function validReason(value){
  const reason=String(value||'').trim();
  return reason.length>=8&&reason.length<=500?reason:null;
}

async function writeOrganizationControlAudit(env,{organizationId,memberId,action,entityType,entityId,details}){
  await env.DB.prepare(`
    INSERT INTO ops_audit_log(
      id,organization_id,member_id,action,entity_type,entity_id,details_json,created_at
    ) VALUES(?,?,?,?,?,?,?,?)
  `).bind(
    `oal_${crypto.randomUUID().replaceAll('-','')}`,
    organizationId,
    memberId,
    action,
    entityType,
    entityId,
    JSON.stringify(details||{}),
    now()
  ).run();
}

async function changeMemberStatus(request,env,role,id,organizationId,memberId){
  if(role!=='owner')return json({error:'forbidden'},403,{'x-request-id':id});
  const body=await readJsonBody(request);
  if(body.confirm!=='CONFIRM')return json({error:'confirmation_required'},400,{'x-request-id':id});
  const reason=validReason(body.reason);
  if(!reason)return json({error:'reason_required'},400,{'x-request-id':id});
  const nextStatus=body.status;
  if(!['active','disabled'].includes(nextStatus))return json({error:'invalid_status'},400,{'x-request-id':id});

  const member=await env.DB.prepare(`
    SELECT id,email,role,status FROM merchant_members
    WHERE id=? AND organization_id=? LIMIT 1
  `).bind(memberId,organizationId).first();
  if(!member)return json({error:'member_not_found'},404,{'x-request-id':id});
  if(member.status===nextStatus)return json({member,changed:false},200,{'x-request-id':id});

  if(member.role==='owner'&&nextStatus==='disabled'){
    const owners=await env.DB.prepare(`
      SELECT COUNT(*) AS count FROM merchant_members
      WHERE organization_id=? AND role='owner' AND status='active'
    `).bind(organizationId).first();
    if(Number(owners?.count||0)<=1)return json({error:'last_owner_protected'},409,{'x-request-id':id});
  }

  await env.DB.prepare(`
    UPDATE merchant_members SET status=?,updated_at=?
    WHERE id=? AND organization_id=?
  `).bind(nextStatus,now(),memberId,organizationId).run();

  if(nextStatus==='disabled'){
    await env.DB.prepare(`
      DELETE FROM merchant_sessions
      WHERE member_id=?
    `).bind(memberId).run();
  }

  await writeOrganizationControlAudit(env,{
    organizationId,
    memberId,
    action:nextStatus==='disabled'?'member.disabled':'member.reactivated',
    entityType:'merchant_member',
    entityId:memberId,
    details:{reason,previousStatus:member.status,newStatus:nextStatus,platformRole:role}
  });

  return json({
    member:{...member,status:nextStatus},
    changed:true,
    sessionsTerminated:nextStatus==='disabled'
  },200,{'x-request-id':id});
}

async function revokeOrganizationSession(request,env,role,id,organizationId,sessionId){
  if(role!=='owner')return json({error:'forbidden'},403,{'x-request-id':id});
  const body=await readJsonBody(request);
  if(body.confirm!=='CONFIRM')return json({error:'confirmation_required'},400,{'x-request-id':id});
  const reason=validReason(body.reason);
  if(!reason)return json({error:'reason_required'},400,{'x-request-id':id});

  const session=await env.DB.prepare(`
    SELECT s.id,s.member_id,m.email
    FROM merchant_sessions s
    JOIN merchant_members m ON m.id=s.member_id
    WHERE s.id=? AND m.organization_id=? LIMIT 1
  `).bind(sessionId,organizationId).first();
  if(!session)return json({error:'session_not_found'},404,{'x-request-id':id});

  await env.DB.prepare('DELETE FROM merchant_sessions WHERE id=?').bind(sessionId).run();
  await writeOrganizationControlAudit(env,{
    organizationId,
    memberId:session.member_id,
    action:'session.revoked',
    entityType:'merchant_session',
    entityId:sessionId,
    details:{reason,memberEmail:session.email,platformRole:role}
  });
  return json({revoked:true,sessionId},200,{'x-request-id':id});
}

async function revokeOrganizationApiToken(request,env,role,id,organizationId,tokenId){
  if(role!=='owner')return json({error:'forbidden'},403,{'x-request-id':id});
  const body=await readJsonBody(request);
  if(body.confirm!=='CONFIRM')return json({error:'confirmation_required'},400,{'x-request-id':id});
  const reason=validReason(body.reason);
  if(!reason)return json({error:'reason_required'},400,{'x-request-id':id});

  const apiToken=await env.DB.prepare(`
    SELECT id,member_id,label,revoked_at
    FROM merchant_api_tokens
    WHERE id=? AND organization_id=? LIMIT 1
  `).bind(tokenId,organizationId).first();
  if(!apiToken)return json({error:'api_token_not_found'},404,{'x-request-id':id});
  if(apiToken.revoked_at)return json({revoked:true,tokenId,changed:false},200,{'x-request-id':id});

  const revokedAt=now();
  await env.DB.prepare(`
    UPDATE merchant_api_tokens SET revoked_at=?
    WHERE id=? AND organization_id=?
  `).bind(revokedAt,tokenId,organizationId).run();
  await writeOrganizationControlAudit(env,{
    organizationId,
    memberId:apiToken.member_id,
    action:'api_token.revoked',
    entityType:'merchant_api_token',
    entityId:tokenId,
    details:{reason,label:apiToken.label,platformRole:role}
  });
  return json({revoked:true,tokenId,changed:true,revokedAt},200,{'x-request-id':id});
}

async function organizationIdentity(request,env,role,id,organizationId){
  if(!READ_ROLES.has(role))return json({error:'forbidden'},403,{'x-request-id':id});

  const organization=await env.DB.prepare(
    'SELECT id,name,status,created_at,updated_at FROM merchant_organizations WHERE id=? LIMIT 1'
  ).bind(organizationId).first();

  if(!organization)return json({error:'organization_not_found'},404,{'x-request-id':id});

  const [membersResult,sessionsResult,tokensResult,auditResult]=await Promise.all([
    env.DB.prepare(`
      SELECT id,email,role,status,created_at,updated_at
      FROM merchant_members
      WHERE organization_id=?
      ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'agent' THEN 2 ELSE 3 END,email
    `).bind(organizationId).all(),

    env.DB.prepare(`
      SELECT
        s.id,
        s.member_id,
        m.email AS member_email,
        m.role AS member_role,
        s.created_at,
        s.last_seen_at,
        s.expires_at
      FROM merchant_sessions s
      JOIN merchant_members m ON m.id=s.member_id
      WHERE m.organization_id=?
      ORDER BY s.last_seen_at DESC
      LIMIT 100
    `).bind(organizationId).all(),

    env.DB.prepare(`
      SELECT
        t.id,
        t.member_id,
        m.email AS member_email,
        t.label,
        t.created_at,
        t.last_used_at,
        t.expires_at,
        t.revoked_at
      FROM merchant_api_tokens t
      LEFT JOIN merchant_members m ON m.id=t.member_id
      WHERE t.organization_id=?
      ORDER BY t.created_at DESC
      LIMIT 100
    `).bind(organizationId).all(),

    env.DB.prepare(`
      SELECT
        a.id,
        a.member_id,
        m.email AS member_email,
        a.action,
        a.entity_type,
        a.entity_id,
        a.details_json,
        a.created_at
      FROM ops_audit_log a
      LEFT JOIN merchant_members m ON m.id=a.member_id
      WHERE a.organization_id=?
      ORDER BY a.created_at DESC
      LIMIT 100
    `).bind(organizationId).all()
  ]);

  const currentMs=Date.now();
  const members=membersResult.results||[];
  const sessions=(sessionsResult.results||[]).map(session=>({
    ...session,
    state:Date.parse(session.expires_at)>currentMs?'active':'expired'
  }));
  const apiTokens=(tokensResult.results||[]).map(token=>({
    ...token,
    state:token.revoked_at
      ?'revoked'
      :token.expires_at&&Date.parse(token.expires_at)<=currentMs
        ?'expired'
        :'active'
  }));
  const audit=(auditResult.results||[]).map(event=>{
    let details={};
    try{details=JSON.parse(event.details_json||'{}')}catch{}
    return {...event,details,details_json:undefined};
  });

  return json({
    organization,
    summary:{
      members:members.length,
      activeMembers:members.filter(member=>member.status==='active').length,
      activeSessions:sessions.filter(session=>session.state==='active').length,
      activeApiTokens:apiTokens.filter(token=>token.state==='active').length
    },
    members,
    sessions,
    apiTokens,
    audit,
    readOnly:true,
    checkedAt:now()
  },200,{'x-request-id':id});
}

function withRequestId(response,id){
  const headers=new Headers(response.headers);
  headers.set('x-request-id',id);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

export default{
  async fetch(request,env,ctx){
    const started=Date.now();
    const id=requestId(request);
    const url=new URL(request.url);
    const path=url.pathname;
    const isAdmin=path.startsWith(ADMIN_PREFIX);
    const role=isAdmin?resolveRole(request,env):null;
    const action=isAdmin?actionFor(request.method,path):'request';
    let response;
    let errorName=null;
    try{
      if(isAdmin){
        if(!role)response=json({error:'unauthorized'},401,{'x-request-id':id});
        else if(!allowed(role,request.method,path))response=json({error:'forbidden',role},403,{'x-request-id':id});
        else if(path==='/api/v1/admin/session'&&request.method==='GET')response=json({authenticated:true,role,permissions:{read:READ_ROLES.has(role),review:REVIEW_ROLES.has(role),admin:role==='owner'||role==='admin'}},200,{'x-request-id':id});
        else if(path==='/api/v1/admin/audit'&&request.method==='GET')response=await auditList(request,env,role,id);
        else if(path==='/api/v1/admin/health'&&request.method==='GET')response=await operationsHealth(request,env,role,id);
        else if(path==='/api/v1/admin/intelligence'&&request.method==='GET')response=await platformIntelligence(request,env,role,id);
        else if(request.method==='GET'&&/^\/api\/v1\/admin\/organizations\/[^/]+\/identity$/.test(path)){
          const organizationId=decodeURIComponent(path.split('/')[5]||'');
          response=await organizationIdentity(request,env,role,id,organizationId);
        }
        else if(request.method==='POST'&&/^\/api\/v1\/admin\/organizations\/[^/]+\/members\/[^/]+\/status$/.test(path)){
          const parts=path.split('/');
          response=await changeMemberStatus(request,env,role,id,decodeURIComponent(parts[5]||''),decodeURIComponent(parts[7]||''));
        }
        else if(request.method==='POST'&&/^\/api\/v1\/admin\/organizations\/[^/]+\/sessions\/[^/]+\/revoke$/.test(path)){
          const parts=path.split('/');
          response=await revokeOrganizationSession(request,env,role,id,decodeURIComponent(parts[5]||''),decodeURIComponent(parts[7]||''));
        }
        else if(request.method==='POST'&&/^\/api\/v1\/admin\/organizations\/[^/]+\/api-tokens\/[^/]+\/revoke$/.test(path)){
          const parts=path.split('/');
          response=await revokeOrganizationApiToken(request,env,role,id,decodeURIComponent(parts[5]||''),decodeURIComponent(parts[7]||''));
        }
        else response=withRequestId(await app.fetch(delegatedRequest(request,env,role),env,ctx),id);
      }else response=withRequestId(await app.fetch(request,env,ctx),id);
    }catch(error){
      errorName=error?.name||'Error';
      console.error(JSON.stringify({level:'error',event:'request.exception',requestId:id,method:request.method,path,error:errorName,message:String(error?.message||error).slice(0,500),createdAt:now()}));
      response=json({error:'internal_error',requestId:id},500,{'x-request-id':id});
    }
    const durationMs=Date.now()-started;
    const log={level:response.status>=500?'error':response.status>=400?'warn':'info',event:'request.complete',requestId:id,method:request.method,path,status:response.status,durationMs,role:role||undefined,cfColo:request.cf?.colo||undefined,error:errorName||undefined,createdAt:now()};
    console.log(JSON.stringify(log));
    if(isAdmin){
      const audit={requestId:id,role:role||'anonymous',action,method:request.method,path,status:response.status,outcome:response.ok?'success':response.status===401?'unauthorized':response.status===403?'forbidden':'failure',ipHash:await digest(request.headers.get('cf-connecting-ip')||''),userAgent:(request.headers.get('user-agent')||'').slice(0,300)||null,metadata:{durationMs,cfColo:request.cf?.colo||null},createdAt:now()};
      const task=writeAudit(env,audit).catch(error=>console.error(JSON.stringify({level:'error',event:'audit.write_failed',requestId:id,error:String(error?.message||error).slice(0,500),createdAt:now()})));
      if(ctx?.waitUntil)ctx.waitUntil(task);else await task;
    }
    return response;
  }
};
