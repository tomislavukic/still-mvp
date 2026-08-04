const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));let token='',data=null,currentQ='',currentStatus='',auditData=[],auditAction='',operationsData=null,selectedOrganizationId='',activeOrganizationTab='overview',sessionTimer=0;
const ADMIN_SESSION_MS=30*60*1000;async function api(path,opt={}){const r=await fetch(path,{...opt,headers:{'content-type':'application/json','authorization':'Bearer '+token,...(opt.headers||{})}}),j=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(j.error||'Request failed'),{data:j,status:r.status});return j}const labels={awaiting_submission:'Waiting for merchant',submitted:'Submitted',under_review:'Ready for review',needs_changes:'Changes requested',approved:'Verified',rejected:'Rejected'};const pill=s=>`<span class="pill ${esc(s||'')}">${esc(labels[s]||s||'Waiting for merchant')}</span>`;function stage(o){if(o.claim_status==='approved')return 4;if(o.organization_status==='verified')return 3;if(o.verification_status==='approved')return 3;if(['submitted','under_review','needs_changes','rejected'].includes(o.verification_status))return 2;return 1}function stageBar(o){const n=stage(o),items=[['1','Registered'],['2','Company verification'],['3','Retailer profile'],['4','Buyer routing']];return `<div class="progress">${items.map((x,i)=>`<div class="${i+1<n?'done':i+1===n?'current':''}"><b>${x[1]}</b><span>${i+1<n?'Complete':i+1===n?'Current step':'Next'}</span></div>`).join('')}</div>`}function nextAction(o){if(!o.verification_id)return ['Waiting for merchant','The company account exists, but no verification details have been submitted yet. No admin action is required.'];if(o.verification_status==='under_review'||o.verification_status==='submitted')return ['Review company identity','Check legal identity, VAT/registration details, website and company email before deciding.'];if(o.verification_status==='needs_changes')return ['Waiting for corrections','The merchant must update and resubmit the verification details.'];if(o.verification_status==='rejected')return ['Verification rejected','No routing will activate unless the merchant submits a new acceptable verification request.'];if(o.organization_status==='verified'&&!o.claim_id)return ['Company verified','Next, the merchant must claim the retailer profile buyers actually select.'];if(o.claim_status==='under_review')return ['Review retailer ownership','Confirm this verified company controls the selected retailer identity before approving.'];if(o.claim_status==='approved')return ['Routing ready','Company and retailer identity are approved. Buyer cases can be routed to this merchant.'];return ['Verification complete','Continue with retailer identity claiming.']}function stats(s){const cards=[['',s.organizations||0,'Companies'],['pending',s.verification_pending||0,'Ready for review'],['needs_changes',s.needs_changes||0,'Needs changes'],['claim_review',s.claim_pending||0,'Retailer claims'],['verified',s.verified||0,'Verified']];return `<div class="stats">${cards.map(c=>`<div class="stat" data-filter="${c[0]}"><b>${c[1]}</b><span>${c[2]}</span></div>`).join('')}</div>`}
function organizationStage(org){
  if(org.claim_status==='approved')return{
    key:'routing',
    label:'Buyer routing active',
    tone:'healthy',
    progress:100
  };

  if(
    org.organization_status==='verified'||
    org.verification_status==='approved'
  )return{
    key:'verified',
    label:'Company verified',
    tone:'healthy',
    progress:75
  };

  if(
    org.verification_status==='submitted'||
    org.verification_status==='under_review'
  )return{
    key:'review',
    label:'Verification review',
    tone:'warning',
    progress:50
  };

  if(
    org.verification_status==='needs_changes'||
    org.verification_status==='rejected'
  )return{
    key:'attention',
    label:org.verification_status==='rejected'
      ?'Verification rejected'
      :'Changes requested',
    tone:'failure',
    progress:35
  };

  return{
    key:'registered',
    label:'Waiting for verification',
    tone:'neutral',
    progress:20
  };
}

function organizationSignals(org){
  const signals=[];

  if(!org.owner_email){
    signals.push({
      tone:'warning',
      label:'Owner email missing'
    });
  }

  if(!org.verification_id){
    signals.push({
      tone:'neutral',
      label:'Verification not submitted'
    });
  }

  if(org.verification_status==='needs_changes'){
    signals.push({
      tone:'warning',
      label:'Merchant corrections required'
    });
  }

  if(org.verification_status==='rejected'){
    signals.push({
      tone:'failure',
      label:'Verification rejected'
    });
  }

  if(
    (
      org.organization_status==='verified'||
      org.verification_status==='approved'
    )&&!org.claim_id
  ){
    signals.push({
      tone:'neutral',
      label:'Retailer profile not claimed'
    });
  }

  if(org.claim_status==='under_review'){
    signals.push({
      tone:'warning',
      label:'Retailer claim awaiting review'
    });
  }

  if(org.claim_status==='approved'){
    signals.push({
      tone:'healthy',
      label:'Buyer routing ready'
    });
  }

  return signals;
}

