(() => {
  if (window.StillNeedsV134) return;
  const active = new Set(['DETECTED', 'NEEDS_CONFIRMATION', 'ACTIVE', 'HANDLING', 'WAITING']);
  const types = ['REPAIR', 'REPLACE', 'BUY', 'SELL', 'SERVICE', 'HIRE', 'LEARN', 'DECIDE', 'FOLLOW_UP', 'RENEW', 'MAINTAIN', 'FIND', 'BOOK', 'BORROW', 'RENT', 'OTHER'];
  const resolutions = ['KEEP', 'DO_IT', 'LEARN', 'REPAIR', 'REPLACE', 'BUY', 'SELL', 'HIRE', 'BORROW', 'RENT', 'WAIT', 'OTHER'];
  const money = (value, currency = 'EUR') => Number.isFinite(value) ? new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value / 100) : '';
  const statusLabel = (value, h) => ({
    DETECTED: h.t('Detected', 'Otkriveno'), NEEDS_CONFIRMATION: h.t('Needs confirmation', 'Traži potvrdu'), ACTIVE: h.t('Active', 'Aktivno'),
    HANDLING: h.t('Handling', 'U rješavanju'), WAITING: h.t('Waiting', 'Čekanje'), RESOLVED: h.t('Resolved', 'Riješeno'),
    DISMISSED: h.t('Dismissed', 'Odbačeno'), CANCELLED: h.t('Cancelled', 'Otkazano')
  })[value] || value;
  const typeLabel = (value, h) => ({
    REPAIR: h.t('Repair', 'Popravak'), REPLACE: h.t('Replace', 'Zamjena'), BUY: h.t('Buy', 'Kupnja'), SELL: h.t('Sell', 'Prodaja'),
    SERVICE: h.t('Service', 'Servis'), HIRE: h.t('Hire help', 'Angažiraj pomoć'), LEARN: h.t('Learn', 'Saznaj'), DECIDE: h.t('Decide', 'Odluči'),
    FOLLOW_UP: h.t('Follow up', 'Nastavi pratiti'), RENEW: h.t('Renew', 'Obnovi'), MAINTAIN: h.t('Maintain', 'Održavanje'), FIND: h.t('Find', 'Pronađi'),
    BOOK: h.t('Book', 'Rezerviraj'), BORROW: h.t('Borrow', 'Posudi'), RENT: h.t('Rent', 'Najam'), OTHER: h.t('Other', 'Ostalo')
  })[value] || value;

  function needRow(need, h) {
    return `<button type="button" class="need134-row" data-open-context="need:${h.esc(need.publicId)}"><span aria-hidden="true">◎</span><div><small>${h.esc(typeLabel(need.type, h))} · ${h.esc(statusLabel(need.status, h))}</small><b>${h.esc(need.title)}</b>${need.dueAt ? `<em>${h.date(need.dueAt)}</em>` : ''}</div><i aria-hidden="true">→</i></button>`;
  }

  function contextNeeds(data, h) {
    const needs = data?.needs || [];
    return `<section class="sos133-workspace-section need134-context"><header><span>${h.t('NEEDS', 'POTREBE')}</span><h2>${h.t('What this may need', 'Što bi ovo moglo trebati')}</h2></header>${needs.length ? `<div>${needs.map(item => needRow(item, h)).join('')}</div>` : `<p class="sos133-muted">${h.t('No Need is linked to this context.', 'Nijedna potreba nije povezana s ovim kontekstom.')}</p>`}<button type="button" class="need134-create-inline" data-create-need>${h.t('Create a Need', 'Stvori potrebu')} <span aria-hidden="true">＋</span></button></section>`;
  }

  function worldNeeds(needs, h) {
    return `<section class="sos133-family need134-family"><header><div><span>${h.t('NEEDS', 'POTREBE')}</span><h2>${h.t('Things that need handling', 'Ono što treba riješiti')}</h2></div><small>${needs.length}</small></header><div class="need134-filters" role="group" aria-label="${h.t('Filter Needs', 'Filtriraj potrebe')}"><button type="button" data-needs-filter="OPEN" aria-pressed="true">${h.t('Open', 'Otvoreno')}</button><button type="button" data-needs-filter="WAITING">${h.t('Waiting', 'Čekanje')}</button><button type="button" data-needs-filter="RESOLVED">${h.t('Resolved', 'Riješeno')}</button></div><div data-needs-list>${needs.filter(item => active.has(item.status) && item.status !== 'WAITING').map(item => needRow(item, h)).join('') || `<p class="sos133-muted">${h.t('Nothing needs handling right now.', 'Trenutačno ništa ne traži rješavanje.')}</p>`}</div></section>`;
  }

  function intakeOptions(selected, h) {
    return types.map(type => `<option value="${type}" ${type === selected ? 'selected' : ''}>${h.esc(typeLabel(type, h))}</option>`).join('');
  }

  function openIntake(context = {}, h, proposed = {}) {
    const selected = types.includes(proposed.needType) ? proposed.needType : 'OTHER';
    const dialog = h.openDialog(h.t('Create a Need', 'Stvori potrebu'), `<form class="need134-form" data-need-intake><p>${h.t('Capture only what you know. You can add details later.', 'Zabilježi samo ono što znaš. Detalje možeš dodati poslije.')}</p><label>${h.t('What do you need?', 'Što trebaš?')}<input name="title" required minlength="2" maxlength="180" value="${h.esc(proposed.title || '')}" autofocus></label><label>${h.t('Type', 'Vrsta')}<select name="needType">${intakeOptions(selected, h)}</select></label><label>${h.t('Useful context (optional)', 'Koristan kontekst (neobavezno)')}<textarea name="description" maxlength="5000">${h.esc(proposed.description || '')}</textarea></label><div class="need134-form-grid"><label>${h.t('Urgency', 'Hitnost')}<select name="urgency"><option value="NORMAL">${h.t('Normal', 'Normalno')}</option><option value="LOW">${h.t('Low', 'Nisko')}</option><option value="HIGH">${h.t('High', 'Visoko')}</option><option value="URGENT">${h.t('Urgent', 'Hitno')}</option></select></label><label>${h.t('Due date (optional)', 'Rok (neobavezno)')}<input name="dueAt" type="date"></label></div><button class="primary">${h.t('Add to my World', 'Dodaj u moj Svijet')}</button><div class="need134-duplicate" data-need-duplicate hidden></div></form>`, 'need134-dialog');
    const form = dialog.querySelector('[data-need-intake]');
    form.addEventListener('submit', async event => {
      event.preventDefault(); const button = form.querySelector('.primary'); button.disabled = true;
      const values = Object.fromEntries(new FormData(form));
      const payload = { ...values, sourceType: proposed.sourceType || 'USER_CREATED', confidence: proposed.confidence || 'CONFIRMED', ...linkPayload(context) };
      if (!payload.dueAt) delete payload.dueAt;
      try {
        const result = await h.api('/api/v1/world/needs', { method: 'POST', body: JSON.stringify(payload) });
        dialog.close(); h.invalidate(); h.setStatus(h.t('Need added to your World.', 'Potreba je dodana u tvoj Svijet.')); h.navigate(h.pathFor('need', result.need.publicId));
      } catch (error) {
        if (error.status === 409 && error.data?.matches?.length) {
          const host = form.querySelector('[data-need-duplicate]'); host.hidden = false;
          host.innerHTML = `<b>${h.t('A similar open Need already exists.', 'Slična otvorena potreba već postoji.')}</b>${error.data.matches.map(item => needRow(item, h)).join('')}<button type="button" data-save-duplicate>${h.t('Create a separate Need anyway', 'Svejedno stvori zasebnu potrebu')}</button>`;
          host.querySelector('[data-save-duplicate]').addEventListener('click', async () => { payload.allowDuplicate = true; const result = await h.api('/api/v1/world/needs', { method: 'POST', body: JSON.stringify(payload) }); dialog.close(); h.invalidate(); h.navigate(h.pathFor('need', result.need.publicId)); });
          h.bindContent();
        } else h.setStatus(error.message, true);
        button.disabled = false;
      }
    });
    return dialog;
  }

  function linkPayload(context) {
    const key = { thing: 'thingId', situation: 'situationId', knowledge: 'knowledgeId', open_loop: 'openLoopId', receipt: 'receiptId', document: 'documentId' }[context.type];
    return key && context.id ? { [key]: context.id } : {};
  }

  function quoteCard(quote, h) {
    return `<article class="need134-quote"><div><small>${h.t('QUOTE', 'PONUDA')}</small><h3>${h.esc(quote.providerName)}</h3><p>${h.esc(quote.description || h.t('No description supplied.', 'Opis nije dodan.'))}</p></div><strong>${h.esc(money(quote.amountCents, quote.currency))}</strong>${quote.validUntil ? `<span>${h.t('Valid until', 'Vrijedi do')} ${h.date(quote.validUntil)}</span>` : ''}<button type="button" data-select-quote="${h.esc(quote.publicId)}" ${quote.selectedAt ? 'disabled' : ''}>${quote.selectedAt ? h.t('Selected', 'Odabrano') : h.t('Select quote', 'Odaberi ponudu')}</button></article>`;
  }

  function openQuote(data, h) {
    const needId = data.need.publicId, documents = [...(data.linked || []).filter(item => item.type === 'document'), ...(data.thingContext?.documents || []), ...(data.situationContext?.documents || [])].filter((item, index, list) => list.findIndex(other => other.publicId === item.publicId) === index);
    const dialog = h.openDialog(h.t('Add a real quote', 'Dodaj stvarnu ponudu'), `<form class="need134-form" data-quote-form><p>${h.t('Record only a quote you actually received. Still does not verify provider quality.', 'Zabilježi samo ponudu koju si stvarno primio. Still ne potvrđuje kvalitetu pružatelja.')}</p><label>${h.t('Provider', 'Pružatelj')}<input name="providerName" required minlength="2" maxlength="180"></label><div class="need134-form-grid"><label>${h.t('Amount', 'Iznos')}<input name="amount" required inputmode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?"></label><label>${h.t('Currency', 'Valuta')}<select name="currency"><option>EUR</option><option>USD</option><option>GBP</option><option>CHF</option></select></label></div><label>${h.t('What is included? (optional)', 'Što je uključeno? (neobavezno)')}<textarea name="description" maxlength="2000"></textarea></label>${documents.length ? `<label>${h.t('Quote document (optional)', 'Dokument ponude (neobavezno)')}<select name="documentId"><option value="">—</option>${documents.map(item => `<option value="${h.esc(item.publicId)}">${h.esc(item.title)}</option>`).join('')}</select></label>` : ''}<label>${h.t('Valid until (optional)', 'Vrijedi do (neobavezno)')}<input name="validUntil" type="date"></label><button class="primary">${h.t('Save quote', 'Spremi ponudu')}</button></form>`, 'need134-dialog');
    dialog.querySelector('[data-quote-form]').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget, values = Object.fromEntries(new FormData(form)), amount = Number(String(values.amount).replace(',', '.')); form.querySelector('.primary').disabled = true; try { await h.api(`/api/v1/world/needs/${encodeURIComponent(needId)}/quotes`, { method: 'POST', body: JSON.stringify({ ...values, amountCents: Math.round(amount * 100) }) }); dialog.close(); h.invalidate(); h.renderNeed(needId); } catch (error) { h.setStatus(error.message, true); form.querySelector('.primary').disabled = false; } });
  }

  function openResolve(data, h) {
    const selected = data.quotes.find(quote => quote.selectedAt);
    const dialog = h.openDialog(h.t('Mark this handled', 'Označi kao riješeno'), `<form class="need134-form" data-resolve-form><p>${h.t('Record what actually happened. This becomes part of the Need history.', 'Zabilježi što se stvarno dogodilo. To postaje dio povijesti potrebe.')}</p><label>${h.t('How was it handled?', 'Kako je riješeno?')}<select name="resolutionType">${resolutions.map(type => `<option value="${type}" ${type === data.need.type ? 'selected' : ''}>${h.esc(typeLabel(type, h))}</option>`).join('')}</select></label><label>${h.t('Outcome', 'Ishod')}<textarea name="summary" required minlength="2" maxlength="2000"></textarea></label><div class="need134-form-grid"><label>${h.t('Final cost (optional)', 'Konačni trošak (neobavezno)')}<input name="cost" inputmode="decimal"></label><label>${h.t('Provider (optional)', 'Pružatelj (neobavezno)')}<input name="providerName" maxlength="180" value="${h.esc(selected?.providerName || '')}"></label></div>${selected ? `<input type="hidden" name="selectedQuoteId" value="${h.esc(selected.publicId)}">` : ''}<button class="primary">${h.t('Save outcome', 'Spremi ishod')}</button></form>`, 'need134-dialog');
    dialog.querySelector('[data-resolve-form]').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget, values = Object.fromEntries(new FormData(form)), amount = String(values.cost || '').trim(); delete values.cost; if (amount) { const parsed = Number(amount.replace(',', '.')); if (!Number.isFinite(parsed) || parsed < 0) return h.setStatus(h.t('Enter a valid cost.', 'Unesi valjan trošak.'), true); values.costCents = Math.round(parsed * 100); values.currency = selected?.currency || 'EUR'; } form.querySelector('.primary').disabled = true; try { await h.api(`/api/v1/world/needs/${encodeURIComponent(data.need.publicId)}/resolve`, { method: 'POST', body: JSON.stringify(values) }); dialog.close(); h.invalidate(); h.renderNeed(data.need.publicId); } catch (error) { h.setStatus(error.message, true); form.querySelector('.primary').disabled = false; } });
  }

  function openEdit(data, h) {
    const need = data.need;
    const dialog = h.openDialog(h.t('Edit Need', 'Uredi potrebu'), `<form class="need134-form" data-edit-need-form><label>${h.t('Title', 'Naslov')}<input name="title" required minlength="2" maxlength="180" value="${h.esc(need.title)}"></label><label>${h.t('Type', 'Vrsta')}<select name="needType">${intakeOptions(need.type, h)}</select></label><label>${h.t('Context', 'Kontekst')}<textarea name="description" maxlength="5000">${h.esc(need.description || '')}</textarea></label><label>${h.t('Desired outcome (optional)', 'Željeni ishod (neobavezno)')}<textarea name="desiredOutcome" maxlength="1000">${h.esc(need.desiredOutcome || '')}</textarea></label><div class="need134-form-grid"><label>${h.t('Urgency', 'Hitnost')}<select name="urgency">${['LOW','NORMAL','HIGH','URGENT'].map(value => `<option value="${value}" ${value === need.urgency ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>${h.t('Due date (optional)', 'Rok (neobavezno)')}<input name="dueAt" type="date" value="${h.esc(need.dueAt || '')}"></label></div><label>${h.t('External HTTPS link you trust (optional)', 'Vanjska HTTPS poveznica kojoj vjeruješ (neobavezno)')}<input name="externalUrl" type="url" inputmode="url" value="${h.esc(need.externalUrl || '')}" placeholder="https://"></label><button class="primary">${h.t('Save changes', 'Spremi promjene')}</button></form>`, 'need134-dialog');
    dialog.querySelector('[data-edit-need-form]').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget, values = Object.fromEntries(new FormData(form)); if (!values.dueAt) values.dueAt = ''; form.querySelector('.primary').disabled = true; try { await h.api(`/api/v1/world/needs/${encodeURIComponent(need.publicId)}`, { method: 'PATCH', body: JSON.stringify(values) }); dialog.close(); h.invalidate(); h.renderNeed(need.publicId); } catch (error) { h.setStatus(error.message, true); form.querySelector('.primary').disabled = false; } });
  }

  function openWait(data, h) {
    const need = data.need;
    const dialog = h.openDialog(h.t('Wait for something real', 'Čekaj nešto stvarno'), `<form class="need134-form" data-wait-need-form><p>${h.t('Say what you are waiting for. The Need stays open.', 'Navedi što čekaš. Potreba ostaje otvorena.')}</p><label>${h.t('Waiting for', 'Čeka se')}<input name="waitingOn" required minlength="2" maxlength="500" value="${h.esc(need.waitingOn || '')}"></label><label>${h.t('Expected by (optional)', 'Očekivano do (neobavezno)')}<input name="waitingUntil" type="date" value="${h.esc(need.waitingUntil || '')}"></label><button class="primary">${h.t('Set to waiting', 'Postavi na čekanje')}</button></form>`, 'need134-dialog');
    dialog.querySelector('[data-wait-need-form]').addEventListener('submit', async event => { event.preventDefault(); const form = event.currentTarget; form.querySelector('.primary').disabled = true; try { await h.api(`/api/v1/world/needs/${encodeURIComponent(need.publicId)}/wait`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); dialog.close(); h.invalidate(); h.renderNeed(need.publicId); } catch (error) { h.setStatus(error.message, true); form.querySelector('.primary').disabled = false; } });
  }

  async function chooseOption(option, data, h, button) {
    button.disabled = true;
    try {
      if (option.actionType === 'ADD_QUOTE') { button.disabled = false; return openQuote(data, h); }
      const result = await h.api(`/api/v1/world/needs/${encodeURIComponent(data.need.publicId)}/select`, { method: 'POST', body: JSON.stringify({ optionType: option.type, actionType: option.actionType, ...(option.actionPayload || {}) }) });
      h.invalidate();
      if (option.actionType === 'CREATE_WANTED') { h.setStatus(h.t('Wanted Object created from this Need.', 'Traženi predmet je stvoren iz ove potrebe.')); return h.navigate('/app/market'); }
      if (option.actionType === 'OPEN_MARKET_LISTING') return h.navigate(`/app/market/listing/${encodeURIComponent(option.actionPayload.listingId)}`);
      if (option.actionType === 'OPEN_THING') return h.navigate(h.pathFor('thing', option.actionPayload.thingId));
      if (option.actionType === 'OPEN_KNOWLEDGE') return h.navigate(h.pathFor('knowledge', option.actionPayload.knowledgeId));
      if (option.actionType === 'OPEN_EXTERNAL') { window.open(option.actionPayload.url, '_blank', 'noopener,noreferrer'); h.setStatus(h.t('External link opened. The Need remains open.', 'Vanjska poveznica je otvorena. Potreba ostaje otvorena.')); return h.renderNeed(data.need.publicId); }
      if (result.openLoop?.publicId) return h.navigate(h.pathFor('open_loop', result.openLoop.publicId));
      h.renderNeed(data.need.publicId);
    } catch (error) { h.setStatus(error.message, true); button.disabled = false; }
  }

  async function renderNeed({ host, id, helpers: h }) {
    h.renderNeed = needId => renderNeed({ host, id: needId, helpers: h });
    host.innerHTML = h.loading(h.t('Opening Need…', 'Otvaram potrebu…'));
    try {
      const data = await h.api(`/api/v1/world/needs/${encodeURIComponent(id)}/context`), need = data.need, canHandle = active.has(need.status);
      host.innerHTML = `<section class="sos133-workspace need134-workspace" data-context-type="need" data-context-id="${h.esc(id)}"><button type="button" class="sos133-back" data-back>← ${h.t('Back', 'Natrag')}</button><header class="need134-head"><div><span>NEED · ${h.esc(typeLabel(need.type, h))}</span><h1>${h.esc(need.title)}</h1><p>${h.esc(need.description || h.t('No additional context yet.', 'Dodatni kontekst još nije dodan.'))}</p><div class="need134-status"><b>${h.esc(statusLabel(need.status, h))}</b>${need.urgency !== 'NORMAL' ? `<span>${h.esc(need.urgency)}</span>` : ''}${need.dueAt ? `<span>${h.t('Due', 'Rok')} ${h.date(need.dueAt)}</span>` : ''}</div></div><div class="need134-head-actions">${need.status === 'NEEDS_CONFIRMATION' || need.status === 'DETECTED' ? `<button type="button" class="primary" data-confirm-need>${h.t('Confirm this Need', 'Potvrdi potrebu')}</button>` : ''}${canHandle ? `<button type="button" class="primary" data-resolve-need>${h.t('Mark handled', 'Označi riješenim')}</button><button type="button" data-dismiss-need>${h.t('Dismiss', 'Odbaci')}</button>` : ''}</div></header><section class="need134-provenance"><span>${h.t('WHY THIS IS HERE', 'ZAŠTO JE OVDJE')}</span><p>${h.esc(data.why.explanation)}</p><small>${h.esc(data.why.sourceType.replaceAll('_', ' '))} · ${h.esc(data.why.confidence)}</small></section>${data.linked.length || need.thingId || need.situationId ? `<section class="sos133-workspace-section"><header><span>${h.t('CONTEXT', 'KONTEKST')}</span><h2>${h.t('Connected in your World', 'Povezano u tvojem Svijetu')}</h2></header><div>${need.thingId ? h.contextButton({ type: 'thing', publicId: need.thingId, title: need.thingTitle }, true) : ''}${need.situationId ? h.contextButton({ type: 'situation', publicId: need.situationId, title: need.situationTitle }, true) : ''}${data.linked.map(item => h.contextButton({ ...item, type: item.type }, true)).join('')}</div></section>` : ''}${canHandle ? `<section class="sos133-workspace-section need134-options"><header><span>${h.t('HANDLE IT', 'RIJEŠI')}</span><h2>${h.t('Real options from your World', 'Stvarne opcije iz tvojeg Svijeta')}</h2><p>${h.t('Still starts with what you already own and know. It does not invent providers, prices or availability.', 'Still počinje s onim što već posjeduješ i znaš. Ne izmišlja pružatelje, cijene ni dostupnost.')}</p></header>${data.options.length ? `<div>${data.options.map((option, index) => `<article><div><span>${h.esc(option.type.replaceAll('_', ' '))}</span><h3>${h.esc(option.title)}</h3><p>${h.esc(option.description)}</p>${option.evidenceRefs?.length ? `<details><summary>${h.t('Why this option', 'Zašto ova opcija')}</summary>${option.evidenceRefs.map(ref => `<small>${h.esc(ref.reason)}</small>`).join('')}</details>` : ''}${option.limitations?.length ? `<ul>${option.limitations.map(value => `<li>${h.esc(value)}</li>`).join('')}</ul>` : ''}</div><button type="button" data-resolution-option="${index}">${option.actionType === 'ADD_QUOTE' ? h.t('Add quote', 'Dodaj ponudu') : option.actionType === 'CREATE_OPEN_LOOP' ? h.t('Make next step', 'Stvori sljedeći korak') : h.t('Use this option', 'Upotrijebi opciju')} <span>→</span></button></article>`).join('')}</div>` : ''}${data.missing?.length ? `<aside><b>${h.t('More information would help', 'Dodatne informacije bi pomogle')}</b>${data.missing.map(value => `<p>${h.esc(value)}</p>`).join('')}</aside>` : ''}</section>` : ''}${data.quotes.length ? `<section class="sos133-workspace-section"><header><span>${h.t('QUOTES', 'PONUDE')}</span><h2>${h.t('Quotes you recorded', 'Ponude koje si zabilježio')}</h2>${data.quoteComparison ? `<p>${h.t('Recorded range', 'Zabilježeni raspon')}: ${h.esc(money(data.quoteComparison.lowestCents, data.quoteComparison.currency || data.quotes[0].currency))}–${h.esc(money(data.quoteComparison.highestCents, data.quoteComparison.currency || data.quotes[0].currency))}. ${h.esc(data.quoteComparison.note)}</p>` : ''}</header><div class="need134-quotes">${data.quotes.map(quote => quoteCard(quote, h)).join('')}</div></section>` : ''}${data.outcomes.length ? `<section class="sos133-workspace-section"><header><span>${h.t('OUTCOME', 'ISHOD')}</span><h2>${h.t('What happened', 'Što se dogodilo')}</h2></header>${data.outcomes.map(outcome => `<article class="need134-outcome"><b>${h.esc(typeLabel(outcome.resolutionType, h))}</b><p>${h.esc(outcome.summary)}</p>${Number.isFinite(outcome.costCents) ? `<strong>${h.esc(money(outcome.costCents, outcome.currency))}</strong>` : ''}<div>${outcome.feedback ? `<small>${h.t('Helpful', 'Korisno')}: ${outcome.feedback}</small>` : `<span>${h.t('Did this solve it?', 'Je li ovo riješilo problem?')}</span><button type="button" data-outcome-feedback="${h.esc(outcome.publicId)}:YES">${h.t('Yes', 'Da')}</button><button type="button" data-outcome-feedback="${h.esc(outcome.publicId)}:NO">${h.t('No', 'Ne')}</button>`}</div></article>`).join('')}</section>` : ''}<section class="sos133-workspace-section"><header><span>${h.t('HISTORY', 'POVIJEST')}</span><h2>${h.t('Need history', 'Povijest potrebe')}</h2></header>${h.historyList(data.history)}</section></section>`;
      h.bindContent();
      if (need.waitingOn) host.querySelector('.need134-status')?.insertAdjacentHTML('beforeend', `<span>${h.t('Waiting for', 'Čeka se')}: ${h.esc(need.waitingOn)}${need.waitingUntil ? ` · ${h.date(need.waitingUntil)}` : ''}</span>`);
      if (canHandle) host.querySelector('.need134-head-actions')?.insertAdjacentHTML('beforeend', `<button type="button" data-edit-need>${h.t('Edit', 'Uredi')}</button>${need.status === 'WAITING' ? `<button type="button" data-resume-need>${h.t('Resume', 'Nastavi')}</button>` : `<button type="button" data-wait-need>${h.t('Wait', 'Čekaj')}</button>`}`);
      host.querySelector('[data-confirm-need]')?.addEventListener('click', async event => { event.currentTarget.disabled = true; try { await h.api(`/api/v1/world/needs/${encodeURIComponent(id)}/confirm`, { method: 'POST', body: '{}' }); h.invalidate(); h.renderNeed(id); } catch (error) { h.setStatus(error.message, true); event.currentTarget.disabled = false; } });
      host.querySelector('[data-dismiss-need]')?.addEventListener('click', async event => { event.currentTarget.disabled = true; try { await h.api(`/api/v1/world/needs/${encodeURIComponent(id)}/dismiss`, { method: 'POST', body: '{}' }); h.invalidate(); h.navigate('/app/world'); } catch (error) { h.setStatus(error.message, true); event.currentTarget.disabled = false; } });
      host.querySelector('[data-resolve-need]')?.addEventListener('click', () => openResolve(data, h));
      host.querySelector('[data-edit-need]')?.addEventListener('click', () => openEdit(data, h));
      host.querySelector('[data-wait-need]')?.addEventListener('click', () => openWait(data, h));
      host.querySelector('[data-resume-need]')?.addEventListener('click', async event => { event.currentTarget.disabled = true; try { await h.api(`/api/v1/world/needs/${encodeURIComponent(id)}/resume`, { method: 'POST', body: '{}' }); h.invalidate(); h.renderNeed(id); } catch (error) { h.setStatus(error.message, true); event.currentTarget.disabled = false; } });
      host.querySelectorAll('[data-resolution-option]').forEach(button => button.addEventListener('click', () => chooseOption(data.options[Number(button.dataset.resolutionOption)], data, h, button)));
      host.querySelectorAll('[data-select-quote]').forEach(button => button.addEventListener('click', async () => { button.disabled = true; try { await h.api(`/api/v1/world/needs/${encodeURIComponent(id)}/quotes/${encodeURIComponent(button.dataset.selectQuote)}/select`, { method: 'POST', body: '{}' }); h.invalidate(); h.renderNeed(id); } catch (error) { h.setStatus(error.message, true); button.disabled = false; } }));
      host.querySelectorAll('[data-outcome-feedback]').forEach(button => button.addEventListener('click', async () => { const [outcomeId, feedback] = button.dataset.outcomeFeedback.split(':'); await h.api(`/api/v1/world/resolution-outcomes/${encodeURIComponent(outcomeId)}/feedback`, { method: 'POST', body: JSON.stringify({ feedback }) }); h.renderNeed(id); }));
    } catch (error) { host.innerHTML = h.failed(error.status === 404 ? h.t('This Need was not found.', 'Ova potreba nije pronađena.') : error.message); h.bindContent(); }
  }

  function bindContext(data, h) {
    document.querySelectorAll('[data-create-need]').forEach(button => { if (button.dataset.needBound) return; button.dataset.needBound = '1'; button.addEventListener('click', () => openIntake({ type: data?.entityType, id: data?.entity?.publicId }, h)); });
  }

  function bindWorld(h) {
    document.querySelectorAll('[data-needs-filter]').forEach(button => button.addEventListener('click', async () => { document.querySelectorAll('[data-needs-filter]').forEach(item => item.setAttribute('aria-pressed', String(item === button))); const host = document.querySelector('[data-needs-list]'); host.innerHTML = `<p class="sos133-muted">${h.t('Loading…', 'Učitavanje…')}</p>`; try { const data = await h.api(`/api/v1/world/needs?status=${encodeURIComponent(button.dataset.needsFilter)}`); host.innerHTML = data.needs.length ? data.needs.map(item => needRow(item, h)).join('') : `<p class="sos133-muted">${h.t('No Needs in this view.', 'Nema potreba u ovom prikazu.')}</p>`; h.bindContent(); } catch (error) { h.setStatus(error.message, true); } }));
  }

  window.StillNeedsV134 = { renderNeed, openIntake, contextNeeds, worldNeeds, bindContext, bindWorld };
})();
