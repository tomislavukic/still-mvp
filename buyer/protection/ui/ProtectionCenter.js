(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const isHr = () => $('#language')?.value === 'hr';
  const t = (en, hr) => isHr() ? hr : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  const marketLabels = {
    hr: ['Croatia', 'Hrvatska'],
    de: ['Germany', 'Njemačka'],
    at: ['Austria', 'Austrija'],
    si: ['Slovenia', 'Slovenija'],
    it: ['Italy', 'Italija'],
    us: ['United States', 'Sjedinjene Države'],
    eu: ['European Union', 'Europska unija']
  };

  let mounted = false;
  let observer;

  function injectStyle() {
    if ($('#stillProtectionCenterStyle')) return;
    const style = document.createElement('style');
    style.id = 'stillProtectionCenterStyle';
    style.textContent = `
      .spc-shell{margin:28px 0;padding:28px;border:1px solid var(--line,#d9e1e5);border-radius:24px;background:color-mix(in srgb,var(--surface,#fff) 94%,transparent);box-shadow:var(--shadow,0 18px 50px rgba(0,0,0,.06))}
      .spc-head{display:flex;justify-content:space-between;gap:22px;align-items:flex-start;margin-bottom:22px}.spc-kicker{display:block;font-size:11px;font-weight:850;letter-spacing:.12em;color:var(--green,#4b8a67);margin-bottom:8px}.spc-head h2{margin:0;font-size:clamp(28px,3vw,42px);letter-spacing:-.045em;line-height:1.02}.spc-head p{margin:8px 0 0;color:var(--muted,#66727a);max-width:720px;line-height:1.6}.spc-badge{white-space:nowrap;padding:8px 11px;border:1px solid var(--line,#d9e1e5);border-radius:999px;font-size:12px;color:var(--muted,#66727a)}
      .spc-grid{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:18px}.spc-card{border:1px solid var(--line,#d9e1e5);border-radius:18px;padding:18px;background:var(--surface,#fff)}.spc-form{display:grid;gap:13px}.spc-form label{display:grid;gap:6px;font-size:12px;font-weight:750;color:var(--muted,#66727a)}.spc-form input,.spc-form select{width:100%;box-sizing:border-box;border:1px solid var(--line,#d9e1e5);border-radius:11px;background:var(--field,var(--surface,#fff));color:var(--ink,#111);padding:11px 12px;font:inherit}.spc-form button{min-height:44px;border:0;border-radius:12px;padding:0 16px;background:var(--green,#337b58);color:white;font-weight:800;cursor:pointer}.spc-form small{color:var(--muted,#66727a);line-height:1.5}
      .spc-results{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.spc-result{min-height:142px;border:1px solid var(--line,#d9e1e5);border-radius:16px;padding:15px;background:color-mix(in srgb,var(--surface,#fff) 92%,var(--soft,#f2f5f3))}.spc-result span{display:block;font-size:10px;font-weight:850;letter-spacing:.1em;color:var(--muted,#66727a);text-transform:uppercase}.spc-result strong{display:block;margin:8px 0 6px;font-size:18px;line-height:1.2}.spc-result p{margin:0;color:var(--muted,#66727a);font-size:13px;line-height:1.5}.spc-result a{display:inline-block;margin-top:10px;font-size:12px;font-weight:800;color:var(--green,#337b58)}.spc-empty{grid-column:1/-1;min-height:180px;display:grid;place-items:center;text-align:center;color:var(--muted,#66727a)}
      @media(max-width:850px){.spc-grid{grid-template-columns:1fr}.spc-results{grid-template-columns:1fr}.spc-head{display:block}.spc-badge{display:inline-block;margin-top:12px}}
    `;
    document.head.appendChild(style);
  }

  function shell() {
    const markets = Object.entries(marketLabels).map(([code, labels]) =>
      `<option value="${code}">${esc(isHr() ? labels[1] : labels[0])}</option>`
    ).join('');

    return `
      <section class="spc-shell" id="protectionCenterV1" aria-labelledby="protectionCenterTitleV1">
        <div class="spc-head">
          <div>
            <span class="spc-kicker">${t('PROTECTION CENTER', 'CENTAR ZAŠTITE')}</span>
            <h2 id="protectionCenterTitleV1">${t('Know what protects each thing you own.', 'Znaj što štiti svaku stvar koju posjeduješ.')}</h2>
            <p>${t('Check warranty dates and open the retailer source Still has on record. Still does not invent return deadlines or recall status.', 'Provjeri rok jamstva i otvori izvor trgovca koji Still ima evidentiran. Still ne izmišlja rokove povrata niti status opoziva.')}</p>
          </div>
          <span class="spc-badge">${t('Source-aware', 'Izvori su vidljivi')}</span>
        </div>
        <div class="spc-grid">
          <form class="spc-card spc-form" id="protectionFormV1">
            <label>${t('Item name', 'Naziv stvari')}<input name="title" maxlength="120" placeholder="${t('e.g. MacBook Pro', 'npr. MacBook Pro')}"></label>
            <label>${t('Market', 'Tržište')}<select name="market">${markets}</select></label>
            <label>${t('Retailer', 'Trgovac')}<select name="retailer"><option value="">${t('Loading retailers...', 'Učitavanje trgovaca...')}</option></select></label>
            <label>${t('Warranty ends', 'Jamstvo istječe')}<input name="warrantyEnd" type="date"></label>
            <button type="submit">${t('Check protection', 'Provjeri zaštitu')}</button>
            <small>${t('Warranty dates are evaluated from the date you enter. Retailer links come from Still’s migrated source directory and may still require verification.', 'Jamstvo se procjenjuje prema datumu koji uneseš. Poveznice trgovaca dolaze iz migriranog Still direktorija izvora i još mogu zahtijevati provjeru.')}</small>
          </form>
          <div class="spc-card spc-results" id="protectionResultsV1">
            <div class="spc-empty"><div><strong>${t('Protection details appear here.', 'Detalji zaštite pojavit će se ovdje.')}</strong><p>${t('Choose a retailer and optionally add a warranty end date.', 'Odaberi trgovca i po želji dodaj datum isteka jamstva.')}</p></div></div>
          </div>
        </div>
      </section>`;
  }

  async function fillRetailers() {
    const form = $('#protectionFormV1');
    if (!form || !window.StillProtection) return;
    const market = form.elements.market.value;
    const select = form.elements.retailer;
    select.disabled = true;
    select.innerHTML = `<option value="">${t('Loading retailers...', 'Učitavanje trgovaca...')}</option>`;
    const retailers = await window.StillProtection.loadMarket(market);
    select.innerHTML = `<option value="">${t('Choose retailer', 'Odaberi trgovca')}</option>` + retailers
      .slice()
      .sort((a, b) => String(a.name).localeCompare(String(b.name), isHr() ? 'hr' : 'en'))
      .map(retailer => `<option value="${esc(retailer.id)}">${esc(retailer.name)}</option>`)
      .join('');
    select.disabled = false;
  }

  function warrantyCopy(warranty) {
    if (!warranty.available) return [t('Not entered', 'Nije uneseno'), t('Add a warranty end date to calculate its status.', 'Dodaj datum isteka jamstva za izračun statusa.')];
    if (warranty.status === 'active') return [t('Warranty active', 'Jamstvo aktivno'), t(`${Math.max(0, warranty.daysRemaining)} days remaining`, `Preostalo dana: ${Math.max(0, warranty.daysRemaining)}`)];
    if (warranty.status === 'expired') return [t('Warranty ended', 'Jamstvo završilo'), t('The entered warranty end date has passed.', 'Uneseni datum isteka jamstva je prošao.')];
    return [t('Warranty recorded', 'Jamstvo evidentirano'), t('Status cannot be determined from the available date.', 'Status se ne može odrediti iz dostupnog datuma.')];
  }

  async function analyze(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const market = form.elements.market.value;
    const retailerId = form.elements.retailer.value;
    const warrantyEnd = form.elements.warrantyEnd.value;
    const result = await window.StillProtection.analyze({
      id: `ui-${Date.now()}`,
      title: form.elements.title.value.trim(),
      market,
      retailerId,
      warranty: warrantyEnd ? { endDate: warrantyEnd } : {},
      recalls: []
    });

    const [wTitle, wBody] = warrantyCopy(result.warranty);
    const retailerName = result.retailer?.name || t('No retailer selected', 'Trgovac nije odabran');
    const returnBody = result.returns.source
      ? t('Official retailer source is available. Exact eligibility and deadlines must be verified there.', 'Dostupan je službeni izvor trgovca. Točnu prihvatljivost i rokove treba provjeriti na tom izvoru.')
      : t('Still has no retailer source for this selection.', 'Still nema izvor trgovca za ovaj odabir.');
    const recallBody = t('No recall dataset is connected for this item yet. This is not a statement that no recall exists.', 'Za ovu stvar još nije povezan skup podataka o opozivima. To ne znači da opoziv ne postoji.');

    $('#protectionResultsV1').innerHTML = `
      <article class="spc-result"><span>${t('Warranty', 'Jamstvo')}</span><strong>${esc(wTitle)}</strong><p>${esc(wBody)}</p></article>
      <article class="spc-result"><span>${t('Return source', 'Izvor povrata')}</span><strong>${esc(retailerName)}</strong><p>${esc(returnBody)}</p>${result.returns.source ? `<a href="${esc(result.returns.source)}" target="_blank" rel="noopener noreferrer">${t('Open official source', 'Otvori službeni izvor')} ↗</a>` : ''}</article>
      <article class="spc-result"><span>${t('Recalls', 'Opozivi')}</span><strong>${t('Not connected', 'Nije povezano')}</strong><p>${esc(recallBody)}</p></article>`;
  }

  function mount() {
    if (mounted || !window.StillProtection) return;
    const hub = $('#ownershipHubV83');
    const checker = $('#checker');
    if (!hub && !checker) return;
    injectStyle();
    const wrapper = document.createElement('div');
    wrapper.innerHTML = shell();
    const section = wrapper.firstElementChild;
    if (hub) hub.insertAdjacentElement('afterend', section);
    else checker.insertAdjacentElement('beforebegin', section);
    mounted = true;
    const form = $('#protectionFormV1');
    form.elements.market.value = 'hr';
    form.elements.market.addEventListener('change', fillRetailers);
    form.addEventListener('submit', analyze);
    $('#language')?.addEventListener('change', () => {
      const current = $('#protectionCenterV1');
      if (current) current.remove();
      mounted = false;
      mount();
    });
    fillRetailers();
  }

  function scheduleMount() {
    mount();
    if (mounted) return;
    if (!observer) {
      observer = new MutationObserver(() => {
        mount();
        if (mounted && observer) {
          observer.disconnect();
          observer = null;
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  window.addEventListener('still:protection-ready', scheduleMount);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleMount, { once: true });
  else scheduleMount();
})();