function organizationSummary(){
  const organizations=data?.organizations||[];

  const registered=organizations.length;
  const verified=organizations.filter(org=>
    org.organization_status==='verified'||
    org.verification_status==='approved'
  ).length;
  const routing=organizations.filter(org=>
    org.claim_status==='approved'
  ).length;
  const attention=organizations.filter(org=>
    ['submitted','under_review','needs_changes','rejected']
      .includes(org.verification_status)||
    org.claim_status==='under_review'
  ).length;

  return `<div class="organization-summary">
    <div class="organization-summary-card">
      <b>${registered}</b>
      <span>Total organizations</span>
      <small>All company tenants registered on the platform</small>
    </div>

    <div class="organization-summary-card healthy">
      <b>${verified}</b>
      <span>Verified organizations</span>
      <small>Legal identity approved</small>
    </div>

    <div class="organization-summary-card healthy">
      <b>${routing}</b>
      <span>Routing active</span>
      <small>Connected to a verified retailer identity</small>
    </div>

    <div class="organization-summary-card ${
      attention>0?'warning':'healthy'
    }">
      <b>${attention}</b>
      <span>Need attention</span>
      <small>Verification or retailer review checkpoints</small>
    </div>
  </div>`;
}

function organizationCard(org){
  const stage=organizationStage(org);
  const signals=organizationSignals(org);
  const country=(org.country_code||'').toUpperCase()||'—';

  return `<article
    class="organization-card"
    data-organization-id="${esc(org.id)}"
  >
    <button
      class="organization-open"
      data-open-organization="${esc(org.id)}"
      aria-label="Open ${esc(org.name)}"
    >
      <div class="organization-card-head">
        <div class="organization-avatar">
          ${esc((org.name||'?').trim().slice(0,1).toUpperCase())}
        </div>

        <div class="organization-identity">
          <h3>${esc(org.name||'Unnamed organization')}</h3>
          <span>
            ${esc(org.owner_email||'No owner email')} ·
            ${esc(country)}
          </span>
        </div>

        <span class="organization-stage ${stage.tone}">
          ${esc(stage.label)}
        </span>
      </div>

      <div class="organization-progress">
        <div style="width:${stage.progress}%"></div>
      </div>

      <div class="organization-meta-grid">
        <div>
          <span>Organization ID</span>
          <strong>${esc(org.id||'—')}</strong>
        </div>

        <div>
          <span>Created</span>
          <strong>${
            org.created_at
              ?esc(new Date(org.created_at).toLocaleDateString())
              :'—'
          }</strong>
        </div>

        <div>
          <span>Verification</span>
          <strong>${esc(
            labels[org.verification_status]||
            org.verification_status||
            'Not submitted'
          )}</strong>
        </div>

        <div>
          <span>Retailer</span>
          <strong>${esc(
            org.retailer_name||
            org.claimed_retailer_key||
            'Not connected'
          )}</strong>
        </div>
      </div>

      <div class="organization-signals">
        ${
          signals.length
            ?signals.map(signal=>`
              <span class="${esc(signal.tone)}">
                ${esc(signal.label)}
              </span>
            `).join('')
            :'<span class="healthy">No current attention signals</span>'
        }
      </div>

      <div class="organization-open-label">
        Open organization →
      </div>
    </button>
  </article>`;
}

function organizationCenter(){
  const organizations=data?.organizations||[];

  return `<section class="organization-center">
    <div class="organization-center-head">
      <div>
        <div class="eyebrow">PLATFORM TENANTS</div>
        <h2>Organization Center</h2>
        <p>
          Inspect onboarding, identity, retailer ownership and buyer-routing
          readiness across every company tenant.
        </p>
      </div>

      <button id="export-organizations" class="secondary">
        Export JSON
      </button>
    </div>

    ${organizationSummary()}

    <div class="organization-toolbar">
      <input
        id="organization-search"
        value="${esc(currentQ)}"
        placeholder="Search name, owner, VAT, registration, retailer or ID…"
      >

      <select id="organization-status">
        <option value="">All organizations</option>
        <option value="awaiting_submission">Waiting for verification</option>
        <option value="pending">Verification review</option>
        <option value="needs_changes">Changes requested</option>
        <option value="rejected">Rejected</option>
        <option value="verified">Verified</option>
        <option value="claim_review">Retailer claim review</option>
      </select>
    </div>

    <div class="organization-list">
      ${
        organizations.length
          ?organizations.map(organizationCard).join('')
          :`<div class="empty">
            <strong>No organizations match this view</strong>
            Change the search or platform-status filter.
          </div>`
      }
    </div>
  </section>

  <div
    class="organization-drawer-backdrop"
    id="organization-drawer-backdrop"
    hidden
  ></div>

  <aside
    class="organization-drawer"
    id="organization-drawer"
    aria-hidden="true"
  ></aside>`;
}


function organizationReadiness(org){
  const checks=[
    {
      key:'owner',
      label:'Owner contact',
      complete:Boolean(org.owner_email)
    },
    {
      key:'legal_name',
      label:'Legal company name',
      complete:Boolean(org.legal_name)
    },
    {
      key:'registration',
      label:'Registration number',
      complete:Boolean(org.registration_number)
    },
    {
      key:'tax',
      label:'VAT or tax identifier',
      complete:Boolean(org.vat_id)
    },
    {
      key:'country',
      label:'Country',
      complete:Boolean(org.country_code)
    },
    {
      key:'website',
      label:'Company website',
      complete:Boolean(
        org.verification_website||
        org.website_url||
        org.website_domain
      )
    },
    {
      key:'verification',
      label:'Verification submitted',
      complete:Boolean(org.verification_id)
    },
    {
      key:'verification_approved',
      label:'Legal identity approved',
      complete:Boolean(
        org.organization_status==='verified'||
        org.verification_status==='approved'
      )
    },
    {
      key:'retailer',
      label:'Retailer identity selected',
      complete:Boolean(
        org.claim_id||
        org.claimed_retailer_key||
        org.retailer_name
      )
    },
    {
      key:'routing',
      label:'Buyer routing active',
      complete:org.claim_status==='approved'
    }
  ];

  const completed=checks.filter(check=>check.complete).length;
  const score=Math.round((completed/checks.length)*100);

  return {
    score,
    completed,
    total:checks.length,
    checks
  };
}

