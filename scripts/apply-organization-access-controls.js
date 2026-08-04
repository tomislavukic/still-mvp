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

// ---------------------------------------------------------
// Worker: action classification and strict owner-only writes
// ---------------------------------------------------------
worker=replaceOnce(
  worker,
  "  if(method==='GET'&&/\\/organizations\\/[^/]+\\/identity$/.test(path))return 'merchant.identity.read';",
  "  if(method==='GET'&&/\\/organizations\\/[^/]+\\/identity$/.test(path))return 'merchant.identity.read';\n  if(method==='POST'&&/\\/organizations\\/[^/]+\\/members\\/[^/]+\\/status$/.test(path))return 'merchant.member.status';\n  if(method==='POST'&&/\\/organizations\\/[^/]+\\/sessions\\/[^/]+\\/revoke$/.test(path))return 'merchant.session.revoke';\n  if(method==='POST'&&/\\/organizations\\/[^/]+\\/api-tokens\\/[^/]+\\/revoke$/.test(path))return 'merchant.api_token.revoke';",
  'access control action routes'
);

worker=replaceOnce(
  worker,
  "  if(method==='POST'&&(/\\/verifications\\/[^/]+\\/review$/.test(path)||/\\/retailer-claims\\/[^/]+\\/review$/.test(path)))return REVIEW_ROLES.has(role);\n  return role==='owner'||role==='admin';",
  "  if(method==='POST'&&(/\\/organizations\\/[^/]+\\/(members|sessions|api-tokens)\\/[^/]+\\/(status|revoke)$/.test(path)))return role==='owner';\n  if(method==='POST'&&(/\\/verifications\\/[^/]+\\/review$/.test(path)||/\\/retailer-claims\\/[^/]+\\/review$/.test(path)))return REVIEW_ROLES.has(role);\n  return role==='owner'||role==='admin';",
  'owner-only access controls'
);

const controlsHandler=`
async function readJsonBody(request){
  try{return await request.json()}catch{return{}}
}

function validReason(value){
  const reason=String(value||'').trim();
  return reason.length>=8&&reason.length<=500?reason:null;
}

async function writeOrganizationControlAudit(env,{organizationId,memberId,action,entityType,entityId,details}){
  await env.DB.prepare(\`
    INSERT INTO ops_audit_log(
      id,organization_id,member_id,action,entity_type,entity_id,details_json,created_at
    ) VALUES(?,?,?,?,?,?,?,?)
  \`).bind(
    \`oal_\${crypto.randomUUID().replaceAll('-','')}\`,
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

  const member=await env.DB.prepare(\`
    SELECT id,email,role,status FROM merchant_members
    WHERE id=? AND organization_id=? LIMIT 1
  \`).bind(memberId,organizationId).first();
  if(!member)return json({error:'member_not_found'},404,{'x-request-id':id});
  if(member.status===nextStatus)return json({member,changed:false},200,{'x-request-id':id});

  if(member.role==='owner'&&nextStatus==='disabled'){
    const owners=await env.DB.prepare(\`
      SELECT COUNT(*) AS count FROM merchant_members
      WHERE organization_id=? AND role='owner' AND status='active'
    \`).bind(organizationId).first();
    if(Number(owners?.count||0)<=1)return json({error:'last_owner_protected'},409,{'x-request-id':id});
  }

  await env.DB.prepare(\`
    UPDATE merchant_members SET status=?,updated_at=?
    WHERE id=? AND organization_id=?
  \`).bind(nextStatus,now(),memberId,organizationId).run();

  if(nextStatus==='disabled'){
    await env.DB.prepare(\`
      DELETE FROM merchant_sessions
      WHERE member_id=?
    \`).bind(memberId).run();
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

  const session=await env.DB.prepare(\`
    SELECT s.id,s.member_id,m.email
    FROM merchant_sessions s
    JOIN merchant_members m ON m.id=s.member_id
    WHERE s.id=? AND m.organization_id=? LIMIT 1
  \`).bind(sessionId,organizationId).first();
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

  const apiToken=await env.DB.prepare(\`
    SELECT id,member_id,label,revoked_at
    FROM merchant_api_tokens
    WHERE id=? AND organization_id=? LIMIT 1
  \`).bind(tokenId,organizationId).first();
  if(!apiToken)return json({error:'api_token_not_found'},404,{'x-request-id':id});
  if(apiToken.revoked_at)return json({revoked:true,tokenId,changed:false},200,{'x-request-id':id});

  const revokedAt=now();
  await env.DB.prepare(\`
    UPDATE merchant_api_tokens SET revoked_at=?
    WHERE id=? AND organization_id=?
  \`).bind(revokedAt,tokenId,organizationId).run();
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

`;

worker=replaceOnce(
  worker,
  'async function organizationIdentity(request,env,role,id,organizationId){',
  controlsHandler+'async function organizationIdentity(request,env,role,id,organizationId){',
  'access control handler insertion point'
);

