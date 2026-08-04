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

// Worker action classification.
worker=replaceOnce(
  worker,
  "  if(method==='GET'&&/\\/organizations\\/[^/]+\\/events$/.test(path))return 'merchant.audit.read';",
  "  if(method==='GET'&&/\\/organizations\\/[^/]+\\/identity$/.test(path))return 'merchant.identity.read';\n  if(method==='GET'&&/\\/organizations\\/[^/]+\\/events$/.test(path))return 'merchant.audit.read';",
  'identity action route'
);

const identityHandler=`
async function organizationIdentity(request,env,role,id,organizationId){
  if(!READ_ROLES.has(role))return json({error:'forbidden'},403,{'x-request-id':id});

  const organization=await env.DB.prepare(
    'SELECT id,name,status,created_at,updated_at FROM merchant_organizations WHERE id=? LIMIT 1'
  ).bind(organizationId).first();

  if(!organization)return json({error:'organization_not_found'},404,{'x-request-id':id});

  const [membersResult,sessionsResult,tokensResult,auditResult]=await Promise.all([
    env.DB.prepare(\`
      SELECT id,email,role,status,created_at,updated_at
      FROM merchant_members
      WHERE organization_id=?
      ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'agent' THEN 2 ELSE 3 END,email
    \`).bind(organizationId).all(),

    env.DB.prepare(\`
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
    \`).bind(organizationId).all(),

    env.DB.prepare(\`
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
    \`).bind(organizationId).all(),

    env.DB.prepare(\`
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
    \`).bind(organizationId).all()
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

`;

worker=replaceOnce(
  worker,
  'function withRequestId(response,id){',
  identityHandler+'function withRequestId(response,id){',
  'worker handler insertion point'
);

worker=replaceOnce(
  worker,
  "        else if(path==='/api/v1/admin/health'&&request.method==='GET')response=await operationsHealth(request,env,role,id);\n        else response=withRequestId(await app.fetch(delegatedRequest(request,env,role),env,ctx),id);",
  "        else if(path==='/api/v1/admin/health'&&request.method==='GET')response=await operationsHealth(request,env,role,id);\n        else if(request.method==='GET'&&/^\\/api\\/v1\\/admin\\/organizations\\/[^/]+\\/identity$/.test(path)){\n          const organizationId=decodeURIComponent(path.split('/')[5]||'');\n          response=await organizationIdentity(request,env,role,id,organizationId);\n        }\n        else response=withRequestId(await app.fetch(delegatedRequest(request,env,role),env,ctx),id);",
  'worker identity dispatch'
);

// Admin state and navigation.
admin=replaceOnce(
  admin,
  "operationsData=null,selectedOrganizationId='',activeOrganizationTab='overview',sessionTimer=0;",
  "operationsData=null,selectedOrganizationId='',activeOrganizationTab='overview',organizationIdentityCache=new Map(),sessionTimer=0;",
  'admin identity cache state'
);

admin=replaceOnce(
  admin,
  "    ['overview','Overview'],\n    ['identity','Identity'],",
  "    ['overview','Overview'],\n    ['team','Team & Access'],\n    ['identity','Identity'],",
  'team navigation tab'
);

admin=replaceOnce(
  admin,
  "  switch(activeOrganizationTab){\n    case'identity':",
  "  switch(activeOrganizationTab){\n    case'team':\n      return organizationTeamTab(org);\n    case'identity':",
  'team tab switch'
);

