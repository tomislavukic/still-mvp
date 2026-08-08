(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  let authenticated = document.body.classList.contains('company-authenticated');

  function shell() {
    return `
      <div class="bv114">
        <section class="bv114-hero" id="business-overview">
          <div>
            <span class="sp114-kicker">${t('STILL FOR BUSINESS · EARLY ACCESS', 'STILL ZA TVRTKE · RANI PRISTUP')}</span>
            <h1>Still for Business</h1>
            <h2>${t('Support every product after the sale.', 'Podržite svaki proizvod nakon prodaje.')}</h2>
            <p>${t('Give customers a useful product record, then handle service, warranty, repairs and verified history from one connected workspace.', 'Dajte kupcima koristan zapis proizvoda, a zatim vodite servis, jamstvo, popravke i verificiranu povijest iz jednog povezanog radnog prostora.')}</p>
            <a href="#companyPortalV46">${authenticated ? t('Open my workspace', 'Otvori moj radni prostor') : t('Request Early Access', 'Zatraži rani pristup')}</a>
          </div>
          <div class="bv114-service-line" aria-label="${t('Business outcomes', 'Poslovni ishodi')}">
            <b>${t('Service.', 'Servis.')}</b><b>${t('Warranty.', 'Jamstvo.')}</b><b>${t('Repairs.', 'Popravci.')}</b><b>${t('Passports.', 'Putovnice.')}</b><b>${t('Customer trust.', 'Povjerenje kupaca.')}</b>
          </div>
        </section>

        <section class="bv114-section" id="business-capabilities">
          <span class="sp114-kicker">${t('ONE WORKSPACE, FIVE JOBS', 'JEDAN RADNI PROSTOR, PET POSLOVA')}</span>
          <h2>${t('Powerful underneath. Clear on the surface.', 'Snažno u pozadini. Jasno na površini.')}</h2>
          <p>${t('Existing company tools remain available. Still groups them around the work your team is trying to complete instead of presenting a wall of modules.', 'Postojeći alati tvrtke ostaju dostupni. Still ih grupira oko posla koji tim pokušava dovršiti, umjesto prikaza zida modula.')}</p>
          <div class="bv114-groups">
            <article class="bv114-group"><b>OPERATE</b><p><strong>${t('Run daily work', 'Vodite svakodnevni rad')}</strong>${t('Inventory, locations, staff, tasks, approvals, purchasing and electronic shelf labels.', 'Zalihe, lokacije, zaposlenici, zadaci, odobrenja, nabava i elektroničke cijene na policama.')}</p></article>
            <article class="bv114-group"><b>SELL</b><p><strong>${t('Complete a trusted sale', 'Dovršite pouzdanu prodaju')}</strong>${t('Offers, checkout handoff, orders and verified Passport issuance stay connected to the seller.', 'Ponude, usmjeravanje naplate, narudžbe i izdavanje verificiranih Putovnica ostaju povezani s prodavateljem.')}</p></article>
            <article class="bv114-group"><b>SERVE</b><p><strong>${t('Support what was sold', 'Podržite ono što je prodano')}</strong>${t('Customer cases, service bookings, repairs, parts, warranty decisions and status updates.', 'Slučajevi kupaca, termini servisa, popravci, dijelovi, odluke o jamstvu i ažuriranja statusa.')}</p></article>
            <article class="bv114-group"><b>TRUST</b><p><strong>${t('Keep a verifiable history', 'Čuvajte provjerljivu povijest')}</strong>${t('Company verification, ownership Passports, QR identity, product history and attributable actions.', 'Verifikacija tvrtke, Putovnice vlasništva, QR identitet, povijest proizvoda i pripisive radnje.')}</p></article>
            <article class="bv114-group"><b>GROW</b><p><strong>${t('Build the relationship after purchase', 'Gradite odnos nakon kupnje')}</strong>${t('Customer relationships, rewards, insights, renewals and lifecycle communication.', 'Odnosi s kupcima, nagrade, uvidi, obnove i komunikacija tijekom životnog ciklusa.')}</p></article>
          </div>
        </section>

        <section class="bv114-section bv114-principle">
          <span class="sp114-kicker">${t('CONNECTED BY THE PRODUCT', 'POVEZANI PROIZVODOM')}</span>
          <h2>${t('Useful to the customer. Actionable for the business.', 'Korisno kupcu. Primjenjivo tvrtki.')}</h2>
          <p>${t('The owner controls their information. A business sees buyer-linked information only when it is intentionally shared or belongs to a verified relationship it participates in.', 'Vlasnik kontrolira svoje informacije. Tvrtka vidi informacije povezane s kupcem samo kada su namjerno podijeljene ili pripadaju verificiranom odnosu u kojem sudjeluje.')}</p>
        </section>

        <section class="bv114-access" id="early-access">
          <span class="sp114-kicker">${authenticated ? t('YOUR COMPANY', 'TVOJA TVRTKA') : t('EARLY ACCESS', 'RANI PRISTUP')}</span>
          <h2>${authenticated ? t('Your workspace is ready.', 'Tvoj radni prostor je spreman.') : t('Bring after-sale support into Still.', 'Dovedite podršku nakon prodaje u Still.')}</h2>
          <p>${authenticated ? t('Continue to the authenticated workspace below. Verification controls buyer-facing actions, while allowed setup and internal tools remain available.', 'Nastavi do prijavljenog radnog prostora ispod. Verifikacija kontrolira radnje prema kupcima, dok su dopušteno postavljanje i interni alati i dalje dostupni.') : t('Sign in to an existing company or create a workspace below. Public access is positioned as Early Access; real availability is controlled by the existing company account and verification flow.', 'Prijavite se u postojeću tvrtku ili izradite radni prostor ispod. Javni pristup predstavljen je kao rani pristup; stvarnu dostupnost kontroliraju postojeći račun tvrtke i postupak verifikacije.')}</p>
          <a href="#companyPortalV46">${authenticated ? t('Open company tools', 'Otvori poslovne alate') : t('Request Early Access', 'Zatraži rani pristup')}</a>
          <button type="button" id="bv114Explore">${t('Explore the existing workspace preview', 'Istraži postojeći pregled radnog prostora')} →</button>
        </section>
      </div>`;
  }

  function updateHeader() {
    const brand = $('.business-brand');
    if (brand) { brand.href = '/'; brand.innerHTML = 'Still <small>for Business</small>'; }
    const buyer = $('#buyerLink');
    if (buyer) buyer.textContent = t('Home', 'Početna');
    $('.business-top .back')?.setAttribute('aria-label', t('Still home', 'Početna Still'));
    const footer = $('.business-footer');
    if (footer) footer.textContent = t('Still for Business · Early Access', 'Still za tvrtke · Rani pristup');
  }

  function openPreview() {
    const preview = $('#companyToolsPreviewV97');
    if (!preview) return setTimeout(openPreview, 100);
    preview.hidden = false;
    preview.classList.add('bv114-preview-open');
    preview.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  function applyAccessState() {
    document.querySelectorAll('#companyInventoryLiveV110').forEach(element => element.classList.toggle('bv114-authenticated', authenticated));
    if (authenticated) $('#companyToolsPreviewV97')?.classList.add('bv114-preview-open');
    document.querySelectorAll('.cpv97-entry').forEach(entry => entry.style.setProperty('display', 'none', 'important'));
  }

  function render() {
    if (!document.body.classList.contains('business-page')) return;
    document.body.classList.add('business-v114');
    document.title = t('Still for Business · Early Access', 'Still za tvrtke · Rani pristup');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('Support products and customers after the sale with verified Passports, service, warranty, repairs and product history.', 'Podržite proizvode i kupce nakon prodaje uz verificirane Putovnice, servis, jamstvo, popravke i povijest proizvoda.'));
    let root = $('#stillBusinessV114');
    if (!root) {
      root = document.createElement('div');
      root.id = 'stillBusinessV114';
      $('.business-hero')?.insertAdjacentElement('beforebegin', root);
    }
    root.innerHTML = shell();
    updateHeader();
    $('#bv114Explore')?.addEventListener('click', openPreview);
    applyAccessState();
  }

  function start() {
    render();
    window.addEventListener('still:company-authenticated', () => { authenticated = true; render(); setTimeout(applyAccessState, 80); });
    window.addEventListener('still:language', () => setTimeout(render, 60));
    $('#language')?.addEventListener('change', () => setTimeout(render, 60));
    const observer = new MutationObserver(applyAccessState);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
