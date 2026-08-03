import app from './worker-v105.js';

const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}${crypto.randomUUID().replaceAll('-','')}`;
const publicId=prefix=>`${prefix}-${crypto.randomUUID().replaceAll('-','').slice(0,12).toUpperCase()}`;
const clean=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';
const cents=value=>Number.isFinite(Number(value))?Math.max(0,Math.min(100000000000,Math.round(Number(value)))):0;
const positive=(value,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):min;
const VENDORS=new Set(['generic','bluetooth_esl','vusion','pricer','solum','custom']);
const TRANSPORTS=new Set(['json','csv','sftp','rest_api','bluetooth_gateway','manual']);
const FORMATS=new Set(['still_json_v1','bluetooth_esl_adapter_v1','vendor_csv_v1','custom_json_v1']);
const TEMPLATES=new Set(['retail','grocery','promotion','service','minimal']);
const COLORS=new Set(['mono','tri_red','quad','full_color']);
let schemaReady;

async function sha(value){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
function cookie(request,name){for(const part of(request.headers.get('cookie')||'').split(';')){const[key,...value]=part.trim().split('=');if(key===name)return decodeURIComponent(value.join('='))}return''}
function sameOrigin(request){const origin=request.headers.get('origin');return!origin||origin===new URL(request.url).origin}
function safeUrl(value){const raw=clean(value,700);if(!raw)return null;try{const url=new URL(raw);return url.protocol==='https:'?url.toString():null}catch{return null}}

async function schema(env){if(!schemaReady)schemaReady=env.DB.batch([
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS esl_connectors(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,name TEXT NOT NULL,vendor TEXT NOT NULL,transport TEXT NOT NULL,store_reference TEXT,payload_format TEXT NOT NULL DEFAULT 'still_json_v1',status TEXT NOT NULL DEFAULT 'configured',created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS esl_labels(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,product_id TEXT,connector_id TEXT,sku TEXT NOT NULL,gtin TEXT,product_name TEXT NOT NULL,price_cents INTEGER NOT NULL,original_price_cents INTEGER,currency TEXT NOT NULL DEFAULT 'EUR',unit_text TEXT,promo_text TEXT,legal_text TEXT,template TEXT NOT NULL DEFAULT 'retail',width_mm REAL NOT NULL,height_mm REAL NOT NULL,width_px INTEGER NOT NULL,height_px INTEGER NOT NULL,orientation TEXT NOT NULL DEFAULT 'landscape',color_mode TEXT NOT NULL DEFAULT 'mono',qr_url TEXT,barcode_value TEXT,status TEXT NOT NULL DEFAULT 'draft',version INTEGER NOT NULL DEFAULT 1,last_synced_at TEXT,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS esl_price_updates(id TEXT PRIMARY KEY,public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,label_id TEXT NOT NULL,old_price_cents INTEGER NOT NULL,new_price_cents INTEGER NOT NULL,reason TEXT,effective_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'export_ready',payload_json TEXT NOT NULL,created_by_member_id TEXT NOT NULL,created_at TEXT NOT NULL,applied_at TEXT)`),
  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_esl_connectors_org_updated ON esl_connectors(organization_id,updated_at DESC)'),
  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_esl_labels_org_updated ON esl_labels(organization_id,updated_at DESC)'),
  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_esl_updates_org_created ON esl_price_updates(organization_id,created_at DESC)'),
  env.DB.prepare('PRAGMA optimize')
]).catch(error=>{schemaReady=undefined;throw error});await schemaReady}

async function companySession(request,env){const raw=cookie(request,'still_company');if(!raw)return null;return env.DB.prepare(`SELECT m.id member_id,m.role,o.id organization_id,o.name organization_name,o.status organization_status FROM merchant_sessions s JOIN merchant_members m ON m.id=s.member_id JOIN merchant_organizations o ON o.id=m.organization_id WHERE s.token_hash=? AND s.expires_at>? AND m.status='active'`).bind(await sha(raw),now()).first()}
function canWrite(company){return['owner','admin','manager'].includes(company.role)}
async function byPublic(env,table,company,id){return env.DB.prepare(`SELECT * FROM ${table} WHERE public_id=? AND organization_id=?`).bind(id,company.organization_id).first()}

