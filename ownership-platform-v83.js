(() => {
  const STORAGE_KEY = 'still-ownership-passports-v83';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const dateValue = value => value ? new Date(`${value}T12:00:00`) : null;
  const dateText = value => {
    const date = dateValue(value);
    return date && !Number.isNaN(date.valueOf())
      ? new Intl.DateTimeFormat(isHr() ? 'hr-HR' : 'en-GB', { dateStyle: 'medium' }).format(date)
      : t('Not set', 'Nije postavljeno');
  };
  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  };
  const write = value => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent('still:ownership-updated', { detail: { count: value.length } }));
  };
  let passports = read();
  let lastDiscovery = null;
  let qrDialog;
  let activeQr;

  function typeLabel(kind) {
    return ({
      product: t('Product', 'Proizvod'),
      service: t('Service', 'Usluga'),
      subscription: t('Subscription', 'Pretplata'),
      booking: t('Booking', 'Rezervacija'),
      rental: t('Rental', 'Najam'),
      project: t('Project', 'Projekt')
    })[kind] || t('Record', 'Zapis');
  }

  function mount() {
    if (document.body.classList.contains('business-page') || $('#ownershipPlatformV83')) return;
    const main = $('main');
    const legacyHero = $('#checker');
    if (!main || !legacyHero) return;

    document.title = 'Still? · Everything you own.';
    document.querySelector('meta[name="description"]')?.setAttribute('content', t(
      'Everything you own, in one calm place. Keep products, services, subscriptions, documents, dates and service history together.',
      'Sve što posjeduješ na jednom mirnom mjestu. Drži proizvode, usluge, pretplate, dokumente, rokove i servisnu povijest zajedno.'
    ));

    const platform = document.createElement('div');
    platform.id = 'ownershipPlatformV83';
    platform.innerHTML = shell();
    main.insertBefore(platform, legacyHero);
    $$('#op94PassportDialog').forEach(existing => existing.remove());
    qrDialog = document.createElement('dialog');
    qrDialog.id = 'op94PassportDialog';
    qrDialog.className = 'op94-dialog';
    document.body.appendChild(qrDialog);
    legacyHero.classList.add('resolve-hero-v83');
    legacyHero.querySelector('.hero-copy .eyebrow')?.replaceChildren(document.createTextNode(t('Resolve', 'Riješi')));
    const heroTitle = legacyHero.querySelector('.hero-copy h1');
    if (heroTitle) heroTitle.innerHTML = t('Something went wrong?<br><span>Resolve it.</span>', 'Nešto je pošlo po zlu?<br><span>Riješi to.</span>');
    const heroLead = legacyHero.querySelector('.hero-copy .lead');
    if (heroLead) heroLead.textContent = t('Returns and warranty rights remain here when you need them.', 'Povrati i jamstvena prava ostaju ovdje kada ih zatrebaš.');

    bind();
    renderPassports();
    renderTimeline();
    updateCounts();
    openPassportVerification();
  }

  function shell() {
    return `
      <section class="op83-home" id="discoverV83">
        <div class="op83-home-copy">
          <span class="op83-kicker">BUYEROS · ${t('EVERYTHING YOU OWN', 'SVE ŠTO POSJEDUJEŠ')}</span>
          <h1>${t('Everything you own.<br><em>One calm place.</em>', 'Sve što posjeduješ.<br><em>Jedno mirno mjesto.</em>')}</h1>
          <p>${t('Products, services, subscriptions, documents, dates and service history stay useful before, during and after ownership.', 'Proizvodi, usluge, pretplate, dokumenti, rokovi i servisna povijest ostaju korisni prije, tijekom i nakon vlasništva.')}</p>
          <div class="v84-task-grid" aria-label="${t('Choose what you want to do', 'Odaberi što želiš učiniti')}">
            <a href="#passportCommerceV92"><span>01</span><b>${t('Buy with a passport', 'Kupi s putovnicom')}</b><small>${t('Verified seller, terms, payment and rewards.', 'Verificirani prodavatelj, uvjeti, plaćanje i nagrade.')}</small><i>→</i></a>
            <a href="#decisionLabV83"><span>02</span><b>${t('Decide before buying', 'Odluči prije kupnje')}</b><small>${t('Check what is known and what to ask.', 'Provjeri što znaš i što treba pitati.')}</small><i>→</i></a>
            <a href="#lifecyclePlatformV95"><span>03</span><b>${t('Manage what I own', 'Upravljaj onime što imaš')}</b><small>${t('Inbox, service history, support and alerts.', 'Rokovi, servisna povijest, podrška i upozorenja.')}</small><i>→</i></a>
            <a href="#checker"><span>04</span><b>${t('Resolve a problem', 'Riješi problem')}</b><small>${t('Returns, warranty and evidence.', 'Povrat, jamstvo i dokazi.')}</small><i>→</i></a>
          </div>
          <div class="op83-positioning"><b>${t('Not a webshop.', 'Nije webshop.')}</b> ${t('Still? is a neutral connection and evidence layer. The seller remains the seller; the buyer remains in control.', 'Still? je neutralni sloj povezivanja i dokaza. Prodavatelj ostaje prodavatelj, a kupac zadržava kontrolu.')}</div>
        </div>
        <div class="op83-connection" aria-label="${t('How Still connects buyers and companies', 'Kako Still povezuje kupce i tvrtke')}">
          <div class="op83-party"><span>01</span><b>${t('Buyer', 'Kupac')}</b><small>${t('Owns the passport and chooses what to share.', 'Posjeduje putovnicu i bira što dijeli.')}</small></div>
          <div class="op83-bridge"><strong>Still?</strong><span>↔</span><small>${t('Passport + promise timeline', 'Putovnica + vremenska crta obećanja')}</small></div>
          <div class="op83-party"><span>02</span><b>${t('Verified company', 'Verificirana tvrtka')}</b><small>${t('Issues commitments, updates progress and proves outcomes.', 'Izdaje obećanja, ažurira napredak i dokazuje ishode.')}</small></div>
        </div>
      </section>

      <div id="commerceMountV92"></div>

      <section class="op83-section op83-decision" id="decisionLabV83">
        <div class="op83-section-head"><div><span class="op83-kicker">${t('DISCOVER', 'OTKRIJ')}</span><h2>${t('Check the decision, not just the price.', 'Provjeri odluku, ne samo cijenu.')}</h2></div><p>${t('This score measures how prepared your decision is from the facts you provide. It does not invent product quality.', 'Ovaj rezultat mjeri koliko je odluka pripremljena prema činjenicama koje uneseš. Ne izmišlja kvalitetu proizvoda.')}</p></div>
        <div class="op83-decision-grid">
          <form id="decisionFormV83" class="op83-card op83-form">
            <label>${t('What are you considering?', 'Što razmatraš?')}<select name="kind">${typeOptions()}</select></label>
            <label>${t('Product, service or plan', 'Proizvod, usluga ili plan')}<input name="title" required maxlength="120" placeholder="${t('e.g. washing machine or annual software plan', 'npr. perilica rublja ili godišnji softverski plan')}"></label>
            <label>${t('Business', 'Tvrtka')}<input name="business" maxlength="120" placeholder="${t('Seller or provider', 'Prodavatelj ili pružatelj')}"></label>
            <div class="op83-form-grid">
              ${decisionSelect('terms', t('Clear terms and cancellation?', 'Jasni uvjeti i otkazivanje?'))}
              ${decisionSelect('repair', t('Repair, parts or correction available?', 'Dostupan popravak, dijelovi ili ispravak?'))}
              ${decisionSelect('support', t('Reachable support with identity?', 'Dostupna podrška s identitetom?'))}
              ${decisionSelect('costs', t('Full recurring/ownership cost known?', 'Poznat puni trošak vlasništva/obnove?'))}
            </div>
            <button class="op83-primary" type="submit">${t('Evaluate my preparation', 'Procijeni pripremljenost')}</button>
          </form>
          <div id="decisionResultV83" class="op83-card op83-result"><span class="op83-empty-icon">◎</span><h3>${t('Your decision brief appears here.', 'Sažetak odluke pojavit će se ovdje.')}</h3><p>${t('Still? will show what is known, what is missing and what to ask before paying.', 'Still? prikazuje što je poznato, što nedostaje i što pitati prije plaćanja.')}</p></div>
        </div>
      </section>

      <section class="op83-section" id="ownershipHubV83">
        <div class="op83-section-head"><div><span class="op83-kicker">${t('MY THINGS', 'MOJE STVARI')}</span><h2>${t('One passport for every important purchase or promise.', 'Jedna putovnica za svaku važnu kupnju ili obećanje.')}</h2></div><div class="op83-stats"><span><b id="op83PassportCount">0</b>${t('passports', 'putovnica')}</span><span><b id="op83ActionCount">0</b>${t('upcoming', 'nadolazeće')}</span></div></div>
        <div class="op83-hub-grid">
          <form id="passportFormV83" class="op83-card op83-form">
            <h3>${t('Create a passport', 'Izradi putovnicu')}</h3>
            <label>${t('Type', 'Vrsta')}<select name="kind">${typeOptions()}</select></label>
            <label>${t('Name', 'Naziv')}<input name="title" required maxlength="120" placeholder="${t('Item, service, booking or project', 'Proizvod, usluga, rezervacija ili projekt')}"></label>
            <label>${t('Business', 'Tvrtka')}<input name="business" maxlength="120" placeholder="${t('Seller, manufacturer or provider', 'Prodavatelj, proizvođač ili pružatelj')}"></label>
            <label>${t('Order / reference', 'Narudžba / referenca')}<input name="reference" maxlength="120"></label>
            <div class="op83-form-grid">
              <label>${t('Purchased / started', 'Kupljeno / započeto')}<input name="purchasedOn" type="date"></label>
              <label>${t('Return / cancellation by', 'Povrat / otkazivanje do')}<input name="returnBy" type="date"></label>
              <label>${t('Warranty / guarantee until', 'Jamstvo do')}<input name="warrantyUntil" type="date"></label>
              <label>${t('Renewal / next payment', 'Obnova / sljedeće plaćanje')}<input name="renewalAt" type="date"></label>
              <label>${t('Maintenance / next action', 'Održavanje / sljedeća radnja')}<input name="nextActionAt" type="date"></label>
            </div>
            <label>${t('Private notes', 'Privatne bilješke')}<textarea name="notes" maxlength="1200" placeholder="${t('Condition, scope, included accessories, promised result…', 'Stanje, opseg, uključena oprema, obećani rezultat…')}"></textarea></label>
            <button class="op83-primary" type="submit">${t('Save buyer-owned passport', 'Spremi putovnicu kupca')}</button>
            <small>${t('Saved locally first. Account sync is optional.', 'Najprije se sprema lokalno. Sinkronizacija računa nije obavezna.')}</small>
          </form>
          <div class="op83-card op83-passport-panel">
            <div class="op83-panel-tools"><div><h3>${t('Your passports', 'Tvoje putovnice')}</h3><small>${t('Products, services and commitments together.', 'Proizvodi, usluge i obećanja zajedno.')}</small></div><div><button type="button" class="op83-text" data-op83-sync>${t('Sync account', 'Sinkroniziraj račun')}</button><button type="button" class="op83-text" data-op83-export>${t('Export', 'Izvezi')}</button></div></div>
            <div id="passportListV83" class="op83-passport-list"></div>
            <div class="op83-connect-box"><b>${t('Connect a company-issued passport', 'Poveži putovnicu koju je izdala tvrtka')}</b><p>${t('Enter the code a verified company shared with you. Connection requires buyer sign-in and your explicit action.', 'Unesi kod koji ti je podijelila verificirana tvrtka. Povezivanje zahtijeva prijavu kupca i tvoju izričitu radnju.')}</p><form id="connectFormV83"><input name="code" required maxlength="30" placeholder="STILL-XXXX-XXXX"><button>${t('Connect', 'Poveži')}</button></form><small id="connectMessageV83"></small></div>
          </div>
        </div>
      </section>

      <section class="op83-section op83-timeline-section" id="timelineV83">
        <div class="op83-section-head"><div><span class="op83-kicker">${t('TIMELINE', 'VREMENSKA CRTA')}</span><h2>${t('What needs attention next?', 'Što sljedeće traži pažnju?')}</h2></div><p>${t('Returns, renewals, warranty endings and maintenance become one calm queue.', 'Povrati, obnove, završeci jamstva i održavanje postaju jedan miran red.')}</p></div>
        <div id="timelineListV83" class="op83-timeline"></div>
      </section>

      <section class="op83-section op83-role" id="howConnectsV83">
        <div><span class="op83-kicker">${t('WHAT STILL? IS', 'ŠTO JE STILL?')}</span><h2>${t('A mediator of facts—not the seller and not the judge.', 'Posrednik činjenica—nije prodavatelj niti sudac.')}</h2></div>
        <div class="op83-role-grid"><article><b>${t('Still? does', 'Still? radi')}</b><p>${t('Verify participating businesses, structure offers, orchestrate seller checkout, activate passports, track commitments and preserve a shared history.', 'Verificira uključene tvrtke, strukturira ponude, usmjerava naplatu prodavatelja, aktivira putovnice, prati obećanja i čuva zajedničku povijest.')}</p></article><article><b>${t('Still? does not', 'Still? ne radi')}</b><p>${t('Own inventory, become the seller, hold a buyer wallet or escrow, decide legal rights, or allow companies to buy reputation.', 'Ne posjeduje zalihe, ne postaje prodavatelj, ne drži novčanik kupca ili escrow, ne odlučuje o pravima niti dopušta kupnju reputacije.')}</p></article><article><b>${t('The connection', 'Povezivanje')}</b><p>${t('The buyer pays the named business. Both sides then share commitments and outcomes; company actions stay attributable and auditable.', 'Kupac plaća imenovanoj tvrtki. Obje strane zatim dijele obećanja i ishode; radnje tvrtke imaju autora i provjerljiv trag.')}</p></article></div>
      </section>`;
  }

  function typeOptions() {
    return `
      <option value="product">${t('Product', 'Proizvod')}</option>
      <option value="service">${t('Service', 'Usluga')}</option>
      <option value="subscription">${t('Subscription', 'Pretplata')}</option>
      <option value="booking">${t('Booking', 'Rezervacija')}</option>
      <option value="rental">${t('Rental', 'Najam')}</option>
      <option value="project">${t('Project', 'Projekt')}</option>`;
  }

  function decisionSelect(name, label) {
    return `<label>${label}<select name="${name}"><option value="unknown">${t('Not verified', 'Nije provjereno')}</option><option value="yes">${t('Yes', 'Da')}</option><option value="no">${t('No', 'Ne')}</option></select></label>`;
  }

  function bind() {
    $('#decisionFormV83')?.addEventListener('submit', evaluateDecision);
    $('#passportFormV83')?.addEventListener('submit', addPassport);
    $('#connectFormV83')?.addEventListener('submit', connectPassport);
    $('[data-op83-export]')?.addEventListener('click', exportPassports);
    $('[data-op83-sync]')?.addEventListener('click', syncAccount);
    $('#passportListV83')?.addEventListener('click', passportAction);
    if (qrDialog) qrDialog.onclick = qrDialogAction;
  }

  function evaluateDecision(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const values = ['terms', 'repair', 'support', 'costs'].map(key => data[key]);
    const points = values.reduce((sum, value) => sum + (value === 'yes' ? 25 : value === 'unknown' ? 10 : 0), 0);
    const missing = [
      ['terms', t('written terms, cancellation and warranty', 'pisane uvjete, otkazivanje i jamstvo')],
      ['repair', t('repair, correction or spare-part path', 'put popravka, ispravka ili rezervnih dijelova')],
      ['support', t('a verifiable support contact', 'provjerljiv kontakt podrške')],
      ['costs', t('the complete ownership or recurring cost', 'potpuni trošak vlasništva ili obnove')]
    ].filter(([key]) => data[key] !== 'yes').map(([, label]) => label);
    const state = points >= 75 ? 'ready' : points >= 45 ? 'verify' : 'pause';
    lastDiscovery = { ...data, points, createdAt: new Date().toISOString() };
    const result = $('#decisionResultV83');
    result.className = `op83-card op83-result ${state}`;
    result.innerHTML = `<span class="op83-score">${points}<small>/100</small></span><span class="op83-kicker">${t('DECISION PREPARATION', 'PRIPREMLJENOST ODLUKE')}</span><h3>${state === 'ready' ? t('You have a useful decision brief.', 'Imaš koristan sažetak odluke.') : state === 'verify' ? t('Verify the missing promises first.', 'Najprije provjeri obećanja koja nedostaju.') : t('Pause before paying.', 'Zastani prije plaćanja.')}</h3><p>${missing.length ? `${t('Ask for', 'Zatraži')}: ${esc(missing.join(', '))}.` : t('The four core lifecycle questions have answers. Keep copies of the evidence.', 'Četiri ključna pitanja životnog ciklusa imaju odgovore. Sačuvaj dokaze.')}</p><button type="button" class="op83-secondary" data-save-discovery>${t('Turn this into a passport', 'Pretvori u putovnicu')}</button>`;
    $('[data-save-discovery]', result)?.addEventListener('click', () => {
      const form = $('#passportFormV83');
      form.kind.value = data.kind;
      form.title.value = data.title;
      form.business.value = data.business;
      form.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      form.title.focus();
    });
  }

  function addPassport(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const passport = {
      id: `local_${crypto.randomUUID()}`,
      kind: data.kind,
      title: data.title.trim(),
      business: data.business.trim(),
      reference: data.reference.trim(),
      purchasedOn: data.purchasedOn,
      returnBy: data.returnBy,
      warrantyUntil: data.warrantyUntil,
      renewalAt: data.renewalAt,
      nextActionAt: data.nextActionAt,
      notes: data.notes.trim(),
      connection: 'buyer-owned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    passports.unshift(passport);
    write(passports);
    event.currentTarget.reset();
    renderPassports();
    renderTimeline();
    updateCounts();
    $('#passportListV83')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }

  function passportEvents(passport) {
    const lifecycle = [
      [passport.returnBy, t('Return or cancel', 'Povrat ili otkazivanje'), 'return'],
      [passport.nextActionAt, t('Maintenance or next action', 'Održavanje ili sljedeća radnja'), 'action'],
      [passport.renewalAt, t('Renewal or payment', 'Obnova ili plaćanje'), 'renewal'],
      [passport.warrantyUntil, t('Warranty or guarantee ends', 'Jamstvo završava'), 'warranty']
    ].filter(([date]) => date).map(([date, title, type]) => ({ date, title, type, passport }));
    const commitments = (passport.commitments || [])
      .filter(item => item.dueAt && ['promised', 'in_progress'].includes(item.status))
      .map(item => ({ date: item.dueAt, title: item.title, type: `commitment:${item.type}`, passport }));
    return [...lifecycle, ...commitments];
  }

  function renderPassports() {
    const host = $('#passportListV83');
    if (!host) return;
    if (!passports.length) {
      host.innerHTML = `<div class="op83-empty"><span>◇</span><b>${t('No passports yet.', 'Još nema putovnica.')}</b><p>${t('Add a product, service, subscription or booking to start your ownership timeline.', 'Dodaj proizvod, uslugu, pretplatu ili rezervaciju za početak vremenske crte.')}</p><a class="op83-empty-action" href="#passportFormV83">${t('Add your first thing →', 'Dodaj prvu stvar →')}</a></div>`;
      return;
    }
    host.innerHTML = passports.map(passport => {
      const next = passportEvents(passport).sort((a, b) => a.date.localeCompare(b.date))[0];
      const commitments = (passport.commitments || []).map(item => `<li><span>${esc(item.title)}</span><em>${esc(item.status)}${item.dueAt ? ` · ${dateText(item.dueAt)}` : ''}</em></li>`).join('');
      const badge = passport.connection === 'company' ? t('Company connected', 'Tvrtka povezana') : passport.publicId ? t('Account synced', 'Sinkronizirano') : t('Buyer-owned', 'U vlasništvu kupca');
      return `<article class="op83-passport" data-passport-id="${esc(passport.id)}"><div class="op83-passport-top"><span>${typeLabel(passport.kind)}</span><em>${badge}</em></div><h4>${esc(passport.title)}</h4><p>${esc(passport.business || t('No business connected', 'Nema povezane tvrtke'))}</p>${next ? `<div class="op83-next"><small>${esc(next.title)}</small><b>${dateText(next.date)}</b></div>` : `<div class="op83-next"><small>${t('Next date', 'Sljedeći datum')}</small><b>${t('Add a reminder', 'Dodaj podsjetnik')}</b></div>`}${commitments ? `<div class="op83-shared"><b>${t('Shared company commitments', 'Zajednička obećanja tvrtke')}</b><ul>${commitments}</ul></div>` : ''}<div class="op83-passport-actions"><button class="op94-qr-action" data-op94-qr="${esc(passport.id)}">▦ ${t('Passport QR', 'QR putovnice')}</button><button data-op83-share="${esc(passport.id)}">${t('Share', 'Podijeli')}</button><button data-op83-delete="${esc(passport.id)}">${t('Remove', 'Ukloni')}</button></div></article>`;
    }).join('');
  }

  function renderTimeline() {
    const host = $('#timelineListV83');
    if (!host) return;
    const now = new Date();
    const events = passports.flatMap(passportEvents).sort((a, b) => a.date.localeCompare(b.date));
    if (!events.length) {
      host.innerHTML = `<div class="op83-empty wide"><span>◷</span><b>${t('Your next actions will appear here.', 'Tvoje sljedeće radnje pojavit će se ovdje.')}</b><p>${t('Dates from every passport become one ordered timeline.', 'Datumi iz svake putovnice postaju jedna uređena vremenska crta.')}</p><a class="op83-empty-action" href="#passportFormV83">${t('Add a dated passport →', 'Dodaj putovnicu s rokovima →')}</a></div>`;
      return;
    }
    host.innerHTML = events.slice(0, 24).map(event => {
      const days = Math.ceil((dateValue(event.date) - now) / 86400000);
      const urgency = days < 0 ? 'past' : days <= 14 ? 'soon' : '';
      const when = days < 0 ? t(`${Math.abs(days)} days ago`, `prije ${Math.abs(days)} dana`) : days === 0 ? t('Today', 'Danas') : t(`in ${days} days`, `za ${days} dana`);
      return `<article class="op83-event ${urgency}"><time>${dateText(event.date)}<small>${when}</small></time><div><span>${esc(event.title)}</span><b>${esc(event.passport.title)}</b><small>${esc(event.passport.business || typeLabel(event.passport.kind))}</small></div></article>`;
    }).join('');
  }

  function updateCounts() {
    const count = $('#op83PassportCount');
    const actions = $('#op83ActionCount');
    if (count) count.textContent = passports.length;
    if (actions) actions.textContent = passports.flatMap(passportEvents).filter(event => dateValue(event.date) >= new Date()).length;
  }

  async function passportAction(event) {
    const qr = event.target.closest('[data-op94-qr]');
    const share = event.target.closest('[data-op83-share]');
    const remove = event.target.closest('[data-op83-delete]');
    if (qr) return showPassportQr(qr.dataset.op94Qr);
    if (share) return sharePassport(share.dataset.op83Share);
    if (remove) {
      passports = passports.filter(passport => passport.id !== remove.dataset.op83Delete);
      write(passports);
      renderPassports();
      renderTimeline();
      updateCounts();
    }
  }

  function publicSnapshot(passport) {
    return {
      verification: 'portable_snapshot',
      stillPassportVersion: 2,
      publicId: passport.publicId || null,
      kind: passport.kind,
      title: passport.title,
      businessName: passport.business || null,
      purchasedOn: passport.purchasedOn || null,
      warrantyUntil: passport.warrantyUntil || null,
      nextActionAt: passport.nextActionAt || null,
      issuer: passport.connection === 'company'
        ? { type: 'company_connected_snapshot', name: passport.business || null, verified: false }
        : { type: 'buyer_record', name: null, verified: false },
      commitments: (passport.commitments || []).slice(0, 4).map(item => ({
        publicId: item.publicId || null,
        type: item.type,
        title: String(item.title || '').slice(0, 96),
        dueAt: item.dueAt || null,
        status: item.status
      })),
      serviceHistory: (passport.serviceHistory || []).filter(item => item.isPublic).slice(0, 3).map(item => ({
        publicId: item.publicId || null,
        type: item.type,
        title: String(item.title || '').slice(0, 96),
        providerName: String(item.providerName || '').slice(0, 80) || null,
        occurredOn: item.occurredOn,
        isPublic: true,
        createdBy: item.createdBy || 'buyer'
      })),
      sharedAt: new Date().toISOString(),
      privacy: 'Buyer identity, private notes, order references, service costs and internal evidence are excluded.'
    };
  }

  function base64Url(value) {
    const bytes = new TextEncoder().encode(JSON.stringify(value));
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
  }

  function parseBase64Url(value) {
    const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async function imageDataUrl(url) {
    if (!url) return null;
    try {
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => resolve(null); reader.readAsDataURL(blob); });
    } catch { return null; }
  }

  async function passportBrand(passport) {
    const identity = window.StillIdentityV103 || {};
    const company = passport.companyProfile || identity.companies?.[passport.organizationId] || null;
    const companyLogo = company?.logo_url || company?.logoUrl || null;
    if (passport.connection === 'company') {
      if (companyLogo) return { url: companyLogo, dataUrl: await imageDataUrl(companyLogo), kind: 'company', label: company.display_name || company.displayName || passport.business };
      return { url: null, dataUrl: null, kind: 'company', label: company?.display_name || company?.displayName || passport.business || t('Company', 'Tvrtka') };
    }
    const buyer = identity.buyerProfile || {};
    if (buyer.pictureUrl) return { url: buyer.pictureUrl, dataUrl: await imageDataUrl(buyer.pictureUrl), kind: 'buyer', label: buyer.displayName || t('Buyer profile', 'Profil kupca') };
    return { url: null, dataUrl: null, kind: 'buyer', label: t('Buyer profile', 'Profil kupca') };
  }

  function qrSvg(url, title, brand) {
    if (typeof qrcode !== 'function') throw new Error('qr_generator_unavailable');
    const qr = qrcode(0, 'H');
    qr.addData(url, 'Byte');
    qr.make();
    let svg = qr.createSvgTag({ cellSize: 6, margin: 24, scalable: true, alt: `${title} QR code`, title: `${title} · Still? Passport` });
    if (brand?.dataUrl || brand?.url) {
      const viewBox = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/i);
      const size = Number(viewBox?.[1] || 0);
      if (size) {
        const badge = Math.round(size * .19), x = Math.round((size - badge) / 2), pad = Math.max(4, Math.round(size * .018));
        const embedded = `<rect x="${x-pad}" y="${x-pad}" width="${badge+pad*2}" height="${badge+pad*2}" rx="${Math.round(badge*.2)}" fill="#fff"/><image href="${esc(brand.dataUrl||brand.url)}" x="${x}" y="${x}" width="${badge}" height="${badge}" preserveAspectRatio="xMidYMid slice"/>`;
        svg = svg.replace('</svg>', `${embedded}</svg>`);
      }
    }
    return svg;
  }

  async function showPassportQr(id) {
    const passport = passports.find(item => item.id === id);
    if (!passport || !qrDialog) return;
    qrDialog.innerHTML = `<div class="op94-loading">${t('Preparing a privacy-safe QR code…', 'Priprema QR koda koji čuva privatnost…')}</div>`;
    if (!qrDialog.open) qrDialog.showModal();
    let url;
    let token = null;
    let expiresAt = null;
    let verified = false;
    if (passport.publicId) {
      try {
        const share = await api(`/api/v1/ownership/passports/${encodeURIComponent(passport.publicId)}/shares`, { method: 'POST', body: JSON.stringify({ days: 30 }) });
        url = share.verifyUrl;
        token = share.token;
        expiresAt = share.expiresAt;
        verified = true;
      } catch {}
    }
    if (!url) {
      const snapshot = publicSnapshot(passport);
      url = `${location.origin}${location.pathname}#passportSnapshot=${encodeURIComponent(base64Url(snapshot))}`;
    }
    try {
      const brand = await passportBrand(passport);
      activeQr = { url, token, publicId: passport.publicId || null, title: passport.title, verified, expiresAt, brand, svg: qrSvg(url, passport.title, brand) };
      renderPassportQr(passport);
    } catch {
      qrDialog.innerHTML = `<button class="op94-close" data-op94-close aria-label="${t('Close', 'Zatvori')}">×</button><div class="op94-error">${t('The QR code could not be generated on this device.', 'QR kod nije moguće izraditi na ovom uređaju.')}</div>`;
    }
  }

  function renderPassportQr(passport) {
    const state = activeQr.verified
      ? `<span class="op94-state verified">✓ ${t('Still? server verification', 'Still? poslužiteljska provjera')}</span><p>${t(`This revocable link expires ${dateText(activeQr.expiresAt.slice(0, 10))}. Scanning checks the current public record.`, `Ova opoziva poveznica istječe ${dateText(activeQr.expiresAt.slice(0, 10))}. Skeniranje provjerava trenutačni javni zapis.`)}</p>`
      : `<span class="op94-state portable">◇ ${t('Portable snapshot', 'Prenosiva snimka')}</span><p>${t('This passport is local or server verification is unavailable. The QR carries a privacy-safe snapshot, but it is not proof that Still? or a business verified the purchase.', 'Ova putovnica je lokalna ili poslužiteljska provjera nije dostupna. QR nosi snimku koja čuva privatnost, ali nije dokaz da su Still? ili tvrtka verificirali kupnju.')}</p>`;
    const brand = activeQr.brand?.url ? `<span class="op103-qr-brand ${esc(activeQr.brand.kind)}"><img src="${esc(activeQr.brand.url)}" alt="${esc(activeQr.brand.label||'')}"></span>` : `<span class="op103-qr-brand fallback ${esc(activeQr.brand?.kind||'buyer')}"><b>${esc((activeQr.brand?.label||'?').slice(0,2).toUpperCase())}</b></span>`;
    qrDialog.innerHTML = `<button class="op94-close" data-op94-close aria-label="${t('Close', 'Zatvori')}">×</button><div class="op94-qr-layout"><div class="op94-qr-visual">${activeQr.svg}${brand}</div><div class="op94-qr-copy"><span class="op83-kicker">PASSPORT QR</span><h2>${esc(passport.title)}</h2>${state}<div class="op103-brand-note"><b>${activeQr.brand?.kind==='company'?t('Company-branded passport','Putovnica s logotipom tvrtke'):t('Buyer-owned passport','Putovnica s profilom kupca')}</b><span>${esc(activeQr.brand?.label||'')}</span></div><div class="op94-safe"><b>◉ ${t('Safe to scan', 'Sigurno za skeniranje')}</b><span>${t('The center image identifies the connected profile, but buyer identity, private notes, order references and internal evidence are not encoded in the QR.', 'Slika u sredini identificira povezani profil, ali identitet kupca, privatne bilješke, reference narudžbe i interni dokazi nisu kodirani u QR-u.')}</span></div><div class="op94-actions"><button data-op94-copy>${t('Copy link', 'Kopiraj poveznicu')}</button><button data-op94-download>${t('Download QR', 'Preuzmi QR')}</button><button data-op94-share>${t('Share', 'Podijeli')}</button>${activeQr.verified ? `<button class="danger" data-op94-revoke>${t('Revoke link', 'Opozovi poveznicu')}</button>` : ''}</div><small id="op94QrMessage"></small></div></div>`;
  }

  async function qrDialogAction(event) {
    if (event.target === qrDialog || event.target.closest('[data-op94-close]')) return qrDialog.close();
    const message = $('#op94QrMessage', qrDialog);
    if (event.target.closest('[data-op94-copy]')) {
      try { await navigator.clipboard.writeText(activeQr.url); message.textContent = t('Verification link copied.', 'Poveznica za provjeru je kopirana.'); } catch { message.textContent = t('Copying is unavailable.', 'Kopiranje nije dostupno.'); }
    }
    if (event.target.closest('[data-op94-download]')) {
      const blob = new Blob([activeQr.svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `still-passport-qr-${activeQr.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'passport'}.svg`;
      link.click();
      URL.revokeObjectURL(url);
      message.textContent = t('QR downloaded as a print-ready SVG.', 'QR je preuzet kao SVG spreman za ispis.');
    }
    if (event.target.closest('[data-op94-share]')) {
      try {
        if (navigator.share) await navigator.share({ title: `${t('Still? Passport', 'Still? putovnica')} · ${activeQr.title}`, url: activeQr.url });
        else await navigator.clipboard.writeText(activeQr.url);
        message.textContent = t('Passport link ready to share.', 'Poveznica putovnice spremna je za dijeljenje.');
      } catch {}
    }
    if (event.target.closest('[data-op94-revoke]') && activeQr.token && activeQr.publicId) {
      const button = event.target.closest('[data-op94-revoke]');
      button.disabled = true;
      try {
        await api(`/api/v1/ownership/passports/${encodeURIComponent(activeQr.publicId)}/shares/${encodeURIComponent(activeQr.token)}`, { method: 'DELETE' });
        message.textContent = t('Link revoked. This QR no longer opens the passport.', 'Poveznica je opozvana. Ovaj QR više ne otvara putovnicu.');
        button.remove();
      } catch { message.textContent = t('The link could not be revoked right now.', 'Poveznicu trenutačno nije moguće opozvati.'); button.disabled = false; }
    }
  }

  function verificationDetail(label, value) {
    return value ? `<div><span>${label}</span><b>${esc(value)}</b></div>` : '';
  }

  function renderPublicVerification(passport, serverVerified) {
    const issuer = passport.issuer || {};
    const commitments = (passport.commitments || []).map(item => `<li><div><b>${esc(item.title)}</b><span>${esc(item.status)}${item.dueAt ? ` · ${dateText(item.dueAt)}` : ''}</span></div></li>`).join('');
    const serviceHistory = (passport.serviceHistory || []).map(item => `<li><div><b>${esc(item.title)}</b><span>${item.occurredOn ? dateText(item.occurredOn) : ''}${item.providerName ? ` · ${esc(item.providerName)}` : ''}</span></div></li>`).join('');
    const issuerLogo = issuer.logoUrl ? `<img class="op103-issuer-logo" src="${esc(issuer.logoUrl)}" alt="${esc(issuer.name||'')}">` : '✓';
    qrDialog.innerHTML = `<button class="op94-close" data-op94-close aria-label="${t('Close', 'Zatvori')}">×</button><div class="op94-verify"><span class="op94-state ${serverVerified ? 'verified' : 'portable'}">${serverVerified ? `✓ ${t('Live Still? record', 'Živi Still? zapis')}` : `◇ ${t('Portable snapshot', 'Prenosiva snimka')}`}</span><h1>${esc(passport.title || t('Passport', 'Putovnica'))}</h1><p>${serverVerified ? t('This QR resolves to an active, privacy-safe record stored by Still?.', 'Ovaj QR vodi na aktivan zapis koji čuva privatnost i pohranjen je u Still?.') : t('This information travelled inside the QR and has not been authenticated by Still?.', 'Ove informacije putovale su unutar QR koda i Still? ih nije autentificirao.')}</p><div class="op94-verify-grid">${verificationDetail(t('Type', 'Vrsta'), typeLabel(passport.kind))}${verificationDetail(t('Business', 'Tvrtka'), passport.businessName)}${verificationDetail(t('Purchased', 'Kupljeno'), passport.purchasedOn ? dateText(passport.purchasedOn) : '')}${verificationDetail(t('Warranty until', 'Jamstvo do'), passport.warrantyUntil ? dateText(passport.warrantyUntil) : '')}${verificationDetail(t('Next action', 'Sljedeća radnja'), passport.nextActionAt ? dateText(passport.nextActionAt) : '')}${verificationDetail(t('Record ID', 'ID zapisa'), passport.publicId)}</div>${issuer.type === 'verified_business' && issuer.verified ? `<div class="op94-company">${issuerLogo}<b>${esc(issuer.name || passport.businessName || t('Verified business', 'Verificirana tvrtka'))}</b><span>${t('Company identity is verified on Still?.', 'Identitet tvrtke verificiran je na Still?.')}</span></div>` : ''}${commitments ? `<section><span class="op83-kicker">${t('PUBLIC COMMITMENTS', 'JAVNA OBEĆANJA')}</span><ul>${commitments}</ul></section>` : ''}${serviceHistory ? `<section class="op94-history"><span class="op83-kicker">${t('PUBLIC SERVICE HISTORY', 'JAVNA SERVISNA POVIJEST')}</span><ul>${serviceHistory}</ul><small>${t('Private notes and service costs are excluded.', 'Privatne bilješke i troškovi servisa su izostavljeni.')}</small></section>` : ''}<div class="op94-disclaimer"><b>${t('What this does not prove', 'Što ovo ne dokazuje')}</b><p>${t('A passport helps identify the record and commitments. It does not replace an invoice, prove legal ownership, guarantee authenticity of the physical item or decide legal rights.', 'Putovnica pomaže identificirati zapis i obećanja. Ne zamjenjuje račun, ne dokazuje pravno vlasništvo, ne jamči autentičnost fizičkog predmeta niti odlučuje o pravima.')}</p></div></div>`;
  }

  async function openPassportVerification() {
    if (!qrDialog) return;
    const url = new URL(location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    const token = fragment.get('passportVerify') || url.searchParams.get('passportVerify');
    const snapshot = fragment.get('passportSnapshot') || url.searchParams.get('passportSnapshot');
    if (!token && !snapshot) return;
    url.searchParams.delete('passportVerify');
    url.searchParams.delete('passportSnapshot');
    const remainingQuery = url.searchParams.toString();
    history.replaceState(null, '', `${url.pathname}${remainingQuery ? `?${remainingQuery}` : ''}`);
    qrDialog.innerHTML = `<div class="op94-loading">${t('Checking passport…', 'Provjera putovnice…')}</div>`;
    if (!qrDialog.open) qrDialog.showModal();
    try {
      if (token) {
        const result = await api(`/api/v1/ownership/verify/${encodeURIComponent(token)}`);
        renderPublicVerification(result.passport, true);
      } else {
        const data = parseBase64Url(snapshot);
        if (data.stillPassportVersion !== 2 || data.verification !== 'portable_snapshot') throw new Error('invalid_snapshot');
        renderPublicVerification(data, false);
      }
    } catch {
      qrDialog.innerHTML = `<button class="op94-close" data-op94-close aria-label="${t('Close', 'Zatvori')}">×</button><div class="op94-error"><b>${t('This passport link is unavailable.', 'Ova poveznica putovnice nije dostupna.')}</b><p>${t('It may have expired, been revoked, been changed, or the verification service may be temporarily unavailable.', 'Možda je istekla, opozvana, promijenjena ili je usluga provjere trenutačno nedostupna.')}</p></div>`;
    }
  }

  async function sharePassport(id) {
    const passport = passports.find(item => item.id === id);
    if (!passport) return;
    const transferable = {
      stillPassportVersion: 1,
      kind: passport.kind,
      title: passport.title,
      business: passport.business || null,
      purchasedOn: passport.purchasedOn || null,
      warrantyUntil: passport.warrantyUntil || null,
      nextActionAt: passport.nextActionAt || null,
      note: t('Private notes and order references are excluded.', 'Privatne bilješke i reference narudžbe su izostavljene.')
    };
    const text = `${t('Still? Passport', 'Still? putovnica')}: ${passport.title}\n${JSON.stringify(transferable, null, 2)}`;
    try {
      if (navigator.share) await navigator.share({ title: `${t('Still? Passport', 'Still? putovnica')} · ${passport.title}`, text });
      else {
        await navigator.clipboard.writeText(text);
        alert(t('Transfer-safe passport copied.', 'Putovnica sigurna za prijenos je kopirana.'));
      }
    } catch {}
  }

  function exportPassports() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), passports }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `still-passports-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function api(path, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(path, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, signal: controller.signal, ...options });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || `HTTP ${response.status}`), { status: response.status, data });
      return data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function fromRemote(item) {
    return {
      id: item.publicId,
      publicId: item.publicId,
      kind: item.kind,
      title: item.title,
      business: item.businessName || '',
      reference: item.reference || '',
      purchasedOn: item.purchasedOn || '',
      returnBy: item.returnBy || '',
      warrantyUntil: item.warrantyUntil || '',
      renewalAt: item.renewalAt || '',
      nextActionAt: item.nextActionAt || '',
      notes: item.notes || '',
      commitments: Array.isArray(item.commitments) ? item.commitments : [],
      serviceHistory: Array.isArray(item.serviceHistory) ? item.serviceHistory : [],
      connection: item.organizationId ? 'company' : 'buyer-owned',
      organizationId: item.organizationId || null,
      companyProfile: item.companyProfile || null,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt
    };
  }

  async function syncAccount(event) {
    const button = event.currentTarget;
    const original = button.textContent;
    button.disabled = true;
    button.textContent = t('Syncing…', 'Sinkronizacija…');
    try {
      const remote = await api('/api/v1/ownership/passports');
      const localUnsynced = passports.filter(item => !item.publicId);
      for (const item of localUnsynced) {
        try {
          const created = await api('/api/v1/ownership/passports', { method: 'POST', body: JSON.stringify(item) });
          item.publicId = created.passport.publicId;
          item.id = created.passport.publicId;
        } catch {}
      }
      const refreshed = await api('/api/v1/ownership/passports');
      const remoteItems = (refreshed.passports || remote.passports || []).map(fromRemote);
      const remoteIds = new Set(remoteItems.map(item => item.publicId));
      passports = [...remoteItems, ...passports.filter(item => !item.publicId || !remoteIds.has(item.publicId))];
      write(passports);
      renderPassports();
      renderTimeline();
      updateCounts();
      button.textContent = t('Synced ✓', 'Sinkronizirano ✓');
    } catch (error) {
      button.textContent = error.status === 401 ? t('Sign in to sync', 'Prijavi se za sinkronizaciju') : t('Sync unavailable', 'Sinkronizacija nije dostupna');
    } finally {
      button.disabled = false;
      setTimeout(() => { button.textContent = original; }, 2800);
    }
  }

  async function connectPassport(event) {
    event.preventDefault();
    const message = $('#connectMessageV83');
    const code = new FormData(event.currentTarget).get('code')?.trim();
    message.textContent = t('Connecting…', 'Povezivanje…');
    try {
      const result = await api('/api/v1/ownership/connect', { method: 'POST', body: JSON.stringify({ code }) });
      const connected = fromRemote(result.passport);
      passports = [connected, ...passports.filter(item => item.publicId !== connected.publicId)];
      write(passports);
      renderPassports();
      renderTimeline();
      updateCounts();
      event.currentTarget.reset();
      message.textContent = t('Connected. The shared commitments are now in your passport.', 'Povezano. Zajednička obećanja sada su u tvojoj putovnici.');
    } catch (error) {
      message.textContent = error.status === 401 ? t('Sign in as a buyer, then try the code again.', 'Prijavi se kao kupac pa ponovno pokušaj s kodom.') : error.status === 404 ? t('That connection code was not found.', 'Taj kod povezivanja nije pronađen.') : t('Connection is temporarily unavailable. Your local passports are safe.', 'Povezivanje trenutačno nije dostupno. Lokalne putovnice su sigurne.');
    }
  }

  function remountForLanguage() {
    const platform = $('#ownershipPlatformV83');
    if (!platform) return mount();
    platform.innerHTML = shell();
    bind();
    renderPassports();
    renderTimeline();
    updateCounts();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
  window.addEventListener('still:language', () => setTimeout(remountForLanguage, 0));
  window.addEventListener('still:commerce-paid', () => {
    passports = read();
    renderPassports();
    renderTimeline();
    updateCounts();
  });
  $('#language')?.addEventListener('change', () => setTimeout(remountForLanguage, 20));
})();
