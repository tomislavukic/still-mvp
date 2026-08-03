import app from './worker-v103.js';

const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const clean=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';
const now=()=>new Date().toISOString();
let schemaReady;

async function sha(value){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
function cookie(request,name){for(const part of(request.headers.get('cookie')||'').split(';')){const[key,...value]=part.trim().split('=');if(key===name)return decodeURIComponent(value.join('='))}return''}
function sameOrigin(request){const origin=request.headers.get('origin');return!origin||origin===new URL(request.url).origin}
function phone(value){const result=clean(value,40);return !result||/^[+0-9][0-9 ()/.-]{5,38}$/.test(result)?result:null}
function country(value){const result=clean(value,2).toUpperCase();return !result||/^[A-Z]{2}$/.test(result)?result:null}
function contactMethod(value){return['email','phone','sms'].includes(value)?value:'email'}
function addressText(profile){return[profile.addressLine1,profile.addressLine2,[profile.postalCode,profile.city].filter(Boolean).join(' '),profile.region,profile.countryCode].filter(Boolean).join(', ')}

async function schema(env){if(!schemaReady)schemaReady=env.DB.batch([
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS buyer_contact_profiles(buyer_account_id TEXT PRIMARY KEY,phone TEXT,address_line_1 TEXT,address_line_2 TEXT,city TEXT,region TEXT,postal_code TEXT,country_code TEXT,delivery_instructions TEXT,preferred_contact TEXT NOT NULL DEFAULT 'email',share_with_connected_businesses INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL)`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS organization_contact_profiles(organization_id TEXT PRIMARY KEY,contact_name TEXT,phone TEXT,address_line_1 TEXT,address_line_2 TEXT,city TEXT,region TEXT,postal_code TEXT,country_code TEXT,business_hours TEXT,updated_at TEXT NOT NULL)`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS commerce_order_parties(order_id TEXT PRIMARY KEY,order_public_id TEXT NOT NULL UNIQUE,organization_id TEXT NOT NULL,buyer_account_id TEXT NOT NULL,buyer_json TEXT NOT NULL,seller_json TEXT NOT NULL,created_at TEXT NOT NULL)`),
  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_order_parties_organization_created ON commerce_order_parties(organization_id,created_at DESC)'),
  env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_order_parties_buyer_created ON commerce_order_parties(buyer_account_id,created_at DESC)'),
  env.DB.prepare('PRAGMA optimize')
]).catch(error=>{schemaReady=undefined;throw error});await schemaReady}

async function buyerSession(request,env){const raw=cookie(request,'still_buyer');if(!raw)return null;return env.DB.prepare(`SELECT a.id buyer_account_id,a.email,a.name FROM buyer_sessions s JOIN buyer_accounts a ON a.id=s.buyer_account_id WHERE s.token_hash=? AND s.expires_at>? AND a.status='active'`).bind(await sha(raw),now()).first()}
async function companySession(request,env){const raw=cookie(request,'still_company');if(!raw)return null;return env.DB.prepare(`SELECT m.id member_id,m.email,m.role,o.id organization_id,o.name organization_name,o.status organization_status,o.website_url,o.support_email FROM merchant_sessions s JOIN merchant_members m ON m.id=s.member_id JOIN merchant_organizations o ON o.id=m.organization_id WHERE s.token_hash=? AND s.expires_at>? AND m.status='active'`).bind(await sha(raw),now()).first()}

function buyerContact(row={}){return{phone:row.phone||'',addressLine1:row.address_line_1||'',addressLine2:row.address_line_2||'',city:row.city||'',region:row.region||'',postalCode:row.postal_code||'',countryCode:row.country_code||'',deliveryInstructions:row.delivery_instructions||'',preferredContact:row.preferred_contact||'email',shareContactWithConnectedBusinesses:!!row.share_with_connected_businesses}}
function companyContact(row={}){return{contactName:row.contact_name||'',phone:row.phone||'',addressLine1:row.address_line_1||'',addressLine2:row.address_line_2||'',city:row.city||'',region:row.region||'',postalCode:row.postal_code||'',countryCode:row.country_code||'',businessHours:row.business_hours||''}}
async function getBuyerContact(env,buyerId){return buyerContact(await env.DB.prepare('SELECT * FROM buyer_contact_profiles WHERE buyer_account_id=?').bind(buyerId).first()||{})}
async function getCompanyContact(env,organizationId){return companyContact(await env.DB.prepare('SELECT * FROM organization_contact_profiles WHERE organization_id=?').bind(organizationId).first()||{})}

async function saveBuyerContact(env,buyerId,body){
  const parsedPhone=phone(body.phone),parsedCountry=country(body.countryCode);
  if(parsedPhone===null||parsedCountry===null)return{error:'invalid_contact'};
  const previous=await env.DB.prepare('SELECT share_with_connected_businesses FROM buyer_contact_profiles WHERE buyer_account_id=?').bind(buyerId).first();
  const profileEdit=Object.prototype.hasOwnProperty.call(body,'displayName');
  const share=profileEdit?(body.shareContactWithConnectedBusinesses===true?1:0):Number(previous?.share_with_connected_businesses||0);
  await env.DB.prepare(`INSERT INTO buyer_contact_profiles(buyer_account_id,phone,address_line_1,address_line_2,city,region,postal_code,country_code,delivery_instructions,preferred_contact,share_with_connected_businesses,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(buyer_account_id) DO UPDATE SET phone=excluded.phone,address_line_1=excluded.address_line_1,address_line_2=excluded.address_line_2,city=excluded.city,region=excluded.region,postal_code=excluded.postal_code,country_code=excluded.country_code,delivery_instructions=excluded.delivery_instructions,preferred_contact=excluded.preferred_contact,share_with_connected_businesses=excluded.share_with_connected_businesses,updated_at=excluded.updated_at`).bind(buyerId,parsedPhone||null,clean(body.addressLine1,240)||null,clean(body.addressLine2,240)||null,clean(body.city,120)||null,clean(body.region,120)||null,clean(body.postalCode,30)||null,parsedCountry||null,clean(body.deliveryInstructions,600)||null,contactMethod(body.preferredContact),share,now()).run();
  return{contact:await getBuyerContact(env,buyerId)}
}
async function saveCompanyContact(env,organizationId,body){const parsedPhone=phone(body.phone),parsedCountry=country(body.countryCode);if(parsedPhone===null||parsedCountry===null)return{error:'invalid_contact'};await env.DB.prepare(`INSERT INTO organization_contact_profiles(organization_id,contact_name,phone,address_line_1,address_line_2,city,region,postal_code,country_code,business_hours,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET contact_name=excluded.contact_name,phone=excluded.phone,address_line_1=excluded.address_line_1,address_line_2=excluded.address_line_2,city=excluded.city,region=excluded.region,postal_code=excluded.postal_code,country_code=excluded.country_code,business_hours=excluded.business_hours,updated_at=excluded.updated_at`).bind(organizationId,clean(body.contactName,160)||null,parsedPhone||null,clean(body.addressLine1,240)||null,clean(body.addressLine2,240)||null,clean(body.city,120)||null,clean(body.region,120)||null,clean(body.postalCode,30)||null,parsedCountry||null,clean(body.businessHours,500)||null,now()).run();return{contact:await getCompanyContact(env,organizationId)}}

async function responseData(response){try{return await response.clone().json()}catch{return null}}
function rebuilt(response,data){const headers=new Headers(response.headers);headers.delete('content-length');headers.set('content-type','application/json; charset=utf-8');headers.set('cache-control','no-store');return new Response(JSON.stringify(data),{status:response.status,headers})}
function partyFromRow(row,key){try{return JSON.parse(row?.[key]||'null')}catch{return null}}

async function contactMaps(env,organizationIds=[],buyerIds=[]){const organizations=new Map(),buyers=new Map();if(organizationIds.length){const marks=organizationIds.map(()=>'?').join(','),rows=await env.DB.prepare(`SELECT * FROM organization_contact_profiles WHERE organization_id IN (${marks})`).bind(...organizationIds).all();for(const row of rows.results||[])organizations.set(row.organization_id,companyContact(row))}if(buyerIds.length){const marks=buyerIds.map(()=>'?').join(','),rows=await env.DB.prepare(`SELECT * FROM buyer_contact_profiles WHERE buyer_account_id IN (${marks}) AND share_with_connected_businesses=1`).bind(...buyerIds).all();for(const row of rows.results||[])buyers.set(row.buyer_account_id,buyerContact(row))}return{organizations,buyers}}

async function enrich(request,env,path,response){if(!response.ok||request.method!=='GET')return response;const data=await responseData(response);if(!data)return response;
  const buyer=await buyerSession(request,env),company=await companySession(request,env);
  if(buyer&&data.profile&&(path==='/api/v1/buyer-dashboard'||path==='/api/v1/buyer-profile'))data.profile={...data.profile,...await getBuyerContact(env,buyer.buyer_account_id)};
  if(buyer&&path==='/api/v1/buyer-auth/me'&&data.authenticated)data.profile={...(data.profile||{}),...await getBuyerContact(env,buyer.buyer_account_id)};
  if(company&&data.profile&&(path==='/api/v1/business-dashboard'||path==='/api/v1/business-profile'))data.profile={...data.profile,...await getCompanyContact(env,company.organization_id)};
  if(company&&path==='/api/v1/auth/me'&&data.organization)data.profile={...(data.profile||{}),...await getCompanyContact(env,company.organization_id)};
  if(path==='/api/v1/buyer-dashboard'&&Array.isArray(data.companies)){const ids=[...new Set(data.companies.map(item=>item.organization_id).filter(Boolean))],maps=await contactMaps(env,ids,[]);data.companies=data.companies.map(item=>({...item,...(maps.organizations.get(item.organization_id)||{})}))}
  if(path==='/api/v1/business-dashboard'&&Array.isArray(data.relationships)){const ids=[...new Set(data.relationships.map(item=>item.buyer_account_id).filter(Boolean))],maps=await contactMaps(env,[],ids);data.relationships=data.relationships.map(item=>({...item,...(maps.buyers.get(item.buyer_account_id)||{})}))}
  if(path==='/api/v1/ownership/passports'&&Array.isArray(data.passports)){const ids=[...new Set(data.passports.map(item=>item.organizationId).filter(Boolean))],maps=await contactMaps(env,ids,[]);data.passports=data.passports.map(item=>item.companyProfile?({...item,companyProfile:{...item.companyProfile,...(maps.organizations.get(item.organizationId)||{})}}):item)}
  if(path==='/api/v1/business/passports'&&Array.isArray(data.passports)){const ids=[...new Set(data.passports.map(item=>item.buyerProfile?.buyer_account_id).filter(Boolean))],maps=await contactMaps(env,[],ids);data.passports=data.passports.map(item=>item.buyerProfile?({...item,buyerProfile:{...item.buyerProfile,...(maps.buyers.get(item.buyerProfile.buyer_account_id)||{})}}):item)}
  if((path==='/api/v1/commerce/offers'||path.startsWith('/api/v1/commerce/offers/'))&&(Array.isArray(data.offers)||data.offer)){const offers=data.offers||[data.offer],ids=offers.map(item=>item.publicId).filter(Boolean);if(ids.length){const marks=ids.map(()=>'?').join(','),rows=await env.DB.prepare(`SELECT public_id,organization_id FROM commerce_offers WHERE public_id IN (${marks})`).bind(...ids).all(),orgIds=[...new Set((rows.results||[]).map(row=>row.organization_id))],maps=await contactMaps(env,orgIds,[]),byOffer=new Map((rows.results||[]).map(row=>[row.public_id,maps.organizations.get(row.organization_id)||{}]));for(const offer of offers)offer.seller={...(offer.seller||{}),...(byOffer.get(offer.publicId)||{})}}}
  if((path==='/api/v1/commerce/orders'||path==='/api/v1/business/commerce/orders')&&Array.isArray(data.orders)){const ids=data.orders.map(item=>item.publicId),marks=ids.map(()=>'?').join(',');if(ids.length){const rows=await env.DB.prepare(`SELECT order_public_id,buyer_json,seller_json FROM commerce_order_parties WHERE order_public_id IN (${marks})`).bind(...ids).all(),map=new Map((rows.results||[]).map(row=>[row.order_public_id,{buyer:partyFromRow(row,'buyer_json'),seller:partyFromRow(row,'seller_json')}]));data.orders=data.orders.map(item=>({...item,parties:map.get(item.publicId)||null}))}}
  return rebuilt(response,data)}

async function checkout(request,env,path){if(!sameOrigin(request))return json({error:'origin_not_allowed'},403);const buyer=await buyerSession(request,env);if(!buyer)return app.fetch(request,env);const body=await request.clone().json().catch(()=>({})),publicId=decodeURIComponent(path.match(/^\/api\/v1\/commerce\/offers\/([^/]+)\/checkout$/)[1]),offer=await env.DB.prepare(`SELECT o.id,o.organization_id,o.fulfillment_type,o.title,p.display_name,p.support_email,op.website_url FROM commerce_offers o JOIN commerce_business_profiles p ON p.organization_id=o.organization_id LEFT JOIN organization_profiles op ON op.organization_id=o.organization_id WHERE o.public_id=?`).bind(publicId).first();if(!offer)return app.fetch(request,env);const stored=await getBuyerContact(env,buyer.buyer_account_id),contact={...stored,...Object.fromEntries(Object.entries(body).filter(([,value])=>value!==undefined&&value!==''))},parsedPhone=phone(contact.phone),parsedCountry=country(contact.countryCode),requiresAddress=['delivery','on_site'].includes(offer.fulfillment_type),missing=[];if(!clean(body.buyerName||buyer.name,180))missing.push('buyerName');if(!parsedPhone)missing.push('phone');if(requiresAddress){if(!clean(contact.addressLine1,240))missing.push('addressLine1');if(!clean(contact.city,120))missing.push('city');if(!clean(contact.postalCode,30))missing.push('postalCode');if(!parsedCountry)missing.push('countryCode')}if(missing.length)return json({error:'contact_required',missing,requiresAddress},422);const response=await app.fetch(request,env);if(!response.ok)return response;const data=await responseData(response),orderPublicId=data?.order?.publicId;if(!orderPublicId)return response;const order=await env.DB.prepare('SELECT id,organization_id,buyer_account_id FROM commerce_orders WHERE public_id=?').bind(orderPublicId).first(),sellerContact=await getCompanyContact(env,offer.organization_id),buyerParty={name:clean(body.buyerName||buyer.name,180),email:buyer.email,phone:parsedPhone,addressLine1:clean(contact.addressLine1,240),addressLine2:clean(contact.addressLine2,240),city:clean(contact.city,120),region:clean(contact.region,120),postalCode:clean(contact.postalCode,30),countryCode:parsedCountry||'',deliveryInstructions:clean(contact.deliveryInstructions,600),preferredContact:contactMethod(contact.preferredContact),address:addressText(contact)},sellerParty={name:offer.display_name,supportEmail:offer.support_email||'',websiteUrl:offer.website_url||'',...sellerContact,address:addressText(sellerContact)};await env.DB.prepare(`INSERT OR REPLACE INTO commerce_order_parties(order_id,order_public_id,organization_id,buyer_account_id,buyer_json,seller_json,created_at) VALUES(?,?,?,?,?,?,?)`).bind(order.id,orderPublicId,order.organization_id,order.buyer_account_id,JSON.stringify(buyerParty),JSON.stringify(sellerParty),now()).run();if(body.saveContact!==false)await saveBuyerContact(env,buyer.buyer_account_id,{...contact,phone:parsedPhone,countryCode:parsedCountry,shareContactWithConnectedBusinesses:body.shareContactWithConnectedBusinesses===true});data.order.parties={buyer:buyerParty,seller:sellerParty};return rebuilt(response,data)}

export default{async fetch(request,env){
  try{
    const path=new URL(request.url).pathname;
    if(!path.startsWith('/api/'))return app.fetch(request,env);
    if(!env.DB)return json({error:'database_not_configured'},503);
    await schema(env);
    if(/^\/api\/v1\/commerce\/offers\/[^/]+\/checkout$/.test(path)&&request.method==='POST')return checkout(request,env,path);
    let body=null;
    if(request.method==='POST'&&(path==='/api/v1/buyer-profile'||path==='/api/v1/business-profile')){
      body=await request.clone().json().catch(()=>({}));
      if(phone(body.phone)===null||country(body.countryCode)===null)return json({error:'invalid_contact'},422);
    }
    const response=await app.fetch(request,env);
    if(response.ok&&body&&path==='/api/v1/buyer-profile'){
      const buyer=await buyerSession(request,env);
      if(buyer){const saved=await saveBuyerContact(env,buyer.buyer_account_id,body);if(saved.error)return json(saved,422)}
    }
    if(response.ok&&body&&path==='/api/v1/business-profile'){
      const company=await companySession(request,env);
      if(company){const saved=await saveCompanyContact(env,company.organization_id,body);if(saved.error)return json(saved,422)}
    }
    return enrich(request,env,path,response)
  }catch(error){console.error('contact_relationship_error',error);return json({error:'internal_error'},500)}
}};