function organizationTimeline(org){
  const registered=Boolean(org.created_at);
  const submitted=Boolean(org.verification_id);
  const reviewed=[
    'under_review',
    'needs_changes',
    'approved',
    'rejected'
  ].includes(org.verification_status);
  const approved=
    org.organization_status==='verified'||
    org.verification_status==='approved';
  const retailerSelected=Boolean(
    org.claim_id||
    org.claimed_retailer_key||
    org.retailer_name
  );
  const routing=org.claim_status==='approved';

  return [
    {
      label:'Organization registered',
      detail:org.created_at
        ?new Date(org.created_at).toLocaleString()
        :'Registration date unavailable',
      complete:registered,
      current:registered&&!submitted
    },
    {
      label:'Verification submitted',
      detail:submitted
        ?labels[org.verification_status]||
          org.verification_status||
          'Submitted'
        :'Waiting for the company',
      complete:submitted,
      current:submitted&&!reviewed
    },
    {
      label:'Platform review',
      detail:reviewed
        ?labels[org.verification_status]||
          org.verification_status
        :'Not started',
      complete:reviewed,
      current:reviewed&&!approved
    },
    {
      label:'Legal identity approved',
      detail:approved?'Verified':'Not approved',
      complete:approved,
      current:approved&&!retailerSelected
    },
    {
      label:'Retailer identity connected',
      detail:
        org.retailer_name||
        org.claimed_retailer_key||
        'Not connected',
      complete:retailerSelected,
      current:retailerSelected&&!routing
    },
    {
      label:'Buyer routing active',
      detail:routing
        ?'Buyer cases can be routed'
        :'Routing is not active',
      complete:routing,
      current:routing
    }
  ];
}

function organizationWorkspaceNavigation(){
  const tabs=[
    ['overview','Overview'],
    ['identity','Identity'],
    ['verification','Verification'],
    ['retailer','Retailer'],
    ['platform','Platform']
  ];

  return `<nav
    class="organization-workspace-tabs"
    aria-label="Organization workspace"
  >
    ${tabs.map(tab=>`
      <button
        class="${
          activeOrganizationTab===tab[0]?'active':''
        }"
        data-organization-tab="${tab[0]}"
      >
        ${tab[1]}
      </button>
    `).join('')}
  </nav>`;
}

