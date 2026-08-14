import app from './worker-v140.js';

const HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'};
const CAPABILITY_CATEGORIES = new Set(['DESIGN','DEVELOPMENT','WRITING','TRANSLATION','MARKETING','PHOTO_VIDEO','AUDIO','CONSULTING','EDUCATION','HOME_SERVICE','REPAIR','INSTALLATION','CREATIVE','ADMIN','OTHER']);
const RESTRICTED_CAPABILITY_TERMS = ['weapon','explosive','illegal drug','medical diagnosis','legal representation','investment guarantee','adult service'];
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:HEADERS});
const now=()=>new Date().toISOString();
const uid=prefix=>`${prefix}${crypto.randomUUID().replaceAll('-','')}`;
const publicId=prefix=>`${prefix}-${crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase()}`;
const clean=(value,max=5000)=>String(value??'').replace(/\0/g,'').trim().slice(0,max);
const normalized=value=>clean(value,5000).toLocaleLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const capabilityKey=value=>normalized(value).replaceAll(' ','_').slice(0,100);
const int=(value,min,max)=>{const number=Number(value);return Number.isInteger(number)&&number>=min&&number<=max?number:null};
function cookie(request,name){for(const part of(request.headers.get('cookie')||'').split(';')){const[key,...value]=part.trim().split('=');if(key===name)return decodeURIComponent(value.join('='))}return''}
async function sha(value){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value)));return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,'0')).join('')}
async function buyerSession(request,env){const token=cookie(request,'still_buyer');if(!token||!env.DB)return null;return env.DB.prepare(`SELECT a.id buyer_account_id,a.email,a.name,a.email_verified FROM buyer_sessions s JOIN buyer_accounts a ON a.id=s.buyer_account_id WHERE s.token_hash=? AND s.expires_at>? AND a.status='active'`).bind(await sha(token),now()).first()}
function sameOrigin(request){const origin=request.headers.get('origin');return!origin||origin===new URL(request.url).origin}
async function primeProfessionalSchema(request,env){const url=new URL(request.url);url.pathname='/api/v1/professional/profile';url.search='';return app.fetch(new Request(url.toString(),{method:'GET',headers:request.headers}),env)}
async function draftProfile(env,buyer){let profile=await env.DB.prepare('SELECT * FROM professional_profiles WHERE buyer_account_id=?').bind(buyer.buyer_account_id).first();if(profile)return profile;const ts=now(),displayName=clean(buyer.name||buyer.email?.split('@')[0]||'Professional',120)||'Professional';await env.DB.prepare(`INSERT INTO professional_profiles(id,public_id,buyer_account_id,professional_mode_enabled,display_name,headline,bio,coarse_location,location_modes_json,availability_status,weekly_capacity_hours,minimum_project_cents,currency,profile_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(uid('prf_'),publicId('PRO'),buyer.buyer_account_id,0,displayName,null,null,null,'[]','UNAVAILABLE',null,null,'EUR','DRAFT',ts,ts).run();return env.DB.prepare('SELECT * FROM professional_profiles WHERE buyer_account_id=?').bind(buyer.buyer_account_id).first()}
async function capabilitiesFor(env,profileId){const rows=await env.DB.prepare(`SELECT c.*,(SELECT COUNT(*) FROM professional_capability_evidence e WHERE e.capability_id=c.id) evidence_count FROM professional_capabilities c WHERE c.profile_id=? ORDER BY c.label`).bind(profileId).all();return(rows.results||[]).map(row=>({publicId:row.public_id,key:row.capability_key,name:row.label,category:row.category,level:row.level||null,description:row.description||null,yearsExperience:row.years_experience,sourceType:row.source_type,verificationStatus:row.verification_status,evidenceCount:Number(row.evidence_count||0),createdAt:row.created_at,updatedAt:row.updated_at}))}
async function addDraftCapability(request,env){if(!sameOrigin(request))return json({error:'origin_not_allowed'},403);const primed=await primeProfessionalSchema(request,env);if(!primed.ok)return primed;const buyer=await buyerSession(request,env);if(!buyer)return json({error:'unauthorized'},401);const body=await request.json().catch(()=>null);if(!body)return json({error:'invalid_json'},400);const profile=await draftProfile(env,buyer),name=clean(body.name,120),key=capabilityKey(body.key||name),category=clean(body.category,30).toUpperCase();if(name.length<2||!key)return json({error:'capability_name_required'},422);if(!CAPABILITY_CATEGORIES.has(category))return json({error:'unsupported_capability_category'},422);if(RESTRICTED_CAPABILITY_TERMS.some(term=>normalized(`${name} ${body.description}`).includes(term)))return json({error:'restricted_professional_category'},422);const existing=await env.DB.prepare('SELECT id FROM professional_capabilities WHERE profile_id=? AND capability_key=?').bind(profile.id,key).first();if(existing)return json({error:'capability_exists'},409);const ts=now();await env.DB.prepare(`INSERT INTO professional_capabilities(id,public_id,profile_id,capability_key,label,category,level,description,years_experience,source_type,verification_status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,'USER_DECLARED','UNVERIFIED',?,?)`).bind(uid('pca_'),publicId('CAP'),profile.id,key,name,category,clean(body.level,40)||null,clean(body.description,800)||null,int(body.yearsExperience,0,80),ts,ts).run();console.log(JSON.stringify({scope:'still_professional',event:'capability_created',at:ts,buyerId:buyer.buyer_account_id,capabilityKey:key,verificationStatus:'UNVERIFIED',setupState:profile.professional_mode_enabled?'ACTIVE':'DRAFT'}));return json({ok:true,draft:!profile.professional_mode_enabled,capabilities:await capabilitiesFor(env,profile.id)},201)}
async function friendlyProfileSave(request,env,ctx){const clone=request.clone(),body=await clone.json().catch(()=>null);if(body?.professionalModeEnabled===true&&(!Array.isArray(body.locationModes)||!body.locationModes.length))return json({error:'location_mode_required',message:'Choose at least one work mode: Remote, Local, or Hybrid.'},422);return app.fetch(request,env,ctx)}

const PROFESSIONAL_UI_PATCH = String.raw`(() => {
  if (window.__stillProfessionalSkillUiV141) return;
  window.__stillProfessionalSkillUiV141 = true;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const words = value => String(value || '').replaceAll('_',' ').toLocaleLowerCase().replace(/(^|\s)\S/g, letter => letter.toLocaleUpperCase());
  const hr = () => (document.documentElement.lang || '').toLowerCase().startsWith('hr');
  const tx = (en, cro) => hr() ? cro : en;
  const capabilityMarkup = capability => '<article><div><b>' + esc(capability.name) + '</b><small>' + esc(words(capability.category)) + ' · ' + esc(words(capability.verificationStatus)) + '</small></div><span>' + Number(capability.evidenceCount || 0) + '</span></article>';
  function renderCapabilities(scope, capabilities) {
    const section = scope?.querySelector?.('.spn136-capabilities') || document.querySelector('.spn136-capabilities');
    if (!section) return;
    const list = section.querySelector(':scope > div');
    if (list) list.innerHTML = capabilities.length ? capabilities.map(capabilityMarkup).join('') : '<p>' + tx('No capabilities added yet.','Još nema dodanih sposobnosti.') + '</p>';
    const portfolio = scope?.querySelector?.('.spn136-portfolio') || document.querySelector('.spn136-portfolio');
    const form = portfolio?.querySelector('[data-portfolio-form]');
    if (form && capabilities.length && !form.querySelector('[data-live-capability-fieldset]')) {
      const submit = form.querySelector('button');
      const fieldset = document.createElement('fieldset');
      fieldset.dataset.liveCapabilityFieldset = '1';
      fieldset.innerHTML = '<legend>' + tx('Capabilities this supports','Sposobnosti koje ovo podupire') + '</legend>' + capabilities.map(capability => '<label><input type="checkbox" name="capabilityKeys" value="' + esc(capability.key) + '">' + esc(capability.name) + '</label>').join('');
      submit?.before(fieldset);
    }
  }
  async function refreshAccountSummary() {
    const section = document.querySelector('[data-professional-account]');
    if (!section) return;
    try {
      const response = await fetch('/api/v1/professional/profile', {headers:{accept:'application/json'}, credentials:'same-origin'});
      if (!response.ok) return;
      const data = await response.json();
      const count = Array.isArray(data.capabilities) ? data.capabilities.length : 0;
      let summary = section.querySelector('[data-professional-skill-summary]');
      if (!summary) {
        summary = document.createElement('small');
        summary.dataset.professionalSkillSummary = '1';
        summary.style.display = 'block';
        summary.style.marginTop = '8px';
        summary.style.opacity = '.72';
        section.querySelector('div')?.append(summary);
      }
      summary.textContent = count ? (count + ' ' + tx(count === 1 ? 'skill saved' : 'skills saved', count === 1 ? 'spremljena sposobnost' : 'spremljene sposobnosti') + (data.profile?.professionalModeEnabled ? '' : ' · ' + tx('Draft','Skica'))) : tx('No skills saved yet.','Još nema spremljenih sposobnosti.');
    } catch {}
  }
  document.addEventListener('submit', async event => {
    const form = event.target.closest?.('[data-capability-form]');
    if (!form) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const button = form.querySelector('button');
    const oldText = button?.textContent;
    if (button) { button.disabled = true; button.textContent = tx('Saving…','Spremam…'); }
    let output = form.querySelector('[data-capability-live-status]');
    if (!output) {
      output = document.createElement('p');
      output.dataset.capabilityLiveStatus = '1';
      output.setAttribute('role','status');
      form.append(output);
    }
    try {
      const response = await fetch('/api/v1/professional/capabilities', {
        method:'POST',
        credentials:'same-origin',
        headers:{'content-type':'application/json','accept':'application/json'},
        body:JSON.stringify(Object.fromEntries(new FormData(form)))
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'capability_save_failed');
      renderCapabilities(form.closest('.spn136-settings'), Array.isArray(data.capabilities) ? data.capabilities : []);
      form.reset();
      output.textContent = tx('Skill saved. It is now visible in your Capability Passport.','Sposobnost je spremljena i sada je vidljiva u Putovnici sposobnosti.');
      output.style.color = 'var(--success, #7bd88f)';
      await refreshAccountSummary();
    } catch (error) {
      output.textContent = error.message;
      output.style.color = 'var(--danger, #ff7a90)';
    } finally {
      if (button) { button.disabled = false; button.textContent = oldText || tx('Add capability','Dodaj sposobnost'); }
    }
  }, true);
  const observer = new MutationObserver(() => refreshAccountSummary());
  observer.observe(document.documentElement, {childList:true, subtree:true});
  refreshAccountSummary();
})();`;

async function injectProfessionalUi(request,env,ctx){
  const response=await app.fetch(request,env,ctx);
  const type=response.headers.get('content-type')||'';
  if(!response.ok||!type.includes('text/html'))return response;
  const text=await response.text();
  if(text.includes('/professional-mode-ui-v141.js'))return new Response(text,{status:response.status,statusText:response.statusText,headers:response.headers});
  const injected=text.includes('</body>')?text.replace('</body>','<script src="/professional-mode-ui-v141.js"></script></body>'):text+'<script src="/professional-mode-ui-v141.js"></script>';
  const headers=new Headers(response.headers);headers.delete('content-length');headers.set('cache-control','no-store');
  return new Response(injected,{status:response.status,statusText:response.statusText,headers});
}

export default{async fetch(request,env,ctx){const url=new URL(request.url);try{
  if(url.pathname==='/professional-mode-ui-v141.js'&&request.method==='GET')return new Response(PROFESSIONAL_UI_PATCH,{headers:{'content-type':'application/javascript; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
  if(url.pathname==='/api/v1/professional/capabilities'&&request.method==='POST')return addDraftCapability(request,env);
  if(url.pathname==='/api/v1/professional/profile'&&['POST','PATCH'].includes(request.method))return friendlyProfileSave(request,env,ctx);
  if(request.method==='GET'&&(url.pathname==='/app'||url.pathname.startsWith('/app/')))return injectProfessionalUi(request,env,ctx);
  return app.fetch(request,env,ctx)
}catch(error){console.error('professional_setup_v141_error',error);return json({error:error?.message||'professional_setup_unavailable'},error?.status>=400&&error?.status<600?error.status:500)}}};
