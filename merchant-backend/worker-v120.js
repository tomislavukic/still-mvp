import app from './worker-v108.js';

const JSON_HEADERS={
  'content-type':'application/json; charset=utf-8',
  'cache-control':'no-store',
  'x-content-type-options':'nosniff'
};
const now=()=>new Date().toISOString();
const today=()=>now().slice(0,10);
const uid=prefix=>`${prefix}${crypto.randomUUID().replaceAll('-','')}`;
const publicId=prefix=>`${prefix}-${crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
const clean=(value,max=1000)=>typeof value==='string'?value.trim().slice(0,max):'';
const safeJson=(value,fallback={})=>{try{return JSON.parse(value||'')}catch{return fallback}};
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{...JSON_HEADERS,...headers}});
let schemaReady;

async function sha(value){
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

function cookie(request,name){
  for(const part of(request.headers.get('cookie')||'').split(';')){
    const [key,...value]=part.trim().split('=');
    if(key===name)return decodeURIComponent(value.join('='));
  }
  return'';
}

function sameOrigin(request){
  const origin=request.headers.get('origin');
  return !origin||origin===new URL(request.url).origin;
}

async function session(request,env){
  const raw=cookie(request,'still_company');
  if(!raw)return null;
  return env.DB.prepare(`SELECT s.id session_id,m.id member_id,m.email,m.role,o.id organization_id,o.name organization_name,o.slug organization_slug,o.status organization_status
    FROM merchant_sessions s
    JOIN merchant_members m ON m.id=s.member_id
    JOIN merchant_organizations o ON o.id=m.organization_id
    WHERE s.token_hash=? AND s.expires_at>? AND m.status='active'`)
    .bind(await sha(raw),now()).first();
}

async function ensureSchema(env){
  if(!schemaReady){
    const statements=[
      `CREATE TABLE IF NOT EXISTS companyos_situations(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,title TEXT NOT NULL,description TEXT,cause TEXT,severity TEXT NOT NULL DEFAULT 'normal',status TEXT NOT NULL DEFAULT 'open',assigned_member_id TEXT,ai_insight TEXT,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS companyos_situation_links(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,situation_id TEXT NOT NULL,object_type TEXT NOT NULL,object_public_id TEXT NOT NULL,relationship TEXT NOT NULL DEFAULT 'affected',created_at TEXT NOT NULL,UNIQUE(situation_id,object_type,object_public_id,relationship))`,
      `CREATE TABLE IF NOT EXISTS companyos_situation_states(organization_id TEXT NOT NULL,derived_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',assigned_member_id TEXT,note TEXT,updated_at TEXT NOT NULL,updated_by_member_id TEXT NOT NULL,PRIMARY KEY(organization_id,derived_id))`,
      `CREATE TABLE IF NOT EXISTS companyos_relationships(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,from_type TEXT NOT NULL,from_public_id TEXT NOT NULL,to_type TEXT NOT NULL,to_public_id TEXT NOT NULL,relationship TEXT NOT NULL,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(organization_id,from_type,from_public_id,to_type,to_public_id,relationship))`,
      `CREATE TABLE IF NOT EXISTS companyos_events(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,object_type TEXT NOT NULL,object_public_id TEXT NOT NULL,event_type TEXT NOT NULL,title TEXT NOT NULL,details_json TEXT,occurred_at TEXT NOT NULL,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS companyos_documents(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,object_type TEXT NOT NULL,object_public_id TEXT NOT NULL,title TEXT NOT NULL,document_type TEXT NOT NULL,mime_type TEXT,external_url TEXT,reference TEXT,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS companyos_work_objects(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,object_type TEXT NOT NULL,title TEXT NOT NULL,subtitle TEXT,status TEXT NOT NULL DEFAULT 'active',reference TEXT,data_json TEXT,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS platform_audit_events(id TEXT PRIMARY KEY,request_id TEXT NOT NULL,organization_id TEXT,member_id TEXT,action TEXT NOT NULL,method TEXT NOT NULL,path TEXT NOT NULL,status INTEGER NOT NULL,duration_ms INTEGER NOT NULL,details_json TEXT,created_at TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS companyos_rate_limits(bucket TEXT PRIMARY KEY,count INTEGER NOT NULL,expires_at TEXT NOT NULL)`,
      `CREATE INDEX IF NOT EXISTS idx_companyos_situations_org ON companyos_situations(organization_id,status,updated_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_companyos_links_situation ON companyos_situation_links(situation_id,created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_companyos_relationships_from ON companyos_relationships(organization_id,from_type,from_public_id)`,
      `CREATE INDEX IF NOT EXISTS idx_companyos_relationships_to ON companyos_relationships(organization_id,to_type,to_public_id)`,
      `CREATE INDEX IF NOT EXISTS idx_companyos_events_object ON companyos_events(organization_id,object_type,object_public_id,occurred_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_companyos_documents_object ON companyos_documents(organization_id,object_type,object_public_id,created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_companyos_work_objects_org ON companyos_work_objects(organization_id,object_type,updated_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_platform_audit_org ON platform_audit_events(organization_id,created_at DESC)`,
      `DELETE FROM companyos_rate_limits WHERE expires_at<datetime('now')`,
      `PRAGMA optimize`
    ];
    schemaReady=env.DB.batch(statements.map(statement=>env.DB.prepare(statement))).catch(error=>{
      schemaReady=undefined;
      throw error;
    });
  }
  await schemaReady;
}

async function rateLimit(env,company,request){
  const minute=now().slice(0,16);
  const limit=['GET','HEAD'].includes(request.method)?180:60;
  const bucket=await sha(`${company.organization_id}:${company.member_id}:${request.method}:${minute}`);
  const expiresAt=new Date(Date.now()+120000).toISOString();
  await env.DB.prepare(`INSERT INTO companyos_rate_limits(bucket,count,expires_at) VALUES(?,1,?)
    ON CONFLICT(bucket) DO UPDATE SET count=count+1,expires_at=excluded.expires_at`).bind(bucket,expiresAt).run();
  const row=await env.DB.prepare('SELECT count FROM companyos_rate_limits WHERE bucket=?').bind(bucket).first();
  return Number(row?.count||0)<=limit;
}