function organizationOverviewTab(org){
  const readiness=organizationReadiness(org);
  const signals=organizationSignals(org);
  const next=nextAction(org);

  const scoreTone=
    readiness.score>=80
      ?'healthy'
      :readiness.score>=50
        ?'warning'
        :'neutral';

  return `<div class="organization-tab-panel">
    <div class="organization-overview-hero">
      <div class="organization-readiness ${scoreTone}">
        <div
          class="organization-readiness-ring"
          style="--readiness:${readiness.score}"
        >
          <strong>${readiness.score}%</strong>
        </div>

        <div>
          <div class="eyebrow">ONBOARDING READINESS</div>
          <h3>
            ${readiness.completed} of ${readiness.total}
            platform checkpoints complete
          </h3>
          <p>
            This score reflects recorded onboarding fields and approvals.
            It is not a fraud, financial or business-quality score.
          </p>
        </div>
      </div>
    </div>

    <div class="organization-workspace-grid">
      <section class="organization-workspace-card">
        <div class="eyebrow">NEXT PLATFORM ACTION</div>
        <h3>${esc(next[0])}</h3>
        <p>${esc(next[1])}</p>
      </section>

      <section class="organization-workspace-card">
        <div class="eyebrow">CURRENT STAGE</div>
        <h3>${esc(organizationStage(org).label)}</h3>
        <p>
          Verification:
          <strong>
            ${esc(
              labels[org.verification_status]||
              org.verification_status||
              'Not submitted'
            )}
          </strong>
        </p>
      </section>
    </div>

    <section class="organization-workspace-section">
      <div class="organization-section-heading">
        <div>
          <div class="eyebrow">CHECKPOINTS</div>
          <h3>Onboarding completeness</h3>
        </div>

        <span class="organization-section-count">
          ${readiness.completed}/${readiness.total}
        </span>
      </div>

      <div class="organization-checklist">
        ${readiness.checks.map(check=>`
          <div class="${
            check.complete?'complete':'incomplete'
          }">
            <span class="organization-check-icon">
              ${check.complete?'✓':'○'}
            </span>
            <strong>${esc(check.label)}</strong>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="organization-workspace-section">
      <div class="eyebrow">ATTENTION SIGNALS</div>
      <h3>Items visible to Platform Administration</h3>

      <div class="organization-drawer-signals">
        ${
          signals.length
            ?signals.map(signal=>`
              <div class="${esc(signal.tone)}">
                ${esc(signal.label)}
              </div>
            `).join('')
            :'<div class="healthy">No current attention signals</div>'
        }
      </div>
    </section>
  </div>`;
}

function organizationIdentityTab(org){
  const fields=[
    ['Workspace name',org.name||'—'],
    ['Legal name',org.legal_name||'Not submitted'],
    ['Registration number',org.registration_number||'Not submitted'],
    ['VAT / tax ID',org.vat_id||'Not submitted'],
    ['Country',(org.country_code||'').toUpperCase()||'Not submitted'],
    ['Owner email',org.owner_email||'Not available'],
    [
      'Support email',
      org.verification_email||
      org.support_email||
      'Not submitted'
    ],
    [
      'Website',
      org.verification_website||
      org.website_url||
      'Not submitted'
    ],
    ['Website domain',org.website_domain||'Not recorded'],
    ['Email domain',org.email_domain||'Not recorded']
  ];

  return `<div class="organization-tab-panel">
    <section class="organization-workspace-section first">
      <div class="eyebrow">LEGAL IDENTITY</div>
      <h3>Recorded company information</h3>
      <p>
        These values come from the organization registration and verification
        workflow. Empty values are shown honestly as not submitted.
      </p>

      <div class="organization-detail-grid large">
        ${fields.map(field=>`
          <div>
            <span>${esc(field[0])}</span>
            <strong>${esc(field[1])}</strong>
          </div>
        `).join('')}
      </div>
    </section>
  </div>`;
}

function organizationVerificationTab(org){
  const timeline=organizationTimeline(org);

  return `<div class="organization-tab-panel">
    <section class="organization-workspace-section first">
      <div class="eyebrow">VERIFICATION JOURNEY</div>
      <h3>Company onboarding timeline</h3>
      <p>
        This timeline uses the workflow states currently recorded by the
        platform. It does not manufacture events that are not in the database.
      </p>

      <div class="organization-timeline">
        ${timeline.map((item,index)=>`
          <div class="
            organization-timeline-item
            ${item.complete?'complete':''}
            ${item.current?'current':''}
          ">
            <div class="organization-timeline-marker">
              ${item.complete?'✓':index+1}
            </div>

            <div>
              <strong>${esc(item.label)}</strong>
              <span>${esc(item.detail)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="organization-workspace-section">
      <div class="eyebrow">REVIEW STATUS</div>
      <h3>
        ${esc(
          labels[org.verification_status]||
          org.verification_status||
          'Verification not submitted'
        )}
      </h3>

      <p>
        ${
          org.verification_review_note
            ?esc(org.verification_review_note)
            :'No platform review note is currently recorded.'
        }
      </p>
    </section>
  </div>`;
}

function organizationRetailerTab(org){
  const connected=Boolean(
    org.claim_id||
    org.claimed_retailer_key||
    org.retailer_name
  );

  return `<div class="organization-tab-panel">
    <section class="organization-workspace-section first">
      <div class="eyebrow">RETAILER IDENTITY</div>
      <h3>
        ${connected
          ?esc(
            org.retailer_name||
            org.claimed_retailer_key||
            'Retailer selected'
          )
          :'No retailer identity connected'}
      </h3>

      <p>
        ${
          connected
            ?'This is the retailer identity the organization has selected or claimed.'
            :'The verified organization must select and claim the retailer identity buyers use.'
        }
      </p>

      <div class="organization-detail-grid">
        <div>
          <span>Claim status</span>
          <strong>${esc(org.claim_status||'Not submitted')}</strong>
        </div>

        <div>
          <span>Claim ID</span>
          <strong>${esc(org.claim_id||'—')}</strong>
        </div>

        <div>
          <span>Retailer key</span>
          <strong>${esc(org.claimed_retailer_key||'—')}</strong>
        </div>

        <div>
          <span>Buyer routing</span>
          <strong>
            ${org.claim_status==='approved'?'Active':'Not active'}
          </strong>
        </div>
      </div>
    </section>
  </div>`;
}

function organizationPlatformTab(org){
  return `<div class="organization-tab-panel">
    <section class="organization-workspace-section first">
      <div class="organization-section-heading">
        <div>
          <div class="eyebrow">PLATFORM IDENTITY</div>
          <h3>Tenant identifiers</h3>
        </div>

        <button
          class="secondary compact"
          id="copy-organization-id"
          data-value="${esc(org.id||'')}"
        >
          Copy organization ID
        </button>
      </div>

      <div class="organization-detail-grid">
        <div>
          <span>Organization ID</span>
          <strong>${esc(org.id||'—')}</strong>
        </div>

        <div>
          <span>Platform status</span>
          <strong>${esc(org.organization_status||'registered')}</strong>
        </div>

        <div>
          <span>Verification ID</span>
          <strong>${esc(org.verification_id||'—')}</strong>
        </div>

        <div>
          <span>Created</span>
          <strong>
            ${
              org.created_at
                ?esc(new Date(org.created_at).toLocaleString())
                :'—'
            }
          </strong>
        </div>
      </div>
    </section>

    <section class="organization-workspace-section">
      <div class="eyebrow">PLATFORM TOOLS</div>
      <h3>Support and inspection</h3>

      <div class="organization-platform-actions">
        <a
          class="button-link"
          href="/company.html"
          target="_blank"
          rel="noopener"
        >
          Open company workspace
        </a>

        <button
          class="secondary"
          id="export-single-organization"
        >
          Export organization JSON
        </button>
      </div>

      <div class="organization-safety-note">
        <strong>Read-only administration</strong>
        <span>
          Suspension, archival, deletion, ownership transfer and member
          management remain unavailable until their backend permissions,
          confirmations and audit events are implemented.
        </span>
      </div>
    </section>
  </div>`;
}

function organizationActiveTab(org){
  switch(activeOrganizationTab){
    case'identity':
      return organizationIdentityTab(org);
    case'verification':
      return organizationVerificationTab(org);
    case'retailer':
      return organizationRetailerTab(org);
    case'platform':
      return organizationPlatformTab(org);
    default:
      return organizationOverviewTab(org);
  }
}

function organizationDrawer(org){
  if(!org)return'';

  const stage=organizationStage(org);

  return `<div class="organization-drawer-shell workspace">
    <div class="organization-drawer-header">
      <div class="organization-workspace-title">
        <div class="organization-avatar large">
          ${esc((org.name||'?').trim().slice(0,1).toUpperCase())}
        </div>

        <div>
          <div class="eyebrow">ORGANIZATION WORKSPACE</div>
          <h2>${esc(org.name||'Unnamed organization')}</h2>
          <p>${esc(org.owner_email||'No owner email')}</p>
        </div>
      </div>

      <button
        class="secondary organization-drawer-close"
        id="close-organization"
        aria-label="Close organization"
      >
        Close
      </button>
    </div>

    <div class="organization-workspace-status">
      <span class="organization-stage ${stage.tone}">
        ${esc(stage.label)}
      </span>

      <span>
        ${esc((org.country_code||'').toUpperCase()||'Country unknown')}
      </span>

      <span>
        Registered ${
          org.created_at
            ?esc(new Date(org.created_at).toLocaleDateString())
            :'—'
        }
      </span>
    </div>

    ${organizationWorkspaceNavigation()}

    <div id="organization-workspace-content">
      ${organizationActiveTab(org)}
    </div>
  </div>`;
}


function bindOrganizationWorkspace(org){
  document.querySelectorAll('[data-organization-tab]').forEach(button=>{
    button.onclick=()=>{
      activeOrganizationTab=button.dataset.organizationTab||'overview';

      document.querySelectorAll('[data-organization-tab]')
        .forEach(tab=>{
          tab.classList.toggle(
            'active',
            tab.dataset.organizationTab===activeOrganizationTab
          );
        });

      const content=$('#organization-workspace-content');

      if(content){
        content.innerHTML=organizationActiveTab(org);
        bindOrganizationTabActions(org);
      }
    };
  });

  bindOrganizationTabActions(org);
}

function bindOrganizationTabActions(org){
  const copyButton=$('#copy-organization-id');

  if(copyButton){
    copyButton.onclick=async event=>{
      const value=event.currentTarget.dataset.value||'';

      try{
        await navigator.clipboard.writeText(value);
        event.currentTarget.textContent='Copied';

        setTimeout(()=>{
          if(event.currentTarget){
            event.currentTarget.textContent='Copy organization ID';
          }
        },1200);
      }catch{
        alert('Could not copy the organization ID.');
      }
    };
  }

  const exportButton=$('#export-single-organization');

  if(exportButton){
    exportButton.onclick=()=>{
      downloadOrganizationJSON(
        [org],
        org.name||'organization'
      );
    };
  }
}

function openOrganizationDrawer(id){
  const organization=(data?.organizations||[])
    .find(item=>item.id===id);

  if(!organization)return;

  selectedOrganizationId=id;
  activeOrganizationTab='overview';

  const drawer=$('#organization-drawer');
  const backdrop=$('#organization-drawer-backdrop');

  drawer.innerHTML=organizationDrawer(organization);
  drawer.setAttribute('aria-hidden','false');
  drawer.classList.add('open');
  backdrop.hidden=false;
  document.body.classList.add('drawer-open');

  $('#close-organization').onclick=closeOrganizationDrawer;
  backdrop.onclick=closeOrganizationDrawer;

  bindOrganizationWorkspace(organization);
}

function closeOrganizationDrawer(){
  selectedOrganizationId='';
  activeOrganizationTab='overview';

  const drawer=$('#organization-drawer');
  const backdrop=$('#organization-drawer-backdrop');

  if(drawer){
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
  }

  if(backdrop)backdrop.hidden=true;

  document.body.classList.remove('drawer-open');
}

function downloadOrganizationJSON(organizations,name='organizations'){
  const safeName=String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-|-$/g,'')||'organizations';

  const blob=new Blob(
    [JSON.stringify({
      exportedAt:new Date().toISOString(),
      count:organizations.length,
      organizations
    },null,2)],
    {type:'application/json'}
  );

  const url=URL.createObjectURL(blob);
  const anchor=document.createElement('a');

  anchor.href=url;
  anchor.download=`still-${safeName}.json`;
  anchor.click();

  URL.revokeObjectURL(url);
}

