(()=>{
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api=async(u,o={})=>{const r=await fetch(u,{credentials:'same-origin',headers:{'content-type':'application/json',...(o.headers||{})},...o});const d=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(Error(d.message||d.error||'Request failed'),{status:r.status,data:d});return d};
  let root,active='today',mode=localStorage.getItem('still-workbench-mode')||'manager',selected=new Set(),state={today:null,daily:null,tasks:[],approvals:[],customers:[],products:[],branches:[]};
  const hr=()=>document.documentElement.lang!=='en',t=(a,b)=>hr()?a:b,num=v=>Number(v||0),days=v=>v?Math.ceil((new Date(v)-new Date())/864e5):999;
  const fmt=v=>{if(!v)return'—';try{return new Intl.DateTimeFormat(hr()?'hr-HR':'en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}catch{return v}};
  const greeting=()=>{const h=new Date().getHours();return h<12?t('Dobro jutro','Good morning'):h<18?t('Dobar dan','Good afternoon'):t('Dobra večer','Good evening')};

  function shell(){
    if($('#businessWorkbenchV72'))return;
    root=document.createElement('section');root.id='businessWorkbenchV72';root.className='bw72';
    root.innerHTML=`<header class="bw72-head"><div><span class="bw72-kicker">${t('DNEVNI RAD','DAILY OPERATIONS')}</span><h2>${t('Što danas traži pažnju?','What needs attention today?')}</h2><p>${t('Jedan red prioriteta za slučajeve, zadatke, odobrenja i kupce.','One priority queue for cases, tasks, approvals and customers.')}</p></div><div class="bw72-head-actions"><small data-updated></small><button data-refresh>${t('Osvježi','Refresh')}</button></div></header><div class="bw72-mode" role="group" aria-label="${t('Način prikaza','View mode')}"><button data-mode="manager">${t('Voditelj','Manager')}</button><button data-mode="focus">${t('Moj fokus','My focus')}</button></div><section class="bw72-brief" data-brief aria-live="polite"><div class="bw72-loading">${t('Priprema dnevnog pregleda…','Preparing the daily brief…')}</div></section><nav class="bw72-tabs" aria-label="Business workspace"><button class="active" data-tab="today">${t('Danas','Today')}</button><button data-tab="tasks">${t('Zadaci','Tasks')} <em data-count="tasks">0</em></button><button data-tab="approvals">${t('Odobrenja','Approvals')} <em data-count="approvals">0</em></button><button data-tab="customers">${t('Kupci','Customers')}</button><button data-tab="products">${t('Proizvodi','Products')}</button><button data-tab="branches">${t('Poslovnice','Branches')}</button></nav><div data-view class="bw72-view"></div>`;
    const parking=$('#cos120ToolParking');
    if(parking)parking.append(root);
    else{
      const anchor=$('#for-retailers')||document.querySelector('main');
      if(!anchor?.parentNode)return;
      anchor.parentNode.insertBefore(root,anchor);
    }
    root.addEventListener('click',click);load();
  }

  async function load(){
    const refresh=$('[data-refresh]',root);if(refresh){refresh.disabled=true;refresh.textContent=t('Učitavanje…','Loading…')}
    try{
      const [todayData,daily,tasks,approvals,customers,products,branches]=await Promise.all([api('/api/v1/business/today'),api('/api/v1/business/daily-summary'),api('/api/v1/business/tasks'),api('/api/v1/business/approvals'),api('/api/v1/business/customers'),api('/api/v1/business/products'),api('/api/v1/business/branch-insights')]);
      state={today:todayData,daily,tasks:tasks.tasks||[],approvals:approvals.approvals||[],customers:customers.customers||[],products:products.products||[],branches:branches.branches||[]};selected.clear();renderBrief();render(active);const updated=$('[data-updated]',root);if(updated)updated.textContent=t('Ažurirano upravo sada','Updated just now');
    }catch(e){
      if(e.status===401||e.status===403){root.remove();return}
      $('[data-brief]',root).innerHTML=`<div class="bw72-error"><b>${t('Dnevni pregled nije dostupan.','Daily brief is unavailable.')}</b><span>${esc(e.message)}</span><button data-refresh>${t('Pokušaj ponovno','Try again')}</button></div>`;
    }finally{if(refresh){refresh.disabled=false;refresh.textContent=t('Osvježi','Refresh')}}
  }

  function priorityItems(){
    const cases=state.today?.cases||[],items=[];
    cases.forEach(c=>{if(['submitted','in_review'].includes(c.status))items.push({kind:'case',score:(c.priority==='urgent'?100:c.priority==='high'?80:55)+(num(c.readiness?.percent)<60?8:0),title:c.product_name||c.case_type,meta:`${c.public_id} · ${c.readiness?.percent||0}% ${t('spremno','ready')}`,tag:c.priority||'normal',id:c.public_id,time:c.created_at})});
    state.tasks.filter(x=>!['done','cancelled'].includes(x.status)).forEach(x=>items.push({kind:'task',score:days(x.due_at)<0?95:days(x.due_at)<=1?75:45,title:x.title,meta:`${x.assigned_email||t('Nedodijeljeno','Unassigned')} · ${fmt(x.due_at)}`,tag:days(x.due_at)<0?t('Kasni','Overdue'):x.status,id:x.id,time:x.due_at}));
    state.approvals.filter(x=>x.status==='pending').forEach(x=>items.push({kind:'approval',score:85,title:`${x.action_type}${x.amount!=null?' · '+x.amount+' '+x.currency:''}`,meta:`${x.requested_by||''} · ${fmt(x.created_at)}`,tag:t('Čeka odluku','Needs decision'),id:x.id,time:x.created_at}));
    const sorted=items.sort((a,b)=>b.score-a.score);return mode==='focus'?sorted.filter(x=>x.kind!=='approval').slice(0,8):sorted;
  }

  function renderBrief(){
    const s=state.today?.summary||{},d=state.daily||{},items=priorityItems(),top=items[0];
    const signals=[['today',t('Treba odgovor','Needs response'),num(s.needResponse),num(s.needResponse)>0?'hot':'calm'],['approvals',t('Čeka odobrenje','Pending approval'),num(d.pendingApprovals),'warm'],['tasks',t('Otvoreni zadaci','Open tasks'),num(d.openTasks),'neutral'],['today',t('Bez vlasnika','Unassigned'),num(s.unassigned),num(s.unassigned)>0?'warm':'calm'],['today',t('Stari slučajevi','Aging cases'),num(s.aging),num(s.aging)>0?'hot':'calm']];
    $$('.bw72-mode button',root).forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    $('[data-brief]',root).innerHTML=`<div class="bw72-morning"><div><span>${greeting().toUpperCase()}</span><h3>${items.length?t('Danas imaš '+items.length+' aktivnih prioriteta.','You have '+items.length+' active priorities today.'):t('Današnji red rada je čist.','Today’s work queue is clear.')}</h3><p>${items.length?t('Najhitniji posao je izdvojen ispod, a ostatak je složen po stvarnoj važnosti.','The most urgent work is highlighted below and the rest is ranked by real importance.'):t('Nema skrivenog hitnog posla u slučajevima, zadacima ni odobrenjima.','There is no hidden urgent work in cases, tasks or approvals.')}</p></div><time>${new Intl.DateTimeFormat(hr()?'hr-HR':'en-GB',{weekday:'long',day:'numeric',month:'long'}).format(new Date())}</time></div><div class="bw72-hero ${top?'has-work':'all-clear'}"><div><span>${top?t('SLJEDEĆA NAJBOLJA RADNJA','NEXT BEST ACTION'):t('SVE JE MIRNO','ALL CLEAR')}</span><h3>${top?esc(top.title):t('Nema hitnog posla u ovom trenutku.','Nothing urgent needs attention right now.')}</h3><p>${top?esc(top.meta):t('Možeš nastaviti s redovitim radom ili pregledati sve odjeljke.','Continue normal work or review the full workspace.')}</p></div>${top?`<button data-focus-kind="${esc(top.kind)}" data-focus-id="${esc(top.id)}">${t('Otvori prioritet','Open priority')} →</button>`:'<b>✓</b>'}</div><div class="bw72-metrics">${signals.map(x=>`<button data-tab="${x[0]}" class="${x[3]}"><b>${x[2]}</b><span>${x[1]}</span></button>`).join('')}</div><div class="bw72-strip"><span><b>${num(s.newToday)}</b>${t('novih danas','new today')}</span><span><b>${num(s.waitingBuyer)}</b>${t('čeka kupca','waiting on buyer')}</span><span><b>${num(s.resolved)}</b>${t('riješeno','resolved')}</span><span><b>${items.length}</b>${t('aktivnih prioriteta','active priorities')}</span></div>`;
    $('[data-count="tasks"]',root).textContent=state.tasks.filter(x=>!['done','cancelled'].includes(x.status)).length;$('[data-count="approvals"]',root).textContent=state.approvals.filter(x=>x.status==='pending').length;
  }

  function timeline(items){
    const ordered=[...items].sort((a,b)=>new Date(a.time||0)-new Date(b.time||0)).slice(0,6);
    return `<section class="bw72-timeline"><div class="bw72-section-head"><div><span>${t('DANAS','TODAY')}</span><h3>${t('Tijek rada','Work timeline')}</h3></div></div>${ordered.length?ordered.map(x=>`<button data-focus-kind="${esc(x.kind)}" data-focus-id="${esc(x.id)}"><time>${x.time?new Intl.DateTimeFormat(hr()?'hr-HR':'en-GB',{hour:'2-digit',minute:'2-digit'}).format(new Date(x.time)):'—'}</time><i></i><span><b>${esc(x.title)}</b><small>${esc(x.tag)}</small></span></button>`).join(''):empty(t('Danas nema zakazanog ili vremenski osjetljivog posla.','No scheduled or time-sensitive work today.'))}</section>`;
  }

  function render(tab){
    active=tab;$$('[data-tab]',root).forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));const v=$('[data-view]',root);
    if(tab==='today'){
      const items=priorityItems(),missing=state.today?.mostMissing||[];
      v.innerHTML=`<div class="bw72-grid"><article class="bw72-queue"><div class="bw72-section-head"><div><span>${t('RED RADA','WORK QUEUE')}</span><h3>${t('Prvo riješi ovo','Do these first')}</h3></div><div><b>${items.length}</b><button data-toggle-select>${selected.size?t('Odustani','Cancel'):t('Odaberi','Select')}</button></div></div>${items.slice(0,12).map(priorityCard).join('')||empty(t('Nema aktivnih prioriteta.','No active priorities.'))}${selected.size?`<div class="bw72-selection"><b>${selected.size} ${t('odabrano','selected')}</b><button data-clear-selection>${t('Očisti','Clear')}</button><button data-open-selected>${t('Otvori prvi','Open first')}</button></div>`:''}</article><aside class="bw72-insight"><span>${t('OPERATIVNI UVID','OPERATIONS INSIGHT')}</span><h3>${t('Gdje se posao najčešće zaustavlja','Where work gets stuck')}</h3>${missing.length?missing.slice(0,5).map((x,i)=>`<div class="bw72-insight-row"><span><i style="--w:${Math.max(10,100-i*14)}%"></i>${esc(x[0])}</span><b>${x[1]}</b></div>`).join(''):empty(t('Nema ponavljajućih nedostataka.','No repeated missing information.'))}</aside></div>${timeline(items)}`;
    }else if(tab==='tasks')v.innerHTML=`<div class="bw72-toolbar"><div><h3>${t('Zadaci tima','Team tasks')}</h3><p>${t('Otvoreni, u tijeku i dovršeni zadaci.','Open, in-progress and completed work.')}</p></div><button data-new-task>${t('+ Novi zadatak','+ New task')}</button></div>${state.tasks.map(taskCard).join('')||empty(t('Nema zadataka.','No tasks yet.'))}`;
    else if(tab==='approvals')v.innerHTML=`<div class="bw72-toolbar"><div><h3>${t('Odobrenja','Approvals')}</h3><p>${t('Novac i osjetljive odluke ostaju vidljive i pripisive.','Financial and sensitive decisions remain visible and attributable.')}</p></div><button data-new-approval>${t('+ Zatraži odobrenje','+ Request approval')}</button></div>${state.approvals.map(approvalCard).join('')||empty(t('Nema zahtjeva za odobrenje.','No approval requests.'))}`;
    else if(tab==='customers')v.innerHTML=state.customers.map(c=>`<button class="bw72-list" data-customer="${encodeURIComponent(c.customer_key)}"><span><b>${esc(c.consumer_email||t('Anonimni kupac','Anonymous buyer'))}</b><small>${esc(c.products||'')}</small></span><em>${c.cases} ${t('slučaja','cases')}</em></button>`).join('')||empty(t('Još nema povezanih kupaca.','No linked customers yet.'));
    else if(tab==='products')v.innerHTML=state.products.map(p=>`<div class="bw72-list static"><span><b>${esc(p.product)}</b><small>${t('Aktivno','Active')}: ${p.active} · ${t('Riješeno','Resolved')}: ${p.resolved}</small></span><em>${p.cases}</em></div>`).join('')||empty(t('Nema dovoljno podataka o proizvodima.','No product data yet.'));
    else if(tab==='branches')v.innerHTML=state.branches.map(b=>`<div class="bw72-list static"><span><b>${esc(b.branch)}</b><small>${t('Aktivno','Active')}: ${b.active} · ${t('Riješeno','Resolved')}: ${b.resolved}</small></span><em>${b.cases}</em></div>`).join('')||empty(t('Nema podataka po poslovnicama.','No branch data yet.'));
  }

  function priorityCard(x){const key=`${x.kind}:${x.id}`,checked=selected.has(key);return `<div class="bw72-priority-wrap ${checked?'selected':''}"><button class="bw72-select" data-select-key="${esc(key)}" aria-label="${t('Odaberi prioritet','Select priority')}">${checked?'✓':'○'}</button><button class="bw72-priority ${x.score>=85?'critical':x.score>=65?'important':''}" data-focus-kind="${esc(x.kind)}" data-focus-id="${esc(x.id)}"><span class="bw72-priority-icon">${x.kind==='case'?'◉':x.kind==='task'?'✓':'€'}</span><span><b>${esc(x.title)}</b><small>${esc(x.meta)}</small></span><em>${esc(x.tag)}</em><i>→</i></button></div>`}
  function taskCard(x){return `<div class="bw72-card"><div><b>${esc(x.title)}</b><small>${esc(x.public_id||t('Interni zadatak','Internal task'))} · ${esc(x.assigned_email||t('Nedodijeljeno','Unassigned'))} · ${fmt(x.due_at)}</small></div><select data-task-status="${esc(x.id)}"><option value="open" ${x.status==='open'?'selected':''}>Open</option><option value="doing" ${x.status==='doing'?'selected':''}>Doing</option><option value="done" ${x.status==='done'?'selected':''}>Done</option><option value="cancelled" ${x.status==='cancelled'?'selected':''}>Cancelled</option></select></div>`}
  function approvalCard(a){return `<div class="bw72-card"><div><b>${esc(a.action_type)} ${a.amount!=null?'· '+esc(a.amount)+' '+esc(a.currency):''}</b><small>${esc(a.reason||'')} · ${esc(a.requested_by||'')} · ${fmt(a.created_at)}</small></div>${a.status==='pending'?`<span><button data-review="${esc(a.id)}" data-decision="approved">${t('Odobri','Approve')}</button><button data-review="${esc(a.id)}" data-decision="rejected">${t('Odbij','Reject')}</button></span>`:`<em>${esc(a.status)}</em>`}</div>`}
  function empty(x){return `<div class="bw72-empty">${esc(x)}</div>`}
  function openFocus(kind,id){if(kind==='case'){location.hash='company-case-'+encodeURIComponent(id);document.dispatchEvent(new CustomEvent('still:open-company-case',{detail:{publicId:id}}));return}render(kind==='approval'?'approvals':'tasks')}

  async function click(e){
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.refresh!==undefined)return load();
    if(b.dataset.mode){mode=b.dataset.mode;localStorage.setItem('still-workbench-mode',mode);selected.clear();renderBrief();render(active);return}
    if(b.dataset.tab)return render(b.dataset.tab);
    if(b.dataset.selectKey){selected.has(b.dataset.selectKey)?selected.delete(b.dataset.selectKey):selected.add(b.dataset.selectKey);render('today');return}
    if(b.dataset.clearSelection!==undefined){selected.clear();render('today');return}
    if(b.dataset.openSelected!==undefined){const first=[...selected][0];if(first){const [kind,...rest]=first.split(':');openFocus(kind,rest.join(':'))}return}
    if(b.dataset.toggleSelect!==undefined){selected.clear();render('today');return}
    if(b.dataset.focusKind)return openFocus(b.dataset.focusKind,b.dataset.focusId);
    if(b.dataset.newTask!==undefined){const title=prompt(t('Naziv zadatka','Task title'));if(!title)return;const publicId=prompt(t('ID slučaja, ostavi prazno za interni zadatak','Case ID, blank for internal task'))||'';await api('/api/v1/business/tasks',{method:'POST',body:JSON.stringify({title,publicId})});return load()}
    if(b.dataset.newApproval!==undefined){const actionType=prompt(t('Vrsta akcije, npr. refund','Action type, e.g. refund'));if(!actionType)return;const reason=prompt(t('Razlog','Reason'));if(!reason)return;const publicId=prompt(t('ID slučaja, ako postoji','Case ID, if applicable'))||'';const amountRaw=prompt(t('Iznos, ako postoji','Amount, if applicable'))||'';try{await api('/api/v1/business/approvals',{method:'POST',body:JSON.stringify({actionType,reason,publicId,amount:amountRaw===''?null:Number(amountRaw),currency:'EUR'})});await load()}catch(x){alert(x.message)}return}
    if(b.dataset.review){const note=prompt(t('Bilješka uz odluku (neobavezno)','Decision note (optional)'))||'';try{await api(`/api/v1/business/approvals/${encodeURIComponent(b.dataset.review)}/review`,{method:'POST',body:JSON.stringify({decision:b.dataset.decision,note})});await load()}catch(x){alert(x.message)}return}
    if(b.dataset.customer){try{const d=await api('/api/v1/business/customers/'+b.dataset.customer);$('[data-view]',root).innerHTML=`<button data-tab="customers">← ${t('Kupci','Customers')}</button><h3>${esc(decodeURIComponent(b.dataset.customer))}</h3>${d.cases.map(c=>`<button class="bw72-priority" data-focus-kind="case" data-focus-id="${esc(c.public_id)}"><span><b>${esc(c.product_name||c.case_type)}</b><small>${esc(c.retailer_name||'')} · ${fmt(c.created_at)}</small></span><em>${esc(c.status)}</em><i>→</i></button>`).join('')}`}catch(x){alert(x.message)}}
  }

  addEventListener('change',async e=>{const s=e.target.closest('[data-task-status]');if(!s)return;try{await api('/api/v1/business/tasks/'+encodeURIComponent(s.dataset.taskStatus),{method:'POST',body:JSON.stringify({status:s.value})});await load();render('tasks')}catch(x){alert(x.message)}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',shell);else shell();
  window.addEventListener('still:company-authenticated',shell);
  window.addEventListener('still:companyos-ready',shell);
})();