const teamFunctions=`
function identityDate(value){
  if(!value)return 'Never';
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'Unavailable':date.toLocaleString();
}

function organizationTeamTab(org){
  const cached=organizationIdentityCache.get(org.id);
  if(!cached)return \`<div class="organization-tab-panel">
    <section class="organization-workspace-section first">
      <div class="eyebrow">TEAM & ACCESS</div>
      <h3>Loading organization access…</h3>
      <p>Reading sanitized members, sessions, API tokens and organization audit activity.</p>
    </section>
  </div>\`;

  if(cached.error)return \`<div class="organization-tab-panel">
    <section class="organization-workspace-section first identity-error">
      <div class="eyebrow">TEAM & ACCESS</div>
      <h3>Identity data could not be loaded</h3>
      <p>\${esc(cached.error)}</p>
      <button class="secondary" id="retry-organization-identity">Retry</button>
    </section>
  </div>\`;

  const summary=cached.summary||{};
  const members=cached.members||[];
  const sessions=cached.sessions||[];
  const tokens=cached.apiTokens||[];
  const audit=cached.audit||[];

  return \`<div class="organization-tab-panel">
    <section class="organization-workspace-section first">
      <div class="eyebrow">TEAM & ACCESS</div>
      <h3>Read-only platform visibility</h3>
      <p>Password material, salts, session token hashes and API token hashes are never returned.</p>

      <div class="identity-summary">
        <div><b>\${summary.members||0}</b><span>Members</span></div>
        <div><b>\${summary.activeMembers||0}</b><span>Active members</span></div>
        <div><b>\${summary.activeSessions||0}</b><span>Active sessions</span></div>
        <div><b>\${summary.activeApiTokens||0}</b><span>Active API tokens</span></div>
      </div>
    </section>

    <section class="organization-workspace-section">
      <div class="organization-section-heading"><div><div class="eyebrow">MEMBERS</div><h3>Organization team</h3></div><span class="organization-section-count">\${members.length}</span></div>
      <div class="identity-list">\${members.length?members.map(member=>\`
        <article class="identity-row">
          <div class="identity-avatar">\${esc((member.email||'?')[0].toUpperCase())}</div>
          <div class="identity-main"><strong>\${esc(member.email)}</strong><span>Created \${esc(identityDate(member.created_at))}</span></div>
          <span class="identity-role">\${esc(member.role)}</span>
          <span class="identity-state \${esc(member.status)}">\${esc(member.status)}</span>
        </article>\`).join(''):'<p class="small">No organization members are recorded.</p>'}</div>
    </section>

    <section class="organization-workspace-section">
      <div class="organization-section-heading"><div><div class="eyebrow">SESSIONS</div><h3>Recent merchant sessions</h3></div><span class="organization-section-count">\${sessions.length}</span></div>
      <div class="identity-table-wrap"><table class="identity-table"><thead><tr><th>Member</th><th>State</th><th>Last seen</th><th>Expires</th></tr></thead><tbody>\${sessions.length?sessions.map(session=>\`<tr><td>\${esc(session.member_email||session.member_id)}</td><td><span class="identity-state \${esc(session.state)}">\${esc(session.state)}</span></td><td>\${esc(identityDate(session.last_seen_at))}</td><td>\${esc(identityDate(session.expires_at))}</td></tr>\`).join(''):'<tr><td colspan="4">No sessions recorded.</td></tr>'}</tbody></table></div>
    </section>

    <section class="organization-workspace-section">
      <div class="organization-section-heading"><div><div class="eyebrow">API ACCESS</div><h3>Organization API tokens</h3></div><span class="organization-section-count">\${tokens.length}</span></div>
      <div class="identity-table-wrap"><table class="identity-table"><thead><tr><th>Label</th><th>Member</th><th>State</th><th>Last used</th></tr></thead><tbody>\${tokens.length?tokens.map(apiToken=>\`<tr><td>\${esc(apiToken.label||'default')}</td><td>\${esc(apiToken.member_email||'Organization token')}</td><td><span class="identity-state \${esc(apiToken.state)}">\${esc(apiToken.state)}</span></td><td>\${esc(identityDate(apiToken.last_used_at))}</td></tr>\`).join(''):'<tr><td colspan="4">No API tokens recorded.</td></tr>'}</tbody></table></div>
    </section>

    <section class="organization-workspace-section">
      <div class="organization-section-heading"><div><div class="eyebrow">ORGANIZATION AUDIT</div><h3>Recent member activity</h3></div><span class="organization-section-count">\${audit.length}</span></div>
      <div class="identity-audit">\${audit.length?audit.slice(0,25).map(event=>\`<div><strong>\${esc(event.action)}</strong><span>\${esc(event.member_email||event.member_id||'Unknown member')} · \${esc(event.entity_type)} · \${esc(identityDate(event.created_at))}</span></div>\`).join(''):'<p class="small">No organization audit activity recorded.</p>'}</div>
    </section>
  </div>\`;
}

async function loadOrganizationIdentity(org,force=false){
  if(!force&&organizationIdentityCache.has(org.id)){
    const content=$('#organization-workspace-content');
    if(content&&activeOrganizationTab==='team')content.innerHTML=organizationTeamTab(org);
    bindOrganizationTabActions(org);
    return;
  }

  try{
    const result=await api(\`/api/v1/admin/organizations/\${encodeURIComponent(org.id)}/identity\`);
    organizationIdentityCache.set(org.id,result);
  }catch(error){
    organizationIdentityCache.set(org.id,{error:error.status===403?'Your platform role cannot inspect organization identity.':error.message});
  }

  const content=$('#organization-workspace-content');
  if(content&&activeOrganizationTab==='team')content.innerHTML=organizationTeamTab(org);
  bindOrganizationTabActions(org);
}

`;

