import app from './worker-v107.js';

const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}${crypto.randomUUID().replaceAll('-','')}`;
const publicId=prefix=>`${prefix}-${crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
const clean=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';
const integer=(value,min=-100000000,max=100000000)=>Number.isInteger(Number(value))?Math.max(min,Math.min(max,Number(value))):null;
let schemaReady;

async function sha(value){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
function cookie(request,name){for(const part of(request.headers.get('cookie')||'').split(';')){const[key,...value]=part.trim().split('=');if(key===name)return decodeURIComponent(value.join('='))}return''}
function sameOrigin(request){const origin=request.headers.get('origin');return!origin||origin===new URL(request.url).origin}
async function companySession(request,env){const raw=cookie(request,'still_company');if(!raw)return null;return env.DB.prepare(`SELECT m.id member_id,m.role,o.id organization_id,o.name organization_name,o.status organization_status FROM merchant_sessions s JOIN merchant_members m ON m.id=s.member_id JOIN merchant_organizations o ON o.id=m.organization_id WHERE s.token_hash=? AND s.expires_at>? AND m.status='active'`).bind(await sha(raw),now()).first()}
function canWrite(company){return['owner','admin','manager'].includes(company.role)}

async function schema(env){if(!schemaReady)schemaReady=env.DB.batch([
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS inventory_locations(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,name TEXT NOT NULL,code TEXT NOT NULL,address TEXT,status TEXT NOT NULL DEFAULT 'active',created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(organization_id,code))`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS inventory_items(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,sku TEXT NOT NULL,name TEXT NOT NULL,barcode TEXT,unit TEXT NOT NULL DEFAULT 'unit',reorder_point INTEGER NOT NULL DEFAULT 0,active INTEGER NOT NULL DEFAULT 1,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(organization_id,sku))`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS inventory_balances(organization_id TEXT NOT NULL,item_id TEXT NOT NULL,location_id TEXT NOT NULL,on_hand INTEGER NOT NULL DEFAULT 0,reserved INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL,PRIMARY KEY(organization_id,item_id,location_id))`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS inventory_movements(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,item_id TEXT NOT NULL,location_id TEXT NOT NULL,quantity_delta INTEGER NOT NULL,reserved_delta INTEGER NOT NULL DEFAULT 0,reason TEXT NOT NULL,reference_type TEXT,reference_id TEXT,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL)`),
  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_inventory_locations_org ON inventory_locations(organization_id,status,name)'),
  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_inventory_items_org ON inventory_items(organization_id,active,name)'),
  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_inventory_movements_org_created ON inventory_movements(organization_id,created_at DESC)'),
  env.DB.prepare('PRAGMA optimize')
]).catch(error=>{schemaReady=undefined;throw error});await schemaReady}

function outputLocation(row){return{publicId:row.public_id,name:row.name,code:row.code,address:row.address||'',status:row.status,updatedAt:row.updated_at}}
function outputItem(row){return{publicId:row.public_id,sku:row.sku,name:row.name,barcode:row.barcode||'',unit:row.unit,reorderPoint:Number(row.reorder_point||0),active:!!row.active,updatedAt:row.updated_at}}

async function dashboard(env,company){
  const [locations,items,balances,movements]=await Promise.all([
    env.DB.prepare(`SELECT * FROM inventory_locations WHERE organization_id=? AND status<>'archived' ORDER BY name`).bind(company.organization_id).all(),
    env.DB.prepare(`SELECT * FROM inventory_items WHERE organization_id=? AND active=1 ORDER BY name`).bind(company.organization_id).all(),
    env.DB.prepare(`SELECT b.on_hand,b.reserved,b.updated_at,i.public_id item_public_id,i.sku,i.name item_name,i.unit,i.reorder_point,l.public_id location_public_id,l.name location_name,l.code location_code FROM inventory_balances b JOIN inventory_items i ON i.id=b.item_id JOIN inventory_locations l ON l.id=b.location_id WHERE b.organization_id=? ORDER BY i.name,l.name`).bind(company.organization_id).all(),
    env.DB.prepare(`SELECT m.public_id,m.quantity_delta,m.reserved_delta,m.reason,m.reference_type,m.reference_id,m.created_at,i.public_id item_public_id,i.sku,i.name item_name,l.public_id location_public_id,l.name location_name FROM inventory_movements m JOIN inventory_items i ON i.id=m.item_id JOIN inventory_locations l ON l.id=m.location_id WHERE m.organization_id=? ORDER BY m.created_at DESC LIMIT 100`).bind(company.organization_id).all()
  ]);
  const rows=(balances.results||[]).map(row=>({itemId:row.item_public_id,sku:row.sku,itemName:row.item_name,unit:row.unit,locationId:row.location_public_id,locationName:row.location_name,locationCode:row.location_code,onHand:Number(row.on_hand||0),reserved:Number(row.reserved||0),available:Number(row.on_hand||0)-Number(row.reserved||0),reorderPoint:Number(row.reorder_point||0),status:Number(row.on_hand||0)-Number(row.reserved||0)<=Number(row.reorder_point||0)?'reorder':'healthy',updatedAt:row.updated_at}));
  return json({mode:'live',organization:{name:company.organization_name,status:company.organization_status},locations:(locations.results||[]).map(outputLocation),items:(items.results||[]).map(outputItem),balances:rows,movements:movements.results||[],summary:{items:(items.results||[]).length,locations:(locations.results||[]).length,onHand:rows.reduce((sum,row)=>sum+row.onHand,0),reserved:rows.reduce((sum,row)=>sum+row.reserved,0),available:rows.reduce((sum,row)=>sum+row.available,0),reorder:rows.filter(row=>row.status==='reorder').length}})
}

async function createLocation(request,env,company){
  if(!canWrite(company))return json({error:'forbidden'},403);
  if(!sameOrigin(request))return json({error:'origin_not_allowed'},403);
  const body=await request.json().catch(()=>null);if(!body)return json({error:'invalid_json'},400);
  const name=clean(body.name,160),code=clean(body.code,40).toUpperCase().replace(/[^A-Z0-9_-]/g,''),address=clean(body.address,300);
  if(name.length<2||code.length<2)return json({error:'invalid_location'},422);
  const id=uid('loc_'),pid=publicId('LOC'),ts=now();
  try{await env.DB.prepare(`INSERT INTO inventory_locations(id,public_id,organization_id,name,code,address,status,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,'active',?,?,?)`).bind(id,pid,company.organization_id,name,code,address||null,company.member_id,ts,ts).run()}catch(error){if(String(error).includes('UNIQUE'))return json({error:'location_code_exists'},409);throw error}
  return json({ok:true,location:{publicId:pid,name,code,address,status:'active',updatedAt:ts}},201)
}

async function createItem(request,env,company){
  if(!canWrite(company))return json({error:'forbidden'},403);
  if(!sameOrigin(request))return json({error:'origin_not_allowed'},403);
  const body=await request.json().catch(()=>null);if(!body)return json({error:'invalid_json'},400);
  const sku=clean(body.sku,120).toUpperCase(),name=clean(body.name,220),barcode=clean(body.barcode,80),unit=clean(body.unit,30)||'unit',reorderPoint=integer(body.reorderPoint,0,100000000);
  if(sku.length<2||name.length<2||reorderPoint===null)return json({error:'invalid_item'},422);
  const id=uid('itm_'),pid=publicId('ITEM'),ts=now();
  try{await env.DB.prepare(`INSERT INTO inventory_items(id,public_id,organization_id,sku,name,barcode,unit,reorder_point,active,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,1,?,?,?)`).bind(id,pid,company.organization_id,sku,name,barcode||null,unit,reorderPoint,company.member_id,ts,ts).run()}catch(error){if(String(error).includes('UNIQUE'))return json({error:'sku_exists'},409);throw error}
  return json({ok:true,item:{publicId:pid,sku,name,barcode,unit,reorderPoint,active:true,updatedAt:ts}},201)
}

async function findRelation(env,table,company,publicIdValue){return env.DB.prepare(`SELECT * FROM ${table} WHERE organization_id=? AND public_id=?`).bind(company.organization_id,publicIdValue).first()}

async function adjust(request,env,company){
  if(!canWrite(company))return json({error:'forbidden'},403);
  if(!sameOrigin(request))return json({error:'origin_not_allowed'},403);
  const body=await request.json().catch(()=>null);if(!body)return json({error:'invalid_json'},400);
  const itemId=clean(body.itemId,80),locationId=clean(body.locationId,80),quantityDelta=integer(body.quantityDelta),reservedDelta=integer(body.reservedDelta||0),reason=clean(body.reason,300),referenceType=clean(body.referenceType,60),referenceId=clean(body.referenceId,120);
  if(!itemId||!locationId||quantityDelta===null||reservedDelta===null||(!quantityDelta&&!reservedDelta)||reason.length<3)return json({error:'invalid_adjustment'},422);
  const [item,location]=await Promise.all([findRelation(env,'inventory_items',company,itemId),findRelation(env,'inventory_locations',company,locationId)]);
  if(!item||!location)return json({error:'relation_not_found'},404);
  const current=await env.DB.prepare(`SELECT on_hand,reserved FROM inventory_balances WHERE organization_id=? AND item_id=? AND location_id=?`).bind(company.organization_id,item.id,location.id).first();
  const nextOnHand=Number(current?.on_hand||0)+quantityDelta,nextReserved=Number(current?.reserved||0)+reservedDelta;
  if(nextOnHand<0||nextReserved<0||nextReserved>nextOnHand)return json({error:'invalid_resulting_balance',current:{onHand:Number(current?.on_hand||0),reserved:Number(current?.reserved||0)},attempted:{onHand:nextOnHand,reserved:nextReserved}},409);
  const ts=now(),movementId=uid('mov_'),movementPublic=publicId('MOV');
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO inventory_balances(organization_id,item_id,location_id,on_hand,reserved,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(organization_id,item_id,location_id) DO UPDATE SET on_hand=excluded.on_hand,reserved=excluded.reserved,updated_at=excluded.updated_at`).bind(company.organization_id,item.id,location.id,nextOnHand,nextReserved,ts),
    env.DB.prepare(`INSERT INTO inventory_movements(id,public_id,organization_id,item_id,location_id,quantity_delta,reserved_delta,reason,reference_type,reference_id,created_by_member_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).bind(movementId,movementPublic,company.organization_id,item.id,location.id,quantityDelta,reservedDelta,reason,referenceType||null,referenceId||null,company.member_id,ts)
  ]);
  return json({ok:true,movement:{publicId:movementPublic,itemId,locationId,quantityDelta,reservedDelta,reason,createdAt:ts},balance:{onHand:nextOnHand,reserved:nextReserved,available:nextOnHand-nextReserved}},201)
}

export default{async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(!path.startsWith('/api/v1/business/inventory'))return app.fetch(request,env);
  if(!env.DB)return json({error:'database_not_configured'},503);
  try{
    await schema(env);
    const company=await companySession(request,env);if(!company)return json({error:'unauthorized'},401);
    if(path==='/api/v1/business/inventory'&&request.method==='GET')return dashboard(env,company);
    if(path==='/api/v1/business/inventory/locations'&&request.method==='POST')return createLocation(request,env,company);
    if(path==='/api/v1/business/inventory/items'&&request.method==='POST')return createItem(request,env,company);
    if(path==='/api/v1/business/inventory/adjustments'&&request.method==='POST')return adjust(request,env,company);
    return json({error:'not_found'},404)
  }catch(error){console.error('business_inventory_error',error);return json({error:'internal_error'},500)}
}};
