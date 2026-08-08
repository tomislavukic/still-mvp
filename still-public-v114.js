(() => {
  const STORAGE_KEY = 'still-ownership-passports-v83';
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const TOOL_IDS = ['ownershipHubV83', 'timelineV83', 'checker', 'lifecyclePlatformV95', 'passportCommerceV92', 'decisionLabV83', 'buyerRewardsV76'];
  let activeTool = '';
  let observer;

  function readPassports() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function kindName(kind) {
    return ({
      product: t('Product', 'Proizvod'),
      service: t('Service', 'Usluga'),
      subscription: t('Subscription', 'Pretplata'),
      booking: t('Booking', 'Rezervacija'),
      rental: t('Rental', 'Najam'),
      project: t('Project', 'Projekt')
    })[kind] || t('Thing', 'Stvar');
  }

  function kindMark(kind) {
    return ({ product: '◇', service: '◎', subscription: '↻', booking: '◷', rental: '⌂', project: '□' })[kind] || '◇';
  }

  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    if (Number.isNaN(date.valueOf())) return '';
    return new Intl.DateTimeFormat(isHr() ? 'hr-HR' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  function realCollection(passports) {
    if (!passports.length) {
      const examples = [
        ['Laptop', '◇'], ['Washing machine', '◫'], ['Television', '▭'], ['Car', '◒'], ['Headphones', '◉'], ['Home documents', '▤']
      ];
      return `<div class="sp114-example-note">${t('Example collection · your Still stays empty until you add something.', 'Primjer zbirke · tvoj Still ostaje prazan dok nešto ne dodaš.')}</div><div class="sp114-things-row">${examples.map(([en, mark], index) => `<button type="button" data-still-start><span>${mark}</span><b>${t(en, ['Prijenosno računalo', 'Perilica rublja', 'Televizor', 'Automobil', 'Slušalice', 'Dokumenti doma'][index])}</b><small>${t('Bring it into Still', 'Dodaj u Still')}</small></button>`).join('')}</div>`;
    }
    return `<div class="sp114-example-note">${t('From this browser', 'Iz ovog preglednika')} · ${passports.length} ${t(passports.length === 1 ? 'thing' : 'things', passports.length === 1 ? 'stvar' : 'stvari')}</div><div class="sp114-things-row">${passports.slice(0, 6).map(item => `<button type="button" data-still-tool="ownership"><span>${kindMark(item.kind)}</span><b>${esc(item.title || t('Untitled thing', 'Stvar bez naziva'))}</b><small>${esc(item.business || kindName(item.kind))}</small></button>`).join('')}</div>`;
  }

  function realMemory(passports) {
    const definitions = [
      ['returnBy', t('Return window', 'Rok povrata'), '↩'],
      ['warrantyUntil', t('Warranty', 'Jamstvo'), '◇'],
      ['renewalAt', t('Renewal', 'Obnova'), '↻'],
      ['nextActionAt', t('Next action', 'Sljedeća radnja'), '→']
    ];
    const events = passports.flatMap(passport => definitions.map(([field, label, mark]) => passport[field] ? {
      title: passport.title || t('Untitled thing', 'Stvar bez naziva'),
      label,
      mark,
      date: formatDate(passport[field]),
      raw: passport[field]
    } : null).filter(Boolean)).sort((a, b) => String(a.raw).localeCompare(String(b.raw))).slice(0, 4);
    if (events.length) return events.map(event => `<li><span>${event.mark}</span><div><b>${esc(event.title)}</b><small>${esc(event.label)}</small></div><time>${esc(event.date)}</time></li>`).join('');
    const examples = [
      [t('Warranty reminder', 'Podsjetnik za jamstvo'), t('Before coverage ends', 'Prije isteka pokrića'), '◇'],
      [t('Service coming up', 'Servis se približava'), t('When you choose a date', 'Kada odabereš datum'), '◷'],
      [t('Manual available', 'Priručnik je dostupan'), t('Kept with the thing', 'Sačuvan uz stvar'), '▤'],
      [t('Return window', 'Rok povrata'), t('Visible when it matters', 'Vidljiv kada je važan'), '↩']
    ];
    return examples.map(([title, detail, mark]) => `<li><span>${mark}</span><div><b>${title}</b><small>${detail}</small></div><time>${t('Example', 'Primjer')}</time></li>`).join('');
  }

  function shell() {
    const passports = readPassports();
    return `
      <section class="sp114-hero" id="features">
        <div class="sp114-hero-copy">
          <span class="sp114-kicker">STILL</span>
          <h1>${t('Everything you own.', 'Sve što posjeduješ.')}</h1>
          <h2>${t('One trusted place.', 'Jedno pouzdano mjesto.')}</h2>
          <p>${t('Still remembers receipts, warranties, manuals, service history, reminders and the important details—so you do not have to.', 'Still pamti račune, jamstva, priručnike, servisnu povijest, podsjetnike i važne detalje—da ti ne moraš.')}</p>
          <div class="sp114-actions"><button type="button" class="sp114-primary" data-still-start>${t('Start free', 'Počni besplatno')}</button><a class="sp114-secondary" href="#bring-your-things">${t('See how it works', 'Pogledaj kako radi')}</a></div>
          <small>${t('No purchase through Still required. Start with what you already own.', 'Ne moraš kupiti kroz Still. Počni s onime što već posjeduješ.')}</small>
        </div>
        <article class="sp114-passport-object" aria-label="${t('Example ownership Passport for a MacBook Pro', 'Primjer putovnice vlasništva za MacBook Pro')}">
          <header><span>${t('EXAMPLE PASSPORT', 'PRIMJER PUTOVNICE')}</span><b>${t('One thing. Its whole story.', 'Jedna stvar. Cijela njezina priča.')}</b></header>
          <div class="sp114-device"><div></div><strong>MacBook Pro</strong><small>${t('Laptop · personally owned', 'Prijenosno računalo · osobno vlasništvo')}</small></div>
          <dl><div><dt>${t('Receipt', 'Račun')}</dt><dd>✓ ${t('kept', 'sačuvan')}</dd></div><div><dt>${t('Warranty', 'Jamstvo')}</dt><dd>${t('timeline ready', 'rok je spreman')}</dd></div><div><dt>${t('Manual', 'Priručnik')}</dt><dd>${t('with the product', 'uz proizvod')}</dd></div><div><dt>${t('Service history', 'Servisna povijest')}</dt><dd>${t('one continuous record', 'jedan neprekinut zapis')}</dd></div></dl>
          <div class="sp114-object-foot"><span>QR</span><p><b>${t('Portable identity', 'Prenosivi identitet')}</b><small>${t('Share only what you choose.', 'Dijeli samo ono što odabereš.')}</small></p><i>→</i></div>
        </article>
      </section>

      <section class="sp114-section sp114-bring" id="bring-your-things">
        <div class="sp114-section-copy"><span class="sp114-kicker">${t('START ANYWHERE', 'POČNI BILO GDJE')}</span><h2>${t('Bring your things into Still.', 'Donesi svoje stvari u Still.')}</h2><p>${t('New purchase or something you have owned for years—both belong here.', 'Nova kupnja ili nešto što godinama posjeduješ—oboje pripada ovdje.')}</p></div>
        <div class="sp114-action-line" aria-label="${t('Ways to add things', 'Načini dodavanja stvari')}">
          <button type="button" data-still-scan><span>▦</span><b>${t('Scan a receipt', 'Skeniraj račun')}</b><small>${t('Use the existing scanner', 'Upotrijebi postojeći skener')}</small></button>
          <button type="button" disabled><span>↑</span><b>${t('Upload a document', 'Prenesi dokument')}</b><small>${t('Planned', 'Planirano')}</small></button>
          <button type="button" disabled><span>↧</span><b>${t('Import purchases', 'Uvezi kupnje')}</b><small>${t('Planned', 'Planirano')}</small></button>
          <button type="button" data-still-start><span>＋</span><b>${t('Add manually', 'Dodaj ručno')}</b><small>${t('Only a name is required', 'Obavezan je samo naziv')}</small></button>
        </div>
        <div class="sp114-transformation"><div><span>${t('BEFORE', 'PRIJE')}</span><ul><li>▤ ${t('Receipt', 'Račun')}</li><li>PDF ${t('Manual', 'Priručnik')}</li><li>▧ ${t('Photo', 'Fotografija')}</li><li>@ ${t('Purchase email', 'E-pošta o kupnji')}</li></ul></div><i>→</i><div><span>${t('AFTER', 'POSLIJE')}</span><strong>${t('One organized ownership record', 'Jedan uređen zapis vlasništva')}</strong><small>${t('Nothing is imported without your review.', 'Ništa se ne uvozi bez tvog pregleda.')}</small></div></div>
      </section>

      <section class="sp114-section sp114-collection" id="your-things">
        <div class="sp114-section-copy"><span class="sp114-kicker">${t('YOUR THINGS', 'TVOJE STVARI')}</span><h2>${t('A calm home for the things that matter.', 'Mirno mjesto za stvari koje su važne.')}</h2><p>${t('See what you own without turning your life into an inventory database.', 'Vidi što posjeduješ bez pretvaranja života u bazu inventara.')}</p></div>
        ${realCollection(passports)}
      </section>

      <section class="sp114-section sp114-memory" id="still-remembers">
        <div class="sp114-memory-copy"><span class="sp114-kicker">${t('STILL REMEMBERS', 'STILL PAMTI')}</span><h2>${t('The right detail, before you need it.', 'Pravi detalj, prije nego što ti zatreba.')}</h2><p>${t('Dates and changes become a quiet timeline instead of another list to maintain.', 'Datumi i promjene postaju mirna vremenska crta, a ne još jedan popis za održavanje.')}</p><button type="button" class="sp114-text-action" data-still-tool="timeline">${t('Open my reminders', 'Otvori moje podsjetnike')} →</button></div>
        <ol class="sp114-memory-stream">${realMemory(passports)}</ol>
      </section>

      <section class="sp114-section sp114-passport" id="passport">
        <div class="sp114-section-copy"><span class="sp114-kicker">${t('EVERYTHING ABOUT ONE THING', 'SVE O JEDNOJ STVARI')}</span><h2>${t('Meet the Passport.', 'Upoznaj Putovnicu.')}</h2><p>${t('A Passport is the living record that keeps a thing understandable throughout its life.', 'Putovnica je živi zapis koji jednu stvar čini razumljivom tijekom cijelog njezina života.')}</p></div>
        <div class="sp114-passport-detail"><aside><span>${t('EXAMPLE', 'PRIMJER')}</span><strong>Bosch Washer</strong><small>${t('Household appliance', 'Kućanski uređaj')}</small><button type="button" data-still-tool="ownership">${t('Open my Passports', 'Otvori moje Putovnice')} →</button></aside><div><ul><li><b>${t('Documents', 'Dokumenti')}</b><small>${t('Receipts and manuals stay with the thing.', 'Računi i priručnici ostaju uz stvar.')}</small></li><li><b>${t('Warranty', 'Jamstvo')}</b><small>${t('The coverage date is easy to find.', 'Datum pokrića lako je pronaći.')}</small></li><li><b>${t('Timeline', 'Vremenska crta')}</b><small>${t('Purchase, service and next actions in order.', 'Kupnja, servis i sljedeće radnje redom.')}</small></li><li><b>${t('Repairs', 'Popravci')}</b><small>${t('A continuous service history when records exist.', 'Neprekinuta servisna povijest kada zapisi postoje.')}</small></li><li><b>${t('Ownership', 'Vlasništvo')}</b><small>${t('Buyer-owned or issued by a verified business.', 'U vlasništvu kupca ili izdano od verificirane tvrtke.')}</small></li><li><b>${t('QR identity', 'QR identitet')}</b><small>${t('A portable, revocable view.', 'Prenosiv prikaz koji se može opozvati.')}</small></li></ul></div></div>
      </section>

      <section class="sp114-section sp114-sharing" id="private-sharing">
        <div class="sp114-sharing-copy"><span class="sp114-kicker">${t('PRIVATE BY CHOICE', 'PRIVATNO PO TVOM IZBORU')}</span><h2>${t('Share the useful part. Keep the rest private.', 'Podijeli korisni dio. Ostalo zadrži privatnim.')}</h2><p>${t('The owner decides what a connected business can see.', 'Vlasnik odlučuje što povezana tvrtka može vidjeti.')}</p></div>
        <div class="sp114-share-view"><header><span>${t('SHARED WITH', 'PODIJELJENO S')}</span><b>${t('Repair shop', 'Servis')}</b></header><div class="sp114-visible"><span>✓</span><p><b>${t('Visible', 'Vidljivo')}</b><small>${t('Warranty · Manual · Service history', 'Jamstvo · Priručnik · Servisna povijest')}</small></p></div><div class="sp114-hidden"><span>—</span><p><b>${t('Hidden', 'Skriveno')}</b><small>${t('Private notes · Personal documents · Other products', 'Privatne bilješke · Osobni dokumenti · Ostali proizvodi')}</small></p></div></div>
      </section>

      <section class="sp114-section sp114-plus" id="pricing">
        <div class="sp114-plus-intro"><span class="sp114-kicker">STILL+</span><h2>${t('Free for ownership. Plus for effortless ownership.', 'Besplatno za vlasništvo. Plus za vlasništvo bez napora.')}</h2><p>${t('The free foundation stays genuinely useful. Still+ will focus on automation, intelligence and household convenience.', 'Besplatna osnova ostaje stvarno korisna. Still+ će se usredotočiti na automatizaciju, inteligenciju i praktičnost za kućanstvo.')}</p><a href="/pricing.html">${t('See the full plan comparison', 'Pogledaj cijelu usporedbu planova')} →</a></div>
        <div class="sp114-plan-lines"><article><span>${t('AVAILABLE', 'DOSTUPNO')}</span><h3>Still Free</h3><p>${t('Ownership records, warranties, reminders, basic timeline, QR, company-issued Passports and basic sharing.', 'Zapisi vlasništva, jamstva, podsjetnici, osnovna vremenska crta, QR, Putovnice tvrtki i osnovno dijeljenje.')}</p><button type="button" data-still-start>${t('Start free', 'Počni besplatno')}</button></article><article><span>${t('PLANNED', 'PLANIRANO')}</span><h3>Still+</h3><p>${t('Purchase email import, automatic organization, Ask Still, family sharing, advanced search, smart reminders, encrypted archive and bulk import.', 'Uvoz e-pošte o kupnji, automatska organizacija, Pitaj Still, obiteljsko dijeljenje, napredno pretraživanje, pametni podsjetnici, šifrirana arhiva i skupni uvoz.')}</p><small>${t('No exact price is published yet.', 'Točna cijena još nije objavljena.')}</small></article></div>
      </section>

      <section class="sp114-section sp114-business" id="for-business">
        <div><span class="sp114-kicker">${t('STILL FOR BUSINESS · EARLY ACCESS', 'STILL ZA TVRTKE · RANI PRISTUP')}</span><h2>${t('Support products and customers after the sale.', 'Podržite proizvode i kupce nakon prodaje.')}</h2><p>${t('Issue verified Passports, manage service and warranty, update product history and support customers from the existing business workspace.', 'Izdajte verificirane Putovnice, upravljajte servisom i jamstvom, ažurirajte povijest proizvoda i podržavajte kupce iz postojećeg poslovnog radnog prostora.')}</p><a href="/company.html#early-access">${t('Request Early Access', 'Zatraži rani pristup')} →</a></div><ul><li>${t('Issue verified Passports', 'Izdajte verificirane Putovnice')}</li><li>${t('Manage service', 'Upravljajte servisom')}</li><li>${t('Handle warranty', 'Rješavajte jamstvo')}</li><li>${t('Update product history', 'Ažurirajte povijest proizvoda')}</li><li>${t('Support customers', 'Podržavajte kupce')}</li></ul>
      </section>

      <section class="sp114-section sp114-connection" id="how-still-connects">
        <div class="sp114-section-copy"><span class="sp114-kicker">${t('ONE CLEAR CONNECTION', 'JEDNA JASNA VEZA')}</span><h2>${t('The thing stays in the middle.', 'Stvar ostaje u sredini.')}</h2><p>${t('The owner controls their information. Businesses only see what is intentionally shared.', 'Vlasnik kontrolira svoje informacije. Tvrtke vide samo ono što je namjerno podijeljeno.')}</p></div><div class="sp114-connection-line"><div><span>01</span><b>${t('Person', 'Osoba')}</b></div><i>↓</i><div class="is-thing"><span>02</span><b>${t('Thing / Passport', 'Stvar / Putovnica')}</b></div><i>↓</i><div><span>03</span><b>${t('Verified business', 'Verificirana tvrtka')}</b></div></div>
      </section>

      <section class="sp114-final" id="start"><span class="sp114-kicker">STILL</span><h2>${t('Already own something?', 'Već nešto posjeduješ?')}</h2><p>${t('You are ready for Still.', 'Spreman si za Still.')}</p><button type="button" class="sp114-primary" data-still-start>${t('Start free', 'Počni besplatno')}</button></section>

      <section class="sp114-workspace-intro" id="still-workspace"><div><span class="sp114-kicker">${t('YOUR STILL', 'TVOJ STILL')}</span><h2>${t('Use the tools when you need them.', 'Upotrijebi alate kada ti trebaju.')}</h2><p>${t('The public story stays simple. Your real ownership, reminders, protection and connected services remain here.', 'Javna priča ostaje jednostavna. Tvoje stvarno vlasništvo, podsjetnici, zaštita i povezane usluge ostaju ovdje.')}</p></div><nav aria-label="${t('Still tools', 'Still alati')}"><button type="button" data-still-tool="ownership">${t('My things', 'Moje stvari')}</button><button type="button" data-still-tool="timeline">${t('Reminders', 'Podsjetnici')}</button><button type="button" data-still-tool="protection">${t('Protection', 'Zaštita')}</button><button type="button" data-still-tool="lifecycle">${t('Service history', 'Servisna povijest')}</button><button type="button" data-still-tool="commerce">${t('Connected offers', 'Povezane ponude')}</button><button type="button" data-still-tool="rewards">${t('Rewards', 'Nagrade')}</button></nav><div id="stillAccountMountV114"></div></section>`;
  }

  function header() {
    const nav = $('.topbar .nav');
    if (nav) nav.innerHTML = `<a href="#features">${t('Features', 'Značajke')}</a><a href="#bring-your-things">${t('How it works', 'Kako radi')}</a><a href="/pricing.html">${t('Pricing', 'Planovi')}</a><a href="/company.html">${t('For Business', 'Za tvrtke')}</a>`;
    const brand = $('.topbar .brand');
    if (brand) { brand.href = '#features'; brand.textContent = 'Still'; brand.setAttribute('aria-label', 'Still home'); }
    const actions = $('.topbar .top-actions');
    if (actions && !$('#stillHeaderStartV114')) {
      const button = document.createElement('button');
      button.id = 'stillHeaderStartV114';
      button.type = 'button';
      button.className = 'sp114-header-start';
      button.textContent = t('Start free', 'Počni besplatno');
      button.addEventListener('click', () => openTool('ownership'));
      actions.prepend(button);
    } else if ($('#stillHeaderStartV114')) $('#stillHeaderStartV114').textContent = t('Start free', 'Počni besplatno');
  }

  function registerTools() {
    const mapping = {
      ownership: 'ownershipHubV83', timeline: 'timelineV83', protection: 'checker', lifecycle: 'lifecyclePlatformV95',
      commerce: 'passportCommerceV92', decision: 'decisionLabV83', rewards: 'buyerRewardsV76'
    };
    TOOL_IDS.forEach(id => {
      const section = document.getElementById(id);
      if (section) section.classList.add('still-v114-tool');
    });
    document.querySelectorAll('.still-v114-tool').forEach(section => section.classList.toggle('is-open', section.id === mapping[activeTool]));
    return mapping;
  }

  function openTool(tool, shouldScroll = true) {
    activeTool = tool;
    const mapping = registerTools();
    const target = document.getElementById(mapping[tool]);
    if (!target) return setTimeout(() => openTool(tool, shouldScroll), 120);
    document.body.classList.add('still-v114-workspace-open');
    if (shouldScroll) setTimeout(() => target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }), 30);
    if (tool === 'ownership') setTimeout(() => $('#passportFormV83 input[name="title"]')?.focus({ preventScroll: true }), 500);
  }

  function toolFromHash() {
    return ({ '#ownershipHubV83': 'ownership', '#timelineV83': 'timeline', '#checker': 'protection', '#lifecyclePlatformV95': 'lifecycle', '#passportCommerceV92': 'commerce', '#decisionLabV83': 'decision', '#buyerRewardsV76': 'rewards' })[location.hash];
  }

  function moveBuyerAccount() {
    const auth = $('#buyerAuthV77,.ba77');
    const mount = $('#stillAccountMountV114');
    if (auth && mount && auth.parentElement !== mount) mount.appendChild(auth);
  }

  function bind(root) {
    root.querySelectorAll('[data-still-start]').forEach(button => button.addEventListener('click', () => openTool('ownership')));
    root.querySelectorAll('[data-still-tool]').forEach(button => button.addEventListener('click', () => openTool(button.dataset.stillTool)));
    root.querySelector('[data-still-scan]')?.addEventListener('click', () => {
      const scan = $('#scanReceipt');
      if (!scan) return openTool('ownership');
      scan.click();
    });
  }

  function render() {
    if (document.body.classList.contains('business-page')) return;
    document.body.classList.add('still-v114');
    document.title = t('Still · Everything you own.', 'Still · Sve što posjeduješ.');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t(
      'Everything you own, in one trusted place. Keep receipts, warranties, manuals, service history, reminders and important details together.',
      'Sve što posjeduješ na jednom pouzdanom mjestu. Drži račune, jamstva, priručnike, servisnu povijest, podsjetnike i važne detalje zajedno.'
    ));
    let root = $('#stillPublicV114');
    if (!root) {
      root = document.createElement('div');
      root.id = 'stillPublicV114';
      root.className = 'sp114';
      const platform = $('#ownershipPlatformV83');
      (platform || $('main')?.firstElementChild)?.insertAdjacentElement(platform ? 'beforebegin' : 'beforebegin', root);
    }
    root.innerHTML = shell();
    header();
    bind(root);
    registerTools();
    moveBuyerAccount();
    const deepLink = toolFromHash();
    if (deepLink) openTool(deepLink, false);
    const footer = document.querySelector('footer');
    if (footer) footer.classList.add('sp114-footer');
  }

  function start() {
    if (!$('#ownershipPlatformV83')) return setTimeout(start, 80);
    render();
    observer = new MutationObserver(() => { registerTools(); moveBuyerAccount(); });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', () => { const tool = toolFromHash(); if (tool) openTool(tool, false); });
    window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) render(); });
    window.addEventListener('still:ownership-updated', () => setTimeout(render, 60));
    window.addEventListener('still:commerce-paid', () => setTimeout(render, 60));
    window.addEventListener('still:language', () => setTimeout(render, 120));
    $('#language')?.addEventListener('change', () => setTimeout(render, 120));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
