const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const workerPath=path.join(root,'merchant-backend','worker-v107.js');
const adminPath=path.join(root,'admin.js');
const htmlPath=path.join(root,'admin.html');

let worker=fs.readFileSync(workerPath,'utf8');
let admin=fs.readFileSync(adminPath,'utf8');
let html=fs.readFileSync(htmlPath,'utf8');

function replaceOnce(source,needle,replacement,label){
  if(!source.includes(needle))throw new Error(`Missing ${label}`);
  return source.replace(needle,replacement);
}

worker=replaceOnce(
  worker,
  "  if(path==='/api/v1/admin/health')return method==='GET'?'operations.health.read':'operations.health.unsupported';",
  "  if(path==='/api/v1/admin/health')return method==='GET'?'operations.health.read':'operations.health.unsupported';\n  if(path==='/api/v1/admin/intelligence')return method==='GET'?'platform.intelligence.read':'platform.intelligence.unsupported';",
  'intelligence action classification'
);

const intelligenceWorker=`
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
    addSignal(signals,{code:'disabled_members',label:'Disabled members present',detail:\`\${counts.disabledMembers} member account(s) are disabled.\`,weight:Math.min(12,counts.disabledMembers*4),severity:'info'});
  }
  if(counts.recentDenied>0){
    const weight=Math.min(25,counts.recentDenied*3);
    risk+=weight;security-=weight;
    addSignal(signals,{code:'recent_denials',label:'Recent denied requests',detail:\`\${counts.recentDenied} security-relevant denied request(s) were recorded in the last 24 hours.\`,weight,severity:counts.recentDenied>=5?'critical':'warning'});
  }
  if(counts.recentErrors>0){
    const weight=Math.min(20,counts.recentErrors*5);
    risk+=weight;
    addSignal(signals,{code:'recent_errors',label:'Recent server errors',detail:\`\${counts.recentErrors} protected request(s) returned HTTP 500 or higher.\`,weight,severity:'warning'});
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
      env.DB.prepare(\`SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status='disabled' THEN 1 ELSE 0 END) AS disabled,
        SUM(CASE WHEN role='owner' AND status='active' THEN 1 ELSE 0 END) AS active_owners
        FROM merchant_members WHERE organization_id=?\`).bind(org.id).first(),
      env.DB.prepare(\`SELECT COUNT(*) AS active FROM merchant_sessions s JOIN merchant_members m ON m.id=s.member_id WHERE m.organization_id=? AND s.expires_at>datetime('now')\`).bind(org.id).first(),
      env.DB.prepare(\`SELECT COUNT(*) AS active FROM merchant_api_tokens WHERE organization_id=? AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at>datetime('now'))\`).bind(org.id).first(),
      env.DB.prepare(\`SELECT
        SUM(CASE WHEN status IN(401,403) AND path!='/api/v1/admin/notifications' THEN 1 ELSE 0 END) AS denied,
        SUM(CASE WHEN status>=500 THEN 1 ELSE 0 END) AS errors,
        COUNT(*) AS activity
        FROM platform_audit_events WHERE created_at>=datetime('now','-24 hours') AND path LIKE ?\`).bind(\`%\${org.id}%\`).first()
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

`;

worker=replaceOnce(worker,'async function operationsHealth(request,env,role,id){',intelligenceWorker+'async function operationsHealth(request,env,role,id){','intelligence worker insertion point');
worker=replaceOnce(
  worker,
  "        else if(path==='/api/v1/admin/health'&&request.method==='GET')response=await operationsHealth(request,env,role,id);",
  "        else if(path==='/api/v1/admin/health'&&request.method==='GET')response=await operationsHealth(request,env,role,id);\n        else if(path==='/api/v1/admin/intelligence'&&request.method==='GET')response=await platformIntelligence(request,env,role,id);",
  'intelligence dispatch route'
);

admin=replaceOnce(admin,"operationsData=null,selectedOrganizationId='',","operationsData=null,intelligenceData=null,selectedOrganizationId='',",'intelligence state');