function company(o){const vs=o.verification_status||'awaiting_submission',next=nextAction(o);return `<details class="company" data-org="${esc(o.id)}"><summary><div><h3>${esc(o.name)}</h3><div class="small">${esc(o.owner_email||'No owner email')} · ${esc((o.country_code||'').toUpperCase())} · Registered ${new Date(o.created_at).toLocaleDateString()}</div></div><div>${pill(vs)}</div><div>${o.claim_id?pill(o.claim_status):'<span class="small">Retailer profile not claimed</span>'}</div><b>Open →</b></summary><div class="body"><div><section class="panel">${stageBar(o)}<div class="notice"><strong>${esc(next[0])}</strong><span class="small">${esc(next[1])}</span></div><h3>Company verification</h3><div class="grid"><div class="field"><span>Legal name</span>${esc(o.legal_name||'Not submitted')}</div><div class="field"><span>Registration number</span>${esc(o.registration_number||'—')}</div><div class="field"><span>VAT / tax ID</span>${esc(o.vat_id||'—')}</div><div class="field"><span>Website</span>${esc(o.verification_website||o.website_url||'—')}</div><div class="field"><span>Support email</span>${esc(o.verification_email||o.support_email||'—')}</div><div class="field"><span>Domain evidence</span>${esc(o.website_domain||'—')} / ${esc(o.email_domain||'—')}</div></div>${o.verification_review_note?`<p><b>Previous reviewer note:</b> ${esc(o.verification_review_note)}</p>`:''}${o.verification_id&&['submitted','under_review'].includes(o.verification_status)?`<div class="review"><textarea id="note-v-${esc(o.verification_id)}" placeholder="Reviewer note. Required when requesting changes or rejecting."></textarea><div class="actions"><button class="approve" onclick="reviewVerification('${esc(o.verification_id)}','approved')">Approve company</button><button class="changes" onclick="reviewVerification('${esc(o.verification_id)}','needs_changes')">Request changes</button><button class="reject" onclick="reviewVerification('${esc(o.verification_id)}','rejected')">Reject</button></div></div>`:''}${!o.verification_id?'<p class="small">No verification submission yet. This is expected until the merchant completes the Verification Center in their workspace.</p>':''}</section>${o.claim_id?`<section class="panel" style="margin-top:14px"><h3>Retailer profile claim</h3><div class="grid"><div class="field"><span>Retailer</span>${esc(o.retailer_name)}</div><div class="field"><span>Retailer key</span>${esc(o.claimed_retailer_key)}</div><div class="field"><span>Official URL</span>${esc(o.claim_official_url||'—')}</div><div class="field"><span>Status</span>${pill(o.claim_status)}</div></div>${o.claim_status==='under_review'?`<div class="review"><textarea id="note-c-${esc(o.claim_id)}" placeholder="Reviewer note"></textarea><div class="actions"><button class="approve" onclick="reviewClaim('${esc(o.claim_id)}','approved')">Approve retailer claim</button><button class="changes" onclick="reviewClaim('${esc(o.claim_id)}','needs_changes')">Request changes</button><button class="reject" onclick="reviewClaim('${esc(o.claim_id)}','rejected')">Reject</button></div></div>`:''}</section>`:''}</div><aside class="panel"><h3>Audit history</h3><p class="small">Every admin decision is recorded here.</p><div class="timeline" id="events-${esc(o.id)}"><span class="small">Loading history when opened…</span></div></aside></div></details>`}function attention(){const waiting=data.organizations.filter(o=>!o.verification_id).length,review=data.stats.verification_pending||0,claims=data.stats.claim_pending||0;let title='Nothing needs admin attention right now',body='Registered companies remain visible while merchants complete their own verification forms.';if(review){title=`${review} company ${review===1?'is':'are'} ready for verification review`;body='Review legal identity and domain evidence before approving access to retailer claiming.'}else if(claims){title=`${claims} retailer ${claims===1?'claim is':'claims are'} waiting`;body='Verify retailer ownership before buyer routing is connected.'}return `<div class="attention"><div class="next-card"><div class="eyebrow">NEXT ADMIN ACTION</div><h3>${title}</h3><p>${body}</p></div><div class="next-card"><div class="eyebrow">WAITING ON MERCHANTS</div><h3>${waiting}</h3><p>${waiting===1?'1 registered company still needs to submit verification.':`${waiting} registered companies still need to submit verification.`}</p></div></div>`}function workflow(){return `<div class="workflow"><div class="workflow-head"><div><div class="eyebrow">MERCHANT LIFECYCLE</div><h3>From signup to live buyer routing</h3></div><span class="small">Admin only intervenes at review checkpoints.</span></div><div class="flow"><div class="flow-step active"><b>1 · Registration</b><span>Merchant creates company workspace</span></div><div class="flow-step"><b>2 · Verification</b><span>Admin validates legal identity</span></div><div class="flow-step"><b>3 · Retailer claim</b><span>Admin confirms retailer ownership</span></div><div class="flow-step"><b>4 · Routing</b><span>Buyer cases reach the merchant</span></div></div></div>`}

