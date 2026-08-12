(() => {
  const root = document.querySelector('#stillOSV133');
  if (!root || window.__stillOSV133) return;
  window.__stillOSV133 = true;
  const hr = () => localStorage.getItem('still-lang') === 'hr';
  const t = (en, hrv) => hr() ? hrv : en;
  const applyLanguage = () => { document.documentElement.lang = hr() ? 'hr' : 'en'; };
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  const date = value => value ? new Intl.DateTimeFormat(hr() ? 'hr-HR' : 'en-GB', { dateStyle: 'medium' }).format(new Date(value)) : '';
  const state = { now: null, world: null, relationship: null, search: [], loading: false, error: '', attentionOpen: false, migration: { status: 'not_needed', imported: 0, skipped: 0 } };

  async function api(path, options = {}) {
    const config = { credentials: 'same-origin', ...options, headers: { accept: 'application/json', ...(options.headers || {}) } };
    if (config.body && !(config.body instanceof FormData) && !config.headers['content-type']) config.headers['content-type'] = 'application/json';
    const response = await fetch(path, config);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.message || data.error || `${response.status}`), { status: response.status, data });
    return data;
  }

  function legacyRecords(key) {
    try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; }
    catch { return []; }
  }

  async function migrateLegacyWorld() {
    const sources = ['still-ownership-passports-v83', 'still-saved-purchases-v1'];
    const pending = sources.map(source => ({ source, records: legacyRecords(source) })).filter(entry => entry.records.length);
    if (!pending.length) return;
    state.migration.status = 'running';
    try {
      for (const entry of pending) {
        const result = await api('/api/v1/world/migrations/local-storage', { method: 'POST', body: JSON.stringify(entry) });
        state.migration.imported += Number(result.imported || 0); state.migration.skipped += Number(result.skipped || 0);
      }
      state.migration.status = 'complete';
    } catch (error) {
      state.migration.status = 'failed';
      state.migration.error = error.message;
    }
  }

  function route() {
    const parts = location.pathname.replace(/^\/app\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    if (!parts.length) return { space: 'now' };
    if (['world', 'discover', 'together', 'market'].includes(parts[0]) && parts.length === 1) return { space: parts[0] };
    if (parts[0] === 'market') return { space: 'market', kind: parts[1] || 'home', id: parts[2] || null };
    const type = parts[0] === 'open-loop' ? 'open_loop' : parts[0];
    if (['thing', 'situation', 'knowledge', 'receipt', 'open_loop', 'need'].includes(type) && parts[1]) return { space: 'context', type, id: parts[1] };
    return { space: 'now' };
  }

  function pathFor(type, id) {
    return `/app/${type === 'open_loop' ? 'open-loop' : type}/${encodeURIComponent(id)}`;
  }

  function navigate(path, replace = false) {
    history[replace ? 'replaceState' : 'pushState']({}, '', path);
    renderRoute();
  }

  function icon(type) {
    return ({ thing: '◇', situation: '○', knowledge: '≡', receipt: '▤', open_loop: '✓', document: '▧', need: '◎' })[type] || '·';
  }

  function typeLabel(type) {
    return ({ thing: t('Thing', 'Stvar'), situation: t('Situation', 'Situacija'), knowledge: t('Knowledge', 'Znanje'), receipt: t('Receipt', 'Račun'), open_loop: t('Open loop', 'Otvorena obveza'), document: t('Document', 'Dokument'), need: t('Need', 'Potreba') })[type] || type;
  }

  function shell() {
    root.innerHTML = `<div class="sos133-shell">
      <header class="sos133-topbar">
        <a class="sos133-brand" href="/app" data-nav><span aria-hidden="true"></span><b>Still</b></a>
        <form class="sos133-command" data-global-search role="search">
          <label><span class="sos133-sr">${t('Search or tell Still something', 'Pretraži ili reci Still-u nešto')}</span><input name="q" type="search" minlength="2" maxlength="120" autocomplete="off" placeholder="${t('Ask, show or tell Still…', 'Pitaj, pokaži ili reci Still-u…')}"></label>
          <button type="button" data-command-open aria-label="${t('Add or tell Still something', 'Dodaj ili reci nešto Still-u')}">＋</button>
        </form>
        <div class="sos133-account-actions">
          <button type="button" data-attention aria-label="${t('Open attention summary', 'Otvori sažetak pažnje')}"><span aria-hidden="true">○</span><em data-attention-count hidden></em></button>
          <button type="button" data-profile aria-label="${t('Open profile', 'Otvori profil')}"><span data-avatar>?</span></button>
        </div>
      </header>
      <nav class="sos133-nav" aria-label="${t('Still spaces', 'Still prostori')}">
        ${navItem('/app', 'now', t('Now', 'Sada'), '◉')}
        ${navItem('/app/world', 'world', t('World', 'Svijet'), '◇')}
        ${navItem('/app/market', 'market', t('Market', 'Tržište'), '↔')}
        ${navItem('/app/discover', 'discover', t('Discover', 'Otkrij'), '✦')}
        ${navItem('/app/together', 'together', t('Together', 'Zajedno'), '◎')}
      </nav>
      <main id="stillOSMain" class="sos133-main" tabindex="-1"></main>
      <div class="sos133-search-results" data-search-results hidden></div>
      <div class="sos133-status" data-status role="status" aria-live="polite"></div>
    </div>`;
    bindShell();
  }

  function navItem(path, space, label, mark) {
    return `<a href="${path}" data-nav data-space="${space}"><span aria-hidden="true">${mark}</span><b>${label}</b></a>`;
  }

  function setStatus(message, error = false) {
    const node = root.querySelector('[data-status]');
    if (!node) return;
    node.textContent = message || '';
    node.dataset.error = String(error);
  }

  function updateChrome(space) {
    root.querySelectorAll('[data-space]').forEach(link => link.setAttribute('aria-current', link.dataset.space === space ? 'page' : 'false'));
    const count = root.querySelector('[data-attention-count]');
    if (count && state.now) {
      const attentionTotal = Number(state.now.attentionCount || 0) + Number(state.now.activeNeedCount || 0) + Number(state.now.market?.notifications?.length || 0);
      count.textContent = attentionTotal > 99 ? '99+' : attentionTotal;
      count.hidden = attentionTotal < 1;
    }
    const name = state.now?.owner?.name || '';
    const avatar = root.querySelector('[data-avatar]');
    if (avatar) avatar.textContent = name.trim().charAt(0).toLocaleUpperCase() || '•';
  }

  function loading(label) {
    return `<section class="sos133-state"><span class="sos133-loader" aria-hidden="true"></span><h1>${esc(label)}</h1></section>`;
  }

  function failed(error, retry = 'renderRoute()') {
    return `<section class="sos133-state sos133-error"><span aria-hidden="true">!</span><h1>${t('Still could not open this.', 'Still ovo nije mogao otvoriti.')}</h1><p>${esc(error)}</p><button type="button" data-retry>${t('Try again', 'Pokušaj ponovno')}</button></section>`;
  }

  function main() { return root.querySelector('#stillOSMain'); }

  function helpers() {
    return { api, esc, date, t, navigate, pathFor, openDialog, setStatus, contextButton, historyList, loading, failed, bindContent, invalidate: () => { state.now = null; state.world = null; }, renderNeed: id => renderContext('need', id) };
  }

  async function ensureNow(force = false) {
    if (state.now && !force) return state.now;
    state.now = await api('/api/v1/world/now');
    updateChrome(route().space);
    return state.now;
  }

  async function ensureWorld(force = false) {
    if (state.world && !force) return state.world;
    state.world = await api('/api/v1/world/bootstrap');
    return state.world;
  }

  function greeting(name) {
    const hour = new Date().getHours();
    const part = hour < 12 ? t('Good morning', 'Dobro jutro') : hour < 18 ? t('Good afternoon', 'Dobar dan') : t('Good evening', 'Dobra večer');
    return `${part}${name ? `, ${name.split(/\s+/)[0]}` : ''}.`;
  }

  function contextButton(item, compact = false) {
    const type = item.type || item.kind || item.entityType;
    const id = item.id || item.publicId || item.entityId;
    if (!type || !id) return '';
    return `<button type="button" class="sos133-context-row${compact ? ' compact' : ''}" data-open-context="${esc(type)}:${esc(id)}">
      <span aria-hidden="true">${icon(type)}</span><div><small>${esc(typeLabel(type))}</small><b>${esc(item.title || t('Untitled', 'Bez naslova'))}</b>${item.dueAt ? `<em>${item.overdue ? t('Overdue · ', 'Kasni · ') : ''}${date(item.dueAt)}</em>` : item.waitingOn ? `<em>${t('Waiting for', 'Čeka se')}: ${esc(item.waitingOn)}</em>` : ''}</div><i aria-hidden="true">→</i>
    </button>`;
  }

  async function renderNow() {
    const host = main();
    host.innerHTML = loading(t('Opening Now…', 'Otvaram Sada…'));
    try {
      const data = await ensureNow(true), dominantRaw = data.dominantNeed || data.dominantContext, dominant = dominantRaw ? { ...dominantRaw, type: data.dominantNeed ? 'need' : dominantRaw.type, id: dominantRaw.id || dominantRaw.publicId } : null;
      const needAttention = [...(data.needsRequiringConfirmation || []), ...(data.urgentNeeds || [])].filter((item, index, values) => values.findIndex(other => other.publicId === item.publicId) === index).map(item => ({ ...item, type: 'need', id: item.publicId }));
      const attentionItems = [...needAttention, ...(data.attentionItems || [])], attentionCount = Number(data.attentionCount || 0) + Number(data.activeNeedCount || 0);
      host.innerHTML = `<section class="sos133-now">
        <header class="sos133-now-head"><span>${t('NOW', 'SADA')}</span><h1>${esc(greeting(data.owner?.name))}</h1><p>${data.quietState ? t('Everything’s handled.', 'Sve je riješeno.') : t('Here is what matters right now.', 'Evo što je sada važno.')}</p></header>
        ${dominant ? `<article class="sos133-dominant"><div><span>${dominant.type === 'need' ? t('NEED', 'POTREBA') : dominant.overdue ? t('NEEDS YOU', 'TRAŽI TEBE') : dominant.status === 'WAITING' ? t('WAITING', 'ČEKANJE') : t('CURRENT CONTEXT', 'TRENUTAČNI KONTEKST')}</span><h2>${esc(dominant.title)}</h2><p>${dominant.waitingOn ? `${t('Waiting for', 'Čeka se')}: ${esc(dominant.waitingOn)}` : dominant.dueAt ? `${dominant.overdue ? t('Due', 'Rok') : t('Coming up', 'Uskoro')}: ${date(dominant.dueAt)}` : dominant.type === 'need' ? t('Open this Need to see real ways to handle it.', 'Otvori potrebu i pogledaj stvarne načine rješavanja.') : t('One active situation may need your attention.', 'Jedna aktivna situacija možda traži tvoju pažnju.')}</p></div><button type="button" data-open-context="${esc(dominant.type)}:${esc(dominant.id)}">${dominant.type === 'need' ? t('Handle it', 'Riješi') : t('Open', 'Otvori')} <span>→</span></button></article>` : `<article class="sos133-quiet"><span aria-hidden="true">✓</span><h2>${t('Everything’s handled.', 'Sve je riješeno.')}</h2><p>${t('Your World is quiet. Still will show real deadlines and open work here when they exist.', 'Tvoj Svijet je miran. Still će ovdje prikazati stvarne rokove i otvorene obveze kada postoje.')}</p><div><button type="button" data-command-open>${t('Add something', 'Dodaj nešto')}</button><a href="/app/world" data-nav>${t('Explore your World', 'Istraži svoj Svijet')}</a></div></article>`}
        ${attentionCount ? `<section class="sos133-attention"><button type="button" class="sos133-attention-toggle" data-toggle-attention aria-expanded="${state.attentionOpen}"><span><b>${attentionCount}</b> ${t(attentionCount === 1 ? 'thing may need you' : 'things may need you', attentionCount === 1 ? 'stvar te možda treba' : 'stvari te možda trebaju')}</span><i aria-hidden="true">${state.attentionOpen ? '−' : '+'}</i></button><div class="sos133-attention-list" ${state.attentionOpen ? '' : 'hidden'}>${attentionItems.map(item => contextButton(item, true)).join('')}</div></section>` : ''}
        <section class="sos133-input-invite"><button type="button" data-command-open><span aria-hidden="true">＋</span><div><b>${t('Ask, show or tell Still…', 'Pitaj, pokaži ili reci Still-u…')}</b><small>${t('Add a Thing, start a Situation, save Knowledge or remember an action.', 'Dodaj stvar, pokreni situaciju, spremi znanje ili zapamti obvezu.')}</small></div><i>→</i></button></section>
        ${(data.recentItems || []).length || (data.recentNeeds || []).length ? `<section class="sos133-recent"><header><span>${t('RECENT CONTEXT', 'NEDAVNI KONTEKST')}</span><h2>${t('Recently remembered', 'Nedavno zapamćeno')}</h2></header><ol>${[...(data.recentNeeds || []).map(item => ({ ...item, type: 'need', occurredAt: item.createdAt })), ...(data.recentItems || [])].sort((a, b) => String(b.occurredAt).localeCompare(String(a.occurredAt))).slice(0, 5).map(item => `<li><span aria-hidden="true">${icon(item.type)}</span><div><b>${esc(item.title)}</b><small>${date(item.occurredAt)}</small></div></li>`).join('')}</ol></section>` : ''}
      </section>`;
      bindContent();
    } catch (error) {
      host.innerHTML = failed(error.message);
      bindContent();
    }
  }

  function familySection(title, items, type, emptyText) {
    return `<section class="sos133-family"><header><div><span>${esc(typeLabel(type).toLocaleUpperCase())}</span><h2>${esc(title)}</h2></div><small>${items.length}</small></header>${items.length ? `<div>${items.slice(0, 12).map(item => contextButton({ ...item, type })).join('')}</div>` : `<p>${esc(emptyText)}</p>`}</section>`;
  }

  async function renderWorld() {
    const host = main(); host.innerHTML = loading(t('Opening your World…', 'Otvaram tvoj Svijet…'));
    try {
      const data = await ensureWorld(true);
      host.innerHTML = `<section class="sos133-world"><header class="sos133-page-head"><span>${t('WORLD', 'SVIJET')}</span><h1>${t('Everything Still remembers for you.', 'Sve što Still pamti za tebe.')}</h1><p>${t('Things, Knowledge and Situations stay connected through relationships you control.', 'Stvari, znanje i situacije ostaju povezani odnosima kojima ti upravljaš.')}</p></header>
        <div class="sos133-world-families">
          ${window.StillNeedsV134?.worldNeeds(data.needs || [], helpers()) || ''}
          ${familySection(t('Your things', 'Tvoje stvari'), data.things || [], 'thing', t('Add your first Thing when you are ready.', 'Dodaj prvu stvar kada budeš spreman.'))}
          ${familySection(t('Knowledge you kept', 'Znanje koje čuvaš'), data.knowledge || [], 'knowledge', t('Saved notes, documents and useful text appear here.', 'Spremljene bilješke, dokumenti i koristan tekst pojavljuju se ovdje.'))}
          ${familySection(t('Situations in motion', 'Situacije u tijeku'), data.situations || [], 'situation', t('Active situations appear here without manufactured urgency.', 'Aktivne situacije pojavljuju se ovdje bez izmišljene hitnosti.'))}
        </div>
        <button type="button" class="sos133-floating-add" data-command-open>＋ <span>${t('Add to your World', 'Dodaj u svoj Svijet')}</span></button>
      </section>`;
      bindContent();
      window.StillNeedsV134?.bindWorld(helpers());
    } catch (error) { host.innerHTML = failed(error.message); bindContent(); }
  }

  async function renderDiscover() {
    const host = main(); host.innerHTML = loading(t('Opening Discover…', 'Otvaram Otkrivanje…'));
    try {
      const data = await ensureWorld();
      const knowledge = (data.knowledge || []).slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      host.innerHTML = `<section class="sos133-discover"><header class="sos133-page-head"><span>${t('DISCOVER', 'OTKRIJ')}</span><h1>${t('Return to what caught your attention.', 'Vrati se onome što ti je privuklo pažnju.')}</h1><p>${t('Discover uses only Knowledge you saved and relationships you explicitly created.', 'Otkrivanje koristi samo znanje koje si spremio i odnose koje si izričito stvorio.')}</p></header>
        ${knowledge.length ? `<div class="sos133-editorial-list">${knowledge.map(item => `<button type="button" data-open-context="knowledge:${esc(item.publicId)}"><span>${esc((item.tags || []).slice(0, 2).join(' · ') || typeLabel('knowledge'))}</span><h2>${esc(item.title)}</h2><p>${esc(String(item.body || '').replace(/\s+/g, ' ').slice(0, 180))}</p><i>→</i></button>`).join('')}</div>` : `<div class="sos133-quiet compact"><h2>${t('Nothing saved yet.', 'Još ništa nije spremljeno.')}</h2><p>${t('Save a note, article or document and it will appear here.', 'Spremi bilješku, članak ili dokument i pojavit će se ovdje.')}</p><button type="button" data-command-open>${t('Save Knowledge', 'Spremi znanje')}</button></div>`}
      </section>`;
      bindContent();
    } catch (error) { host.innerHTML = failed(error.message); bindContent(); }
  }

  async function renderTogether() {
    const host = main(); host.innerHTML = loading(t('Opening Together…', 'Otvaram Zajedno…'));
    try {
      const data = await api('/api/v1/buyer-dashboard');
      state.relationship = data;
      const companies = data.companies || data.relationships || [];
      host.innerHTML = `<section class="sos133-together"><header class="sos133-page-head"><span>${t('TOGETHER', 'ZAJEDNO')}</span><h1>${t('Share only what helps.', 'Podijeli samo ono što pomaže.')}</h1><p>${t('Your World stays private. Connected businesses see information only through an existing passport or case relationship.', 'Tvoj Svijet ostaje privatan. Povezane tvrtke vide podatke samo kroz postojeći odnos putovnice ili slučaja.')}</p></header>
        <article class="sos133-sharing-principle"><div><span aria-hidden="true">●</span><b>${t('Private by default', 'Privatno prema zadanim postavkama')}</b><small>${t('Nothing in your World is public.', 'Ništa u tvojem Svijetu nije javno.')}</small></div><span aria-hidden="true">→</span><div><span aria-hidden="true">◎</span><b>${t('Selected sharing', 'Odabrano dijeljenje')}</b><small>${t('Passports and cases carry only the context you choose.', 'Putovnice i slučajevi nose samo kontekst koji odabereš.')}</small></div></article>
        <section class="sos133-connections"><h2>${t('Existing connections', 'Postojeće veze')}</h2>${companies.length ? companies.map(company => `<article><span>${esc((company.name || company.organization_name || '?').charAt(0))}</span><div><b>${esc(company.name || company.organization_name || t('Connected business', 'Povezana tvrtka'))}</b><small>${esc(company.relationship || company.status || t('Existing relationship', 'Postojeći odnos'))}</small></div></article>`).join('') : `<p>${t('No shared business relationships yet.', 'Još nema dijeljenih poslovnih odnosa.')}</p>`}</section>
      </section>`;
      bindContent();
    } catch (error) {
      if (error.status === 404) host.innerHTML = `<section class="sos133-together"><header class="sos133-page-head"><span>${t('TOGETHER', 'ZAJEDNO')}</span><h1>${t('Your World is private.', 'Tvoj Svijet je privatan.')}</h1><p>${t('Selective passport and case sharing remains available from the relevant Thing or Situation.', 'Selektivno dijeljenje putovnice i slučaja ostaje dostupno iz odgovarajuće stvari ili situacije.')}</p></header></section>`;
      else host.innerHTML = failed(error.message);
      bindContent();
    }
  }

  function linkedList(data) {
    const groups = [['thing', data.things || []], ['situation', data.situations || []], ['knowledge', data.knowledge || []], ['document', data.documents || []], ['receipt', data.receipts || []]];
    return groups.flatMap(([type, items]) => items.map(item => contextButton({ ...item, type }, true))).join('');
  }

  function historyList(items) {
    if (!items?.length) return `<p class="sos133-muted">${t('No history yet.', 'Još nema povijesti.')}</p>`;
    return `<ol class="sos133-history">${items.slice(0, 12).map(item => `<li><span></span><div><b>${esc(item.title)}</b><small>${date(item.occurredAt)}</small></div></li>`).join('')}</ol>`;
  }

  function workspaceActions(data) {
    const type = data.entityType, entity = data.entity;
    if (type === 'situation') return `<button type="button" class="primary" data-resolve-situation="${esc(entity.publicId)}" ${entity.status === 'RESOLVED' ? 'disabled' : ''}>${entity.status === 'RESOLVED' ? t('Resolved', 'Riješeno') : t('Resolve situation', 'Riješi situaciju')}</button><button type="button" data-create-need>${t('Create Need', 'Stvori potrebu')}</button><button type="button" data-context-add="open_loop">${t('Add open loop', 'Dodaj otvorenu obvezu')}</button><button type="button" data-context-add="knowledge">${t('Add context', 'Dodaj kontekst')}</button>`;
    if (type === 'thing') return `<button type="button" class="primary" data-passport-toggle>${t('Open Passport', 'Otvori putovnicu')}</button><button type="button" data-sell-thing>${t('Sell', 'Prodaj')}</button><button type="button" data-create-need>${t('Create Need', 'Stvori potrebu')}</button><button type="button" data-sight-open="receipt">${t('Add receipt', 'Dodaj račun')}</button><button type="button" data-context-add="knowledge">${t('Add knowledge', 'Dodaj znanje')}</button>`;
    if (type === 'knowledge') return `<button type="button" class="primary" data-edit-knowledge>${t('Edit Knowledge', 'Uredi znanje')}</button><button type="button" data-create-need>${t('Create Need', 'Stvori potrebu')}</button>${entity.sourceUrl ? `<a href="${esc(entity.sourceUrl)}" target="_blank" rel="noopener noreferrer">${t('Open source', 'Otvori izvor')}</a>` : ''}`;
    if (type === 'receipt') return `${entity.processingStatus === 'FAILED' ? `<button type="button" class="primary" data-retry-receipt="${esc(entity.publicId)}">${t('Try processing again', 'Ponovi obradu')}</button>` : `<a class="primary" href="${esc(entity.original?.url || '#')}" target="_blank" rel="noopener">${t('Open original', 'Otvori izvornik')}</a>`}`;
    if (type === 'open_loop') return `<button type="button" class="primary" data-complete-loop="${esc(entity.publicId)}" ${['COMPLETED', 'CANCELLED'].includes(entity.status) ? 'disabled' : ''}>${t('Complete', 'Dovrši')}</button>`;
    return '';
  }

  function entitySummary(data) {
    const entity = data.entity, type = data.entityType;
    if (type === 'thing') return `<p>${esc([entity.manufacturer, entity.model, entity.businessName].filter(Boolean).join(' · ') || typeLabel('thing'))}</p><div class="sos133-facts"><span>${t('Lifecycle', 'Životni ciklus')}<b>${esc(entity.lifecycleState || 'OWNED')}</b></span>${entity.warrantyUntil ? `<span>${t('Warranty', 'Jamstvo')}<b>${date(entity.warrantyUntil)}</b></span>` : ''}${entity.purchaseDate ? `<span>${t('Purchased', 'Kupljeno')}<b>${date(entity.purchaseDate)}</b></span>` : ''}</div>`;
    if (type === 'situation') return `<p>${esc(entity.description || t('No description yet.', 'Još nema opisa.'))}</p><div class="sos133-facts"><span>${t('Status', 'Status')}<b>${esc(entity.status)}</b></span>${entity.dueAt ? `<span>${t('Due', 'Rok')}<b>${date(entity.dueAt)}</b></span>` : ''}</div>`;
    if (type === 'knowledge') return `<p class="sos133-knowledge-body">${esc(entity.body)}</p>${entity.tags?.length ? `<div class="sos133-tags">${entity.tags.map(tag => `<span>${esc(tag)}</span>`).join('')}</div>` : ''}`;
    if (type === 'receipt') return `<p>${esc(entity.merchant || t('Receipt', 'Račun'))}</p><div class="sos133-facts"><span>${t('Processing', 'Obrada')}<b>${esc(entity.processingStatus)}</b></span>${entity.purchaseDate ? `<span>${t('Purchased', 'Kupljeno')}<b>${date(entity.purchaseDate)}</b></span>` : ''}${Number.isFinite(entity.totalCents) ? `<span>${t('Total', 'Ukupno')}<b>${(entity.totalCents / 100).toFixed(2)} ${esc(entity.currency || '')}</b></span>` : ''}</div>`;
    if (type === 'open_loop') return `<p>${esc(entity.notes || entity.waitingOn || t('An open commitment in your World.', 'Otvorena obveza u tvojem Svijetu.'))}</p><div class="sos133-facts"><span>${t('Status', 'Status')}<b>${esc(entity.status)}</b></span>${entity.dueAt ? `<span>${t('Due', 'Rok')}<b>${date(entity.dueAt)}</b></span>` : ''}</div>`;
    return '';
  }

  async function renderContext(type, id) {
    const host = main(); host.innerHTML = loading(t('Opening context…', 'Otvaram kontekst…'));
    if (type === 'need' && window.StillNeedsV134) return window.StillNeedsV134.renderNeed({ host, id, helpers: helpers() });
    try {
      const data = await api(`/api/v1/world/context/${encodeURIComponent(type)}/${encodeURIComponent(id)}`);
      const entity = data.entity;
      host.innerHTML = `<section class="sos133-workspace" data-context-type="${esc(type)}" data-context-id="${esc(id)}">
        <button type="button" class="sos133-back" data-back>← ${t('Back', 'Natrag')}</button>
        <header class="sos133-workspace-head"><div><span>${esc(typeLabel(type).toLocaleUpperCase())}</span><h1>${esc(entity.title || entity.merchant || t('Untitled', 'Bez naslova'))}</h1>${entitySummary(data)}</div><div class="sos133-workspace-actions">${workspaceActions(data)}<button type="button" class="more" data-workspace-more aria-label="${t('More actions', 'Više radnji')}">•••</button></div></header>
        ${type === 'thing' ? `<section class="sos133-passport" data-passport hidden><header><span>${t('PASSPORT', 'PUTOVNICA')}</span><h2>${esc(entity.title)}</h2></header><dl><div><dt>${t('Identity', 'Identitet')}</dt><dd>${esc([entity.manufacturer, entity.model].filter(Boolean).join(' ') || entity.kind)}</dd></div><div><dt>${t('Ownership', 'Vlasništvo')}</dt><dd>${esc(entity.lifecycleState || 'OWNED')}</dd></div><div><dt>${t('Reference', 'Referenca')}</dt><dd>${esc(entity.reference || t('Not added', 'Nije dodano'))}</dd></div><div><dt>${t('Evidence', 'Dokazi')}</dt><dd>${data.evidence.length}</dd></div></dl></section>` : ''}
        ${window.StillMarketV135?.thingSection(data, helpers()) || ''}
        ${window.StillNeedsV134?.contextNeeds(data, helpers()) || ''}
        ${data.openLoops?.length ? `<section class="sos133-workspace-section"><header><span>${t('OPEN LOOPS', 'OTVORENE OBVEZE')}</span><h2>${t('What remains open', 'Što ostaje otvoreno')}</h2></header><div>${data.openLoops.map(loop => contextButton({ ...loop, type: 'open_loop', id: loop.publicId }, true)).join('')}</div></section>` : ''}
        ${linkedList(data) ? `<section class="sos133-workspace-section"><header><span>${t('CONNECTED CONTEXT', 'POVEZANI KONTEKST')}</span><h2>${t('Related in your World', 'Povezano u tvojem Svijetu')}</h2></header><div>${linkedList(data)}</div></section>` : ''}
        <section class="sos133-workspace-section"><header><span>${t('HISTORY', 'POVIJEST')}</span><h2>${t('Recent context', 'Nedavni kontekst')}</h2></header>${historyList(data.history)}</section>
      </section>`;
      bindContent(data);
      window.StillNeedsV134?.bindContext(data, helpers());
      window.StillMarketV135?.bindThing(data, helpers());
    } catch (error) {
      host.innerHTML = failed(error.status === 404 ? t('This item was not found in your World.', 'Ova stavka nije pronađena u tvojem Svijetu.') : error.message);
      bindContent();
    }
  }

  function openDialog(title, content, className = '') {
    root.querySelector('.sos133-dialog')?.remove();
    const dialog = document.createElement('dialog');
    dialog.className = `sos133-dialog ${className}`;
    dialog.innerHTML = `<header><b>${esc(title)}</b><button type="button" data-dialog-close aria-label="${t('Close', 'Zatvori')}">×</button></header><div class="sos133-dialog-body">${content}</div>`;
    root.appendChild(dialog);
    dialog.querySelector('[data-dialog-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.showModal();
    return dialog;
  }

  function openCommand(options = {}) {
    const dialog = openDialog(t('Tell Still', 'Reci Still-u'), `<form class="sos133-input-form" data-input-form>
      <label>${t('What are you dealing with?', 'Čime se baviš?')}<textarea name="content" required maxlength="50000" placeholder="${t('For example: I need to repair my car.', 'Na primjer: Trebam popraviti auto.')}">${esc(options.prefill || '')}</textarea></label>
      ${options.requestedType ? `<input type="hidden" name="requestedType" value="${esc(options.requestedType)}">` : ''}
      <div class="sos133-input-methods"><button type="button" data-sight-open="image">▧ ${t('Show or upload', 'Pokaži ili učitaj')}</button>${('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) ? `<button type="button" data-speak>◉ ${t('Speak', 'Govori')}</button>` : ''}</div>
      <button class="primary">${t('Continue', 'Nastavi')} →</button><small>${t('Still asks before saving an inferred destination.', 'Still pita prije spremanja pretpostavljenog odredišta.')}</small>
    </form>`, 'command');
    const form = dialog.querySelector('[data-input-form]');
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form));
      const submit = form.querySelector('.primary'); submit.disabled = true;
      try {
        const routed = await api('/api/v1/world/input/route', { method: 'POST', body: JSON.stringify(values) });
        dialog.close();
        confirmInput(values.content, routed, options.context || {});
      } catch (error) { setStatus(error.message, true); submit.disabled = false; }
    });
    dialog.querySelector('[data-sight-open]')?.addEventListener('click', () => { dialog.close(); openSight(); });
    dialog.querySelector('[data-speak]')?.addEventListener('click', () => startSpeech(form.querySelector('textarea')));
    setTimeout(() => form.querySelector('textarea')?.focus(), 50);
  }

  function confirmInput(content, routing, context = {}) {
    const suggested = routing?.route || routing?.requestedType || routing || '', proposedNeed = routing?.proposedNeed || {};
    const types = ['need', 'situation', 'knowledge', 'open_loop', 'thing'];
    const dialog = openDialog(t('What should Still do?', 'Što Still treba učiniti?'), `<form class="sos133-route-form" data-route-form><p>${esc(content.slice(0, 260))}</p><fieldset><legend>${t('Choose where this belongs', 'Odaberi gdje ovo pripada')}</legend>${types.map(type => `<label><input type="radio" name="type" value="${type}" ${type === suggested ? 'checked' : ''} required><span aria-hidden="true">${icon(type)}</span><b>${esc(typeLabel(type))}</b></label>`).join('')}</fieldset><button class="primary">${t('Save to my World', 'Spremi u moj Svijet')}</button></form>`);
    const form = dialog.querySelector('[data-route-form]');
    form.addEventListener('submit', async event => {
      event.preventDefault(); const button = form.querySelector('.primary'); button.disabled = true;
      try { const result = await persistInput(content, new FormData(form).get('type'), context, proposedNeed); dialog.close(); await afterCreated(result); }
      catch (error) { setStatus(error.message, true); button.disabled = false; }
    });
  }

  async function persistInput(content, type, context = {}, proposedNeed = {}) {
    const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean), title = (lines[0] || content).slice(0, 180), detail = lines.slice(1).join('\n') || content;
    if (type === 'need') return api('/api/v1/world/needs', { method: 'POST', body: JSON.stringify({ title, description: detail, needType: proposedNeed.needType || 'OTHER', sourceType: 'USER_CREATED', confidence: 'CONFIRMED', ...({ thing: 'thingId', situation: 'situationId', knowledge: 'knowledgeId', open_loop: 'openLoopId', receipt: 'receiptId', document: 'documentId' }[context.type] && context.id ? { [{ thing: 'thingId', situation: 'situationId', knowledge: 'knowledgeId', open_loop: 'openLoopId', receipt: 'receiptId', document: 'documentId' }[context.type]]: context.id } : {}) }) });
    if (type === 'situation') return api('/api/v1/world/situations', { method: 'POST', body: JSON.stringify({ title, description: detail, thingId: context.type === 'thing' ? context.id : undefined, documentId: context.type === 'document' ? context.id : undefined, receiptId: context.type === 'receipt' ? context.id : undefined }) });
    if (type === 'knowledge') return api('/api/v1/world/knowledge', { method: 'POST', body: JSON.stringify({ title, body: detail, thingId: context.type === 'thing' ? context.id : undefined, situationId: context.type === 'situation' ? context.id : undefined }) });
    if (type === 'open_loop') return api('/api/v1/world/open-loops', { method: 'POST', body: JSON.stringify({ title, notes: lines.slice(1).join('\n'), type: 'ACTION', status: 'OPEN', situationId: context.type === 'situation' ? context.id : undefined, thingId: context.type === 'thing' ? context.id : undefined }) });
    return api('/api/v1/world/things', { method: 'POST', body: JSON.stringify({ title, kind: 'product', notes: lines.slice(1).join('\n') }) });
  }

  async function afterCreated(result) {
    state.now = null; state.world = null;
    const entity = result.need || result.situation || result.knowledge || result.openLoop || result.thing;
    const type = result.need ? 'need' : result.situation ? 'situation' : result.knowledge ? 'knowledge' : result.openLoop ? 'open_loop' : 'thing';
    setStatus(t('Saved to your World.', 'Spremljeno u tvoj Svijet.'));
    if (entity?.publicId) navigate(pathFor(type, entity.publicId)); else navigate('/app');
  }

  function startSpeech(target) {
    const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Speech) return;
    const recognition = new Speech(); recognition.lang = hr() ? 'hr-HR' : 'en-US'; recognition.interimResults = false;
    recognition.onresult = event => { target.value = `${target.value}${target.value ? ' ' : ''}${event.results[0][0].transcript}`; };
    recognition.onerror = () => setStatus(t('Voice input was not available.', 'Glasovni unos nije bio dostupan.'), true);
    recognition.start();
  }

  function openSight(initial = '') {
    const dialog = openDialog(t('Show Still', 'Pokaži Still-u'), `<div class="sos133-sight"><div class="sos133-sight-intro"><span aria-hidden="true">▧</span><h2>${t('Use a real image or document.', 'Upotrijebi stvarnu sliku ili dokument.')}</h2><p>${t('Still can scan a receipt, extract readable text, save it as Knowledge, or connect the file to an existing Thing or Situation.', 'Still može skenirati račun, izdvojiti čitljiv tekst, spremiti ga kao znanje ili povezati datoteku s postojećom stvari ili situacijom.')}</p></div><label class="sos133-file"><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain" data-sight-file><span>＋</span><b>${t('Choose file or use camera', 'Odaberi datoteku ili kameru')}</b><small>${t('JPEG, PNG, WebP, PDF or text', 'JPEG, PNG, WebP, PDF ili tekst')}</small></label><div data-sight-selected></div></div>`, 'sight');
    dialog.querySelector('[data-sight-file]').addEventListener('change', event => renderSightActions(dialog, event.target.files?.[0], initial));
  }

  async function renderSightActions(dialog, file, initial) {
    if (!file) return;
    const host = dialog.querySelector('[data-sight-selected]');
    host.innerHTML = `<article class="sos133-selected-file"><span>▧</span><div><b>${esc(file.name)}</b><small>${Math.ceil(file.size / 1024)} KB · ${esc(file.type || t('unknown type', 'nepoznata vrsta'))}</small></div></article><div class="sos133-sight-actions"><button type="button" class="primary" data-sight-action="receipt">${t('Scan receipt', 'Skeniraj račun')}</button><button type="button" data-sight-action="understand">${t('Understand text', 'Razumij tekst')}</button><button type="button" data-sight-action="knowledge">${t('Save as Knowledge', 'Spremi kao znanje')}</button><button type="button" data-sight-action="situation">${t('Create Situation', 'Stvori situaciju')}</button><button type="button" data-sight-action="need">${t('Create Need', 'Stvori potrebu')}</button><button type="button" data-sight-action="connect">${t('Connect', 'Poveži')}</button></div><p class="sos133-sight-note">${t('Product recognition is not claimed. Understand uses the real document text service and reports when text cannot be read.', 'Prepoznavanje proizvoda se ne tvrdi. Razumijevanje koristi stvarnu uslugu za tekst dokumenta i javlja kada tekst nije moguće pročitati.')}</p>`;
    host.querySelectorAll('[data-sight-action]').forEach(button => button.addEventListener('click', () => runSight(dialog, file, button.dataset.sightAction, initial, button)));
  }

  async function uploadDocument(file) {
    const form = new FormData(); form.set('file', file); form.set('title', file.name.replace(/\.[^.]+$/, '')); form.set('documentType', file.type.startsWith('image/') ? 'image' : 'document'); form.set('consent', 'true');
    return api('/api/v1/world/documents', { method: 'POST', body: form });
  }

  async function runSight(dialog, file, action, initial, button) {
    button.disabled = true; setStatus(t('Processing your file…', 'Obrađujem tvoju datoteku…'));
    try {
      if (action === 'receipt') {
        const form = new FormData(); form.set('file', file); form.set('consent', 'true');
        const result = await api('/api/v1/world/receipts/capture', { method: 'POST', body: form });
        dialog.close(); state.now = null; state.world = null; navigate(pathFor('receipt', result.receipt.publicId)); return;
      }
      const uploaded = await uploadDocument(file), document = uploaded.document;
      if (action === 'need') {
        dialog.close(); window.StillNeedsV134?.openIntake({ type: 'document', id: document.publicId }, helpers(), { title: document.title, sourceType: 'DOCUMENT_DERIVED', confidence: 'CONFIRMED' }); return;
      }
      if (action === 'understand') {
        const text = document.extractedText;
        const output = dialog.querySelector('[data-sight-selected]');
        output.insertAdjacentHTML('beforeend', `<article class="sos133-understanding"><span>${text ? t('READABLE TEXT', 'ČITLJIV TEKST') : t('NO TEXT FOUND', 'TEKST NIJE PRONAĐEN')}</span><p>${esc(text ? text.slice(0, 1800) : t('Still could not extract reliable text from this file. The original remains private.', 'Still nije mogao izdvojiti pouzdan tekst iz ove datoteke. Izvornik ostaje privatan.'))}</p>${text ? `<button type="button" data-save-understanding>${t('Save this as Knowledge', 'Spremi ovo kao znanje')}</button>` : ''}</article>`);
        output.querySelector('[data-save-understanding]')?.addEventListener('click', async event => { event.currentTarget.disabled = true; const saved = await api('/api/v1/world/knowledge', { method: 'POST', body: JSON.stringify({ title: document.title, sourceDocumentId: document.publicId }) }); dialog.close(); state.world = null; navigate(pathFor('knowledge', saved.knowledge.publicId)); });
        return;
      }
      if (action === 'knowledge') {
        const saved = await api('/api/v1/world/knowledge', { method: 'POST', body: JSON.stringify({ title: document.title, sourceDocumentId: document.publicId }) });
        dialog.close(); state.world = null; state.now = null; navigate(pathFor('knowledge', saved.knowledge.publicId)); return;
      }
      if (action === 'situation') {
        const saved = await api('/api/v1/world/situations', { method: 'POST', body: JSON.stringify({ title: document.title, description: t('Created from a private document in Sight.', 'Stvoreno iz privatnog dokumenta u Sightu.'), documentId: document.publicId }) });
        dialog.close(); state.world = null; state.now = null; navigate(pathFor('situation', saved.situation.publicId)); return;
      }
      const world = await ensureWorld();
      const options = [...(world.things || []).map(item => ({ type: 'thing', id: item.publicId, title: item.title })), ...(world.situations || []).filter(item => item.status !== 'RESOLVED').map(item => ({ type: 'situation', id: item.publicId, title: item.title }))];
      if (!options.length) throw new Error(t('Add a Thing or Situation before connecting this file.', 'Dodaj stvar ili situaciju prije povezivanja ove datoteke.'));
      const connect = openDialog(t('Connect this file', 'Poveži ovu datoteku'), `<form data-connect-form><label>${t('Choose context', 'Odaberi kontekst')}<select name="target" required><option value="">—</option>${options.map(item => `<option value="${esc(item.type)}:${esc(item.id)}">${esc(typeLabel(item.type))} · ${esc(item.title)}</option>`).join('')}</select></label><button class="primary">${t('Connect', 'Poveži')}</button></form>`);
      connect.querySelector('[data-connect-form]').addEventListener('submit', async event => { event.preventDefault(); const [type, id] = new FormData(event.currentTarget).get('target').split(':'); await api('/api/v1/world/relationships', { method: 'POST', body: JSON.stringify({ fromType: 'document', fromId: document.publicId, toType: type, toId: id, relationship: 'supports' }) }); connect.close(); dialog.close(); setStatus(t('Connected in your World.', 'Povezano u tvojem Svijetu.')); navigate(pathFor(type, id)); });
    } catch (error) { setStatus(error.message, true); button.disabled = false; }
  }

  async function openProfile() {
    try {
      const data = state.relationship || await api('/api/v1/buyer-dashboard'); state.relationship = data;
      const profile = data.profile || data.buyer || {}, name = profile.displayName || profile.display_name || profile.name || state.now?.owner?.name || t('Still member', 'Član Still-a');
      const migration = state.migration.status === 'complete' ? t(`${state.migration.imported} imported · ${state.migration.skipped} already accounted for`, `${state.migration.imported} uvezeno · ${state.migration.skipped} već obrađeno`) : state.migration.status === 'failed' ? t('Migration needs attention. Your server records remain safe.', 'Migraciju treba provjeriti. Zapisi na poslužitelju ostaju sigurni.') : t('No browser records need migration.', 'Nijedan zapis iz preglednika ne treba migraciju.');
      const picture = profile.pictureUrl ? `<img src="${esc(profile.pictureUrl)}" alt="">` : esc(name.charAt(0).toLocaleUpperCase());
      const upload = data.capabilities?.profileMediaUploads ? `<label class="sos133-profile-photo">${t('Profile picture', 'Slika profila')}<input type="file" name="photo" accept="image/png,image/jpeg,image/webp"><small>${t('JPEG, PNG or WebP. Still prepares a private square image before upload.', 'JPEG, PNG ili WebP. Still priprema privatnu kvadratnu sliku prije prijenosa.')}</small></label>` : '';
      const dialog = openDialog(t('Your profile', 'Tvoj profil'), `<section class="sos133-profile"><div class="sos133-profile-id"><span>${picture}</span><div><h2>${esc(name)}</h2><p>${esc(profile.email || '')}</p></div></div><form class="sos133-profile-form" data-profile-form><label>${t('Display name', 'Ime za prikaz')}<input name="displayName" required minlength="2" maxlength="180" value="${esc(name)}"></label><label>${t('Short profile description', 'Kratak opis profila')}<textarea name="bio" maxlength="600" placeholder="${t('A little context for businesses you intentionally connect with.', 'Kratak kontekst za tvrtke s kojima se namjerno povežeš.')}">${esc(profile.bio || '')}</textarea></label><label class="sos133-profile-share"><input type="checkbox" name="shareWithConnectedBusinesses" ${profile.shareWithConnectedBusinesses === false ? '' : 'checked'}><span><b>${t('Share my profile with connected businesses', 'Dijeli moj profil s povezanim tvrtkama')}</b><small>${t('Only businesses already connected through a Passport or case can see it.', 'Mogu ga vidjeti samo tvrtke već povezane Putovnicom ili slučajem.')}</small></span></label>${upload}<button class="primary">${t('Save profile', 'Spremi profil')}</button><p class="sos133-profile-status" data-profile-status role="status"></p></form><dl><div><dt>${t('Private World', 'Privatni Svijet')}</dt><dd>${t('Your records remain private and owner-scoped.', 'Tvoji zapisi ostaju privatni i ograničeni na vlasnika.')}</dd></div><div><dt>${t('Migration', 'Migracija')}</dt><dd>${esc(migration)}</dd></div></dl><div class="sos133-profile-links"><a href="/app/together" data-nav>${t('Connected businesses', 'Povezane tvrtke')}</a><a href="/">${t('Public Still website', 'Javna stranica Still')}</a></div></section>`);
      dialog.querySelector('[data-profile-form]').addEventListener('submit', async event => {
        event.preventDefault();
        const form = event.currentTarget, button = form.querySelector('button'), status = form.querySelector('[data-profile-status]'), photo = form.elements.photo?.files?.[0];
        button.disabled = true; status.textContent = t('Saving…', 'Spremanje…');
        try {
          const saved = await api('/api/v1/buyer-profile', { method: 'POST', body: JSON.stringify({ displayName: form.elements.displayName.value, bio: form.elements.bio.value, shareWithConnectedBusinesses: form.elements.shareWithConnectedBusinesses.checked }) });
          if (photo) {
            const blob = await profileImageBlob(photo);
            await api('/api/v1/buyer-profile/photo', { method: 'POST', headers: { 'content-type': 'image/webp' }, body: blob });
          }
          state.relationship = null;
          if (state.now?.owner && saved.profile?.displayName) state.now.owner.name = saved.profile.displayName;
          updateChrome(route().space);
          status.textContent = t('Profile saved.', 'Profil je spremljen.');
          setStatus(t('Profile saved.', 'Profil je spremljen.'));
        } catch (error) { status.textContent = error.message; setStatus(error.message, true); }
        finally { button.disabled = false; }
      });
    } catch (error) { setStatus(error.message, true); }
  }

  async function profileImageBlob(file) {
    if (!file || !/^image\/(?:png|jpeg|webp)$/.test(file.type)) throw new Error(t('Choose a JPEG, PNG or WebP image.', 'Odaberi JPEG, PNG ili WebP sliku.'));
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => { const node = new Image(); node.onload = () => resolve(node); node.onerror = reject; node.src = url; });
      const size = 320, canvas = document.createElement('canvas'), context = canvas.getContext('2d'); canvas.width = size; canvas.height = size;
      const scale = Math.max(size / image.naturalWidth, size / image.naturalHeight), width = image.naturalWidth * scale, height = image.naturalHeight * scale;
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .84));
      if (!blob || blob.size > 350000) throw new Error(t('The image is too large.', 'Slika je prevelika.'));
      return blob;
    } finally { URL.revokeObjectURL(url); }
  }

  async function performSearch(query) {
    const panel = root.querySelector('[data-search-results]');
    try {
      const data = await api(`/api/v1/world/search?q=${encodeURIComponent(query)}`); state.search = data.results || [];
      panel.innerHTML = `<header><b>${t('Search your World', 'Pretraži svoj Svijet')}</b><button type="button" data-search-close aria-label="${t('Close search', 'Zatvori pretragu')}">×</button></header>${state.search.length ? state.search.map(item => contextButton({ id: item.publicId, type: String(item.resultType).toLocaleLowerCase().replace(' ', '_'), title: item.title }, true)).join('') : `<p>${t('No matching records.', 'Nema odgovarajućih zapisa.')}</p>`}`;
      panel.hidden = false; panel.querySelector('[data-search-close]').addEventListener('click', () => { panel.hidden = true; }); bindContent();
    } catch (error) { setStatus(error.message, true); }
  }

  function bindShell() {
    root.querySelectorAll('[data-nav]').forEach(link => link.addEventListener('click', event => { if (event.metaKey || event.ctrlKey) return; event.preventDefault(); navigate(link.getAttribute('href')); }));
    root.querySelector('[data-global-search]').addEventListener('submit', event => { event.preventDefault(); const q = new FormData(event.currentTarget).get('q'); if (String(q).trim().length >= 2) performSearch(q); });
    root.querySelector('[data-global-search] input').addEventListener('keydown', event => { if (event.key === 'Enter' && event.currentTarget.value.trim().length < 2) { event.preventDefault(); openCommand({ prefill: event.currentTarget.value }); } });
    root.querySelectorAll('[data-command-open]').forEach(button => button.addEventListener('click', () => openCommand()));
    root.querySelector('[data-profile]').addEventListener('click', openProfile);
    root.querySelector('[data-attention]').addEventListener('click', () => { state.attentionOpen = true; navigate('/app'); });
  }

  function bindContent(contextData) {
    root.querySelectorAll('[data-nav]').forEach(link => { if (link.dataset.bound) return; link.dataset.bound = '1'; link.addEventListener('click', event => { if (event.metaKey || event.ctrlKey) return; event.preventDefault(); navigate(link.getAttribute('href')); }); });
    root.querySelectorAll('[data-open-context]').forEach(button => { if (button.dataset.bound) return; button.dataset.bound = '1'; button.addEventListener('click', () => { const [type, ...id] = button.dataset.openContext.split(':'); navigate(pathFor(type, id.join(':'))); root.querySelector('[data-search-results]')?.setAttribute('hidden', ''); }); });
    root.querySelectorAll('[data-command-open]').forEach(button => { if (button.dataset.bound) return; button.dataset.bound = '1'; button.addEventListener('click', () => openCommand()); });
    root.querySelectorAll('[data-sight-open]').forEach(button => { if (button.dataset.bound) return; button.dataset.bound = '1'; button.addEventListener('click', () => openSight(button.dataset.sightOpen)); });
    root.querySelector('[data-toggle-attention]')?.addEventListener('click', () => { state.attentionOpen = !state.attentionOpen; renderNow(); });
    root.querySelector('[data-retry]')?.addEventListener('click', renderRoute);
    root.querySelector('[data-back]')?.addEventListener('click', () => history.length > 1 ? history.back() : navigate('/app'));
    root.querySelector('[data-passport-toggle]')?.addEventListener('click', () => { const passport = root.querySelector('[data-passport]'); passport.hidden = !passport.hidden; passport.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); });
    root.querySelector('[data-resolve-situation]')?.addEventListener('click', async event => { event.currentTarget.disabled = true; try { await api(`/api/v1/world/situations/${encodeURIComponent(event.currentTarget.dataset.resolveSituation)}`, { method: 'PATCH', body: JSON.stringify({ status: 'RESOLVED' }) }); state.now = null; await renderContext('situation', event.currentTarget.dataset.resolveSituation); } catch (error) { setStatus(error.message, true); } });
    root.querySelector('[data-complete-loop]')?.addEventListener('click', async event => { event.currentTarget.disabled = true; try { await api(`/api/v1/world/open-loops/${encodeURIComponent(event.currentTarget.dataset.completeLoop)}`, { method: 'PATCH', body: JSON.stringify({ status: 'COMPLETED' }) }); state.now = null; history.back(); } catch (error) { setStatus(error.message, true); event.currentTarget.disabled = false; } });
    root.querySelector('[data-retry-receipt]')?.addEventListener('click', async event => { event.currentTarget.disabled = true; try { await api(`/api/v1/world/receipts/${encodeURIComponent(event.currentTarget.dataset.retryReceipt)}/retry`, { method: 'POST', body: '{}' }); renderContext('receipt', event.currentTarget.dataset.retryReceipt); } catch (error) { setStatus(error.message, true); event.currentTarget.disabled = false; } });
    root.querySelectorAll('[data-context-add]').forEach(button => button.addEventListener('click', () => openCommand({ requestedType: button.dataset.contextAdd, context: { type: contextData?.entityType, id: contextData?.entity?.publicId } })));
    root.querySelector('[data-edit-knowledge]')?.addEventListener('click', () => editKnowledge(contextData));
  }

  function editKnowledge(data) {
    const entity = data.entity;
    const dialog = openDialog(t('Edit Knowledge', 'Uredi znanje'), `<form class="sos133-edit" data-edit-form><label>${t('Title', 'Naslov')}<input name="title" value="${esc(entity.title)}" required maxlength="180"></label><label>${t('Knowledge', 'Znanje')}<textarea name="body" required maxlength="50000">${esc(entity.body)}</textarea></label><button class="primary">${t('Save changes', 'Spremi promjene')}</button></form>`);
    dialog.querySelector('[data-edit-form]').addEventListener('submit', async event => { event.preventDefault(); const body = Object.fromEntries(new FormData(event.currentTarget)); await api(`/api/v1/world/knowledge/${encodeURIComponent(entity.publicId)}`, { method: 'PATCH', body: JSON.stringify(body) }); dialog.close(); state.world = null; renderContext('knowledge', entity.publicId); });
  }

  async function renderRoute() {
    const current = route(); updateChrome(current.space === 'context' ? '' : current.space); document.title = `Still · ${current.space === 'context' ? typeLabel(current.type) : current.space.charAt(0).toLocaleUpperCase() + current.space.slice(1)}`;
    if (current.space === 'now') return renderNow();
    if (current.space === 'world') return renderWorld();
    if (current.space === 'market' && window.StillMarketV135) return window.StillMarketV135.render({ host: main(), route: current, helpers: helpers() });
    if (current.space === 'discover') return renderDiscover();
    if (current.space === 'together') return renderTogether();
    return renderContext(current.type, current.id);
  }

  window.addEventListener('popstate', renderRoute);
  window.addEventListener('still:language', () => { applyLanguage(); shell(); renderRoute(); });
  async function start() {
    applyLanguage(); shell(); await migrateLegacyWorld(); await renderRoute();
    const params = new URLSearchParams(location.search), sight = params.get('sight');
    if (sight) { history.replaceState({}, '', location.pathname); openSight(sight); }
    else if (params.get('profile') === '1') { history.replaceState({}, '', location.pathname); openProfile(); }
  }
  start();
})();