admin=replaceOnce(
  admin,
  'function organizationActiveTab(org){',
  teamFunctions+'function organizationActiveTab(org){',
  'team function insertion point'
);

admin=replaceOnce(
  admin,
  "        content.innerHTML=organizationActiveTab(org);\n        bindOrganizationTabActions(org);",
  "        content.innerHTML=organizationActiveTab(org);\n        bindOrganizationTabActions(org);\n        if(activeOrganizationTab==='team')loadOrganizationIdentity(org);",
  'team tab loading hook'
);

admin=replaceOnce(
  admin,
  "function bindOrganizationTabActions(org){\n  const copyButton=$('#copy-organization-id');",
  "function bindOrganizationTabActions(org){\n  const retryButton=$('#retry-organization-identity');\n  if(retryButton)retryButton.onclick=()=>loadOrganizationIdentity(org,true);\n\n  const copyButton=$('#copy-organization-id');",
  'identity retry binding'
);

// Clear sensitive cached responses when admin locks.
admin=replaceOnce(
  admin,
  "  operationsData=null;\n  selectedOrganizationId='';",
  "  operationsData=null;\n  organizationIdentityCache.clear();\n  selectedOrganizationId='';",
  'identity cache lock cleanup'
);

const identityCss=`
.identity-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:16px}
.identity-summary>div{padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--card)}
.identity-summary b{display:block;font-size:24px}.identity-summary span{display:block;color:var(--muted);font-size:11px;margin-top:5px}
.identity-list{display:grid;gap:8px;margin-top:13px}.identity-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:11px;padding:12px;border:1px solid var(--line);border-radius:12px;background:var(--card)}
.identity-avatar{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--card3);color:var(--green);font-weight:900}.identity-main{min-width:0}.identity-main strong,.identity-main span{display:block}.identity-main strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.identity-main span{color:var(--muted);font-size:11px;margin-top:3px}
.identity-role,.identity-state{display:inline-flex;padding:5px 8px;border:1px solid var(--line);border-radius:999px;font-size:10px;text-transform:capitalize}.identity-state.active{color:var(--green);border-color:rgba(99,230,155,.38)}.identity-state.expired,.identity-state.revoked,.identity-state.disabled{color:var(--red);border-color:rgba(255,145,138,.42)}
.identity-table-wrap{overflow:auto;margin-top:13px;border:1px solid var(--line);border-radius:12px}.identity-table{width:100%;border-collapse:collapse;min-width:620px}.identity-table th,.identity-table td{padding:11px 12px;text-align:left;border-bottom:1px solid var(--line);font-size:11px}.identity-table th{color:var(--muted);text-transform:uppercase;letter-spacing:.06em;background:var(--card2)}.identity-table tr:last-child td{border-bottom:0}
.identity-audit{display:grid;margin-top:13px;border:1px solid var(--line);border-radius:12px;overflow:hidden}.identity-audit>div{padding:12px;background:var(--card);border-bottom:1px solid var(--line)}.identity-audit>div:last-child{border-bottom:0}.identity-audit strong,.identity-audit span{display:block}.identity-audit span{color:var(--muted);font-size:11px;margin-top:4px}.identity-error{border:1px solid rgba(255,145,138,.4);border-radius:14px;padding:18px;margin-top:24px}
@media(max-width:720px){.identity-summary{grid-template-columns:1fr 1fr}.identity-row{grid-template-columns:auto minmax(0,1fr)}.identity-role,.identity-state{grid-column:auto}.identity-table{min-width:560px}}
`;

if(!html.includes('</style>'))throw new Error('Missing admin style closing tag');
html=html.replace('</style>',identityCss+'</style>');

fs.writeFileSync(workerPath,worker);
fs.writeFileSync(adminPath,admin);
fs.writeFileSync(htmlPath,html);

console.log('✅ Added protected organization identity endpoint');
console.log('✅ Added Team & Access workspace tab');
console.log('✅ Excluded password, salt and token hash material');
console.log('✅ Added loading, empty, denied and retry states');