function labelInput(body){
  const sku=clean(body.sku,120),name=clean(body.productName,220),currency=clean(body.currency,3).toUpperCase(),gtin=clean(body.gtin,18).replace(/\s/g,''),qr=safeUrl(body.qrUrl),template=clean(body.template,30),color=clean(body.colorMode,30),orientation=body.orientation==='portrait'?'portrait':'landscape';
  const widthMm=positive(body.widthMm,20,400),heightMm=positive(body.heightMm,15,300),widthPx=Math.round(positive(body.widthPx,80,4000)),heightPx=Math.round(positive(body.heightPx,60,3000));
  if(!sku||name.length<2||!/^[A-Z]{3}$/.test(currency)||!TEMPLATES.has(template)||!COLORS.has(color)||priceInvalid(body.priceCents)||gtin&&!/^\d{8,18}$/.test(gtin))return null;
  return{sku,productName:name,gtin:gtin||null,priceCents:cents(body.priceCents),originalPriceCents:body.originalPriceCents===null||body.originalPriceCents===''?null:cents(body.originalPriceCents),currency,unitText:clean(body.unitText,100)||null,promoText:clean(body.promoText,180)||null,legalText:clean(body.legalText,300)||null,template,colorMode:color,orientation,widthMm,heightMm,widthPx,heightPx,qrUrl:qr,barcodeValue:clean(body.barcodeValue,120)||gtin||sku}
}
function priceInvalid(value){return!Number.isFinite(Number(value))||Number(value)<0}
function outputLabel(row){return{publicId:row.public_id,productId:row.product_public_id||null,connectorId:row.connector_public_id||null,sku:row.sku,gtin:row.gtin,productName:row.product_name,priceCents:row.price_cents,originalPriceCents:row.original_price_cents,currency:row.currency,unitText:row.unit_text,promoText:row.promo_text,legalText:row.legal_text,template:row.template,widthMm:row.width_mm,heightMm:row.height_mm,widthPx:row.width_px,heightPx:row.height_px,orientation:row.orientation,colorMode:row.color_mode,qrUrl:row.qr_url,barcodeValue:row.barcode_value,status:row.status,version:row.version,lastSyncedAt:row.last_synced_at,updatedAt:row.updated_at}}
function adapterPayload(label,connector=null){return{schema:'still.esl.label.v1',generatedAt:now(),compatibility:{model:'vendor-neutral display payload',bluetoothEslProfile:'adapter-ready',vendorDelivery:'requires configured vendor gateway'},connector:connector?{publicId:connector.public_id,vendor:connector.vendor,transport:connector.transport,storeReference:connector.store_reference,payloadFormat:connector.payload_format}:null,label:{id:label.public_id,version:label.version,physical:{widthMm:label.width_mm,heightMm:label.height_mm,orientation:label.orientation},display:{widthPx:label.width_px,heightPx:label.height_px,colorMode:label.color_mode,template:label.template},product:{sku:label.sku,gtin:label.gtin,name:label.product_name},price:{amountMinor:label.price_cents,originalAmountMinor:label.original_price_cents,currency:label.currency,unitText:label.unit_text},content:{promotion:label.promo_text,legal:label.legal_text,qrUrl:label.qr_url,barcode:label.barcode_value}}}}