const intelligenceAdmin=`
function intelligenceTone(band){return band==='critical'?'failure':band==='elevated'?'warning':band==='watch'?'neutral':'healthy'}
function platformIntelligenceCenter(){setTimeout(bindPlatformIntelligence,0);setTimeout(()=>loadPlatformIntelligence().catch(()=>{}),0);
  if(!intelligenceData)return \`<section class="intelligence-center"><div class="intelligence-head"><div><div class="eyebrow">PLATFORM INTELLIGENCE</div><h2>Explainable risk and readiness</h2><p>Loading deterministic organization signals…</p></div><button id="refresh-intelligence" class="secondary">Refresh intelligence</button></div></section>\`;
  const summary=intelligenceData.summary||{};
  const organizations=intelligenceData.organizations||[];
  return \`<section class="intelligence-center">
    <div class="intelligence-head"><div><div class="eyebrow">PLATFORM INTELLIGENCE</div><h2>Explainable risk and readiness</h2><p>Scores are derived from current platform records. No opaque model or invented confidence values.</p></div><button id="refresh-intelligence" class="secondary">Refresh intelligence</button></div>
    <div class="intelligence-summary">
      <div><b>\${summary.averageHealth??100}</b><span>Average health</span></div>
      <div><b>\${summary.averageRisk??0}</b><span>Average risk</span></div>
      <div class="\${summary.critical?'failure':'healthy'}"><b>\${summary.critical||0}</b><span>Critical</span></div>
      <div class="\${summary.elevated?'warning':'healthy'}"><b>\${summary.elevated||0}</b><span>Elevated</span></div>
    </div>
    <div class="intelligence-list">\${organizations.length?organizations.map(item=>{
      const ai=item.intelligence;
      const top=ai.signals?.slice(0,3)||[];
      return \`<article class="intelligence-card \${intelligenceTone(ai.band)}">
        <div class="intelligence-card-head"><div><h3>\${esc(item.name||'Unnamed organization')}</h3><span>\${esc(item.owner_email||'No owner email')}</span></div><div class="risk-orb"><b>\${ai.risk}</b><span>risk</span></div></div>
        <div class="intelligence-scores"><span>Health <b>\${ai.health}</b></span><span>Trust <b>\${ai.trust}</b></span><span>Security <b>\${ai.security}</b></span><span>Readiness <b>\${ai.readiness}</b></span><span>Engagement <b>\${ai.engagement}</b></span></div>
        <div class="intelligence-signals">\${top.length?top.map(signal=>\`<div class="\${esc(signal.severity)}"><strong>\${esc(signal.label)}</strong><span>\${esc(signal.detail)}</span></div>\`).join(''):'<div class="healthy"><strong>No material risk signals</strong><span>Current records do not indicate immediate intervention.</span></div>'}</div>
        <div class="intelligence-recommendation"><span>Recommended next action</span><strong>\${esc(ai.recommendations?.[0]?.action||'Continue monitoring')}</strong><small>\${esc(ai.recommendations?.[0]?.reason||'')}</small></div>
        <button class="secondary compact" data-open-organization="\${esc(item.id)}">Open organization</button>
      </article>\`
    }).join(''):'<div class="empty"><strong>No organizations available</strong>Platform Intelligence will populate after the first company registers.</div>'}</div>
    <p class="intelligence-method">Methodology: \${esc(intelligenceData.methodology||'deterministic-v1')} · Generated \${esc(new Date(intelligenceData.generatedAt).toLocaleString())}</p>
  </section>\`;
}

async function loadPlatformIntelligence(force=false){
  if(intelligenceData&&!force)return;
  try{intelligenceData=await api('/api/v1/admin/intelligence')}catch(error){intelligenceData={summary:{},organizations:[],methodology:'unavailable',generatedAt:new Date().toISOString(),error:error.message}}
  render();
}

function bindPlatformIntelligence(){
  const refresh=$('#refresh-intelligence');
  if(refresh)refresh.onclick=async()=>{intelligenceData=null;render();await loadPlatformIntelligence(true)};
}

`;

