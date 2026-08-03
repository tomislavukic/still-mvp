(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  let root;
  let data = { passports: [] };

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      ...options
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(result.error || `HTTP ${response.status}`), { status: response.status, data: result });
    return result;
  }

  function typeOptions() {
    return `<option value="product">${t('Product', 'Proizvod')}</option><option value="service">${t('Service', 'Usluga')}</option><option value="subscription">${t('Subscription', 'Pretplata')}</option><option value="booking">${t('Booking', 'Rezervacija')}</option><option value="rental">${t('Rental', 'Najam')}</option><option value="project">${t('Project', 'Projekt')}</option>`;
  }

  function mount() {
    if ($('#companyPassportStudioV83')) return;
    const portal = $('#companyPortalV46');
    if (!portal || !document.body.classList.contains('company-authenticated')) return setTimeout(mount, 300);
    root = document.createElement('section');
    root.id = 'companyPassportStudioV83';
    root.className = 'cps83';
    root.innerHTML = `
      <header class="cps83-head">
        <div><span>${t('STILL? PASSPORT STUDIO', 'STILL? STUDIO PUTOVNICA')}</span><h2>${t('Connect your promise to the buyer’s record.', 'Povežite svoje obećanje sa zapisom kupca.')}</h2><p>${t('Issue a passport for a product, service, subscription, booking or project. The buyer connects it voluntarily; Still? never becomes the seller.', 'Izdajte putovnicu za proizvod, uslugu, pretplatu, rezervaciju ili projekt. Kupac je povezuje dobrovoljno; Still? nikada ne postaje prodavatelj.')}</p></div>
        <div class="cps83-role"><b>${t('Your role', 'Vaša uloga')}</b><span>${t('Verified issuer and promise keeper', 'Verificirani izdavatelj i izvršitelj obećanja')}</span></div>
      </header>
      <div class="cps83-flow"><article><span>1</span><b>${t('Company issues', 'Tvrtka izdaje')}</b><small>${t('The offer, deadline, guarantee or next action becomes structured.', 'Ponuda, rok, jamstvo ili sljedeća radnja postaje strukturirana.')}</small></article><i>→</i><article><span>2</span><b>${t('Buyer accepts', 'Kupac prihvaća')}</b><small>${t('A connection code links the passport only after buyer consent.', 'Kod povezivanja veže putovnicu tek nakon pristanka kupca.')}</small></article><i>→</i><article><span>3</span><b>${t('Both prove outcomes', 'Obje strane dokazuju ishode')}</b><small>${t('Updates and completed commitments create earned reputation.', 'Ažuriranja i ispunjena obećanja stvaraju zasluženu reputaciju.')}</small></article></div>
      <div class="cps83-grid">
        <form id="cps83Issue" class="cps83-card">
          <h3>${t('Issue a new passport', 'Izdaj novu putovnicu')}</h3>
          <label>${t('Type', 'Vrsta')}<select name="kind">${typeOptions()}</select></label>
          <label>${t('Product, service or engagement', 'Proizvod, usluga ili angažman')}<input name="title" required maxlength="180"></label>
          <label>${t('Buyer email (optional)', 'E-mail kupca (neobavezno)')}<input name="buyerEmail" type="email" maxlength="254" placeholder="${t('Used only to match an existing buyer account', 'Koristi se samo za povezivanje postojećeg računa kupca')}"></label>
          <label>${t('Order / contract reference', 'Referenca narudžbe / ugovora')}<input name="reference" maxlength="120"></label>
          <div class="cps83-fields">
            <label>${t('Started / purchased', 'Započeto / kupljeno')}<input name="purchasedOn" type="date"></label>
            <label>${t('Return / cancellation by', 'Povrat / otkazivanje do')}<input name="returnBy" type="date"></label>
            <label>${t('Guarantee until', 'Jamstvo do')}<input name="warrantyUntil" type="date"></label>
            <label>${t('Renewal / payment', 'Obnova / plaćanje')}<input name="renewalAt" type="date"></label>
          </div>
          <fieldset><legend>${t('First company commitment', 'Prvo obećanje tvrtke')}</legend><label>${t('What will you do?', 'Što ćete učiniti?')}<input name="commitmentTitle" maxlength="180" placeholder="${t('Deliver, repair, respond, renew, complete…', 'Isporučiti, popraviti, odgovoriti, obnoviti, dovršiti…')}"></label><label>${t('Due date', 'Rok')}<input name="commitmentDueAt" type="date"></label></fieldset>
          <button>${t('Issue buyer connection', 'Izdaj povezivanje kupcu')}</button><small id="cps83IssueMessage"></small>
        </form>
        <div class="cps83-card cps83-list-card"><div class="cps83-list-head"><div><h3>${t('Issued passports', 'Izdane putovnice')}</h3><p>${t('The buyer controls acceptance. Your team controls only attributable company updates.', 'Kupac kontrolira prihvaćanje. Vaš tim kontrolira samo pripisiva ažuriranja tvrtke.')}</p></div><button type="button" data-cps83-refresh>${t('Refresh', 'Osvježi')}</button></div><div id="cps83List" class="cps83-list"><div class="cps83-loading">${t('Loading passports…', 'Učitavanje putovnica…')}</div></div></div>
      </div>`;
    portal.insertAdjacentElement('afterend', root);
    $('#cps83Issue', root).addEventListener('submit', issue);
    $('[data-cps83-refresh]', root).addEventListener('click', load);
    $('#cps83List', root).addEventListener('submit', addCommitment);
    load();
  }

  async function load() {
    const host = $('#cps83List', root);
    host.innerHTML = `<div class="cps83-loading">${t('Loading passports…', 'Učitavanje putovnica…')}</div>`;
    try {
      data = await api('/api/v1/business/passports');
      render();
    } catch (error) {
      host.innerHTML = `<div class="cps83-empty"><b>${error.status === 403 ? t('Company verification is required.', 'Potrebna je verifikacija tvrtke.') : t('Passport service is temporarily unavailable.', 'Usluga putovnica trenutačno nije dostupna.')}</b><p>${t('The existing company workspace remains available.', 'Postojeći poslovni radni prostor ostaje dostupan.')}</p></div>`;
    }
  }

  function render() {
    const host = $('#cps83List', root);
    if (!data.passports?.length) {
      host.innerHTML = `<div class="cps83-empty"><b>${t('No passports issued yet.', 'Još nema izdanih putovnica.')}</b><p>${t('Start with one real customer promise. The buyer receives a connection code.', 'Započnite s jednim stvarnim obećanjem kupcu. Kupac dobiva kod povezivanja.')}</p></div>`;
      return;
    }
    host.innerHTML = data.passports.map(item => `<article class="cps83-passport"><div class="cps83-passport-head"><span>${esc(item.kind)}</span><em class="${esc(item.status)}">${item.status === 'connected' ? t('Buyer connected', 'Kupac povezan') : t('Awaiting buyer', 'Čeka kupca')}</em></div>${item.buyerProfile?`<div class="cps103-buyer">${item.buyerProfile.picture_url?`<img src="${esc(item.buyerProfile.picture_url)}" alt="${esc(item.buyerProfile.display_name||'')}">`:`<b>${esc((item.buyerProfile.display_name||'?').slice(0,1).toUpperCase())}</b>`}<span><small>${t('CONNECTED BUYER','POVEZANI KUPAC')}</small><strong>${esc(item.buyerProfile.display_name||t('Buyer','Kupac'))}</strong></span></div>`:''}<h4>${esc(item.title)}</h4><p>${esc(item.publicId)}${item.reference ? ` · ${esc(item.reference)}` : ''}</p><div class="cps83-dates">${item.warrantyUntil ? `<span>${t('Guarantee', 'Jamstvo')}<b>${esc(item.warrantyUntil)}</b></span>` : ''}${item.renewalAt ? `<span>${t('Renewal', 'Obnova')}<b>${esc(item.renewalAt)}</b></span>` : ''}<span>${t('Commitments', 'Obećanja')}<b>${item.commitments?.length || 0}</b></span></div><div class="cps83-commitments">${(item.commitments || []).map(commitment => `<div><span><b>${esc(commitment.title)}</b><small>${esc(commitment.type)}${commitment.dueAt ? ` · ${esc(commitment.dueAt)}` : ''}</small></span><em>${esc(commitment.status)}</em></div>`).join('') || `<small>${t('No commitments yet.', 'Još nema obećanja.')}</small>`}</div><details><summary>${t('Add a commitment', 'Dodaj obećanje')}</summary><form data-cps83-commitment="${esc(item.publicId)}"><select name="type"><option value="delivery">${t('Delivery', 'Isporuka')}</option><option value="service">${t('Service', 'Usluga')}</option><option value="repair">${t('Repair', 'Popravak')}</option><option value="response">${t('Response', 'Odgovor')}</option><option value="renewal">${t('Renewal', 'Obnova')}</option><option value="refund">${t('Refund', 'Povrat novca')}</option><option value="other">${t('Other', 'Ostalo')}</option></select><input name="title" required maxlength="180" placeholder="${t('Specific promise', 'Konkretno obećanje')}"><input name="dueAt" type="date"><button>${t('Save', 'Spremi')}</button></form></details></article>`).join('');
  }

  async function issue(event) {
    event.preventDefault();
    const message = $('#cps83IssueMessage', root);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    message.textContent = t('Issuing passport…', 'Izdavanje putovnice…');
    try {
      const result = await api('/api/v1/business/passports', { method: 'POST', body: JSON.stringify(body) });
      event.currentTarget.reset();
      message.innerHTML = `${t('Issued. Share this one-time buyer connection code:', 'Izdano. Podijelite ovaj jednokratni kod povezivanja kupca:')} <button type="button" data-copy-code="${esc(result.connectionCode)}">${esc(result.connectionCode)}</button>`;
      const copy = $('[data-copy-code]', message);
      copy?.addEventListener('click', async () => {
        await navigator.clipboard.writeText(result.connectionCode).catch(() => {});
        copy.textContent = t('Copied ✓', 'Kopirano ✓');
      });
      await load();
    } catch (error) {
      message.textContent = error.status === 403 ? t('Only a verified company can issue passports.', 'Samo verificirana tvrtka može izdavati putovnice.') : t('Could not issue the passport.', 'Nije moguće izdati putovnicu.');
    }
  }

  async function addCommitment(event) {
    const form = event.target.closest('[data-cps83-commitment]');
    if (!form) return;
    event.preventDefault();
    const body = Object.fromEntries(new FormData(form));
    const button = $('button', form);
    button.disabled = true;
    try {
      await api(`/api/v1/business/passports/${encodeURIComponent(form.dataset.cps83Commitment)}/commitments`, { method: 'POST', body: JSON.stringify(body) });
      await load();
    } catch {
      button.textContent = t('Try again', 'Pokušaj ponovno');
      button.disabled = false;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
