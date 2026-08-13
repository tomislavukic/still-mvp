(() => {
  const STORAGE_KEY = 'still-ownership-passports-v83';
  const LANGUAGE_KEY = 'still-lang';
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const LEGACY_PUBLIC_HASHES = /^#(?:buyeros-(?:home|things|thing|protection|timeline|documents|services|household|family|search|assistant)|worldFoundationV131|ownershipHubV83|timelineV83|checker|lifecyclePlatformV95|passportCommerceV92|decisionLabV83|buyerRewardsV76)$/;
  const LEGACY_PUBLIC_IDS = [
    'discoverV83', 'ownershipPlatformV83', 'ownershipHomeV112', 'ownershipFeedV113',
    'passportCommerceV92', 'decisionLabV83', 'ownershipHubV83', 'lifecyclePlatformV95',
    'timelineV83', 'howConnectsV83', 'buyerRewardsV76', 'checker', 'advancedToolsV84',
    'proofV22', 'relationshipDashboardV103', 'worldFoundationV131'
  ];
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
    return `<div class="sp114-example-note">${t('From this browser', 'Iz ovog preglednika')} · ${passports.length} ${t(passports.length === 1 ? 'thing' : 'things', passports.length === 1 ? 'stvar' : 'stvari')}</div><div class="sp114-things-row">${passports.slice(0, 6).map(item => `<button type="button" data-still-start data-still-destination="/app/world"><span>${kindMark(item.kind)}</span><b>${esc(item.title || t('Untitled thing', 'Stvar bez naziva'))}</b><small>${esc(item.business || kindName(item.kind))}</small></button>`).join('')}</div>`;
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
          <div class="sp114-proofline" aria-label="${t('Still principles', 'Still načela')}"><span>${t('Private by default', 'Privatno po zadanim postavkama')}</span><span>${t('Your records, not invented answers', 'Tvoji zapisi, ne izmišljeni odgovori')}</span><span>${t('You confirm before saving', 'Ti potvrđuješ prije spremanja')}</span></div>
        </div>
        <article class="sp114-passport-object" aria-label="${t('Example ownership Passport for a MacBook Pro', 'Primjer putovnice vlasništva za MacBook Pro')}">
          <header><span>${t('EXAMPLE PASSPORT', 'PRIMJER PUTOVNICE')}</span><b>${t('One thing. Its whole story.', 'Jedna stvar. Cijela njezina priča.')}</b></header>
          <div class="sp114-device"><div></div><strong>MacBook Pro</strong><small>${t('Laptop · personally owned', 'Prijenosno računalo · osobno vlasništvo')}</small></div>
          <dl><div><dt>${t('Receipt', 'Račun')}</dt><dd>✓ ${t('kept', 'sačuvan')}</dd></div><div><dt>${t('Warranty', 'Jamstvo')}</dt><dd>${t('timeline ready', 'rok je spreman')}</dd></div><div><dt>${t('Manual', 'Priručnik')}</dt><dd>${t('with the product', 'uz proizvod')}</dd></div><div><dt>${t('Service history', 'Servisna povijest')}</dt><dd>${t('one continuous record', 'jedan neprekinut zapis')}</dd></div></dl>
          <div class="sp114-object-foot"><span>QR</span><p><b>${t('Portable identity', 'Prenosivi identitet')}</b><small>${t('Share only what you choose.', 'Dijeli samo ono što odabereš.')}</small></p><i>→</i></div>
        </article>
      </section>

      <section class="sp114-section sp114-current" id="inside-still">
        <div class="sp114-current-intro">
          <div><span class="sp114-kicker">${t('INTRODUCING STILL NOW', 'UPOZNAJ DANAŠNJI STILL')}</span><h2>${t('Your things are only the beginning.', 'Tvoje stvari tek su početak.')}</h2></div>
          <p>${t('Still now connects what you own with the proof behind it, what needs attention and the next real step. One private place moves with you from purchase to service, resolution and a future handoff.', 'Still sada povezuje ono što posjeduješ s dokazima, onime što traži pažnju i sljedećim stvarnim korakom. Jedno privatno mjesto prati te od kupnje do servisa, rješavanja i buduće primopredaje.')}</p>
        </div>
        <div class="sp114-current-layout">
          <nav class="sp114-current-map" aria-label="${t('What you can do in Still', 'Što možeš raditi u Still-u')}">
            <button type="button" data-still-start data-still-destination="/app"><span>01</span><b>${t('Know what matters now', 'Znaj što je važno sada')}</b><small>${t('Real deadlines, open work and a quiet state when nothing needs you.', 'Stvarni rokovi, otvorene obveze i miran prikaz kada ništa ne traži pažnju.')}</small><i>Now →</i></button>
            <button type="button" data-still-start data-still-destination="/app/world"><span>02</span><b>${t('Build your private World', 'Izgradi svoj privatni Svijet')}</b><small>${t('Things, receipts, documents, knowledge and situations stay connected.', 'Stvari, računi, dokumenti, znanje i situacije ostaju povezani.')}</small><i>World →</i></button>
            <button type="button" data-still-start data-still-destination="/app?sight=receipt"><span>03</span><b>${t('Turn proof into understanding', 'Pretvori dokaz u razumijevanje')}</b><small>${t('Still can read a supported receipt or document; you review the result before it becomes a record.', 'Still može pročitati podržani račun ili dokument; ti pregledaš rezultat prije nego što postane zapis.')}</small><i>Sight →</i></button>
            <button type="button" data-still-start data-still-destination="/app/market"><span>04</span><b>${t('Pass a Thing on with context', 'Predaj stvar zajedno s kontekstom')}</b><small>${t('Create a listing from something you own, record offers and transfer its privacy-safe history.', 'Stvori oglas iz stvari koju posjeduješ, zabilježi ponude i prenesi povijest sigurnu za privatnost.')}</small><i>Market →</i></button>
            <button type="button" data-still-start data-still-destination="/app/together"><span>05</span><b>${t('Work with businesses intentionally', 'Surađuj s tvrtkama namjerno')}</b><small>${t('A connected business sees only what an existing Passport or case allows.', 'Povezana tvrtka vidi samo ono što dopušta postojeća Putovnica ili slučaj.')}</small><i>Together →</i></button>
          </nav>
          <article class="sp114-current-stage" aria-label="${t('How the new Still experience works', 'Kako radi novo Still iskustvo')}">
            <header><span>${t('AVAILABLE IN STILL', 'DOSTUPNO U STILL-U')}</span><b>${t('One continuous ownership story', 'Jedna neprekinuta priča vlasništva')}</b></header>
            <div class="sp114-stage-focus"><span>NOW</span><h3>${t('The important thing comes first.', 'Važna stvar dolazi prva.')}</h3><p>${t('Still derives attention from dates, Needs and open work already in your private records.', 'Still izvodi pažnju iz datuma, Potreba i otvorenih obveza koje već postoje u tvojim privatnim zapisima.')}</p></div>
            <ol>
              <li><span>◇</span><div><b>${t('Your World', 'Tvoj Svijet')}</b><small>${t('Things + proof + context', 'Stvari + dokazi + kontekst')}</small></div><i>connected</i></li>
              <li><span>→</span><div><b>${t('Handle it', 'Riješi')}</b><small>${t('Evidence + real next action', 'Dokazi + stvarna sljedeća radnja')}</small></div><i>${t('no guesses', 'bez nagađanja')}</i></li>
              <li><span>↔</span><div><b>${t('Market & Together', 'Tržište i Zajedno')}</b><small>${t('Handoff + selective sharing', 'Primopredaja + selektivno dijeljenje')}</small></div><i>${t('owner-controlled', 'pod kontrolom vlasnika')}</i></li>
            </ol>
            <div class="sp114-stage-truth"><span>✓</span><p><b>${t('Truthful by design', 'Istinito po dizajnu')}</b><small>${t('Still does not invent a provider, price, deadline, company update or transaction. Payments and shipping remain outside Still.', 'Still ne izmišlja pružatelja, cijenu, rok, ažuriranje tvrtke ni transakciju. Plaćanje i dostava ostaju izvan Still-a.')}</small></p></div>
          </article>
        </div>
      </section>

      <section class="sp114-section sp114-bring" id="bring-your-things">
        <div class="sp114-section-copy"><span class="sp114-kicker">${t('START ANYWHERE', 'POČNI BILO GDJE')}</span><h2>${t('Bring your things into Still.', 'Donesi svoje stvari u Still.')}</h2><p>${t('New purchase or something you have owned for years—both belong here.', 'Nova kupnja ili nešto što godinama posjeduješ—oboje pripada ovdje.')}</p></div>
        <div class="sp114-action-line" aria-label="${t('Ways to add things', 'Načini dodavanja stvari')}">
          <button type="button" data-still-scan><span>▦</span><b>${t('Scan a receipt', 'Skeniraj račun')}</b><small>${t('Private OCR after sign-in', 'Privatni OCR nakon prijave')}</small></button>
          <button type="button" data-world-document><span>↑</span><b>${t('Upload a document', 'Prenesi dokument')}</b><small>${t('Keep the original private', 'Sačuvaj izvornik privatno')}</small></button>
          <button type="button" data-world-import><span>↧</span><b>${t('Import purchases', 'Uvezi kupnje')}</b><small>${t('Bring records from this browser', 'Prenesi zapise iz ovog preglednika')}</small></button>
          <button type="button" data-still-start><span>＋</span><b>${t('Add manually', 'Dodaj ručno')}</b><small>${t('Only a name is required', 'Obavezan je samo naziv')}</small></button>
        </div>
        <div class="sp114-transformation"><div><span>${t('BEFORE', 'PRIJE')}</span><ul><li>▤ ${t('Receipt', 'Račun')}</li><li>PDF ${t('Manual', 'Priručnik')}</li><li>▧ ${t('Photo', 'Fotografija')}</li><li>@ ${t('Purchase email', 'E-pošta o kupnji')}</li></ul></div><i>→</i><div><span>${t('AFTER', 'POSLIJE')}</span><strong>${t('One organized ownership record', 'Jedan uređen zapis vlasništva')}</strong><small>${t('Nothing is imported without your review.', 'Ništa se ne uvozi bez tvog pregleda.')}</small></div></div>
      </section>

      <section class="sp114-section sp114-collection" id="your-things">
        <div class="sp114-section-copy"><span class="sp114-kicker">${t('YOUR THINGS', 'TVOJE STVARI')}</span><h2>${t('A calm home for the things that matter.', 'Mirno mjesto za stvari koje su važne.')}</h2><p>${t('See what you own without turning your life into an inventory database.', 'Vidi što posjeduješ bez pretvaranja života u bazu inventara.')}</p></div>
        ${realCollection(passports)}
      </section>

      <section class="sp114-section sp114-memory" id="still-remembers">
        <div class="sp114-memory-copy"><span class="sp114-kicker">${t('STILL REMEMBERS', 'STILL PAMTI')}</span><h2>${t('The right detail, before you need it.', 'Pravi detalj, prije nego što ti zatreba.')}</h2><p>${t('Dates and changes become a quiet timeline instead of another list to maintain.', 'Datumi i promjene postaju mirna vremenska crta, a ne još jedan popis za održavanje.')}</p><button type="button" class="sp114-text-action" data-still-start data-still-destination="/app">${t('Open my reminders', 'Otvori moje podsjetnike')} →</button></div>
        <ol class="sp114-memory-stream">${realMemory(passports)}</ol>
      </section>

      <section class="sp114-section sp114-passport" id="passport">
        <div class="sp114-section-copy"><span class="sp114-kicker">${t('EVERYTHING ABOUT ONE THING', 'SVE O JEDNOJ STVARI')}</span><h2>${t('Meet the Passport.', 'Upoznaj Putovnicu.')}</h2><p>${t('A Passport is the living record that keeps a thing understandable throughout its life.', 'Putovnica je živi zapis koji jednu stvar čini razumljivom tijekom cijelog njezina života.')}</p></div>
        <div class="sp114-passport-detail"><aside><span>${t('EXAMPLE', 'PRIMJER')}</span><strong>Bosch Washer</strong><small>${t('Household appliance', 'Kućanski uređaj')}</small><button type="button" data-still-start data-still-destination="/app/world">${t('Open my Passports', 'Otvori moje Putovnice')} →</button></aside><div><ul><li><b>${t('Documents', 'Dokumenti')}</b><small>${t('Receipts and manuals stay with the thing.', 'Računi i priručnici ostaju uz stvar.')}</small></li><li><b>${t('Warranty', 'Jamstvo')}</b><small>${t('The coverage date is easy to find.', 'Datum pokrića lako je pronaći.')}</small></li><li><b>${t('Timeline', 'Vremenska crta')}</b><small>${t('Purchase, service and next actions in order.', 'Kupnja, servis i sljedeće radnje redom.')}</small></li><li><b>${t('Repairs', 'Popravci')}</b><small>${t('A continuous service history when records exist.', 'Neprekinuta servisna povijest kada zapisi postoje.')}</small></li><li><b>${t('Ownership', 'Vlasništvo')}</b><small>${t('Buyer-owned or issued by a verified business.', 'U vlasništvu kupca ili izdano od verificirane tvrtke.')}</small></li><li><b>${t('QR identity', 'QR identitet')}</b><small>${t('A portable, revocable view.', 'Prenosiv prikaz koji se može opozvati.')}</small></li></ul></div></div>
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

      <section class="sp114-final" id="start"><span class="sp114-kicker">STILL</span><h2>${t('Already own something?', 'Već nešto posjeduješ?')}</h2><p>${t('You are ready for Still.', 'Spreman si za Still.')}</p><button type="button" class="sp114-primary" data-still-start>${t('Start free', 'Počni besplatno')}</button></section>`;
  }

  function header() {
    const nav = $('.topbar .nav');
    if (nav) nav.innerHTML = `<a href="#inside-still">${t('Inside Still', 'U Still-u')}</a><a href="#bring-your-things">${t('How it works', 'Kako radi')}</a><a href="/pricing.html">${t('Pricing', 'Planovi')}</a><a href="/company.html">${t('For Business', 'Za tvrtke')}</a>`;
    const brand = $('.topbar .brand');
    if (brand) { brand.href = '#features'; brand.textContent = 'Still'; brand.setAttribute('aria-label', 'Still home'); }
    const actions = $('.topbar .top-actions');
    if (actions && !$('#stillHeaderStartV114')) {
      const button = document.createElement('button');
      button.id = 'stillHeaderStartV114';
      button.type = 'button';
      button.className = 'sp114-header-start';
      button.textContent = t('Start free', 'Počni besplatno');
      button.addEventListener('click', () => enterStill());
      actions.prepend(button);
    } else if ($('#stillHeaderStartV114')) $('#stillHeaderStartV114').textContent = t('Start free', 'Počni besplatno');
    const footer = document.querySelector('footer');
    const footerCopy = footer?.querySelector('[data-v10="footer"]');
    if (footer && footerCopy) {
      const brandNode = [...footer.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (brandNode) brandNode.nodeValue = 'Still ';
      footerCopy.textContent = t('Calm. Private. Useful.', 'Mirno. Privatno. Korisno.');
    }
  }

  function enterStill(destination = '/app') {
    try { sessionStorage.setItem('still-post-auth-destination', destination); } catch {}
    if (window.StillBuyerAuth?.authenticated?.()) return location.assign(destination);
    window.dispatchEvent(new CustomEvent('still:buyer-sign-in'));
  }

  function normalizeLegacyWorkspaceHash() {
    if (!LEGACY_PUBLIC_HASHES.test(location.hash)) return;
    history.replaceState(null, '', `${location.pathname}${location.search}`);
  }

  function restoreLanguage() {
    const select = $('#language');
    if (!select) return;
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY);
      if (saved === 'en' || saved === 'hr') select.value = saved;
    } catch {}
    document.documentElement.lang = isHr() ? 'hr' : 'en';
  }

  function persistLanguage() {
    const language = isHr() ? 'hr' : 'en';
    document.documentElement.lang = language;
    try { localStorage.setItem(LANGUAGE_KEY, language); } catch {}
  }

  function placeBuyerAuth() {
    const auth = $('#buyerAuthV77,.ba77');
    if (!auth) return;
    auth.classList.remove('ba78-embedded');
    auth.classList.remove('sp114-auth-overlay');
    auth.classList.add('sp114-auth-stage');
    const topbar = $('.topbar');
    if (topbar && topbar.nextElementSibling !== auth) topbar.insertAdjacentElement('afterend', auth);
  }

  function quarantineLegacyPublicModules() {
    for (const id of LEGACY_PUBLIC_IDS) {
      const element = document.getElementById(id);
      if (!element || element.id === 'stillPublicV114') continue;
      if (!element.hidden) element.hidden = true;
      if (!element.inert) element.inert = true;
      if (element.getAttribute('aria-hidden') !== 'true') element.setAttribute('aria-hidden', 'true');
      if (element.style.getPropertyValue('display') !== 'none' || element.style.getPropertyPriority('display') !== 'important') {
        element.style.setProperty('display', 'none', 'important');
      }
    }
  }

  function bind(root) {
    root.querySelectorAll('[data-still-start]').forEach(button => button.addEventListener('click', () => enterStill(button.dataset.stillDestination || '/app')));
    root.querySelector('[data-still-scan]')?.addEventListener('click', () => enterStill('/app?sight=receipt'));
    root.querySelector('[data-world-document]')?.addEventListener('click', () => enterStill('/app?sight=document'));
    root.querySelector('[data-world-import]')?.addEventListener('click', () => enterStill('/app/world'));
  }

  function render() {
    if (document.body.classList.contains('business-page')) return;
    document.body.classList.add('still-v114');
    document.title = t('Still · Everything you own.', 'Still · Sve što posjeduješ.');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t(
      'Everything you own, in one trusted place. Keep the proof, know what needs attention, handle the next step and share only what you choose.',
      'Sve što posjeduješ na jednom pouzdanom mjestu. Sačuvaj dokaze, znaj što traži pažnju, riješi sljedeći korak i dijeli samo ono što odabereš.'
    ));
    let root = $('#stillPublicV114');
    if (!root) {
      root = document.createElement('div');
      root.id = 'stillPublicV114';
      root.className = 'sp114';
      const main = $('main');
      if (main) main.prepend(root);
      else document.body.appendChild(root);
    }
    placeBuyerAuth();
    quarantineLegacyPublicModules();
    root.innerHTML = shell();
    header();
    bind(root);
    placeBuyerAuth();
    quarantineLegacyPublicModules();
    const footer = document.querySelector('footer');
    if (footer) footer.classList.add('sp114-footer');
  }
function start() {
    normalizeLegacyWorkspaceHash();
    restoreLanguage();
    render();
    window.addEventListener('hashchange', normalizeLegacyWorkspaceHash);
    window.addEventListener('still:buyer-authenticated', () => { const button = $('#stillHeaderStartV114'); if (button) button.textContent = t('Open Still', 'Otvori Still'); });
    window.addEventListener('storage', event => { if (event.key === STORAGE_KEY) render(); });
    window.addEventListener('still:ownership-updated', () => setTimeout(render, 60));
    window.addEventListener('still:commerce-paid', () => setTimeout(render, 60));
    window.addEventListener('still:language', () => setTimeout(render, 120));
    $('#language')?.addEventListener('change', () => {
      persistLanguage();
      setTimeout(render, 0);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
