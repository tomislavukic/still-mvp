const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let token='',data=null,currentQ='',currentStatus='',auditData=[],auditAction='',sessionTimer=0;
const ADMIN_SESSION_MS=30*60*1000;async function api(path,opt={}){const r=await fetch(path,{...opt,headers:{'content-type':'application/json','authorization':'Bearer '+token,...(opt.headers||{})}}),j=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(j.error||'Request failed'),{data:j,status:r.status});return j}const labels={awaiting_submission:'Waiting for merchant',submitted:'Submitted',under_review:'Ready for review',needs_changes:'Changes requested',approved:'Verified',rejected:'Rejected'};const pill=s=>`<span class="pill ${esc(s||'')}">${esc(labels[s]||s||'Waiting for merchant')}</span>`;function stage(o){if(o.claim_status==='approved')return 4;if(o.organization_status==='verified')return 3;if(o.verification_status==='approved')return 3;if(['submitted','under_review','needs_changes','rejected'].includes(o.verification_status))return 2;return 1}function stageBar(o){const n=stage(o),items=[['1','Registered'],['2','Company verification'],['3','Retailer profile'],['4','Buyer routing']];return `<div class="progress">${items.map((x,i)=>`<div class="${i+1<n?'done':i+1===n?'current':''}"><b>${x[1]}</b><span>${i+1<n?'Complete':i+1===n?'Current step':'Next'}</span></div>`).join('')}</div>`}function nextAction(o){if(!o.verification_id)return ['Waiting for merchant','The company account exists, but no verification details have been submitted yet. No admin action is required.'];if(o.verification_status==='under_review'||o.verification_status==='submitted')return ['Review company identity','Check legal identity, VAT/registration details, website and company email before deciding.'];if(o.verification_status==='needs_changes')return ['Waiting for corrections','The merchant must update and resubmit the verification details.'];if(o.verification_status==='rejected')return ['Verification rejected','No routing will activate unless the merchant submits a new acceptable verification request.'];if(o.organization_status==='verified'&&!o.claim_id)return ['Company verified','Next, the merchant must claim the retailer profile buyers actually select.'];if(o.claim_status==='under_review')return ['Review retailer ownership','Confirm this verified company controls the selected retailer identity before approving.'];if(o.claim_status==='approved')return ['Routing ready','Company and retailer identity are approved. Buyer cases can be routed to this merchant.'];return ['Verification complete','Continue with retailer identity claiming.']}function stats(s){const cards=[['',s.organizations||0,'Companies'],['pending',s.verification_pending||0,'Ready for review'],['needs_changes',s.needs_changes||0,'Needs changes'],['claim_review',s.claim_pending||0,'Retailer claims'],['verified',s.verified||0,'Verified']];return `<div class="stats">${cards.map(c=>`<div class="stat" data-filter="${c[0]}"><b>${c[1]}</b><span>${c[2]}</span></div>`).join('')}</div>`}function company(o){const vs=o.verification_status||'awaiting_submission',next=nextAction(o);return `<details class="company" data-org="${esc(o.id)}"><summary><div><h3>${esc(o.name)}</h3><div class="small">${esc(o.owner_email||'No owner email')} · ${esc((o.country_code||'').toUpperCase())} · Registered ${new Date(o.created_at).toLocaleDateString()}</div></div><div>${pill(vs)}</div><div>${o.claim_id?pill(o.claim_status):'<span class="small">Retailer profile not claimed</span>'}</div><b>Open →</b></summary><div class="body"><div><section class="panel">${stageBar(o)}<div class="notice"><strong>${esc(next[0])}</strong><span class="small">${esc(next[1])}</span></div><h3>Company verification</h3><div class="grid"><div class="field"><span>Legal name</span>${esc(o.legal_name||'Not submitted')}</div><div class="field"><span>Registration number</span>${esc(o.registration_number||'—')}</div><div class="field"><span>VAT / tax ID</span>${esc(o.vat_id||'—')}</div><div class="field"><span>Website</span>${esc(o.verification_website||o.website_url||'—')}</div><div class="field"><span>Support email</span>${esc(o.verification_email||o.support_email||'—')}</div><div class="field"><span>Domain evidence</span>${esc(o.website_domain||'—')} / ${esc(o.email_domain||'—')}</div></div>${o.verification_review_note?`<p><b>Previous reviewer note:</b> ${esc(o.verification_review_note)}</p>`:''}${o.verification_id&&['submitted','under_review'].includes(o.verification_status)?`<div class="review"><textarea id="note-v-${esc(o.verification_id)}" placeholder="Reviewer note. Required when requesting changes or rejecting."></textarea><div class="actions"><button class="approve" onclick="reviewVerification('${esc(o.verification_id)}','approved')">Approve company</button><button class="changes" onclick="reviewVerification('${esc(o.verification_id)}','needs_changes')">Request changes</button><button class="reject" onclick="reviewVerification('${esc(o.verification_id)}','rejected')">Reject</button></div></div>`:''}${!o.verification_id?'<p class="small">No verification submission yet. This is expected until the merchant completes the Verification Center in their workspace.</p>':''}</section>${o.claim_id?`<section class="panel" style="margin-top:14px"><h3>Retailer profile claim</h3><div class="grid"><div class="field"><span>Retailer</span>${esc(o.retailer_name)}</div><div class="field"><span>Retailer key</span>${esc(o.claimed_retailer_key)}</div><div class="field"><span>Official URL</span>${esc(o.claim_official_url||'—')}</div><div class="field"><span>Status</span>${pill(o.claim_status)}</div></div>${o.claim_status==='under_review'?`<div class="review"><textarea id="note-c-${esc(o.claim_id)}" placeholder="Reviewer note"></textarea><div class="actions"><button class="approve" onclick="reviewClaim('${esc(o.claim_id)}','approved')">Approve retailer claim</button><button class="changes" onclick="reviewClaim('${esc(o.claim_id)}','needs_changes')">Request changes</button><button class="reject" onclick="reviewClaim('${esc(o.claim_id)}','rejected')">Reject</button></div></div>`:''}</section>`:''}</div><aside class="panel"><h3>Audit history</h3><p class="small">Every admin decision is recorded here.</p><div class="timeline" id="events-${esc(o.id)}"><span class="small">Loading history when opened…</span></div></aside></div></details>`}function attention(){const waiting=data.organizations.filter(o=>!o.verification_id).length,review=data.stats.verification_pending||0,claims=data.stats.claim_pending||0;let title='Nothing needs admin attention right now',body='Registered companies remain visible while merchants complete their own verification forms.';if(review){title=`${review} company ${review===1?'is':'are'} ready for verification review`;body='Review legal identity and domain evidence before approving access to retailer claiming.'}else if(claims){title=`${claims} retailer ${claims===1?'claim is':'claims are'} waiting`;body='Verify retailer ownership before buyer routing is connected.'}return `<div class="attention"><div class="next-card"><div class="eyebrow">NEXT ADMIN ACTION</div><h3>${title}</h3><p>${body}</p></div><div class="next-card"><div class="eyebrow">WAITING ON MERCHANTS</div><h3>${waiting}</h3><p>${waiting===1?'1 registered company still needs to submit verification.':`${waiting} registered companies still need to submit verification.`}</p></div></div>`}function workflow(){return `<div class="workflow"><div class="workflow-head"><div><div class="eyebrow">MERCHANT LIFECYCLE</div><h3>From signup to live buyer routing</h3></div><span class="small">Admin only intervenes at review checkpoints.</span></div><div class="flow"><div class="flow-step active"><b>1 · Registration</b><span>Merchant creates company workspace</span></div><div class="flow-step"><b>2 · Verification</b><span>Admin validates legal identity</span></div><div class="flow-step"><b>3 · Retailer claim</b><span>Admin confirms retailer ownership</span></div><div class="flow-step"><b>4 · Routing</b><span>Buyer cases reach the merchant</span></div></div></div>`}
function auditConsole(){
  return `<section class="audit-console panel">
    <div class="audit-head">
      <div>
        <div class="eyebrow">OPERATIONS AUDIT</div>
        <h2>Platform activity</h2>
        <p>Review authenticated admin access, decisions and denied requests.</p>
      </div>
      <button id="refresh-audit" class="secondary">Refresh audit</button>
    </div>

    <div class="audit-filters">
      <input
        id="audit-action"
        value="${esc(auditAction)}"
        placeholder="Filter by exact action, for example verification.review"
      >
      <button id="apply-audit" class="secondary">Apply filter</button>
      <button id="clear-audit" class="secondary">Clear</button>
    </div>

    <div id="audit-results">
      <div class="empty">
        <strong>Audit history is ready</strong>
        Select Refresh audit to load the latest operations events.
      </div>
    </div>
  </section>`;
}

