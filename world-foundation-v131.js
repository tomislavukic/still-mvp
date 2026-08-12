(() => {
  if (/^\/company(?:\.html)?\/?$/.test(location.pathname)) return;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const hr = () => $('#language')?.value === 'hr';
  const t = (en, hrv) => hr() ? hrv : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const money = (cents, currency = 'EUR') => cents === null || cents === undefined ? t('Not recorded', 'Nije zabilježeno') : new Intl.NumberFormat(hr() ? 'hr-HR' : 'en-GB', { style: 'currency', currency: currency || 'EUR' }).format(Number(cents) / 100);
  const date = value => value ? new Intl.DateTimeFormat(hr() ? 'hr-HR' : 'en-GB', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : t('Not set', 'Nije postavljeno');
  const state = { view: 'now', data: null, now: null, loading: true, authenticated: null, status: '', error: '', search: [], migrationRunning: false };
  let root, dialog, platformObserver, migratedThisSession = false;

  async function api(path, options = {}) {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), options.timeout || 30000);
    try {
      const headers = { ...(options.headers || {}) };
      if (options.body && !(options.body instanceof FormData) && !headers['content-type']) headers['content-type'] = 'application/json';
      const response = await fetch(path, { credentials: 'same-origin', ...options, headers, signal: controller.signal });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.message || readableError(data.error) || `Request failed (${response.status})`), { status: response.status, data });
      return data;
    } finally { clearTimeout(timeout); }
  }

  function readableError(code) {
    const errors = {
      unauthorized: t('Sign in to use your private World.', 'Prijavi se za korištenje privatnog Svijeta.'),
      duplicate_review_required: t('This may already be in your World. Review the suggested match.', 'Ovo je možda već u tvom Svijetu. Provjeri predloženo podudaranje.'),
      duplicate_receipt: t('This exact receipt was already uploaded.', 'Ovaj je račun već prenesen.'),
      no_text_extracted: t('No readable text was found. Try a clearer photo.', 'Nije pronađen čitljiv tekst. Pokušaj s jasnijom fotografijom.'),
      ocr_provider_failed: t('The receipt could not be read. Retry or enter the details manually.', 'Račun nije moguće pročitati. Pokušaj ponovno ili ručno unesi podatke.'),
      heic_not_supported: t('HEIC is not supported yet. Use JPEG, PNG, or WebP.', 'HEIC još nije podržan. Upotrijebi JPEG, PNG ili WebP.'),
      private_storage_not_configured: t('Private file storage is temporarily unavailable.', 'Privatna pohrana datoteka trenutačno nije dostupna.'),
      waiting_on_required: t('Say who or what you are waiting for.', 'Navedi koga ili što čekaš.'),
      receipt_items_still_need_review: t('Choose what to do with every receipt line.', 'Odaberi što učiniti sa svakom stavkom računa.'),
      processing_consent_required: t('Confirm document processing before upload.', 'Potvrdi obradu dokumenta prije prijenosa.')
    };
    return errors[code] || String(code || t('Something went wrong.', 'Nešto je pošlo po zlu.')).replaceAll('_', ' ');
  }

  function setStatus(message = '', error = false) {
    state.status = error ? '' : message;
    state.error = error ? message : '';
    const live = $('#worldLiveV131');
    if (live) { live.textContent = message; live.dataset.error = String(error); }
  }

  function syncCompatibilityCache(things) {
    try {
      const records = (things || []).map(item => ({ id: item.publicId, publicId: item.publicId, kind: item.kind, title: item.title, business: item.businessName || '', reference: item.reference || '', purchasedOn: item.purchaseDate || '', returnBy: item.returnBy || '', warrantyUntil: item.warrantyUntil || '', renewalAt: item.renewalAt || '', nextActionAt: item.nextActionAt || '', notes: item.notes || '', updatedAt: item.updatedAt }));
      localStorage.setItem('still-ownership-passports-v83', JSON.stringify(records));
      window.dispatchEvent(new CustomEvent('still:ownership-updated', { detail: { count: records.length, source: 'authenticated_world' } }));
    } catch {}
  }

  function legacyRecords(key) {
    try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; } catch { return []; }
  }

  async function runMigration(announce = false) {
    if (state.migrationRunning || state.authenticated !== true) {
      if (announce && state.authenticated !== true) openSignIn();
      return;
    }
    state.migrationRunning = true;
    const sources = ['still-ownership-passports-v83', 'still-saved-purchases-v1'];
    let imported = 0, skipped = 0;
    try {
      for (const source of sources) {
        const records = legacyRecords(source);
        if (!records.length) continue;
        const result = await api('/api/v1/world/migrations/local-storage', { method: 'POST', body: JSON.stringify({ source, records }) });
        imported += result.imported || 0;
        skipped += result.skipped || 0;
      }
      migratedThisSession = true;
      if (announce) setStatus(imported ? t(`${imported} browser record(s) moved into your private World.`, `${imported} zapisa iz preglednika preneseno je u tvoj privatni Svijet.`) : t('Your browser records are already safely accounted for.', 'Zapisi iz preglednika već su sigurno obrađeni.'));
      await refresh(false);
    } catch (error) { setStatus(error.message, true); }
    finally { state.migrationRunning = false; }
    return { imported, skipped };
  }

  async function refresh(migrate = true) {
    state.loading = true; renderBody();
    try {
      const [bootstrap, nowData] = await Promise.all([api('/api/v1/world/bootstrap'), api('/api/v1/world/now')]);
      state.authenticated = true;
      state.data = bootstrap;
      state.now = nowData;
      state.error = '';
      if (migrate && !migratedThisSession && (legacyRecords('still-ownership-passports-v83').length || legacyRecords('still-saved-purchases-v1').length)) { await runMigration(false); return; }
      syncCompatibilityCache(bootstrap.things);
    } catch (error) {
      if (error.status === 401) { state.authenticated = false; state.data = null; state.now = null; }
      else { state.authenticated = null; state.error = error.message; }
    } finally { state.loading = false; renderBody(); }
  }

  function shell() {
    return `<section class="wv131-shell" aria-labelledby="worldTitleV131">
      <header class="wv131-head">
        <div><span>STILL · ${t('YOUR WORLD', 'TVOJ SVIJET')}</span><h2 id="worldTitleV131">${t('Everything you own. Remembered.', 'Sve što posjeduješ. Zapamćeno.')}</h2><p>${t('Things, receipts, knowledge and unfinished business—private, connected and available on every signed-in device.', 'Stvari, računi, znanje i nedovršene obveze—privatno, povezano i dostupno na svakom prijavljenom uređaju.')}</p></div>
        <div class="wv131-head-actions"><button type="button" data-world-add>＋ ${t('Add something', 'Dodaj nešto')}</button><button type="button" data-world-capture>▦ ${t('Scan receipt', 'Skeniraj račun')}</button></div>
      </header>
      <form class="wv131-search" data-world-search role="search"><label><span class="sr-only">${t('Search your World', 'Pretraži svoj Svijet')}</span><input name="q" type="search" minlength="2" maxlength="120" autocomplete="off" placeholder="${t('Search Things, Knowledge, Situations and receipts', 'Pretraži stvari, znanje, situacije i račune')}"></label><button>${t('Search', 'Traži')}</button></form>
      <nav class="wv131-nav" aria-label="${t('World sections', 'Dijelovi Svijeta')}">${[['now',t('Now','Sada')],['things',t('Things','Stvari')],['capture',t('Capture','Snimi')],['knowledge',t('Knowledge','Znanje')],['situations',t('Situations','Situacije')]].map(([id,label])=>`<button type="button" data-world-view="${id}" aria-current="${state.view===id?'page':'false'}">${label}</button>`).join('')}</nav>
      <div id="worldLiveV131" class="wv131-live" role="status" aria-live="polite"></div>
      <div id="worldBodyV131" class="wv131-body" aria-busy="${state.loading}"></div>
    </section>`;
  }

  function renderBody() {
    const body = $('#worldBodyV131');
    if (!body) return;
    $$('.wv131-nav [data-world-view]', root).forEach(button => button.setAttribute('aria-current', String(button.dataset.worldView === state.view ? 'page' : false)));
    if (state.loading) { body.innerHTML = `<div class="wv131-state"><span class="wv131-spinner" aria-hidden="true"></span><b>${t('Opening your World…', 'Otvaram tvoj Svijet…')}</b></div>`; return; }
    if (state.authenticated === false) { body.innerHTML = signedOut(); bindBody(); return; }
    if (!state.data) { body.innerHTML = `<div class="wv131-state error"><b>${t('Your World could not open.', 'Tvoj Svijet nije moguće otvoriti.')}</b><p>${esc(state.error)}</p><button type="button" data-world-retry>${t('Try again', 'Pokušaj ponovno')}</button></div>`; bindBody(); return; }
    body.innerHTML = state.search.length ? searchResults() : state.view === 'things' ? thingsView() : state.view === 'capture' ? captureView() : state.view === 'knowledge' ? knowledgeView() : state.view === 'situations' ? situationsView() : nowViewMarkup();
    bindBody();
    if (state.status || state.error) setStatus(state.status || state.error, Boolean(state.error));
  }

  function signedOut() {
    return `<div class="wv131-state wv131-signin"><span>◎</span><h3>${t('Your World is private.', 'Tvoj Svijet je privatan.')}</h3><p>${t('Sign in as a buyer to keep Things, receipt images, Knowledge and Situations safely available across devices.', 'Prijavi se kao kupac kako bi stvari, slike računa, znanje i situacije sigurno bili dostupni na svim uređajima.')}</p><button type="button" data-world-signin>${t('Sign in with Google', 'Prijavi se Googleom')}</button><small>${t('Business sign-in remains separate.', 'Prijava tvrtke ostaje odvojena.')}</small></div>`;
  }

  function nowViewMarkup() {
    const attention = state.now?.attention || [], recent = state.now?.recent || [];
    return `<div class="wv131-section-head"><div><span>${t('NOW', 'SADA')}</span><h3>${t('What deserves attention', 'Što zaslužuje pažnju')}</h3></div><small>${t('Deterministic: overdue first, then waiting and upcoming.', 'Deterministički: prvo prekoračeno, zatim čekanje i nadolazeće.')}</small></div>
      ${attention.length ? `<div class="wv131-attention">${attention.map(item => `<button type="button" data-world-open="${esc(item.kind)}:${esc(item.entityId || item.publicId)}"><span class="${item.overdue?'urgent':''}">${item.overdue?t('OVERDUE','PREKORAČENO'):item.status==='WAITING'?t('WAITING','ČEKANJE'):t('UPCOMING','NADOLAZI')}</span><b>${esc(item.title)}</b><small>${item.waitingOn?`${t('Waiting on','Čeka se')}: ${esc(item.waitingOn)}`:item.dueAt?date(item.dueAt):t('Active situation','Aktivna situacija')}</small></button>`).join('')}</div>` : empty(t('Nothing needs attention right now.', 'Trenutačno ništa ne traži pažnju.'), t('Add a Thing, Situation or Open Loop when something matters.', 'Dodaj stvar, situaciju ili otvorenu obvezu kada nešto postane važno.'))}
      <div class="wv131-section-head compact"><div><span>${t('RECENT HISTORY', 'NEDAVNA POVIJEST')}</span><h3>${t('What changed', 'Što se promijenilo')}</h3></div></div>
      ${recent.length ? `<ol class="wv131-history">${recent.map(item=>`<li><span></span><div><b>${esc(item.title)}</b><small>${esc(item.entity_type)} · ${date(item.occurred_at)}</small></div></li>`).join('')}</ol>` : empty(t('History starts with your first saved action.', 'Povijest počinje prvom spremljenom radnjom.'), '')}`;
  }

  function thingsView() {
    const things = state.data.things || [];
    return `<div class="wv131-section-head"><div><span>${t('THINGS', 'STVARI')}</span><h3>${t('The meaningful objects in your World', 'Važni objekti u tvom Svijetu')}</h3></div><button type="button" data-world-add>＋ ${t('Add manually', 'Dodaj ručno')}</button></div>
      ${things.length ? `<div class="wv131-things">${things.map(item=>`<button type="button" data-thing="${esc(item.publicId)}"><span>${kindIcon(item.kind)}</span><div><b>${esc(item.title)}</b><small>${esc([item.manufacturer,item.model,item.businessName].filter(Boolean).join(' · ')||kindName(item.kind))}</small></div><em>${item.warrantyUntil?`${t('Warranty','Jamstvo')} ${date(item.warrantyUntil)}`:item.purchaseDate?date(item.purchaseDate):t('Details can be added later','Detalje možeš dodati kasnije')}</em><i>→</i></button>`).join('')}</div>` : empty(t('Your World is ready for its first Thing.', 'Tvoj Svijet spreman je za prvu stvar.'), t('Only a name and type are required.', 'Potrebni su samo naziv i vrsta.'), `<button type="button" data-world-add>${t('Add something', 'Dodaj nešto')}</button>`)}`;
  }

  function captureView() {
    const receipts = state.data.receipts || [];
    const situations=state.data.situations||[];
    const voice=Boolean(window.SpeechRecognition||window.webkitSpeechRecognition);
    return `<div class="wv131-capture-grid"><form class="wv131-upload" data-receipt-upload><span>▦</span><h3>${t('Scan or upload a receipt', 'Skeniraj ili prenesi račun')}</h3><p>${t('Still privately stores the original, reads real text, then waits for your review before creating anything.', 'Still privatno čuva izvornik, čita stvarni tekst i čeka tvoju provjeru prije stvaranja bilo čega.')}</p><label><b>${t('Receipt image', 'Slika računa')}</b><input name="file" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required></label><small>${t('JPEG, PNG or WebP · up to 12 MB. HEIC is not supported yet.', 'JPEG, PNG ili WebP · do 12 MB. HEIC još nije podržan.')}</small><button>${t('Upload and read', 'Prenesi i pročitaj')}</button></form><aside><b>${t('What happens next', 'Što slijedi')}</b><ol><li>${t('Original stored privately', 'Izvornik se čuva privatno')}</li><li>${t('OCR extracts receipt facts and lines', 'OCR izdvaja podatke i stavke računa')}</li><li>${t('You correct and confirm every line', 'Ispravljaš i potvrđuješ svaku stavku')}</li><li>${t('Still creates or links real Things', 'Still stvara ili povezuje stvarne stvari')}</li></ol><small>${t('OCR is evidence, not official verification.', 'OCR je dokaz, a ne službena potvrda.')}</small></aside></div>
      <div class="wv131-section-head compact"><div><span>${t('UNIVERSAL CAPTURE', 'UNIVERZALNI UNOS')}</span><h3>${t('Type, paste or speak', 'Upiši, zalijepi ili izgovori')}</h3></div><small>${t('You choose what it becomes. Still does not guess.', 'Ti biraš što će postati. Still ne nagađa.')}</small></div>
      <form class="wv131-form wv131-quick-capture" data-quick-capture><div class="wv131-form-row"><label>${t('Save as', 'Spremi kao')}<select name="destination"><option value="knowledge">${t('Knowledge','Znanje')}</option><option value="situation">${t('Situation','Situacija')}</option><option value="open_loop">${t('Open Loop','Otvorena obveza')}</option><option value="thing">${t('Thing','Stvar')}</option></select></label><label>${t('Related Situation · optional for Open Loop','Povezana situacija · neobavezno za otvorenu obvezu')}<select name="situationId"><option value="">—</option>${situations.map(optionSituation).join('')}</select></label></div><label>${t('Content','Sadržaj')}<textarea name="content" required maxlength="50000" placeholder="${t('First line becomes the title. Add any useful detail below it.','Prvi redak postaje naslov. Ispod dodaj korisne detalje.')}"></textarea></label><div class="wv131-capture-actions"><button type="button" class="quiet" data-capture-document>↑ ${t('Upload document','Prenesi dokument')}</button>${voice?`<button type="button" class="quiet" data-capture-voice>◉ ${t('Speak','Govori')}</button>`:''}<button>${t('Save to World','Spremi u Svijet')}</button></div></form>
      <div class="wv131-section-head compact"><div><span>${t('RECEIPTS', 'RAČUNI')}</span><h3>${t('Stored and reviewable', 'Pohranjeni i provjerljivi')}</h3></div></div>
      ${receipts.length ? `<div class="wv131-list">${receipts.map(receipt=>`<button type="button" data-receipt="${esc(receipt.publicId)}"><span class="status ${receipt.processingStatus.toLocaleLowerCase()}">${esc(receipt.processingStatus.replaceAll('_',' '))}</span><b>${esc(receipt.merchant||t('Receipt','Račun'))}</b><small>${receipt.purchaseDate?date(receipt.purchaseDate):date(receipt.createdAt)} · ${money(receipt.totalCents,receipt.currency)}</small><i>→</i></button>`).join('')}</div>` : empty(t('No receipts yet.', 'Još nema računa.'), t('Your first upload will stay here after refresh.', 'Prvi prijenos ostat će ovdje i nakon osvježavanja.'))}`;
  }

  function knowledgeView() {
    const items = state.data.knowledge || [], docs = state.data.documents || [], things = state.data.things || [], situations = state.data.situations || [];
    return `<div class="wv131-two"><form class="wv131-form" data-knowledge-create><span>${t('SAVE KNOWLEDGE', 'SPREMI ZNANJE')}</span><h3>${t('Remember something useful', 'Zapamti nešto korisno')}</h3><label>${t('Title', 'Naslov')}<input name="title" required maxlength="180"></label><label>${t('Text or pasted content', 'Tekst ili zalijepljeni sadržaj')}<textarea name="body" required maxlength="50000"></textarea></label><div class="wv131-form-row"><label>${t('Source URL · optional', 'Izvorna poveznica · neobavezno')}<input name="sourceUrl" type="url" maxlength="1000" placeholder="https://…"></label><label>${t('Tags · optional, comma separated', 'Oznake · neobavezno, odvojene zarezom')}<input name="tags" maxlength="400"></label></div><div class="wv131-form-row"><label>${t('Thing · optional', 'Stvar · neobavezno')}<select name="thingId"><option value="">—</option>${things.map(optionThing).join('')}</select></label><label>${t('Situation · optional', 'Situacija · neobavezno')}<select name="situationId"><option value="">—</option>${situations.map(optionSituation).join('')}</select></label></div><button>${t('Save Knowledge', 'Spremi znanje')}</button></form>
      <form class="wv131-form" data-document-upload><span>${t('PRIVATE DOCUMENT', 'PRIVATNI DOKUMENT')}</span><h3>${t('Upload and organize', 'Prenesi i organiziraj')}</h3><label>${t('Document', 'Dokument')}<input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx" required></label><label>${t('Title · optional', 'Naslov · neobavezno')}<input name="title" maxlength="180"></label><label>${t('Type', 'Vrsta')}<select name="documentType"><option value="manual">${t('Manual','Priručnik')}</option><option value="warranty">${t('Warranty','Jamstvo')}</option><option value="quote">${t('Quote','Ponuda')}</option><option value="service">${t('Service record','Servisni zapis')}</option><option value="other">${t('Other','Ostalo')}</option></select></label><label class="wv131-consent"><input type="checkbox" name="consent" required> ${t('I agree to private text extraction so this document can be searched and organized.', 'Prihvaćam privatno izdvajanje teksta kako bi se dokument mogao pretraživati i organizirati.')}</label><button>${t('Upload document', 'Prenesi dokument')}</button></form></div>
      <div class="wv131-section-head compact"><div><span>${t('KNOWLEDGE', 'ZNANJE')}</span><h3>${t('Saved notes and sources', 'Spremljene bilješke i izvori')}</h3></div></div>
      ${items.length ? `<div class="wv131-list">${items.map(item=>`<button type="button" data-knowledge="${esc(item.publicId)}"><span class="type">${esc(item.kind)}</span><b>${esc(item.title)}</b><small>${esc(item.body.slice(0,120))}</small><i>→</i></button>`).join('')}</div>` : empty(t('No Knowledge saved yet.', 'Još nema spremljenog znanja.'), '')}
      ${docs.length ? `<div class="wv131-documents"><h4>${t('Private documents', 'Privatni dokumenti')}</h4>${docs.map(doc=>`<article><span>${esc(doc.documentType)}</span><div><b>${esc(doc.title)}</b><small>${esc(doc.processingStatus)} · ${moneyBytes(doc.bytes)}</small></div>${doc.processingStatus==='READY'?`<button type="button" data-document-knowledge="${esc(doc.publicId)}">${t('Save as Knowledge','Spremi kao znanje')}</button>`:doc.processingStatus==='FAILED'?`<button type="button" data-document-retry="${esc(doc.publicId)}">${t('Retry','Pokušaj ponovno')}</button>`:''}<a href="${esc(doc.originalUrl)}" target="_blank" rel="noopener">${t('Original','Izvornik')}</a><button type="button" class="danger" data-document-delete="${esc(doc.publicId)}">${t('Delete','Izbriši')}</button></article>`).join('')}</div>`:''}`;
  }

  function situationsView() {
    const situations = state.data.situations || [], loops = state.data.openLoops || [], things = state.data.things || [], documents=state.data.documents||[], receipts=state.data.receipts||[];
    return `<div class="wv131-two"><form class="wv131-form" data-situation-create><span>${t('LIVING SITUATION', 'ŽIVA SITUACIJA')}</span><h3>${t('Create a workspace around an outcome', 'Stvori radni prostor oko ishoda')}</h3><label>${t('Name', 'Naziv')}<input name="title" required maxlength="180" placeholder="${t('e.g. Car repair','npr. Popravak automobila')}"></label><label>${t('What is happening? · optional', 'Što se događa? · neobavezno')}<textarea name="description" maxlength="5000"></textarea></label><div class="wv131-form-row"><label>${t('Thing · optional', 'Stvar · neobavezno')}<select name="thingId"><option value="">—</option>${things.map(optionThing).join('')}</select></label><label>${t('Document · optional', 'Dokument · neobavezno')}<select name="documentId"><option value="">—</option>${documents.map(optionDocument).join('')}</select></label></div><div class="wv131-form-row"><label>${t('Receipt · optional', 'Račun · neobavezno')}<select name="receiptId"><option value="">—</option>${receipts.map(optionReceipt).join('')}</select></label><label>${t('Start date · optional', 'Početni datum · neobavezno')}<input name="startDate" type="date"></label></div><label>${t('Due date · optional', 'Rok · neobavezno')}<input name="dueAt" type="date"></label><button>${t('Create Situation', 'Stvori situaciju')}</button></form>
      <div class="wv131-open-loop-summary"><span>${t('OPEN LOOPS', 'OTVORENE OBVEZE')}</span><h3>${loops.length}</h3><p>${t('Things you intend to finish, including what you are waiting for.', 'Stvari koje namjeravaš dovršiti, uključujući ono što čekaš.')}</p>${loops.slice(0,5).map(loop=>`<button type="button" data-loop="${esc(loop.publicId)}"><b>${esc(loop.title)}</b><small>${loop.waitingOn?`${t('Waiting on','Čeka se')}: ${esc(loop.waitingOn)}`:loop.dueAt?date(loop.dueAt):esc(loop.status)}</small></button>`).join('')}</div></div>
      <div class="wv131-section-head compact"><div><span>${t('SITUATIONS', 'SITUACIJE')}</span><h3>${t('Context that stays together', 'Kontekst koji ostaje na okupu')}</h3></div></div>
      ${situations.length ? `<div class="wv131-situations">${situations.map(item=>`<button type="button" data-situation="${esc(item.publicId)}"><span class="${item.status.toLocaleLowerCase()}">${esc(item.status)}</span><b>${esc(item.title)}</b><small>${esc(item.description||t('Open the workspace','Otvori radni prostor'))}</small><em>${item.dueAt?date(item.dueAt):date(item.updatedAt)}</em><i>→</i></button>`).join('')}</div>` : empty(t('No Situations yet.', 'Još nema situacija.'), t('Create one when an outcome needs context, evidence and follow-up.', 'Stvori je kada ishod treba kontekst, dokaze i praćenje.'))}`;
  }

  function searchResults() {
    return `<div class="wv131-section-head"><div><span>${t('SEARCH', 'PRETRAGA')}</span><h3>${state.search.length} ${t('authorized result(s)', 'autoriziranih rezultata')}</h3></div><button type="button" data-search-clear>${t('Clear', 'Očisti')}</button></div>${state.search.length?`<div class="wv131-list">${state.search.map(item=>`<button type="button" data-search-result="${esc(item.resultType)}:${esc(item.publicId)}"><span class="type">${esc(item.resultType)}</span><b>${esc(item.title)}</b><small>${esc(item.subtype||'')}</small><i>→</i></button>`).join('')}</div>`:empty(t('No matching World records.', 'Nema odgovarajućih zapisa u Svijetu.'), '')}`;
  }

  function empty(title, copy, action = '') { return `<div class="wv131-empty"><span>○</span><b>${esc(title)}</b>${copy?`<p>${esc(copy)}</p>`:''}${action}</div>`; }
  function kindIcon(kind) { return ({ product:'◇',service:'◎',subscription:'↻',booking:'◷',rental:'⌂',project:'□' })[kind]||'◇'; }
  function kindName(kind) { return ({product:t('Product','Proizvod'),service:t('Service','Usluga'),subscription:t('Subscription','Pretplata'),booking:t('Booking','Rezervacija'),rental:t('Rental','Najam'),project:t('Project','Projekt')})[kind]||t('Thing','Stvar'); }
  function kindOptions(selected='product') { return ['product','service','subscription','booking','rental','project'].map(kind=>`<option value="${kind}" ${kind===selected?'selected':''}>${kindName(kind)}</option>`).join(''); }
  function optionThing(item, selected = '') { return `<option value="${esc(item.publicId)}" ${item.publicId===selected?'selected':''}>${esc(item.title)}</option>`; }
  function optionSituation(item, selected = '') { return `<option value="${esc(item.publicId)}" ${item.publicId===selected?'selected':''}>${esc(item.title)}</option>`; }
  function optionDocument(item) { return `<option value="${esc(item.publicId)}">${esc(item.title)}</option>`; }
  function optionReceipt(item) { return `<option value="${esc(item.publicId)}">${esc(item.merchant||t('Receipt','Račun'))} · ${item.purchaseDate?date(item.purchaseDate):date(item.createdAt)}</option>`; }
  function relatedEntity(type,id){const groups={thing:state.data?.things,receipt:state.data?.receipts,document:state.data?.documents,knowledge:state.data?.knowledge,open_loop:state.data?.openLoops};const item=(groups[type]||[]).find(value=>value.publicId===id);return item?.title||item?.merchant||id}
  function moneyBytes(bytes) { const value=Number(bytes||0); return value>1048576?`${(value/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(value/1024))} KB`; }

  function bindBody() {
    const body = $('#worldBodyV131'); if (!body) return;
    body.querySelector('[data-world-signin]')?.addEventListener('click', openSignIn);
    body.querySelector('[data-world-retry]')?.addEventListener('click', () => refresh());
    body.querySelectorAll('[data-world-add]').forEach(button => button.addEventListener('click', openAddThing));
    body.querySelector('[data-receipt-upload]')?.addEventListener('submit', uploadReceipt);
    body.querySelector('[data-quick-capture]')?.addEventListener('submit', createQuickCapture);
    body.querySelector('[data-capture-voice]')?.addEventListener('click', startVoiceCapture);
    body.querySelector('[data-capture-document]')?.addEventListener('click',()=>openView('knowledge'));
    body.querySelector('[data-knowledge-create]')?.addEventListener('submit', createKnowledge);
    body.querySelector('[data-document-upload]')?.addEventListener('submit', uploadDocument);
    body.querySelector('[data-situation-create]')?.addEventListener('submit', createSituation);
    body.querySelectorAll('[data-thing]').forEach(button=>button.addEventListener('click',()=>openThing(button.dataset.thing)));
    body.querySelectorAll('[data-receipt]').forEach(button=>button.addEventListener('click',()=>openReceipt(button.dataset.receipt)));
    body.querySelectorAll('[data-knowledge]').forEach(button=>button.addEventListener('click',()=>openKnowledge(button.dataset.knowledge)));
    body.querySelectorAll('[data-situation]').forEach(button=>button.addEventListener('click',()=>openSituation(button.dataset.situation)));
    body.querySelectorAll('[data-loop]').forEach(button=>button.addEventListener('click',()=>openLoop(button.dataset.loop)));
    body.querySelectorAll('[data-document-knowledge]').forEach(button=>button.addEventListener('click',()=>documentToKnowledge(button.dataset.documentKnowledge)));
    body.querySelectorAll('[data-document-retry]').forEach(button=>button.addEventListener('click',()=>retryDocument(button.dataset.documentRetry)));
    body.querySelectorAll('[data-document-delete]').forEach(button=>button.addEventListener('click',()=>deleteDocument(button.dataset.documentDelete)));
    body.querySelector('[data-search-clear]')?.addEventListener('click',()=>{state.search=[];renderBody()});
    body.querySelectorAll('[data-search-result]').forEach(button=>button.addEventListener('click',()=>openSearchResult(button.dataset.searchResult)));
    body.querySelectorAll('[data-world-open]').forEach(button=>button.addEventListener('click',()=>openNowItem(button.dataset.worldOpen)));
  }

  function openSignIn() { const trigger=$('#buyerAuthV77 [data-open]'); if(trigger){trigger.click();setTimeout(()=>$('#googleSignInV77')?.scrollIntoView({behavior:'smooth',block:'center'}),80)} else setStatus(t('Buyer sign-in is still loading. Try again in a moment.','Prijava kupca još se učitava. Pokušaj ponovno za trenutak.'),true); }

  function openDialog(html, label) {
    dialog.innerHTML = `<div class="wv131-dialog-head"><b>${esc(label)}</b><button type="button" data-dialog-close aria-label="${t('Close','Zatvori')}">×</button></div><div class="wv131-dialog-body">${html}</div>`;
    $('[data-dialog-close]',dialog).onclick=()=>dialog.close();
    if(!dialog.open)dialog.showModal();
    setTimeout(()=>$('input,button,select,textarea',dialog)?.focus(),0);
  }

  function openAddThing(prefill = {}) {
    if (prefill instanceof Event) prefill = {};
    if (state.authenticated !== true) return openSignIn();
    const title=cleanPrefill(prefill.title,180),kind=cleanPrefill(prefill.kind,40)||'product',businessName=cleanPrefill(prefill.businessName,180),reference=cleanPrefill(prefill.reference,120);
    openDialog(`<form class="wv131-form modal" data-thing-create><p>${t('Start small. Every detail can be added later.','Počni jednostavno. Svaki detalj možeš dodati kasnije.')}</p><label>${t('Name','Naziv')}<input name="title" value="${esc(title)}" required maxlength="180" autofocus></label><label>${t('Type','Vrsta')}<select name="kind">${kindOptions(kind)}</select></label><label>${t('Business · optional','Tvrtka · neobavezno')}<input name="businessName" value="${esc(businessName)}" maxlength="180"></label><details ${reference?'open':''}><summary>${t('Add details now · optional','Dodaj detalje sada · neobavezno')}</summary><label>${t('Source link · optional','Izvorna poveznica · neobavezno')}<input name="reference" type="url" value="${esc(reference)}" maxlength="120"></label><label>${t('Category','Kategorija')}<input name="category" maxlength="120"></label><div class="wv131-form-row"><label>${t('Manufacturer','Proizvođač')}<input name="manufacturer" maxlength="120"></label><label>${t('Model','Model')}<input name="model" maxlength="120"></label></div><div class="wv131-form-row"><label>${t('Serial number','Serijski broj')}<input name="serialNumber" maxlength="120"></label><label>GTIN<input name="gtin" inputmode="numeric" maxlength="32"></label></div><div class="wv131-form-row"><label>${t('Purchase date','Datum kupnje')}<input name="purchaseDate" type="date"></label><label>${t('Purchase price','Cijena kupnje')}<input name="purchasePrice" inputmode="decimal"></label></div><label>${t('Private notes','Privatne bilješke')}<textarea name="notes" maxlength="3000"></textarea></label></details><button>${t('Add to Still','Dodaj u Still')}</button><div class="wv131-form-error" role="alert"></div></form>`,t('Add something','Dodaj nešto'));
    $('[data-thing-create]',dialog).addEventListener('submit',createThing);
  }

  function cleanPrefill(value,max){return typeof value==='string'?value.trim().slice(0,max):''}

  async function createThing(event) {
    event.preventDefault(); const form=event.currentTarget,button=$('button[type="submit"],button:not([type])',form); button.disabled=true;
    const values=Object.fromEntries(new FormData(form));
    try { await api('/api/v1/world/things',{method:'POST',body:JSON.stringify(values)}); dialog.close(); setStatus(t('Added to your World.','Dodano u tvoj Svijet.')); await refresh(false); state.view='things'; renderBody(); }
    catch(error){const box=$('.wv131-form-error',form);box.textContent=error.message;if(error.data?.candidates)box.textContent+=` ${t('Possible match','Moguće podudaranje')}: ${error.data.candidates.map(item=>item.title).join(', ')}.`}
    finally{button.disabled=false}
  }

  async function uploadReceipt(event) {
    event.preventDefault(); const form=event.currentTarget,file=form.file.files?.[0]; if(!file)return;
    const button=$('button',form);button.disabled=true;button.textContent=t('Uploading and reading…','Prenosim i čitam…');setStatus(t('Receipt upload started. Keep this page open while OCR runs.','Prijenos računa je započeo. Drži stranicu otvorenom dok OCR radi.'));
    const data=new FormData();data.append('file',file);
    try { const result=await api('/api/v1/world/receipts/capture',{method:'POST',body:data,timeout:60000}); await refresh(false); setStatus(t('Found it. Review every extracted field before creating a Thing.','Pronađeno. Provjeri svaki izdvojeni podatak prije stvaranja stvari.')); openReceipt(result.receipt.publicId); }
    catch(error){setStatus(error.message,true);if(error.data?.receipt?.publicId){await refresh(false);openReceipt(error.data.receipt.publicId)}}
    finally{button.disabled=false;button.textContent=t('Upload and read','Prenesi i pročitaj')}
  }

  async function openReceipt(id) {
    try { const {receipt}=await api(`/api/v1/world/receipts/${encodeURIComponent(id)}`); renderReceiptDialog(receipt); }
    catch(error){setStatus(error.message,true)}
  }

  function renderReceiptDialog(receipt) {
    if(receipt.processingStatus==='FAILED'){
      openDialog(`<div class="wv131-failed"><span>!</span><h3>${t('Still could not read this receipt clearly.','Still nije mogao jasno pročitati ovaj račun.')}</h3><p>${esc(receipt.processingError?.message||readableError(receipt.processingError?.code))}</p><div><button type="button" data-receipt-retry>${t('Try OCR again','Ponovi OCR')}</button><button type="button" data-receipt-another>${t('Upload another','Prenesi drugu')}</button><button type="button" data-receipt-manual>${t('Enter manually','Unesi ručno')}</button><a href="${esc(receipt.original.url)}" target="_blank" rel="noopener">${t('View original','Pogledaj izvornik')}</a><button type="button" class="danger" data-receipt-delete>${t('Delete upload','Izbriši prijenos')}</button></div></div>`,t('Receipt','Račun'));
      $('[data-receipt-retry]',dialog).onclick=()=>retryReceipt(receipt.publicId);$('[data-receipt-another]',dialog).onclick=()=>{dialog.close();openView('capture');setTimeout(()=>$('[data-receipt-upload] input[type="file"]',root)?.click(),150)};$('[data-receipt-manual]',dialog).onclick=()=>{dialog.close();openAddThing()};$('[data-receipt-delete]',dialog).onclick=()=>deleteReceipt(receipt.publicId);return;
    }
    const things=state.data?.things||[];
    const itemRows=receipt.items.length?receipt.items.map(item=>receiptItemRow(item,things)).join(''):receiptItemRow({publicId:'',title:'',quantity:1,totalCents:null,currency:receipt.currency,confidence:1,duplicateCandidates:[]},things);
    openDialog(`<form class="wv131-form modal receipt" data-receipt-review data-receipt-id="${esc(receipt.publicId)}"><div class="wv131-receipt-status"><span>${esc(receipt.processingStatus.replaceAll('_',' '))}</span><a href="${esc(receipt.original.url)}" target="_blank" rel="noopener">${t('View private original','Pogledaj privatni izvornik')} ↗</a></div><p>${t('OCR suggestions are unverified until you confirm them. Correct anything that is wrong.','OCR prijedlozi nisu potvrđeni dok ih ne potvrdiš. Ispravi sve što nije točno.')}</p><div class="wv131-form-row"><label>${t('Merchant','Trgovac')}<input name="merchant" value="${esc(receipt.merchant||'')}" maxlength="180"></label><label>${t('Purchase date','Datum kupnje')}<input name="purchaseDate" type="date" value="${esc(receipt.purchaseDate||'')}"></label></div><div class="wv131-form-row"><label>${t('Total','Ukupno')}<input name="total" inputmode="decimal" value="${receipt.totalCents==null?'':esc((receipt.totalCents/100).toFixed(2))}"></label><label>${t('Currency','Valuta')}<input name="currency" value="${esc(receipt.currency||'EUR')}" maxlength="3"></label></div><fieldset><legend>${t('Receipt lines','Stavke računa')}</legend><div data-receipt-items>${itemRows}</div><button type="button" class="quiet" data-add-receipt-line>＋ ${t('Add a missing line','Dodaj stavku koja nedostaje')}</button></fieldset><button>${t('Confirm and connect','Potvrdi i poveži')}</button><button type="button" class="danger" data-receipt-delete>${t('Delete receipt upload','Izbriši preneseni račun')}</button><div class="wv131-form-error" role="alert"></div></form>`,`${receipt.merchant||t('Receipt review','Provjera računa')} · ${receipt.purchaseDate?date(receipt.purchaseDate):''}`);
    const form=$('[data-receipt-review]',dialog);
    form.addEventListener('submit',confirmReceipt);
    $('[data-receipt-delete]',form).onclick=()=>deleteReceipt(receipt.publicId);
    $$('.wv131-receipt-line',form).forEach(bindReceiptLine);
    $('[data-add-receipt-line]',form).onclick=()=>{
      const items=$('[data-receipt-items]',form);
      items.insertAdjacentHTML('beforeend',receiptItemRow({publicId:'',title:'',quantity:1,totalCents:null,currency:receipt.currency,confidence:1,duplicateCandidates:[]},things));
      bindReceiptLine(items.lastElementChild);
    };
  }

  function receiptItemRow(item,things){return `<div class="wv131-receipt-line" data-item-id="${esc(item.publicId||'')}"><label>${t('Product or service','Proizvod ili usluga')}<input data-line-title value="${esc(item.title||'')}" maxlength="180" required></label><label>${t('Line total','Ukupno stavke')}<input data-line-total inputmode="decimal" value="${item.totalCents==null?'':esc((item.totalCents/100).toFixed(2))}"></label><label>${t('What should Still do?','Što Still treba učiniti?')}<select data-line-action><option value="create">${t('Create a new Thing','Stvori novu stvar')}</option>${things.length?`<option value="link">${t('Link an existing Thing','Poveži postojeću stvar')}</option>`:''}<option value="ignore">${t('Ignore this line','Zanemari stavku')}</option></select></label>${things.length?`<label data-link-choice hidden>${t('Existing Thing','Postojeća stvar')}<select data-line-thing>${things.map(optionThing).join('')}</select></label>`:''}<label class="wv131-consent"><input type="checkbox" data-line-separate> ${t('Keep as a separate identical item if a match is found','Zadrži kao zaseban isti predmet ako postoji podudaranje')}</label>${item.duplicateCandidates?.length?`<small class="wv131-candidate">${t('Possible match','Moguće podudaranje')}: ${esc(item.duplicateCandidates.map(candidate=>candidate.title).join(', '))}</small>`:''}</div>`}

  function bindReceiptLine(line){
    const action=$('[data-line-action]',line),choice=$('[data-link-choice]',line);
    if(!action||!choice)return;
    const sync=()=>{choice.hidden=action.value!=='link'};
    action.addEventListener('change',sync);
    sync();
  }

  async function confirmReceipt(event){event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"],button:not([type])',form);button.disabled=true;const lines=$$('.wv131-receipt-line',form);const items=lines.map(line=>{const total=$('[data-line-total]',line).value.trim();const action=$('[data-line-action]',line).value;return{publicId:line.dataset.itemId,title:$('[data-line-title]',line).value.trim(),totalCents:total?Math.round(Number(total.replace(',','.'))*100):null,disposition:action==='create'?'CREATE_THING':action==='link'?'LINK_THING':'IGNORE',currency:form.currency.value.toUpperCase(),action,thingPublicId:action==='link'?$('[data-line-thing]',line)?.value:null,allowDuplicate:$('[data-line-separate]',line).checked}});try{const reviewed=await api(`/api/v1/world/receipts/${encodeURIComponent(form.dataset.receiptId)}/review`,{method:'PATCH',body:JSON.stringify({merchant:form.merchant.value,purchaseDate:form.purchaseDate.value,totalCents:form.total.value?Math.round(Number(form.total.value.replace(',','.'))*100):null,currency:form.currency.value.toUpperCase(),items:items.map(({action,thingPublicId,allowDuplicate,...item})=>item)})});const current=reviewed.receipt;const currentItems=current.items;const newSources=items.filter(item=>!item.publicId);let newIndex=0;const decisions=currentItems.map(currentItem=>{const source=items.find(item=>item.publicId===currentItem.publicId)||newSources[newIndex++];return{publicId:currentItem.publicId,action:source?.action||'create',thingPublicId:source?.thingPublicId||null,title:source?.title||currentItem.title,allowDuplicate:Boolean(source?.allowDuplicate)}});await api(`/api/v1/world/receipts/${encodeURIComponent(form.dataset.receiptId)}/confirm`,{method:'POST',body:JSON.stringify({items:decisions})});dialog.close();setStatus(t('Receipt confirmed. Your real Things and Passport history are updated.','Račun je potvrđen. Stvarne stvari i povijest Putovnice su ažurirani.'));await refresh(false);state.view='things';renderBody()}catch(error){const box=$('.wv131-form-error',form);box.textContent=error.message;if(error.data?.candidates)box.textContent+=` ${error.data.candidates.map(candidate=>candidate.title).join(', ')}.`}finally{button.disabled=false}}

  async function retryReceipt(id){try{setStatus(t('Trying OCR again…','Ponovno pokrećem OCR…'));const result=await api(`/api/v1/world/receipts/${encodeURIComponent(id)}/retry`,{method:'POST',body:'{}',timeout:60000});await refresh(false);renderReceiptDialog(result.receipt)}catch(error){setStatus(error.message,true);dialog.close()}}
  async function deleteReceipt(id){if(!confirm(t('Delete this receipt and its private image? Linked Things and their history will remain.','Izbrisati račun i njegovu privatnu sliku? Povezane stvari i njihova povijest ostat će sačuvani.')))return;try{await api(`/api/v1/world/receipts/${encodeURIComponent(id)}`,{method:'DELETE',body:JSON.stringify({confirmReceiptId:id})});dialog.close();setStatus(t('Receipt deleted. Linked Things were preserved.','Račun je izbrisan. Povezane stvari su sačuvane.'));await refresh(false)}catch(error){setStatus(error.message,true)}}

  async function createQuickCapture(event){
    event.preventDefault();const form=event.currentTarget,button=$('button[type="submit"],button:not([type])',form),values=Object.fromEntries(new FormData(form));
    const content=String(values.content||'').trim(),lines=content.split(/\r?\n/).map(line=>line.trim()).filter(Boolean),title=(lines[0]||'').slice(0,180),details=lines.slice(1).join('\n');
    if(title.length<2)return setStatus(t('Add a clear first line.','Dodaj jasan prvi redak.'),true);
    button.disabled=true;
    try{
      if(values.destination==='thing')await api('/api/v1/world/things',{method:'POST',body:JSON.stringify({title,kind:'product',notes:details||null})});
      else if(values.destination==='situation')await api('/api/v1/world/situations',{method:'POST',body:JSON.stringify({title,description:details||null})});
      else if(values.destination==='open_loop')await api('/api/v1/world/open-loops',{method:'POST',body:JSON.stringify({title,notes:details||null,situationId:values.situationId||null})});
      else await api('/api/v1/world/knowledge',{method:'POST',body:JSON.stringify({title,body:content,sourceType:'PASTED_CONTENT'})});
      form.reset();setStatus(t('Saved to your private World.','Spremljeno u tvoj privatni Svijet.'));await refresh(false);
    }catch(error){setStatus(error.message,true)}finally{button.disabled=false}
  }

  function startVoiceCapture(event){
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition,form=event.currentTarget.closest('form'),field=$('textarea[name="content"]',form);
    if(!Recognition||!field)return setStatus(t('Speech input is not available in this browser.','Govorni unos nije dostupan u ovom pregledniku.'),true);
    const recognition=new Recognition();recognition.lang=hr()?'hr-HR':'en-GB';recognition.interimResults=false;recognition.maxAlternatives=1;
    event.currentTarget.disabled=true;setStatus(t('Listening…','Slušam…'));
    recognition.onresult=result=>{const transcript=result.results?.[0]?.[0]?.transcript||'';field.value=[field.value.trim(),transcript.trim()].filter(Boolean).join('\n');field.focus()};
    recognition.onerror=()=>setStatus(t('Speech was not captured. Type or paste instead.','Govor nije snimljen. Upiši ili zalijepi sadržaj.'),true);
    recognition.onend=()=>{event.currentTarget.disabled=false};recognition.start();
  }

  async function createKnowledge(event){event.preventDefault();const form=event.currentTarget,button=$('button',form);button.disabled=true;try{await api('/api/v1/world/knowledge',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();setStatus(t('Knowledge saved and searchable.','Znanje je spremljeno i može se pretraživati.'));await refresh(false)}catch(error){setStatus(error.message,true)}finally{button.disabled=false}}
  async function uploadDocument(event){event.preventDefault();const form=event.currentTarget,button=$('button',form),data=new FormData(form);data.set('consent',form.consent.checked?'true':'false');button.disabled=true;button.textContent=t('Uploading and extracting…','Prenosim i izdvajam…');try{await api('/api/v1/world/documents',{method:'POST',body:data,timeout:60000});form.reset();setStatus(t('Document stored privately and ready to organize.','Dokument je privatno pohranjen i spreman za organizaciju.'));await refresh(false)}catch(error){setStatus(error.message,true);await refresh(false)}finally{button.disabled=false;button.textContent=t('Upload document','Prenesi dokument')}}
  async function documentToKnowledge(id){const doc=(state.data.documents||[]).find(item=>item.publicId===id);if(!doc)return;try{await api('/api/v1/world/knowledge',{method:'POST',body:JSON.stringify({title:doc.title,kind:doc.documentType,sourceDocumentId:id})});setStatus(t('Document saved into searchable Knowledge.','Dokument je spremljen u pretraživo znanje.'));await refresh(false)}catch(error){setStatus(error.message,true)}}
  async function retryDocument(id){try{await api(`/api/v1/world/documents/${encodeURIComponent(id)}/retry`,{method:'POST',body:'{}',timeout:60000});setStatus(t('Document processing completed.','Obrada dokumenta je dovršena.'));await refresh(false)}catch(error){setStatus(error.message,true)}}
  async function deleteDocument(id){if(!confirm(t('Delete this private document and its original file?','Izbrisati privatni dokument i izvornu datoteku?')))return;try{await api(`/api/v1/world/documents/${encodeURIComponent(id)}`,{method:'DELETE',body:JSON.stringify({confirmDocumentId:id})});setStatus(t('Document deleted.','Dokument je izbrisan.'));await refresh(false)}catch(error){setStatus(error.message,true)}}

  async function openKnowledge(id){
    const item=(state.data.knowledge||[]).find(value=>value.publicId===id);if(!item)return;
    const things=state.data.things||[],situations=state.data.situations||[];
    openDialog(`<form class="wv131-form modal" data-knowledge-edit><label>${t('Title','Naslov')}<input name="title" value="${esc(item.title)}" required maxlength="180"></label><label>${t('Text','Tekst')}<textarea name="body" required maxlength="50000">${esc(item.body)}</textarea></label><div class="wv131-form-row"><label>${t('Source URL · optional','Izvorna poveznica · neobavezno')}<input name="sourceUrl" type="url" value="${esc(item.sourceUrl||'')}" maxlength="1000"></label><label>${t('Tags · comma separated','Oznake · odvojene zarezom')}<input name="tags" value="${esc((item.tags||[]).join(', '))}" maxlength="400"></label></div><div class="wv131-form-row"><label>${t('Linked Thing','Povezana stvar')}<select name="thingId"><option value="">—</option>${things.map(value=>optionThing(value,item.thingId)).join('')}</select></label><label>${t('Linked Situation','Povezana situacija')}<select name="situationId"><option value="">—</option>${situations.map(value=>optionSituation(value,item.situationId)).join('')}</select></label></div><button>${t('Save changes','Spremi promjene')}</button><button type="button" class="danger" data-knowledge-delete>${t('Delete Knowledge','Izbriši znanje')}</button><div class="wv131-form-error" role="alert"></div></form>`,t('Knowledge','Znanje'));
    const form=$('[data-knowledge-edit]',dialog);
    form.onsubmit=async event=>{event.preventDefault();try{await api(`/api/v1/world/knowledge/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(form)))});dialog.close();await refresh(false)}catch(error){$('.wv131-form-error',form).textContent=error.message}};
    $('[data-knowledge-delete]',form).onclick=async()=>{if(!confirm(t('Delete this Knowledge and remove its relationships?','Izbrisati ovo znanje i ukloniti njegove veze?')))return;try{await api(`/api/v1/world/knowledge/${encodeURIComponent(id)}`,{method:'DELETE',body:JSON.stringify({confirmKnowledgeId:id})});dialog.close();await refresh(false)}catch(error){$('.wv131-form-error',form).textContent=error.message}};
  }

  async function createSituation(event){event.preventDefault();const form=event.currentTarget,button=$('button',form);button.disabled=true;try{const result=await api('/api/v1/world/situations',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});form.reset();await refresh(false);openSituation(result.situation.publicId)}catch(error){setStatus(error.message,true)}finally{button.disabled=false}}
  async function openSituation(id){
    try{
      const data=await api(`/api/v1/world/situations/${encodeURIComponent(id)}`),s=data.situation,links=data.relationships||[];
      const targetGroups=[['thing',t('Things','Stvari'),state.data?.things||[]],['receipt',t('Receipts','Računi'),state.data?.receipts||[]],['document',t('Documents','Dokumenti'),state.data?.documents||[]],['knowledge',t('Knowledge','Znanje'),state.data?.knowledge||[]]];
      const targetOptions=targetGroups.map(([type,label,items])=>items.length?`<optgroup label="${esc(label)}">${items.map(item=>`<option value="${type}:${esc(item.publicId)}">${esc(item.title||item.merchant||label)}</option>`).join('')}</optgroup>`:'').join('');
      const linked=links.map(link=>{const outward=link.from_type==='situation'&&link.from_public_id===id,type=outward?link.to_type:link.from_type,entityId=outward?link.to_public_id:link.from_public_id;return `<span><b>${esc(type.replaceAll('_',' '))}</b> ${esc(relatedEntity(type,entityId))}<button type="button" data-remove-relationship="${esc(link.public_id)}" aria-label="${t('Remove relationship','Ukloni vezu')}">×</button></span>`}).join('');
      const today=new Date().toISOString().slice(0,10);
      openDialog(`<div class="wv131-situation-detail"><span class="status ${s.status.toLocaleLowerCase()}">${esc(s.status)}</span><h3>${esc(s.title)}</h3><p>${esc(s.description||t('No description yet.','Još nema opisa.'))}</p><div class="wv131-situation-dates"><span>${t('Started','Započeto')}: <b>${s.startDate?date(s.startDate):t('Not set','Nije postavljeno')}</b></span><span>${t('Due','Rok')}: <b>${s.dueAt?date(s.dueAt):t('Not set','Nije postavljeno')}</b></span></div><section><h4>${t('Linked context','Povezani kontekst')}</h4><div class="wv131-linked">${linked||`<small>${t('Nothing linked yet.','Još ništa nije povezano.')}</small>`}</div>${targetOptions?`<form class="wv131-inline-link" data-situation-link><label><span class="sr-only">${t('Choose a World record','Odaberi zapis Svijeta')}</span><select name="target" required><option value="">${t('Choose context…','Odaberi kontekst…')}</option>${targetOptions}</select></label><button>${t('Link','Poveži')}</button></form>`:''}</section><details class="wv131-edit-situation"><summary>${t('Edit Situation','Uredi situaciju')}</summary><form class="wv131-form" data-situation-edit><label>${t('Title','Naslov')}<input name="title" value="${esc(s.title)}" required maxlength="180"></label><label>${t('Description','Opis')}<textarea name="description" maxlength="5000">${esc(s.description||'')}</textarea></label><div class="wv131-form-row"><label>${t('Status','Status')}<select name="status"><option value="ACTIVE" ${s.status==='ACTIVE'?'selected':''}>ACTIVE</option><option value="WAITING" ${s.status==='WAITING'?'selected':''}>WAITING</option><option value="RESOLVED" ${s.status==='RESOLVED'?'selected':''}>RESOLVED</option></select></label><label>${t('Start date','Početni datum')}<input name="startDate" type="date" value="${esc(s.startDate||'')}"></label></div><label>${t('Due date','Rok')}<input name="dueAt" type="date" value="${esc(s.dueAt||'')}"></label><button>${t('Save Situation','Spremi situaciju')}</button></form></details><section><h4>${t('Knowledge','Znanje')}</h4>${data.knowledge.length?`<div class="wv131-context-list">${data.knowledge.map(item=>`<button type="button" data-knowledge="${esc(item.publicId)}"><b>${esc(item.title)}</b><small>${esc(item.body.slice(0,100))}</small></button>`).join('')}</div>`:empty(t('No linked Knowledge.','Nema povezanog znanja.'),'')}</section><form class="wv131-form" data-loop-create><h4>${t('Add an Open Loop','Dodaj otvorenu obvezu')}</h4><label>${t('What remains open?','Što ostaje otvoreno?')}<input name="title" required maxlength="180"></label><div class="wv131-form-row"><label>${t('Type','Vrsta')}<select name="type"><option value="ACTION">ACTION</option><option value="WAITING">WAITING</option><option value="DECISION">DECISION</option><option value="PROMISE">PROMISE</option><option value="PAYMENT">PAYMENT</option><option value="FOLLOW_UP">FOLLOW UP</option></select></label><label>${t('Status','Status')}<select name="status"><option value="OPEN">OPEN</option><option value="WAITING">WAITING</option></select></label></div><div class="wv131-form-row"><label>${t('Expected / due date','Očekivani datum / rok')}<input name="dueAt" type="date"></label><label>${t('Waiting on · required for WAITING','Čeka se · obavezno za WAITING')}<input name="waitingOn" maxlength="300"></label></div><label>${t('Notes · optional','Bilješke · neobavezno')}<textarea name="notes" maxlength="3000"></textarea></label><button>${t('Add Open Loop','Dodaj otvorenu obvezu')}</button></form><div class="wv131-loop-list">${data.loops.length?data.loops.map(loop=>{const stillWaiting=loop.status==='WAITING'&&loop.dueAt&&loop.dueAt<today;return `<article><span>${esc(stillWaiting?t('STILL WAITING','JOŠ SE ČEKA'):loop.status)}</span><b>${esc(loop.title)}</b><small>${loop.waitingOn?`${t('Waiting on','Čeka se')}: ${esc(loop.waitingOn)}`:loop.dueAt?date(loop.dueAt):''}${loop.notes?` · ${esc(loop.notes)}`:''}</small>${!['COMPLETED','CANCELLED'].includes(loop.status)?`<button type="button" data-complete-loop="${esc(loop.publicId)}">${t('Complete','Dovrši')}</button>`:''}</article>`}).join(''):empty(t('No Open Loops.','Nema otvorenih obveza.'),'')}</div><section><h4>${t('Recent history','Nedavna povijest')}</h4>${data.history.length?`<ol class="wv131-history">${data.history.map(item=>`<li><span></span><div><b>${esc(item.title)}</b><small>${date(item.occurred_at)}</small></div></li>`).join('')}</ol>`:empty(t('No Situation history yet.','Još nema povijesti situacije.'),'')}</section><div class="wv131-passport-actions"><button type="button" class="wv131-resolve" data-resolve-situation ${s.status==='RESOLVED'?'disabled':''}>${s.status==='RESOLVED'?t('Resolved','Riješeno'):t('Resolve Situation','Riješi situaciju')}</button><button type="button" class="danger" data-archive-situation>${t('Archive Situation','Arhiviraj situaciju')}</button></div></div>`,t('Situation workspace','Radni prostor situacije'));
      const loopForm=$('[data-loop-create]',dialog);loopForm.onsubmit=async event=>{event.preventDefault();try{await api('/api/v1/world/open-loops',{method:'POST',body:JSON.stringify({...Object.fromEntries(new FormData(loopForm)),situationId:id})});await refresh(false);openSituation(id)}catch(error){setStatus(error.message,true)}};
      const editForm=$('[data-situation-edit]',dialog);editForm.onsubmit=async event=>{event.preventDefault();try{await api(`/api/v1/world/situations/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(editForm)))});await refresh(false);openSituation(id)}catch(error){setStatus(error.message,true)}};
      const linkForm=$('[data-situation-link]',dialog);if(linkForm)linkForm.onsubmit=async event=>{event.preventDefault();const [toType,...idParts]=new FormData(linkForm).get('target').split(':');try{await api('/api/v1/world/relationships',{method:'POST',body:JSON.stringify({fromType:'situation',fromId:id,toType,toId:idParts.join(':'),relationship:'context'})});await refresh(false);openSituation(id)}catch(error){setStatus(error.message,true)}};
      $$('[data-remove-relationship]',dialog).forEach(button=>button.onclick=()=>removeRelationship(button.dataset.removeRelationship,id));
      $$('[data-complete-loop]',dialog).forEach(button=>button.onclick=()=>completeLoop(button.dataset.completeLoop,id));
      $$('[data-knowledge]',dialog).forEach(button=>button.onclick=()=>openKnowledge(button.dataset.knowledge));
      $('[data-resolve-situation]',dialog).onclick=async()=>{try{await api(`/api/v1/world/situations/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'RESOLVED'})});await refresh(false);openSituation(id)}catch(error){setStatus(error.message,true)}};
      $('[data-archive-situation]',dialog).onclick=()=>archiveSituation(id);
    }catch(error){setStatus(error.message,true)}
  }
  async function removeRelationship(id,situationId){if(!confirm(t('Remove this relationship? The linked record will remain.','Ukloniti ovu vezu? Povezani zapis ostat će sačuvan.')))return;try{await api(`/api/v1/world/relationships/${encodeURIComponent(id)}`,{method:'DELETE',body:JSON.stringify({confirmRelationshipId:id})});await refresh(false);openSituation(situationId)}catch(error){setStatus(error.message,true)}}
  async function archiveSituation(id){if(!confirm(t('Archive this Situation and cancel its unfinished Open Loops?','Arhivirati situaciju i otkazati nedovršene otvorene obveze?')))return;try{await api(`/api/v1/world/situations/${encodeURIComponent(id)}`,{method:'DELETE',body:JSON.stringify({confirmSituationId:id})});dialog.close();await refresh(false)}catch(error){setStatus(error.message,true)}}
  async function completeLoop(id,situationId){try{await api(`/api/v1/world/open-loops/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({status:'COMPLETED'})});await refresh(false);openSituation(situationId)}catch(error){setStatus(error.message,true)}}
  async function openLoop(id){const loop=(state.data.openLoops||[]).find(item=>item.publicId===id);if(loop?.situationId)return openSituation(loop.situationId);}

  async function openThing(id){
    try{
      const data=await api(`/api/v1/world/things/${encodeURIComponent(id)}`),thing=data.thing;
      const identity=[['manufacturer',t('Manufacturer','Proizvođač'),thing.manufacturer],['model','Model',thing.model],['serialNumber',t('Serial number','Serijski broj'),thing.serialNumber],['gtin','GTIN',thing.gtin],['category',t('Category','Kategorija'),thing.category]];
      const purchase=[['businessName',t('Business','Tvrtka'),thing.businessName],['purchaseDate',t('Purchase date','Datum kupnje'),thing.purchaseDate?date(thing.purchaseDate):null],['purchasePriceCents',t('Purchase price','Cijena kupnje'),thing.purchasePriceCents==null?null:money(thing.purchasePriceCents,thing.currency)],['reference',t('Reference','Referenca'),thing.reference]];
      const fieldList=fields=>fields.filter(([, ,value])=>value).map(([key,label,value])=>`<div><dt>${esc(label)}</dt><dd><b>${esc(value)}</b><small>${sourceLabel(thing.provenance[key])}</small></dd></div>`).join('')||`<p>${t('Details can be added when they become useful.','Detalje možeš dodati kada postanu korisni.')}</p>`;
      const related=(data.relationships||[]).map(link=>{const outward=link.from_type==='thing'&&link.from_public_id===id;return{type:outward?link.to_type:link.from_type,id:outward?link.to_public_id:link.from_public_id}});
      const documentIds=new Set(related.filter(link=>link.type==='document').map(link=>link.id)),receiptIds=new Set([...related.filter(link=>link.type==='receipt').map(link=>link.id),...(thing.receiptIds||[])]);
      const documents=(state.data.documents||[]).filter(item=>documentIds.has(item.publicId)),receipts=(state.data.receipts||[]).filter(item=>receiptIds.has(item.publicId)),serviceDocs=documents.filter(item=>item.documentType==='service');
      openDialog(`<div class="wv131-passport"><header><span>PASSPORT</span><h3>${esc(thing.title)}</h3><p>${esc([thing.manufacturer,thing.model,thing.businessName].filter(Boolean).join(' · ')||kindName(thing.kind))}</p></header><section><h4>${t('Identity','Identitet')}</h4><dl>${fieldList(identity)}</dl></section><section><h4>${t('Ownership and purchase','Vlasništvo i kupnja')}</h4><dl>${fieldList(purchase)}</dl></section><section><h4>${t('Documents and receipts','Dokumenti i računi')}</h4>${documents.length||receipts.length?`<div class="wv131-context-list">${documents.map(item=>`<a href="${esc(item.originalUrl)}" target="_blank" rel="noopener"><b>${esc(item.title)}</b><small>${esc(item.documentType)}</small></a>`).join('')}${receipts.map(item=>`<button type="button" data-receipt="${esc(item.publicId)}"><b>${esc(item.merchant||t('Receipt','Račun'))}</b><small>${item.purchaseDate?date(item.purchaseDate):date(item.createdAt)}</small></button>`).join('')}</div>`:empty(t('No linked documents or receipts.','Nema povezanih dokumenata ili računa.'),'')}<button type="button" class="quiet" data-attach-receipt>${t('Scan or link a receipt','Skeniraj ili poveži račun')}</button></section><section><h4>${t('Warranty','Jamstvo')}</h4>${thing.warrantyUntil?`<p><b>${t('Coverage recorded until','Pokriće zabilježeno do')} ${date(thing.warrantyUntil)}</b><small>${sourceLabel(thing.provenance.warrantyUntil)}</small></p>`:empty(t('No warranty date recorded.','Datum jamstva nije zabilježen.'),'')}</section><section><h4>${t('Service','Servis')}</h4>${serviceDocs.length?`<div class="wv131-context-list">${serviceDocs.map(item=>`<a href="${esc(item.originalUrl)}" target="_blank" rel="noopener"><b>${esc(item.title)}</b><small>${date(item.updatedAt)}</small></a>`).join('')}</div>`:empty(t('No service documents linked yet.','Još nema povezanih servisnih dokumenata.'),'')}</section><section><h4>${t('Evidence and provenance','Dokazi i podrijetlo')}</h4>${data.evidence.length?data.evidence.map(item=>`<article><b>${esc(item.field||item.type)}</b><small>${esc(item.provenance)} · ${esc(item.verification)}${item.confidence==null?'':` · ${Math.round(item.confidence*100)}%`}</small></article>`).join(''):empty(t('No attached evidence yet.','Još nema priloženih dokaza.'),'')}</section><section><h4>${t('History','Povijest')}</h4>${data.history.length?`<ol class="wv131-history">${data.history.map(item=>`<li><span></span><div><b>${esc(item.title)}</b><small>${date(item.occurred_at)}</small></div></li>`).join('')}</ol>`:empty(t('History starts with the first saved event.','Povijest počinje prvim spremljenim događajem.'),'')}</section><div class="wv131-passport-actions"><button type="button" data-passport-qr>${t('Create private QR link','Stvori privatnu QR poveznicu')}</button><button type="button" class="danger" data-thing-archive>${t('Archive Thing','Arhiviraj stvar')}</button></div><div data-qr-output></div></div>`,t('Product Passport','Putovnica proizvoda'));
      $('[data-passport-qr]',dialog).onclick=()=>createPassportQr(id);$('[data-thing-archive]',dialog).onclick=()=>archiveThing(thing);$('[data-attach-receipt]',dialog).onclick=()=>{dialog.close();openView('capture')};$$('[data-receipt]',dialog).forEach(button=>button.onclick=()=>openReceipt(button.dataset.receipt));
    }catch(error){setStatus(error.message,true)}
  }
  function sourceLabel(source){if(!source)return t('Existing record · unverified','Postojeći zapis · nije verificiran');return `${esc(String(source.source||'record').replaceAll('_',' '))} · ${esc(String(source.verification||'UNVERIFIED').replaceAll('_',' '))}`}
  async function createPassportQr(id){const out=$('[data-qr-output]',dialog);try{const result=await api(`/api/v1/ownership/passports/${encodeURIComponent(id)}/shares`,{method:'POST',body:JSON.stringify({days:30})});out.innerHTML=`<div class="wv131-qr"><div data-qr-canvas></div><b>${t('Revocable link · 30 days','Opoziva poveznica · 30 dana')}</b><a href="${esc(result.verifyUrl)}" target="_blank" rel="noopener">${esc(result.verifyUrl)}</a></div>`;if(typeof window.qrcode==='function'){const qr=window.qrcode(0,'H');qr.addData(new URL(result.verifyUrl,location.origin).href);qr.make();$('[data-qr-canvas]',out).innerHTML=qr.createSvgTag({cellSize:5,margin:2,scalable:true})}}catch(error){out.textContent=error.message}}
  async function archiveThing(thing){if(!confirm(t(`Archive “${thing.title}”? Evidence and history will be preserved.`,`Arhivirati „${thing.title}”? Dokazi i povijest bit će sačuvani.`)))return;try{await api(`/api/v1/world/things/${encodeURIComponent(thing.publicId)}`,{method:'DELETE',body:JSON.stringify({confirmTitle:thing.title})});dialog.close();await refresh(false)}catch(error){setStatus(error.message,true)}}

  function openSearchResult(value){const [type,id]=value.split(':');if(type==='Thing')openThing(id);else if(type==='Receipt')openReceipt(id);else if(type==='Knowledge')openKnowledge(id);else if(type==='Situation')openSituation(id);else if(type==='Open Loop')openLoop(id);else{state.view='knowledge';state.search=[];renderBody()}}
  function openNowItem(value){const [kind,...parts]=value.split(':');const id=parts.join(':');if(kind==='situation')openSituation(id);else if(kind==='open_loop')openLoop(id);else if(kind==='thing_deadline')openThing(id)}

  function bindRoot(){root.querySelectorAll('[data-world-view]').forEach(button=>button.addEventListener('click',()=>{state.view=button.dataset.worldView;state.search=[];renderBody()}));root.querySelectorAll('[data-world-add]').forEach(button=>button.addEventListener('click',openAddThing));root.querySelectorAll('[data-world-capture]').forEach(button=>button.addEventListener('click',()=>openView('capture')));$('[data-world-search]',root).addEventListener('submit',async event=>{event.preventDefault();const q=new FormData(event.currentTarget).get('q');try{state.search=(await api(`/api/v1/world/search?q=${encodeURIComponent(q)}`)).results;renderBody()}catch(error){setStatus(error.message,true)}})}
  function openView(view){state.view=view;state.search=[];renderBody();setTimeout(()=>root.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'}),20)}

  function mount(){
    if(document.body.classList.contains('business-page')||root?.isConnected)return;
    const anchor=$('#ownershipHubV83');
    if(!anchor)return setTimeout(mount,100);
    root=document.createElement('section');root.id='worldFoundationV131';root.className='wv131 still-v114-tool';root.innerHTML=shell();anchor.insertAdjacentElement('beforebegin',root);
    dialog=$('#worldDialogV131');
    if(!dialog){dialog=document.createElement('dialog');dialog.id='worldDialogV131';dialog.className='wv131-dialog';dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close()});document.body.appendChild(dialog)}
    bindRoot();renderBody();refresh();
    window.StillWorld={open:view=>openView(view||'now'),openAdd:prefill=>openAddThing(prefill),openCapture:()=>openView('capture'),openDocuments:()=>openView('knowledge'),runMigration};
    const platform=$('#ownershipPlatformV83');
    if(platform&&!platformObserver){platformObserver=new MutationObserver(()=>{if(root&&!root.isConnected){root=null;mount()}});platformObserver.observe(platform,{childList:true})}
  }
  window.addEventListener('still:buyer-authenticated',()=>refresh());
  window.addEventListener('still:language',()=>setTimeout(()=>{if(!root?.isConnected){root=null;mount();return}root.innerHTML=shell();bindRoot();renderBody()},80));
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',mount):mount();
})();
