(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const hr = () => document.documentElement.lang !== 'en';
  const t = (croatian, english) => hr() ? croatian : english;
  const fmt = value => {
    if (!value) return '—';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return esc(value);
    return new Intl.DateTimeFormat(hr() ? 'hr-HR' : 'en-GB', {dateStyle:'medium', timeStyle:value.includes?.('T') ? 'short' : undefined}).format(parsed);
  };
  const money = (amount, currency = 'EUR') => amount == null ? '—' : new Intl.NumberFormat(hr() ? 'hr-HR' : 'en-GB', {style:'currency', currency:currency || 'EUR'}).format(Number(amount));
  const label = value => esc(String(value || '—').replaceAll('_', ' '));
  const requestId = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

  async function api(url, options = {}) {
    const response = await fetch(url, {
      credentials:'same-origin',
      ...options,
      headers:{
        ...(options.body ? {'content-type':'application/json', 'idempotency-key':requestId()} : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const translations = {
        forbidden:t('Za ovu radnju potrebna je uloga voditelja ili administratora.','A manager or administrator role is required.'),
        service_not_found:t('Odabrana usluga više nije dostupna.','The selected service is no longer available.'),
        case_not_found:t('Nije pronađen slučaj s tom javnom oznakom.','No case was found with that public ID.'),
        subject_not_found:t('Ciljani zapis nije pronađen. Provjerite javnu oznaku.','The target record was not found. Check its public ID.'),
        invalid_capacity:t('Unesite datum i valjan broj dostupnih minuta.','Enter a date and a valid number of available minutes.')
      };
      throw new Error(translations[data.error] || data.message || data.error || t('Radnja nije uspjela.','The action failed.'));
    }
    return data;
  }

  let root;
  let active = 'delivery';
  let selectedEngagement = '';
  let deliveryDetail = null;
  let customer = null;
  let state = {engagements:[], services:[], resources:[], evidence:[], capacity:[], playbooks:[], rules:[], claims:[]};

  const empty = message => `<div class="cc101-empty">${esc(message)}</div>`;
  const status = (message, kind = '') => {
    const node = $('[data-cc101-status]', root);
    if (!node) return;
    node.className = `cc101-status ${kind}`;
    node.textContent = message;
  };
  const busy = (form, value) => {
    const button = $('button[type="submit"]', form);
    if (button) button.disabled = value;
    form.setAttribute('aria-busy', String(value));
  };
  const formData = form => Object.fromEntries(new FormData(form));
  const serviceName = id => state.services.find(item => item.id === id)?.name || id || '—';

  async function load() {
    status(t('Učitavanje stvarnih zapisa tvrtke…','Loading real company records…'));
    try {
      const [engagements, services, resources, evidence, capacity, playbooks, rules, claims] = await Promise.all([
        api('/api/v1/services/engagements'), api('/api/v1/services/catalog'), api('/api/v1/services/resources'),
        api('/api/v1/services/evidence-requirements'), api('/api/v1/ops/capacity'), api('/api/v1/ops/playbooks'),
        api('/api/v1/ops/followup-rules'), api('/api/v1/ops/goods/supplier-claims')
      ]);
      state = {
        engagements:engagements.engagements || [], services:services.services || [], resources:resources.resources || [],
        evidence:evidence.requirements || [], capacity:capacity.items || [], playbooks:playbooks.playbooks || [],
        rules:rules.rules || [], claims:claims.items || []
      };
      if (selectedEngagement && !state.engagements.some(item => item.id === selectedEngagement)) selectedEngagement = '';
      if (selectedEngagement) await loadDelivery(selectedEngagement, false);
      render();
      status(t('Podaci su ažurirani.','Data is up to date.'), 'success');
    } catch (error) {
      status(error.message, 'error');
      render();
    }
  }

  async function loadDelivery(id, repaint = true) {
    selectedEngagement = id;
    deliveryDetail = id ? await api(`/api/v1/services/engagements/${encodeURIComponent(id)}`) : null;
    if (repaint) render();
  }

  function engagementOptions() {
    return `<option value="">${t('Odaberite angažman','Choose an engagement')}</option>${state.engagements.map(item => `<option value="${esc(item.id)}" ${item.id === selectedEngagement ? 'selected' : ''}>${esc(item.public_id)} · ${esc(item.service_name)} · ${esc(item.customer_email || t('bez e-maila','no email'))}</option>`).join('')}`;
  }

  function deliveryView() {
    const detail = deliveryDetail;
    const engagement = detail?.engagement;
    return `<div class="cc101-split cc101-delivery">
      <section class="cc101-panel cc101-panel-wide">
        <div class="cc101-panel-head"><div><span>${t('AKTIVNI POSAO','ACTIVE WORK')}</span><h3>${t('Kontrola izvršenja usluge','Service delivery control')}</h3><p>${t('Otvorite angažman i vodite faze, promjene opsega i završni ishod na jednom mjestu.','Open an engagement and manage milestones, scope changes and completion outcomes in one place.')}</p></div><button type="button" class="cc101-secondary" data-cc101-reload>${t('Osvježi','Refresh')}</button></div>
        <label class="cc101-field"><span>${t('Uslužni angažman','Service engagement')}</span><select data-cc101-engagement>${engagementOptions()}</select></label>
        ${!engagement ? empty(state.engagements.length ? t('Odaberite angažman za prikaz njegovih stvarnih zapisa.','Choose an engagement to view its real records.') : t('Najprije izradite uslužni angažman u odjeljku Usluge.','Create a service engagement in the Services section first.')) : `
          <div class="cc101-summary"><div><small>${t('Angažman','Engagement')}</small><b>${esc(engagement.public_id)}</b></div><div><small>${t('Usluga','Service')}</small><b>${esc(engagement.service_name)}</b></div><div><small>${t('Kupac','Customer')}</small><b>${esc(engagement.customer_email || engagement.customer_name || '—')}</b></div><div><small>${t('Status','Status')}</small><b>${label(engagement.status)}</b></div></div>
          <div class="cc101-columns">
            <section><div class="cc101-subhead"><h4>${t('Kontrolne točke','Milestones')}</h4><span>${detail.milestones?.length || 0}</span></div>
              <form data-cc101-form="milestone" class="cc101-inline-form"><input name="name" required maxlength="180" placeholder="${t('npr. Procjena odobrena','e.g. Estimate approved')}"><input name="dueAt" type="datetime-local"><button type="submit">${t('Dodaj','Add')}</button></form>
              <div class="cc101-list">${(detail.milestones || []).map(item => `<article><div><b>${esc(item.name)}</b><small>${fmt(item.due_at)}</small></div><select data-cc101-milestone="${esc(item.id)}" aria-label="${t('Status kontrolne točke','Milestone status')}">${['pending','in_progress','done','skipped'].map(value => `<option value="${value}" ${item.status === value ? 'selected' : ''}>${label(value)}</option>`).join('')}</select></article>`).join('') || empty(t('Nema kontrolnih točaka.','No milestones yet.'))}</div>
            </section>
            <section><div class="cc101-subhead"><h4>${t('Zahtjevi za promjenu','Change requests')}</h4><span>${detail.changes?.length || 0}</span></div>
              <form data-cc101-form="change" class="cc101-stack-form"><div class="cc101-form-grid"><label><span>${t('Vrsta','Type')}</span><select name="requestType"><option value="scope_change">${t('Promjena opsega','Scope change')}</option><option value="reschedule">${t('Novi termin','Reschedule')}</option><option value="location_change">${t('Promjena lokacije','Location change')}</option><option value="cancel">${t('Otkazivanje','Cancellation')}</option><option value="other">${t('Drugo','Other')}</option></select></label><label><span>${t('Tražena vrijednost','Requested value')}</span><input name="requestedValue" maxlength="1000" placeholder="${t('Novi opseg, datum ili lokacija','New scope, date or location')}"></label></div><label><span>${t('Razlog','Reason')}</span><textarea name="reason" required maxlength="2000"></textarea></label><button type="submit">${t('Zabilježi promjenu','Record change')}</button></form>
              <div class="cc101-list">${(detail.changes || []).map(item => `<article class="cc101-change"><div><b>${label(item.request_type)}</b><small>${esc(item.reason)}${item.requested_value ? ` · ${esc(item.requested_value)}` : ''}</small></div><em>${label(item.status)}</em>${item.status === 'pending' ? `<div class="cc101-actions"><button type="button" data-cc101-review="${esc(item.id)}" data-decision="approved">${t('Odobri','Approve')}</button><button type="button" data-cc101-review="${esc(item.id)}" data-decision="rejected" class="cc101-secondary">${t('Odbij','Reject')}</button></div>` : ''}</article>`).join('') || empty(t('Nema zahtjeva za promjenu.','No change requests.'))}</div>
            </section>
          </div>`}
      </section>
      <aside class="cc101-panel">
        <div class="cc101-panel-head"><div><span>${t('DOKAZ ZAVRŠETKA','COMPLETION RECORD')}</span><h3>${t('Ishod i dokaz','Outcome & evidence')}</h3></div></div>
        ${!engagement ? empty(t('Odaberite angažman.','Choose an engagement.')) : `<form data-cc101-form="completion" class="cc101-stack-form"><label><span>${t('Ishod','Outcome')}</span><select name="eventType"><option value="rework_offered">${t('Ponuđena dorada','Rework offered')}</option><option value="rebooked">${t('Ponovno rezervirano','Rebooked')}</option><option value="credit_offered">${t('Ponuđen kredit','Credit offered')}</option><option value="partial_refund_offered">${t('Ponuđen djelomični povrat','Partial refund offered')}</option></select></label><label><span>${t('Bilješka','Note')}</span><textarea name="note" maxlength="2000"></textarea></label><button type="submit">${t('Zabilježi ishod','Record outcome')}</button></form><div class="cc101-timeline">${(detail.completionEvents || []).map(item => `<article><i></i><div><b>${label(item.event_type)}</b><small>${fmt(item.created_at)}${item.note ? ` · ${esc(item.note)}` : ''}</small></div></article>`).join('') || empty(t('Još nema završnih događaja.','No completion events yet.'))}</div>`}
        <div class="cc101-divider"></div><h4>${t('Obvezna evidencija po usluzi','Required evidence by service')}</h4>
        <form data-cc101-form="evidence" class="cc101-stack-form"><label><span>${t('Usluga','Service')}</span><select name="serviceId" required><option value="">${t('Odaberite','Choose')}</option>${state.services.map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join('')}</select></label><label><span>${t('Događaj','Event')}</span><input name="eventType" required maxlength="60" placeholder="${t('npr. completed','e.g. completed')}"></label><label><span>${t('Obavezna polja, odvojena zarezom','Required fields, comma separated')}</span><input name="requiredFields" required placeholder="${t('fotografija, potpis, serijski broj','photo, signature, serial number')}"></label><button type="submit">${t('Spremi pravilo dokaza','Save evidence rule')}</button></form>
        <div class="cc101-chips">${state.evidence.map(item => `<span><b>${esc(serviceName(item.service_id))}</b> · ${esc(item.event_type)} · ${esc((item.required_fields || []).join(', ') || '—')}</span>`).join('') || `<span>${t('Nema definiranih pravila.','No rules defined.')}</span>`}</div>
      </aside>
    </div>`;
  }

  function capacityView() {
    const total = state.capacity.reduce((sum, item) => sum + Number(item.available_minutes || 0), 0);
    return `<div class="cc101-split"><section class="cc101-panel"><div class="cc101-panel-head"><div><span>${t('KAPACITET','CAPACITY')}</span><h3>${t('Ljudi, vozila, prostor i oprema','People, vehicles, rooms & equipment')}</h3><p>${t('Planirajte stvarno raspoloživo vrijeme po danu i resursu prije prihvaćanja novog posla.','Plan real available time by day and resource before accepting more work.')}</p></div></div><div class="cc101-summary"><div><small>${t('Zapisi','Records')}</small><b>${state.capacity.length}</b></div><div><small>${t('Ukupno sati','Total hours')}</small><b>${(total / 60).toFixed(1)}</b></div><div><small>${t('Resursi','Resources')}</small><b>${state.resources.length}</b></div></div><form data-cc101-form="capacity" class="cc101-stack-form"><div class="cc101-form-grid"><label><span>${t('Datum','Date')}</span><input name="day" type="date" required></label><label><span>${t('Dostupno minuta','Available minutes')}</span><input name="availableMinutes" type="number" min="0" step="15" value="480" required></label></div><label><span>${t('Resurs','Resource')}</span><select name="resourceId"><option value="">${t('Opći kapacitet tvrtke','Company-wide capacity')}</option>${state.resources.map(item => `<option value="${esc(item.id)}">${esc(item.name)} · ${label(item.resource_type)}</option>`).join('')}</select></label><button type="submit">${t('Spremi kapacitet','Save capacity')}</button></form></section><section class="cc101-panel"><div class="cc101-panel-head"><div><span>${t('RASPOLOŽIVOST','AVAILABILITY')}</span><h3>${t('Plan po danima','Daily plan')}</h3></div></div><div class="cc101-list">${state.capacity.map(item => `<article><div><b>${fmt(item.day)}</b><small>${esc(item.resource_name || item.member_email || t('Opći kapacitet','Company-wide'))}</small></div><strong>${Math.round(Number(item.available_minutes || 0) / 6) / 10} h</strong><em>${label(item.source)}</em></article>`).join('') || empty(t('Nema spremljenog kapaciteta.','No capacity saved yet.'))}</div></section></div>`;
  }

  function customerView() {
    const timeline = customer?.timeline || [];
    const titleFor = item => item.data?.title || item.data?.service_name || item.data?.product_name || item.data?.public_id || item.kind;
    return `<div class="cc101-split"><section class="cc101-panel"><div class="cc101-panel-head"><div><span>${t('CUSTOMER 360','CUSTOMER 360')}</span><h3>${t('Jedna povijest odnosa','One relationship history')}</h3><p>${t('Pronađite slučajeve, usluge, ugovore, zadatke i obećanja za kupca bez pretraživanja više sustava.','Find cases, services, contracts, tasks and commitments for one customer without searching separate systems.')}</p></div></div><form data-cc101-form="customer" class="cc101-search-form"><input name="email" type="email" required value="${esc(customer?.customer?.email || '')}" placeholder="kupac@example.com"><button type="submit">${t('Otvori kupca','Open customer')}</button></form>${customer ? `<div class="cc101-summary"><div><small>${t('Kupac','Customer')}</small><b>${esc(customer.customer.email)}</b></div><div><small>${t('Zapisi','Records')}</small><b>${timeline.length}</b></div><div><small>${t('Vrste odnosa','Relationship types')}</small><b>${new Set(timeline.map(item => item.kind)).size}</b></div></div>` : ''}</section><section class="cc101-panel cc101-panel-wide"><div class="cc101-panel-head"><div><span>${t('VREMENSKA CRTA','TIMELINE')}</span><h3>${t('Svi relevantni zapisi','All relevant records')}</h3></div></div><div class="cc101-timeline cc101-timeline-large">${timeline.map(item => `<article><i></i><div><span>${label(item.kind)}</span><b>${esc(titleFor(item))}</b><small>${fmt(item.at)} · ${label(item.data?.status || item.data?.case_type || item.data?.contract_type)}</small></div></article>`).join('') || empty(customer ? t('Za ovog kupca još nema povezanih zapisa.','No linked records exist for this customer yet.') : t('Unesite e-mail kupca za objedinjeni prikaz.','Enter a customer email for a unified view.'))}</div></section></div>`;
  }

  function automationView() {
    return `<div class="cc101-split"><section class="cc101-panel"><div class="cc101-panel-head"><div><span>${t('PLAYBOOKOVI','PLAYBOOKS')}</span><h3>${t('Ponovljivi tijekovi rada','Repeatable workflows')}</h3><p>${t('Spremite niz zadataka i primijenite ga na slučaj, uslugu ili ugovor. Primjena odmah stvara stvarne zadatke.','Save a sequence of tasks and apply it to a case, service or contract. Applying it creates real tasks immediately.')}</p></div></div><form data-cc101-form="playbook" class="cc101-stack-form"><div class="cc101-form-grid"><label><span>${t('Naziv','Name')}</span><input name="name" required maxlength="180"></label><label><span>${t('Primjenjuje se na','Applies to')}</span><select name="appliesTo"><option value="case">${t('Slučaj','Case')}</option><option value="service">${t('Usluga','Service')}</option><option value="contract">${t('Ugovor','Contract')}</option></select></label></div><label><span>${t('Prvi zadatak','First task')}</span><input name="stepTitle" required maxlength="180"></label><label><span>${t('Rok nakon sati','Due after hours')}</span><input name="delayHours" type="number" min="0" max="8760" value="24"></label><button type="submit">${t('Spremi playbook','Save playbook')}</button></form><div class="cc101-list">${state.playbooks.map(item => `<article class="cc101-playbook"><div><b>${esc(item.name)}</b><small>${label(item.applies_to)} · ${(item.steps || []).length} ${t('zadataka','tasks')}</small></div><form data-cc101-apply="${esc(item.id)}"><input name="subjectId" required placeholder="${item.applies_to === 'case' ? 'CASE-…' : t('ID zapisa','Record ID')}"><button type="submit">${t('Primijeni','Apply')}</button></form></article>`).join('') || empty(t('Nema spremljenih playbookova.','No playbooks saved yet.'))}</div></section><section class="cc101-panel"><div class="cc101-panel-head"><div><span>${t('PRAVILA PRAĆENJA','FOLLOW-UP RULES')}</span><h3>${t('Standardizirajte sljedeći korak','Standardize the next step')}</h3><p>${t('Spremite pravilo kada bi trebalo izraditi podsjetnik. Automatski pozadinski pokretač još nije aktivan, zato su ta pravila zasad predlošci za tim.','Save when a reminder should be created. The automatic background runner is not active yet, so these rules currently serve as team templates.')}</p></div><em class="cc101-disclosure">${t('Potrebna vanjska automatizacija','External automation required')}</em></div><form data-cc101-form="followup" class="cc101-stack-form"><div class="cc101-form-grid"><label><span>${t('Vrsta zapisa','Record type')}</span><select name="subjectType"><option value="case">${t('Slučaj','Case')}</option><option value="service">${t('Usluga','Service')}</option><option value="contract">${t('Ugovor','Contract')}</option></select></label><label><span>${t('Status okidača','Trigger status')}</span><input name="triggerStatus" required maxlength="50" placeholder="awaiting_customer"></label></div><div class="cc101-form-grid"><label><span>${t('Odgoda u satima','Delay in hours')}</span><input name="delayHours" type="number" min="1" max="8760" value="24" required></label><label><span>${t('Naziv zadatka','Task title')}</span><input name="taskTitle" required maxlength="180"></label></div><button type="submit">${t('Spremi pravilo','Save rule')}</button></form><div class="cc101-list">${state.rules.map(item => `<article><div><b>${esc(item.task_title)}</b><small>${label(item.subject_type)} · ${label(item.trigger_status)}</small></div><strong>${item.delay_hours} h</strong></article>`).join('') || empty(t('Nema spremljenih pravila.','No rules saved yet.'))}</div></section></div>`;
  }

  function claimsView() {
    return `<div class="cc101-split"><section class="cc101-panel"><div class="cc101-panel-head"><div><span>${t('DOBAVLJAČI','SUPPLIERS')}</span><h3>${t('Regres i zahtjevi prema dobavljaču','Supplier recovery claims')}</h3><p>${t('Povežite kvar, povrat ili manjak s dobavljačem i iznosom koji tvrtka treba naplatiti.','Link a defect, return or shortage to the supplier and the amount the business should recover.')}</p></div></div><form data-cc101-form="claim" class="cc101-stack-form"><div class="cc101-form-grid"><label><span>${t('Dobavljač','Supplier')}</span><input name="supplierName" required maxlength="180"></label><label><span>${t('Vrsta zahtjeva','Claim type')}</span><select name="claimType"><option value="defect">${t('Kvar / neispravnost','Defect')}</option><option value="shortage">${t('Manjak','Shortage')}</option><option value="damage">${t('Oštećenje','Damage')}</option><option value="warranty_recovery">${t('Regres jamstva','Warranty recovery')}</option><option value="late_delivery">${t('Kašnjenje isporuke','Late delivery')}</option></select></label></div><div class="cc101-form-grid"><label><span>${t('Proizvod','Product')}</span><input name="productName" maxlength="180"></label><label><span>${t('Referenca dobavljača','Supplier reference')}</span><input name="supplierReference" maxlength="160"></label></div><div class="cc101-form-grid"><label><span>${t('Javna oznaka slučaja, opcionalno','Case public ID, optional')}</span><input name="publicId" maxlength="80" placeholder="CASE-…"></label><label><span>${t('Iznos EUR','Amount EUR')}</span><input name="amount" type="number" min="0" step="0.01"></label></div><label><span>${t('Bilješka','Note')}</span><textarea name="note" maxlength="3000"></textarea></label><button type="submit">${t('Otvori zahtjev dobavljaču','Open supplier claim')}</button></form></section><section class="cc101-panel cc101-panel-wide"><div class="cc101-panel-head"><div><span>${t('EVIDENCIJA','CLAIM REGISTER')}</span><h3>${t('Otvoreni i povijesni zahtjevi','Open and historical claims')}</h3></div></div><div class="cc101-list">${state.claims.map(item => `<article><div><b>${esc(item.supplier_name)} · ${esc(item.product_name || label(item.claim_type))}</b><small>${esc(item.supplier_reference || '')}${item.note ? ` · ${esc(item.note)}` : ''}</small></div><strong>${money(item.amount, item.currency)}</strong><em>${label(item.status)}</em></article>`).join('') || empty(t('Nema zahtjeva prema dobavljačima.','No supplier claims yet.'))}</div></section></div>`;
  }

  function render() {
    if (!root) return;
    root.querySelectorAll('[data-cc101-tab]').forEach(button => button.classList.toggle('active', button.dataset.cc101Tab === active));
    const view = $('[data-cc101-view]', root);
    view.innerHTML = ({delivery:deliveryView, capacity:capacityView, customer:customerView, automation:automationView, claims:claimsView}[active] || deliveryView)();
  }

  function mount() {
    if ($('#companyControlCenterV101')) return;
    const anchor = $('#companyOpsV74') || $('#businessWorkbenchV72');
    if (!anchor) return setTimeout(mount, 500);
    root = document.createElement('section');
    root.id = 'companyControlCenterV101';
    root.className = 'cc101';
    root.innerHTML = `<header class="cc101-head"><div><span>${t('NAPREDNI POSLOVNI ALATI','ADVANCED BUSINESS TOOLS')}</span><h2>${t('Od dogovora do mjerljivog ishoda','From agreement to measurable outcome')}</h2><p>${t('Stvarni radni prostor za uslužne faze, kapacitet, odnos s kupcem, automatizaciju i zahtjeve prema dobavljačima. Svi podaci pripadaju samo vašoj verificiranoj tvrtki.','A real workspace for service delivery, capacity, customer relationships, automation and supplier recovery. All data belongs only to your verified company.')}</p></div><button type="button" data-cc101-reload>${t('Osvježi podatke','Refresh data')}</button></header><nav class="cc101-tabs" aria-label="${t('Napredni poslovni alati','Advanced business tools')}"><button type="button" class="active" data-cc101-tab="delivery">${t('Izvršenje usluge','Service delivery')}</button><button type="button" data-cc101-tab="capacity">${t('Kapacitet','Capacity')}</button><button type="button" data-cc101-tab="customer">Customer 360</button><button type="button" data-cc101-tab="automation">${t('Playbookovi','Playbooks')}</button><button type="button" data-cc101-tab="claims">${t('Dobavljači','Suppliers')}</button></nav><div class="cc101-status" data-cc101-status role="status"></div><div data-cc101-view></div>`;
    anchor.insertAdjacentElement('afterend', root);
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('submit', onSubmit);
    load();
  }

  async function afterWrite(message, delivery = false) {
    status(message, 'success');
    if (delivery && selectedEngagement) deliveryDetail = await api(`/api/v1/services/engagements/${encodeURIComponent(selectedEngagement)}`);
    const [evidence, capacity, playbooks, rules, claims] = await Promise.all([
      api('/api/v1/services/evidence-requirements'), api('/api/v1/ops/capacity'), api('/api/v1/ops/playbooks'), api('/api/v1/ops/followup-rules'), api('/api/v1/ops/goods/supplier-claims')
    ]);
    state.evidence = evidence.requirements || [];
    state.capacity = capacity.items || [];
    state.playbooks = playbooks.playbooks || [];
    state.rules = rules.rules || [];
    state.claims = claims.items || [];
    render();
  }

  async function onClick(event) {
    const tab = event.target.closest('[data-cc101-tab]');
    if (tab) { active = tab.dataset.cc101Tab; render(); return; }
    if (event.target.closest('[data-cc101-reload]')) { await load(); return; }
    const review = event.target.closest('[data-cc101-review]');
    if (!review) return;
    review.disabled = true;
    try {
      await api(`/api/v1/services/changes/${encodeURIComponent(review.dataset.cc101Review)}/review`, {method:'POST', body:JSON.stringify({decision:review.dataset.decision})});
      await afterWrite(t('Odluka o promjeni je spremljena.','Change decision saved.'), true);
    } catch (error) { status(error.message, 'error'); } finally { review.disabled = false; }
  }

  async function onChange(event) {
    if (event.target.matches('[data-cc101-engagement]')) {
      try { status(t('Učitavanje angažmana…','Loading engagement…')); await loadDelivery(event.target.value); status(t('Angažman je otvoren.','Engagement opened.'), 'success'); }
      catch (error) { status(error.message, 'error'); }
      return;
    }
    if (event.target.matches('[data-cc101-milestone]')) {
      try {
        await api(`/api/v1/services/milestones/${encodeURIComponent(event.target.dataset.cc101Milestone)}`, {method:'POST', body:JSON.stringify({status:event.target.value})});
        await afterWrite(t('Status kontrolne točke je spremljen.','Milestone status saved.'), true);
      } catch (error) { status(error.message, 'error'); }
    }
  }

  async function onSubmit(event) {
    const form = event.target.closest('form');
    if (!form || !root.contains(form)) return;
    event.preventDefault();
    busy(form, true);
    try {
      if (form.dataset.cc101Apply) {
        const values = formData(form);
        const result = await api(`/api/v1/ops/playbooks/${encodeURIComponent(form.dataset.cc101Apply)}/apply`, {method:'POST', body:JSON.stringify({subjectId:values.subjectId})});
        status(t(`Izrađeno zadataka: ${result.createdTasks}.`,`Tasks created: ${result.createdTasks}.`), 'success');
        form.reset();
        return;
      }
      const kind = form.dataset.cc101Form;
      const values = formData(form);
      if (kind === 'customer') {
        customer = await api(`/api/v1/ops/customers/${encodeURIComponent(values.email.trim().toLowerCase())}/timeline`);
        render(); status(t('Povijest kupca je učitana.','Customer history loaded.'), 'success'); return;
      }
      if (kind === 'milestone') await api(`/api/v1/services/engagements/${encodeURIComponent(selectedEngagement)}/milestones`, {method:'POST', body:JSON.stringify({name:values.name, dueAt:values.dueAt || null})});
      if (kind === 'change') await api(`/api/v1/services/engagements/${encodeURIComponent(selectedEngagement)}/changes`, {method:'POST', body:JSON.stringify(values)});
      if (kind === 'completion') await api(`/api/v1/services/engagements/${encodeURIComponent(selectedEngagement)}/completion-events`, {method:'POST', body:JSON.stringify(values)});
      if (kind === 'evidence') await api('/api/v1/services/evidence-requirements', {method:'POST', body:JSON.stringify({serviceId:values.serviceId,eventType:values.eventType,requiredFields:values.requiredFields.split(',').map(item => item.trim()).filter(Boolean)})});
      if (kind === 'capacity') await api('/api/v1/ops/capacity', {method:'POST', body:JSON.stringify({day:values.day,availableMinutes:Number(values.availableMinutes),resourceId:values.resourceId || null,source:'manual'})});
      if (kind === 'playbook') await api('/api/v1/ops/playbooks', {method:'POST', body:JSON.stringify({name:values.name,appliesTo:values.appliesTo,triggerType:'manual',steps:[{title:values.stepTitle,delayHours:Number(values.delayHours) || 0}]})});
      if (kind === 'followup') await api('/api/v1/ops/followup-rules', {method:'POST', body:JSON.stringify({subjectType:values.subjectType,triggerStatus:values.triggerStatus,delayHours:Number(values.delayHours),taskTitle:values.taskTitle})});
      if (kind === 'claim') await api('/api/v1/ops/goods/supplier-claims', {method:'POST', body:JSON.stringify({...values,amount:values.amount ? Number(values.amount) : null,currency:'EUR'})});
      const messages = {milestone:t('Kontrolna točka je dodana.','Milestone added.'),change:t('Zahtjev za promjenu je zabilježen.','Change request recorded.'),completion:t('Ishod je zabilježen.','Outcome recorded.'),evidence:t('Pravilo dokaza je spremljeno.','Evidence rule saved.'),capacity:t('Kapacitet je spremljen.','Capacity saved.'),playbook:t('Playbook je spremljen.','Playbook saved.'),followup:t('Pravilo praćenja je spremljeno kao predložak.','Follow-up rule saved as a template.'),claim:t('Zahtjev prema dobavljaču je otvoren.','Supplier claim opened.')};
      form.reset();
      await afterWrite(messages[kind] || t('Spremljeno.','Saved.'), ['milestone','change','completion'].includes(kind));
    } catch (error) { status(error.message, 'error'); }
    finally { busy(form, false); }
  }

  document.addEventListener('change', event => {
    if (event.target?.id === 'language' && root) {
      const old = root;
      root = null;
      old.remove();
      mount();
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true}); else mount();
})();