function auditRows(events){
  if(!events.length){
    return `<div class="empty">
      <strong>No audit events found</strong>
      Try clearing the action filter.
    </div>`;
  }

  return `<div class="audit-table-wrap">
    <table class="audit-table">
      <thead>
        <tr>
          <th>Time</th>
          <th>Role</th>
          <th>Action</th>
          <th>Request</th>
          <th>Outcome</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody>
        ${events.map(event=>{
          const metadata=event.metadata||{};
          const statusClass=event.outcome==='success'
            ?'success'
            :event.outcome==='unauthorized'||event.outcome==='forbidden'
              ?'warning'
              :'failure';

          return `<tr>
            <td>
              ${esc(new Date(event.created_at).toLocaleString())}
              <span class="audit-sub">${esc(event.request_id||'—')}</span>
            </td>
            <td>${esc(event.actor_role||'—')}</td>
            <td>
              <strong>${esc(event.action||'—')}</strong>
              <span class="audit-sub">${esc(event.method||'')} ${esc(event.path||'')}</span>
            </td>
            <td>${esc(String(event.status??'—'))}</td>
            <td><span class="audit-outcome ${statusClass}">${esc(event.outcome||'—')}</span></td>
            <td>${esc(String(metadata.durationMs??'—'))} ms</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

async function loadAudit(){
  const results=$('#audit-results');
  if(!results)return;

  results.innerHTML=`<div class="empty">
    <strong>Loading audit events…</strong>
    Reading the latest protected operations history.
  </div>`;

  try{
    const query=new URLSearchParams({limit:'100'});
    if(auditAction)query.set('action',auditAction);

    const response=await api('/api/v1/admin/audit?'+query.toString());
    auditData=response.events||[];
    results.innerHTML=auditRows(auditData);
  }catch(error){
    results.innerHTML=`<div class="empty">
      <strong>Could not load audit history</strong>
      ${esc(error.data?.error||error.message)}
    </div>`;
  }
}

function armAdminSession(){
  clearTimeout(sessionTimer);

  if(!token)return;

  sessionTimer=setTimeout(()=>{
    lockAdmin(
      'Admin session expired',
      'The review center was locked after 30 minutes of inactivity.'
    );
  },ADMIN_SESSION_MS);
}

function registerAdminActivity(){
  if(token)armAdminSession();
}

function lockAdmin(
  title='Admin workspace locked',
  message='Enter the verification admin token to load merchant operations.'
){
  clearTimeout(sessionTimer);
  sessionTimer=0;
  token='';
  data=null;
  auditData=[];
  auditAction='';

  $('#token').value='';
  $('#auth').classList.remove('logged');
  $('#app').innerHTML=`<div class="empty">
    <strong>${esc(title)}</strong>
    ${esc(message)}
  </div>`;
}
function render(){const a=$('#app');a.innerHTML=`<div class="overview">${stats(data.stats)}${workflow()}${attention()}${auditConsole()}<div class="section-title"><h2>Companies</h2><span class="count">${data.organizations.length} shown</span></div><div class="filters"><input id="q" value="${esc(currentQ)}" placeholder="Search company, owner email, VAT, registration or retailer…"><select id="status"><option value="">All companies</option><option value="pending">Ready for review</option><option value="awaiting_submission">Waiting for merchant</option><option value="needs_changes">Needs changes</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="claim_review">Retailer claim review</option></select></div><div>${data.organizations.length?data.organizations.map(company).join(''):'<div class="empty"><strong>No companies match this view</strong>Try another filter or search term.</div>'}</div></div>`;$('#status').value=currentStatus;$('#q').oninput=debounce(()=>{currentQ=$('#q').value;load()},250);$('#status').onchange=()=>{currentStatus=$('#status').value;load()};document.querySelectorAll('.stat').forEach(c=>c.onclick=()=>{currentStatus=c.dataset.filter;load()});
$('#refresh-audit').onclick=loadAudit;
$('#apply-audit').onclick=()=>{
  auditAction=$('#audit-action').value.trim();
  loadAudit();
};
$('#clear-audit').onclick=()=>{
  auditAction='';
  $('#audit-action').value='';
  loadAudit();
};
$('#audit-action').onkeydown=event=>{
  if(event.key==='Enter'){
    auditAction=$('#audit-action').value.trim();
    loadAudit();
  }
};
document.querySelectorAll('details.company').forEach(d=>d.ontoggle=()=>{if(d.open)events(d.dataset.org)})}async function load(){try{data=await api('/api/v1/admin/overview?q='+encodeURIComponent(currentQ)+'&status='+encodeURIComponent(currentStatus));$('#auth').classList.add('logged');armAdminSession();render();loadAudit()}catch(e){$('#auth').classList.remove('logged');$('#app').innerHTML=`<div class="empty"><strong>${e.status===401?'Admin access denied':'Could not load merchant operations'}</strong>${e.status===401?'The token does not match the runtime verification secret.':e.data?.error==='admin_not_configured'?'VERIFICATION_ADMIN_TOKEN is not configured at runtime.':esc(e.message)}</div>`}}async function events(org){try{const r=await api('/api/v1/admin/organizations/'+encodeURIComponent(org)+'/events'),h=document.getElementById('events-'+org);h.innerHTML=r.events.length?r.events.map(e=>`<div class="event"><b>${esc(e.event_type.replaceAll('_',' '))}</b><div class="small">${esc(e.from_status||'—')} → ${esc(e.to_status||'—')} · ${new Date(e.created_at).toLocaleString()}</div>${e.review_note?`<p>${esc(e.review_note)}</p>`:''}</div>`).join(''):'<div class="empty" style="padding:22px 8px"><strong>No admin decisions yet</strong>The audit trail begins when verification or retailer ownership is reviewed.</div>'}catch{}}async function reviewVerification(id,decision){const note=document.getElementById('note-v-'+id).value.trim();if(decision!=='approved'&&!note)return alert('Add a reviewer note before requesting changes or rejecting.');if(!confirm(`Confirm ${decision.replaceAll('_',' ')}?`))return;try{await api('/api/v1/admin/verifications/'+encodeURIComponent(id)+'/review',{method:'POST',body:JSON.stringify({decision,note})});await load()}catch(e){alert('Review failed: '+(e.data?.error||e.message))}}async function reviewClaim(id,decision){const note=document.getElementById('note-c-'+id).value.trim();if(decision!=='approved'&&!note)return alert('Add a reviewer note before requesting changes or rejecting.');if(!confirm(`Confirm ${decision.replaceAll('_',' ')}?`))return;try{await api('/api/v1/admin/retailer-claims/'+encodeURIComponent(id)+'/review',{method:'POST',body:JSON.stringify({decision,note})});await load()}catch(e){alert(e.data?.error==='retailer_already_claimed'?'That retailer is already owned by another company.':e.data?.error==='company_not_verified'?'Verify the company before approving its retailer claim.':'Claim review failed: '+(e.data?.error||e.message))}}function debounce(fn,ms){let t;return()=>{clearTimeout(t);t=setTimeout(fn,ms)}}$('#open').onclick=()=>{token=$('#token').value.trim();currentQ='';currentStatus='';load()};$('#lock').onclick=()=>lockAdmin();$('#token').onkeydown=e=>{if(e.key==='Enter')$('#open').click()};

['pointerdown','keydown','scroll','touchstart'].forEach(eventName=>{
  window.addEventListener(eventName,registerAdminActivity,{passive:true});
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')registerAdminActivity();
});