async function safeAll(env,sql,bindings=[]){
  try{return (await env.DB.prepare(sql).bind(...bindings).all()).results||[]}catch{return[]}
}

async function safeFirst(env,sql,bindings=[]){
  try{return await env.DB.prepare(sql).bind(...bindings).first()}catch{return null}
}

function canWrite(company){return ['owner','admin','manager','agent'].includes(company.role)}
function canManage(company){return ['owner','admin','manager'].includes(company.role)}

function object({id,type,title,subtitle='',status='active',updatedAt=null,source,meta={}}){
  return{id:String(id),type,title:String(title||id),subtitle:String(subtitle||''),status:String(status||'active'),updatedAt,source,meta};
}

async function livingObjects(env,company,limitPerType=50){
  const org=company.organization_id;
  const queries=await Promise.all([
    safeAll(env,`SELECT public_id,sku,name,kind,active,updated_at FROM ops_products WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,name,code,active,updated_at FROM ops_locations WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,name,email,lead_days,active,updated_at FROM ops_suppliers WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT po.public_id,po.status,po.expected_on,po.updated_at,s.name supplier_name FROM ops_purchase_orders po JOIN ops_suppliers s ON s.id=po.supplier_id WHERE po.organization_id=? ORDER BY po.updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,subject,status,priority,updated_at FROM ops_repair_jobs WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,reason,status,disposition,updated_at FROM ops_rmas WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,order_reference,status,tracking_number,updated_at FROM ops_reservations WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,title,agreement_type,status,renewal_on,updated_at FROM ops_agreements WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,name,email,skills,active,updated_at FROM ops_staff WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,title,status,starts_at,updated_at FROM ops_appointments WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,name,email,company_name,stage,updated_at FROM ops_crm_contacts WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,title,status,total_cents,currency,updated_at FROM ops_quotes WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,title,severity,status,updated_at FROM ops_recall_campaigns WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,title,kind,status,updated_at FROM ownership_passports WHERE organization_id=? AND status<>'archived' ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,title,status,kind,updated_at FROM commerce_offers WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,status,amount_cents,currency,updated_at FROM commerce_orders WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT e.public_id,sc.name title,e.status,e.customer_name,e.updated_at FROM service_engagements e JOIN service_catalog sc ON sc.id=e.service_id WHERE e.organization_id=? ORDER BY e.updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT id,title,contract_type,status,renewal_date,updated_at FROM service_contracts WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,title,category,status,updated_at FROM business_assets WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,product_name title,case_type,status,updated_at FROM consumer_cases WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT id,name,city,status,updated_at FROM merchant_branches WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT id,title,status,priority,updated_at FROM merchant_tasks WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT id,title,status,promised_at updated_at FROM merchant_commitments WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT id,supplier_name,product_name,claim_type,status,updated_at FROM merchant_supplier_claims WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,product_name title,sku,status,updated_at FROM esl_labels WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType]),
    safeAll(env,`SELECT public_id,object_type,title,subtitle,status,reference,updated_at FROM companyos_work_objects WHERE organization_id=? ORDER BY updated_at DESC LIMIT ?`,[org,limitPerType])
  ]);
  const [products,locations,suppliers,purchaseOrders,repairs,returns,reservations,agreements,staff,appointments,contacts,quotes,recalls,passports,offers,orders,services,contracts,assets,cases,branches,tasks,commitments,supplierClaims,labels,workObjects]=queries;
  return [
    ...products.map(row=>object({id:row.public_id,type:row.kind==='asset'?'asset':'product',title:row.name,subtitle:row.sku,status:row.active?'active':'inactive',updatedAt:row.updated_at,source:'ops_products'})),
    ...locations.map(row=>object({id:row.public_id,type:'location',title:row.name,subtitle:row.code,status:row.active?'active':'inactive',updatedAt:row.updated_at,source:'ops_locations'})),
    ...suppliers.map(row=>object({id:row.public_id,type:'supplier',title:row.name,subtitle:row.email||'',status:row.active?'active':'inactive',updatedAt:row.updated_at,source:'ops_suppliers'})),
    ...purchaseOrders.map(row=>object({id:row.public_id,type:'purchase_order',title:row.public_id,subtitle:row.supplier_name,status:row.status,updatedAt:row.updated_at,source:'ops_purchase_orders',meta:{expectedOn:row.expected_on}})),
    ...repairs.map(row=>object({id:row.public_id,type:'repair',title:row.subject,subtitle:row.public_id,status:row.status,updatedAt:row.updated_at,source:'ops_repair_jobs',meta:{priority:row.priority}})),
    ...returns.map(row=>object({id:row.public_id,type:'return',title:row.reason,subtitle:row.disposition||row.public_id,status:row.status,updatedAt:row.updated_at,source:'ops_rmas'})),
    ...reservations.map(row=>object({id:row.public_id,type:'order',title:row.order_reference||row.public_id,subtitle:row.tracking_number||'',status:row.status,updatedAt:row.updated_at,source:'ops_reservations'})),
    ...agreements.map(row=>object({id:row.public_id,type:'agreement',title:row.title,subtitle:row.agreement_type,status:row.status,updatedAt:row.updated_at,source:'ops_agreements',meta:{renewalOn:row.renewal_on}})),
    ...staff.map(row=>object({id:row.public_id,type:'employee',title:row.name,subtitle:row.skills||row.email||'',status:row.active?'active':'inactive',updatedAt:row.updated_at,source:'ops_staff'})),
    ...appointments.map(row=>object({id:row.public_id,type:'appointment',title:row.title,subtitle:row.starts_at||'',status:row.status,updatedAt:row.updated_at,source:'ops_appointments'})),
    ...contacts.map(row=>object({id:row.public_id,type:'customer',title:row.name,subtitle:row.company_name||row.email||'',status:row.stage,updatedAt:row.updated_at,source:'ops_crm_contacts'})),
    ...quotes.map(row=>object({id:row.public_id,type:'quote',title:row.title,subtitle:`${row.currency||'EUR'} ${Number(row.total_cents||0)/100}`,status:row.status,updatedAt:row.updated_at,source:'ops_quotes'})),
    ...recalls.map(row=>object({id:row.public_id,type:'recall',title:row.title,subtitle:row.severity,status:row.status,updatedAt:row.updated_at,source:'ops_recall_campaigns'})),
    ...passports.map(row=>object({id:row.public_id,type:'passport',title:row.title,subtitle:row.kind,status:row.status,updatedAt:row.updated_at,source:'ownership_passports'})),
    ...offers.map(row=>object({id:row.public_id,type:'offer',title:row.title,subtitle:row.kind,status:row.status,updatedAt:row.updated_at,source:'commerce_offers'})),
    ...orders.map(row=>object({id:row.public_id,type:'order',title:row.public_id,subtitle:`${row.currency||'EUR'} ${Number(row.amount_cents||0)/100}`,status:row.status,updatedAt:row.updated_at,source:'commerce_orders'})),
    ...services.map(row=>object({id:row.public_id,type:'service',title:row.title,subtitle:row.customer_name||'',status:row.status,updatedAt:row.updated_at,source:'service_engagements'})),
    ...contracts.map(row=>object({id:row.id,type:'contract',title:row.title,subtitle:row.contract_type,status:row.status,updatedAt:row.updated_at,source:'service_contracts',meta:{renewalOn:row.renewal_date}})),
    ...assets.map(row=>object({id:row.public_id,type:'asset',title:row.title,subtitle:row.category,status:row.status,updatedAt:row.updated_at,source:'business_assets'})),
    ...cases.map(row=>object({id:row.public_id,type:'case',title:row.title||row.public_id,subtitle:row.case_type,status:row.status,updatedAt:row.updated_at,source:'consumer_cases'})),
    ...branches.map(row=>object({id:row.id,type:'location',title:row.name,subtitle:row.city||'',status:row.status,updatedAt:row.updated_at,source:'merchant_branches'})),
    ...tasks.map(row=>object({id:row.id,type:'task',title:row.title,subtitle:row.priority,status:row.status,updatedAt:row.updated_at,source:'merchant_tasks'})),
    ...commitments.map(row=>object({id:row.id,type:'commitment',title:row.title,subtitle:row.updated_at||'',status:row.status,updatedAt:row.updated_at,source:'merchant_commitments'})),
    ...supplierClaims.map(row=>object({id:row.id,type:'supplier_claim',title:row.product_name||row.claim_type,subtitle:row.supplier_name,status:row.status,updatedAt:row.updated_at,source:'merchant_supplier_claims'})),
    ...labels.map(row=>object({id:row.public_id,type:'price_label',title:row.title,subtitle:row.sku,status:row.status,updatedAt:row.updated_at,source:'esl_labels'})),
    ...workObjects.map(row=>object({id:row.public_id,type:row.object_type,title:row.title,subtitle:row.subtitle||row.reference||'',status:row.status,updatedAt:row.updated_at,source:'companyos_work_objects'}))
  ];
}

async function derivedSituations(env,company){
  const org=company.organization_id;
  const [lowStock,lateOrders,repairs,renewals,tasks,approvals,cases,states]=await Promise.all([
    safeAll(env,`SELECT p.public_id,p.name,p.reorder_level,COALESCE(SUM(b.quantity-b.reserved),0) available FROM ops_products p LEFT JOIN ops_stock_balances b ON b.product_id=p.id WHERE p.organization_id=? AND p.active=1 GROUP BY p.id HAVING available<=p.reorder_level ORDER BY available LIMIT 30`,[org]),
    safeAll(env,`SELECT po.public_id,po.expected_on,s.name supplier_name FROM ops_purchase_orders po JOIN ops_suppliers s ON s.id=po.supplier_id WHERE po.organization_id=? AND po.status NOT IN ('received','cancelled') AND po.expected_on<? ORDER BY po.expected_on LIMIT 30`,[org,today()]),
    safeAll(env,`SELECT public_id,subject,status,priority,updated_at FROM ops_repair_jobs WHERE organization_id=? AND status NOT IN ('completed','cancelled') ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,updated_at LIMIT 30`,[org]),
    safeAll(env,`SELECT public_id,title,renewal_on FROM ops_agreements WHERE organization_id=? AND status='active' AND renewal_on BETWEEN ? AND date(?,'+30 day') ORDER BY renewal_on LIMIT 30`,[org,today(),today()]),
    safeAll(env,`SELECT id,title,priority,due_at FROM merchant_tasks WHERE organization_id=? AND status IN ('open','doing') AND due_at<? ORDER BY due_at LIMIT 30`,[org,now()]),
    safeAll(env,`SELECT id,action_type,amount,currency,created_at FROM merchant_approval_requests WHERE organization_id=? AND status='pending' ORDER BY created_at LIMIT 30`,[org]),
    safeAll(env,`SELECT public_id,product_name,status,updated_at FROM consumer_cases WHERE organization_id=? AND status NOT IN ('resolved','closed','rejected') AND updated_at<datetime('now','-48 hours') ORDER BY updated_at LIMIT 30`,[org]),
    safeAll(env,`SELECT derived_id,status,assigned_member_id,note,updated_at FROM companyos_situation_states WHERE organization_id=?`,[org])
  ]);
  const stateMap=new Map(states.map(row=>[row.derived_id,row]));
  const list=[];
  const push=item=>{const state=stateMap.get(item.publicId);list.push({...item,status:state?.status||item.status||'open',assignedMemberId:state?.assigned_member_id||null,note:state?.note||null,updatedAt:state?.updated_at||item.updatedAt})};
  lowStock.forEach(row=>push({publicId:`stock:${row.public_id}`,kind:'inventory',title:`${row.name} needs stock`,description:`${row.available} available; reorder point ${row.reorder_level}.`,cause:'available inventory is at or below the reorder point',severity:Number(row.available)<=0?'critical':'high',status:'open',objects:[{type:'product',id:row.public_id}],recommendedActions:['Adjust stock','Create purchase order']}));
  lateOrders.forEach(row=>push({publicId:`purchase:${row.public_id}`,kind:'supply',title:`${row.public_id} is late`,description:`Expected ${row.expected_on} from ${row.supplier_name}.`,cause:'expected receipt date passed without full receiving',severity:'high',status:'open',objects:[{type:'purchase_order',id:row.public_id}],recommendedActions:['Review supplier','Receive order']}));
  repairs.forEach(row=>push({publicId:`repair:${row.public_id}`,kind:'repair',title:row.subject,description:`Repair ${row.public_id} is ${row.status}.`,cause:'open repair requires operational attention',severity:row.priority==='urgent'?'critical':row.priority==='high'?'high':'normal',status:'open',objects:[{type:'repair',id:row.public_id}],recommendedActions:['Open repair','Update status']}));
  renewals.forEach(row=>push({publicId:`renewal:${row.public_id}`,kind:'renewal',title:`${row.title} renews soon`,description:`Renewal date ${row.renewal_on}.`,cause:'agreement renewal is within 30 days',severity:'normal',status:'open',objects:[{type:'agreement',id:row.public_id}],recommendedActions:['Review agreement']}));
  tasks.forEach(row=>push({publicId:`task:${row.id}`,kind:'task',title:row.title,description:`Task was due ${row.due_at}.`,cause:'assigned work is overdue',severity:row.priority==='urgent'?'critical':'high',status:'open',objects:[{type:'task',id:row.id}],recommendedActions:['Open task','Mark complete']}));
  approvals.forEach(row=>push({publicId:`approval:${row.id}`,kind:'approval',title:`Approval: ${row.action_type}`,description:row.amount==null?'Decision is waiting for review.':`${row.amount} ${row.currency||''} is waiting for review.`,cause:'sensitive action requires an authorized decision',severity:'high',status:'open',objects:[{type:'approval',id:row.id}],recommendedActions:['Review approval']}));
  cases.forEach(row=>push({publicId:`case:${row.public_id}`,kind:'case',title:`${row.product_name||row.public_id} needs attention`,description:`Buyer case ${row.public_id} has been inactive for more than 48 hours.`,cause:'open buyer case has no recent progress',severity:'high',status:'open',objects:[{type:'case',id:row.public_id}],recommendedActions:['Open case','Contact buyer']}));
  const manual=await safeAll(env,`SELECT s.*,m.email assigned_email FROM companyos_situations s LEFT JOIN merchant_members m ON m.id=s.assigned_member_id WHERE s.organization_id=? AND s.status<>'archived' ORDER BY s.updated_at DESC LIMIT 100`,[org]);
  for(const row of manual){
    const links=await safeAll(env,`SELECT object_type type,object_public_id id,relationship FROM companyos_situation_links WHERE situation_id=?`,[row.id]);
    list.push({publicId:row.public_id,kind:'manual',title:row.title,description:row.description||'',cause:row.cause||'',severity:row.severity,status:row.status,assignedMemberId:row.assigned_member_id,assignedEmail:row.assigned_email||null,aiInsight:row.ai_insight||null,objects:links,recommendedActions:['Open situation','Update status'],updatedAt:row.updated_at});
  }
  const rank={critical:0,high:1,normal:2,low:3};
  return list.filter(item=>!['resolved','dismissed','archived'].includes(item.status)).sort((a,b)=>(rank[a.severity]??2)-(rank[b.severity]??2)||String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
}

async function companyPulse(env,company,situations,objects){
  const org=company.organization_id;
  const [inventory,orders,services,cases,tasks,revenue]=await Promise.all([
    safeFirst(env,`SELECT COALESCE(SUM(quantity),0) units,COALESCE(SUM(reserved),0) reserved FROM ops_stock_balances WHERE organization_id=?`,[org]),
    safeFirst(env,`SELECT COUNT(*) total,SUM(CASE WHEN status NOT IN ('completed','cancelled','refunded') THEN 1 ELSE 0 END) open FROM commerce_orders WHERE organization_id=?`,[org]),
    safeFirst(env,`SELECT COUNT(*) total,SUM(CASE WHEN status NOT IN ('completed','cancelled') THEN 1 ELSE 0 END) open FROM service_engagements WHERE organization_id=?`,[org]),
    safeFirst(env,`SELECT COUNT(*) total,SUM(CASE WHEN status NOT IN ('resolved','closed','rejected') THEN 1 ELSE 0 END) open FROM consumer_cases WHERE organization_id=?`,[org]),
    safeFirst(env,`SELECT COUNT(*) total,SUM(CASE WHEN status IN ('open','doing') THEN 1 ELSE 0 END) open FROM merchant_tasks WHERE organization_id=?`,[org]),
    safeFirst(env,`SELECT COALESCE(SUM(amount_cents),0) cents FROM commerce_orders WHERE organization_id=? AND status IN ('paid','confirmed','fulfilled','completed')`,[org])
  ]);
  const critical=situations.filter(item=>item.severity==='critical').length;
  const high=situations.filter(item=>item.severity==='high').length;
  const pressure=Math.min(100,critical*20+high*8+Number(tasks?.open||0)*2+Number(cases?.open||0)*3);
  return{
    health:Math.max(0,100-pressure),
    status:pressure>=60?'needs_attention':pressure>=25?'watch':'healthy',
    summary:{situations:situations.length,critical,high,objects:objects.length,inventoryUnits:Number(inventory?.units||0),reservedUnits:Number(inventory?.reserved||0),orders:Number(orders?.open||0),services:Number(services?.open||0),cases:Number(cases?.open||0),tasks:Number(tasks?.open||0),recognizedOrderValueCents:Number(revenue?.cents||0)},
    changedAt:now(),
    methodology:'deterministic-company-data-v1'
  };
}

async function bootstrap(env,company){
  const [objects,situations,members,notifications,verification]=await Promise.all([
    livingObjects(env,company,35),
    derivedSituations(env,company),
    safeAll(env,`SELECT id,email,role,status FROM merchant_members WHERE organization_id=? AND status='active' ORDER BY email`,[company.organization_id]),
    safeAll(env,`SELECT id,title,body,severity,created_at,read_at FROM notifications WHERE scope_type='organization' AND scope_id=? ORDER BY created_at DESC LIMIT 20`,[company.organization_id]),
    safeFirst(env,`SELECT status,review_note,updated_at FROM merchant_verification_requests WHERE organization_id=?`,[company.organization_id])
  ]);
  const pulse=await companyPulse(env,company,situations,objects);
  return json({
    mode:'live',
    organization:{id:company.organization_id,name:company.organization_name,slug:company.organization_slug,status:company.organization_status},
    member:{id:company.member_id,email:company.email,role:company.role},
    verification:verification||{status:company.organization_status==='verified'?'approved':'draft'},
    permissions:{write:canWrite(company),manage:canManage(company),buyerFacing:company.organization_status==='verified',financial:company.organization_status==='verified'&&['owner','admin','manager'].includes(company.role)},
    situations:situations.slice(0,60),
    livingObjects:objects.sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,160),
    pulse,
    members,
    notifications,
    capabilities:{
      inventory:true,traceability:true,supply:true,repairs:true,returns:true,warranty:true,orders:true,agreements:true,crm:true,appointments:true,recalls:true,analytics:true,passports:true,commerce:true,services:true,lifecycle:true,inbox:true,rewards:true,branches:true,verification:true,integrations:'webhook_only',dailyOperations:true,deliveryControl:true,capacity:true,customer360:true,automation:'manual_apply',supplierClaims:true,notifications:'in_app',b2bAssets:true
    },
    generatedAt:now()
  });
}

function validObjectType(value){return /^[a-z][a-z0-9_]{1,39}$/.test(value)}
function validStatus(value){return ['open','monitoring','resolved','dismissed','archived'].includes(value)}
function validSeverity(value){return ['low','normal','high','critical'].includes(value)}

async function createSituation(request,env,company){
  if(!canWrite(company))return json({error:'forbidden'},403);
  const body=await request.json().catch(()=>null);
  if(!body)return json({error:'invalid_json'},400);
  const title=clean(body.title,180),description=clean(body.description,2000),cause=clean(body.cause,1200),severity=validSeverity(body.severity)?body.severity:'normal';
  if(title.length<3)return json({error:'invalid_situation'},422);
  const internal=uid('cos_'),pid=publicId('SIT'),timestamp=now();
  const assigned=clean(body.assignedMemberId,100)||null;
  if(assigned&&!await safeFirst(env,`SELECT id FROM merchant_members WHERE id=? AND organization_id=? AND status='active'`,[assigned,company.organization_id]))return json({error:'invalid_assignee'},422);
  const links=Array.isArray(body.objects)?body.objects.slice(0,50).filter(item=>validObjectType(clean(item.type,40))&&clean(item.id,120)):[];
  const statements=[env.DB.prepare(`INSERT INTO companyos_situations(id,public_id,organization_id,title,description,cause,severity,status,assigned_member_id,ai_insight,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,'open',?,?,?, ?,?)`).bind(internal,pid,company.organization_id,title,description||null,cause||null,severity,assigned,clean(body.insight,2000)||null,company.member_id,timestamp,timestamp)];
  links.forEach(item=>statements.push(env.DB.prepare(`INSERT INTO companyos_situation_links(id,organization_id,situation_id,object_type,object_public_id,relationship,created_at) VALUES(?,?,?,?,?,?,?)`).bind(uid('csl_'),company.organization_id,internal,clean(item.type,40),clean(item.id,120),clean(item.relationship,60)||'affected',timestamp)));
  statements.push(env.DB.prepare(`INSERT INTO companyos_events(id,public_id,organization_id,object_type,object_public_id,event_type,title,details_json,occurred_at,created_by_member_id,created_at) VALUES(?,?,?,?,?,'situation.created',?,?,?, ?,?)`).bind(uid('coe_'),publicId('EVT'),company.organization_id,'situation',pid,title,JSON.stringify({severity,links:links.length}),timestamp,company.member_id,timestamp));
  await env.DB.batch(statements);
  return json({ok:true,publicId:pid},201);
}

async function updateSituation(request,env,company,id){
  if(!canWrite(company))return json({error:'forbidden'},403);
  const body=await request.json().catch(()=>null);
  if(!body)return json({error:'invalid_json'},400);
  const status=validStatus(body.status)?body.status:null,assigned=Object.prototype.hasOwnProperty.call(body,'assignedMemberId')?(clean(body.assignedMemberId,100)||null):undefined,note=clean(body.note,1500);
  if(!status&&assigned===undefined&&!note)return json({error:'no_changes'},422);
  if(assigned&& !await safeFirst(env,`SELECT id FROM merchant_members WHERE id=? AND organization_id=? AND status='active'`,[assigned,company.organization_id]))return json({error:'invalid_assignee'},422);
  const manual=await safeFirst(env,`SELECT id,public_id,status,assigned_member_id FROM companyos_situations WHERE organization_id=? AND public_id=?`,[company.organization_id,id]);
  const timestamp=now();
  if(manual){
    await env.DB.batch([
      env.DB.prepare(`UPDATE companyos_situations SET status=COALESCE(?,status),assigned_member_id=CASE WHEN ?=1 THEN ? ELSE assigned_member_id END,updated_at=? WHERE id=?`).bind(status,assigned===undefined?0:1,assigned||null,timestamp,manual.id),
      env.DB.prepare(`INSERT INTO companyos_events(id,public_id,organization_id,object_type,object_public_id,event_type,title,details_json,occurred_at,created_by_member_id,created_at) VALUES(?,?,?,?,?,'situation.updated',?,?,?, ?,?)`).bind(uid('coe_'),publicId('EVT'),company.organization_id,'situation',manual.public_id,'Situation updated',JSON.stringify({status,assignedMemberId:assigned,note}),timestamp,company.member_id,timestamp)
    ]);
  }else{
    if(!/^[a-z_]+:.+/.test(id))return json({error:'not_found'},404);
    await env.DB.prepare(`INSERT INTO companyos_situation_states(organization_id,derived_id,status,assigned_member_id,note,updated_at,updated_by_member_id) VALUES(?,?,?,?,?,?,?) ON CONFLICT(organization_id,derived_id) DO UPDATE SET status=COALESCE(excluded.status,companyos_situation_states.status),assigned_member_id=CASE WHEN ?=1 THEN excluded.assigned_member_id ELSE companyos_situation_states.assigned_member_id END,note=COALESCE(excluded.note,companyos_situation_states.note),updated_at=excluded.updated_at,updated_by_member_id=excluded.updated_by_member_id`).bind(company.organization_id,id,status||'open',assigned||null,note||null,timestamp,company.member_id,assigned===undefined?0:1).run();
    await env.DB.prepare(`INSERT INTO companyos_events(id,public_id,organization_id,object_type,object_public_id,event_type,title,details_json,occurred_at,created_by_member_id,created_at) VALUES(?,?,?,?,?,'situation.updated',?,?,?, ?,?)`).bind(uid('coe_'),publicId('EVT'),company.organization_id,'situation',id,'Derived situation updated',JSON.stringify({status,assignedMemberId:assigned,note}),timestamp,company.member_id,timestamp).run();
  }
  return json({ok:true,status:status||undefined,assignedMemberId:assigned});
}

async function createRelationship(request,env,company){
  if(!canWrite(company))return json({error:'forbidden'},403);
  const body=await request.json().catch(()=>null);
  if(!body)return json({error:'invalid_json'},400);
  const fromType=clean(body.fromType,40),fromId=clean(body.fromId,120),toType=clean(body.toType,40),toId=clean(body.toId,120),relationship=clean(body.relationship,60);
  if(!validObjectType(fromType)||!validObjectType(toType)||!fromId||!toId||relationship.length<2)return json({error:'invalid_relationship'},422);
  const pid=publicId('REL'),timestamp=now();
  try{await env.DB.batch([
    env.DB.prepare(`INSERT INTO companyos_relationships(id,public_id,organization_id,from_type,from_public_id,to_type,to_public_id,relationship,created_by_member_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(uid('cor_'),pid,company.organization_id,fromType,fromId,toType,toId,relationship,company.member_id,timestamp),
    env.DB.prepare(`INSERT INTO companyos_events(id,public_id,organization_id,object_type,object_public_id,event_type,title,details_json,occurred_at,created_by_member_id,created_at) VALUES(?,?,?,?,?,'relationship.created',?,?,?, ?,?)`).bind(uid('coe_'),publicId('EVT'),company.organization_id,fromType,fromId,'Relationship created',JSON.stringify({toType,toId,relationship}),timestamp,company.member_id,timestamp)
  ])}catch(error){if(String(error).includes('UNIQUE'))return json({error:'relationship_exists'},409);throw error}
  return json({ok:true,publicId:pid},201);
}

async function createEvent(request,env,company){
  if(!canWrite(company))return json({error:'forbidden'},403);
  const body=await request.json().catch(()=>null);
  if(!body)return json({error:'invalid_json'},400);
  const objectType=clean(body.objectType,40),objectId=clean(body.objectId,120),eventType=clean(body.eventType,80),title=clean(body.title,180),occurredAt=clean(body.occurredAt,35)||now();
  if(!validObjectType(objectType)||!objectId||eventType.length<3||title.length<2||Number.isNaN(Date.parse(occurredAt)))return json({error:'invalid_event'},422);
  const pid=publicId('EVT'),timestamp=now();
  await env.DB.prepare(`INSERT INTO companyos_events(id,public_id,organization_id,object_type,object_public_id,event_type,title,details_json,occurred_at,created_by_member_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(uid('coe_'),pid,company.organization_id,objectType,objectId,eventType,title,JSON.stringify(body.details||{}).slice(0,5000),occurredAt,company.member_id,timestamp).run();
  return json({ok:true,publicId:pid},201);
}

async function createDocument(request,env,company){
  if(!canWrite(company))return json({error:'forbidden'},403);
  const body=await request.json().catch(()=>null);
  if(!body)return json({error:'invalid_json'},400);
  const objectType=clean(body.objectType,40),objectId=clean(body.objectId,120),title=clean(body.title,180),documentType=clean(body.documentType,60),reference=clean(body.reference,240),mime=clean(body.mimeType,120);
  let externalUrl=null;
  if(body.externalUrl){try{const parsed=new URL(body.externalUrl);if(parsed.protocol!=='https:')throw new Error();externalUrl=parsed.toString()}catch{return json({error:'invalid_document_url'},422)}}
  if(!validObjectType(objectType)||!objectId||title.length<2||documentType.length<2||(!externalUrl&&!reference))return json({error:'invalid_document'},422);
  const pid=publicId('DOC'),timestamp=now();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO companyos_documents(id,public_id,organization_id,object_type,object_public_id,title,document_type,mime_type,external_url,reference,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uid('cod_'),pid,company.organization_id,objectType,objectId,title,documentType,mime||null,externalUrl,reference||null,company.member_id,timestamp,timestamp),
    env.DB.prepare(`INSERT INTO companyos_events(id,public_id,organization_id,object_type,object_public_id,event_type,title,details_json,occurred_at,created_by_member_id,created_at) VALUES(?,?,?,?,?,'document.attached',?,?,?, ?,?)`).bind(uid('coe_'),publicId('EVT'),company.organization_id,objectType,objectId,title,JSON.stringify({documentId:pid,documentType}),timestamp,company.member_id,timestamp)
  ]);
  return json({ok:true,publicId:pid},201);
}

async function createWorkObject(request,env,company){
  if(!canWrite(company))return json({error:'forbidden'},403);
  const body=await request.json().catch(()=>null);
  if(!body)return json({error:'invalid_json'},400);
  const objectType=clean(body.objectType,40),title=clean(body.title,180),subtitle=clean(body.subtitle,300),status=clean(body.status,40)||'active',reference=clean(body.reference,180);
  const allowed=new Set(['project','shipment','document','conversation','campaign','integration']);
  if(!allowed.has(objectType)||title.length<2)return json({error:'invalid_object'},422);
  const pid=publicId(objectType.slice(0,3).toUpperCase()),timestamp=now();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO companyos_work_objects(id,public_id,organization_id,object_type,title,subtitle,status,reference,data_json,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uid('cow_'),pid,company.organization_id,objectType,title,subtitle||null,status,reference||null,JSON.stringify(body.data||{}).slice(0,8000),company.member_id,timestamp,timestamp),
    env.DB.prepare(`INSERT INTO companyos_events(id,public_id,organization_id,object_type,object_public_id,event_type,title,details_json,occurred_at,created_by_member_id,created_at) VALUES(?,?,?,?,?,'object.created',?,?,?, ?,?)`).bind(uid('coe_'),publicId('EVT'),company.organization_id,objectType,pid,title,JSON.stringify({reference}),timestamp,company.member_id,timestamp)
  ]);
  return json({ok:true,publicId:pid},201);
}

async function objectDetail(env,company,type,id){
  const objects=await livingObjects(env,company,150);
  const selected=objects.find(item=>item.type===type&&item.id===id);
  if(!selected)return json({error:'not_found'},404);
  const [events,documents,relationships,auditRows]=await Promise.all([
    safeAll(env,`SELECT public_id,event_type,title,details_json,occurred_at,created_at FROM companyos_events WHERE organization_id=? AND object_type=? AND object_public_id=? ORDER BY occurred_at DESC LIMIT 100`,[company.organization_id,type,id]),
    safeAll(env,`SELECT public_id,title,document_type,mime_type,external_url,reference,created_at FROM companyos_documents WHERE organization_id=? AND object_type=? AND object_public_id=? ORDER BY created_at DESC LIMIT 100`,[company.organization_id,type,id]),
    safeAll(env,`SELECT public_id,from_type,from_public_id,to_type,to_public_id,relationship,created_at FROM companyos_relationships WHERE organization_id=? AND ((from_type=? AND from_public_id=?) OR (to_type=? AND to_public_id=?)) ORDER BY created_at DESC LIMIT 100`,[company.organization_id,type,id,type,id]),
    safeAll(env,`SELECT action,action title,details_json,created_at FROM ops_audit_log WHERE organization_id=? AND entity_id=? UNION ALL SELECT event_type action,event_type title,payload_json details_json,created_at FROM merchant_audit_events WHERE organization_id=? AND payload_json LIKE ? ORDER BY created_at DESC LIMIT 100`,[company.organization_id,id,company.organization_id,`%${id}%`])
  ]);
  return json({object:selected,events:events.map(item=>({...item,details:safeJson(item.details_json),details_json:undefined})),documents,relationships,audit:auditRows.map(item=>({...item,details:safeJson(item.details_json),details_json:undefined})),trust:{source:'company-authorized-records',scope:'Only records belonging to the active company and explicitly connected buyer records are available.',canBroadenAccess:false}});
}

async function search(env,company,query){
  const q=clean(query,120);
  if(q.length<2)return json({results:[]});
  const lowered=q.toLocaleLowerCase();
  const objects=await livingObjects(env,company,100);
  const results=objects.filter(item=>`${item.id} ${item.title} ${item.subtitle} ${item.type} ${item.status}`.toLocaleLowerCase().includes(lowered)).slice(0,100);
  return json({query:q,results});
}

async function memory(env,company,query){
  const q=clean(query,120);
  if(q.length<2)return json({query:q,results:[],answer:null});
  const term=`%${q}%`,org=company.organization_id;
  const [ops,merchant,notes,knowledge,events]=await Promise.all([
    safeAll(env,`SELECT action title,entity_type kind,entity_id reference,details_json body,created_at FROM ops_audit_log WHERE organization_id=? AND (action LIKE ? OR entity_type LIKE ? OR entity_id LIKE ? OR details_json LIKE ?) ORDER BY created_at DESC LIMIT 30`,[org,term,term,term,term]),
    safeAll(env,`SELECT event_type title,'case_event' kind,COALESCE(case_id,'') reference,payload_json body,created_at FROM merchant_audit_events WHERE organization_id=? AND (event_type LIKE ? OR payload_json LIKE ?) ORDER BY created_at DESC LIMIT 30`,[org,term,term]),
    safeAll(env,`SELECT 'Internal note' title,'note' kind,case_id reference,body,created_at FROM merchant_internal_notes WHERE organization_id=? AND body LIKE ? ORDER BY created_at DESC LIMIT 30`,[org,term]),
    safeAll(env,`SELECT title,'knowledge' kind,topic reference,body,updated_at created_at FROM merchant_knowledge WHERE organization_id=? AND active=1 AND (title LIKE ? OR topic LIKE ? OR body LIKE ?) ORDER BY updated_at DESC LIMIT 30`,[org,term,term,term]),
    safeAll(env,`SELECT title,event_type kind,object_public_id reference,details_json body,occurred_at created_at FROM companyos_events WHERE organization_id=? AND (title LIKE ? OR event_type LIKE ? OR object_public_id LIKE ? OR details_json LIKE ?) ORDER BY occurred_at DESC LIMIT 30`,[org,term,term,term,term])
  ]);
  const results=[...ops,...merchant,...notes,...knowledge,...events].sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,60).map(row=>({...row,body:typeof row.body==='string'&&row.body.startsWith('{')?safeJson(row.body):row.body}));
  return json({query:q,results,answer:results.length?`Found ${results.length} authorized company-memory records related to “${q}”.`:null,method:'authorized-deterministic-retrieval',generatedAt:now()});
}

async function auditLog(env,company){
  if(!canManage(company))return json({error:'forbidden'},403);
  const rows=await safeAll(env,`SELECT request_id,action,method,path,status,duration_ms,details_json,created_at FROM platform_audit_events WHERE organization_id=? ORDER BY created_at DESC LIMIT 300`,[company.organization_id]);
  return json({events:rows.map(row=>({...row,details:safeJson(row.details_json),details_json:undefined})),readOnly:true});
}

function actionFor(request,path){
  if(path==='/api/v1/companyos/bootstrap')return 'companyos.bootstrap.read';
  if(path==='/api/v1/companyos/search')return 'companyos.search';
  if(path==='/api/v1/companyos/memory')return 'companyos.memory.read';
  if(path==='/api/v1/companyos/audit')return 'companyos.audit.read';
  if(path.startsWith('/api/v1/companyos/situations'))return request.method==='GET'?'companyos.situation.read':request.method==='POST'?'companyos.situation.create':'companyos.situation.update';
  if(path.startsWith('/api/v1/companyos/objects/'))return 'companyos.object.read';
  if(path==='/api/v1/companyos/objects')return 'companyos.object.create';
  if(path==='/api/v1/companyos/relationships')return 'companyos.relationship.create';
  if(path==='/api/v1/companyos/events')return 'companyos.event.create';
  if(path==='/api/v1/companyos/documents')return 'companyos.document.create';
  return 'companyos.unknown';
}

async function platformAudit(env,company,request,path,response,requestId,started){
  try{
    await env.DB.prepare(`INSERT INTO platform_audit_events(id,request_id,organization_id,member_id,action,method,path,status,duration_ms,details_json,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(uid('pae_'),requestId,company?.organization_id||null,company?.member_id||null,actionFor(request,path),request.method,path,response.status,Date.now()-started,JSON.stringify({role:company?.role||null}).slice(0,1000),now()).run();
  }catch(error){console.error('companyos_audit_error',error)}
}

async function route(request,env,company,path,url){
  if(path==='/api/v1/companyos/bootstrap'&&request.method==='GET')return bootstrap(env,company);
  if(path==='/api/v1/companyos/search'&&request.method==='GET')return search(env,company,url.searchParams.get('q'));
  if(path==='/api/v1/companyos/memory'&&request.method==='GET')return memory(env,company,url.searchParams.get('q'));
  if(path==='/api/v1/companyos/audit'&&request.method==='GET')return auditLog(env,company);
  if(path==='/api/v1/companyos/situations'&&request.method==='GET')return json({situations:await derivedSituations(env,company)});
  if(path==='/api/v1/companyos/situations'&&request.method==='POST')return createSituation(request,env,company);
  let match=path.match(/^\/api\/v1\/companyos\/situations\/(.+)$/);
  if(match&&request.method==='PATCH')return updateSituation(request,env,company,decodeURIComponent(match[1]));
  match=path.match(/^\/api\/v1\/companyos\/objects\/([a-z0-9_]+)\/(.+)$/);
  if(match&&request.method==='GET')return objectDetail(env,company,match[1],decodeURIComponent(match[2]));
  if(path==='/api/v1/companyos/objects'&&request.method==='POST')return createWorkObject(request,env,company);
  if(path==='/api/v1/companyos/relationships'&&request.method==='POST')return createRelationship(request,env,company);
  if(path==='/api/v1/companyos/events'&&request.method==='POST')return createEvent(request,env,company);
  if(path==='/api/v1/companyos/documents'&&request.method==='POST')return createDocument(request,env,company);
  return json({error:'not_found'},404);
}

export default{
  async fetch(request,env,ctx){
    const url=new URL(request.url),path=url.pathname;
    if(!path.startsWith('/api/v1/companyos/'))return app.fetch(request,env,ctx);
    if(!env.DB)return json({error:'database_not_configured'},503);
    const requestId=crypto.randomUUID(),started=Date.now();
    let company=null,response;
    try{
      await ensureSchema(env);
      company=await session(request,env);
      if(!company)response=json({error:'unauthorized'},401);
      else if(!['GET','HEAD'].includes(request.method)&&!sameOrigin(request))response=json({error:'origin_not_allowed'},403);
      else if(!await rateLimit(env,company,request))response=json({error:'rate_limited'},429,{'retry-after':'60'});
      else response=await route(request,env,company,path,url);
    }catch(error){
      console.error('companyos_error',error);
      response=json({error:'internal_error',requestId},500);
    }
    await platformAudit(env,company,request,path,response,requestId,started);
    const headers=new Headers(response.headers);
    headers.set('x-request-id',requestId);
    return new Response(response.body,{status:response.status,headers});
  }
};