admin=replaceOnce(admin,'function organizationCenter(){',intelligenceAdmin+'function organizationCenter(){','intelligence UI insertion point');

if(!admin.includes('${organizationCenter()}'))throw new Error('Missing organization center render call');
admin=admin.replace('${organizationCenter()}','${platformIntelligenceCenter()}\n${organizationCenter()}');

// Platform Intelligence binds itself after the rendered DOM is installed.\n
// Platform Intelligence loads itself after rendering, independent of the overview-fetch implementation.

const css=`
.intelligence-center{margin:0 0 22px;padding:22px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(135deg,rgba(99,230,155,.055),transparent 45%),var(--card)}.intelligence-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}.intelligence-head h2{margin:4px 0 7px}.intelligence-head p{max-width:720px;color:var(--muted)}.intelligence-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin-top:18px}.intelligence-summary>div{padding:15px;border:1px solid var(--line);border-radius:13px;background:var(--card2)}.intelligence-summary b{display:block;font-size:26px}.intelligence-summary span{color:var(--muted);font-size:11px}.intelligence-summary .failure{border-color:rgba(255,145,138,.45)}.intelligence-summary .warning{border-color:rgba(255,205,116,.4)}.intelligence-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px;margin-top:14px}.intelligence-card{padding:16px;border:1px solid var(--line);border-radius:14px;background:var(--card2)}.intelligence-card.failure{border-color:rgba(255,145,138,.45)}.intelligence-card.warning{border-color:rgba(255,205,116,.38)}.intelligence-card-head{display:flex;justify-content:space-between;gap:12px}.intelligence-card-head h3{margin:0}.intelligence-card-head span{display:block;color:var(--muted);font-size:11px;margin-top:4px}.risk-orb{display:grid;place-items:center;min-width:56px;height:56px;border:1px solid var(--line);border-radius:50%}.risk-orb b{font-size:19px}.risk-orb span{font-size:9px;margin:0;text-transform:uppercase}.intelligence-scores{display:flex;flex-wrap:wrap;gap:6px;margin:13px 0}.intelligence-scores span{padding:5px 7px;border:1px solid var(--line);border-radius:999px;font-size:10px;color:var(--muted)}.intelligence-scores b{color:var(--ink)}.intelligence-signals{display:grid;gap:6px}.intelligence-signals>div{padding:9px;border-radius:10px;background:var(--card)}.intelligence-signals strong,.intelligence-signals span{display:block}.intelligence-signals span{font-size:10px;color:var(--muted);margin-top:3px}.intelligence-recommendation{margin:10px 0;padding:11px;border-left:2px solid var(--green);background:rgba(99,230,155,.035)}.intelligence-recommendation span,.intelligence-recommendation strong,.intelligence-recommendation small{display:block}.intelligence-recommendation span,.intelligence-recommendation small{color:var(--muted);font-size:10px}.intelligence-recommendation strong{margin:3px 0}.intelligence-method{margin:12px 0 0;color:var(--muted);font-size:10px}@media(max-width:900px){.intelligence-list{grid-template-columns:1fr}}@media(max-width:720px){.intelligence-head{display:block}.intelligence-head button{width:100%;margin-top:12px}.intelligence-summary{grid-template-columns:1fr 1fr}}
`;
if(!html.includes('</style>'))throw new Error('Missing admin style tag');
html=html.replace('</style>',css+'</style>');

fs.writeFileSync(workerPath,worker);
fs.writeFileSync(adminPath,admin);
fs.writeFileSync(htmlPath,html);
console.log('✅ Added deterministic Platform Intelligence endpoint');
console.log('✅ Added organization health, risk, trust, security, readiness and engagement scores');
console.log('✅ Added explainable signals and prioritized recommendations');
console.log('✅ Added Platform Intelligence Center to admin UI');