function operationsDashboard(){
  return `<section class="operations-dashboard panel">
    <div class="operations-head">
      <div>
        <div class="eyebrow">LIVE OPERATIONS</div>
        <h2>Platform health</h2>
        <p>Verified runtime and database measurements from the production Worker.</p>
      </div>
      <button id="refresh-health" class="secondary">Refresh health</button>
    </div>

    <div id="operations-results">
      <div class="operations-loading">
        <span class="health-dot"></span>
        Reading production health…
      </div>
    </div>
  </section>`;
}


function incidentCenter(health){
  const incidents=health.incidents||[];

  if(!incidents.length){
    return `<div class="incident-center operational">
      <div class="incident-icon">✓</div>
      <div>
        <div class="eyebrow">INCIDENT CENTER</div>
        <h3>All monitored systems are operational</h3>
        <p>No database, server-error, latency or authentication incident
        thresholds are currently active.</p>
      </div>
    </div>`;
  }

  const critical=incidents.some(item=>item.severity==='critical');

  return `<div class="incident-center ${critical?'critical':'warning'}">
    <div class="incident-icon">${critical?'!':'△'}</div>
    <div class="incident-content">
      <div class="eyebrow">INCIDENT CENTER</div>
      <h3>${critical?'Action required':'Attention recommended'}</h3>

      <div class="incident-list">
        ${incidents.map(item=>`
          <div class="incident-item ${esc(item.severity)}">
            <strong>${esc(item.title)}</strong>
            <span>${esc(item.detail)}</span>
            <code>${esc(item.code)}</code>
          </div>
        `).join('')}
      </div>
    </div>
  </div>`;
}