async function dashboard(env,company){
  const [connectors,labels,updates,products]=await Promise.all([
    env.DB.prepare('SELECT * FROM esl_connectors WHERE organization_id=? AND status<>\'archived\' ORDER BY updated_at DESC LIMIT 100').bind(company.organization_id).all(),
    env.DB.prepare(`SELECT l.*,p.public_id product_public_id,c.public_id connector_public_id FROM esl_labels l LEFT JOIN ops_products p ON p.id=l.product_id LEFT JOIN esl_connectors c ON c.id=l.connector_id WHERE l.organization_id=? AND l.status<>'archived' ORDER BY l.updated_at DESC LIMIT 500`).bind(company.organization_id).all().catch(()=>({results:[]})),
    env.DB.prepare(`SELECT u.public_id,u.old_price_cents,u.new_price_cents,u.reason,u.effective_at,u.status,u.created_at,l.public_id label_public_id,l.product_name FROM esl_price_updates u JOIN esl_labels l ON l.id=u.label_id WHERE u.organization_id=? ORDER BY u.created_at DESC LIMIT 200`).bind(company.organization_id).all(),
    env.DB.prepare(`SELECT public_id,sku,barcode,name,price_cents FROM ops_products WHERE organization_id=? AND active=1 ORDER BY name LIMIT 500`).bind(company.organization_id).all().catch(()=>({results:[]}))
  ]);
  return json({mode:'live',standards:{bluetoothEslProfile:'1.0 adapter-ready',gs1DigitalLink:'URI-ready'},connectors:connectors.results||[],labels:(labels.results||[]).map(outputLabel),updates:updates.results||[],products:products.results||[],presets:['1.54','2.13','2.90','4.20','5.80','7.50','10.20','lcd_wide','custom']})
}

async function saveConnector(request,env,company){if(!canWrite(company))return json({error:'forbidden'},403);const body=await request.json().catch(()=>null);if(!body)return json({error:'invalid_json'},400);const name=clean(body.name,160),vendor=clean(body.vendor,40),transport=clean(body.transport,40),format=clean(body.payloadFormat,50);if(name.length<2||!VENDORS.has(vendor)||!TRANSPORTS.has(transport)||!FORMATS.has(format))return json({error:'invalid_connector'},422);const id=uid('eslc_'),pid=publicId('ESLC'),ts=now();await env.DB.prepare('INSERT INTO esl_connectors(id,public_id,organization_id,name,vendor,transport,store_reference,payload_format,status,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,\'configured\',?,?,?)').bind(id,pid,company.organization_id,name,vendor,transport,clean(body.storeReference,180)||null,format,company.member_id,ts,ts).run();return json({ok:true,publicId:pid},201)}

async function saveLabel(request,env,company,existingId=null){if(!canWrite(company))return json({error:'forbidden'},403);const body=await request.json().catch(()=>null),input=body&&labelInput(body);if(!input)return json({error:'invalid_label'},422);let product=null,connector=null;if(body.productId)product=await byPublic(env,'ops_products',company,clean(body.productId,80));if(body.connectorId)connector=await byPublic(env,'esl_connectors',company,clean(body.connectorId,80));if(body.productId&&!product||body.connectorId&&!connector)return json({error:'invalid_relation'},422);const ts=now();if(existingId){const current=await byPublic(env,'esl_labels',company,existingId);if(!current)return json({error:'not_found'},404);await env.DB.prepare(`UPDATE esl_labels SET product_id=?,connector_id=?,sku=?,gtin=?,product_name=?,price_cents=?,original_price_cents=?,currency=?,unit_text=?,promo_text=?,legal_text=?,template=?,width_mm=?,height_mm=?,width_px=?,height_px=?,orientation=?,color_mode=?,qr_url=?,barcode_value=?,status='ready',version=version+1,updated_at=? WHERE id=?`).bind(product?.id||null,connector?.id||null,input.sku,input.gtin,input.productName,input.priceCents,input.originalPriceCents,input.currency,input.unitText,input.promoText,input.legalText,input.template,input.widthMm,input.heightMm,input.widthPx,input.heightPx,input.orientation,input.colorMode,input.qrUrl,input.barcodeValue,ts,current.id).run();return json({ok:true,publicId:current.public_id,version:Number(current.version)+1})}
  const id=uid('esll_'),pid=publicId('ESL');await env.DB.prepare(`INSERT INTO esl_labels(id,public_id,organization_id,product_id,connector_id,sku,gtin,product_name,price_cents,original_price_cents,currency,unit_text,promo_text,legal_text,template,width_mm,height_mm,width_px,height_px,orientation,color_mode,qr_url,barcode_value,status,version,created_by_member_id,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'ready',1,?,?,?)`).bind(id,pid,company.organization_id,product?.id||null,connector?.id||null,input.sku,input.gtin,input.productName,input.priceCents,input.originalPriceCents,input.currency,input.unitText,input.promoText,input.legalText,input.template,input.widthMm,input.heightMm,input.widthPx,input.heightPx,input.orientation,input.colorMode,input.qrUrl,input.barcodeValue,company.member_id,ts,ts).run();return json({ok:true,publicId:pid,version:1},201)
}

