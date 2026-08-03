(() => {
  const PASSPORT_KEY = 'still-ownership-passports-v83';
  const LOCAL_ACTION_KEY = 'still-lifecycle-actions-v95';
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const readJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
  const writeJson = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const passports = () => { const value = readJson(PASSPORT_KEY, []); return Array.isArray(value) ? value : []; };
  const formatDate = value => value ? new Intl.DateTimeFormat(isHr() ? 'hr-HR' : 'en-GB', { dateStyle: 'medium' }).format(new Date(`${value}T12:00:00`)) : '';
  const money = cents => new Intl.NumberFormat(isHr() ? 'hr-HR' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(Number(cents || 0) / 100);
  let root;
  let remote = { authenticated: false, events: [], history: [], alerts: [], recalls: [], threads: [], reputations: [] };
  let activeTab = 'inbox';
  let activeFilter = 'open';

  async function api(path, options = {}) {
    const response = await fetch(path, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || `HTTP ${response.status}`), { status: response.status, data });
    return data;
  }

  function localEvents() {
    const actions = readJson(LOCAL_ACTION_KEY, {});
    const fields = [
      ['returnBy', 'return', t('Return or cancellation deadline', 'Rok za povrat ili otkazivanje')],
      ['nextActionAt', 'maintenance', t('Maintenance or next action', 'Održavanje ili sljedeća radnja')],
      ['renewalAt', 'renewal', t('Renewal or next payment', 'Obnova ili sljedeće plaćanje')],
      ['warrantyUntil', 'warranty', t('Warranty or guarantee ending', 'Završetak jamstva')]
    ];
    return passports().flatMap(passport => {
      const identity = passport.publicId || passport.id;
      const dates = fields.filter(([field]) => passport[field]).map(([field, type, title]) => ({ key: `${type}:${identity}`, type, title, date: passport[field], passportPublicId: passport.publicId || null, localPassportId: passport.id, passportTitle: passport.title, businessName: passport.business || null, status: actions[`${type}:${identity}`]?.status || 'open', snoozedUntil: actions[`${type}:${identity}`]?.snoozedUntil || null, local: !passport.publicId }));
      const commitments = (passport.commitments || []).filter(item => item.dueAt && ['promised', 'in_progress'].includes(item.status)).map(item => ({ key: `commitment:${item.publicId || `${identity}:${item.title}`}`, type: 'commitment', title: item.title, date: item.dueAt, passportPublicId: passport.publicId || null, localPassportId: passport.id, passportTitle: passport.title, businessName: passport.business || null, status: actions[`commitment:${item.publicId || `${identity}:${item.title}`}`]?.status || 'open', local: !passport.publicId }));
      return [...dates, ...commitments];
    });
  }

  function mergedEvents() {
    const serverKeys = new Set(remote.events.map(item => item.key));
    return [...remote.events, ...localEvents().filter(item => !serverKeys.has(item.key))].sort((a, b) => a.date.localeCompare(b.date));
  }

  function shell() {
    return `<section class="lp95" id="lifecyclePlatformV95">
      <header class="lp95-head">
        <div><span class="lp95-kicker">${t('LIFECYCLE HOME', 'ŽIVOTNI CIKLUS')}</span><h2>${t('Useful before, during and after every purchase.', 'Korisno prije, tijekom i nakon svake kupnje.')}</h2><p>${t('One calm place for deadlines, service history, verified support, safety alerts and the real long-term cost.', 'Jedno pregledno mjesto za rokove, servisnu povijest, verificiranu podršku, sigurnosna upozorenja i stvarni dugoročni trošak.')}</p></div>
        <div class="lp95-promise"><b>${t('Not another webshop', 'Nije još jedan webshop')}</b><span>${t('Still? follows the relationship and promises after the seller receives payment.', 'Still? prati odnos i obećanja nakon što prodavatelj primi uplatu.')}</span></div>
      </header>
      <nav class="lp95-tabs" aria-label="${t('Lifecycle tools', 'Alati životnog ciklusa')}">
        <button data-lp95-tab="inbox">◷ <span>${t('My next actions', 'Moje sljedeće radnje')}</span></button>
        <button data-lp95-tab="history">↻ <span>${t('History & support', 'Povijest i podrška')}</span></button>
        <button data-lp95-tab="cost">◎ <span>${t('True cost & repair', 'Stvarni trošak i popravak')}</span></button>
      </nav>
      <div id="lp95Inbox" data-lp95-panel="inbox">
        <div class="lp95-toolbar"><div id="lp95Counts"></div><button data-lp95-refresh>${t('Refresh account', 'Osvježi račun')}</button></div>
        <div id="lp95Alerts"></div>
        <div class="lp95-filter" role="group" aria-label="${t('Filter actions', 'Filtriraj radnje')}"><button data-lp95-filter="open">${t('Open', 'Otvoreno')}</button><button data-lp95-filter="all">${t('All', 'Sve')}</button><button data-lp95-filter="done">${t('Done', 'Dovršeno')}</button></div>
        <div id="lp95Events" class="lp95-events"></div>
        <div id="lp95Reputation"></div>
      </div>
      <div id="lp95HistoryPanel" data-lp95-panel="history" hidden>
        <div class="lp95-two">
          <section class="lp95-card"><span class="lp95-kicker">${t('SERVICE HISTORY', 'SERVISNA POVIJEST')}</span><h3>${t('Keep value, proof and continuity.', 'Sačuvaj vrijednost, dokaz i kontinuitet.')}</h3><p>${t('Record maintenance, repair, inspection or upgrades. Only entries marked public can appear in a Passport QR.', 'Zabilježi održavanje, popravak, pregled ili nadogradnju. Samo zapisi označeni javnima mogu se prikazati u QR-u putovnice.')}</p><form id="lp95HistoryForm">${passportSelect('historyPassport')}<div class="lp95-form-grid"><label>${t('Type', 'Vrsta')}<select name="type"><option value="service">${t('Service', 'Servis')}</option><option value="repair">${t('Repair', 'Popravak')}</option><option value="inspection">${t('Inspection', 'Pregled')}</option><option value="upgrade">${t('Upgrade', 'Nadogradnja')}</option><option value="transfer">${t('Ownership transfer', 'Prijenos vlasništva')}</option></select></label><label>${t('Date', 'Datum')}<input name="occurredOn" type="date" required></label></div><label>${t('What happened?', 'Što se dogodilo?')}<input name="title" required maxlength="180"></label><div class="lp95-form-grid"><label>${t('Provider', 'Izvršitelj')}<input name="providerName" maxlength="160"></label><label>${t('Cost in EUR', 'Trošak u EUR')}<input name="cost" type="number" min="0" step="0.01" inputmode="decimal"></label></div><label>${t('Private details', 'Privatni detalji')}<textarea name="notes" maxlength="1500"></textarea></label><label class="lp95-check"><input name="isPublic" type="checkbox"> ${t('Allow this event in public Passport QR history', 'Dopusti ovaj zapis u javnoj povijesti QR-a putovnice')}</label><button>${t('Add history event', 'Dodaj zapis povijesti')}</button><small data-lp95-history-message></small></form></section>
          <section class="lp95-card"><span class="lp95-kicker">${t('VERIFIED SUPPORT', 'VERIFICIRANA PODRŠKA')}</span><h3>${t('One thread, the right company, a visible status.', 'Jedna poruka, prava tvrtka, vidljiv status.')}</h3><p>${t('Support opens only for a synced passport connected to a verified business. The conversation stays attached to that record.', 'Podrška se otvara samo za sinkroniziranu putovnicu povezanu s verificiranom tvrtkom. Razgovor ostaje vezan uz taj zapis.')}</p><form id="lp95SupportForm">${passportSelect('supportPassport', true)}<label>${t('Subject', 'Predmet')}<input name="subject" maxlength="160" placeholder="${t('Repair, delivery, renewal…', 'Popravak, isporuka, obnova…')}"></label><label>${t('Message', 'Poruka')}<textarea name="message" required maxlength="3000"></textarea></label><button>${t('Send to connected company', 'Pošalji povezanoj tvrtki')}</button><small data-lp95-support-message></small></form><div id="lp95Thread" class="lp95-thread"></div></section>
        </div>
        <section class="lp95-card lp95-history-list"><div><span class="lp95-kicker">${t('HISTORY', 'POVIJEST')}</span><h3>${t('Your service timeline', 'Tvoja servisna vremenska crta')}</h3></div><div id="lp95HistoryList"></div></section>
      </div>
      <div id="lp95CostPanel" data-lp95-panel="cost" hidden>
        <div class="lp95-two">
          <form id="lp95CostForm" class="lp95-card"><span class="lp95-kicker">${t('BEFORE BUYING', 'PRIJE KUPNJE')}</span><h3>${t('Calculate the cost beyond the price tag.', 'Izračunaj trošak izvan cijene na etiketi.')}</h3><label>${t('What are you comparing?', 'Što uspoređuješ?')}<input name="title" required maxlength="120"></label><div class="lp95-form-grid"><label>${t('Purchase price · EUR', 'Kupovna cijena · EUR')}<input name="price" type="number" min="0" step="0.01" required></label><label>${t('Years you expect to use it', 'Očekivane godine korištenja')}<input name="years" type="number" min="1" max="30" value="5" required></label><label>${t('Recurring cost · monthly', 'Ponavljajući mjesečni trošak')}<input name="monthly" type="number" min="0" step="0.01"></label><label>${t('Maintenance · yearly', 'Godišnje održavanje')}<input name="maintenance" type="number" min="0" step="0.01"></label><label>${t('Expected resale value', 'Očekivana prodajna vrijednost')}<input name="resale" type="number" min="0" step="0.01"></label><label>${t('Parts available for', 'Dijelovi dostupni')}<select name="parts"><option value="0">${t('Unknown', 'Nepoznato')}</option><option value="3">3 ${t('years', 'godine')}</option><option value="5">5 ${t('years', 'godina')}</option><option value="10">10+ ${t('years', 'godina')}</option></select></label><label>${t('Repair route', 'Put popravka')}<select name="repair"><option value="0">${t('Unknown', 'Nepoznato')}</option><option value="1">${t('Available', 'Dostupan')}</option><option value="-1">${t('Not offered', 'Nije ponuđen')}</option></select></label><label>${t('Written cancellation/warranty terms', 'Pisani uvjeti otkazivanja/jamstva')}<select name="terms"><option value="0">${t('Unknown', 'Nepoznato')}</option><option value="1">${t('Yes', 'Da')}</option><option value="-1">${t('No', 'Ne')}</option></select></label></div><button>${t('Calculate true cost', 'Izračunaj stvarni trošak')}</button></form>
          <section id="lp95CostResult" class="lp95-card lp95-cost-result"><span>◎</span><h3>${t('Your ownership brief appears here.', 'Sažetak vlasništva pojavit će se ovdje.')}</h3><p>${t('Still? combines acquisition, recurring costs, maintenance, resale and repair readiness.', 'Still? spaja kupnju, ponavljajuće troškove, održavanje, preprodaju i spremnost na popravak.')}</p></section>
        </div>
      </div>
    </section>`;
  }

  function passportSelect(name, connectedOnly = false) {
    const items = passports().filter(item => !connectedOnly || (item.publicId && item.connection === 'company'));
    return `<label>${t('Passport', 'Putovnica')}<select name="${name}" ${items.length ? '' : 'disabled'}>${items.map(item => `<option value="${esc(item.id)}">${esc(item.title)}${item.business ? ` · ${esc(item.business)}` : ''}</option>`).join('') || `<option>${t('Create or sync a passport first', 'Najprije izradi ili sinkroniziraj putovnicu')}</option>`}</select></label>`;
  }

  function mount() {
    if (document.body.classList.contains('business-page') || $('#lifecyclePlatformV95')) return;
    const ownership = $('#ownershipHubV83');
    if (!ownership) return setTimeout(mount, 120);
    root = document.createElement('section');
    root.innerHTML = shell();
    const platform = root.firstElementChild;
    ownership.insertAdjacentElement('afterend', platform);
    root = platform;
    bind();
    switchTab(activeTab);
    renderAll();
    loadRemote();
  }

  function bind() {
    root.addEventListener('click', click);
    $('#lp95HistoryForm', root)?.addEventListener('submit', addHistory);
    $('#lp95SupportForm', root)?.addEventListener('submit', sendSupport);
    $('#lp95CostForm', root)?.addEventListener('submit', calculateCost);
    $('[name="supportPassport"]', root)?.addEventListener('change', loadThread);
  }

  function switchTab(tab) {
    activeTab = tab;
    root.querySelectorAll('[data-lp95-tab]').forEach(button => button.classList.toggle('active', button.dataset.lp95Tab === tab));
    root.querySelectorAll('[data-lp95-panel]').forEach(panel => { panel.hidden = panel.dataset.lp95Panel !== tab; });
  }

  async function loadRemote() {
    const refresh = $('[data-lp95-refresh]', root);
    if (refresh) refresh.disabled = true;
    try {
      remote = { authenticated: true, ...await api('/api/v1/lifecycle/dashboard') };
    } catch (error) {
      remote = { ...remote, authenticated: false, unavailable: error.status !== 401 };
    } finally {
      if (refresh) refresh.disabled = false;
      renderAll();
      if (activeTab === 'history') loadThread();
    }
  }

  function renderAll() {
    renderCounts(); renderAlerts(); renderEvents(); renderHistory(); renderReputation();
  }

  function renderCounts() {
    const all = mergedEvents();
    const today = new Date().toISOString().slice(0, 10);
    const open = all.filter(item => item.status !== 'done' && (!item.snoozedUntil || item.snoozedUntil <= today));
    $('#lp95Counts', root).innerHTML = `<span><b>${open.length}</b>${t('open', 'otvoreno')}</span><span><b>${open.filter(item => item.date <= today).length}</b>${t('due now', 'dospjelo')}</span><span><b>${(remote.alerts?.length || 0)+(remote.recalls?.length || 0)}</b>${t('alerts', 'upozorenja')}</span>`;
  }

  function renderAlerts() {
    const host = $('#lp95Alerts', root);
    const recalls = remote.recalls || [], recallTitles = new Set(recalls.map(item => `${item.passport_public_id}:${item.title}`));
    const alerts = (remote.alerts || []).filter(item => !recallTitles.has(`${item.passportPublicId}:${item.title}`));
    if (!alerts.length && !recalls.length) return host.innerHTML = '';
    const recallCards = recalls.map(item => `<article class="${esc(item.severity)} recall"><span>!</span><div><b>${esc(item.title)}</b><small>${esc(item.passport_title)} · ${esc(item.business_name || '')} · ${t('Product recall','Opoziv proizvoda')}</small><p>${esc(item.detail)}</p><div class="lp95-alert-actions">${item.action_url ? `<a href="${esc(item.action_url)}" target="_blank" rel="noopener noreferrer">${t('Open official action →', 'Otvori službenu radnju →')}</a>` : ''}${item.delivery_status === 'delivered' ? `<button data-lp95-recall="${esc(item.public_id)}">${t('I have read this','Pročitao/la sam')}</button>` : `<em>✓ ${t('Acknowledged','Potvrđeno')}</em>`}</div></div></article>`).join('');
    const alertCards = alerts.map(item => `<article class="${esc(item.severity)}"><span>${item.severity === 'critical' ? '!' : item.severity === 'warning' ? '△' : 'i'}</span><div><b>${esc(item.title)}</b><small>${esc(item.passportTitle)} · ${esc(item.businessName || '')}</small><p>${esc(item.detail)}</p>${item.actionUrl ? `<a href="${esc(item.actionUrl)}" target="_blank" rel="noopener noreferrer">${t('Open official action →', 'Otvori službenu radnju →')}</a>` : ''}</div></article>`).join('');
    host.innerHTML = `<section class="lp95-alerts"><div><span class="lp95-kicker">${t('SAFETY & SERVICE ALERTS', 'SIGURNOSNA I SERVISNA UPOZORENJA')}</span><h3>${t('Updates matched to your passports', 'Obavijesti povezane s tvojim putovnicama')}</h3></div>${recallCards}${alertCards}</section>`;
  }

  function effectiveStatus(item) {
    if (item.status === 'done') return 'done';
    const today = new Date().toISOString().slice(0, 10);
    if (item.status === 'snoozed' && item.snoozedUntil && item.snoozedUntil > today) return 'snoozed';
    return 'open';
  }

  function renderEvents() {
    const host = $('#lp95Events', root);
    const all = mergedEvents();
    const shown = all.filter(item => activeFilter === 'all' || effectiveStatus(item) === activeFilter);
    root.querySelectorAll('[data-lp95-filter]').forEach(button => button.classList.toggle('active', button.dataset.lp95Filter === activeFilter));
    if (!shown.length) return host.innerHTML = `<div class="lp95-empty"><b>${t('Nothing in this view.', 'Nema stavki u ovom prikazu.')}</b><p>${t('Dates from your passports become one ordered action queue.', 'Datumi iz tvojih putovnica postaju jedan red radnji.')}</p></div>`;
    const today = new Date().toISOString().slice(0, 10);
    host.innerHTML = shown.map(item => {
      const state = effectiveStatus(item);
      const urgency = item.date < today ? 'late' : item.date === today ? 'today' : '';
      return `<article class="lp95-event ${state} ${urgency}"><time><b>${formatDate(item.date)}</b><span>${urgency === 'late' ? t('Past due', 'Rok prošao') : urgency === 'today' ? t('Today', 'Danas') : item.type}</span></time><div><b>${esc(item.title)}</b><span>${esc(item.passportTitle)}${item.businessName ? ` · ${esc(item.businessName)}` : ''}</span>${state === 'snoozed' ? `<small>${t('Snoozed until', 'Odgođeno do')} ${formatDate(item.snoozedUntil)}</small>` : ''}</div><div class="lp95-event-actions">${state === 'done' ? `<button data-lp95-action="open" data-event="${esc(item.key)}">${t('Reopen', 'Ponovno otvori')}</button>` : `<button class="done" data-lp95-action="done" data-event="${esc(item.key)}">✓ ${t('Done', 'Dovršeno')}</button><button data-lp95-action="snoozed" data-event="${esc(item.key)}">+7 ${t('days', 'dana')}</button>`}</div></article>`;
    }).join('');
  }

  function renderHistory() {
    const host = $('#lp95HistoryList', root);
    const local = passports().flatMap(passport => (passport.serviceHistory || []).map(item => ({ ...item, passportTitle: passport.title, local: true })));
    const remoteIds = new Set((remote.history || []).map(item => item.publicId));
    const all = [...(remote.history || []), ...local.filter(item => !remoteIds.has(item.publicId))].sort((a, b) => String(b.occurredOn).localeCompare(String(a.occurredOn)));
    host.innerHTML = all.length ? all.map(item => `<article><time>${formatDate(item.occurredOn)}</time><div><b>${esc(item.title)}</b><span>${esc(item.passportTitle || '')}${item.providerName ? ` · ${esc(item.providerName)}` : ''}</span></div><em>${item.isPublic ? t('QR public', 'Javno u QR-u') : t('Private', 'Privatno')}</em></article>`).join('') : `<div class="lp95-empty"><b>${t('No service events yet.', 'Još nema servisnih zapisa.')}</b><p>${t('Add the first repair, inspection or upgrade above.', 'Dodaj prvi popravak, pregled ili nadogradnju iznad.')}</p></div>`;
  }

  function renderReputation() {
    const host = $('#lp95Reputation', root);
    if (!remote.reputations?.length) return host.innerHTML = '';
    host.innerHTML = `<section class="lp95-reputation"><div><span class="lp95-kicker">${t('EARNED REPUTATION', 'ZASLUŽENA REPUTACIJA')}</span><h3>${t('Based on fulfilled promises—not paid placement.', 'Temeljeno na ispunjenim obećanjima, ne plaćenom poretku.')}</h3></div><div class="lp95-reputation-grid">${remote.reputations.map(item => `<article><strong>${Number(item.score)}</strong><div><b>${item.verified ? '✓ ' : ''}${esc(item.name)}</b><span>${item.completed} ${t('completed', 'ispunjeno')} · ${item.missed} ${t('missed', 'propušteno')} · ${item.disputed} ${t('disputed', 'osporeno')}</span><small>${t('Visible sample', 'Vidljivi uzorak')}: ${item.outcomeSample} ${t('outcomes', 'ishoda')}</small></div></article>`).join('')}</div></section>`;
  }

  async function click(event) {
    const tab = event.target.closest('[data-lp95-tab]');
    if (tab) return switchTab(tab.dataset.lp95Tab);
    const filter = event.target.closest('[data-lp95-filter]');
    if (filter) { activeFilter = filter.dataset.lp95Filter; return renderEvents(); }
    if (event.target.closest('[data-lp95-refresh]')) return loadRemote();
    const recall = event.target.closest('[data-lp95-recall]');
    if (recall) { recall.disabled = true; try { await api(`/api/v1/ops/recalls/${encodeURIComponent(recall.dataset.lp95Recall)}/ack`, { method:'POST', body:'{}' }); await loadRemote(); } catch { recall.disabled = false; } return; }
    const action = event.target.closest('[data-lp95-action]');
    if (action) return updateAction(action.dataset.event, action.dataset.lp95Action);
    const save = event.target.closest('[data-lp95-save-passport]');
    if (save) {
      const data = readJson('still-cost-brief-v95', null);
      const form = $('#passportFormV83');
      if (data && form) { form.title.value = data.title; form.notes.value = data.note; form.scrollIntoView({ behavior: 'smooth', block: 'start' }); form.title.focus(); }
    }
  }

  async function updateAction(key, status) {
    const snoozedUntil = status === 'snoozed' ? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) : null;
    const serverEvent = remote.events.find(item => item.key === key);
    if (serverEvent && remote.authenticated) {
      try { await api('/api/v1/lifecycle/actions', { method: 'POST', body: JSON.stringify({ eventKey: key, status, snoozedUntil }) }); serverEvent.status = status; serverEvent.snoozedUntil = snoozedUntil; } catch { return; }
    } else {
      const actions = readJson(LOCAL_ACTION_KEY, {}); actions[key] = { status, snoozedUntil }; writeJson(LOCAL_ACTION_KEY, actions);
    }
    renderCounts(); renderEvents();
  }

  async function addHistory(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const passport = passports().find(item => item.id === values.historyPassport);
    const message = $('[data-lp95-history-message]', form);
    if (!passport) return;
    const entry = { publicId: `LOCAL-HIS-${crypto.randomUUID()}`, type: values.type, title: values.title.trim(), providerName: values.providerName.trim(), occurredOn: values.occurredOn, costCents: Math.round(Number(values.cost || 0) * 100), notes: values.notes.trim(), isPublic: values.isPublic === 'on', createdBy: 'buyer', createdAt: new Date().toISOString() };
    message.textContent = t('Saving…', 'Spremanje…');
    try {
      if (passport.publicId) {
        await api(`/api/v1/lifecycle/passports/${encodeURIComponent(passport.publicId)}/history`, { method: 'POST', body: JSON.stringify(entry) });
        await loadRemote();
      } else {
        const all = passports(); const target = all.find(item => item.id === passport.id); target.serviceHistory = [entry, ...(target.serviceHistory || [])]; writeJson(PASSPORT_KEY, all); renderHistory();
      }
      form.reset(); message.textContent = t('History saved ✓', 'Povijest spremljena ✓');
    } catch (error) { message.textContent = error.status === 401 ? t('Sign in and sync this passport first.', 'Prijavi se i prvo sinkroniziraj ovu putovnicu.') : t('Could not save the history event.', 'Nije moguće spremiti zapis povijesti.'); }
  }

  async function sendSupport(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const passport = passports().find(item => item.id === values.supportPassport);
    const message = $('[data-lp95-support-message]', form);
    if (!passport?.publicId) return message.textContent = t('Choose a synced company passport.', 'Odaberi sinkroniziranu putovnicu tvrtke.');
    message.textContent = t('Sending…', 'Slanje…');
    try {
      await api(`/api/v1/lifecycle/passports/${encodeURIComponent(passport.publicId)}/support`, { method: 'POST', body: JSON.stringify({ subject: values.subject, message: values.message }) });
      form.message.value = ''; message.textContent = t('Sent to the connected company ✓', 'Poslano povezanoj tvrtki ✓'); await loadRemote(); await loadThread();
    } catch (error) { message.textContent = error.status === 409 ? t('This passport is not connected to a company.', 'Ova putovnica nije povezana s tvrtkom.') : error.status === 401 ? t('Buyer sign-in is required.', 'Potrebna je prijava kupca.') : t('Support is temporarily unavailable.', 'Podrška trenutačno nije dostupna.'); }
  }

  async function loadThread() {
    const select = $('[name="supportPassport"]', root);
    const passport = passports().find(item => item.id === select?.value);
    const host = $('#lp95Thread', root);
    if (!passport?.publicId) return host.innerHTML = '';
    try {
      const result = await api(`/api/v1/lifecycle/passports/${encodeURIComponent(passport.publicId)}/support`);
      host.innerHTML = result.thread ? `<header><b>${esc(result.thread.subject)}</b><span>${esc(result.thread.status)}</span></header>${result.messages.map(item => `<article class="${esc(item.author_type)}"><b>${item.author_type === 'buyer' ? t('You', 'Ti') : esc(passport.business || t('Company', 'Tvrtka'))}</b><p>${esc(item.body)}</p><time>${new Date(item.created_at).toLocaleString(isHr() ? 'hr-HR' : 'en-GB')}</time></article>`).join('')}` : '';
    } catch { host.innerHTML = ''; }
  }

  function calculateCost(event) {
    event.preventDefault();
    const value = Object.fromEntries(new FormData(event.currentTarget));
    const years = Math.max(1, Number(value.years || 1));
    const total = Number(value.price || 0) + Number(value.monthly || 0) * 12 * years + Number(value.maintenance || 0) * years - Number(value.resale || 0);
    const annual = total / years;
    const parts = Math.min(10, Number(value.parts || 0));
    const repairScore = Math.max(0, Math.min(100, Math.round(parts * 4 + (value.repair === '1' ? 35 : value.repair === '-1' ? 0 : 12) + (value.terms === '1' ? 25 : value.terms === '-1' ? 0 : 10))));
    const missing = [!Number(value.parts) && t('parts availability', 'dostupnost dijelova'), value.repair === '0' && t('repair route', 'put popravka'), value.terms === '0' && t('written terms', 'pisane uvjete')].filter(Boolean);
    const note = `${t('Still? true-cost brief', 'Still? sažetak stvarnog troška')}: ${money(Math.round(total * 100))} / ${years} ${t('years', 'godina')}; ${t('repair readiness', 'spremnost na popravak')} ${repairScore}/100.${missing.length ? ` ${t('Verify', 'Provjeri')}: ${missing.join(', ')}.` : ''}`;
    writeJson('still-cost-brief-v95', { title: value.title, note });
    $('#lp95CostResult', root).innerHTML = `<span class="lp95-score">${repairScore}<small>/100</small></span><span class="lp95-kicker">${t('REPAIR READINESS', 'SPREMNOST NA POPRAVAK')}</span><h3>${esc(value.title)}</h3><div class="lp95-cost-numbers"><div><small>${t('Estimated true cost', 'Procijenjeni stvarni trošak')}</small><b>${money(Math.round(total * 100))}</b></div><div><small>${t('Average per year', 'Prosječno godišnje')}</small><b>${money(Math.round(annual * 100))}</b></div></div><p>${missing.length ? `${t('Before paying, verify', 'Prije plaćanja provjeri')}: ${esc(missing.join(', '))}.` : t('The core ownership questions have clear answers. Keep written evidence.', 'Ključna pitanja vlasništva imaju jasne odgovore. Sačuvaj pisane dokaze.')}</p><button data-lp95-save-passport>${t('Save as a passport brief', 'Spremi kao sažetak putovnice')}</button>`;
  }

  function remount() {
    const previous = activeTab;
    root?.remove(); root = null; activeTab = previous; setTimeout(mount, 0);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
  window.addEventListener('still:language', remount);
  window.addEventListener('still:commerce-paid', () => { renderAll(); loadRemote(); });
})();