worker=replaceOnce(
  worker,
  "        else if(request.method==='GET'&&/^\\/api\\/v1\\/admin\\/organizations\\/[^/]+\\/identity$/.test(path)){\n          const organizationId=decodeURIComponent(path.split('/')[5]||'');\n          response=await organizationIdentity(request,env,role,id,organizationId);\n        }",
  "        else if(request.method==='GET'&&/^\\/api\\/v1\\/admin\\/organizations\\/[^/]+\\/identity$/.test(path)){\n          const organizationId=decodeURIComponent(path.split('/')[5]||'');\n          response=await organizationIdentity(request,env,role,id,organizationId);\n        }\n        else if(request.method==='POST'&&/^\\/api\\/v1\\/admin\\/organizations\\/[^/]+\\/members\\/[^/]+\\/status$/.test(path)){\n          const parts=path.split('/');\n          response=await changeMemberStatus(request,env,role,id,decodeURIComponent(parts[5]||''),decodeURIComponent(parts[7]||''));\n        }\n        else if(request.method==='POST'&&/^\\/api\\/v1\\/admin\\/organizations\\/[^/]+\\/sessions\\/[^/]+\\/revoke$/.test(path)){\n          const parts=path.split('/');\n          response=await revokeOrganizationSession(request,env,role,id,decodeURIComponent(parts[5]||''),decodeURIComponent(parts[7]||''));\n        }\n        else if(request.method==='POST'&&/^\\/api\\/v1\\/admin\\/organizations\\/[^/]+\\/api-tokens\\/[^/]+\\/revoke$/.test(path)){\n          const parts=path.split('/');\n          response=await revokeOrganizationApiToken(request,env,role,id,decodeURIComponent(parts[5]||''),decodeURIComponent(parts[7]||''));\n        }",
  'access control dispatch routes'
);

// ---------------------------------------------------------
// Admin UI: action controls and confirmation modal
// ---------------------------------------------------------
admin=replaceOnce(
  admin,
  "          <span class=\"identity-state ${esc(member.status)}\">${esc(member.status)}</span>",
  "          <span class=\"identity-state ${esc(member.status)}\">${esc(member.status)}</span>\n          <button class=\"identity-control compact\" data-member-control=\"${esc(member.id)}\" data-member-status=\"${esc(member.status)}\">${member.status==='active'?'Disable':'Reactivate'}</button>",
  'member control button'
);

admin=replaceOnce(
  admin,
  "<td>${esc(identityDate(session.expires_at))}</td></tr>",
  "<td>${esc(identityDate(session.expires_at))}</td><td><button class=\"identity-control compact\" data-session-revoke=\"${esc(session.id)}\" ${session.state!=='active'?'disabled':''}>Revoke</button></td></tr>",
  'session revoke button'
);

admin=replaceOnce(
  admin,
  "<th>Member</th><th>State</th><th>Last seen</th><th>Expires</th>",
  "<th>Member</th><th>State</th><th>Last seen</th><th>Expires</th><th>Action</th>",
  'session action heading'
);

admin=replaceOnce(
  admin,
  "<tr><td colspan=\"4\">No sessions recorded.</td></tr>",
  "<tr><td colspan=\"5\">No sessions recorded.</td></tr>",
  'session empty colspan'
);

admin=replaceOnce(
  admin,
  "<td>${esc(identityDate(apiToken.last_used_at))}</td></tr>",
  "<td>${esc(identityDate(apiToken.last_used_at))}</td><td><button class=\"identity-control compact\" data-token-revoke=\"${esc(apiToken.id)}\" ${apiToken.state!=='active'?'disabled':''}>Revoke</button></td></tr>",
  'token revoke button'
);

admin=replaceOnce(
  admin,
  "<th>Label</th><th>Member</th><th>State</th><th>Last used</th>",
  "<th>Label</th><th>Member</th><th>State</th><th>Last used</th><th>Action</th>",
  'token action heading'
);

admin=replaceOnce(
  admin,
  "<tr><td colspan=\"4\">No API tokens recorded.</td></tr>",
  "<tr><td colspan=\"5\">No API tokens recorded.</td></tr>",
  'token empty colspan'
);