function operationCategory(item){
  const action=item.action||'';

  if(
    action.startsWith('merchant.')||
    action.startsWith('verification.')||
    action.startsWith('claim.')||
    action.startsWith('routing.')
  )return'business';

  return'platform';
}

function recentOperationsSection(items){
  const platform=items.filter(item=>
    operationCategory(item)==='platform'
  );

  const business=items.filter(item=>
    operationCategory(item)==='business'
  );

  const renderGroup=(title,description,group)=>`
    <div class="activity-group">
      <div class="activity-group-head">
        <div>
          <h4>${esc(title)}</h4>
          <p>${esc(description)}</p>
        </div>
        <span>${group.length}</span>
      </div>

      ${
        group.length
          ?group.map(item=>`
            <div class="health-event">
              <div>
                <strong>${esc(item.action||'Unknown action')}</strong>
                <span>
                  ${esc(item.actor_role||'anonymous')} ·
                  ${esc(String(item.status||'—'))} ·
                  ${esc(item.method||'')}
                  ${esc(item.path||'')}
                </span>
              </div>
              <time>
                ${esc(new Date(item.created_at).toLocaleTimeString())}
              </time>
            </div>
          `).join('')
          :'<p class="small">No recent activity in this category.</p>'
      }
    </div>
  `;

  return `
    <div class="health-events">
      <h3>Recent protected activity</h3>

      <div class="activity-groups">
        ${renderGroup(
          'Platform operations',
          'Health, audit, sessions and protected administration.',
          platform
        )}

        ${renderGroup(
          'Business operations',
          'Organization, verification, claim and routing actions.',
          business
        )}
      </div>
    </div>
  `;
}

function operationsCards(health){
  const metrics=health.metrics||{};
  const worker=health.worker||{};
  const database=health.database||{};

  const cards=[
    [
      health.status==='healthy'?'Healthy':'Check required',
      'Worker status',
      `Build ${worker.build||'—'} · ${esc(worker.colo||'Unknown colo')}`,
      health.status==='healthy'?'healthy':'warning'
    ],
    [
      database.status==='healthy'?'Connected':'Unavailable',
      'D1 database',
      `${database.responseMs??'—'} ms health query`,
      database.status==='healthy'?'healthy':'failure'
    ],
    [
      metrics.requests24h??0,
      'Admin requests',
      'Recorded during last 24 hours',
      'neutral'
    ],
    [
      `${metrics.averageLatencyMs??0} ms`,
      'Average latency',
      'Protected admin routes',
      Number(metrics.averageLatencyMs||0)>500?'warning':'healthy'
    ],
    [
      metrics.errors24h??0,
      'Server errors',
      'HTTP 500+ during last 24 hours',
      Number(metrics.errors24h||0)>0?'failure':'healthy'
    ],
    [
      metrics.denied24h??0,
      'Security denials',
      'Excludes anonymous notification polling',
      Number(metrics.denied24h||0)>10?'warning':'neutral'
    ]
  ];

  const recent=health.recentActivity||[];

  return `
    ${incidentCenter(health)}

    <div class="health-cards">
      ${cards.map(card=>`
        <div class="health-card ${card[3]}">
          <b>${esc(String(card[0]))}</b>
          <span>${esc(card[1])}</span>
          <small>${esc(card[2])}</small>
        </div>
      `).join('')}
    </div>

    <div class="health-footer">
      <div>
        <strong>Notification polling excluded</strong>
        <span>${esc(String(
          metrics.notificationPollDenied24h??0
        ))} expected anonymous responses</span>
      </div>
      <div>
        <strong>Maximum latency</strong>
        <span>${esc(String(metrics.maximumLatencyMs??0))} ms</span>
      </div>
      <div>
        <strong>Latest activity</strong>
        <span>${metrics.latestActivityAt
          ?esc(new Date(metrics.latestActivityAt).toLocaleString())
          :'No activity recorded yet'}</span>
      </div>
      <div>
        <strong>Checked</strong>
        <span>${esc(new Date(health.checkedAt).toLocaleString())}</span>
      </div>
    </div>

    ${recentOperationsSection(recent)}
  `;
}

