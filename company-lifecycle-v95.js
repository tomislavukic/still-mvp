(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const dateText = value => value ? new Intl.DateTimeFormat(isHr() ? 'hr-HR' : 'en-GB', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : '';
  const money = (cents, currency = 'EUR') => new Intl.NumberFormat(isHr() ? 'hr-HR' : 'en-GB', { style: 'currency', currency }).format(Number(cents || 0) / 100);
  let root;
  let data = { passports: [], templates: [], commitments: [], threads: [], alerts: [], history: [], assets: [], reputation: {} };
  let activeTab = 'promises';
  let activeThread = null;

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...options });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || `HTTP ${response.status}`), { status: response.status, data: result });
    return result;
  }

  function passportOptions() {
    return data.passports.map(item => `<option value="${esc(item.public_id)}">${esc(item.title)} · ${esc(item.public_id)}</option>`).join('') || `<option value="">${t('Issue a passport first', 'Najprije izdajte putovnicu')}</option>`;
  }

  function shell() {
    return `<section class="cl95" id="companyLifecycleV95">
      <header class="cl95-head"><div><span>${t('LIFECYCLE OPERATIONS', 'OPERACIJE ŽIVOTNOG CIKLUSA')}</span><h2>${t('Turn promises into repeatable, provable service.', 'Pretvorite obećanja u ponovljivu i dokazivu uslugu.')}</h2><p>${t('Templates, support, safety notices, service history and your own business assets share one accountable workspace.', 'Predlošci, podrška, sigurnosne obavijesti, servisna povijest i vlastita poslovna imovina dijele jedan odgovoran radni prostor.')}</p></div><div id="cl95Score" class="cl95-score"></div></header>
      <div class="cl95-connection"><div><b>${t('Buyer problem', 'Problem kupca')}</b><span>${t('Scattered dates, lost service history and repeating the same story to support.', 'Rasuti rokovi, izgubljena servisna povijest i stalno ponavljanje iste priče podršci.')}</span></div><i>↔</i><div><b>${t('Shared Still? record', 'Zajednički Still? zapis')}</b><span>${t('A buyer-controlled passport with attributable company actions.', 'Putovnica pod kontrolom kupca s pripisivim radnjama tvrtke.')}</span></div><i>↔</i><div><b>${t('Business benefit', 'Korist za tvrtku')}</b><span>${t('Lower support repetition, stronger retention and reputation earned from outcomes.', 'Manje ponavljanja u podršci, veće zadržavanje i reputacija zaslužena ishodima.')}</span></div></div>
      <nav class="cl95-tabs"><button data-cl95-tab="promises">${t('Promises & reputation', 'Obećanja i reputacija')}</button><button data-cl95-tab="support">${t('Passport support', 'Podrška putovnice')}</button><button data-cl95-tab="alerts">${t('Alerts & history', 'Upozorenja i povijest')}</button><button data-cl95-tab="assets">${t('Business assets', 'Poslovna imovina')}</button></nav>
      <div data-cl95-panel="promises"><div class="cl95-grid">
        <form id="cl95TemplateForm" class="cl95-card"><span class="cl95-kicker">${t('PROMISE TEMPLATE', 'PREDLOŽAK OBEĆANJA')}</span><h3>${t('Publish the standard before the problem.', 'Objavite standard prije problema.')}</h3><label>${t('Template name', 'Naziv predloška')}<input name="name" required maxlength="100" placeholder="${t('48-hour support response', 'Odgovor podrške u 48 sati')}"></label><label>${t('Promise type', 'Vrsta obećanja')}<select name="type"><option value="response">${t('Response', 'Odgovor')}</option><option value="delivery">${t('Delivery', 'Isporuka')}</option><option value="repair">${t('Repair', 'Popravak')}</option><option value="service">${t('Service', 'Usluga')}</option><option value="renewal">${t('Renewal', 'Obnova')}</option><option value="refund">${t('Refund', 'Povrat novca')}</option><option value="other">${t('Other', 'Ostalo')}</option></select></label><label>${t('Exact promise', 'Točno obećanje')}<input name="title" required maxlength="180"></label><label>${t('Default deadline · days', 'Zadani rok · dana')}<input name="defaultDays" type="number" min="0" max="3650" value="7"></label><label class="cl95-check"><input name="isPublic" type="checkbox" checked> ${t('Show this promise to the buyer', 'Prikaži ovo obećanje kupcu')}</label><button>${t('Save reusable promise', 'Spremi ponovljivo obećanje')}</button><small data-cl95-template-message></small></form>
        <section class="cl95-card"><span class="cl95-kicker">${t('APPLY IN ONE STEP', 'PRIMIJENI U JEDNOM KORAKU')}</span><h3>${t('Consistent promises across the team.', 'Dosljedna obećanja cijelog tima.')}</h3><form id="cl95ApplyForm"><label>${t('Passport', 'Putovnica')}<select name="passport">${passportOptions()}</select></label><label>${t('Promise template', 'Predložak obećanja')}<select name="template"></select></label><button>${t('Add promise to passport', 'Dodaj obećanje putovnici')}</button><small data-cl95-apply-message></small></form><div id="cl95Templates" class="cl95-list"></div><h4>${t('Outcome queue', 'Red ishoda')}</h4><div id="cl95Commitments" class="cl95-list"></div></section>
      </div></div>
      <div data-cl95-panel="support" hidden><div class="cl95-grid support"><section class="cl95-card"><span class="cl95-kicker">${t('CONNECTED INBOX', 'POVEZANI SANDUČIĆ')}</span><h3>${t('Every message already has context.', 'Svaka poruka već ima kontekst.')}</h3><p>${t('The passport identifies the product or service and keeps the entire response timeline.', 'Putovnica identificira proizvod ili uslugu i čuva cijelu vremensku crtu odgovora.')}</p><div id="cl95Threads" class="cl95-list"></div></section><section id="cl95ThreadDetail" class="cl95-card"><div class="cl95-empty"><b>${t('Choose a support thread.', 'Odaberite razgovor podrške.')}</b><p>${t('Buyer and company replies remain attached to the passport.', 'Odgovori kupca i tvrtke ostaju povezani s putovnicom.')}</p></div></section></div></div>
      <div data-cl95-panel="alerts" hidden><div class="cl95-grid">
        <form id="cl95AlertForm" class="cl95-card"><span class="cl95-kicker">${t('TARGETED ALERT', 'CILJANO UPOZORENJE')}</span><h3>${t('Reach the owner of the affected passport.', 'Dosegnite vlasnika pogođene putovnice.')}</h3><label>${t('Passport', 'Putovnica')}<select name="passport">${passportOptions()}</select></label><label>${t('Severity', 'Ozbiljnost')}<select name="severity"><option value="notice">${t('Service notice', 'Servisna obavijest')}</option><option value="warning">${t('Warning', 'Upozorenje')}</option><option value="critical">${t('Critical / recall', 'Kritično / opoziv')}</option></select></label><label>${t('Alert title', 'Naslov upozorenja')}<input name="title" required maxlength="180"></label><label>${t('What must the buyer know?', 'Što kupac mora znati?')}<textarea name="detail" required maxlength="2000"></textarea></label><div class="cl95-fields"><label>${t('Official action URL', 'Službena poveznica radnje')}<input name="actionUrl" type="url"></label><label>${t('Expires', 'Istječe')}<input name="expiresAt" type="date"></label></div><button>${t('Send passport alert', 'Pošalji upozorenje putovnice')}</button><small data-cl95-alert-message></small></form>
        <form id="cl95HistoryForm" class="cl95-card"><span class="cl95-kicker">${t('VERIFIED SERVICE EVENT', 'VERIFICIRANI SERVISNI ZAPIS')}</span><h3>${t('Build a history buyers can keep and transfer.', 'Izgradite povijest koju kupci mogu sačuvati i prenijeti.')}</h3><label>${t('Passport', 'Putovnica')}<select name="passport">${passportOptions()}</select></label><div class="cl95-fields"><label>${t('Type', 'Vrsta')}<select name="type"><option value="service">${t('Service', 'Servis')}</option><option value="repair">${t('Repair', 'Popravak')}</option><option value="inspection">${t('Inspection', 'Pregled')}</option><option value="upgrade">${t('Upgrade', 'Nadogradnja')}</option><option value="transfer">${t('Transfer', 'Prijenos')}</option></select></label><label>${t('Date', 'Datum')}<input name="occurredOn" type="date" required></label></div><label>${t('Work completed', 'Izvršeni rad')}<input name="title" required maxlength="180"></label><label>${t('Cost · EUR', 'Trošak · EUR')}<input name="cost" type="number" min="0" step="0.01"></label><label>${t('Internal note', 'Interna bilješka')}<textarea name="notes" maxlength="1500"></textarea></label><label class="cl95-check"><input name="isPublic" type="checkbox" checked> ${t('Allow this event in public Passport QR history', 'Dopusti ovaj zapis u javnoj povijesti QR-a putovnice')}</label><button>${t('Add verified history', 'Dodaj verificiranu povijest')}</button><small data-cl95-history-message></small></form>
      </div><div class="cl95-grid lists"><section class="cl95-card"><h3>${t('Active alerts', 'Aktivna upozorenja')}</h3><div id="cl95Alerts" class="cl95-list"></div></section><section class="cl95-card"><h3>${t('Recent service history', 'Nedavna servisna povijest')}</h3><div id="cl95History" class="cl95-list"></div></section></div></div>
      <div data-cl95-panel="assets" hidden><div class="cl95-grid">
        <form id="cl95AssetForm" class="cl95-card"><span class="cl95-kicker">${t('B2B PASSPORT', 'B2B PUTOVNICA')}</span><h3>${t('Track what your business depends on.', 'Pratite ono o čemu vaše poslovanje ovisi.')}</h3><label>${t('Asset name', 'Naziv imovine')}<input name="title" required maxlength="180"></label><div class="cl95-fields"><label>${t('Category', 'Kategorija')}<select name="category"><option value="asset">${t('Equipment', 'Oprema')}</option><option value="license">${t('Software licence', 'Softverska licenca')}</option><option value="rental">${t('Rental', 'Najam')}</option><option value="contract">${t('Contract', 'Ugovor')}</option><option value="vendor">${t('Vendor service', 'Usluga dobavljača')}</option></select></label><label>${t('Supplier', 'Dobavljač')}<input name="supplier" maxlength="160"></label><label>${t('Contract/reference', 'Ugovor/referenca')}<input name="reference" maxlength="120"></label><label>${t('Seats / quantity', 'Licence / količina')}<input name="seats" type="number" min="0"></label><label>${t('Renewal date', 'Datum obnove')}<input name="renewalAt" type="date"></label><label>${t('Maintenance date', 'Datum održavanja')}<input name="maintenanceAt" type="date"></label><label>${t('Cost · EUR', 'Trošak · EUR')}<input name="cost" type="number" min="0" step="0.01"></label></div><label>${t('Private operational notes', 'Privatne operativne bilješke')}<textarea name="notes" maxlength="1500"></textarea></label><button>${t('Create business passport', 'Izradi poslovnu putovnicu')}</button><small data-cl95-asset-message></small></form>
        <section class="cl95-card"><span class="cl95-kicker">${t('ASSET TIMELINE', 'VREMENSKA CRTA IMOVINE')}</span><h3>${t('Renewals and maintenance in one queue.', 'Obnove i održavanje u jednom redu.')}</h3><div id="cl95Assets" class="cl95-list"></div></section>
      </div></div>
    </section>`;
  }

  function mount() {
    if ($('#companyLifecycleV95') || !document.body.classList.contains('company-authenticated')) return;
    root = document.createElement('div'); root.innerHTML = shell(); root = root.firstElementChild;
    const anchor = $('#companyPassportStudioV83') || $('#companyPortalV46');
    anchor?.insertAdjacentElement('afterend', root);
    if (!root.isConnected) return;
    bind(); switchTab(activeTab); load();
  }

  function bind() {
    root.addEventListener('click', click);
    root.addEventListener('change', change);
    $('#cl95TemplateForm', root).addEventListener('submit', createTemplate);
    $('#cl95ApplyForm', root).addEventListener('submit', applyTemplate);
    $('#cl95AlertForm', root).addEventListener('submit', createAlert);
    $('#cl95HistoryForm', root).addEventListener('submit', createHistory);
    $('#cl95AssetForm', root).addEventListener('submit', createAsset);
  }

  async function load() {
    root.setAttribute('aria-busy', 'true');
    try { data = await api('/api/v1/business/lifecycle/dashboard'); render(); }
    catch (error) { root.querySelector('[data-cl95-panel="promises"]').innerHTML = `<div class="cl95-card cl95-empty"><b>${t('Lifecycle tools are temporarily unavailable.', 'Alati životnog ciklusa trenutačno nisu dostupni.')}</b><p>${error.status === 403 ? t('Company verification is required.', 'Potrebna je verifikacija tvrtke.') : t('Existing company tools remain available.', 'Postojeći alati tvrtke ostaju dostupni.')}</p><button data-cl95-retry>${t('Try again', 'Pokušaj ponovno')}</button></div>`; }
    finally { root.removeAttribute('aria-busy'); }
  }

  function render() {
    renderScore(); renderTemplates(); renderCommitments(); renderThreads(); renderAlerts(); renderHistory(); renderAssets(); refreshSelects();
  }

  function refreshSelects() {
    root.querySelectorAll('select[name="passport"]').forEach(select => { const current = select.value; select.innerHTML = passportOptions(); if ([...select.options].some(option => option.value === current)) select.value = current; });
  }

  function renderScore() {
    const item = data.reputation || {};
    $('#cl95Score', root).innerHTML = `<strong>${Number(item.score ?? 50)}</strong><div><b>${t('Outcome reputation', 'Reputacija ishoda')}</b><span>${Number(item.completed || 0)} ${t('completed promises', 'ispunjenih obećanja')}</span><small>${Number(item.missed || 0)} ${t('missed', 'propušteno')} · ${Number(item.disputed || 0)} ${t('disputed', 'osporeno')} · ${Number(item.resolvedThreads || 0)} ${t('support threads resolved', 'razgovora riješeno')}</small></div>`;
  }

  function renderTemplates() {
    const select = $('#cl95ApplyForm [name="template"]', root);
    select.innerHTML = data.templates.length ? data.templates.map(item => `<option value="${esc(item.publicId)}">${esc(item.name)} · ${item.defaultDays}d</option>`).join('') : `<option value="">${t('Create a template first', 'Najprije izradite predložak')}</option>`;
    $('#cl95Templates', root).innerHTML = data.templates.length ? data.templates.map(item => `<article><div><b>${esc(item.name)}</b><span>${esc(item.title)}</span></div><em>${esc(item.type)} · ${item.defaultDays}d</em></article>`).join('') : empty(t('No promise templates yet.', 'Još nema predložaka obećanja.'));
  }

  function renderCommitments() {
    $('#cl95Commitments', root).innerHTML = data.commitments.length ? data.commitments.slice(0, 30).map(item => `<article class="asset"><div><b>${esc(item.title)}</b><span>${esc(item.passportTitle)}${item.dueAt ? ` · ${dateText(item.dueAt)}` : ''}</span></div><select data-cl95-commitment-status="${esc(item.publicId)}"><option value="promised" ${item.status === 'promised' ? 'selected' : ''}>${t('Promised', 'Obećano')}</option><option value="in_progress" ${item.status === 'in_progress' ? 'selected' : ''}>${t('In progress', 'U tijeku')}</option><option value="completed" ${item.status === 'completed' ? 'selected' : ''}>${t('Completed', 'Ispunjeno')}</option><option value="missed" ${item.status === 'missed' ? 'selected' : ''}>${t('Missed', 'Propušteno')}</option><option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>${t('Cancelled', 'Otkazano')}</option><option value="disputed" ${item.status === 'disputed' ? 'selected' : ''}>${t('Disputed', 'Osporeno')}</option></select></article>`).join('') : empty(t('No active promises yet.', 'Još nema aktivnih obećanja.'));
  }

  function renderThreads() {
    $('#cl95Threads', root).innerHTML = data.threads.length ? data.threads.map(item => `<button data-cl95-thread="${esc(item.publicId)}"><span><b>${esc(item.subject)}</b><small>${esc(item.passportTitle)} · ${item.messageCount} ${t('messages', 'poruka')}</small></span><em>${esc(item.status)}</em></button>`).join('') : empty(t('No passport support requests yet.', 'Još nema zahtjeva podrške putovnice.'));
  }

  function renderAlerts() {
    $('#cl95Alerts', root).innerHTML = data.alerts.length ? data.alerts.slice(0, 20).map(item => `<article><div><b>${esc(item.title)}</b><span>${esc(item.passportTitle)} · ${esc(item.detail)}</span></div><em class="${esc(item.severity)}">${esc(item.severity)}</em></article>`).join('') : empty(t('No alerts issued.', 'Nema izdanih upozorenja.'));
  }

  function renderHistory() {
    $('#cl95History', root).innerHTML = data.history.length ? data.history.slice(0, 20).map(item => `<article><div><b>${esc(item.title)}</b><span>${esc(item.passportTitle)} · ${dateText(item.occurredOn)}</span></div><em>${item.isPublic ? t('QR public', 'Javno u QR-u') : t('Private', 'Privatno')}</em></article>`).join('') : empty(t('No service history yet.', 'Još nema servisne povijesti.'));
  }

  function renderAssets() {
    $('#cl95Assets', root).innerHTML = data.assets.length ? data.assets.map(item => `<article class="asset"><div><b>${esc(item.title)}</b><span>${esc(item.category)}${item.supplier ? ` · ${esc(item.supplier)}` : ''}</span><small>${item.renewalAt ? `${t('Renewal', 'Obnova')} ${dateText(item.renewalAt)}` : ''}${item.maintenanceAt ? ` · ${t('Maintenance', 'Održavanje')} ${dateText(item.maintenanceAt)}` : ''}${item.costCents ? ` · ${money(item.costCents, item.currency)}` : ''}</small></div><select data-cl95-asset-status="${esc(item.publicId)}"><option value="active" ${item.status === 'active' ? 'selected' : ''}>${t('Active', 'Aktivno')}</option><option value="paused" ${item.status === 'paused' ? 'selected' : ''}>${t('Paused', 'Pauzirano')}</option><option value="retired" ${item.status === 'retired' ? 'selected' : ''}>${t('Retired', 'Umirovljeno')}</option></select></article>`).join('') : empty(t('No business assets yet.', 'Još nema poslovne imovine.'));
  }

  function empty(text) { return `<div class="cl95-empty"><b>${esc(text)}</b></div>`; }

  function switchTab(tab) {
    activeTab = tab;
    root.querySelectorAll('[data-cl95-tab]').forEach(button => button.classList.toggle('active', button.dataset.cl95Tab === tab));
    root.querySelectorAll('[data-cl95-panel]').forEach(panel => { panel.hidden = panel.dataset.cl95Panel !== tab; });
  }

  async function click(event) {
    const tab = event.target.closest('[data-cl95-tab]'); if (tab) return switchTab(tab.dataset.cl95Tab);
    if (event.target.closest('[data-cl95-retry]')) return location.reload();
    const thread = event.target.closest('[data-cl95-thread]'); if (thread) return openThread(thread.dataset.cl95Thread);
  }

  function change(event) {
    const status = event.target.closest('[data-cl95-asset-status]');
    if (status) updateAsset(status);
    const commitment = event.target.closest('[data-cl95-commitment-status]');
    if (commitment) updateCommitment(commitment);
  }

  async function createTemplate(event) { await submit(event, '/api/v1/business/lifecycle/templates', '[data-cl95-template-message]', values => ({ ...values, isPublic: values.isPublic === 'on' })); }
  async function applyTemplate(event) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); const message = $('[data-cl95-apply-message]', event.currentTarget);
    if (!values.passport || !values.template) return message.textContent = t('Choose both a passport and template.', 'Odaberite putovnicu i predložak.');
    await send(`/api/v1/business/lifecycle/passports/${encodeURIComponent(values.passport)}/templates/${encodeURIComponent(values.template)}/apply`, {}, message, event.currentTarget);
  }
  async function createAlert(event) { const form = event.currentTarget; const values = Object.fromEntries(new FormData(form)); const message = $('[data-cl95-alert-message]', form); if (!values.passport) return; await send(`/api/v1/business/lifecycle/passports/${encodeURIComponent(values.passport)}/alerts`, values, message, form); }
  async function createHistory(event) { const form = event.currentTarget; const values = Object.fromEntries(new FormData(form)); values.costCents = Math.round(Number(values.cost || 0) * 100); values.isPublic = values.isPublic === 'on'; const message = $('[data-cl95-history-message]', form); if (!values.passport) return; await send(`/api/v1/business/lifecycle/passports/${encodeURIComponent(values.passport)}/history`, values, message, form); }
  async function createAsset(event) { await submit(event, '/api/v1/business/lifecycle/assets', '[data-cl95-asset-message]', values => ({ ...values, costCents: Math.round(Number(values.cost || 0) * 100), currency: 'EUR' })); }

  async function submit(event, path, messageSelector, transform = value => value) {
    event.preventDefault(); const form = event.currentTarget; const message = $(messageSelector, form); const values = transform(Object.fromEntries(new FormData(form))); await send(path, values, message, form);
  }

  async function send(path, body, message, form) {
    const button = $('button[type="submit"],button:not([type])', form); button.disabled = true; message.textContent = t('Saving…', 'Spremanje…');
    try { await api(path, { method: 'POST', body: JSON.stringify(body) }); form.reset(); message.textContent = t('Saved ✓', 'Spremljeno ✓'); await load(); }
    catch { message.textContent = t('Could not save this update.', 'Nije moguće spremiti ovu promjenu.'); }
    finally { button.disabled = false; }
  }

  async function openThread(publicId) {
    activeThread = publicId; const host = $('#cl95ThreadDetail', root); host.innerHTML = `<div class="cl95-empty">${t('Loading conversation…', 'Učitavanje razgovora…')}</div>`;
    try {
      const result = await api(`/api/v1/business/lifecycle/support/${encodeURIComponent(publicId)}`);
      host.innerHTML = `<header class="cl95-thread-head"><div><span class="cl95-kicker">${t('PASSPORT SUPPORT', 'PODRŠKA PUTOVNICE')}</span><h3>${esc(result.thread.subject)}</h3><small>${esc(result.thread.passportTitle)} · ${esc(result.thread.status)}</small></div><button data-cl95-resolve>${t('Mark resolved', 'Označi riješenim')}</button></header><div class="cl95-messages">${result.messages.map(item => `<article class="${esc(item.author_type)}"><b>${item.author_type === 'company' ? t('Your team', 'Vaš tim') : t('Buyer', 'Kupac')}</b><p>${esc(item.body)}</p><time>${new Date(item.created_at).toLocaleString(isHr() ? 'hr-HR' : 'en-GB')}</time></article>`).join('')}</div><form id="cl95Reply"><label>${t('Reply', 'Odgovor')}<textarea name="message" required maxlength="3000"></textarea></label><button>${t('Send reply', 'Pošalji odgovor')}</button><small></small></form>`;
      $('#cl95Reply', host).onsubmit = reply;
      $('[data-cl95-resolve]', host).onclick = resolveThread;
    } catch { host.innerHTML = empty(t('Could not load this conversation.', 'Nije moguće učitati razgovor.')); }
  }

  async function reply(event) { event.preventDefault(); const form = event.currentTarget; const message = $('small', form); try { await api(`/api/v1/business/lifecycle/support/${encodeURIComponent(activeThread)}`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); await openThread(activeThread); await load(); } catch { message.textContent = t('Reply could not be sent.', 'Odgovor nije moguće poslati.'); } }
  async function resolveThread() { try { await api(`/api/v1/business/lifecycle/support/${encodeURIComponent(activeThread)}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) }); await load(); await openThread(activeThread); } catch {} }
  async function updateAsset(select) { try { await api(`/api/v1/business/lifecycle/assets/${encodeURIComponent(select.dataset.cl95AssetStatus)}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); await load(); } catch {} }
  async function updateCommitment(select) { try { await api(`/api/v1/business/lifecycle/commitments/${encodeURIComponent(select.dataset.cl95CommitmentStatus)}`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); await load(); } catch {} }

  window.addEventListener('still:company-authenticated', () => setTimeout(mount, 160));
  setTimeout(mount, 160);
})();