const modalFunctions=`
function accessControlDialog({title,detail,confirmLabel='Apply action'}){
  return new Promise(resolve=>{
    const overlay=document.createElement('div');
    overlay.className='access-control-overlay';
    overlay.innerHTML=\`<div class="access-control-dialog" role="dialog" aria-modal="true">
      <div class="eyebrow">PLATFORM OWNER ACTION</div>
      <h3>\${esc(title)}</h3>
      <p>\${esc(detail)}</p>
      <label>Reason<textarea id="access-control-reason" maxlength="500" placeholder="Explain why this intervention is necessary (minimum 8 characters)"></textarea></label>
      <label>Type CONFIRM<input id="access-control-confirm" autocomplete="off" placeholder="CONFIRM"></label>
      <div class="access-control-actions"><button class="secondary" id="access-control-cancel">Cancel</button><button id="access-control-submit">\${esc(confirmLabel)}</button></div>
      <p class="small">Every successful action is recorded in platform and organization audit history.</p>
    </div>\`;
    document.body.appendChild(overlay);
    const close=value=>{overlay.remove();resolve(value)};
    overlay.querySelector('#access-control-cancel').onclick=()=>close(null);
    overlay.onclick=event=>{if(event.target===overlay)close(null)};
    overlay.querySelector('#access-control-submit').onclick=()=>{
      const reason=overlay.querySelector('#access-control-reason').value.trim();
      const confirm=overlay.querySelector('#access-control-confirm').value.trim();
      if(reason.length<8)return alert('Enter a reason of at least 8 characters.');
      if(confirm!=='CONFIRM')return alert('Type CONFIRM exactly.');
      close({reason,confirm});
    };
  });
}

async function runOrganizationControl(org,path,payload){
  try{
    await api(path,{method:'POST',body:JSON.stringify(payload)});
    organizationIdentityCache.delete(org.id);
    await loadOrganizationIdentity(org,true);
  }catch(error){
    const messages={last_owner_protected:'The final active organization owner cannot be disabled.',confirmation_required:'Confirmation was rejected.',reason_required:'A valid reason is required.'};
    alert(messages[error.data?.error]||error.message);
  }
}

function bindOrganizationAccessControls(org){
  document.querySelectorAll('[data-member-control]').forEach(button=>{
    button.onclick=async()=>{
      const current=button.dataset.memberStatus;
      const next=current==='active'?'disabled':'active';
      const values=await accessControlDialog({title:next==='disabled'?'Disable organization member':'Reactivate organization member',detail:next==='disabled'?'This immediately terminates the member’s active sessions.':'This restores the member’s ability to authenticate.',confirmLabel:next==='disabled'?'Disable member':'Reactivate member'});
      if(!values)return;
      await runOrganizationControl(org,\`/api/v1/admin/organizations/\${encodeURIComponent(org.id)}/members/\${encodeURIComponent(button.dataset.memberControl)}/status\`,{...values,status:next});
    };
  });
  document.querySelectorAll('[data-session-revoke]').forEach(button=>{
    button.onclick=async()=>{
      const values=await accessControlDialog({title:'Revoke merchant session',detail:'The selected session will be terminated immediately.',confirmLabel:'Revoke session'});
      if(!values)return;
      await runOrganizationControl(org,\`/api/v1/admin/organizations/\${encodeURIComponent(org.id)}/sessions/\${encodeURIComponent(button.dataset.sessionRevoke)}/revoke\`,values);
    };
  });
  document.querySelectorAll('[data-token-revoke]').forEach(button=>{
    button.onclick=async()=>{
      const values=await accessControlDialog({title:'Revoke API token',detail:'Requests using this token will stop working immediately. The token secret cannot be recovered.',confirmLabel:'Revoke token'});
      if(!values)return;
      await runOrganizationControl(org,\`/api/v1/admin/organizations/\${encodeURIComponent(org.id)}/api-tokens/\${encodeURIComponent(button.dataset.tokenRevoke)}/revoke\`,values);
    };
  });
}

`;

admin=replaceOnce(
  admin,
  'function identityDate(value){',
  modalFunctions+'function identityDate(value){',
  'access control UI function insertion point'
);

admin=replaceOnce(
  admin,
  "  const retryButton=$('#retry-organization-identity');",
  "  bindOrganizationAccessControls(org);\n\n  const retryButton=$('#retry-organization-identity');",
  'access control binding hook'
);

const accessCss=`
.identity-control{min-height:34px;padding:6px 9px;font-size:10px}.identity-control:disabled{cursor:not-allowed;opacity:.35}.access-control-overlay{position:fixed;inset:0;z-index:120;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.72);backdrop-filter:blur(8px)}.access-control-dialog{width:min(520px,100%);padding:22px;border:1px solid var(--line2);border-radius:18px;background:#07140d;box-shadow:0 30px 90px rgba(0,0,0,.55)}.access-control-dialog h3{margin:5px 0}.access-control-dialog label{display:block;margin-top:14px;color:var(--muted);font-size:12px}.access-control-dialog textarea,.access-control-dialog input{display:block;width:100%;margin-top:6px;background:var(--card);color:var(--ink);border:1px solid var(--line);border-radius:11px;padding:12px;font:inherit}.access-control-dialog textarea{min-height:100px;resize:vertical}.access-control-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}@media(max-width:720px){.access-control-actions{display:grid}.access-control-actions button{width:100%}}
`;

if(!html.includes('</style>'))throw new Error('Missing admin style closing tag');
html=html.replace('</style>',accessCss+'</style>');

fs.writeFileSync(workerPath,worker);
fs.writeFileSync(adminPath,admin);
fs.writeFileSync(htmlPath,html);

console.log('✅ Added owner-only organization access controls');
console.log('✅ Added final-owner protection');
console.log('✅ Added member disable/reactivate, session revoke and API-token revoke');
console.log('✅ Added mandatory reason and CONFIRM phrase');
console.log('✅ Added organization and platform audit coverage');