async function loadOperationsHealth(){
  const target=$('#operations-results');
  if(!target)return;

  target.innerHTML=`
    <div class="operations-loading">
      <span class="health-dot"></span>
      Reading production health…
    </div>
  `;

  try{
    operationsData=await api('/api/v1/admin/health');
    target.innerHTML=operationsCards(operationsData);
  }catch(error){
    target.innerHTML=`
      <div class="empty">
        <strong>Health check failed</strong>
        ${esc(error.data?.error||error.message)}
      </div>
    `;
  }
}

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
  operationsData=null;
  selectedOrganizationId='';
  document.body.classList.remove('drawer-open');

  $('#token').value='';
  $('#auth').classList.remove('logged');
  $('#app').innerHTML=`<div class="empty">
    <strong>${esc(title)}</strong>
    ${esc(message)}
  </div>`;
}
function render(){const a=$('#app');a.innerHTML=`<div class="overview">${stats(data.stats)}${workflow()}${attention()}${operationsDashboard()}${auditConsole()}${organizationCenter()}</div>`;$('#organization-status').value=currentStatus;
$('#organization-search').oninput=debounce(()=>{
  currentQ=$('#organization-search').value;
  load();
},250);
$('#organization-status').onchange=()=>{
  currentStatus=$('#organization-status').value;
  load();
};
$('#export-organizations').onclick=()=>{
  downloadOrganizationJSON(data.organizations||[]);
};
document.querySelectorAll('[data-open-organization]').forEach(button=>{
  button.onclick=()=>{
    openOrganizationDrawer(button.dataset.openOrganization);
  };
});
document.querySelectorAll('.stat').forEach(card=>{
  card.onclick=()=>{
    currentStatus=card.dataset.filter;
    load();
  };
});
$('#refresh-health').onclick=loadOperationsHealth;
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
document.querySelectorAll('details.company').forEach(d=>d.ontoggle=()=>{if(d.open)events(d.dataset.org)})}async function load(){try{data=await api('/api/v1/admin/overview?q='+encodeURIComponent(currentQ)+'&status='+encodeURIComponent(currentStatus));$('#auth').classList.add('logged');armAdminSession();render();loadOperationsHealth();loadAudit()}catch(e){$('#auth').classList.remove('logged');$('#app').innerHTML=`<div class="empty"><strong>${e.status===401?'Admin access denied':'Could not load merchant operations'}</strong>${e.status===401?'The token does not match the runtime verification secret.':e.data?.error==='admin_not_configured'?'VERIFICATION_ADMIN_TOKEN is not configured at runtime.':esc(e.message)}</div>`}}async function events(org){try{const r=await api('/api/v1/admin/organizations/'+encodeURIComponent(org)+'/events'),h=document.getElementById('events-'+org);h.innerHTML=r.events.length?r.events.map(e=>`<div class="event"><b>${esc(e.event_type.replaceAll('_',' '))}</b><div class="small">${esc(e.from_status||'—')} → ${esc(e.to_status||'—')} · ${new Date(e.created_at).toLocaleString()}</div>${e.review_note?`<p>${esc(e.review_note)}</p>`:''}</div>`).join(''):'<div class="empty" style="padding:22px 8px"><strong>No admin decisions yet</strong>The audit trail begins when verification or retailer ownership is reviewed.</div>'}catch{}}async function reviewVerification(id,decision){const note=document.getElementById('note-v-'+id).value.trim();if(decision!=='approved'&&!note)return alert('Add a reviewer note before requesting changes or rejecting.');if(!confirm(`Confirm ${decision.replaceAll('_',' ')}?`))return;try{await api('/api/v1/admin/verifications/'+encodeURIComponent(id)+'/review',{method:'POST',body:JSON.stringify({decision,note})});await load()}catch(e){alert('Review failed: '+(e.data?.error||e.message))}}async function reviewClaim(id,decision){const note=document.getElementById('note-c-'+id).value.trim();if(decision!=='approved'&&!note)return alert('Add a reviewer note before requesting changes or rejecting.');if(!confirm(`Confirm ${decision.replaceAll('_',' ')}?`))return;try{await api('/api/v1/admin/retailer-claims/'+encodeURIComponent(id)+'/review',{method:'POST',body:JSON.stringify({decision,note})});await load()}catch(e){alert(e.data?.error==='retailer_already_claimed'?'That retailer is already owned by another company.':e.data?.error==='company_not_verified'?'Verify the company before approving its retailer claim.':'Claim review failed: '+(e.data?.error||e.message))}}function debounce(fn,ms){let t;return()=>{clearTimeout(t);t=setTimeout(fn,ms)}}$('#open').onclick=()=>{token=$('#token').value.trim();currentQ='';currentStatus='';load()};$('#lock').onclick=()=>lockAdmin();$('#token').onkeydown=e=>{if(e.key==='Enter')$('#open').click()};

['pointerdown','keydown','scroll','touchstart'].forEach(eventName=>{
  window.addEventListener(eventName,registerAdminActivity,{passive:true});
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible')registerAdminActivity();
});

window.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&selectedOrganizationId){
    closeOrganizationDrawer();
  }
});
