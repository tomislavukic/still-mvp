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
  if(path==='/api/v1/admin/session')return 'session.inspect';
  if(method==='GET'&&path==='/api/v1/admin/overview')return 'merchant.overview.read';
  if(method==='GET'&&/\/organizations\/[^/]+\/events$/.test(path))return 'merchant.audit.read';
  if(method==='POST'&&/\/verifications\/[^/]+\/review$/.test(path))return 'verification.review';
  if(method==='POST'&&/\/retailer-claims\/[^/]+\/review$/.test(path))return 'retailer_claim.review';
  return `admin.${method.toLowerCase()}`;
}
function allowed(role,method,path){
  if(!role)return false;
  if(method==='GET')return READ_ROLES.has(role);
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