async function priceUpdate(request,env,company,labelId){if(!canWrite(company))return json({error:'forbidden'},403);const body=await request.json().catch(()=>null),label=await byPublic(env,'esl_labels',company,labelId);if(!body||!label||priceInvalid(body.newPriceCents))return json({error:label?'invalid_price_update':'not_found'},label?422:404);const effective=clean(body.effectiveAt,40);if(effective&&Number.isNaN(Date.parse(effective)))return json({error:'invalid_effective_at'},422);const timestamp=now(),effectiveAt=effective||timestamp,status=Date.parse(effectiveAt)>Date.now()?'scheduled':'export_ready',newPrice=cents(body.newPriceCents),updateId=uid('eslu_'),updatePublic=publicId('ESLU'),payload=adapterPayload({...label,price_cents:newPrice,version:Number(label.version)+1});await env.DB.batch([
    env.DB.prepare('UPDATE esl_labels SET price_cents=?,version=version+1,status=?,updated_at=? WHERE id=?').bind(newPrice,status==='scheduled'?'scheduled':'ready',timestamp,label.id),
    env.DB.prepare('INSERT INTO esl_price_updates(id,public_id,organization_id,label_id,old_price_cents,new_price_cents,reason,effective_at,status,payload_json,created_by_member_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(updateId,updatePublic,company.organization_id,label.id,label.price_cents,newPrice,clean(body.reason,300)||null,effectiveAt,status,JSON.stringify(payload),company.member_id,timestamp)
  ]);return json({ok:true,publicId:updatePublic,status,effectiveAt,payload},201)}

async function exportLabel(env,company,labelId){const label=await byPublic(env,'esl_labels',company,labelId);if(!label)return json({error:'not_found'},404);const connector=label.connector_id?await env.DB.prepare('SELECT * FROM esl_connectors WHERE id=? AND organization_id=?').bind(label.connector_id,company.organization_id).first():null;return json({payload:adapterPayload(label,connector),delivery:{ready:false,reason:'vendor_credentials_and_gateway_required',nextStep:'Send this payload through the configured vendor adapter or export it from the company workspace.'}})}

export default{async fetch(request,env){
  const path=new URL(request.url).pathname;if(!path.startsWith('/api/v1/business/esl'))return app.fetch(request,env);
  if(!env.DB)return json({error:'database_not_configured'},503);
  try{
    await schema(env);const company=await companySession(request,env);if(!company)return json({error:'unauthorized'},401);if(company.organization_status!=='verified')return json({error:'verification_required'},403);if(!sameOrigin(request)&&!['GET','HEAD'].includes(request.method))return json({error:'origin_not_allowed'},403);
    if(path==='/api/v1/business/esl'&&request.method==='GET')return dashboard(env,company);
    if(path==='/api/v1/business/esl/connectors'&&request.method==='POST')return saveConnector(request,env,company);
    if(path==='/api/v1/business/esl/labels'&&request.method==='POST')return saveLabel(request,env,company);
    let match=path.match(/^\/api\/v1\/business\/esl\/labels\/([^/]+)$/);if(match&&request.method==='PATCH')return saveLabel(request,env,company,decodeURIComponent(match[1]));
    match=path.match(/^\/api\/v1\/business\/esl\/labels\/([^/]+)\/price-updates$/);if(match&&request.method==='POST')return priceUpdate(request,env,company,decodeURIComponent(match[1]));
    match=path.match(/^\/api\/v1\/business\/esl\/labels\/([^/]+)\/export$/);if(match&&request.method==='GET')return exportLabel(env,company,decodeURIComponent(match[1]));
    return json({error:'not_found'},404)
  }catch(error){console.error('electronic_shelf_label_error',error);const status=/UNIQUE constraint/i.test(error.message||'')?409:500;return json({error:status===409?'duplicate_label_or_connector':'internal_error'},status)}
}};
