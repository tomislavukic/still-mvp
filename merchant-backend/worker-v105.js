import app from './worker-v104.js';

const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:HEADERS});
const now=()=>new Date().toISOString();
const clean=(value,max=500)=>typeof value==='string'?value.trim().slice(0,max):'';
const BUSINESS_TYPES=new Set(['retail','services','mixed','manufacturer','rental','subscription','professional','other']);
const TEAM_SIZES=new Set(['1','2-5','6-20','21-100','100+']);
const FULFILLMENT_MODES=new Set(['delivery','pickup','on_site','appointment','digital']);
let schemaReady;

async function sha(value){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
function cookie(request,name){for(const part of(request.headers.get('cookie')||'').split(';')){const[key,...value]=part.trim().split('=');if(key===name)return decodeURIComponent(value.join('='))}return''}
function sameOrigin(request){const origin=request.headers.get('origin');return!origin||origin===new URL(request.url).origin}
function parseModes(value){if(!Array.isArray(value))return[];return[...new Set(value.filter(mode=>FULFILLMENT_MODES.has(mode)))]}
function parseStoredModes(value){try{return parseModes(JSON.parse(value||'[]'))}catch{return[]}}

async function schema(env){if(!schemaReady)schemaReady=env.DB.batch([
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS organization_setup_profiles(organization_id TEXT PRIMARY KEY,business_type TEXT NOT NULL DEFAULT 'mixed',team_size TEXT NOT NULL DEFAULT '1',offers_products INTEGER NOT NULL DEFAULT 1,offers_services INTEGER NOT NULL DEFAULT 1,fulfillment_modes TEXT NOT NULL DEFAULT '[]',operating_region TEXT,preferred_currency TEXT NOT NULL DEFAULT 'EUR',launch_goal TEXT,internal_notes TEXT,updated_at TEXT NOT NULL)`),
  env.DB.prepare('PRAGMA optimize')
]).catch(error=>{schemaReady=undefined;throw error});await schemaReady}

async function companySession(request,env){const raw=cookie(request,'still_company');if(!raw)return null;return env.DB.prepare(`SELECT m.id member_id,m.email,m.role,o.id organization_id,o.name organization_name,o.status organization_status FROM merchant_sessions s JOIN merchant_members m ON m.id=s.member_id JOIN merchant_organizations o ON o.id=m.organization_id WHERE s.token_hash=? AND s.expires_at>? AND m.status='active'`).bind(await sha(raw),now()).first()}

function setupProfile(row={}){return{
  businessType:row.business_type||'mixed',
  teamSize:row.team_size||'1',
  offersProducts:row.offers_products===undefined?true:!!row.offers_products,
  offersServices:row.offers_services===undefined?true:!!row.offers_services,
  fulfillmentModes:parseStoredModes(row.fulfillment_modes),
  operatingRegion:row.operating_region||'',
  preferredCurrency:row.preferred_currency||'EUR',
  launchGoal:row.launch_goal||'',
  internalNotes:row.internal_notes||'',
  updatedAt:row.updated_at||null
}}

async function readWorkspace(env,session){
  const [setup,profile,contact,verification]=await Promise.all([
    env.DB.prepare('SELECT * FROM organization_setup_profiles WHERE organization_id=?').bind(session.organization_id).first(),
    env.DB.prepare('SELECT display_name,logo_url,description,website_url,support_email FROM organization_profiles WHERE organization_id=?').bind(session.organization_id).first(),
    env.DB.prepare('SELECT contact_name,phone,address_line_1,city,postal_code,country_code FROM organization_contact_profiles WHERE organization_id=?').bind(session.organization_id).first(),
    env.DB.prepare('SELECT status,review_note,submitted_at,updated_at FROM merchant_verification_requests WHERE organization_id=?').bind(session.organization_id).first()
  ]);
  const value=setupProfile(setup||{});
  const readiness={
    profile:!!(profile?.display_name&&profile?.description&&(profile?.website_url||profile?.support_email)),
    logo:!!profile?.logo_url,
    contact:!!(contact?.contact_name&&contact?.phone&&contact?.address_line_1&&contact?.city&&contact?.postal_code&&contact?.country_code),
    businessSetup:!!(setup&&value.businessType&&value.teamSize&&value.fulfillmentModes.length&&(value.offersProducts||value.offersServices)),
    verification:session.organization_status==='verified'||verification?.status==='approved',
    verificationSubmitted:['submitted','under_review','approved'].includes(verification?.status)
  };
  return{
    organization:{name:session.organization_name,status:session.organization_status,role:session.role},
    setup:value,
    verification:verification||{status:'draft'},
    readiness,
    allowedNow:['company_profile','company_contact','business_setup','verification_submission','interactive_demo'],
    lockedUntilVerified:['public_offers','real_orders_and_payments','buyer_cases_and_contacts','passport_issuance','live_operations_and_team_changes']
  }
}

async function saveWorkspace(request,env,session){
  if(!sameOrigin(request))return json({error:'origin_not_allowed'},403);
  if(!['owner','admin','manager'].includes(session.role))return json({error:'forbidden'},403);
  const body=await request.json().catch(()=>null);
  if(!body)return json({error:'invalid_json'},400);
  const businessType=clean(body.businessType,30),teamSize=clean(body.teamSize,20),modes=parseModes(body.fulfillmentModes),currency=clean(body.preferredCurrency,3).toUpperCase();
  const offersProducts=body.offersProducts===true,offersServices=body.offersServices===true;
  if(!BUSINESS_TYPES.has(businessType)||!TEAM_SIZES.has(teamSize)||!modes.length||(!offersProducts&&!offersServices)||!/^[A-Z]{3}$/.test(currency))return json({error:'invalid_setup'},422);
  await env.DB.prepare(`INSERT INTO organization_setup_profiles(organization_id,business_type,team_size,offers_products,offers_services,fulfillment_modes,operating_region,preferred_currency,launch_goal,internal_notes,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(organization_id) DO UPDATE SET business_type=excluded.business_type,team_size=excluded.team_size,offers_products=excluded.offers_products,offers_services=excluded.offers_services,fulfillment_modes=excluded.fulfillment_modes,operating_region=excluded.operating_region,preferred_currency=excluded.preferred_currency,launch_goal=excluded.launch_goal,internal_notes=excluded.internal_notes,updated_at=excluded.updated_at`).bind(session.organization_id,businessType,teamSize,offersProducts?1:0,offersServices?1:0,JSON.stringify(modes),clean(body.operatingRegion,180)||null,currency,clean(body.launchGoal,600)||null,clean(body.internalNotes,1200)||null,now()).run();
  return json({ok:true,...await readWorkspace(env,session)})
}

export default{async fetch(request,env){
  try{
    const path=new URL(request.url).pathname;
    if(path!=='/api/v1/business/setup')return app.fetch(request,env);
    if(!env.DB)return json({error:'database_not_configured'},503);
    await schema(env);
    const session=await companySession(request,env);
    if(!session)return json({error:'unauthorized'},401);
    if(request.method==='GET')return json(await readWorkspace(env,session));
    if(request.method==='POST')return saveWorkspace(request,env,session);
    return json({error:'method_not_allowed'},405)
  }catch(error){console.error('company_setup_workspace_error',error);return json({error:'internal_error'},500)}
}};
